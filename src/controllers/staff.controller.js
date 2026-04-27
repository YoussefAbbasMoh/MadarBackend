const Course = require('../models/Course');
const LiveSession = require('../models/LiveSession');
const Submission = require('../models/Submission');
const Notification = require('../models/Notification');
const Assessment = require('../models/Assessment');
const Progress = require('../models/Progress');
const Message = require('../models/Message');
const Transaction = require('../models/Transaction');
const SubLesson = require('../models/SubLesson');
const { courseListQueryForUser, toObjectId } = require('../utils/courseListQuery');
const { runCourseInsights } = require('../services/staffInsightsPg');
const P = require('../constants/assistantPermissions');
const { SEED_INSTRUCTOR_EMAIL, buildSeedTestStudentRoster } = require('../../scripts/sample-courses-data');

function ymKeyFromParts(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Last `count` calendar months starting from the first day of (now - count + 1) month. */
function rollingMonthBuckets(count, anchor = new Date()) {
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    out.push({
      key: ymKeyFromParts(d.getFullYear(), d.getMonth() + 1),
      label: d.toLocaleDateString('en', { month: 'short', year: 'numeric' }),
      start: d,
    });
  }
  return out;
}

function linearForecastNext(values) {
  const ys = values.map((v) => (Number.isFinite(v) ? v : 0));
  const n = ys.length;
  if (n === 0) return { estimate: 0, r2: 0, note: 'No data points yet.' };
  if (n === 1) return { estimate: Math.max(0, ys[0]), r2: 0, note: 'Only one period — forecast equals that value.' };
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  const fitted = xs.map((x) => intercept + slope * x);
  const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - fitted[i]) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  const next = intercept + slope * n;
  const note =
    n < 4
      ? 'Few periods — treat as directional, not financial guidance.'
      : 'Ordinary least squares on the last 12 months (your academy’s recorded data only).';
  return { estimate: Math.max(0, Math.round(next * 100) / 100), r2: Math.round(r2 * 1000) / 1000, note };
}

/**
 * GET /staff/summary — KPIs for instructor/doctor/assistant/super_admin home.
 */
