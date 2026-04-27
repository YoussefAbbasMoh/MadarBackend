const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

const TYPES = ['video', 'pdf', 'doc', 'image'];

function leanSub(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    lessonId: row.lessonId,
    courseId: row.courseId,
    title: row.title,
    description: row.description,
    order: row.order,
    type: row.type,
    cloudinaryAssetId: row.cloudinaryAssetId,
    cloudinaryPublicId: row.cloudinaryPublicId,
    fileUrl: row.fileUrl,
    assessmentId: row.assessmentId,
    published: row.published,
    estimatedMinutes: row.estimatedMinutes,
    createdAt: row.createdAt,
  };
}

function subDocFromRow(row) {
  const full = { ...row };
  const api = {
    _row: full,
    get _id() {
      return full.id;
    },
    toObject() {
      return leanSub(full);
    },
    async save() {
      await getPrisma().subLesson.update({
        where: { id: full.id },
        data: {
          title: full.title,
          description: full.description,
          order: full.order,
          type: full.type,
          cloudinaryAssetId: full.cloudinaryAssetId,
          cloudinaryPublicId: full.cloudinaryPublicId,
          fileUrl: full.fileUrl,
          assessmentId: full.assessmentId ? asUuid(full.assessmentId) : null,
          published: full.published,
          estimatedMinutes: full.estimatedMinutes,
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
  const sid = asUuid(id);
  if (!sid) return null;
  return getPrisma().subLesson.findUnique({ where: { id: sid } });
}

function findById(id) {
  return createFindChain(async (state) => {
    const row = await findRowById(id);
    if (!row) return null;
    if (state.lean) return leanSub(row);
    return subDocFromRow(row);
  });
}

function find(filter) {
  return createFindChain(async (state) => {
    const where = {};
    if (filter.courseId) where.courseId = asUuid(filter.courseId);
    if (filter.lessonId) where.lessonId = asUuid(filter.lessonId);
    if (filter._id && filter._id.$in) where.id = { in: filter._id.$in.map((x) => asUuid(x)).filter(Boolean) };
    const orderBy = state.sortObj && Object.keys(state.sortObj).length
      ? { order: state.sortObj.order === -1 ? 'desc' : 'asc' }
      : { order: 'asc' };
    const rows = await getPrisma().subLesson.findMany({ where, orderBy });
    return rows.map((r) => (state.lean ? leanSub(r) : subDocFromRow(r)));
  });
}

async function create(data) {
  const row = await getPrisma().subLesson.create({
    data: {
      lessonId: asUuid(data.lessonId),
      courseId: asUuid(data.courseId),
      title: data.title,
      description: data.description || '',
      order: data.order ?? 0,
      type: data.type,
      cloudinaryAssetId: data.cloudinaryAssetId,
      cloudinaryPublicId: data.cloudinaryPublicId,
      fileUrl: data.fileUrl,
      assessmentId: data.assessmentId ? asUuid(data.assessmentId) : undefined,
      published: data.published !== false,
      estimatedMinutes: data.estimatedMinutes ?? 0,
    },
  });
  return subDocFromRow(row);
}

async function countDocuments(filter) {
  const where = {};
  if (filter.lessonId) where.lessonId = asUuid(filter.lessonId);
  return getPrisma().subLesson.count({ where });
}

async function deleteMany(filter) {
  const where = {};
  if (filter.courseId) where.courseId = asUuid(filter.courseId);
  if (filter.lessonId) where.lessonId = asUuid(filter.lessonId);
  const res = await getPrisma().subLesson.deleteMany({ where });
  return { deletedCount: res.count };
}

async function updateMany(filter, update) {
  if (filter.assessmentId && update.$unset && update.$unset.assessmentId) {
    const aid = asUuid(filter.assessmentId);
    if (!aid) return { modifiedCount: 0 };
    const res = await getPrisma().subLesson.updateMany({
      where: { assessmentId: aid },
      data: { assessmentId: null },
    });
    return { modifiedCount: res.count };
  }
  return { modifiedCount: 0 };
}

module.exports = { TYPES, findById, find, create, countDocuments, deleteMany, updateMany };
