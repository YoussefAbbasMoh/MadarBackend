const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

function leanLesson(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    order: row.order,
    description: row.description,
    published: row.published,
    subLessonIds: row.subLessonIds || [],
    createdAt: row.createdAt,
  };
}

function lessonDocFromRow(row) {
  const full = { ...row };
  const api = {
    _row: full,
    get _id() {
      return full.id;
    },
    toObject() {
      return leanLesson(full);
    },
    async save() {
      await getPrisma().lesson.update({
        where: { id: full.id },
        data: {
          title: full.title,
          order: full.order,
          description: full.description,
          published: full.published,
          subLessonIds: (full.subLessonIds || []).map((x) => asUuid(x)).filter(Boolean),
        },
      });
    },
  };
  return new Proxy(api, {
    get(t, p) {
      if (p in t || p === '_id') return t[p];
      if (Object.prototype.hasOwnProperty.call(full, p)) return full[p];
      return undefined;
    },
    set(_t, p, v) {
      if (p === '_row' || p === '_id' || p === 'save' || p === 'toObject') return false;
      full[p] = v;
      return true;
    },
  });
}

async function findRowById(id) {
  const lid = asUuid(id);
  if (!lid) return null;
  return getPrisma().lesson.findUnique({ where: { id: lid } });
}

function findById(id) {
  return createFindChain(async (state) => {
    const row = await findRowById(id);
    if (!row) return null;
    if (state.lean) return leanLesson(row);
    return lessonDocFromRow(row);
  });
}

function find(filter) {
  return createFindChain(async (state) => {
    const where = {};
    if (filter.courseId) where.courseId = asUuid(filter.courseId);
    const orderBy = state.sortObj && Object.keys(state.sortObj).length
      ? { order: state.sortObj.order === -1 ? 'desc' : 'asc' }
      : { order: 'asc' };
    const rows = await getPrisma().lesson.findMany({ where, orderBy });
    return rows.map((r) => (state.lean ? leanLesson(r) : lessonDocFromRow(r)));
  });
}

async function create(data) {
  const row = await getPrisma().lesson.create({
    data: {
      courseId: asUuid(data.courseId),
      title: data.title,
      order: data.order ?? 0,
      description: data.description,
      published: data.published !== false,
      subLessonIds: (data.subLessonIds || []).map((x) => asUuid(x)).filter(Boolean),
    },
  });
  return lessonDocFromRow(row);
}

async function countDocuments(filter) {
  const where = {};
  if (filter.courseId) where.courseId = asUuid(filter.courseId);
  if (filter.lessonId) where.id = asUuid(filter.lessonId);
  return getPrisma().lesson.count({ where });
}

async function deleteMany(filter) {
  const where = {};
  if (filter.courseId) where.courseId = asUuid(filter.courseId);
  const res = await getPrisma().lesson.deleteMany({ where });
  return { deletedCount: res.count };
}

async function aggregate(pipeline) {
  const [m1, g1] = pipeline || [];
  if (m1 && m1.$match && m1.$match.courseId && m1.$match.courseId.$in && g1 && g1.$group && g1.$group._id === '$courseId') {
    const ids = m1.$match.courseId.$in.map((x) => asUuid(x)).filter(Boolean);
    const rows = await getPrisma().lesson.groupBy({
      by: ['courseId'],
      where: { courseId: { in: ids } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ _id: r.courseId, lessonCount: r._count._all }));
  }
  return [];
}

async function updateOne(filter, update) {
  const lid = filter._id != null ? asUuid(filter._id) : null;
  if (!lid || !update.$pull || !update.$pull.subLessonIds) return { matchedCount: 0 };
  const sid = asUuid(update.$pull.subLessonIds);
  const cur = await getPrisma().lesson.findUnique({ where: { id: lid }, select: { subLessonIds: true } });
  const next = (cur.subLessonIds || []).filter((x) => String(x) !== String(sid));
  await getPrisma().lesson.update({ where: { id: lid }, data: { subLessonIds: next } });
  return { matchedCount: 1 };
}

module.exports = { findById, find, create, countDocuments, deleteMany, updateOne, aggregate };
