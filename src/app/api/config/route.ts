import { NextRequest, NextResponse } from "next/server";
import {
  workHours,
  timeBlocks,
  updateWorkHour,
  addTimeBlock,
  deleteTimeBlock,
  MockTimeBlock
} from "@/lib/mockDb";
import { updateWorkHourSchema, createTimeBlockSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staffId");

  let filteredWorkHours = workHours;
  let filteredTimeBlocks = timeBlocks;

  if (staffId) {
    filteredWorkHours = workHours.filter(wh => wh.staffId === staffId);
    filteredTimeBlocks = timeBlocks.filter(tb => tb.staffId === staffId);
  }

  return NextResponse.json({
    workHours: filteredWorkHours,
    timeBlocks: filteredTimeBlocks
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "update-work-hour") {
      const validation = updateWorkHourSchema.safeParse(body);
      if (!validation.success) {
        const errorMsg = validation.error.issues.map(e => e.message).join(" ");
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }

      const { id, startTime, endTime, isActive } = validation.data;
      updateWorkHour(id, startTime, endTime, isActive);
      return NextResponse.json({ message: "Horario laboral actualizado correctamente." });
    }

    if (action === "add-time-block") {
      const validation = createTimeBlockSchema.safeParse(body);
      if (!validation.success) {
        const errorMsg = validation.error.issues.map(e => e.message).join(" ");
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }

      const { staffId, startTime, endTime, reason } = validation.data;

      // Validar orden de horas
      if (new Date(startTime) >= new Date(endTime)) {
        return NextResponse.json({ error: "La hora de inicio debe ser anterior a la hora de fin." }, { status: 400 });
      }
      
      const newBlock: MockTimeBlock = {
        id: "block-" + Math.random().toString(36).substr(2, 9),
        staffId,
        startTime,
        endTime,
        reason: reason || "Bloqueo manual"
      };

      addTimeBlock(newBlock);
      return NextResponse.json({ message: "Bloqueo de horario agregado correctamente.", timeBlock: newBlock });
    }

    return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
  } catch (error) {
    console.error("Error en POST /api/config:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Falta el parámetro id del bloqueo a eliminar." }, { status: 400 });
    }

    deleteTimeBlock(id);
    return NextResponse.json({ message: "Bloqueo de horario eliminado correctamente." });
  } catch (error) {
    console.error("Error en DELETE /api/config:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

