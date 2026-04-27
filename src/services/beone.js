const env = require('../config/env');
const { getRedis } = require('../config/redis');

const OTP_PREFIX = 'otp:';
const OTP_RATE_PREFIX = 'otp_rate:';

const memoryOtp = new Map();
const memoryOtpRate = new Map();

function devBypassCode() {
  return env.nodeEnv !== 'production' ? '000000' : null;
}

function isDevKvFallback() {
  return env.nodeEnv !== 'production';
}

async function assertOtpRateLimit(phone) {
  try {
    const redis = getRedis();
    const key = `${OTP_RATE_PREFIX}${phone}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 600);
    if (count > 3) {
      const e = new Error('Too many OTP requests. Try again later.');
      e.status = 429;
      throw e;
    }
  } catch (e) {
    if (e && e.status === 429) throw e;
    if (!isDevKvFallback()) throw e;
    console.warn('[beone] OTP rate limit skipped (Redis unavailable, dev only):', e.message);
    const key = `${OTP_RATE_PREFIX}${phone}`;
    const n = (memoryOtpRate.get(key) || 0) + 1;
    memoryOtpRate.set(key, n);
    if (n > 3) {
      const err = new Error('Too many OTP requests. Try again later.');
      err.status = 429;
      throw err;
    }
  }
}

async function sendOtp(phone) {
  await assertOtpRateLimit(phone);
  const code =
    devBypassCode() ||
    String(Math.floor(100000 + Math.random() * 900000));
  try {
    const redis = getRedis();
    await redis.set(`${OTP_PREFIX}${phone}`, code, 'EX', 600);
  } catch (e) {
    if (!isDevKvFallback()) throw e;
    console.warn('[beone] OTP not stored in Redis (dev fallback in-memory):', e.message);
    memoryOtp.set(`${OTP_PREFIX}${phone}`, { code, exp: Date.now() + 600000 });
  }
  if (env.beoneApiKey && env.nodeEnv === 'production') {
    // Integrate BeOne API here
  }
  return { ok: true, devCode: devBypassCode() ? code : undefined };
}

async function verifyOtp(phone, code) {
  const bypass = devBypassCode();
  if (bypass && String(code) === bypass) {
    return true;
  }
  const otpKey = `${OTP_PREFIX}${phone}`;
  let stored = null;
  try {
    const redis = getRedis();
    stored = await redis.get(otpKey);
  } catch (e) {
    if (!isDevKvFallback()) throw e;
    console.warn('[beone] Redis get failed during OTP verify (dev); checking memory:', e.message);
  }
  if (stored == null && isDevKvFallback()) {
    const mem = memoryOtp.get(otpKey);
    if (mem && Date.now() <= mem.exp) stored = mem.code;
  }
  if (!stored || stored !== String(code)) return false;
  try {
    const redis = getRedis();
    await redis.del(otpKey);
  } catch (e) {
    if (!isDevKvFallback()) throw e;
  }
  memoryOtp.delete(otpKey);
  return true;
}

module.exports = { sendOtp, verifyOtp };
