const { getRedis } = require('../config/redis');
const {
  parseRedisVersionFromInfo,
  isRedisVersionOkForBullMq,
  BULLMQ_MIN_REDIS,
} = require('../utils/redisVersion');

let tested = false;
/** @type {boolean} */
let enabled = false;
/** @type {string|null} */
let lastVersion = null;

/**
 * Probe Redis once for BullMQ (requires Redis >= 5). Safe to call multiple times.
 * @returns {Promise<boolean>}
 */
async function ensureBullMqRedis() {
  if (tested) return enabled;
  tested = true;
  try {
    const info = await getRedis().info('server');
    lastVersion = parseRedisVersionFromInfo(info);
    enabled = isRedisVersionOkForBullMq(lastVersion);
    if (!enabled) {
      console.warn(
        `[BullMQ] Redis version ${lastVersion || 'unknown'} is below ${BULLMQ_MIN_REDIS}. ` +
          'Job queues and inline workers are disabled (BullMQ requires Redis 5+).',
      );
      console.warn(
        '[BullMQ] Fix: stop legacy "Redis on Windows" 3.x, then either run Redis 7 in Docker ' +
          '(from repo root: docker compose -f docker-compose.redis.yml up -d) or install Memurai Developer (winget install Memurai.MemuraiDeveloper).',
      );
    }
    return enabled;
  } catch (e) {
    enabled = false;
    lastVersion = null;
    console.warn('[BullMQ] Could not read Redis version:', e.message);
    return false;
  }
}

function isBullMqRedisEnabled() {
  return enabled;
}

function getLastRedisVersion() {
  return lastVersion;
}

/** @internal tests */
function resetBullMqRedisProbe() {
  tested = false;
  enabled = false;
  lastVersion = null;
}

module.exports = {
  ensureBullMqRedis,
  isBullMqRedisEnabled,
  getLastRedisVersion,
  resetBullMqRedisProbe,
};
