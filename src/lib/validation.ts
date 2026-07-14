import { z } from "zod";

// Validaciones para la creación de turnos (reservas)
export const createBookingSchema = z.object({
  staffId: z.string().min(1, "El profesional es obligatorio."),
  serviceId: z.string().min(1, "El servicio es obligatorio."),
  customerName: z.string().min(2, "El nombre del cliente debe tener al menos 2 caracteres."),
  phone: z.string().min(6, "El número de teléfono debe tener al menos 6 dígitos."),
  email: z.string().email("El correo electrónico no es válido.").optional().or(z.literal("")),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "La fecha y hora de inicio no tiene un formato ISO válido.",
  }),
});

// Validaciones para actualización de horarios laborales
export const updateWorkHourSchema = z.object({
  id: z.string().min(1, "El ID del horario es obligatorio."),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "La hora de inicio debe estar en formato HH:MM (24 hs).",
  }),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "La hora de fin debe estar en formato HH:MM (24 hs).",
  }),
  isActive: z.boolean(),
});

// Validaciones para bloquear franjas horarias
export const createTimeBlockSchema = z.object({
  staffId: z.string().min(1, "El profesional es obligatorio."),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "La fecha de inicio no es válida.",
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "La fecha de fin no es válida.",
  }),
  reason: z.string().max(255, "El motivo no puede exceder los 255 caracteres.").optional(),
});
