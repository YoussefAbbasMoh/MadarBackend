// In development, `.env` should win over a stale global DATABASE_URL on the machine.
require('dotenv').config({ override: process.env.NODE_ENV !== 'production' });

function required(name, fallback) {
  const v = process.env[name];
  if (v) return v;
  if (fallback !== undefined) return fallback;
  if (process.env.NODE_ENV === 'test') return 'test';
  throw new Error(`Missing required environment variable: ${name}`);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  /** HTTP port. Override with PORT=5000 etc. Vite dev proxy defaults to 2000. */
  port: Number(process.env.PORT) || 2000,

  /** PostgreSQL connection string for Sequelize (required at runtime). */
  databaseUrl: process.env.DATABASE_URL,

  /**
   * MUDAR: apex domain for tenant subdomain parsing (e.g. `mudar.com` or `mudar.local`).
   * Hosts like `{slug}.{mudarBaseDomain}` resolve to tenant `slug`. Omit protocol.
   */
  mudarBaseDomain: process.env.MUDAR_BASE_DOMAIN || 'localhost',
  /**
   * MUDAR: when no tenant slug is resolved from Host / `X-Mudar-Tenant-Slug`, development uses this tenant slug
   * (default `demo`). Set to empty string to disable and keep apex traffic in platform mode.
   */
  mudarDevDefaultTenantSlug:
    process.env.MUDAR_DEV_DEFAULT_TENANT_SLUG !== undefined
      ? String(process.env.MUDAR_DEV_DEFAULT_TENANT_SLUG || '').trim()
      : 'demo',
  redisUrl: process.env.REDIS_URL,
  jwtRsaPrivateKey: process.env.JWT_RSA_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  jwtRsaPublicKey: process.env.JWT_RSA_PUBLIC_KEY?.replace(/\\n/g, '\n'),
  jwtSecret: process.env.JWT_SECRET,
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
  jwtRefreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS) || 30,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  agentHmacSecret: process.env.AGENT_HMAC_SECRET || 'dev-agent-hmac',
  beoneApiKey: process.env.BEONE_API_KEY,
  beoneSender: process.env.BEONE_SENDER,
  publicWebUrl: process.env.PUBLIC_WEB_URL,
  /** V-Connect / VCloud v4 — https://v.cloudapi.vconnct.me (see .env.example) */
  vconnectApiUrl: process.env.VCONNECT_API_URL,
  vconnectApiKey: process.env.VCONNECT_API_KEY,
  vconnectSecretKey: process.env.VCONNECT_SECRET_KEY,
  vconnectProjectId: process.env.VCONNECT_PROJECT_ID,
  paymobApiKey: process.env.PAYMOB_API_KEY,
  paymobIntegrationId: process.env.PAYMOB_INTEGRATION_ID,
  paymobIframeId: process.env.PAYMOB_IFRAME_ID,
  paymobHmacSecret: process.env.PAYMOB_HMAC_SECRET,
  contaboEndpoint: process.env.CONTABO_ENDPOINT,
  contaboAccessKey: process.env.CONTABO_ACCESS_KEY,
  contaboSecretKey: process.env.CONTABO_SECRET_KEY,
  contaboBucket: process.env.CONTABO_BUCKET,
  contaboRegion: process.env.CONTABO_REGION,
  enableInlineWorkers: process.env.ENABLE_INLINE_WORKERS !== '0',
  /**
   * How many reverse proxies sit in front of this API (Vite dev server, nginx, load balancer).
   * Default 1 so `X-Forwarded-For` + express-rate-limit agree; set TRUST_PROXY=0 only if Node is exposed
   * directly with no proxy and clients must not send forwarded headers.
   */
  trustProxy: (() => {
    const v = process.env.TRUST_PROXY;
    if (v === '0' || v === 'false') return 0;
    if (v == null || v === '') return 1;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 1;
  })(),
  /**
   * When true, server startup may create seed.superadmin@lms.local / seed.instructor@lms.local if those roles are missing.
   * On by default except when NODE_ENV=production (then set AUTO_SEED_STAFF=1 to enable).
   */
  autoSeedStaff:
    process.env.AUTO_SEED_STAFF === '1' ||
    (process.env.NODE_ENV !== 'production' && process.env.AUTO_SEED_STAFF !== '0'),
};
