const Course = require('../models/Course');
const { isDoctorLike } = require('../constants/roles');
const P = require('../constants/assistantPermissions');

function isOwner(course, user) {
  return String(course.ownerId) === String(user._id);
}

/** @param {{ assistants?: { userId: unknown; permissions?: string[] }[] }} course */
function assistantEntryForUser(course, user) {
  return (course.assistants || []).find((a) => String(a.userId) === String(user._id)) || null;
}

/** @param {{ assistants?: { userId: unknown; permissions?: string[] }[] }} course */
function assistantPermissionSet(course, user) {
  const entry = assistantEntryForUser(course, user);
  return new Set(entry?.permissions || []);
}

function isAssistantOnCourse(course, user) {
  if (user.role !== 'assistant') return false;
  return (course.assistants || []).some((a) => String(a.userId) === String(user._id));
}

function isEnrolled(course, user) {
  return (course.enrolledStudentIds || []).some((id) => String(id) === String(user._id));
}

/** Course owner or explicit assistant entry (same ids as {@link courseListQueryForUser} for instructional roles). */
function isOwnerOrAssistant(course, user) {
  if (isOwner(course, user)) return true;
  return (course.assistants || []).some((a) => String(a.userId) === String(user._id));
}

/** Instructional staff on this course (owner, co-listed teacher/doctor, or assistant row). */
function isInstructionalStaff(course, user) {
  if (user.role === 'super_admin') return true;
  if (['instructor', 'teacher', 'doctor'].includes(user.role) && isOwnerOrAssistant(course, user)) return true;
  if (user.role === 'assistant' && isAssistantOnCourse(course, user)) return true;
  return false;
}

function assistantHas(course, user, perm) {
  return assistantPermissionSet(course, user).has(perm);
}

/** Lessons & sub-lessons (authoring). */
function canEditLessons(course, user) {
  if (user.role === 'super_admin') return true;
  if (['instructor', 'teacher', 'doctor'].includes(user.role) && isOwnerOrAssistant(course, user)) return true;
  if (user.role === 'assistant' && isAssistantOnCourse(course, user)) return assistantHas(course, user, P.CONTENT);
  return false;
}

/** Assessment create/update/delete and staff assessment JSON. */
function canEditAssessments(course, user) {
  if (user.role === 'super_admin') return true;
  if (['instructor', 'teacher', 'doctor'].includes(user.role) && isOwnerOrAssistant(course, user)) return true;
  if (user.role === 'assistant' && isAssistantOnCourse(course, user)) return assistantHas(course, user, P.ASSESSMENTS);
  return false;
}

/** Submissions list / export / manual grade. */
function canGradeSubmissions(course, user) {
  if (user.role === 'super_admin') return true;
  if (['instructor', 'teacher', 'doctor'].includes(user.role) && isOwnerOrAssistant(course, user)) return true;
  if (user.role === 'assistant' && isAssistantOnCourse(course, user)) return assistantHas(course, user, P.GRADING);
  return false;
}

function canViewStudentRoster(course, user) {
  if (user.role === 'super_admin') return true;
  if (['instructor', 'teacher', 'doctor'].includes(user.role) && isOwnerOrAssistant(course, user)) return true;
  if (user.role === 'assistant' && isAssistantOnCourse(course, user)) return assistantHas(course, user, P.STUDENTS);
  return false;
}

function canUseMessaging(course, user) {
  if (user.role === 'super_admin') return true;
  if (['instructor', 'teacher', 'doctor'].includes(user.role) && isOwnerOrAssistant(course, user)) return true;
  if (user.role === 'assistant' && isAssistantOnCourse(course, user)) return assistantHas(course, user, P.MESSAGING);
  return false;
}

function canManageLiveSessions(course, user) {
  if (user.role === 'super_admin') return true;
  if (['instructor', 'teacher', 'doctor'].includes(user.role) && isOwnerOrAssistant(course, user)) return true;
  if (user.role === 'assistant' && isAssistantOnCourse(course, user)) return assistantHas(course, user, P.LIVE_SESSIONS);
  return false;
}

function canViewCourseAnalytics(course, user) {
  if (user.role === 'super_admin') return true;
  if (['instructor', 'teacher', 'doctor'].includes(user.role) && isOwnerOrAssistant(course, user)) return true;
  if (user.role === 'assistant' && isAssistantOnCourse(course, user)) return assistantHas(course, user, P.ANALYTICS);
  return false;
}

/**
 * Broad “staff on course” — prefer the specific `canEdit*` helpers for assistants.
 * Assistants need at least one granted permission to count as course staff for legacy checks.
 */
function canManageCourseContent(course, user) {
  if (user.role === 'super_admin') return true;
  if (['instructor', 'teacher', 'doctor'].includes(user.role) && isOwnerOrAssistant(course, user)) return true;
  if (user.role === 'assistant' && isAssistantOnCourse(course, user)) {
    const s = assistantPermissionSet(course, user);
    return P.ALL.some((k) => s.has(k));
  }
  return false;
}

async function getCourseForUser(courseId, user) {
  const { isValidDbId } = require('../lib/idCompat');
  if (!isValidDbId(courseId)) return null;
  const course = await Course.findById(courseId).lean();
  if (!course) return null;
  if (user.role === 'super_admin') return course;
  if (user.role === 'student' && isEnrolled(course, user)) return course;
  if (['instructor', 'teacher', 'doctor', 'assistant'].includes(user.role) && isOwnerOrAssistant(course, user)) {
    return course;
  }
  return null;
}

function canEditCourseSettings(course, user) {
  if (user.role === 'super_admin') return true;
  if (user.role === 'instructor' && isOwner(course, user)) return true;
  if (isDoctorLike(user.role) && isOwner(course, user)) return true;
  return false;
}

function canCreateCourse(user) {
  return ['super_admin', 'instructor', 'teacher', 'doctor'].includes(user.role);
}

module.exports = {
  isOwner,
  isAssistantOnCourse,
  isOwnerOrAssistant,
  isInstructionalStaff,
  isEnrolled,
  assistantEntryForUser,
  assistantPermissionSet,
  getCourseForUser,
  canEditLessons,
  canEditAssessments,
  canGradeSubmissions,
  canViewStudentRoster,
  canUseMessaging,
  canManageLiveSessions,
  canViewCourseAnalytics,
  canManageCourseContent,
  canEditCourseSettings,
  canCreateCourse,
};
