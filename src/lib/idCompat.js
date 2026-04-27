const { isValidUuid } = require('./ids');

/** Accept PostgreSQL UUID in route params and JWT `sub`. */
function isValidDbId(id) {
  if (id == null) return false;
  const s = String(id);
  return isValidUuid(s);
}

module.exports = { isValidDbId };
