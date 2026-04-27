const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

function leanAgent(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    studentId: row.studentId,
    deviceFingerprint: row.deviceFingerprint,
    sessionToken: row.sessionToken,
    activeVideoId: row.activeVideoId,
    threats: row.threats || [],
    heartbeatAt: row.heartbeatAt,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function sessionDocFromRow(row) {
  const full = { ...row, threats: Array.isArray(row.threats) ? [...row.threats] : [] };
  return new Proxy(
    {
      get _id() {
        return full.id;
      },
      get sessionToken() {
        return full.sessionToken;
      },
      async save() {
        await getPrisma().agentSession.update({
          where: { id: full.id },
          data: {
            heartbeatAt: full.heartbeatAt,
            activeVideoId: full.activeVideoId,
            threats: full.threats,
            status: full.status,
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

async function create(data) {
  const row = await getPrisma().agentSession.create({
    data: {
      studentId: asUuid(data.studentId),
      deviceFingerprint: data.deviceFingerprint,
      sessionToken: data.sessionToken,
      activeVideoId: data.activeVideoId,
      threats: data.threats || [],
      heartbeatAt: data.heartbeatAt,
      status: data.status || 'active',
    },
  });
  return sessionDocFromRow(row);
}

function findOne(filter) {
  return createFindChain(async (state) => {
    const where = {};
    if (filter.studentId) where.studentId = asUuid(filter.studentId);
    if (filter.status) where.status = filter.status;
    if (filter.sessionToken) where.sessionToken = filter.sessionToken;
    const row = await getPrisma().agentSession.findFirst({ where });
    if (!row) return null;
    if (state.lean) return leanAgent(row);
    return sessionDocFromRow(row);
  });
}

async function updateOne(filter, update) {
  const p = getPrisma();
  const where = {};
  if (filter.sessionToken) where.sessionToken = filter.sessionToken;
  if (filter.studentId) where.studentId = asUuid(filter.studentId);
  if (filter.status) where.status = filter.status;

  if (update.$push && update.$push.threats) {
    const row = await p.agentSession.findFirst({ where });
    if (!row) return { modifiedCount: 0 };
    const next = [...(Array.isArray(row.threats) ? row.threats : []), update.$push.threats];
    await p.agentSession.update({ where: { id: row.id }, data: { threats: next } });
    return { modifiedCount: 1 };
  }

  const data = update.$set || {};
  const res = await p.agentSession.updateMany({ where, data });
  return { modifiedCount: res.count };
}

async function updateMany(filter, update) {
  const where = {};
  if (filter.studentId) where.studentId = asUuid(filter.studentId);
  if (filter.sessionToken) where.sessionToken = filter.sessionToken;
  if (filter.status) where.status = filter.status;
  const res = await getPrisma().agentSession.updateMany({
    where,
    data: update.$set || {},
  });
  return { modifiedCount: res.count };
}

module.exports = { create, findOne, updateOne, updateMany };
