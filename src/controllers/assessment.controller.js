const Assessment = require('../models/Assessment');
const Submission = require('../models/Submission');
const SubLesson = require('../models/SubLesson');
const {
  getCourseForUser,
  canEditAssessments,
  canGradeSubmissions,
} = require('../utils/courseAccess');
const Course = require('../models/Course');
const archiver = require('archiver');
const NT = require('../constants/notificationTypes');
const { createInAppNotification, recipientIdsForGradingAlerts } = require('../services/inAppNotify');
const { notifyCourseTeamExceptActor, actorLabel } = require('../services/courseTeamActivity');

function assessmentStaffActivity(req, courseId, title, detail, assessmentId) {
  const href = assessmentId
    ? `/staff/courses/${courseId}/assessments/${assessmentId}`
    : `/staff/courses/${courseId}`;
  notifyCourseTeamExceptActor(courseId, req.user._id, {
    type: NT.DASHBOARD_ACTIVITY,
    title,
    body: `${actorLabel(req.user)} — ${detail}`,
    href,
    meta: { scope: 'assessments', ...(assessmentId ? { assessmentId: String(assessmentId) } : {}) },
  }).catch((e) => console.warn('[assessment] team notify:', e.message));
}

async function assertAssessmentsAuthoring(req, courseId) {
  const course = await Course.findById(courseId);
  if (!course) {
    const e = new Error('Course not found');
    e.status = 404;
    throw e;
  }
  if (!canEditAssessments(course, req.user)) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }
  return course;
}

async function assertGradingOrAuthoring(req, courseId) {
  const course = await Course.findById(courseId);
  if (!course) {
    const e = new Error('Course not found');
    e.status = 404;
    throw e;
  }
  if (!canGradeSubmissions(course, req.user) && !canEditAssessments(course, req.user)) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }
  return course;
}

async function assertGrading(req, courseId) {
  const course = await Course.findById(courseId);
  if (!course) {
    const e = new Error('Course not found');
    e.status = 404;
    throw e;
  }
  if (!canGradeSubmissions(course, req.user)) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }
  return course;
}

function questionKind(q) {
  if (q && (q.kind === 'mcq' || q.kind === 'short_answer')) return q.kind;
  const opts = q && Array.isArray(q.options) ? q.options.filter((o) => String(o || '').trim()) : [];
  return opts.length >= 2 ? 'mcq' : 'short_answer';
}

function normalizeAnswerText(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function shortAnswerIsCorrect(q, textAnswer) {
  const got = normalizeAnswerText(textAnswer);
  if (!got) return false;
  const list = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
  for (const raw of list) {
    const exp = normalizeAnswerText(raw);
    if (exp && got === exp) return true;
  }
  return false;
}

/** Sanitize and cap questions from instructor dashboard (MCQ or short-answer). */
function normalizeQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const q of raw.slice(0, 50)) {
    const text = String(q.text || '').trim().slice(0, 4000);
    if (!text) continue;
    const kind = q.kind === 'mcq' ? 'mcq' : 'short_answer';
    if (kind === 'mcq') {
      const options = Array.isArray(q.options)
        ? [...new Set(q.options.map((o) => String(o || '').trim()).filter(Boolean))].slice(0, 12)
        : [];
      if (options.length < 2) continue;
      let correctIndex = Number(q.correctIndex);
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;
      out.push({
        text,
        kind: 'mcq',
        options,
        correctIndex,
        acceptedAnswers: [],
        image: typeof q.image === 'string' && q.image.trim() ? String(q.image).trim().slice(0, 2000) : undefined,
        explanation: typeof q.explanation === 'string' ? String(q.explanation).trim().slice(0, 4000) : undefined,
      });
    } else {
      const acceptedAnswers = Array.isArray(q.acceptedAnswers)
        ? [...new Set(q.acceptedAnswers.map((a) => String(a || '').trim()).filter(Boolean))].slice(0, 24)
        : [];
      if (acceptedAnswers.length === 0) continue;
      out.push({
        text,
        kind: 'short_answer',
        options: [],
        correctIndex: 0,
        acceptedAnswers,
        image: typeof q.image === 'string' && q.image.trim() ? String(q.image).trim().slice(0, 2000) : undefined,
        explanation: typeof q.explanation === 'string' ? String(q.explanation).trim().slice(0, 4000) : undefined,
      });
    }
  }
  return out;
}

