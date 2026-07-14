import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import jwt from "jsonwebtoken";

// Extender los tipos de NextAuth para TypeScript
declare module "next-auth" {
  interface User {
    id?: string;
    tenantId?: string;
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      tenantId?: string;
      role: string;
      supabaseToken?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    tenantId?: string;
    role?: string;
    supabaseToken?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;

        // Mock para simular roles en el MVP
        if (email.startsWith("admin@")) {
          return {
            id: "11111111-1111-1111-1111-111111111111",
            name: "Admin Figaro",
            email: email,
            tenantId: "55555555-5555-5555-5555-555555555555",
            role: "admin",
          };
        } else if (email.startsWith("staff@")) {
          return {
            id: "22222222-2222-2222-2222-222222222222",
            name: "Juan Barbero",
            email: email,
            tenantId: "55555555-5555-5555-5555-555555555555",
            role: "staff",
          };
        }

        // Cliente por defecto
        return {
          id: "33333333-3333-3333-3333-333333333333",
          name: "Cliente Cosme",
          email: email,
          tenantId: "55555555-5555-5555-5555-555555555555",
          role: "customer",
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;

        // Firmar token JWT compatible con Supabase RLS
        const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET || "fallback-secret-para-dev-123456789";
        const payload = {
          role: user.role,
          tenantId: user.tenantId,
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hora de expiración
        };
        token.supabaseToken = jwt.sign(payload, supabaseJwtSecret);
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
        session.user.supabaseToken = token.supabaseToken as string;
      }
      return session;
    }
  },
  session: {
    strategy: "jwt",
  },
});
