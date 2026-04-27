const { AsyncLocalStorage } = require('node:async_hooks');

const als = new AsyncLocalStorage();

/**
 * @typedef {{ tenantId: string | null, skipTenantScope: boolean }} TenantQueryStore
 */

function bindTenantQueryScope(req, res, next) {
  const tenantId = req.tenantId != null ? String(req.tenantId) : null;
  /** @type {TenantQueryStore} */
  const store = { tenantId, skipTenantScope: false };
  return als.run(store, () => next());
}

function markPlatformAdminSkipTenantScope() {
  const s = als.getStore();
  if (s) s.skipTenantScope = true;
}

/** @returns {TenantQueryStore | undefined} */
function getTenantQueryStore() {
  return als.getStore();
}

module.exports = {
  bindTenantQueryScope,
  markPlatformAdminSkipTenantScope,
  getTenantQueryStore,
};
