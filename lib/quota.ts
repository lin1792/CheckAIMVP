import { kv } from '@vercel/kv';

const FALLBACK_QUOTA = 2;
const PREFIX = 'usage:v1:';
const memoryUsage = new Map<string, number>();

const hasKv =
  typeof process.env.KV_REST_API_URL === 'string' &&
  process.env.KV_REST_API_URL.length > 0 &&
  typeof process.env.KV_REST_API_TOKEN === 'string' &&
  process.env.KV_REST_API_TOKEN.length > 0;

const FREE_LIMIT = Number.isFinite(Number(process.env.FREE_QUOTA_LIMIT))
  ? Number(process.env.FREE_QUOTA_LIMIT)
  : FALLBACK_QUOTA;

type UsageSnapshot = {
  used: number;
  remaining: number;
  limit: number;
};

function quotaKey(userId: string) {
  return `${PREFIX}${userId}`;
}

async function readUsage(userId: string): Promise<number> {
  if (!hasKv) {
    return memoryUsage.get(userId) ?? 0;
  }
  const used = await kv.hget<number>(quotaKey(userId), 'used');
  if (typeof used === 'number' && Number.isFinite(used)) {
    return used;
  }
  if (typeof used === 'string' && used) {
    const parsed = Number(used);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

async function writeUsage(userId: string, used: number) {
  if (!hasKv) {
    memoryUsage.set(userId, used);
    return;
  }
  await kv.hset(quotaKey(userId), {
    used,
    updatedAt: new Date().toISOString()
  });
}

function snapshot(used: number): UsageSnapshot {
  return {
    used,
    limit: FREE_LIMIT,
    remaining: Math.max(FREE_LIMIT - used, 0)
  };
}

export async function getQuota(userId: string): Promise<UsageSnapshot> {
  const used = await readUsage(userId);
  return snapshot(used);
}

export async function consumeQuota(
  userId: string
): Promise<UsageSnapshot & { allowed: boolean }> {
  const current = await readUsage(userId);
  if (current >= FREE_LIMIT) {
    return { ...snapshot(current), allowed: false };
  }

  const nextUsed = current + 1;
  if (nextUsed > FREE_LIMIT) {
    await writeUsage(userId, FREE_LIMIT);
    return { ...snapshot(FREE_LIMIT), allowed: false };
  }

  await writeUsage(userId, nextUsed);
  return { ...snapshot(nextUsed), allowed: true };
}
