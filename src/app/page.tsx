"use client";

import React, { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getAnonSupabaseClient } from "@/lib/supabase";

export default function BookingPortal() {
  // Estado para datos remotos de Supabase
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // Estado para la sucursal seleccionada (Paso 0)
  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);

  // Estados de selección del turno
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  // Estados de carga e interfaz
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Datos del formulario de contacto
  const [customerName, setCustomerName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  // Mensajes de error y modales
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<any | null>(null);
  const [isSuccessOpen, setIsSuccessOpen] = useState<boolean>(false);

  // Cargar información inicial desde Supabase
  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true);
      try {
        const supabase = getAnonSupabaseClient();
        
        // 1. Cargar locales (branches)
        const { data: branches } = await supabase.from("branches").select("*");
        setBranchesList(branches || []);

        // 2. Cargar servicios activos
        const { data: srvs } = await supabase.from("services").select("*").eq("is_active", true);
        const formattedServices = (srvs || []).map((s) => ({
          id: s.id,
          tenantId: s.tenant_id,
          name: s.name,
          duration: s.duration_minutes,
          price: Number(s.price),
        }));
        setServicesList(formattedServices);

        // 3. Cargar profesionales activos
        const { data: staff } = await supabase.from("staff").select("*").eq("is_active", true);
        const formattedStaff = (staff || []).map((st) => ({
          id: st.id,
          branchId: st.branch_id,
          name: st.name,
        }));
        setStaffList(formattedStaff);
      } catch (err) {
        console.error("Error al inicializar datos:", err);
      } finally {
        setIsLoadingData(false);
      }
    }
    loadData();
  }, []);

  // Limpiar selecciones si se cambia de sucursal
  const handleSelectBranch = (branch: any | null) => {
    setSelectedBranch(branch);
    setSelectedService(null);
    setSelectedStaff(null);
    setSelectedTimeSlot(null);
    setAvailableSlots([]);
  };

  // Consultar disponibilidad al cambiar Servicio, Profesional o Fecha
  useEffect(() => {
    async function fetchAvailability() {
      if (!selectedService || !selectedStaff || !selectedDate) {
        setAvailableSlots([]);
        setSelectedTimeSlot(null);
        return;
      }

      setIsLoadingSlots(true);
      setErrorMessage(null);
      setSelectedTimeSlot(null);

      const offset = selectedDate.getTimezoneOffset();
      const localDate = new Date(selectedDate.getTime() - offset * 60 * 1000);
      const dateStr = localDate.toISOString().split("T")[0];

      try {
        const response = await fetch(
          `/api/availability?staffId=${selectedStaff.id}&serviceId=${selectedService.id}&date=${dateStr}`
        );
        const data = await response.json();

        if (response.ok) {
          setAvailableSlots(data.slots || []);
        } else {
          setErrorMessage(data.error || "Error al obtener disponibilidad.");
        }
      } catch (err) {
        console.error(err);
        setErrorMessage("Error de conexión al servidor.");
      } finally {
        setIsLoadingSlots(false);
      }
    }

    fetchAvailability();
  }, [selectedService, selectedStaff, selectedDate]);

  // Manejar el envío de la reserva
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedService || !selectedStaff || !selectedDate || !selectedTimeSlot) {
      setErrorMessage("Por favor, selecciona servicio, profesional, fecha y hora.");
      return;
    }

    if (!customerName || !phone) {
      setErrorMessage("Por favor, completa tu nombre y número de teléfono (WhatsApp).");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: selectedStaff.id,
          serviceId: selectedService.id,
          customerName,
          phone,
          email: email || undefined,
          startTime: selectedTimeSlot,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessBooking(data.booking);
        setIsSuccessOpen(true);
        setSelectedTimeSlot(null);
        setAvailableSlots((prev) => prev.filter((slot) => slot !== selectedTimeSlot));
      } else {
        setErrorMessage(data.error || "Ocurrió un error al agendar tu cita.");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Error de conexión al procesar la reserva.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  // Filtrar servicios y staff por la sucursal seleccionada
  const filteredServices = servicesList.filter((s) => s.tenantId === selectedBranch?.tenant_id);
  const filteredStaffList = staffList.filter((stf) => stf.branchId === selectedBranch?.id);

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-neutral-400 uppercase tracking-widest font-mono animate-pulse">Cargando Turnera...</p>
        </div>
      </div>
    );
  }

  // VISTA 1: Selección de Sucursal / Local (Paso 0)
  if (!selectedBranch) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased relative flex flex-col justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.06),transparent_60%)] pointer-events-none" />

        <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <span className="text-2xl font-bold tracking-widest bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
              AURA
            </span>
            <span className="text-xs uppercase tracking-widest text-neutral-500 border border-neutral-800 rounded px-1.5 py-0.5">
              SaaS Multi-Local
            </span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center flex-1 relative z-10 w-full">
          <div className="text-center max-w-xl mb-12">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-b from-neutral-50 via-neutral-100 to-neutral-400 bg-clip-text text-transparent sm:text-5xl mb-4">
              Elige tu Cita
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Bienvenido a AURA. Contamos con locales especializados independientes. Selecciona a cuál deseas asistir para agendar tu turno.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
            {branchesList.map((branch) => {
              const isBarber = branch.id === "br-barberia";
              return (
                <button
                  key={branch.id}
                  onClick={() => handleSelectBranch(branch)}
                  className="flex flex-col text-left p-6 rounded-2xl border border-neutral-900 bg-neutral-900/20 hover:bg-neutral-900/50 hover:border-amber-400/40 hover:shadow-[0_0_30px_rgba(251,191,36,0.04)] transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-400/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-4xl mb-4 block filter drop-shadow">
                    {isBarber ? "💈" : "🧴"}
                  </span>
                  <h2 className="text-lg font-bold text-neutral-200 group-hover:text-amber-300 transition-colors mb-2">
                    {branch.name}
                  </h2>
                  <p className="text-xs text-neutral-400 leading-relaxed mb-6 flex-1">
                    {isBarber
                      ? "Cortes de cabello y estilo clásico, afeitado tradicional con navaja y toalla caliente, perfilado de barba y asesoramiento de imagen masculina."
                      : "Tratamientos de cutis profundos, exfoliaciones faciales, mascarillas hidratantes rejuvenecedoras y masajes faciales estéticos."}
                  </p>
                  <div className="text-[10px] text-neutral-500 border-t border-neutral-900/60 pt-3 flex justify-between items-center w-full font-mono">
                    <span>📍 {branch.address.split(", ")[0]}</span>
                    <span className="text-amber-400/80 font-medium group-hover:translate-x-1 transition-transform">
                      Reservar turno →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </main>

        <footer className="py-6 border-t border-neutral-900 text-center text-xs text-neutral-600 font-mono">
          AURA © {new Date().getFullYear()} - Plataforma SaaS de Reservas Estéticas
        </footer>
      </div>
    );
  }

  // VISTA 2: Paso a paso dentro de la Sucursal Seleccionada
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased selection:bg-amber-400 selection:text-neutral-900 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.08),transparent_50%)] pointer-events-none" />

      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold tracking-widest bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
              AURA
            </span>
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5">
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-medium">
                {selectedBranch.name}
              </span>
            </div>
            <button
              onClick={() => handleSelectBranch(null)}
              className="text-[10px] text-neutral-500 hover:text-neutral-300 underline underline-offset-2 ml-1"
            >
              Cambiar local
            </button>
          </div>
          <div className="text-xs text-neutral-500 font-mono hidden sm:block">
            {selectedBranch.address}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Columna Izquierda: Configuración del Turno */}
          <div className="lg:col-span-2 space-y-8">

            {/* Paso 1: Servicios de la Sucursal */}
            <section className="bg-neutral-900/40 border border-neutral-900 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-yellow-600" />
              <h2 className="text-lg font-semibold tracking-wide text-neutral-200 mb-4 flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/10 text-amber-400 text-xs font-bold border border-amber-400/20">1</span>
                Selecciona tu Servicio
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredServices.map((srv) => (
                  <button
                    key={srv.id}
                    onClick={() => setSelectedService(srv)}
                    className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-300 relative group ${
                      selectedService?.id === srv.id
                        ? "border-amber-400/60 bg-amber-400/5 shadow-[0_0_15px_rgba(251,191,36,0.05)]"
                        : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700 hover:bg-neutral-900/60"
                    }`}
                  >
                    <div className="flex justify-between items-start w-full mb-1">
                      <span className="font-medium text-neutral-200 group-hover:text-amber-300 transition-colors">
                        {srv.name.split(" (")[0]}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                      Servicio especializado diseñado para ofrecerte el mejor resultado en tu local preferido.
                    </p>
                    <div className="flex justify-between items-center w-full mt-auto pt-2 border-t border-neutral-900/60 text-xs">
                      <span className="text-neutral-400 flex items-center gap-1 font-mono">
                        ⏱ {srv.duration} min
                      </span>
                      <span className="text-amber-400 font-semibold text-sm font-mono">
                        ${srv.price.toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Paso 2: Profesional de la Sucursal */}
            <section className="bg-neutral-900/40 border border-neutral-900 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-yellow-600" />
              <h2 className="text-lg font-semibold tracking-wide text-neutral-200 mb-4 flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/10 text-amber-400 text-xs font-bold border border-amber-400/20">2</span>
                Selecciona al Profesional
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredStaffList.map((stf) => {
                  const isBarber = stf.branchId === "br-barberia";
                  return (
                    <button
                      key={stf.id}
                      onClick={() => setSelectedStaff(stf)}
                      className={`flex items-center gap-4 text-left p-4 rounded-xl border transition-all duration-300 ${
                        selectedStaff?.id === stf.id
                          ? "border-amber-400/60 bg-amber-400/5 shadow-[0_0_15px_rgba(251,191,36,0.05)]"
                          : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700 hover:bg-neutral-900/60"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-lg font-bold text-neutral-300">
                        {stf.name[0]}
                      </div>
                      <div>
                        <h3 className="font-medium text-neutral-200">{stf.name}</h3>
                        <p className="text-xs text-neutral-400">
                          {isBarber ? "Experto en barba y corte tradicional" : "Especialista estética de cutis y cuidado facial"}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-amber-400/80 mt-1">
                          ★ ★ ★ ★ ★ <span className="text-neutral-500 font-mono">(4.9)</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Paso 3: Calendario e Horarios */}
            <section className="bg-neutral-900/40 border border-neutral-900 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-yellow-600" />
              <h2 className="text-lg font-semibold tracking-wide text-neutral-200 mb-4 flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/10 text-amber-400 text-xs font-bold border border-amber-400/20">3</span>
                Fecha y Hora del Turno
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Calendario */}
                <div className="md:col-span-6 bg-neutral-950/50 rounded-xl border border-neutral-800 p-2 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border-0 bg-transparent text-neutral-200"
                    disabled={(date) => date.getTime() < new Date().setHours(0, 0, 0, 0)}
                  />
                </div>

                {/* Horarios */}
                <div className="md:col-span-6 space-y-4">
                  <h3 className="text-sm font-medium text-neutral-300">
                    Horarios Disponibles para el{" "}
                    <span className="text-amber-400">
                      {selectedDate
                        ? selectedDate.toLocaleDateString([], { day: "numeric", month: "short" })
                        : "día seleccionado"}
                    </span>
                  </h3>

                  {isLoadingSlots ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-3">
                      <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-neutral-500 font-mono">Buscando slots...</span>
                    </div>
                  ) : !selectedService || !selectedStaff ? (
                    <div className="text-center py-10 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/20">
                      <p className="text-xs text-neutral-500">
                        Selecciona primero el servicio y profesional para ver disponibilidad.
                      </p>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-amber-500/20 rounded-xl bg-amber-500/5">
                      <p className="text-xs text-amber-400/80">
                        No hay turnos disponibles para esta fecha. Intenta con otro día.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedTimeSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTimeSlot(slot)}
                            className={`py-2 rounded-lg text-xs font-mono font-medium transition-all duration-200 border ${
                              isSelected
                                ? "bg-amber-400 text-neutral-950 border-amber-400 font-semibold"
                                : "bg-neutral-950/60 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
                            }`}
                          >
                            {formatTime(slot)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Columna Derecha: Confirmación de Cita */}
          <div>
            <div className="bg-neutral-900/40 border border-neutral-900 rounded-2xl p-6 sticky top-24 backdrop-blur-sm">
              <h2 className="text-lg font-semibold tracking-wide text-neutral-200 mb-6 pb-2 border-b border-neutral-800">
                Resumen de la Cita
              </h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Local:</span>
                  <span className="font-medium text-neutral-300">{selectedBranch.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Servicio:</span>
                  <span className="font-medium text-neutral-300 text-right">
                    {selectedService ? selectedService.name.split(" (")[0] : "No seleccionado"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Profesional:</span>
                  <span className="font-medium text-neutral-300">
                    {selectedStaff ? selectedStaff.name : "No seleccionado"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Fecha:</span>
                  <span className="font-medium text-neutral-300">
                    {selectedDate ? selectedDate.toLocaleDateString([], { dateStyle: "long" }) : "No seleccionado"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Horario:</span>
                  <span className="font-medium text-amber-400 font-mono">
                    {selectedTimeSlot ? formatTime(selectedTimeSlot) + " hs" : "No seleccionado"}
                  </span>
                </div>

                {selectedService && (
                  <div className="pt-3 border-t border-neutral-800/80 flex justify-between items-baseline">
                    <span className="text-neutral-200 font-medium text-sm">Total a pagar:</span>
                    <span className="text-lg font-bold text-amber-400 font-mono">
                      ${selectedService.price.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Formulario */}
              <form onSubmit={handleSubmitBooking} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="customer-name" className="text-neutral-400 text-xs">
                    Nombre Completo *
                  </Label>
                  <Input
                    id="customer-name"
                    type="text"
                    required
                    placeholder="Ej. Carlos Pérez"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="bg-neutral-950/60 border-neutral-800 focus:border-amber-400 focus:ring-0 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customer-phone" className="text-neutral-400 text-xs">
                    Teléfono (WhatsApp) *
                  </Label>
                  <Input
                    id="customer-phone"
                    type="tel"
                    required
                    placeholder="Ej. 11 2233 4455"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-neutral-950/60 border-neutral-800 focus:border-amber-400 focus:ring-0 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customer-email" className="text-neutral-400 text-xs">
                    Email (Opcional)
                  </Label>
                  <Input
                    id="customer-email"
                    type="email"
                    placeholder="carlos@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-neutral-950/60 border-neutral-800 focus:border-amber-400 focus:ring-0 text-xs"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-950/30 border border-red-500/30 text-red-400 rounded-xl text-xs leading-relaxed">
                    ⚠️ {errorMessage}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || !selectedTimeSlot}
                  className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-neutral-950 font-semibold py-6 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(251,191,36,0.15)]"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                      Procesando...
                    </div>
                  ) : (
                    "Confirmar Cita"
                  )}
                </Button>
              </form>
            </div>
          </div>

        </div>
      </main>

      {/* Modal Éxito */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-sm rounded-2xl">
          <DialogHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-2xl mx-auto mb-4 animate-bounce">
              ✓
            </div>
            <DialogTitle className="text-lg font-bold text-neutral-200">
              ¡Turno Reservado!
            </DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs">
              Tu reserva se ha registrado de manera correcta en el local {selectedBranch.name}.
            </DialogDescription>
          </DialogHeader>

          {successBooking && (
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">Local:</span>
                <span className="font-medium text-neutral-300">{selectedBranch.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Código de Turno:</span>
                <span className="font-semibold text-neutral-300 font-mono uppercase">{successBooking.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Cliente:</span>
                <span className="font-medium text-neutral-300">{successBooking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Especialista:</span>
                <span className="font-medium text-neutral-300">
                  {staffList.find((s) => s.id === successBooking.staffId)?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Fecha y Hora:</span>
                <span className="font-medium text-amber-400 font-mono">
                  {new Date(successBooking.startTime).toLocaleDateString([], { day: "numeric", month: "short" })}{" "}
                  - {formatTime(successBooking.startTime)} hs
                </span>
              </div>
            </div>
          )}

          <div className="text-center text-[10px] text-neutral-500 leading-normal bg-neutral-950/20 p-2 rounded border border-neutral-800/40">
            Se ha enviado un recordatorio simulado a tu WhatsApp. ¡Te esperamos!
          </div>

          <DialogFooter>
            <Button
              onClick={() => setIsSuccessOpen(false)}
              className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700 text-xs"
            >
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
