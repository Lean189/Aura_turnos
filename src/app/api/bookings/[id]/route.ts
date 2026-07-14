import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "El campo 'status' es obligatorio." },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseClient();

    // Actualizar el estado de la reserva en Supabase (regulado por RLS)
    const { data: booking, error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !booking) {
      console.error("Error al actualizar reserva en Supabase:", error);
      return NextResponse.json(
        { error: "Reserva no encontrada o sin permisos de edición." },
        { status: 404 }
      );
    }

    // Devolver formato mapeado para el cliente
    const formattedBooking = {
      id: booking.id,
      branchId: booking.branch_id,
      staffId: booking.staff_id,
      serviceId: booking.service_id,
      startTime: booking.start_time,
      endTime: booking.end_time,
      status: booking.status,
    };

    return NextResponse.json({
      message: "Reserva actualizada correctamente.",
      booking: formattedBooking,
    });
  } catch (error) {
    console.error("Error al actualizar la reserva:", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}

