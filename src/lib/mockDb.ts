export interface MockBranch {
  id: string;
  name: string;
  address: string;
  timezone: string;
}

export interface MockService {
  id: string;
  branchId: string;
  name: string;
  duration: number; // minutos
  price: number;
}

export interface MockStaff {
  id: string;
  branchId: string;
  name: string;
}

export interface MockBooking {
  id: string;
  branchId: string;
  staffId: string;
  serviceId: string;
  customerName: string;
  phone: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  status: string; // 'confirmed' | 'cancelled' | 'completed' | 'no_show'
}

export interface MockWorkHour {
  id: string;
  staffId: string;
  dayOfWeek: number; // 0=Domingo, 6=Sábado
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  isActive: boolean;
}

export interface MockTimeBlock {
  id: string;
  staffId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  reason?: string;
}

export const branchesList: MockBranch[] = [
  {
    id: "br-barberia",
    name: "Vibra",
    address: "Calle de la Moda 456, Local 1",
    timezone: "America/Argentina/Buenos_Aires"
  },
  {
    id: "br-cosmetologia",
    name: "Antonella Skin Studio",
    address: "Av. de la Salud 789, Local 2",
    timezone: "America/Argentina/Buenos_Aires"
  }
];

export const services: MockService[] = [
  {
    id: "srv-barberia",
    branchId: "br-barberia",
    name: "Corte de Cabello y Barba",
    duration: 45,
    price: 25.00
  },
  {
    id: "srv-cosmetologia",
    branchId: "br-cosmetologia",
    name: "Tratamiento Facial Exfoliante",
    duration: 60,
    price: 40.00
  },
];

export const staffList: MockStaff[] = [
  { id: "stf-juan", branchId: "br-barberia", name: "Juan Barbero" },
  { id: "stf-ana", branchId: "br-cosmetologia", name: "Ana Esteticista" },
];

// Helper para combinar fecha e indicación horaria local
function getCombinedDate(timeStr: string): string {
  const date = new Date();
  const [hours, minutes] = timeStr.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

// Base de datos en memoria que persiste entre recargas rápidas en desarrollo
const globalForDb = global as unknown as {
  bookings: MockBooking[];
  workHours: MockWorkHour[];
  timeBlocks: MockTimeBlock[];
};

export const bookings = globalForDb.bookings || [
  {
    id: "booking-mock-1",
    branchId: "br-barberia",
    staffId: "stf-juan",
    serviceId: "srv-barberia",
    customerName: "Carlos Pérez",
    phone: "1122334455",
    startTime: getCombinedDate("11:00"),
    endTime: getCombinedDate("11:45"),
    status: "confirmed"
  },
  {
    id: "booking-mock-2",
    branchId: "br-cosmetologia",
    staffId: "stf-ana",
    serviceId: "srv-cosmetologia",
    customerName: "María López",
    phone: "2233445566",
    startTime: getCombinedDate("14:00"),
    endTime: getCombinedDate("15:00"),
    status: "confirmed"
  }
];

// Inicializar horarios de trabajo por defecto (Lunes a Viernes de 09:00 a 18:00)
const defaultWorkHours: MockWorkHour[] = [];
staffList.forEach(stf => {
  for (let day = 0; day <= 6; day++) {
    defaultWorkHours.push({
      id: `wh-${stf.id}-${day}`,
      staffId: stf.id,
      dayOfWeek: day,
      startTime: "09:00",
      endTime: "18:00",
      isActive: day >= 1 && day <= 5 // Lunes a Viernes activo por defecto
    });
  }
});

export const workHours = globalForDb.workHours || defaultWorkHours;
export const timeBlocks = globalForDb.timeBlocks || [];

if (process.env.NODE_ENV !== "production") {
  globalForDb.bookings = bookings;
  globalForDb.workHours = workHours;
  globalForDb.timeBlocks = timeBlocks;
}

export function addBooking(booking: MockBooking) {
  bookings.push(booking);
}

export function hasOverlappingBooking(staffId: string, start: Date, end: Date): boolean {
  return bookings.some(b => {
    if (b.staffId !== staffId) return false;
    // Excluir canceladas del solapamiento
    if (b.status === "cancelled") return false;
    const bStart = new Date(b.startTime);
    const bEnd = new Date(b.endTime);
    // Fórmula de solapamiento: (start < bEnd) y (end > bStart)
    return start < bEnd && end > bStart;
  });
}

// Helpers para Horarios y Bloqueos
export function updateWorkHour(id: string, startTime: string, endTime: string, isActive: boolean) {
  const index = workHours.findIndex(wh => wh.id === id);
  if (index !== -1) {
    workHours[index] = { ...workHours[index], startTime, endTime, isActive };
  }
}

export function addTimeBlock(block: MockTimeBlock) {
  timeBlocks.push(block);
}

export function deleteTimeBlock(id: string) {
  const index = timeBlocks.findIndex(tb => tb.id === id);
  if (index !== -1) {
    timeBlocks.splice(index, 1);
  }
}

export function hasOverlappingTimeBlock(staffId: string, start: Date, end: Date): boolean {
  return timeBlocks.some(tb => {
    if (tb.staffId !== staffId) return false;
    const tbStart = new Date(tb.startTime);
    const tbEnd = new Date(tb.endTime);
    return start < tbEnd && end > tbStart;
  });
}

