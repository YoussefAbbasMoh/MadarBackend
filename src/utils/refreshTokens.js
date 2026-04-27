const { getRedis } = require('../config/redis');
const env = require('../config/env');

const PREFIX = 'refresh:';
const ttlRaw = env.jwtRefreshTtlDays * 24 * 60 * 60;
const ttlSeconds =
  Number.isFinite(ttlRaw) && ttlRaw > 0 ? Math.floor(ttlRaw) : 30 * 24 * 60 * 60;

/** Dev-only fallback when Redis is down (common on local Windows without Redis 5+). */
const memoryRefresh = new Map();

function memSet(key, val) {
  memoryRefresh.set(key, { val, exp: Date.now() + ttlSeconds * 1000 });
}

function memGetDel(key) {
  const o = memoryRefresh.get(key);
  if (!o) return null;
  memoryRefresh.delete(key);
  if (Date.now() > o.exp) return null;
  return o.val;
}

function memDel(key) {
  memoryRefresh.delete(key);
}

function isDevKvFallback() {
  return env.nodeEnv !== 'production';
}

async function storeRefreshToken(token, userId) {
  const key = `${PREFIX}${token}`;
  const val = String(userId);
  try {
    const redis = getRedis();
    await redis.set(key, val, 'EX', ttlSeconds);
  } catch (e) {
    if (!isDevKvFallback()) throw e;
    console.warn('[refreshTokens] Redis unavailable; using in-memory refresh store (dev only):', e.message);
    memSet(key, val);
  }
}

async function consumeRefreshToken(token) {
  const key = `${PREFIX}${token}`;
  let userId = null;
  try {
    const redis = getRedis();
    userId = await redis.get(key);
    if (userId) await redis.del(key);
  } catch (e) {
    if (!isDevKvFallback()) throw e;
    console.warn('[refreshTokens] Redis get failed; trying in-memory (dev only):', e.message);
  }
  if (!userId) userId = memGetDel(key);
  return userId;
}

async function revokeRefreshToken(token) {
  const key = `${PREFIX}${token}`;
  try {
    const redis = getRedis();
    await redis.del(key);
  } catch (e) {
    if (!isDevKvFallback()) throw e;
  }
  memDel(key);
}

module.exports = { storeRefreshToken, consumeRefreshToken, revokeRefreshToken };