async function create(req, res) {
  const sub = await SubLesson.findById(req.body.subLessonId);
  if (!sub) {
    res.status(404).json({ error: 'Sub-lesson not found' });
    return;
  }
  await assertAssessmentsAuthoring(req, sub.courseId);
  if (sub.assessmentId) {
    res.status(409).json({ error: 'This material already has an assessment. Edit it from the course studio instead.' });
    return;
  }
  const type = ['quiz', 'exam', 'homework'].includes(req.body.type) ? req.body.type : 'quiz';
  const questions = normalizeQuestions(req.body.questions);
  if (!questions.length) {
    res.status(400).json({ error: 'At least one valid question is required (MCQ with 2+ options, or short answer with accepted answers).' });
    return;
  }
  const label = typeof req.body.label === 'string' ? req.body.label.trim().slice(0, 240) : undefined;
  const timerMinutes = Math.max(0, Math.min(600, Number(req.body.timerMinutes) || 0));
  const maxAttempts = Math.max(1, Math.min(20, Number(req.body.maxAttempts) || 1));
  const gradeWeight = Math.min(100, Math.max(0, Number(req.body.gradeWeight) || 1));
  const passingScore = Math.min(100, Math.max(0, Number(req.body.passingScore) || 60));
  const a = await Assessment.create({
    subLessonId: sub._id,
    courseId: sub.courseId,
    label,
    type,
    questions,
    timerMinutes,
    randomiseQuestions: Boolean(req.body.randomiseQuestions),
    randomiseOptions: Boolean(req.body.randomiseOptions),
    maxAttempts,
    showResultsImmediately: req.body.showResultsImmediately !== false,
    deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
    gradeWeight,
    passingScore,
    passage: typeof req.body.passage === 'string' ? req.body.passage.slice(0, 20000) : undefined,
    fileUploadEnabled: Boolean(req.body.fileUploadEnabled),
    lateSubmissionAllowed: Boolean(req.body.lateSubmissionAllowed),
    published: Boolean(req.body.published),
  });
  sub.assessmentId = a._id;
  await sub.save();
  const lab = a.label || a.type;
  assessmentStaffActivity(
    req,
    String(sub.courseId),
    'Assessment created',
    `Created ${a.type} “${lab}”.`,
    String(a._id),
  );
  res.status(201).json({ assessment: a });
}

async function update(req, res) {
  const a = await Assessment.findById(req.params.id);
  if (!a) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await assertAssessmentsAuthoring(req, a.courseId);
  const fields = [
    'type',
    'timerMinutes',
    'randomiseQuestions',
    'randomiseOptions',
    'maxAttempts',
    'showResultsImmediately',
    'deadline',
    'gradeWeight',
    'passingScore',
    'passage',
    'fileUploadEnabled',
    'lateSubmissionAllowed',
    'published',
  ];
  if (req.body.label !== undefined) {
    a.label = typeof req.body.label === 'string' && req.body.label.trim() ? req.body.label.trim().slice(0, 240) : undefined;
  }
  if (req.body.questions !== undefined) {
    const next = normalizeQuestions(req.body.questions);
    if (!next.length) {
      res.status(400).json({ error: 'questions must contain at least one valid MCQ or short-answer item.' });
      return;
    }
    a.questions = next;
  }
  for (const f of fields) {
    if (req.body[f] === undefined) continue;
    if (f === 'type') {
      if (['quiz', 'exam', 'homework'].includes(req.body.type)) a.type = req.body.type;
      continue;
    }
    if (f === 'gradeWeight' || f === 'passingScore') {
      const n = Number(req.body[f]);
      if (!Number.isFinite(n)) continue;
      a[f] = f === 'gradeWeight' ? Math.min(100, Math.max(0, n)) : Math.min(100, Math.max(0, n));
      continue;
    }
    if (f === 'timerMinutes') {
      a.timerMinutes = Math.max(0, Math.min(600, Number(req.body.timerMinutes) || 0));
      continue;
    }
    if (f === 'maxAttempts') {
      a.maxAttempts = Math.max(1, Math.min(20, Number(req.body.maxAttempts) || 1));
      continue;
    }
    a[f] = req.body[f];
  }
  await a.save();
  const lab = a.label || a.type;
  assessmentStaffActivity(req, String(a.courseId), 'Assessment updated', `Updated ${a.type} “${lab}”.`, String(a._id));
  res.json({ assessment: a });
}

async function remove(req, res) {
  const a = await Assessment.findById(req.params.id);
  if (!a) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await assertAssessmentsAuthoring(req, a.courseId);
  const cid = String(a.courseId);
  const lab = a.label || a.type;
  const typ = a.type;
  await SubLesson.updateMany({ assessmentId: a._id }, { $unset: { assessmentId: 1 } });
  await Submission.deleteMany({ assessmentId: a._id });
  await a.deleteOne();
  assessmentStaffActivity(req, cid, 'Assessment removed', `Deleted ${typ} “${lab}”.`);
  res.json({ ok: true });
}

