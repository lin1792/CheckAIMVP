import type { NextAuthOptions, Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: clientId ?? '',
      clientSecret: clientSecret ?? ''
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
  return getServerSession(authOptions);
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
