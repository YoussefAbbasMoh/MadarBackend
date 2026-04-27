const { isValidDbId } = require('../lib/idCompat');
const Message = require('../models/Message');
const Course = require('../models/Course');
const { getCourseForUser } = require('../utils/courseAccess');
const { courseListQueryForUser } = require('../utils/courseListQuery');
const NT = require('../constants/notificationTypes');
const { notifyCourseTeamExceptActor, actorLabel } = require('../services/courseTeamActivity');

async function history(req, res) {
  const { courseId } = req.params;
  const course = await getCourseForUser(courseId, req.user);
  if (!course) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const lim = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const cursor = req.query.cursor;
  const q = { courseId };
  if (cursor && isValidDbId(String(cursor))) {
    q._id = { $lt: String(cursor) };
  }
  const items = await Message.find(q)
    .sort({ createdAt: -1 })
    .limit(lim)
    .populate('senderId', 'name role email')
    .lean();
  res.json({ items, nextCursor: items.length ? String(items[items.length - 1]._id) : null });
}

/** Staff: last activity + unread (messages from others without readAt) per course in workspace. */
async function staffInbox(req, res) {
  const cq = courseListQueryForUser(req.user);
  if (cq === null) {
    res.json({ items: [] });
    return;
  }
  const courses = await Course.find(cq).select('_id title status').sort({ updatedAt: -1 }).limit(200).lean();
  const ids = courses.map((c) => c._id);
  if (!ids.length) {
    res.json({ items: [] });
    return;
  }
  const lastByCourse = await Message.aggregate([
    { $match: { courseId: { $in: ids } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$courseId',
        lastAt: { $first: '$createdAt' },
        lastContent: { $first: '$content' },
        total: { $sum: 1 },
      },
    },
  ]);
  const lastMap = new Map(lastByCourse.map((r) => [String(r._id), r]));
  const uid = req.user._id;
  const unreadRows = await Message.aggregate([
    {
      $match: {
        courseId: { $in: ids },
        senderId: { $ne: uid },
        $or: [{ readAt: { $exists: false } }, { readAt: null }],
      },
    },
    { $group: { _id: '$courseId', unread: { $sum: 1 } } },
  ]);
  const unreadMap = new Map(unreadRows.map((r) => [String(r._id), r.unread]));
  const items = courses.map((c) => {
    const row = lastMap.get(String(c._id));
    return {
      courseId: c._id,
      title: c.title,
      courseStatus: c.status,
      messageCount: row ? row.total : 0,
      lastMessageAt: row ? row.lastAt : null,
      lastPreview: row && row.lastContent ? String(row.lastContent).slice(0, 160) : '',
      unreadForYou: unreadMap.get(String(c._id)) || 0,
    };
  });
  res.json({ items });
}

async function markRead(req, res) {
  const { courseId } = req.params;
  const course = await getCourseForUser(courseId, req.user);
  if (!course) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  await Message.updateMany(
    {
      courseId,
      senderId: { $ne: req.user._id },
      $or: [{ readAt: { $exists: false } }, { readAt: null }],
    },
    { $set: { readAt: new Date() } },
  );
  res.json({ ok: true });
}

async function send(req, res) {
  const { courseId } = req.params;
  const course = await getCourseForUser(courseId, req.user);
  if (!course) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { content, attachmentUrl, receiverId } = req.body;
  if (!content) {
    res.status(400).json({ error: 'content required' });
    return;
  }
  const msg = await Message.create({
    senderId: req.user._id,
    receiverId: receiverId || null,
    courseId,
    content,
    attachmentUrl,
  });
  await msg.populate('senderId', 'name role email');
  const io = req.app.get('io');
  io?.to(`course:${courseId}`).emit('message', msg.toObject());
  const preview = String(content || '').slice(0, 120);
  notifyCourseTeamExceptActor(courseId, req.user._id, {
    type: NT.DASHBOARD_ACTIVITY,
    title: 'Course chat message',
    body: `${actorLabel(req.user)} posted in chat: ${preview}${String(content).length > 120 ? '…' : ''}`,
    href: `/staff/courses/${courseId}`,
    meta: { scope: 'chat', messageId: String(msg._id) },
  }).catch((e) => console.warn('[chat.send] team notify:', e.message));
  res.status(201).json({ message: msg.toObject() });
}

module.exports = { history, send, staffInbox, markRead };