function scoreAnswers(assessment, answers) {
  const questions = assessment.questions || [];
  if (!questions.length) {
    return { score: null, correct: 0, total: 0 };
  }
  const byIndex = new Map((answers || []).map((x) => [x.questionIndex, x]));
  let correct = 0;
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const ans = byIndex.get(i);
    if (!q) continue;
    const k = questionKind(q);
    if (k === 'mcq') {
      if (ans && Number(ans.selectedIndex) === Number(q.correctIndex)) correct += 1;
    } else if (ans && shortAnswerIsCorrect(q, ans.textAnswer)) {
      correct += 1;
    }
  }
  const total = questions.length;
  return { score: Math.round((correct / total) * 100), correct, total };
}

function everyQuestionAutoGradable(questions) {
  if (!questions.length) return false;
  return questions.every((q) => {
    const k = questionKind(q);
    if (k === 'mcq') return (q.options || []).length >= 2 && Number.isInteger(Number(q.correctIndex));
    return (q.acceptedAnswers || []).length > 0;
  });
}

async function studentView(req, res) {
  const a = await Assessment.findById(req.params.id).lean();
  if (!a) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (!a.published) {
    res.status(403).json({ error: 'Assessment is not published' });
    return;
  }
  const course = await getCourseForUser(a.courseId, req.user);
  if (!course || req.user.role !== 'student') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const questions = (a.questions || []).map((q) => {
    const k = questionKind(q);
    if (k === 'mcq') {
      return {
        text: q.text,
        kind: 'mcq',
        options: q.options || [],
        image: q.image,
      };
    }
    return { text: q.text, kind: 'short_answer', image: q.image };
  });
  res.json({
    assessment: {
      _id: a._id,
      type: a.type,
      label: a.label,
      deadline: a.deadline,
      timerMinutes: a.timerMinutes,
      maxAttempts: a.maxAttempts,
      fileUploadEnabled: a.fileUploadEnabled,
      lateSubmissionAllowed: a.lateSubmissionAllowed,
      questions,
    },
  });
}

async function submit(req, res) {
  const a = await Assessment.findById(req.params.id);
  if (!a) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (!a.published) {
    res.status(403).json({ error: 'Assessment is not published' });
    return;
  }
  const course = await getCourseForUser(a.courseId, req.user);
  if (!course || req.user.role !== 'student') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (a.deadline && new Date(a.deadline) < new Date()) {
    if (!a.lateSubmissionAllowed) {
      res.status(400).json({ error: 'Deadline passed' });
      return;
    }
  }
  const { answers, uploadedFiles } = req.body;
  const courseRow = await Course.findById(a.courseId).select('passingScoreDefault').lean();
  const passLine =
    a.passingScore != null && Number.isFinite(Number(a.passingScore))
      ? Math.min(100, Math.max(0, Number(a.passingScore)))
      : Math.min(100, Math.max(0, Number(courseRow?.passingScoreDefault) || 60));

  const questions = a.questions || [];
  const questionCount = questions.length;
  const shouldAutoScore = questionCount > 0 && everyQuestionAutoGradable(questions) && ['quiz', 'exam', 'homework'].includes(a.type);

  let score;
  let isPassed;
  if (shouldAutoScore) {
    const scored = scoreAnswers(a, answers);
    score = scored.score === null ? 0 : scored.score;
    isPassed = score >= passLine;
  } else {
    score = undefined;
    isPassed = undefined;
  }

  const prior = await Submission.countDocuments({
    studentId: req.user._id,
    assessmentId: a._id,
    status: { $in: ['submitted', 'graded'] },
  });
  if (prior >= (a.maxAttempts || 1)) {
    res.status(400).json({ error: 'Max attempts reached' });
    return;
  }

  const doc = {
    studentId: req.user._id,
    assessmentId: a._id,
    courseId: a.courseId,
    answers: answers || [],
    uploadedFiles: uploadedFiles || [],
    status: 'submitted',
    submittedAt: new Date(),
    isLate: Boolean(a.deadline && new Date() > new Date(a.deadline)),
  };
  if (score !== undefined && score !== null) doc.score = score;
  if (isPassed !== undefined) doc.isPassed = isPassed;

  const sub = await Submission.create(doc);
  try {
    const cRow = await Course.findById(a.courseId).select('title ownerId assistants').lean();
    if (cRow) {
      const recipientIds = recipientIdsForGradingAlerts(cRow);
      const label = a.label || a.type || 'activity';
      for (const uid of recipientIds) {
        if (String(uid) === String(req.user._id)) continue;
        await createInAppNotification({
          userId: uid,
          type: NT.SUBMISSION_RECEIVED,
          title: `New submission · ${cRow.title || 'Course'}`,
          body: `A learner submitted work for ${label}.`,
          href: `/staff/courses/${a.courseId}/assessments/${a._id}`,
          meta: { courseId: String(a.courseId), assessmentId: String(a._id), submissionId: String(sub._id) },
        });
      }
    }
  } catch (e) {
    console.warn('[assessment.submit] notify:', e.message);
  }
  res.status(201).json({ submission: sub });
}

