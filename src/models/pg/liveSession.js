const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

function leanSession(row, { courseLean, hostLean } = {}) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    courseId: courseLean || row.courseId,
    hostId: hostLean || row.hostId,
    title: row.title,
    description: row.description,
    scheduledAt: row.scheduledAt,
    durationMinutes: row.durationMinutes,
    maxParticipants: row.maxParticipants,
    status: row.status,
    vConnectRoomId: row.vConnectRoomId,
    hostUrl: row.hostUrl,
    participantUrl: row.participantUrl,
    recordingEnabled: row.recordingEnabled,
    autoPublishRecording: row.autoPublishRecording,
    recordingUrl: row.recordingUrl,
    remindersSent: row.remindersSent || [],
    recurring: row.recurring,
    createdAt: row.createdAt,
  };
}

function find(filter) {
  return createFindChain(async (state) => {
    const where = {};
    if (filter.courseId) {
      if (filter.courseId.$in) where.courseId = { in: filter.courseId.$in.map((x) => asUuid(x)).filter(Boolean) };
      else where.courseId = asUuid(filter.courseId);
    }
    if (filter.status) where.status = filter.status;
    if (filter.scheduledAt) {
      if (filter.scheduledAt.$gte) where.scheduledAt = { ...where.scheduledAt, gte: filter.scheduledAt.$gte };
      if (filter.scheduledAt.$lte) where.scheduledAt = { ...where.scheduledAt, lte: filter.scheduledAt.$lte };
    }
    const orderBy =
      state.sortObj && state.sortObj.scheduledAt === -1
        ? { scheduledAt: 'desc' }
        : state.sortObj && state.sortObj.createdAt === -1
          ? { createdAt: 'desc' }
          : { scheduledAt: 'desc' };
    const take = state.limitN ?? undefined;
    const rows = await getPrisma().liveSession.findMany({ where, orderBy, take });
    const p = getPrisma();
    const pops = state.populates || [];
    const wantCourse = pops.some((x) => x.path === 'courseId');
    const wantHost = pops.some((x) => x.path === 'hostId');
    const out = [];
    for (const r of rows) {
      let courseLean;
      let hostLean;
      if (wantCourse) {
        const c = await p.course.findUnique({
          where: { id: r.courseId },
          select: { id: true, title: true, status: true },
        });
        courseLean = c ? { _id: c.id, title: c.title, status: c.status } : { _id: r.courseId };
      }
      if (wantHost) {
        const u = await p.user.findUnique({ where: { id: r.hostId }, select: { id: true, name: true, email: true } });
        hostLean = u ? { _id: u.id, name: u.name, email: u.email } : { _id: r.hostId };
      }
      out.push(state.lean ? leanSession(r, { courseLean, hostLean }) : sessionDocFromRow(r));
    }
    return out;
  });
}

async function findRowById(id) {
  const lid = asUuid(id);
  if (!lid) return null;
  return getPrisma().liveSession.findUnique({ where: { id: lid } });
}

function findById(id) {
  return createFindChain(async (state) => {
    const row = await findRowById(id);
    if (!row) return null;
    const pops = state.populates || [];
    const wantCourse = pops.some((x) => x.path === 'courseId');
    const wantHost = pops.some((x) => x.path === 'hostId');
    let courseLean;
    let hostLean;
    if (wantCourse) {
      const c = await getPrisma().course.findUnique({
        where: { id: row.courseId },
        select: { id: true, title: true, status: true },
      });
      courseLean = c ? { _id: c.id, title: c.title, status: c.status } : { _id: row.courseId };
    }
    if (wantHost) {
      const u = await getPrisma().user.findUnique({ where: { id: row.hostId }, select: { id: true, name: true, email: true } });
      hostLean = u ? { _id: u.id, name: u.name, email: u.email } : { _id: row.hostId };
    }
    if (state.lean) return leanSession(row, { courseLean, hostLean });
    return sessionDocFromRow(row);
  });
}

function sessionDocFromRow(row) {
  const full = { ...row };
  return new Proxy(
    {
      get _id() {
        return full.id;
      },
      async save() {
        await getPrisma().liveSession.update({
          where: { id: full.id },
          data: {
            title: full.title,
            description: full.description,
            scheduledAt: full.scheduledAt,
            durationMinutes: full.durationMinutes,
            maxParticipants: full.maxParticipants,
            status: full.status,
            vConnectRoomId: full.vConnectRoomId,
            hostUrl: full.hostUrl,
            participantUrl: full.participantUrl,
            recordingEnabled: full.recordingEnabled,
            autoPublishRecording: full.autoPublishRecording,
            recordingUrl: full.recordingUrl,
            remindersSent: full.remindersSent,
            recurring: full.recurring,
          },
        });
      },
    },
    {
      get(t, p) {
        if (p in t) return t[p];
        return full[p];
      },
      set(_t, p, v) {
        full[p] = v;
        return true;
      },
    },
  );
}

async function countDocuments(filter) {
  const where = {};
  if (filter.courseId && filter.courseId.$in) {
    where.courseId = { in: filter.courseId.$in.map((x) => asUuid(x)).filter(Boolean) };
  }
  if (filter.status) where.status = filter.status;
  if (filter.scheduledAt) {
    if (filter.scheduledAt.$gte) where.scheduledAt = { ...where.scheduledAt, gte: filter.scheduledAt.$gte };
    if (filter.scheduledAt.$lte) where.scheduledAt = { ...where.scheduledAt, lte: filter.scheduledAt.$lte };
  }
  return getPrisma().liveSession.count({ where });
}

async function create(data) {
  const row = await getPrisma().liveSession.create({
    data: {
      courseId: asUuid(data.courseId),
      hostId: asUuid(data.hostId),
      title: data.title,
      description: data.description,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes ?? 60,
      maxParticipants: data.maxParticipants ?? 100,
      status: data.status || 'scheduled',
      vConnectRoomId: data.vConnectRoomId,
      hostUrl: data.hostUrl,
      participantUrl: data.participantUrl,
      recordingEnabled: Boolean(data.recordingEnabled),
      autoPublishRecording: Boolean(data.autoPublishRecording),
      recordingUrl: data.recordingUrl,
      remindersSent: data.remindersSent || [],
      recurring: data.recurring,
    },
  });
  return sessionDocFromRow(row);
}

function findOne(filter) {
  return createFindChain(async (state) => {
    const where = {};
    if (filter.vConnectRoomId) where.vConnectRoomId = filter.vConnectRoomId;
    const row = await getPrisma().liveSession.findFirst({ where });
    if (!row) return null;
    if (state.lean) return leanSession(row);
    return sessionDocFromRow(row);
  });
}

module.exports = { find, findById, findOne, countDocuments, create };