async function summary(req, res) {
  const q = courseListQueryForUser(req.user);
  if (q === null) {
    res.json({
      courseCount: 0,
      drafts: 0,
      publishedActive: 0,
      archived: 0,
      enrollmentTotal: 0,
      uniqueStudentCount: 0,
      liveSessionsNext7Days: 0,
      enrollmentsThisMonth: 0,
      enrollmentsPrevMonth: 0,
      courseTiles: [],
      upcomingSessions: [],
      unreadNotifications: 0,
      pendingGradingTotal: 0,
      coursesWithPending: [],
      activityFeed: [],
      seedTestStudents: null,
    });
    return;
  }

  const courses = await Course.find(q)
    .select('_id title status enrolledStudentIds')
    .sort({ updatedAt: -1 })
    .limit(500)
    .lean();
  const ids = courses.map((c) => c._id);
  const draft = courses.filter((c) => c.status === 'draft').length;
  const publishedActive = courses.filter((c) => c.status === 'active').length;
  const archived = courses.filter((c) => c.status === 'archived').length;
  const enrollmentTotal = courses.reduce((sum, c) => sum + (c.enrolledStudentIds || []).length, 0);
  const uniqueStudentCount = new Set(
    courses.flatMap((c) => (c.enrolledStudentIds || []).map((id) => String(id))),
  ).size;

  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const horizon7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  let liveSessionsNext7Days = 0;
  if (ids.length) {
    liveSessionsNext7Days = await LiveSession.countDocuments({
      courseId: { $in: ids },
      status: 'scheduled',
      scheduledAt: { $gte: now, $lte: horizon7 },
    });
  }

  let enrollmentsThisMonth = 0;
  let enrollmentsPrevMonth = 0;
  if (ids.length) {
    enrollmentsThisMonth = await Progress.countDocuments({
      courseId: { $in: ids },
      createdAt: { $gte: startOfMonth },
    });
    enrollmentsPrevMonth = await Progress.countDocuments({
      courseId: { $in: ids },
      createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
    });
  }

  let upcomingSessions = [];
  if (ids.length) {
    const sessions = await LiveSession.find({
      courseId: { $in: ids },
      status: 'scheduled',
      scheduledAt: { $gte: now, $lte: horizon },
    })
      .sort({ scheduledAt: 1 })
      .limit(10)
      .populate('courseId', 'title')
      .lean();
    upcomingSessions = sessions.map((s) => ({
      _id: s._id,
      title: s.title,
      scheduledAt: s.scheduledAt,
      status: s.status,
      courseId: s.courseId?._id || s.courseId,
      courseTitle: (s.courseId && s.courseId.title) || 'Course',
    }));
  }

  const staffUserId = toObjectId(req.user._id);
  const unreadNotifications = staffUserId
    ? await Notification.countDocuments({
        userId: staffUserId,
        status: { $in: ['queued', 'sent', 'delivered'] },
      })
    : 0;

  let pendingGradingTotal = 0;
  const coursesWithPending = [];
  if (ids.length) {
    const agg = await Submission.aggregate([
      { $match: { status: 'submitted', courseId: { $in: ids } } },
      { $group: { _id: '$courseId', pendingCount: { $sum: 1 } } },
    ]);
    const map = new Map(agg.map((a) => [String(a._id), a.pendingCount]));
    pendingGradingTotal = agg.reduce((sum, a) => sum + a.pendingCount, 0);
    for (const c of courses) {
      const n = map.get(String(c._id)) || 0;
      if (n > 0) coursesWithPending.push({ courseId: c._id, title: c.title, pendingCount: n });
    }
  }

  const pendingByCourse = new Map(coursesWithPending.map((c) => [String(c.courseId), c.pendingCount]));
  const courseTiles = courses.slice(0, 16).map((c) => ({
    courseId: c._id,
    title: c.title,
    status: c.status,
    enrollments: (c.enrolledStudentIds || []).length,
    pendingGrading: pendingByCourse.get(String(c._id)) || 0,
  }));

  const courseTitleById = new Map(courses.map((c) => [String(c._id), c.title]));

  let activityFeed = [];
  if (ids.length) {
    const [recentSubs, recentSessions, recentMsgs] = await Promise.all([
      Submission.find({
        courseId: { $in: ids },
        status: 'submitted',
        submittedAt: { $exists: true, $ne: null },
      })
        .sort({ submittedAt: -1 })
        .limit(8)
        .populate('studentId', 'name')
        .populate('assessmentId', 'type')
        .lean(),
      LiveSession.find({ courseId: { $in: ids } })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('courseId', 'title')
        .lean(),
      Message.find({ courseId: { $in: ids } })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('senderId', 'name role')
        .populate('courseId', 'title')
        .lean(),
    ]);

    const rows = [];
    for (const s of recentSubs) {
      const at = s.submittedAt || s.gradedAt;
      if (!at) continue;
      const aid = s.assessmentId && typeof s.assessmentId === 'object' ? s.assessmentId._id : s.assessmentId;
      if (!aid) continue;
      const courseTitle = courseTitleById.get(String(s.courseId)) || 'Course';
      const stu = s.studentId && typeof s.studentId === 'object' ? s.studentId.name : '';
      const asmt = s.assessmentId && typeof s.assessmentId === 'object' ? s.assessmentId : null;
      rows.push({
        type: 'submission',
        at,
        title: `${stu || 'Learner'} submitted ${asmt?.type || 'assessment'}`,
        detail: courseTitle,
        href: `/staff/courses/${String(s.courseId)}/assessments/${String(aid)}`,
      });
    }
    for (const s of recentSessions) {
      const at = s.createdAt || s.scheduledAt;
      rows.push({
        type: 'live_session',
        at,
        title: `Live session: ${s.title}`,
        detail: (s.courseId && s.courseId.title) || 'Course',
        href: '/staff/live',
      });
    }
    for (const m of recentMsgs) {
      const snd = m.senderId && typeof m.senderId === 'object' ? m.senderId : null;
      const who = snd?.name || 'User';
      const isStudent = snd?.role === 'student';
      rows.push({
        type: 'message',
        at: m.createdAt,
        title: isStudent ? `${who} messaged your class` : `${who} sent a message`,
        detail: (m.courseId && m.courseId.title) || 'Course',
        href: '/staff/messages',
      });
    }
    rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    activityFeed = rows.slice(0, 14);
  }

  const email = (req.user.email || '').toLowerCase();
  const seedTestStudents =
    email && email === SEED_INSTRUCTOR_EMAIL.toLowerCase() ? buildSeedTestStudentRoster() : null;

  res.json({
    courseCount: courses.length,
    drafts: draft,
    publishedActive,
    archived,
    enrollmentTotal,
    uniqueStudentCount,
    liveSessionsNext7Days,
    enrollmentsThisMonth,
    enrollmentsPrevMonth,
    courseTiles,
    upcomingSessions,
    unreadNotifications,
    pendingGradingTotal,
    coursesWithPending,
    activityFeed,
    seedTestStudents,
  });
}

