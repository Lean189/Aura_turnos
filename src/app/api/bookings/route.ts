import { NextRequest, NextResponse } from "next/server";
import { services, bookings, addBooking, MockBooking } from "@/lib/mockDb";
import { createBookingSchema } from "@/lib/validation";
import { AvailabilityService } from "@/lib/services/AvailabilityService";

// GET: Listar todas las reservas registradas en memoria
export async function GET() {
  return NextResponse.json({ bookings });
}

// POST: Crear una nueva reserva con validaciones robustas
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Validar campos con Zod
    const validation = createBookingSchema.safeParse(body);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((e) => e.message).join(" ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { staffId, serviceId, customerName, phone, email, startTime } = validation.data;

    // 2. Obtener duración del servicio
    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + service.duration * 60000);

    // 3. Ejecutar validaciones del Servicio de Dominio (pasado, horario laboral, solapamientos y bloqueos)
    const checkResult = await AvailabilityService.validateBookingCreation(
      staffId,
      serviceId,
      start
    );

    if (!checkResult.isValid) {
      return NextResponse.json({ error: checkResult.error }, { status: 400 });
    }

    // 4. Crear la reserva en memoria
    const newBooking: MockBooking = {
      id: "booking-" + Math.random().toString(36).substr(2, 9),
      branchId: service.branchId, // Asignar la sucursal del servicio
      staffId,
      serviceId,
      customerName,
      phone,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: "confirmed"
    };

    addBooking(newBooking);

    return NextResponse.json(
      { message: "Reserva confirmada con éxito.", booking: newBooking },
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

