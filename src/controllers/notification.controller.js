const Notification = require('../models/Notification');
const Course = require('../models/Course');
const { canUseMessaging } = require('../utils/courseAccess');
const { getQueues } = require('../queues');
const { WHATSAPP_SENDERS } = require('../constants/roles');
const NT = require('../constants/notificationTypes');
const { notifyCourseTeamExceptActor, actorLabel } = require('../services/courseTeamActivity');

async function broadcast(req, res) {
  const { courseId, studentIds, body, channels, scheduleAt } = req.body;
  if (!courseId || !body) {
    res.status(400).json({ error: 'courseId and body required' });
    return;
  }
  const course = await Course.findById(courseId);
  if (!course || !canUseMessaging(course, req.user)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const wantsWhatsapp = (channels || []).includes('whatsapp');
  if (wantsWhatsapp && !WHATSAPP_SENDERS.includes(req.user.role)) {
    res.status(403).json({ error: 'WhatsApp broadcasts require instructor or super admin' });
    return;
  }
  const targets =
    Array.isArray(studentIds) && studentIds.length
      ? studentIds
      : (course.enrolledStudentIds || []).map(String);
  const docs = [];
  for (const userId of targets) {
    const n = await Notification.create({
      userId,
      type: 'broadcast',
      payload: { body, courseId },
      channel: channels || ['inapp'],
      status: 'queued',
    });
    docs.push(n);
    const q = getQueues();
    await q.inapp.add(
      'notify',
      { notificationId: String(n._id) },
      scheduleAt ? { delay: new Date(scheduleAt).getTime() - Date.now() } : undefined
    );
    if (wantsWhatsapp) {
      await q.whatsapp.add('notify', { notificationId: String(n._id) });
    }
  }
  try {
    await notifyCourseTeamExceptActor(courseId, req.user._id, {
      type: NT.DASHBOARD_ACTIVITY,
      title: 'Learner broadcast sent',
      body: `${actorLabel(req.user)} queued an in-app message to ${targets.length} recipient(s).`,
      href: `/staff/courses/${courseId}`,
      meta: { scope: 'messaging' },
    });
  } catch (e) {
    console.warn('[notification.broadcast] team:', e.message);
  }
  res.status(201).json({ count: docs.length });
}

function normalizeNotification(doc) {
  const p = doc.payload && typeof doc.payload === 'object' ? doc.payload : {};
  const title =
    typeof p.title === 'string' && p.title.trim()
      ? p.title.trim()
      : doc.type === 'broadcast'
        ? 'Course message'
        : 'Notification';
  const body =
    typeof p.body === 'string' && p.body.trim()
      ? p.body.trim()
      : typeof p.message === 'string'
        ? p.message.trim()
        : '';
  let href = typeof p.href === 'string' && p.href.startsWith('/') ? p.href : null;
  if (!href && doc.type === 'broadcast' && p.courseId) {
    href = `/student/classes/${p.courseId}?tab=notifications`;
  }
  return {
    ...doc,
    title,
    body,
    href,
  };
}

async function unreadCount(req, res) {
  const count = await Notification.countDocuments({
    userId: req.user._id,
    status: { $in: ['queued', 'sent', 'delivered'] },
  });
  res.json({ count });
}

async function listMine(req, res) {
  const items = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ items: items.map(normalizeNotification) });
}

async function readOne(req, res) {
  const id = req.params.id;
  const n = await Notification.findOne({ _id: id, userId: req.user._id }).lean();
  if (!n) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (n.status !== 'read') {
    await Notification.updateOne({ _id: id }, { $set: { status: 'read' } });
  }
  res.json({ item: normalizeNotification({ ...n, status: 'read' }) });
}

async function readAll(req, res) {
  await Notification.updateMany({ userId: req.user._id, status: { $ne: 'read' } }, { $set: { status: 'read' } });
  res.json({ ok: true });
}

async function history(req, res) {
  if (!['super_admin', 'instructor', 'teacher', 'doctor'].includes(req.user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const items = await Notification.find({}).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ items });
}

module.exports = { broadcast, unreadCount, listMine, readOne, readAll, history };
