import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

/**
 * Retorna una instancia del cliente de Supabase.
 * Si el usuario está autenticado, inyecta su JWT personalizado para aplicar RLS.
 * Si es una llamada anónima (portal público), retorna el cliente anon estándar.
 */
export async function getSupabaseClient() {
  const session = await auth();

  if (session?.user?.supabaseToken) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${session.user.supabaseToken}`,
        },
      },
    });
  }

  // Cliente anónimo por defecto para reservas públicas
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Cliente básico de Supabase que no depende del estado de sesión de NextAuth.
 * Útil para contextos donde no se dispone de la sesión o consultas puramente anónimas.
 */
export function getAnonSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
