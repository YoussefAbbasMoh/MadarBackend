/**
 * Parse redis_version from INFO (or compatible servers like Memurai).
 * @param {string} infoBlock e.g. output of redis.info('server')
 * @returns {string|null}
 */
function parseRedisVersionFromInfo(infoBlock) {
  const lines = infoBlock.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('redis_version:')) {
      return line.slice('redis_version:'.length).trim() || null;
    }
  }
  return null;
}

/** @param {string} a @param {string} b semver-like e.g. 7.2.4 vs 5.0.0 */
function semverGte(a, b) {
  const pa = String(a)
    .split('.')
    .map((x) => parseInt(x, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
  const pb = String(b)
    .split('.')
    .map((x) => parseInt(x, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true;
}

const BULLMQ_MIN_REDIS = '5.0.0';

function isRedisVersionOkForBullMq(version) {
  return Boolean(version && semverGte(version, BULLMQ_MIN_REDIS));
}

module.exports = {
  parseRedisVersionFromInfo,
  semverGte,
  isRedisVersionOkForBullMq,
  BULLMQ_MIN_REDIS,
};
