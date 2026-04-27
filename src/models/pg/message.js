const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

function leanMessage(row, senderLean) {
  if (!row) return null;
  const base = {
    _id: row.id,
    id: row.id,
    senderId: senderLean || row.senderId,
    receiverId: row.receiverId,
    courseId: row.courseId,
    content: row.content,
    attachmentUrl: row.attachmentUrl,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
  return base;
}

async function populateSender(row, _fields) {
  const u = await getPrisma().user.findUnique({
    where: { id: row.senderId },
    select: { id: true, name: true, role: true, email: true },
  });
  if (!u) return { _id: row.senderId, id: row.senderId };
  const o = { _id: u.id, id: u.id, name: u.name, role: u.role, email: u.email };
  return o;
}

function find(filter) {
  return createFindChain(async (state) => {
    const where = {};
    if (filter.courseId) {
      if (filter.courseId.$in) where.courseId = { in: filter.courseId.$in.map((x) => asUuid(x)).filter(Boolean) };
      else where.courseId = asUuid(filter.courseId);
    }
    if (filter._id && filter._id.$lt) {
      const cid = asUuid(String(filter._id.$lt));
      if (cid) where.id = { lt: cid };
    }
    const orderBy = state.sortObj && state.sortObj.createdAt === -1 ? { createdAt: 'desc' } : { createdAt: 'desc' };
    const take = state.limitN ?? undefined;
    const rows = await getPrisma().message.findMany({ where, orderBy, take });
    const p = getPrisma();
    const pops = state.populates || [];
    const out = [];
    for (const r of rows) {
      let senderLean;
      let courseLean;
      for (const { path, select } of pops) {
        if (path === 'senderId') {
          senderLean = await populateSender(r, select);
        }
        if (path === 'courseId') {
          const c = await p.course.findUnique({
            where: { id: r.courseId },
            select: { id: true, title: true },
          });
          courseLean = c ? { _id: c.id, title: c.title } : { _id: r.courseId };
        }
      }
      let o = leanMessage(r, senderLean);
      if (courseLean) o.courseId = courseLean;
      out.push(state.lean ? o : r);
    }
    return out;
  });
}

async function create(data) {
  const row = await getPrisma().message.create({
    data: {
      senderId: asUuid(data.senderId),
      receiverId: data.receiverId ? asUuid(data.receiverId) : null,
      courseId: asUuid(data.courseId),
      content: data.content,
      attachmentUrl: data.attachmentUrl,
    },
  });
  return messageDocFromRow(row);
}

function messageDocFromRow(row) {
  const full = { ...row };
  return {
    _id: full.id,
    get id() {
      return full.id;
    },
    async populate() {
      full._sender = await populateSender(full);
      return this;
    },
    toObject() {
      return leanMessage(full, full._sender);
    },
  };
}

async function updateMany(filter, update) {
  const where = { courseId: asUuid(filter.courseId) };
  if (filter.senderId && filter.senderId.$ne) {
    where.senderId = { not: asUuid(filter.senderId.$ne) };
  }
  if (filter.$or) {
    where.OR = [{ readAt: null }, { readAt: { equals: null } }];
  }
  const data = {};
  if (update.$set && update.$set.readAt) data.readAt = update.$set.readAt;
  const res = await getPrisma().message.updateMany({ where, data });
  return { modifiedCount: res.count };
}

async function aggregate(pipeline) {
  const m0 = pipeline[0];
  if (m0 && m0.$match && m0.$match.courseId && m0.$match.courseId.$in) {
    const uuids = m0.$match.courseId.$in.map((x) => asUuid(x)).filter(Boolean);
    const rows = await getPrisma().message.findMany({
      where: { courseId: { in: uuids } },
      orderBy: { createdAt: 'desc' },
    });
    const totals = new Map();
    for (const r of rows) {
      const c = String(r.courseId);
      totals.set(c, (totals.get(c) || 0) + 1);
    }
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      const c = String(r.courseId);
      if (seen.has(c)) continue;
      seen.add(c);
      out.push({
        _id: r.courseId,
        lastAt: r.createdAt,
        lastContent: r.content,
        total: totals.get(c) || 0,
      });
    }
    return out;
  }
  if (m0 && m0.$match && m0.$match.courseId && m0.$match.courseId.$in && m0.$match.senderId && m0.$match.senderId.$ne) {
    const uuids = m0.$match.courseId.$in.map((x) => asUuid(x)).filter(Boolean);
    const ne = asUuid(m0.$match.senderId.$ne);
    const rows = await getPrisma().message.findMany({
      where: {
        courseId: { in: uuids },
        senderId: { not: ne },
        readAt: null,
      },
      select: { courseId: true },
    });
    const counts = new Map();
    for (const r of rows) {
      const c = String(r.courseId);
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return [...counts.entries()].map(([k, unread]) => ({ _id: k, unread }));
  }
  return [];
}

module.exports = { find, create, updateMany, aggregate };
