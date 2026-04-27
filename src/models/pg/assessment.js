const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

const TYPES = ['quiz', 'exam', 'homework'];

function leanAssessment(row, { withSub } = {}) {
  if (!row) return null;
  const base = {
    _id: row.id,
    id: row.id,
    subLessonId: row.subLessonId,
    courseId: row.courseId,
    label: row.label,
    type: row.type,
    questions: row.questions || [],
    timerMinutes: row.timerMinutes,
    randomiseQuestions: row.randomiseQuestions,
    randomiseOptions: row.randomiseOptions,
    maxAttempts: row.maxAttempts,
    showResultsImmediately: row.showResultsImmediately,
    deadline: row.deadline,
    gradeWeight: row.gradeWeight,
    passingScore: row.passingScore,
    passage: row.passage,
    fileUploadEnabled: row.fileUploadEnabled,
    lateSubmissionAllowed: row.lateSubmissionAllowed,
    published: row.published,
    createdAt: row.createdAt,
  };
  if (withSub && row.subLesson) {
    base.subLessonId = { _id: row.subLesson.id, title: row.subLesson.title };
  }
  return base;
}

function assessmentDocFromRow(row) {
  const full = { ...row };
  const api = {
    _row: full,
    get _id() {
      return full.id;
    },
    get courseId() {
      return full.courseId;
    },
    toJSON() {
      return leanAssessment(full);
    },
    toObject() {
      return leanAssessment(full);
    },
    async deleteOne() {
      await getPrisma().assessment.delete({ where: { id: full.id } });
    },
    async save() {
      await getPrisma().assessment.update({
        where: { id: full.id },
        data: {
          label: full.label,
          type: full.type,
          questions: full.questions === undefined ? undefined : full.questions,
          timerMinutes: full.timerMinutes,
          randomiseQuestions: full.randomiseQuestions,
          randomiseOptions: full.randomiseOptions,
          maxAttempts: full.maxAttempts,
          showResultsImmediately: full.showResultsImmediately,
          deadline: full.deadline,
          gradeWeight: full.gradeWeight,
          passingScore: full.passingScore,
          passage: full.passage,
          fileUploadEnabled: full.fileUploadEnabled,
          lateSubmissionAllowed: full.lateSubmissionAllowed,
          published: full.published,
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
      if (p === '_row' || p === '_id' || p === 'save' || p === 'deleteOne') return false;
      full[p] = v;
      return true;
    },
  });
}

async function findRowById(id, includeSub = false) {
  const aid = asUuid(id);
  if (!aid) return null;
  return getPrisma().assessment.findUnique({
    where: { id: aid },
    include: includeSub ? { subLesson: { select: { id: true, title: true } } } : undefined,
  });
}

function findById(id) {
  return createFindChain(async (state) => {
    const wantSub = (state.populates || []).some((p) => p.path === 'subLessonId');
    const row = await findRowById(id, wantSub);
    if (!row) return null;
    if (state.lean) return leanAssessment(row, { withSub: wantSub });
    return assessmentDocFromRow(row);
  });
}

function find(filter) {
  return createFindChain(async (state) => {
    const where = {};
    if (filter.courseId) {
      if (filter.courseId.$in) where.courseId = { in: filter.courseId.$in.map((x) => asUuid(x)).filter(Boolean) };
      else where.courseId = asUuid(filter.courseId);
    }
    const orderBy = { createdAt: 'desc' };
    const wantSub = (state.populates || []).some((p) => p.path === 'subLessonId');
    const include = wantSub ? { subLesson: { select: { id: true, title: true } } } : undefined;
    const rows = await getPrisma().assessment.findMany({ where, orderBy, include });
    return rows.map((r) => {
      if (state.lean) return leanAssessment(r, { withSub: Boolean(include) });
      return assessmentDocFromRow(r);
    });
  });
}

async function create(data) {
  const row = await getPrisma().assessment.create({
    data: {
      subLessonId: asUuid(data.subLessonId),
      courseId: asUuid(data.courseId),
      label: data.label,
      type: data.type,
      questions: data.questions || [],
      timerMinutes: data.timerMinutes ?? 0,
      randomiseQuestions: Boolean(data.randomiseQuestions),
      randomiseOptions: Boolean(data.randomiseOptions),
      maxAttempts: data.maxAttempts ?? 1,
      showResultsImmediately: data.showResultsImmediately !== false,
      deadline: data.deadline || null,
      gradeWeight: data.gradeWeight ?? 1,
      passingScore: data.passingScore ?? 60,
      passage: data.passage,
      fileUploadEnabled: Boolean(data.fileUploadEnabled),
      lateSubmissionAllowed: Boolean(data.lateSubmissionAllowed),
      published: Boolean(data.published),
    },
  });
  return assessmentDocFromRow(row);
}

async function deleteMany(filter) {
  const where = {};
  if (filter.courseId && filter.courseId.$in) {
    where.courseId = { in: filter.courseId.$in.map((x) => asUuid(x)).filter(Boolean) };
  } else if (filter.courseId) where.courseId = asUuid(filter.courseId);
  const res = await getPrisma().assessment.deleteMany({ where });
  return { deletedCount: res.count };
}

module.exports = { TYPES, findById, find, create, deleteMany };
