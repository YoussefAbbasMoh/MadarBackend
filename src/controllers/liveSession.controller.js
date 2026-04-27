const LiveSession = require('../models/LiveSession');
const Course = require('../models/Course');
const vconnect = require('../services/vconnect');
const { getCourseForUser, canManageLiveSessions } = require('../utils/courseAccess');
const { courseListQueryForUser } = require('../utils/courseListQuery');
const { getQueues } = require('../queues');
const AgentSession = require('../models/AgentSession');
const NT = require('../constants/notificationTypes');
const { createInAppNotificationsMany } = require('../services/inAppNotify');
const { notifyCourseTeamExceptActor, actorLabel } = require('../services/courseTeamActivity');

async function assertHost(req, courseId) {
  const course = await Course.findById(courseId);
  if (!course) {
    const e = new Error('Course not found');
    e.status = 404;
    throw e;
  }
  if (!canManageLiveSessions(course, req.user)) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }
  return course;
}

async function list(req, res) {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  if (req.query.courseId) {
    const course = await getCourseForUser(req.query.courseId, req.user);
    if (!course) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    q.courseId = req.query.courseId;
  } else {
    const cq = courseListQueryForUser(req.user);
    if (cq === null) {
      res.json({ items: [] });
      return;
    }
    if (Object.keys(cq).length > 0) {
      const courses = await Course.find(cq).select('_id').lean();
      const ids = courses.map((c) => c._id);
      if (!ids.length) {
        res.json({ items: [] });
        return;
      }
      q.courseId = { $in: ids };
    }
  }
  const items = await LiveSession.find(q)
    .sort({ scheduledAt: -1 })
    .limit(100)
    .populate('courseId', 'title status')
    .populate('hostId', 'name email')
    .lean();
  res.json({ items });
}

async function create(req, res) {
  const { courseId, title, description, scheduledAt, durationMinutes, maxParticipants, recordingEnabled, autoPublishRecording } =
    req.body;
  if (!courseId || !title || !scheduledAt) {
    res.status(400).json({ error: 'courseId, title, scheduledAt required' });
    return;
  }
  await assertHost(req, courseId);
  let room;
  try {
    room = await vconnect.createRoom({
      title,
      scheduledAt,
      durationMinutes,
      maxParticipants,
      hostUserId: String(req.user._id),
    });
  } catch (e) {
    const sc = Number(e.statusCode);
    const hint404 =
      sc === 404
        ? ' V-Connect returned 404 — set VCONNECT_API_URL=https://v.cloudapi.vconnct.me/api/v4 (include /api/v4, not only the hostname).'
        : '';
    const err = new Error((e.message || 'V-Connect request failed') + hint404);
    if (sc === 401 || sc === 403) err.status = sc;
    else if (sc === 400) err.status = 400;
    else err.status = 502;
    throw err;
  }
  const session = await LiveSession.create({
    courseId,
    hostId: req.user._id,
    title,
    description,
    scheduledAt,
    durationMinutes: durationMinutes || 60,
    maxParticipants: maxParticipants || 100,
    status: 'scheduled',
    vConnectRoomId: room.roomId,
    hostUrl: room.hostUrl,
    participantUrl: room.participantUrl,
    recordingEnabled: Boolean(recordingEnabled),
    autoPublishRecording: Boolean(autoPublishRecording),
  });
  try {
    const cRow = await Course.findById(courseId).select('title enrolledStudentIds').lean();
    if (cRow) {
      const ct = cRow.title || 'Your class';
      const ids = (cRow.enrolledStudentIds || []).map((id) => String(id)).slice(0, 2000);
      if (ids.length) {
        const rows = ids.map((uid) => ({
          userId: uid,
          type: NT.LIVE_SESSION_SCHEDULED,
          title: `Live session: ${title}`,
          body: `${ct} — a session was scheduled. Open Live to see details.`,
          href: `/student/classes/${courseId}?tab=live`,
          meta: { courseId: String(courseId), sessionId: String(session._id) },
        }));
        await createInAppNotificationsMany(rows);
      }
    }
  } catch (e) {
    console.warn('[liveSession.create] notify:', e.message);
  }
  try {
    const cStaff = await Course.findById(courseId).select('title').lean();
    const ctStaff = cStaff?.title || 'Course';
    await notifyCourseTeamExceptActor(courseId, req.user._id, {
      type: NT.DASHBOARD_ACTIVITY,
      title: 'Live session scheduled',
      body: `${actorLabel(req.user)} scheduled “${title}” (${ctStaff}).`,
      href: '/staff/live',
      meta: { sessionId: String(session._id), courseId: String(courseId) },
    });
  } catch (e) {
    console.warn('[liveSession.create] team notify:', e.message);
  }
  try {
    await getQueues().scheduled.add('session_reminders', { sessionId: String(session._id) }, { delay: 60_000 });
  } catch (e) {
    console.warn('[liveSession.create] reminder queue skipped:', e.message);
  }
  const populated = await LiveSession.findById(session._id)
    .populate('courseId', 'title status')
    .populate('hostId', 'name email')
    .lean();
  res.status(201).json({ session: populated });
}