/**
 * GET /staff/grading-queue — assessments with submitted (ungraded) work, for instructor grading UI.
 */
async function gradingQueue(req, res) {
  const q = courseListQueryForUser(req.user);
  if (q === null) {
    res.json({ items: [] });
    return;
  }
  let courses = await Course.find(q).select('_id title assistants').sort({ updatedAt: -1 }).limit(300).lean();
  if (req.user.role === 'assistant') {
    courses = courses.filter((c) => {
      const entry = (c.assistants || []).find((a) => String(a.userId) === String(req.user._id));
      const set = new Set(entry?.permissions || []);
      return set.has(P.GRADING) || set.has(P.ASSESSMENTS);
    });
  }
  const ids = courses.map((c) => c._id);
  if (!ids.length) {
    res.json({ items: [] });
    return;
  }
  const titleById = new Map(courses.map((c) => [String(c._id), c.title]));
  const assessments = await Assessment.find({ courseId: { $in: ids } })
    .select('_id courseId type published label questions subLessonId')
    .sort({ createdAt: -1 })
    .lean();
  const aIds = assessments.map((a) => a._id);
  if (!aIds.length) {
    res.json({ items: [], stats: { totalPending: 0, queueSize: 0 } });
    return;
  }
  const pending = await Submission.aggregate([
    { $match: { assessmentId: { $in: aIds }, status: 'submitted' } },
    {
      $group: {
        _id: '$assessmentId',
        pendingCount: { $sum: 1 },
        oldestSubmittedAt: { $min: '$submittedAt' },
      },
    },
  ]);
  const detailMap = new Map(
    pending.map((p) => [String(p._id), { pendingCount: p.pendingCount, oldestSubmittedAt: p.oldestSubmittedAt }]),
  );
  const subIds = [...new Set(assessments.map((a) => a.subLessonId).filter(Boolean).map((id) => String(id)))];
  const subRows = subIds.length ? await SubLesson.find({ _id: { $in: subIds } }).select('title').lean() : [];
  const subTitleById = new Map(subRows.map((s) => [String(s._id), s.title]));
  const items = assessments
    .map((a) => {
      const det = detailMap.get(String(a._id)) || { pendingCount: 0, oldestSubmittedAt: null };
      const materialTitle = subTitleById.get(String(a.subLessonId)) || 'Material';
      const displayTitle = a.label || `${a.type} · ${materialTitle}`;
      return {
        assessmentId: a._id,
        courseId: a.courseId,
        courseTitle: titleById.get(String(a.courseId)) || 'Course',
        materialTitle,
        displayTitle,
        type: a.type,
        published: a.published,
        pendingCount: det.pendingCount,
        oldestSubmittedAt: det.oldestSubmittedAt,
        questionCount: (a.questions || []).length,
      };
    })
    .filter((row) => row.pendingCount > 0);
  const totalPending = items.reduce((sum, r) => sum + r.pendingCount, 0);
  res.json({ items, stats: { totalPending, queueSize: items.length } });
}

