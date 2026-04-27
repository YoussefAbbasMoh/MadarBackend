/**
 * Cross-tenant / platform metadata for SPA (branding, resolved workspace).
 * Auth optional: safe for marketing pages; staff UIs should still require JWT.
 */
function getContext(req, res) {
  const t = req.tenant;
  res.json({
    product: 'MUDAR',
    platformMode: Boolean(req.platformMode),
    tenantResolution: req.tenantResolution || null,
    tenant: t
      ? {
          id: t.id,
          slug: t.slug,
          name: t.name,
          status: t.status,
          branding: t.branding || {},
        }
      : null,
  });
}

module.exports = { getContext };
