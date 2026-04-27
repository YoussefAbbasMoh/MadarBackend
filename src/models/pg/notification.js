const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

function leanN(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.userId,
    type: row.type,
    payload: row.payload || {},
    channel: row.channel || [],
    status: row.status,
    createdAt: row.createdAt,
  };
}

async function create(data) {
  return getPrisma().notification.create({
    data: {
      userId: asUuid(data.userId),
      type: data.type,
      payload: data.payload || {},
      channel: data.channel || [],
      status: data.status || 'queued',
    },
  });
}

async function insertMany(docs) {
  const p = getPrisma();
  let n = 0;
  for (const d of docs) {
    await p.notification.create({
      data: {
        userId: asUuid(d.userId),
        type: d.type,
        payload: d.payload || {},
        channel: d.channel || [],
        status: d.status || 'queued',
      },
    });
    n += 1;
  }
  return { insertedCount: n };
}

function find(filter) {
  return createFindChain(async (state) => {
    const where = {};
    if (filter && filter.userId) where.userId = asUuid(filter.userId);
    if (filter.status && filter.status.$ne) where.status = { not: filter.status.$ne };
    if (filter.status && filter.status.$in) where.status = { in: filter.status.$in };
    const orderBy = { createdAt: 'desc' };
    const take = state.limitN ?? undefined;
    const rows = await getPrisma().notification.findMany({ where, orderBy, take });
    return rows.map((r) => (state.lean ? leanN(r) : r));
  });
}

function findOne(filter) {
  return createFindChain(async (state) => {
    const where = { id: asUuid(filter._id), userId: asUuid(filter.userId) };
    const row = await getPrisma().notification.findFirst({ where });
    if (!row) return null;
    return state.lean ? leanN(row) : row;
  });
}

async function countDocuments(filter) {
  const where = {};
  if (filter.userId) where.userId = asUuid(filter.userId);
  if (filter.status) {
    if (filter.status.$in) where.status = { in: filter.status.$in };
    else where.status = filter.status;
  }
  return getPrisma().notification.count({ where });
}

async function updateOne(filter, update) {
  const id = asUuid(filter._id);
  if (!id) return { matchedCount: 0 };
  await getPrisma().notification.update({
    where: { id },
    data: update.$set || {},
  });
  return { matchedCount: 1 };
}

async function updateMany(filter, update) {
  const where = {};
  if (filter.userId) where.userId = asUuid(filter.userId);
  if (filter.status && filter.status.$ne) where.status = { not: filter.status.$ne };
  const res = await getPrisma().notification.updateMany({
    where,
    data: update.$set || {},
  });
  return { modifiedCount: res.count };
}

module.exports = { create, insertMany, find, findOne, countDocuments, updateOne, updateMany };