/**
 * GET /staff/insights — time series + simple forecasts for instructor workspace (courses in scope).
 * Revenue: paid course transactions. Enrollments: Progress created. Engagement: submissions + progress touches.
 * Material attention: sub-lessons in completedSubLessons × estimatedMinutes (planned duration proxy).
 */
async function insights(req, res) {
  const q = courseListQueryForUser(req.user);
  if (q === null) {
    res.json({
      empty: true,
      currency: 'EGP',
      monthly: [],
      revenueByCourse: [],
      totals: { lifetimeNetRevenue: 0, paidTransactions: 0, avgProgressPercent: 0 },
      revenueForecast: { estimate: 0, r2: 0, note: 'No workspace access.' },
      engagementForecast: { estimate: 0, r2: 0, note: 'No workspace access.' },
      materialAttention: {
        disclaimer:
          'No workspace. When available, rankings use completions × each material’s estimated minutes (planned duration proxy).',
        averageEstimatedMinutesPerCompletion: 0,
        totalCompletionsRecorded: 0,
        totalSeatMinutesEstimated: 0,
        topMaterials: [],
      },
      asOf: new Date().toISOString(),
    });
    return;
  }

  const courses = await Course.find(q).select('_id title currency price').sort({ updatedAt: -1 }).limit(500).lean();
  const ids = courses.map((c) => c._id);
  const titleById = new Map(courses.map((c) => [String(c._id), c.title]));
  const currency =
    courses.length && courses.every((c) => (c.currency || 'EGP') === (courses[0].currency || 'EGP'))
      ? courses[0].currency || 'EGP'
      : 'EGP';

  if (!ids.length) {
    const buckets = rollingMonthBuckets(12);
    res.json({
      empty: false,
      currency,
      monthly: buckets.map((b) => ({
        period: b.label,
        key: b.key,
        revenue: 0,
        enrollments: 0,
        submissions: 0,
        materialTouches: 0,
        engagementIndex: 0,
      })),
      revenueByCourse: [],
      totals: { lifetimeNetRevenue: 0, paidTransactions: 0, avgProgressPercent: 0 },
      revenueForecast: { estimate: 0, r2: 0, note: 'Add courses to see trends.' },
      engagementForecast: { estimate: 0, r2: 0, note: 'Add courses to see trends.' },
      materialAttention: {
        disclaimer:
          'Rank materials by learner completions × estimated minutes on each item (proxy for where cohorts invest time). Real watch time requires client analytics.',
        averageEstimatedMinutesPerCompletion: 0,
        totalCompletionsRecorded: 0,
        totalSeatMinutesEstimated: 0,
        topMaterials: [],
      },
      asOf: new Date().toISOString(),
    });
    return;
  }

  const buckets = rollingMonthBuckets(12);
  const firstStart = buckets[0]?.start || new Date();
  firstStart.setHours(0, 0, 0, 0);

  let revAgg;
  let enrollAgg;
  let subAgg;
  let touchAgg;
  let avgProgRow;
  let lifetimeRev;
  let byCourseRev;
  let materialFacetRaw;

  ({
    revAgg,
    enrollAgg,
    subAgg,
    touchAgg,
    avgProgRow,
    lifetimeRev,
    byCourseRev,
    materialFacetRaw,
  } = await runCourseInsights(ids, firstStart));

  const revMap = new Map(revAgg.map((r) => [ymKeyFromParts(r._id.y, r._id.m), r.total]));
  const enMap = new Map(enrollAgg.map((r) => [ymKeyFromParts(r._id.y, r._id.m), r.n]));
  const subMap = new Map(subAgg.map((r) => [ymKeyFromParts(r._id.y, r._id.m), r.n]));
  const touchMap = new Map(touchAgg.map((r) => [ymKeyFromParts(r._id.y, r._id.m), r.n]));

  const monthly = buckets.map((b) => {
    const revenue = Math.round((revMap.get(b.key) || 0) * 100) / 100;
    const enrollments = enMap.get(b.key) || 0;
    const submissions = subMap.get(b.key) || 0;
    const materialTouches = touchMap.get(b.key) || 0;
    const engagementIndex = Math.round(materialTouches + submissions * 2);
    return {
      period: b.label,
      key: b.key,
      revenue,
      enrollments,
      submissions,
      materialTouches,
      engagementIndex,
    };
  });

  const avgProgressPercent =
    avgProgRow.length && Number.isFinite(avgProgRow[0].avg)
      ? Math.round(Number(avgProgRow[0].avg) * 10) / 10
      : 0;

  const revenueForecast = linearForecastNext(monthly.map((m) => m.revenue));
  const engagementForecast = linearForecastNext(monthly.map((m) => m.engagementIndex));

  const lifetime = lifetimeRev[0] || { total: 0, cnt: 0 };
  const revenueByCourse = byCourseRev.map((r) => ({
    courseId: r._id,
    title: titleById.get(String(r._id)) || 'Course',
    total: Math.round(Number(r.total || 0) * 100) / 100,
    currency,
  }));

  const materialFacet = materialFacetRaw[0] || { top: [], totals: [] };
  const materialTop = materialFacet.top || [];
  const materialTotals = materialFacet.totals && materialFacet.totals[0] ? materialFacet.totals[0] : {};
  const totalCompletionsRecorded = Number(materialTotals.totalCompletionsRecorded) || 0;
  const totalSeatMinutesEstimated = Math.round(Number(materialTotals.totalSeatMinutesEstimated) || 0);
  const averageEstimatedMinutesPerCompletion =
    totalCompletionsRecorded > 0
      ? Math.round((totalSeatMinutesEstimated / totalCompletionsRecorded) * 10) / 10
      : 0;
  const topMaterials = materialTop.map((row) => ({
    subLessonId: row.subLessonId,
    courseId: row.courseId,
    courseTitle: titleById.get(String(row.courseId)) || 'Course',
    title: row.title,
    type: row.type,
    estimatedMinutes: Math.round((Number(row.estimatedMinutes) || 0) * 10) / 10,
    completionCount: Number(row.completionCount) || 0,
    seatMinutesEstimated: Math.round(Number(row.seatMinutesEstimated) || 0),
  }));

  res.json({
    empty: false,
    currency,
    monthly,
    revenueByCourse,
    totals: {
      lifetimeNetRevenue: Math.round(Number(lifetime.total || 0) * 100) / 100,
      paidTransactions: Number(lifetime.cnt || 0),
      avgProgressPercent,
    },
    revenueForecast: {
      estimate: revenueForecast.estimate,
      r2: revenueForecast.r2,
      note: revenueForecast.note,
    },
    engagementForecast: {
      estimate: engagementForecast.estimate,
      r2: engagementForecast.r2,
      note: engagementForecast.note,
    },
    materialAttention: {
      disclaimer:
        'Rankings use how many learners marked each material complete, multiplied by that item’s “estimated minutes” (planned duration from the curriculum). This estimates cohort time investment; it is not precise watch time unless the player reports seconds watched.',
      averageEstimatedMinutesPerCompletion,
      totalCompletionsRecorded,
      totalSeatMinutesEstimated: Math.round(totalSeatMinutesEstimated),
      topMaterials,
    },
    asOf: new Date().toISOString(),
  });
}

module.exports = { summary, gradingQueue, insights };

