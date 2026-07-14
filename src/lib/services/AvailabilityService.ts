import { getSupabaseClient } from "@/lib/supabase";
import {
  combineDateAndTimeInTimezone,
  getLocalDateDayOfWeek,
  getLocalDateString
} from "@/lib/timezone";

export class AvailabilityService {
  /**
   * Genera las franjas horarias disponibles para un profesional, fecha y servicio.
   */
  static async getAvailableSlots(
    staffId: string,
    serviceId: string,
    dateStr: string // Formato 'YYYY-MM-DD'
  ): Promise<string[]> {
    const supabase = await getSupabaseClient();

    // 1. Obtener datos de servicio
    const { data: service, error: srvError } = await supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .single();
    
    if (srvError || !service) return [];

    // 2. Obtener datos de profesional
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .eq("id", staffId)
      .single();

    if (staffError || !staff) return [];

    // 3. Obtener sucursal para huso horario
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("*")
      .eq("id", staff.branch_id)
      .single();

    if (branchError || !branch) return [];

    // 4. Determinar día de la semana en el local
    const noonLocal = combineDateAndTimeInTimezone(dateStr, "12:00", branch.timezone);
    const dayOfWeek = getLocalDateDayOfWeek(noonLocal, branch.timezone);

    // 5. Buscar horario laboral de ese día
    const { data: workHour, error: whError } = await supabase
      .from("work_hours")
      .select("*")
      .eq("staff_id", staffId)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .maybeSingle();

    if (whError || !workHour) {
      return []; // El profesional no trabaja o no está activo ese día
    }

    // 6. Rango laboral del día en UTC
    const workStart = combineDateAndTimeInTimezone(dateStr, workHour.start_time, branch.timezone);
    const workEnd = combineDateAndTimeInTimezone(dateStr, workHour.end_time, branch.timezone);

    // 7. Traer reservas activas y bloqueos de ese día para evitar solapamientos
    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("start_time, end_time")
      .eq("staff_id", staffId)
      .not("status", "in", '("cancelled","no_show")')
      .lt("start_time", workEnd.toISOString())
      .gt("end_time", workStart.toISOString());

    const { data: activeBlocks } = await supabase
      .from("time_blocks")
      .select("start_time, end_time")
      .eq("staff_id", staffId)
      .lt("start_time", workEnd.toISOString())
      .gt("end_time", workStart.toISOString());

    const busyRanges = [
      ...(activeBookings || []).map(b => ({ start: new Date(b.start_time), end: new Date(b.end_time) })),
      ...(activeBlocks || []).map(tb => ({ start: new Date(tb.start_time), end: new Date(tb.end_time) }))
    ];

    // 8. Generar slots potenciales cada 15 minutos
    const availableSlots: string[] = [];
    const durationMs = service.duration_minutes * 60000;
    const stepMs = 15 * 60000;

    let currentStart = new Date(workStart);

    while (currentStart.getTime() + durationMs <= workEnd.getTime()) {
      const currentEnd = new Date(currentStart.getTime() + durationMs);

      // Comprobar colisión
      const hasConflict = busyRanges.some(
        busy => currentStart < busy.end && currentEnd > busy.start
      );

      const isPast = currentStart.getTime() <= Date.now();

      if (!hasConflict && !isPast) {
        availableSlots.push(currentStart.toISOString());
      }

      currentStart = new Date(currentStart.getTime() + stepMs);
    }

    return availableSlots;
  }

  /**
   * Realiza todas las comprobaciones de reglas de negocio para crear una reserva en Supabase.
   */
  static async validateBookingCreation(
    staffId: string,
    serviceId: string,
    start: Date
  ): Promise<{ isValid: boolean; error?: string }> {
    const supabase = await getSupabaseClient();

    // 1. Obtener datos de servicio
    const { data: service, error: srvError } = await supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .single();
    
    if (srvError || !service) {
      return { isValid: false, error: "El servicio seleccionado no existe." };
    }

    // 2. Obtener datos de profesional
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .eq("id", staffId)
      .single();

    if (staffError || !staff) {
      return { isValid: false, error: "El profesional seleccionado no existe." };
    }

    // 3. Obtener sucursal
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("*")
      .eq("id", staff.branch_id)
      .single();

    if (branchError || !branch) {
      return { isValid: false, error: "La sucursal del profesional no existe o es inválida." };
    }

    const end = new Date(start.getTime() + service.duration_minutes * 60000);

    // 4. No reservar en el pasado
    if (start.getTime() <= Date.now()) {
      return { isValid: false, error: "No es posible reservar en el pasado." };
    }

    // 5. Obtener día local e info laboral
    const localDateStr = getLocalDateString(start, branch.timezone);
    const dayOfWeek = getLocalDateDayOfWeek(start, branch.timezone);

    const { data: workHour, error: whError } = await supabase
      .from("work_hours")
      .select("*")
      .eq("staff_id", staffId)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .maybeSingle();

    if (whError || !workHour) {
      return { isValid: false, error: "El profesional no trabaja el día de la cita solicitada." };
    }

    // 6. Verificar rango horario de jornada
    const workStart = combineDateAndTimeInTimezone(localDateStr, workHour.start_time, branch.timezone);
    const workEnd = combineDateAndTimeInTimezone(localDateStr, workHour.end_time, branch.timezone);

    if (start < workStart || end > workEnd) {
      return {
        isValid: false,
        error: `El horario seleccionado está fuera de la jornada laboral del profesional para ese día (${workHour.start_time.substring(0, 5)} hs a ${workHour.end_time.substring(0, 5)} hs).`
      };
    }

    // 7. Verificar solapamiento con otras reservas en Supabase
    const { data: overlappingBookings, error: bOverlapError } = await supabase
      .from("bookings")
      .select("id")
      .eq("staff_id", staffId)
      .not("status", "in", '("cancelled","no_show")')
      .lt("start_time", end.toISOString())
      .gt("end_time", start.toISOString());

    if (bOverlapError) {
      return { isValid: false, error: "Error al validar solapamiento de reservas." };
    }

    if (overlappingBookings && overlappingBookings.length > 0) {
      return { isValid: false, error: "El horario ya está reservado por otra cita." };
    }

    // 8. Verificar solapamiento con bloqueos administrativos
    const { data: overlappingBlocks, error: blockOverlapError } = await supabase
      .from("time_blocks")
      .select("id")
      .eq("staff_id", staffId)
      .lt("start_time", end.toISOString())
      .gt("end_time", start.toISOString());

    if (blockOverlapError) {
      return { isValid: false, error: "Error al validar bloqueos de agenda." };
    }

    if (overlappingBlocks && overlappingBlocks.length > 0) {
      return { isValid: false, error: "El horario seleccionado está bloqueado por motivos administrativos." };
    }

    return { isValid: true };
  }
}
