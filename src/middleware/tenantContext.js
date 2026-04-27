const env = require('../config/env');
const { getModels } = require('../db/prisma');

/**
 * Extract tenant slug from Host (e.g. `academy.mudar.com` → `academy`).
 * Apex / API hosts resolve to no tenant (platform / HQ traffic).
 */
function tenantSlugFromHost(hostHeader) {
  const base = String(env.mudarBaseDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0];
  if (!base || !hostHeader) return null;
  const host = String(hostHeader).split(':')[0].toLowerCase();
  if (host === base || host === `www.${base}`) return null;
  if (host === `api.${base}`) return null;
  if (host.endsWith(`.${base}`)) {
    const sub = host.slice(0, -(base.length + 1));
    if (sub && sub !== 'www' && sub !== 'api') return sub;
  }
  return null;
}

/**
 * Resolves `req.tenant` (plain object or null), `req.tenantId`, `req.platformMode`.
 * Dev: send `X-Mudar-Tenant-Slug` when using localhost (no real subdomain).
 */
async function tenantContext(req, res, next) {
  req.platformMode = false;
  req.tenant = null;
  req.tenantId = null;

  try {
    const headerSlug = req.get('x-mudar-tenant-slug') || req.get('X-Mudar-Tenant-Slug');
    const slugRaw = tenantSlugFromHost(req.get('host')) || headerSlug;
    const slug = slugRaw ? String(slugRaw).trim().toLowerCase() : null;
    if (!slug) {
      const devSlug = String(env.mudarDevDefaultTenantSlug || '').trim().toLowerCase();
      if (env.nodeEnv === 'development' && devSlug) {
        const { Tenant } = getModels();
        const demoRow = await Tenant.findOne({ where: { slug: devSlug } });
        if (demoRow) {
          const plain = typeof demoRow.get === 'function' ? demoRow.get({ plain: true }) : demoRow;
          req.tenant = plain;
          req.tenantId = plain.id;
          req.platformMode = false;
          req.tenantResolution = 'dev_default';
          return next();
        }
      }
      req.platformMode = true;
      return next();
    }

    const { Tenant } = getModels();
    const row = await Tenant.findOne({ where: { slug } });
    if (!row) {
      req.tenantResolution = 'not_found';
      return next();
    }
    const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    req.tenant = plain;
    req.tenantId = plain.id;
    req.platformMode = false;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { tenantContext, tenantSlugFromHost };
