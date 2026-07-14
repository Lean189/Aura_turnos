import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { bookings } from "@/lib/mockDb";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth();

  // Si no está autenticado, redirigir al login
  if (!session || !session.user) {
    redirect("/api/auth/signin");
  }

  // Pasar los datos iniciales y la sesión del usuario al componente de cliente interactivo
  return (
    <DashboardClient
      initialBookings={bookings}
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
