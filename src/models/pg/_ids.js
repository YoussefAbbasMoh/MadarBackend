const { isValidUuid } = require('../../lib/ids');

function asUuid(id) {
  if (id == null) return null;
  const s = String(id);
  return isValidUuid(s) ? s : null;
}

module.exports = { asUuid, isValidUuid };
