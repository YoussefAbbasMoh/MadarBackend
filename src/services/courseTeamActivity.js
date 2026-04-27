const Course = require('../models/Course');
const { createInAppNotification } = require('./inAppNotify');
const NT = require('../constants/notificationTypes');

function actorLabel(user) {
  if (!user) return 'Someone';
  const s = String(user.name || user.email || '').trim();
  return s || 'A team member';
}

/**
 * Notify course owner + all listed assistants, except the acting user and any `extraExcludeUserIds`
 * (in-app, immediate). Used for collaborative dashboard activity.
 */
async function notifyCourseTeamExceptActor(courseId, actorUserId, options = {}) {
  const {
    title,
    body,
    href,
    type = NT.DASHBOARD_ACTIVITY,
    meta = {},
    extraExcludeUserIds = [],
  } = options;
  if (!courseId || actorUserId == null) return;

  const course = await Course.findById(courseId).select('title ownerId assistants').lean();
  if (!course) return;

  const exclude = new Set([String(actorUserId), ...extraExcludeUserIds.map((id) => String(id))]);
  const recipients = new Set();
  if (course.ownerId) recipients.add(String(course.ownerId));
  for (const a of course.assistants || []) {
    if (a.userId) recipients.add(String(a.userId));
  }
  for (const x of exclude) recipients.delete(x);

  const ct = course.title || 'A course';
  const defaultHref = `/staff/courses/${courseId}`;
  const finalTitle = title || 'Course updated';
  const finalBody = body || `${ct} was updated from the instructor dashboard.`;
  const finalHref = href && String(href).startsWith('/') ? href : defaultHref;

  for (const uid of recipients) {
    try {
      await createInAppNotification({
        userId: uid,
        type,
        title: finalTitle,
        body: finalBody,
        href: finalHref,
        meta: { courseId: String(courseId), ...meta },
      });
    } catch (e) {
      console.warn('[notifyCourseTeamExceptActor]', uid, e.message);
    }
  }
}

module.exports = {
  notifyCourseTeamExceptActor,
  actorLabel,
};
