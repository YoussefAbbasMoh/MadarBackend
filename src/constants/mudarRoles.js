/**
 * MUDAR SaaS role model (6 roles). Maps to `User.role` in PostgreSQL.
 *
 * Backward compatibility: legacy LMS values (`super_admin`, `instructor`, …) remain valid
 * until data migration and JWT issuance move everyone to the new vocabulary.
 */
const MUDAR_ROLES = {
  MUDAR_SUPER_ADMIN: 'mudar_super_admin',
  CLIENT_SUPER_ADMIN: 'client_super_admin',
  TEACHER: 'teacher',
  ASSISTANT: 'assistant',
  STUDENT: 'student',
  PARENT: 'parent',
};

/** Roles that may operate without a tenant (HQ console). */
function isPlatformRole(role) {
  return role === MUDAR_ROLES.MUDAR_SUPER_ADMIN || role === 'super_admin';
}

/** Roles scoped to a single tenant workspace. */
function isTenantScopedRole(role) {
  if (!role) return false;
  if (isPlatformRole(role)) return false;
  return true;
}

/** Map legacy LMS roles to closest MUDAR dashboard bucket (UI routing). */
function dashboardBucketForRole(role) {
  if (role === MUDAR_ROLES.MUDAR_SUPER_ADMIN || role === 'super_admin') return 'hq';
  if (role === MUDAR_ROLES.CLIENT_SUPER_ADMIN) return 'client_admin';
  if (role === 'instructor' || role === 'teacher' || role === 'doctor') return 'teacher';
  if (role === MUDAR_ROLES.ASSISTANT || role === 'assistant') return 'assistant';
  if (role === MUDAR_ROLES.STUDENT || role === 'student') return 'student';
  if (role === MUDAR_ROLES.PARENT || role === 'parent') return 'parent';
  return 'student';
}

module.exports = {
  MUDAR_ROLES,
  isPlatformRole,
  isTenantScopedRole,
  dashboardBucketForRole,
};
