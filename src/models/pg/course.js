const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

const STATUSES = ['draft', 'active', 'archived'];

function numPrice(v) {
  if (v == null) return 0;
  if (typeof v === 'object' && v !== null && typeof v.toNumber === 'function') return v.toNumber();
  return Number(v);
}

function leanCourse(row) {
  if (!row) return null;
  const enroll = row.enrollments || [];
  const asst = row.assistants || [];
  return {
    _id: row.id,
    id: row.id,
    tenantId: row.tenantId,
    kind: row.kind,
    ownerId: row.ownerId,
    ownerRole: row.ownerRole,
    title: row.title,
    category: row.category,
    description: row.description,
    coverImage: row.coverImage,
    galleryImages: row.galleryImages || [],
    passingScoreDefault: row.passingScoreDefault,
    language: row.language || [],
    maxStudents: row.maxStudents,
    certificateEnabled: row.certificateEnabled,
    price: numPrice(row.price),
    currency: row.currency,
    status: row.status,
    packageIds: row.packageIds || [],
    lessonIds: row.lessonIds || [],
    assistants: asst.map((a) => ({ userId: a.userId, permissions: a.permissions || [] })),
    enrolledStudentIds: enroll.map((e) => e.studentId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const courseInclude = () => ({
  enrollments: { select: { studentId: true } },
  assistants: true,
});

function courseDocFromRow(row) {
  const full = { ...row, enrollments: row.enrollments || [], assistants: row.assistants || [] };
  const api = {
    _row: full,
    get _id() {
      return full.id;
    },
    get id() {
      return full.id;
    },
    get assistants() {
      return (full.assistants || []).map((a) => ({ userId: a.userId, permissions: a.permissions || [] }));
    },
    get enrolledStudentIds() {
      return (full.enrollments || []).map((e) => e.studentId);
    },
    toObject() {
      return leanCourse({ ...full, enrollments: full.enrollments, assistants: full.assistants });
    },
    async save() {
      const p = getPrisma();
      await p.course.update({
        where: { id: full.id },
        data: {
          title: full.title,
          kind: full.kind,
          ownerRole: full.ownerRole,
          category: full.category,
          description: full.description,
          coverImage: full.coverImage,
          galleryImages: full.galleryImages,
          passingScoreDefault: full.passingScoreDefault,
          language: full.language,
          maxStudents: full.maxStudents,
          certificateEnabled: full.certificateEnabled,
          price: Number(full.price) || 0,
          currency: full.currency,
          status: full.status,
          packageIds: (full.packageIds || []).map((x) => asUuid(x)).filter(Boolean),
          lessonIds: (full.lessonIds || []).map((x) => asUuid(x)).filter(Boolean),
        },
      });
    },
  };
  return new Proxy(api, {
    get(t, p) {
      if (p in t || p === '_id') return t[p];
      if (p === 'ownerId' || p === 'ownerRole') return full[p];
      if (p === 'price') return numPrice(full.price);
      if (Object.prototype.hasOwnProperty.call(full, p)) return full[p];
      return undefined;
    },
    set(_t, p, v) {
      if (p === '_row' || p === '_id' || p === 'save' || p === 'toObject' || p === 'assistants' || p === 'enrolledStudentIds') {
        return false;
      }
      full[p] = v;
      return true;
    },
  });
}

function courseWhereFromMongoFilter(q) {
  if (!q || !Object.keys(q).length) return {};
  if (q.$or) {
    return { OR: q.$or.map((part) => courseWhereFromMongoFilter(part)) };
  }
  const parts = [];
  if (q.status != null) parts.push({ status: q.status });
  if (q.ownerId != null) {
    const u = asUuid(q.ownerId);
    if (u) parts.push({ ownerId: u });
  }
  if (q._id != null) {
    if (q._id.$in) {
      const ids = q._id.$in.map((x) => asUuid(x)).filter(Boolean);
      if (ids.length) parts.push({ id: { in: ids } });
    } else {
      const u = asUuid(q._id);
      if (u) parts.push({ id: u });
    }
  }
  if (q.courseId != null) {
    const u = asUuid(q.courseId);
    if (u) parts.push({ id: u });
  }
  if (q.enrolledStudentIds != null) {
    const sid = asUuid(q.enrolledStudentIds);
    if (sid) parts.push({ enrollments: { some: { studentId: sid } } });
  }
  const assistantUserKey = q['assistants.userId'];
  if (assistantUserKey != null) {
    const aid = asUuid(assistantUserKey);
    if (aid) parts.push({ assistants: { some: { userId: aid } } });
  }
  if (!parts.length) return {};
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}

/** Maps visibility query from {@link courseListQueryForUser} (Mongo shape) to Prisma where. */
function courseWhereFromListQuery(q) {
  return courseWhereFromMongoFilter(q);
}

async function findRowById(id) {
  const cid = asUuid(id);
  if (!cid) return null;
  return getPrisma().course.findUnique({
    where: { id: cid },
    include: courseInclude(),
  });
}

function findById(id) {
  return createFindChain(async (state) => {
    const row = await findRowById(id);
    if (!row) return null;
    if (state.lean) {
      const o = leanCourse(row);
      return applyCourseSelect(o, state.selectStr);
    }
    return courseDocFromRow(row);
  });
}

function applyCourseSelect(obj, sel) {
  if (!obj || !sel) return obj;
  const fields = String(sel)
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!fields.length) return obj;
  const out = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(obj, f)) out[f] = obj[f];
  }
  out._id = obj._id;
  return out;
}

