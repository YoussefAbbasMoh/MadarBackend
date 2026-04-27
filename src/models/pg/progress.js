const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

function leanProgress(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    studentId: row.studentId,
    courseId: row.courseId,
    completedSubLessons: row.completedSubLessonIds || [],
    completedSubLessonIds: row.completedSubLessonIds || [],
    lastAccessedAt: row.lastAccessedAt,
    overallPercent: row.overallPercent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function find(filter) {
  return createFindChain(async (state) => {
    const where = {};
    if (filter.studentId) where.studentId = asUuid(filter.studentId);
    if (filter.courseId) {
      if (filter.courseId.$in) where.courseId = { in: filter.courseId.$in.map((x) => asUuid(x)).filter(Boolean) };
      else where.courseId = asUuid(filter.courseId);
    }
    const rows = await getPrisma().progress.findMany({ where });
    return rows.map((r) => (state.lean ? leanProgress(r) : r));
  });
}

async function countDocuments(filter) {
  const where = {};
  if (filter.courseId) {
    if (filter.courseId.$in) where.courseId = { in: filter.courseId.$in.map((x) => asUuid(x)).filter(Boolean) };
    else where.courseId = asUuid(filter.courseId);
  }
  if (filter.createdAt) {
    if (filter.createdAt.$gte) where.createdAt = { ...where.createdAt, gte: filter.createdAt.$gte };
    if (filter.createdAt.$lte) where.createdAt = { ...where.createdAt, lte: filter.createdAt.$lte };
  }
  if (filter.updatedAt && filter.updatedAt.$gte) {
    where.updatedAt = { gte: filter.updatedAt.$gte };
  }
  if (filter.completedSubLessons && filter.completedSubLessons.$exists) {
    where.completedSubLessonIds = { isEmpty: false };
  }
  return getPrisma().progress.count({ where });
}

async function deleteMany(filter) {
  const where = {};
  if (filter.courseId && filter.courseId.$in) {
    where.courseId = { in: filter.courseId.$in.map((x) => asUuid(x)).filter(Boolean) };
  }
  const res = await getPrisma().progress.deleteMany({ where });
  return { deletedCount: res.count };
}

async function findOneAndUpdate(filter, update, _opts) {
  const sid = asUuid(filter.studentId);
  const cid = asUuid(filter.courseId);
  if (!sid || !cid) return null;
  const insert = update.$setOnInsert || {};
  const row = await getPrisma().progress.upsert({
    where: { studentId_courseId: { studentId: sid, courseId: cid } },
    create: {
      studentId: sid,
      courseId: cid,
      completedSubLessonIds: insert.completedSubLessons || insert.completedSubLessonIds || [],
      overallPercent: insert.overallPercent ?? 0,
    },
    update: {},
  });
  return leanProgress(row);
}

async function aggregate(pipeline) {
  const [m1, g1] = pipeline || [];
  if (m1 && m1.$match && g1 && g1.$group) {
    const match = m1.$match;
    const ids = (match.courseId && match.courseId.$in) || [];
    const uuids = ids.map((x) => asUuid(x)).filter(Boolean);
    const where = { courseId: { in: uuids } };
    if (match.createdAt) {
      if (match.createdAt.$gte) where.createdAt = { gte: match.createdAt.$gte };
      if (match.createdAt.$lte) where.createdAt = { ...where.createdAt, lte: match.createdAt.$lte };
    }
    if (match.updatedAt && match.updatedAt.$gte) {
      where.updatedAt = { gte: match.updatedAt.$gte };
    }
    const rows = await getPrisma().progress.findMany({
      where,
      select: { createdAt: true, updatedAt: true, overallPercent: true, completedSubLessonIds: true },
    });
    if (g1.$group && g1.$group._id && g1.$group._id.y !== undefined) {
      const map = new Map();
      const dateField = match.updatedAt ? 'updatedAt' : 'createdAt';
      for (const r of rows) {
        const d = r[dateField];
        if (!d) continue;
        const dt = new Date(d);
        const key = `${dt.getFullYear()}-${dt.getMonth() + 1}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
      return [...map.entries()].map(([k, n]) => {
        const [y, m] = k.split('-').map(Number);
        return { _id: { y, m }, n };
      });
    }
    if (g1.$group && g1.$group._id === null && g1.$group.avg) {
      if (!rows.length) return [];
      const avg = rows.reduce((s, r) => s + (Number(r.overallPercent) || 0), 0) / rows.length;
      return [{ _id: null, avg }];
    }
    if (g1.$unwind && g1.$group && g1.$group._id) {
      const counts = new Map();
      for (const r of rows) {
        for (const sid of r.completedSubLessonIds || []) {
          counts.set(String(sid), (counts.get(String(sid)) || 0) + 1);
        }
      }
      return [...counts.entries()].map(([k, v]) => ({ _id: k, completionCount: v }));
    }
  }
  return [];
}

module.exports = { find, countDocuments, deleteMany, findOneAndUpdate, aggregate };
