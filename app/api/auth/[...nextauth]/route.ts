// @ts-nocheck
import NextAuth from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

const handler = (NextAuth as unknown as (options: any) => any)(authOptions);

export { handler as GET, handler as POST };
