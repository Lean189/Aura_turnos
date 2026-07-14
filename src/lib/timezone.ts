/**
 * Combina una fecha 'YYYY-MM-DD' y una hora 'HH:MM' en la zona horaria del local,
 * y retorna un objeto Date de Javascript (que representa de manera absoluta ese instante en UTC).
 */
export function combineDateAndTimeInTimezone(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  
  // Crear un objeto en UTC provisorio para formatear y calcular la diferencia horaria
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });
  
  const parts = formatter.formatToParts(utcDate);
  const getPart = (type: string) => Number(parts.find(p => p.type === type)?.value);
  
  const localYear = getPart("year");
  const localMonth = getPart("month");
  const localDay = getPart("day");
  const rawHour = getPart("hour");
  const localHour = rawHour === 24 ? 0 : rawHour;
  const localMinute = getPart("minute");
  
  const localTzDate = new Date(Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute, 0));
  const offsetMs = utcDate.getTime() - localTzDate.getTime();
  
  return new Date(utcDate.getTime() + offsetMs);
}

/**
 * Retorna el día de la semana (0 = Domingo, 1 = Lunes, etc.) de una fecha dada
 * calculado en la zona horaria de destino de manera server-safe.
 */
export function getLocalDateDayOfWeek(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric"
  });
  
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => Number(parts.find(p => p.type === type)?.value);
  
  const localYear = getPart("year");
  const localMonth = getPart("month");
  const localDay = getPart("day");
  
  const d = new Date(localYear, localMonth - 1, localDay);
  return d.getDay();
}

/**
 * Retorna la representación local 'YYYY-MM-DD' de una fecha absoluta en una zona horaria.
 */
export function getLocalDateString(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || "01";
  
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}
