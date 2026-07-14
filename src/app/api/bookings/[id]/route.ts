import { NextRequest, NextResponse } from "next/server";
import { bookings } from "@/lib/mockDb";

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

    // Buscar la reserva en memoria
    const booking = bookings.find((b) => b.id === id);

    if (!booking) {
      return NextResponse.json(
        { error: "Reserva no encontrada." },
        { status: 404 }
      );
    }

    // Actualizar el estado de la reserva
    booking.status = status;

    return NextResponse.json({
      message: "Reserva actualizada correctamente.",
      booking,
    });
  } catch (error) {
    console.error("Error al actualizar la reserva:", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
