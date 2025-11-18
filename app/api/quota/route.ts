import { NextResponse } from 'next/server';
import { consumeQuota, getQuota } from '@/lib/quota';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: '未经授权' }, { status: 401 });
  }
  const quota = await getQuota(user.id);
  return NextResponse.json(quota);
}

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: '未经授权' }, { status: 401 });
  }

  const quota = await consumeQuota(user.id);
  if (!quota.allowed) {
    return NextResponse.json(quota, { status: 403 });
  }
  return NextResponse.json(quota);
}
