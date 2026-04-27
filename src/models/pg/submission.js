const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

function numScore(v) {
  if (v == null) return v;
  if (typeof v === 'object' && v !== null && typeof v.toNumber === 'function') return v.toNumber();
  return Number(v);
}

function leanSubmission(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    studentId: row.studentId,
    assessmentId: row.assessmentId,
    courseId: row.courseId,
    answers: row.answers || [],
    uploadedFiles: row.uploadedFiles || [],
    score: numScore(row.score),
    isPassed: row.isPassed,
    status: row.status,
    gradedBy: row.gradedById,
    gradedById: row.gradedById,
    instructorFeedback: row.instructorFeedback,
    submittedAt: row.submittedAt,
    gradedAt: row.gradedAt,
    isLate: row.isLate,
  };
}

function submissionDocFromRow(row) {
  const full = { ...row };
  const api = {
    _row: full,
    get _id() {
      return full.id;
    },
    toJSON() {
      return leanSubmission(full);
    },
    toObject() {
      return leanSubmission(full);
    },
    async save() {
      await getPrisma().submission.update({
        where: { id: full.id },
        data: {
          answers: full.answers,
          uploadedFiles: full.uploadedFiles,
          score: full.score != null ? Number(full.score) : null,
          isPassed: full.isPassed,
          status: full.status,
          gradedById: full.gradedById ? asUuid(full.gradedById) : full.gradedBy ? asUuid(full.gradedBy) : null,
          instructorFeedback: full.instructorFeedback,
          submittedAt: full.submittedAt,
          gradedAt: full.gradedAt,
          isLate: full.isLate,
        },
      });
    },
  };
  return new Proxy(api, {
    get(t, p) {
      if (p in t || p === '_id') return t[p];
      if (p === 'gradedBy') return full.gradedById;
      if (Object.prototype.hasOwnProperty.call(full, p)) {
        if (p === 'score') return numScore(full.score);
        return full[p];
      }
      return undefined;
    },
    set(_t, p, v) {
      if (p === '_row' || p === '_id' || p === 'save' || p === 'toObject') return false;
      if (p === 'gradedBy') {
        full.gradedById = v;
        return true;
      }
      full[p] = v;
      return true;
    },
  });
}

async function findRowById(id) {
  const sid = asUuid(id);
  if (!sid) return null;
  return getPrisma().submission.findUnique({ where: { id: sid } });
}

function findById(id) {
  return createFindChain(async (state) => {
    const row = await findRowById(id);
    if (!row) return null;
    if (state.lean) return leanSubmission(row);
    return submissionDocFromRow(row);
  });
}

function findOne(filter) {
  return createFindChain(async (state) => {
    const where = {};
    if (filter.studentId) where.studentId = asUuid(filter.studentId);
    if (filter.assessmentId) where.assessmentId = asUuid(filter.assessmentId);
    const orderBy = { submittedAt: 'desc' };
    const row = await getPrisma().submission.findFirst({ where, orderBy });
    if (!row) return null;
    if (state.lean) return leanSubmission(row);
    return submissionDocFromRow(row);
  });
}

function find(filter) {
  return createFindChain(async (state) => {
    const where = {};
    if (filter.studentId) where.studentId = asUuid(filter.studentId);
    if (filter.assessmentId) {
      if (filter.assessmentId.$in) where.assessmentId = { in: filter.assessmentId.$in.map((x) => asUuid(x)).filter(Boolean) };
      else where.assessmentId = asUuid(filter.assessmentId);
    }
    if (filter.courseId) {
      if (filter.courseId.$in) where.courseId = { in: filter.courseId.$in.map((x) => asUuid(x)).filter(Boolean) };
      else where.courseId = asUuid(filter.courseId);
    }
    if (filter.status) {
      if (filter.status.$in) where.status = { in: filter.status.$in };
      else where.status = filter.status;
    }
    if (filter.submittedAt && filter.submittedAt.$ne === null) {
      where.submittedAt = { not: null };
    }
    const orderBy =
      state.sortObj && state.sortObj.submittedAt === -1
        ? { submittedAt: 'desc' }
        : state.sortObj && state.sortObj.createdAt === -1
          ? { submittedAt: 'desc' }
          : { submittedAt: 'desc' };
    const take = state.limitN ?? undefined;
    const rows = await getPrisma().submission.findMany({ where, orderBy, take });
    const p = getPrisma();
    const pop = state.populates || [];
    return Promise.all(
      rows.map(async (r) => {
        let o = leanSubmission(r);
        for (const { path, select } of pop) {
          if (path === 'studentId') {
            const u = await p.user.findUnique({
              where: { id: r.studentId },
              select: { id: true, name: true, role: true, email: true },
            });
            o.studentId = u ? { _id: u.id, name: u.name, role: u.role, email: u.email } : { _id: r.studentId };
          }
          if (path === 'assessmentId') {
            const a = await p.assessment.findUnique({
              where: { id: r.assessmentId },
              select: { id: true, type: true },
            });
            o.assessmentId = a ? { _id: a.id, type: a.type } : { _id: r.assessmentId };
          }
        }
        return state.lean ? o : submissionDocFromRow(r);
      }),
    );
  });
}

