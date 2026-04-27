/** PostgreSQL UUID string (any version) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  if (id == null) return false;
  return UUID_RE.test(String(id).trim());
}

module.exports = { isValidUuid, UUID_RE };
