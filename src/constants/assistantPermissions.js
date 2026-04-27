/** Per-course privileges for users with role `assistant` (set on `Course.assistants[].permissions`). */
const CONTENT = 'content';
const ASSESSMENTS = 'assessments';
const GRADING = 'grading';
const STUDENTS = 'students';
const MESSAGING = 'messaging';
const LIVE_SESSIONS = 'live_sessions';
const ANALYTICS = 'analytics';

const ALL = [CONTENT, ASSESSMENTS, GRADING, STUDENTS, MESSAGING, LIVE_SESSIONS, ANALYTICS];

function sanitizeAssistantPermissions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = new Set();
  for (const x of raw) {
    const s = String(x || '').trim();
    if (ALL.includes(s)) out.add(s);
  }
  return [...out];
}

module.exports = {
  CONTENT,
  ASSESSMENTS,
  GRADING,
  STUDENTS,
  MESSAGING,
  LIVE_SESSIONS,
  ANALYTICS,
  ALL,
  sanitizeAssistantPermissions,
};