async function create(data) {
  const row = await getPrisma().submission.create({
    data: {
      studentId: asUuid(data.studentId),
      assessmentId: asUuid(data.assessmentId),
      courseId: asUuid(data.courseId),
      answers: data.answers || [],
      uploadedFiles: data.uploadedFiles || [],
      score: data.score != null ? Number(data.score) : null,
      isPassed: data.isPassed,
      status: data.status || 'not_started',
      gradedById: data.gradedBy ? asUuid(data.gradedBy) : null,
      instructorFeedback: data.instructorFeedback,
      submittedAt: data.submittedAt || null,
      gradedAt: data.gradedAt || null,
      isLate: Boolean(data.isLate),
    },
  });
  return submissionDocFromRow(row);
}

async function countDocuments(filter) {
  const where = {};
  if (filter.studentId) where.studentId = asUuid(filter.studentId);
  if (filter.assessmentId) where.assessmentId = asUuid(filter.assessmentId);
  if (filter.courseId) {
    if (filter.courseId.$in) where.courseId = { in: filter.courseId.$in.map((x) => asUuid(x)).filter(Boolean) };
    else where.courseId = asUuid(filter.courseId);
  }
  if (filter.status) {
    if (filter.status.$in) where.status = { in: filter.status.$in };
    else where.status = filter.status;
  }
  return getPrisma().submission.count({ where });
}

async function deleteMany(filter) {
  const where = {};
  if (filter.assessmentId) {
    if (filter.assessmentId.$in) where.assessmentId = { in: filter.assessmentId.$in.map((x) => asUuid(x)).filter(Boolean) };
    else where.assessmentId = asUuid(filter.assessmentId);
  }
  const res = await getPrisma().submission.deleteMany({ where });
  return { deletedCount: res.count };
}

async function aggregate(pipeline) {
  const [m1, g1] = pipeline || [];
  if (m1 && m1.$match && g1 && g1.$group && g1.$group._id === '$assessmentId') {
    const match = m1.$match;
    const ids = (match.assessmentId && match.assessmentId.$in) || [];
    const uuids = ids.map((x) => asUuid(x)).filter(Boolean);
    const rows = await getPrisma().submission.findMany({
      where: {
        assessmentId: { in: uuids },
        status: match.status || undefined,
      },
      select: { assessmentId: true, submittedAt: true },
    });
    const map = new Map();
    for (const r of rows) {
      const k = String(r.assessmentId);
      const cur = map.get(k) || { pendingCount: 0, oldest: null };
      cur.pendingCount += 1;
      const t = r.submittedAt ? new Date(r.submittedAt).getTime() : Infinity;
      if (cur.oldest == null || t < cur.oldest) cur.oldest = t;
      map.set(k, cur);
    }
    return [...map.entries()].map(([k, v]) => ({
      _id: k,
      pendingCount: v.pendingCount,
      oldestSubmittedAt: v.oldest != null && v.oldest !== Infinity ? new Date(v.oldest) : null,
    }));
  }
  if (m1 && m1.$match && g1 && g1.$group && g1.$group._id === '$courseId') {
    const match = m1.$match;
    const ids = (match.courseId && match.courseId.$in) || [];
    const uuids = ids.map((x) => asUuid(x)).filter(Boolean);
    const rows = await getPrisma().submission.findMany({
      where: { courseId: { in: uuids }, status: match.status },
      select: { courseId: true },
    });
    const counts = new Map();
    for (const r of rows) {
      const k = String(r.courseId);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return [...counts.entries()].map(([k, n]) => ({ _id: k, pendingCount: n }));
  }
  return [];
}

module.exports = { findById, findOne, find, create, countDocuments, deleteMany, aggregate };
