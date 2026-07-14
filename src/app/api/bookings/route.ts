import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createBookingSchema } from "@/lib/validation";
import { AvailabilityService } from "@/lib/services/AvailabilityService";

// GET: Listar todas las reservas registradas en Supabase (filtradas por RLS)
export async function GET() {
  try {
    const supabase = await getSupabaseClient();
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(`
        *,
        services (name, price),
        staff (name),
        branches (name),
        customers (name, phone)
      `)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error al obtener reservas de Supabase:", error);
      return NextResponse.json({ error: "Error al consultar las reservas." }, { status: 500 });
    }

    // Aplanar o transformar el formato para mantener compatibilidad con el dashboard frontend
    const formattedBookings = (bookings || []).map((b: any) => ({
      id: b.id,
      branchId: b.branch_id,
      staffId: b.staff_id,
      serviceId: b.service_id,
      customerName: b.customers?.name || "Desconocido",
      phone: b.customers?.phone || "",
      startTime: b.start_time,
      endTime: b.end_time,
      status: b.status,
    }));

    return NextResponse.json({ bookings: formattedBookings });
  } catch (error) {
    console.error("Error en GET /api/bookings:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

// POST: Crear una nueva reserva en Supabase con validación de RLS y reglas de negocio
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await getSupabaseClient();

    // 1. Validar campos con Zod
    const validation = createBookingSchema.safeParse(body);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((e) => e.message).join(" ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { staffId, serviceId, customerName, phone, email, startTime } = validation.data;

    // 2. Obtener datos del profesional para hallar tenant_id y branch_id
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("tenant_id, branch_id")
      .eq("id", staffId)
      .single();

    if (staffError || !staff) {
      return NextResponse.json({ error: "El profesional seleccionado no existe." }, { status: 400 });
    }

    // 3. Obtener precio y datos del servicio
    const { data: service, error: srvError } = await supabase
      .from("services")
      .select("price, duration_minutes")
      .eq("id", serviceId)
      .single();

    if (srvError || !service) {
      return NextResponse.json({ error: "El servicio seleccionado no existe." }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + service.duration_minutes * 60000);

    // 4. Ejecutar validaciones de reglas de negocio
    const checkResult = await AvailabilityService.validateBookingCreation(
      staffId,
      serviceId,
      start
    );

    if (!checkResult.isValid) {
      return NextResponse.json({ error: checkResult.error }, { status: 400 });
    }

    // 5. Buscar o crear el registro del cliente en la base de datos
    let customerId = "";
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", staff.tenant_id)
      .eq("phone", phone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custError } = await supabase
        .from("customers")
        .insert({
          tenant_id: staff.tenant_id,
          name: customerName,
          phone: phone,
          email: email || null
        })
        .select("id")
        .single();

      if (custError || !newCustomer) {
        console.error("Error al registrar cliente en Supabase:", custError);
        return NextResponse.json({ error: "Error al registrar la información del cliente." }, { status: 500 });
      }
      customerId = newCustomer.id;
    }

    // 6. Insertar la reserva física en la tabla bookings
    const { data: newBooking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        tenant_id: staff.tenant_id,
        branch_id: staff.branch_id,
        customer_id: customerId,
        staff_id: staffId,
        service_id: serviceId,
        status: "confirmed",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        price_charged: service.price
      })
      .select("*")
      .single();

    if (bookingError || !newBooking) {
      console.error("Error al crear la reserva en Supabase:", bookingError);
      return NextResponse.json({ error: "El horario seleccionado ya no está disponible (solapamiento concurrente)." }, { status: 409 });
    }

    // Adaptar formato devuelto para compatibilidad
    const formattedBooking = {
      id: newBooking.id,
      branchId: newBooking.branch_id,
      staffId: newBooking.staff_id,
      serviceId: newBooking.service_id,
      customerName,
      phone,
      startTime: newBooking.start_time,
      endTime: newBooking.end_time,
      status: newBooking.status,
    };

    return NextResponse.json(
      { message: "Reserva confirmada con éxito.", booking: formattedBooking },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear reserva:", error);
    return NextResponse.json(
      { error: "Ocurrió un error interno del servidor." },
      { status: 500 }
    );
  }
}


