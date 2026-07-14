import { NextRequest, NextResponse } from "next/server";
import { AvailabilityService } from "@/lib/services/AvailabilityService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");
    const serviceId = searchParams.get("serviceId");
    const dateStr = searchParams.get("date"); // Formato 'YYYY-MM-DD'

    if (!staffId || !serviceId || !dateStr) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos: staffId, serviceId y date." },
        { status: 400 }
      );
    }

    // El cálculo y las validaciones de zonas horarias se delegan al servicio de dominio
    const availableSlots = await AvailabilityService.getAvailableSlots(
      staffId,
      serviceId,
      dateStr
    );

    return NextResponse.json({ slots: availableSlots });
  } catch (error) {
    console.error("Error en GET /api/availability:", error);
    return NextResponse.json(
      { error: "Ocurrió un error interno del servidor." },
      { status: 500 }
    );
  }
}
