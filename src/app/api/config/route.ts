import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { updateWorkHourSchema, createTimeBlockSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");

    if (!staffId) {
      return NextResponse.json({ error: "Falta el parámetro staffId." }, { status: 400 });
    }

    const supabase = await getSupabaseClient();

    // Consultar horarios laborales de Supabase (filtrado por RLS)
    const { data: whData, error: whError } = await supabase
      .from("work_hours")
      .select("*")
      .eq("staff_id", staffId);

    if (whError) {
      console.error("Error al obtener horarios de Supabase:", whError);
      return NextResponse.json({ error: "Error al consultar los horarios laborales." }, { status: 500 });
    }

    // Consultar bloqueos de Supabase (filtrado por RLS)
    const { data: tbData, error: tbError } = await supabase
      .from("time_blocks")
      .select("*")
      .eq("staff_id", staffId);

    if (tbError) {
      console.error("Error al obtener bloqueos de Supabase:", tbError);
      return NextResponse.json({ error: "Error al consultar los bloqueos de agenda." }, { status: 500 });
    }

    // Adaptar formato a la estructura esperada por el cliente frontend (substring de horas "HH:MM:SS" -> "HH:MM")
    const formattedWorkHours = (whData || []).map((wh: any) => ({
      id: wh.id,
      staffId: wh.staff_id,
      dayOfWeek: wh.day_of_week,
      startTime: wh.start_time.substring(0, 5),
      endTime: wh.end_time.substring(0, 5),
      isActive: wh.is_active,
    }));

    const formattedTimeBlocks = (tbData || []).map((tb: any) => ({
      id: tb.id,
      staffId: tb.staff_id,
      startTime: tb.start_time,
      endTime: tb.end_time,
      reason: tb.reason || "",
    }));

    return NextResponse.json({
      workHours: formattedWorkHours,
      timeBlocks: formattedTimeBlocks
    });
  } catch (error) {
    console.error("Error en GET /api/config:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const supabase = await getSupabaseClient();

    if (action === "update-work-hour") {
      const validation = updateWorkHourSchema.safeParse(body);
      if (!validation.success) {
        const errorMsg = validation.error.issues.map(e => e.message).join(" ");
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }

      const { id, startTime, endTime, isActive } = validation.data;

      const { error } = await supabase
        .from("work_hours")
        .update({
          start_time: startTime,
          end_time: endTime,
          is_active: isActive
        })
        .eq("id", id);

      if (error) {
        console.error("Error al actualizar horario en Supabase:", error);
        return NextResponse.json({ error: "No tienes permisos o el horario no existe." }, { status: 500 });
      }

      return NextResponse.json({ message: "Horario laboral actualizado correctamente." });
    }

    if (action === "add-time-block") {
      const validation = createTimeBlockSchema.safeParse(body);
      if (!validation.success) {
        const errorMsg = validation.error.issues.map(e => e.message).join(" ");
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }

      const { staffId, startTime, endTime, reason } = validation.data;

      if (new Date(startTime) >= new Date(endTime)) {
        return NextResponse.json({ error: "La hora de inicio debe ser anterior a la hora de fin." }, { status: 400 });
      }

      const { data: newBlock, error } = await supabase
        .from("time_blocks")
        .insert({
          staff_id: staffId,
          start_time: startTime,
          end_time: endTime,
          reason: reason || null
        })
        .select("*")
        .single();

      if (error || !newBlock) {
        console.error("Error al guardar bloqueo en Supabase:", error);
        return NextResponse.json({ error: "No fue posible registrar el bloqueo de horario." }, { status: 500 });
      }

      const formattedBlock = {
        id: newBlock.id,
        staffId: newBlock.staff_id,
        startTime: newBlock.start_time,
        endTime: newBlock.end_time,
        reason: newBlock.reason || "",
      };

      return NextResponse.json({ message: "Bloqueo de horario agregado correctamente.", timeBlock: formattedBlock });
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

    const supabase = await getSupabaseClient();

    const { error } = await supabase
      .from("time_blocks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error al eliminar bloqueo en Supabase:", error);
      return NextResponse.json({ error: "No tienes permisos para eliminar este bloqueo." }, { status: 500 });
    }

    return NextResponse.json({ message: "Bloqueo de horario eliminado correctamente." });
  } catch (error) {
    console.error("Error en DELETE /api/config:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}


