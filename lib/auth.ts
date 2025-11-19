// @ts-nocheck
import type { Session } from 'next-auth';
import NextAuth from 'next-auth/next';
import { getServerSession } from 'next-auth/next';
import GoogleProvider from 'next-auth/providers/google';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const oidcTimeoutMs = Number(process.env.OIDC_HTTP_TIMEOUT_MS ?? '15000');

// Use loose typing here to avoid module resolution issues with AuthOptions under bundler mode
export const authOptions: any = {
  providers: [
    GoogleProvider({
      clientId: clientId ?? '',
      clientSecret: clientSecret ?? '',
      // Increase openid-client HTTP timeout to better tolerate slow networks
      httpOptions: {
        timeout: oidcTimeoutMs
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? session.user.email ?? '').toString();
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};

export async function getAuthSession(): Promise<Session | null> {
  return getServerSession(authOptions as Parameters<typeof NextAuth>[0]);
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const session = await getAuthSession();
  const user = session?.user;
  if (!user?.email || !user?.id) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email
  };
}