async function result(req, res) {
  const a = await Assessment.findById(req.params.id);
  if (!a) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const course = await getCourseForUser(a.courseId, req.user);
  if (!course || req.user.role !== 'student') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const sub = await Submission.findOne({ studentId: req.user._id, assessmentId: a._id }).sort({ submittedAt: -1 });
  if (!sub) {
    res.status(404).json({ error: 'No submission' });
    return;
  }
  res.json({ submission: sub, assessment: a.showResultsImmediately ? a : { _id: a._id, type: a.type } });
}

async function listSubmissions(req, res) {
  const a = await Assessment.findById(req.params.id);
  if (!a) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await assertGradingOrAuthoring(req, a.courseId);
  const items = await Submission.find({ assessmentId: a._id }).sort({ submittedAt: -1 }).lean();
  res.json({ items });
}

async function getOne(req, res) {
  const a = await Assessment.findById(req.params.id).lean();
  if (!a) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await assertGradingOrAuthoring(req, a.courseId);
  res.json({ assessment: a });
}

async function gradeSubmission(req, res) {
  const sub = await Submission.findById(req.params.id);
  if (!sub) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await assertGrading(req, sub.courseId);
  const { score, instructorFeedback } = req.body;

  const a = await Assessment.findById(sub.assessmentId).lean();
  const courseRow = await Course.findById(sub.courseId).select('passingScoreDefault').lean();
  const passLine =
    a && a.passingScore != null && Number.isFinite(Number(a.passingScore))
      ? Math.min(100, Math.max(0, Number(a.passingScore)))
      : Math.min(100, Math.max(0, Number(courseRow?.passingScoreDefault) || 60));

  if (score === undefined || score === null || score === '') {
    res.status(400).json({ error: 'score is required (0–100) to finalize a grade' });
    return;
  }
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    res.status(400).json({ error: 'score must be a number between 0 and 100' });
    return;
  }
  sub.score = Math.round(n * 100) / 100;
  sub.isPassed = sub.score >= passLine;
  if (instructorFeedback !== undefined) sub.instructorFeedback = instructorFeedback;
  sub.status = 'graded';
  sub.gradedBy = req.user._id;
  sub.gradedAt = new Date();
  await sub.save();
  try {
    const cRow = await Course.findById(sub.courseId).select('title').lean();
    await createInAppNotification({
      userId: sub.studentId,
      type: NT.SUBMISSION_GRADED,
      title: `Graded · ${cRow?.title || 'Course'}`,
      body: `Your instructor posted a grade (${sub.score}%). Open the activity to view feedback.`,
      href: `/student/classes/${sub.courseId}/assessments/${sub.assessmentId}`,
      meta: { courseId: String(sub.courseId), assessmentId: String(sub.assessmentId) },
    });
  } catch (e) {
    console.warn('[assessment.gradeSubmission] notify:', e.message);
  }
  assessmentStaffActivity(
    req,
    String(sub.courseId),
    'Submission graded',
    `Finalized a grade for an assessment submission.`,
    String(sub.assessmentId),
  );
  res.json({ submission: sub });
}

async function exportSubmissions(req, res) {
  const a = await Assessment.findById(req.params.id);
  if (!a) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await assertGrading(req, a.courseId);
  const items = await Submission.find({ assessmentId: a._id }).lean();
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="submissions-${a._id}.zip"`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => res.status(500).end(String(err)));
  archive.pipe(res);
  for (const s of items) {
    const name = `${s.studentId}-${s._id}.json`;
    archive.append(JSON.stringify(s, null, 2), { name });
  }
  await archive.finalize();
}

module.exports = {
  create,
  update,
  remove,
  submit,
  result,
  listSubmissions,
  getOne,
  gradeSubmission,
  exportSubmissions,
  studentView,
};