function findOne(filter) {
  return createFindChain(async (state) => {
    const where = courseWhereFromMongoFilter(filter);
    const row = await getPrisma().course.findFirst({
      where,
      include: courseInclude(),
    });
    if (!row) return null;
    if (state.lean) {
      let o = leanCourse(row);
      o = applyCourseSelect(o, state.selectStr);
      return o;
    }
    return courseDocFromRow(row);
  });
}

function find(filter) {
  return createFindChain(async (state) => {
    const where = courseWhereFromListQuery(filter);
    const orderBy = mongoSortToOrderBy(state.sortObj, { updatedAt: 'desc' });
    const take = state.limitN ?? undefined;
    const rows = await getPrisma().course.findMany({
      where,
      orderBy,
      take,
      include: courseInclude(),
    });
    return rows.map((r) => {
      let o = state.lean ? leanCourse(r) : courseDocFromRow(r);
      if (state.lean && state.selectStr) o = applyCourseSelect(o, state.selectStr);
      return o;
    });
  });
}

function mongoSortToOrderBy(sortObj, fallback) {
  if (!sortObj || !Object.keys(sortObj).length) return fallback;
  const [k, dir] = Object.entries(sortObj)[0];
  const prismaKey = k === '_id' ? 'id' : k;
  return { [prismaKey]: dir === -1 ? 'desc' : 'asc' };
}

async function countDocuments(filter) {
  const where = courseWhereFromMongoFilter(filter);
  return getPrisma().course.count({ where });
}

async function create(data) {
  const p = getPrisma();
  const ownerId = asUuid(data.ownerId);
  if (!ownerId) throw new Error('Invalid ownerId');
  const row = await p.course.create({
    data: {
      ownerId,
      tenantId: data.tenantId ? asUuid(data.tenantId) : undefined,
      kind: data.kind != null ? String(data.kind) : 'classroom',
      ownerRole: data.ownerRole,
      title: data.title,
      category: data.category,
      description: data.description,
      coverImage: data.coverImage,
      galleryImages: data.galleryImages || [],
      passingScoreDefault: data.passingScoreDefault ?? 60,
      language: data.language || [],
      maxStudents: data.maxStudents ?? 0,
      certificateEnabled: Boolean(data.certificateEnabled),
      price: Number(data.price) || 0,
      currency: (data.currency || 'EGP').toString().trim().toUpperCase(),
      status: data.status || 'draft',
      packageIds: (data.packageIds || []).map((x) => asUuid(x)).filter(Boolean),
      lessonIds: (data.lessonIds || []).map((x) => asUuid(x)).filter(Boolean),
    },
    include: courseInclude(),
  });
  return courseDocFromRow(row);
}

async function deleteMany(filter) {
  const ids = filter._id && filter._id.$in ? filter._id.$in.map((x) => asUuid(x)).filter(Boolean) : [];
  if (!ids.length) return { deletedCount: 0 };
  const res = await getPrisma().course.deleteMany({ where: { id: { in: ids } } });
  return { deletedCount: res.count };
}

async function exists(filter) {
  const n = await countDocuments(filter);
  return n > 0;
}

async function distinct(field, filter) {
  if (field !== 'ownerId') return [];
  const where = courseWhereFromMongoFilter(filter || {});
  const rows = await getPrisma().course.findMany({
    where,
    select: { ownerId: true },
    distinct: ['ownerId'],
  });
  return rows.map((r) => r.ownerId);
}

