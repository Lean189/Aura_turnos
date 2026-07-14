import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth();

  // Si no está autenticado, redirigir al login
  if (!session || !session.user) {
    redirect("/api/auth/signin");
  }

  // Cargar reservas desde Supabase utilizando RLS del usuario logueado
  const supabase = await getSupabaseClient();
  const { data: bookingsData } = await supabase
    .from("bookings")
    .select(`
      *,
      customers (name, phone)
    `)
    .order("start_time", { ascending: true });

  const formattedBookings = (bookingsData || []).map((b: any) => ({
    id: b.id,
    branchId: b.branch_id,
    staffId: b.staff_id,
    serviceId: b.service_id,
    customerName: b.customers?.name || "Desconocido",
    phone: b.customers?.phone || "",
    startTime: b.start_time,
    endTime: b.end_time,
    status: b.status,
  }));

  // Pasar los datos iniciales y la sesión del usuario al componente de cliente interactivo
  return (
    <DashboardClient
      initialBookings={formattedBookings}
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        tenantId: session.user.tenantId,
      }}
    />
  );
}
export const dynamic = "force-dynamic";

