import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Exportar la función de proxy con nombre, como lo requiere la convención de Next.js 16
export const proxy = auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Definir rutas protegidas
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");

  if (isDashboardRoute) {
    // Si no está autenticado, redirigir al login
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/api/auth/signin", nextUrl));
    }

    // Obtener rol del usuario autenticado
    const role = req.auth?.user?.role;

    // Rutas exclusivas para administradores
    const isAdminRoute = nextUrl.pathname.startsWith("/dashboard/admin");
    if (isAdminRoute && role !== "admin" && role !== "superadmin") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    // Rutas de administración accesibles por staff/recepcionista
    const isStaffRoute = nextUrl.pathname.startsWith("/dashboard/staff");
    if (isStaffRoute && !["admin", "superadmin", "staff", "receptionist"].includes(role || "")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }
  
  return NextResponse.next();
});

// Especificar en qué rutas se activa el proxy
export const config = {
  matcher: ["/dashboard/:path*"],
};
