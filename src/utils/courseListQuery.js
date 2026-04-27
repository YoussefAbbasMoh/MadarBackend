const { isValidUuid } = require('../lib/ids');

/**
 * Coerce route/JWT user ids for DB queries (UUID string).
 */
function toObjectId(id) {
  if (id == null) return null;
  const s = String(id);
  return isValidUuid(s) ? s : null;
}

/**
 * Same course visibility rules everywhere (staff KPIs, GET /courses, live session list, etc.).
 * Login still uses {@link User} by email only — this helper is only for Course-scoped queries.
 *
 * @returns {Record<string, unknown> | null} `null` = unknown role; `{}` = super_admin (no restriction).
 */
function courseListQueryForUser(user) {
  if (!user || !user.role) return null;
  /** Super-admin sees every course — must not depend on `user._id` parsing. */
  if (user.role === 'super_admin') return {};
  const oid = toObjectId(user._id);
  if (!oid) return null;
  if (user.role === 'student') return { enrolledStudentIds: oid };
  /** Owner or listed assistant — matches studio / live session / inbox visibility. */
  if (['teacher', 'doctor', 'instructor'].includes(user.role)) {
    return { $or: [{ ownerId: oid }, { 'assistants.userId': oid }] };
  }
  if (user.role === 'assistant') return { 'assistants.userId': oid };
  return null;
}

module.exports = { toObjectId, courseListQueryForUser };