async function aggregate(pipeline) {
  if (!pipeline || !pipeline.length) return [];
  const [match, group] = pipeline;
  if (match && match.$match && group && group.$group && group.$group._id === '$ownerId') {
    const status = match.$match.status;
    const ownerIds = (match.$match.ownerId && match.$match.ownerId.$in) || [];
    const uuids = ownerIds.map((x) => asUuid(x)).filter(Boolean);
    const counts = await getPrisma().course.groupBy({
      by: ['ownerId'],
      where: { status, ownerId: { in: uuids } },
      _count: { _all: true },
    });
    return counts.map((c) => ({ _id: c.ownerId, activeCourseCount: c._count._all }));
  }
  return [];
}

async function updateOne(filter, update) {
  const p = getPrisma();
  const cid = filter._id != null ? asUuid(filter._id) : null;
  if (!cid) return { matchedCount: 0 };

  if (update.$addToSet && update.$addToSet.enrolledStudentIds) {
    const sid = asUuid(update.$addToSet.enrolledStudentIds);
    if (sid) {
      await p.courseEnrollment.upsert({
        where: { courseId_studentId: { courseId: cid, studentId: sid } },
        create: { courseId: cid, studentId: sid },
        update: {},
      });
    }
    return { matchedCount: 1 };
  }

  if (update.$pull && update.$pull.enrolledStudentIds) {
    const sid = asUuid(update.$pull.enrolledStudentIds);
    if (sid) {
      await p.courseEnrollment.deleteMany({ where: { courseId: cid, studentId: sid } });
    }
    return { matchedCount: 1 };
  }

  if (update.$push && update.$push.assistants) {
    const a = update.$push.assistants;
    const uid = asUuid(a.userId);
    if (uid) {
      await p.courseAssistant.upsert({
        where: { courseId_userId: { courseId: cid, userId: uid } },
        create: { courseId: cid, userId: uid, permissions: a.permissions || [] },
        update: { permissions: a.permissions || [] },
      });
    }
    return { matchedCount: 1 };
  }

  if (update.$pull && update.$pull.assistants) {
    const uid = asUuid(update.$pull.assistants.userId);
    if (uid) {
      await p.courseAssistant.deleteMany({ where: { courseId: cid, userId: uid } });
    }
    return { matchedCount: 1 };
  }

  if (update.$set && update.$set['assistants.$.permissions'] != null) {
    const assistantUserId = filter['assistants.userId'];
    const uid = asUuid(assistantUserId);
    const perms = update.$set['assistants.$.permissions'];
    if (uid && Array.isArray(perms)) {
      const res = await p.courseAssistant.updateMany({
        where: { courseId: cid, userId: uid },
        data: { permissions: perms },
      });
      return { matchedCount: res.count };
    }
    return { matchedCount: 0 };
  }

  if (update.$pull && update.$pull.lessonIds) {
    const lid = asUuid(update.$pull.lessonIds);
    const cur = await p.course.findUnique({ where: { id: cid }, select: { lessonIds: true } });
    const next = (cur.lessonIds || []).filter((x) => String(x) !== String(lid));
    await p.course.update({ where: { id: cid }, data: { lessonIds: next } });
    return { matchedCount: 1 };
  }

  return { matchedCount: 0 };
}

async function findByIdAndUpdate(id, update) {
  const cid = asUuid(id);
  if (!cid) return null;
  const p = getPrisma();
  if (update.$addToSet && update.$addToSet.enrolledStudentIds) {
    const sid = asUuid(update.$addToSet.enrolledStudentIds);
    if (sid) {
      await p.courseEnrollment.upsert({
        where: { courseId_studentId: { courseId: cid, studentId: sid } },
        create: { courseId: cid, studentId: sid },
        update: {},
      });
    }
    return findRowById(cid);
  }
  if (update.$set) {
    const d = { ...update.$set };
    if (d.price != null) d.price = Number(d.price);
    await p.course.update({ where: { id: cid }, data: d });
  }
  return findRowById(cid);
}

async function updateAssistantPermissions(courseId, userId, permissions) {
  const cid = asUuid(courseId);
  const uid = asUuid(userId);
  if (!cid || !uid) return { matchedCount: 0 };
  const res = await getPrisma().courseAssistant.updateMany({
    where: { courseId: cid, userId: uid },
    data: { permissions },
  });
  return { matchedCount: res.count };
}

const Course = {
  STATUSES,
  findById,
  findOne,
  find,
  create,
  countDocuments,
  updateOne,
  deleteMany,
  exists,
  distinct,
  aggregate,
  findByIdAndUpdate,
  updateAssistantPermissions,
};

module.exports = Course;
module.exports.STATUSES = STATUSES;
