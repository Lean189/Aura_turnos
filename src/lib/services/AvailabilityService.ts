import {
  services,
  staffList,
  branchesList,
  workHours,
  hasOverlappingBooking,
  hasOverlappingTimeBlock
} from "@/lib/mockDb";
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
    // 1. Validar existencia de servicio y profesional
    const service = services.find((s) => s.id === serviceId);
    if (!service) return [];

    const staff = staffList.find((st) => st.id === staffId);
    if (!staff) return [];

    const branch = branchesList.find((b) => b.id === staff.branchId);
    if (!branch) return [];

    // 2. Determinar día de la semana según el local
    // Usamos una hora de mediodía representativa local para hallar el día de la semana sin conflictos de frontera
    const noonLocal = combineDateAndTimeInTimezone(dateStr, "12:00", branch.timezone);
    const dayOfWeek = getLocalDateDayOfWeek(noonLocal, branch.timezone);

    // 3. Buscar horario laboral
    const workHour = workHours.find(
      (wh) => wh.staffId === staffId && wh.dayOfWeek === dayOfWeek
    );

    if (!workHour || !workHour.isActive) {
      return []; // El profesional no atiende este día
    }

    // 4. Crear rango de horario laboral absoluto (UTC)
    const workStart = combineDateAndTimeInTimezone(dateStr, workHour.startTime, branch.timezone);
    const workEnd = combineDateAndTimeInTimezone(dateStr, workHour.endTime, branch.timezone);

    // 5. Generar slots potenciales de inicio cada 15 minutos
    const availableSlots: string[] = [];
    const durationMs = service.duration * 60000;
    const stepMs = 15 * 60000; // Intervalos para inicio de turno

    let currentStart = new Date(workStart);

    while (currentStart.getTime() + durationMs <= workEnd.getTime()) {
      const currentEnd = new Date(currentStart.getTime() + durationMs);

      // Chequeo de colisiones contra citas
      const isBooked = hasOverlappingBooking(staffId, currentStart, currentEnd);

      // Chequeo de colisiones contra bloqueos administrativos
      const isBlocked = hasOverlappingTimeBlock(staffId, currentStart, currentEnd);

      const isOverlapped = isBooked || isBlocked;

      // Chequeo de si el slot está en el pasado
      const isPast = currentStart.getTime() <= Date.now();

      if (!isOverlapped && !isPast) {
        availableSlots.push(currentStart.toISOString());
      }

      currentStart = new Date(currentStart.getTime() + stepMs);
    }

    return availableSlots;
  }

  /**
   * Realiza todas las comprobaciones de reglas de negocio para crear una reserva.
   */
  static async validateBookingCreation(
    staffId: string,
    serviceId: string,
    start: Date
  ): Promise<{ isValid: boolean; error?: string }> {
    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      return { isValid: false, error: "El servicio seleccionado no existe." };
    }

    const staff = staffList.find((st) => st.id === staffId);
    if (!staff) {
      return { isValid: false, error: "El profesional seleccionado no existe." };
    }

    const branch = branchesList.find((b) => b.id === staff.branchId);
    if (!branch) {
      return { isValid: false, error: "La sucursal del profesional no existe." };
    }

    const end = new Date(start.getTime() + service.duration * 60000);

    // 1. No reservar en el pasado
    if (start.getTime() <= Date.now()) {
      return { isValid: false, error: "No es posible reservar en el pasado." };
    }

    // 2. Obtener datos locales de la fecha solicitada
    const localDateStr = getLocalDateString(start, branch.timezone);
    const dayOfWeek = getLocalDateDayOfWeek(start, branch.timezone);

    // 3. Verificar que trabaje este día
    const workHour = workHours.find(
      (wh) => wh.staffId === staffId && wh.dayOfWeek === dayOfWeek
    );

    if (!workHour || !workHour.isActive) {
      return { isValid: false, error: "El profesional no trabaja el día de la cita solicitada." };
    }

    // 4. Verificar que se encuentre dentro de su rango horario laboral
    const workStart = combineDateAndTimeInTimezone(localDateStr, workHour.startTime, branch.timezone);
    const workEnd = combineDateAndTimeInTimezone(localDateStr, workHour.endTime, branch.timezone);

    if (start < workStart || end > workEnd) {
      return {
        isValid: false,
        error: `El horario seleccionado está fuera de la jornada laboral del profesional para ese día (${workHour.startTime} hs a ${workHour.endTime} hs).`
      };
    }

    // 5. Verificar solapamiento con otras reservas
    const isBooked = hasOverlappingBooking(staffId, start, end);
    if (isBooked) {
      return { isValid: false, error: "El horario ya está reservado por otra cita." };
    }

    // 6. Verificar solapamiento con bloqueos administrativos
    const isBlocked = hasOverlappingTimeBlock(staffId, start, end);
    if (isBlocked) {
      return { isValid: false, error: "El horario seleccionado está bloqueado por motivos administrativos." };
    }

    return { isValid: true };
  }
}
