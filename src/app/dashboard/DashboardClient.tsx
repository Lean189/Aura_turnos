"use client";

import React, { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { MockBooking, services, staffList, branchesList, MockWorkHour, MockTimeBlock } from "@/lib/mockDb";
import { Button } from "@/components/ui/button";

interface DashboardClientProps {
  initialBookings: MockBooking[];
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    tenantId?: string;
  };
}

export function DashboardClient({ initialBookings, user }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"bookings" | "config">("bookings");
  const [bookingsList, setBookingsList] = useState<MockBooking[]>(initialBookings);
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Determinar la sucursal del usuario
  const matchedStaffProfile = staffList.find((s) => s.name === user.name) || staffList[0];
  const userBranch = branchesList.find((b) => b.id === matchedStaffProfile.branchId) || branchesList[0];
  const dashboardTitle = user.role === "staff" ? userBranch.name : "PANEL DE CONTROL MULTI-LOCAL";

  // Estados de configuración de agenda
  const initialConfigStaffId = user.role === "staff" ? matchedStaffProfile.id : staffList[0].id;
  const [configStaffId, setConfigStaffId] = useState<string>(initialConfigStaffId);
  const [workHoursList, setWorkHoursList] = useState<MockWorkHour[]>([]);
  const [timeBlocksList, setTimeBlocksList] = useState<MockTimeBlock[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);
  
  // Estados para nuevo bloqueo
  const [blockDate, setBlockDate] = useState<string>("");
  const [blockStart, setBlockStart] = useState<string>("");
  const [blockEnd, setBlockEnd] = useState<string>("");
  const [blockReason, setBlockReason] = useState<string>("");

  // Cargar configuración de agenda (Horarios y Bloqueos)
  const fetchConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const res = await fetch(`/api/config?staffId=${configStaffId}`);
      if (res.ok) {
        const data = await res.json();
        // Ordenar horarios por día de la semana (Lunes a Domingo)
        // día 1=Lunes, ..., 6=Sábado, 0=Domingo
        const sortedHours = (data.workHours || []).sort((a: MockWorkHour, b: MockWorkHour) => {
          const valA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
          const valB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
          return valA - valB;
        });
        setWorkHoursList(sortedHours);
        setTimeBlocksList(data.timeBlocks || []);
      }
    } catch (err) {
      console.error("Error al cargar configuración:", err);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (activeTab === "config") {
      fetchConfig();
    }
  }, [configStaffId, activeTab]);

  // Filtrar las reservas basadas en el profesional seleccionado
  const filteredBookings = bookingsList.filter((b) => {
    if (filterStaff === "all") return true;
    return b.staffId === filterStaff;
  });

  // Mutación de estado de reserva
  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    setUpdatingId(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setBookingsList((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
        );
      } else {
        alert("Error al actualizar la reserva.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al servidor.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Guardar cambio en horario laboral
  const handleSaveWorkHour = async (whId: string, startTime: string, endTime: string, isActive: boolean) => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-work-hour",
          id: whId,
          startTime,
          endTime,
          isActive,
        }),
      });
      if (res.ok) {
        alert("Horario laboral guardado con éxito.");
      } else {
        alert("Error al guardar el horario.");
        fetchConfig(); // recargar
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión.");
    }
  };

  // Agregar un bloqueo de franja horaria
  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDate || !blockStart || !blockEnd) {
      alert("Por favor, completa la fecha, hora de inicio y fin.");
      return;
    }

    const startIso = new Date(`${blockDate}T${blockStart}:00`).toISOString();
    const endIso = new Date(`${blockDate}T${blockEnd}:00`).toISOString();

    if (new Date(startIso) >= new Date(endIso)) {
      alert("La hora de inicio debe ser anterior a la hora de fin.");
      return;
    }

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-time-block",
          staffId: configStaffId,
          startTime: startIso,
          endTime: endIso,
          reason: blockReason || "Bloqueo administrativo",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTimeBlocksList((prev) => [...prev, data.timeBlock]);
        setBlockDate("");
        setBlockStart("");
        setBlockEnd("");
        setBlockReason("");
        alert("Horario bloqueado con éxito.");
      } else {
        const data = await res.json();
        alert(data.error || "Error al bloquear la franja horaria.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión.");
    }
  };

  // Eliminar un bloqueo
  const handleDeleteBlock = async (blockId: string) => {
    try {
      const res = await fetch(`/api/config?id=${blockId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTimeBlocksList((prev) => prev.filter((tb) => tb.id !== blockId));
        alert("Bloqueo eliminado correctamente.");
      } else {
        alert("Error al eliminar el bloqueo.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión.");
    }
  };

  const handleLocalHourChange = (whId: string, field: "startTime" | "endTime" | "isActive", value: any) => {
    setWorkHoursList((prev) =>
      prev.map((wh) => (wh.id === whId ? { ...wh, [field]: value } : wh))
    );
  };

  const getDayName = (dayNum: number) => {
    const days = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    return days[dayNum];
  };

  // Cálculos de KPI/Estadísticas
  const activeBookings = bookingsList.filter((b) => b.status !== "cancelled");
  const completedBookings = bookingsList.filter((b) => b.status === "completed");

  const totalRevenue = activeBookings.reduce((sum, b) => {
    const srv = services.find((s) => s.id === b.serviceId);
    return sum + (srv ? srv.price : 0);
  }, 0);

  const completedRevenue = completedBookings.reduce((sum, b) => {
    const srv = services.find((s) => s.id === b.serviceId);
    return sum + (srv ? srv.price : 0);
  }, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase">Completado</span>;
      case "cancelled":
        return <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase">Cancelado</span>;
      case "no_show":
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase">No Show</span>;
      default:
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase">Confirmado</span>;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-400 selection:text-neutral-900">
      
      {/* Cabecera del Dashboard */}
      <header className="border-b border-neutral-900 bg-neutral-950 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-widest bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent sm:text-base">
              {dashboardTitle.toUpperCase()}
            </span>
            <span className="text-[9px] text-neutral-400 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 font-mono uppercase">
              {user.role}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-neutral-300 font-medium">{user.name}</p>
              <p className="text-[10px] text-neutral-500 font-mono">{user.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="border-neutral-800 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 text-xs py-1 px-3"
            >
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs de Navegación */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex gap-6 border-b border-neutral-900">
          <button
            onClick={() => setActiveTab("bookings")}
            className={`pb-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all ${
              activeTab === "bookings"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Gestión de Turnos
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`pb-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all ${
              activeTab === "config"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Configuración de Agenda
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        
        {activeTab === "bookings" ? (
          <>
            {/* Sección de Tarjetas de KPI */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-amber-500/30 to-transparent" />
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Turnos Totales</p>
                <h3 className="text-3xl font-bold font-mono text-neutral-100 mt-2">{bookingsList.length}</h3>
                <p className="text-[10px] text-neutral-500 mt-1">Registrados en este local</p>
              </div>

              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-amber-500/30 to-transparent" />
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Facturado Estimado</p>
                <h3 className="text-3xl font-bold font-mono text-amber-400 mt-2">${totalRevenue.toFixed(2)}</h3>
                <p className="text-[10px] text-neutral-500 mt-1">Suma de reservas activas</p>
              </div>

              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-emerald-500/30 to-transparent" />
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Cobrado (Completados)</p>
                <h3 className="text-3xl font-bold font-mono text-emerald-400 mt-2">${completedRevenue.toFixed(2)}</h3>
                <p className="text-[10px] text-neutral-500 mt-1">Suma de turnos concretados</p>
              </div>

              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-amber-500/30 to-transparent" />
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Tasa de Concreción</p>
                <h3 className="text-3xl font-bold font-mono text-neutral-100 mt-2">
                  {bookingsList.length > 0
                    ? Math.round((completedBookings.length / bookingsList.length) * 100)
                    : 0}
                  %
                </h3>
                <p className="text-[10px] text-neutral-500 mt-1">{completedBookings.length} turnos completados</p>
              </div>

            </section>

            {/* Sección de Filtros y Tabla */}
            <section className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 relative">
              
              {/* Barra de Filtros */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-neutral-900">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-200">Agenda de Citas</h2>
                  <p className="text-xs text-neutral-400">Administra el estado de los turnos en tiempo real</p>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setFilterStaff("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      filterStaff === "all"
                        ? "bg-amber-400 text-neutral-900 border-amber-400"
                        : "bg-neutral-950/60 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-100"
                    }`}
                  >
                    Todos
                  </button>
                  {staffList.map((stf) => (
                    <button
                      key={stf.id}
                      onClick={() => setFilterStaff(stf.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        filterStaff === stf.id
                          ? "bg-amber-400 text-neutral-900 border-amber-400"
                          : "bg-neutral-950/60 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-100"
                      }`}
                    >
                      {stf.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabla de Reservas */}
              <div className="overflow-x-auto">
                {filteredBookings.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/20">
                    <p className="text-xs text-neutral-500">No hay reservas registradas.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-900 text-neutral-500 uppercase tracking-wider font-mono text-[10px]">
                        <th className="pb-3 font-medium">Horario / Fecha</th>
                        <th className="pb-3 font-medium">Local</th>
                        <th className="pb-3 font-medium">Cliente</th>
                        <th className="pb-3 font-medium">Servicio</th>
                        <th className="pb-3 font-medium">Especialista</th>
                        <th className="pb-3 font-medium">Precio</th>
                        <th className="pb-3 font-medium">Estado</th>
                        <th className="pb-3 font-medium text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900/60">
                      {filteredBookings.map((b) => {
                        const srv = services.find((s) => s.id === b.serviceId);
                        const staff = staffList.find((st) => st.id === b.staffId);
                        const branch = branchesList.find((br) => br.id === b.branchId);
                        const date = new Date(b.startTime);
                        
                        return (
                          <tr key={b.id} className="hover:bg-neutral-900/10 transition-colors">
                            <td className="py-4 font-mono text-neutral-300">
                              {date.toLocaleDateString([], { day: "numeric", month: "short" })}{" "}
                              <span className="text-amber-400 font-semibold ml-1">
                                {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} hs
                              </span>
                            </td>
                            <td className="py-4 text-neutral-400 font-medium">
                              {branch ? branch.name : "Desconocido"}
                            </td>
                            <td className="py-4">
                              <p className="font-medium text-neutral-200">{b.customerName}</p>
                              <p className="text-[10px] text-neutral-500 font-mono">{b.phone}</p>
                            </td>
                            <td className="py-4 text-neutral-300">
                              {srv ? srv.name : "Desconocido"}
                            </td>
                            <td className="py-4 text-neutral-400">
                              {staff ? staff.name : "Desconocido"}
                            </td>
                            <td className="py-4 font-mono text-neutral-200">
                              ${srv ? srv.price.toFixed(2) : "0.00"}
                            </td>
                            <td className="py-4">
                              {getStatusBadge(b.status)}
                            </td>
                            <td className="py-4 text-right">
                              {b.status === "confirmed" ? (
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    size="xs"
                                    disabled={updatingId !== null}
                                    onClick={() => handleUpdateStatus(b.id, "completed")}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold px-2 py-0.5 rounded text-[10px] h-6 cursor-pointer"
                                  >
                                    Completar
                                  </Button>
                                  <Button
                                    size="xs"
                                    disabled={updatingId !== null}
                                    onClick={() => handleUpdateStatus(b.id, "no_show")}
                                    className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold px-2 py-0.5 rounded text-[10px] h-6 cursor-pointer"
                                  >
                                    No Show
                                  </Button>
                                  <Button
                                    size="xs"
                                    disabled={updatingId !== null}
                                    onClick={() => handleUpdateStatus(b.id, "cancelled")}
                                    className="bg-red-500 hover:bg-red-400 text-neutral-950 font-semibold px-2 py-0.5 rounded text-[10px] h-6 cursor-pointer"
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-neutral-500 italic">Sin acciones</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

            </section>
          </>
        ) : (
          /* PESTAÑA CONFIGURACIÓN DE AGENDA */
          <div className="space-y-8">
            
            {/* Control de Selección de Profesional para Administradores */}
            {user.role !== "staff" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-amber-500/20 to-transparent" />
                <div>
                  <h3 className="text-sm font-semibold text-neutral-200">Panel de Configuración Multi-Profesional</h3>
                  <p className="text-xs text-neutral-400">Selecciona el profesional para configurar sus horarios de atención y bloqueos.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400 font-mono uppercase">Profesional:</span>
                  <select
                    value={configStaffId}
                    onChange={(e) => setConfigStaffId(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {staffList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {isLoadingConfig ? (
              <div className="text-center py-12">
                <p className="text-xs text-neutral-500 animate-pulse">Cargando configuración de agenda...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* PANEL DE HORARIOS LABORALES */}
                <div className="lg:col-span-2 bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 relative overflow-hidden space-y-6">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-amber-500/20 to-transparent" />
                  <div>
                    <h3 className="text-base font-semibold text-neutral-200">Horarios Laborales Semanales</h3>
                    <p className="text-xs text-neutral-400">Habilita los días de atención y define el rango horario diario.</p>
                  </div>

                  <div className="divide-y divide-neutral-900">
                    {workHoursList.map((wh) => (
                      <div key={wh.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-32">
                          <input
                            type="checkbox"
                            checked={wh.isActive}
                            onChange={(e) => handleLocalHourChange(wh.id, "isActive", e.target.checked)}
                            className="w-4 h-4 accent-amber-400 bg-neutral-950 border-neutral-800 rounded focus:ring-amber-500 focus:ring-offset-neutral-950 cursor-pointer"
                            id={`active-${wh.id}`}
                          />
                          <label
                            htmlFor={`active-${wh.id}`}
                            className={`text-xs font-semibold select-none cursor-pointer ${
                              wh.isActive ? "text-neutral-200" : "text-neutral-500 line-through"
                            }`}
                          >
                            {getDayName(wh.dayOfWeek)}
                          </label>
                        </div>

                        <div className="flex flex-1 items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-neutral-500 font-mono">DESDE:</span>
                            <input
                              type="time"
                              value={wh.startTime}
                              disabled={!wh.isActive}
                              onChange={(e) => handleLocalHourChange(wh.id, "startTime", e.target.value)}
                              className="bg-neutral-950 border border-neutral-800 text-neutral-300 rounded text-xs py-1 px-2 focus:outline-none focus:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed font-mono"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-neutral-500 font-mono">HASTA:</span>
                            <input
                              type="time"
                              value={wh.endTime}
                              disabled={!wh.isActive}
                              onChange={(e) => handleLocalHourChange(wh.id, "endTime", e.target.value)}
                              className="bg-neutral-950 border border-neutral-800 text-neutral-300 rounded text-xs py-1 px-2 focus:outline-none focus:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <Button
                            size="sm"
                            onClick={() => handleSaveWorkHour(wh.id, wh.startTime, wh.endTime, wh.isActive)}
                            className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 hover:text-white px-3 py-1 text-xs cursor-pointer font-medium"
                          >
                            Guardar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PANEL DE BLOQUEOS DE AGENDA */}
                <div className="space-y-8">
                  
                  {/* FORMULARIO DE NUEVO BLOQUEO */}
                  <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-red-500/20 to-transparent" />
                    <h3 className="text-base font-semibold text-neutral-200 mb-2">Bloquear Franja Horaria</h3>
                    <p className="text-xs text-neutral-400 mb-4">Evita que se agenden turnos en un rango de fecha/hora puntual.</p>

                    <form onSubmit={handleAddBlock} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-mono uppercase">Fecha del Bloqueo</label>
                        <input
                          type="date"
                          value={blockDate}
                          onChange={(e) => setBlockDate(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded-lg text-xs py-2 px-3 focus:outline-none focus:border-amber-400 font-mono"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-500 font-mono uppercase">Hora Inicio</label>
                          <input
                            type="time"
                            value={blockStart}
                            onChange={(e) => setBlockStart(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded-lg text-xs py-2 px-3 focus:outline-none focus:border-amber-400 font-mono"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-500 font-mono uppercase">Hora Fin</label>
                          <input
                            type="time"
                            value={blockEnd}
                            onChange={(e) => setBlockEnd(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded-lg text-xs py-2 px-3 focus:outline-none focus:border-amber-400 font-mono"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-mono uppercase">Motivo (Opcional)</label>
                        <input
                          type="text"
                          value={blockReason}
                          onChange={(e) => setBlockReason(e.target.value)}
                          placeholder="Ej: Almuerzo, Trámite personal"
                          className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded-lg text-xs py-2 px-3 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-red-600/90 hover:bg-red-500 text-white font-semibold text-xs py-2 rounded-lg cursor-pointer"
                      >
                        Bloquear Horario
                      </Button>
                    </form>
                  </div>

                  {/* LISTA DE BLOQUEOS EXISTENTES */}
                  <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-amber-500/20 to-transparent" />
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Bloqueos Activos</h3>
                    <p className="text-[11px] text-neutral-400 mb-4">Listado de horas bloqueadas en la agenda.</p>

                    {timeBlocksList.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/20">
                        <p className="text-[11px] text-neutral-500">No hay bloqueos activos registrados.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {timeBlocksList.map((tb) => {
                          const start = new Date(tb.startTime);
                          const end = new Date(tb.endTime);
                          return (
                            <div
                              key={tb.id}
                              className="bg-neutral-950 border border-neutral-900 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1">
                                <p className="font-semibold text-neutral-200">
                                  {start.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                                <p className="text-[10px] text-amber-400 font-mono">
                                  {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} hs - {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} hs
                                </p>
                                {tb.reason && (
                                  <p className="text-[10px] text-neutral-400 italic">Motivo: {tb.reason}</p>
                                )}
                              </div>
                              <Button
                                size="xs"
                                onClick={() => handleDeleteBlock(tb.id)}
                                className="bg-neutral-900 border border-neutral-800 hover:bg-red-950 hover:border-red-900 text-neutral-400 hover:text-red-300 px-2 py-1 text-[10px] cursor-pointer"
                              >
                                Eliminar
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}

