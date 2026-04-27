const Notification = require('../models/Notification');

/**
 * Create a single in-app notification (shows immediately; does not require BullMQ).
 * @param {{ userId: string; type: string; title: string; body: string; href?: string|null; meta?: Record<string, unknown> }} opts
 */
async function createInAppNotification(opts) {
  const { userId, type, title, body, href = null, meta = {} } = opts;
  if (!userId) return null;
  const payload = { title, body, ...(href ? { href } : {}), ...meta };
  const doc = await Notification.create({
    userId,
    type,
    payload,
    channel: ['inapp'],
    status: 'sent',
  });
  return doc;
}

/**
 * @param {Array<{ userId: string; type: string; title: string; body: string; href?: string|null; meta?: Record<string, unknown> }>} rows
 */
async function createInAppNotificationsMany(rows) {
  if (!rows.length) return [];
  const docs = rows.map((r) => ({
    userId: r.userId,
    type: r.type,
    payload: { title: r.title, body: r.body, ...(r.href ? { href: r.href } : {}), ...(r.meta || {}) },
    channel: ['inapp'],
    status: 'sent',
  }));
  return Notification.insertMany(docs, { ordered: false });
}

/** Course owner + assistants with `grading` permission. */
function recipientIdsForGradingAlerts(course) {
  const ids = new Set();
  if (course.ownerId) ids.add(String(course.ownerId));
  for (const a of course.assistants || []) {
    const perms = a.permissions || [];
    if (perms.includes('grading') && a.userId) ids.add(String(a.userId));
  }
  return [...ids];
}

module.exports = {
  createInAppNotification,
  createInAppNotificationsMany,
  recipientIdsForGradingAlerts,
};
