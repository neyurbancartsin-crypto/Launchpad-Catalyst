import type { NextAuthConfig } from "next-auth";

/**
 * The auth config subset safe to bundle into middleware.
 *
 * Deliberately excludes the Credentials provider: its `authorize()` closure
 * pulls in `bcryptjs` and the full Prisma client, which bloated the
 * middleware bundle past Vercel's 1 MB Edge Function limit even though
 * middleware never calls `authorize()` — it only reads the JWT session.
 * Bundlers include anything statically reachable from the entry point
 * regardless of which branches actually execute, so the provider had to
 * move to a module middleware doesn't import.
 *
 * `src/lib/auth.ts` (route handlers, server actions) spreads this and adds
 * the real provider. `src/middleware.ts` builds its own lightweight
 * `NextAuth` instance from this config alone.
 */
export const authConfig = {
  // Vercel terminates TLS and forwards the real Host header, and preview
  // deployments get a new *.vercel.app subdomain each time — there's no
  // single hostname to hardcode ahead of time. Auth.js's own auto-detection
  // (trusting the host when `process.env.VERCEL` is set) should cover this,
  // but it depends on Vercel's "Automatically expose System Environment
  // Variables" project setting staying enabled; setting this explicitly
  // means production auth doesn't depend on that toggle.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