async function getOne(req, res) {
  const s = await LiveSession.findById(req.params.id).lean();
  if (!s) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const course = await getCourseForUser(s.courseId, req.user);
  if (!course) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const status = await vconnect.getRoom(s.vConnectRoomId);
  res.json({ session: s, vconnect: status });
}

async function update(req, res) {
  const s = await LiveSession.findById(req.params.id);
  if (!s) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await assertHost(req, s.courseId);
  Object.assign(s, req.body);
  await s.save();
  await vconnect.updateRoom(s.vConnectRoomId, req.body);
  notifyCourseTeamExceptActor(String(s.courseId), req.user._id, {
    type: NT.DASHBOARD_ACTIVITY,
    title: 'Live session updated',
    body: `${actorLabel(req.user)} updated a live session (“${s.title}”).`,
    href: '/staff/live',
    meta: { sessionId: String(s._id), courseId: String(s.courseId) },
  }).catch((e) => console.warn('[liveSession.update] team notify:', e.message));
  res.json({ session: s });
}

async function remove(req, res) {
  const s = await LiveSession.findById(req.params.id);
  if (!s) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await assertHost(req, s.courseId);
  const sid = String(s._id);
  const cid = String(s.courseId);
  const ttl = s.title;
  s.status = 'cancelled';
  await s.save();
  await vconnect.deleteRoom(s.vConnectRoomId);
  notifyCourseTeamExceptActor(cid, req.user._id, {
    type: NT.DASHBOARD_ACTIVITY,
    title: 'Live session cancelled',
    body: `${actorLabel(req.user)} cancelled “${ttl}”.`,
    href: '/staff/live',
    meta: { sessionId: sid, courseId: cid },
  }).catch((e) => console.warn('[liveSession.remove] team notify:', e.message));
  res.json({ session: s });
}

async function join(req, res) {
  const s = await LiveSession.findById(req.params.id);
  if (!s) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const course = await getCourseForUser(s.courseId, req.user);
  if (!course) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  let role = 'participant';
  if (['instructor', 'teacher', 'doctor'].includes(req.user.role)) {
    role = 'host';
  } else if (req.user.role === 'assistant') {
    role = canManageLiveSessions(course, req.user) ? 'host' : 'participant';
  }
  if (role === 'participant') {
    if (req.user.role !== 'student') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const agent = await AgentSession.findOne({ studentId: req.user._id, status: 'active' }).lean();
    if (!agent) {
      res.status(403).json({ error: 'Security Agent required' });
      return;
    }
  }
  const token = await vconnect.participantToken(s.vConnectRoomId, {
    displayName: req.user.name || 'User',
    role,
  });
  res.json({ joinToken: token.joinToken, role });
}

async function recordingWebhook(req, res) {
  const { roomId, recordingUrl } = req.body || {};
  if (!roomId) {
    res.status(400).end();
    return;
  }
  const session = await LiveSession.findOne({ vConnectRoomId: roomId });
  if (!session) {
    res.status(404).end();
    return;
  }
  session.recordingUrl = recordingUrl;
  session.status = 'completed';
  await session.save();
  res.json({ ok: true });
}

module.exports = { list, create, getOne, update, remove, join, recordingWebhook };
