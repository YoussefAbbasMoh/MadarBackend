const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const SubLesson = require('../models/SubLesson');
const Assessment = require('../models/Assessment');
const Submission = require('../models/Submission');
const { getCourseForUser, canCreateCourse, canEditCourseSettings } = require('../utils/courseAccess');
const { courseListQueryForUser } = require('../utils/courseListQuery');
const { normalizeCourseLanguage } = require('../utils/courseLanguage');
const User = require('../models/User');
const { publicPortfolioFromDoc } = require('../utils/instructorPortfolio');
const NT = require('../constants/notificationTypes');
const { createInAppNotification } = require('../services/inAppNotify');
const { notifyCourseTeamExceptActor, actorLabel } = require('../services/courseTeamActivity');

function courseStaffActivity(req, courseId, title, detail) {
  notifyCourseTeamExceptActor(courseId, req.user._id, {
    type: NT.DASHBOARD_ACTIVITY,
    title,
    body: `${actorLabel(req.user)} — ${detail}`,
    href: `/staff/courses/${courseId}`,
    meta: { scope: 'course_settings' },
  }).catch((e) => console.warn('[course] notify:', e.message));
}

function normalizeCourseLean(c) {
  if (!c) return c;
  return { ...c, price: c.price ?? 0, currency: c.currency || 'EGP' };
}

async function listCourses(req, res) {
  const { user } = req;
  const query = courseListQueryForUser(user);
  if (query === null) {
    res.json({ items: [] });
    return;
  }
  let items;
  try {
    items = await Course.find(query).sort({ updatedAt: -1 }).lean();
  } catch (err) {
    console.error('[listCourses] query failed', { query, message: err.message });
    res.status(500).json({ error: err.message || 'Database error while listing courses' });
    return;
  }
  const out = [];
  for (const doc of items) {
    try {
      out.push(normalizeCourseLean(doc));
    } catch (err) {
      console.warn('[listCourses] skip row', String(doc && doc._id), err.message);
    }
  }
  res.json({ items: out });
}

async function getCourse(req, res) {
  const course = await getCourseForUser(req.params.id, req.user);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }
  const lessons = await Lesson.find({ courseId: course._id }).sort({ order: 1 }).lean();
  const subLessons = await SubLesson.find({ courseId: course._id }).sort({ order: 1 }).lean();
  const subByLesson = new Map();
  for (const s of subLessons) {
    const list = subByLesson.get(String(s.lessonId)) || [];
    list.push(s);
    subByLesson.set(String(s.lessonId), list);
  }
  const tree = lessons.map((l) => ({
    ...l,
    subLessons: subByLesson.get(String(l._id)) || [],
  }));
  const owner = await User.findById(course.ownerId).select('name instructorPortfolio').lean();
  const portfolio = publicPortfolioFromDoc(owner?.instructorPortfolio);
  const courseOut = {
    ...normalizeCourseLean(course),
    instructor: {
      name: owner?.name || 'Instructor',
      portfolio,
    },
  };
  res.json({ course: courseOut, lessons: tree });
}

async function createCourse(req, res) {
  if (!canCreateCourse(req.user)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const {
    title,
    category,
    description,
    coverImage,
    language,
    maxStudents,
    certificateEnabled,
    price,
    currency,
  } = req.body;
  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (price === undefined || price === null || (typeof price === 'string' && price.trim() === '')) {
    res.status(400).json({ error: 'price is required for every course (non-negative number; use 0 for free courses)' });
    return;
  }
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice < 0) {
    res.status(400).json({ error: 'price must be a finite number >= 0' });
    return;
  }
  const ownerRole = ['super_admin', 'instructor', 'teacher', 'doctor'].includes(req.user.role)
    ? req.user.role
    : 'instructor';
  const rawGallery = req.body.galleryImages;
  const galleryImages = Array.isArray(rawGallery)
    ? rawGallery.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 24)
    : [];
  const passDef = Number(req.body.passingScoreDefault);
  const passingScoreDefault = Number.isFinite(passDef) ? Math.min(100, Math.max(0, passDef)) : 60;

  const ownerId = String(req.user._id);

  let course;
  try {
    course = await Course.create({
      ownerId,
      ownerRole,
      title: String(title).trim(),
      category,
      description,
      coverImage: typeof coverImage === 'string' && coverImage.trim() ? coverImage.trim() : undefined,
      galleryImages,
      passingScoreDefault,
      language: normalizeCourseLanguage(language),
      maxStudents: Number.isFinite(Number(maxStudents)) ? Math.max(0, Number(maxStudents)) : 0,
      certificateEnabled: Boolean(certificateEnabled),
      price: numericPrice,
      currency: typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'EGP',
      status: 'draft',
    });
  } catch (err) {
    if (err && err.name === 'ValidationError') {
      res.status(400).json({ error: err.message || 'Invalid course data' });
      return;
    }
    console.error('[createCourse]', err);
    res.status(500).json({ error: err.message || 'Could not create course' });
    return;
  }
  res.status(201).json({ course: normalizeCourseLean(course.toObject({ flattenMaps: true })) });
}

async function updateCourse(req, res) {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }
  if (!canEditCourseSettings(course, req.user)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (req.body.galleryImages !== undefined) {
    const arr = Array.isArray(req.body.galleryImages) ? req.body.galleryImages : [];
    course.galleryImages = arr.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 24);
  }
  if (req.body.coverImage !== undefined) {
    course.coverImage = typeof req.body.coverImage === 'string' && req.body.coverImage.trim() ? req.body.coverImage.trim() : undefined;
  }
  if (req.body.passingScoreDefault !== undefined) {
    const n = Number(req.body.passingScoreDefault);
    course.passingScoreDefault = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 60;
  }

  const allowed = [
    'title',
    'category',
    'description',
    'language',
    'maxStudents',
    'certificateEnabled',
    'packageIds',
    'price',
    'currency',
  ];
  for (const key of allowed) {
    if (req.body[key] === undefined) continue;
    if (key === 'price') {
      course.price = Number(req.body.price);
      continue;
    }
    if (key === 'currency' && typeof req.body.currency === 'string') {
      course.currency = req.body.currency.trim().toUpperCase() || 'EGP';
      continue;
    }
    if (key === 'language') {
      course.language = normalizeCourseLanguage(req.body.language);
      continue;
    }
    course[key] = req.body[key];
  }
  try {
    await course.save();
  } catch (err) {
    if (err && err.name === 'ValidationError') {
      res.status(400).json({ error: err.message || 'Invalid course data' });
      return;
    }
    throw err;
  }
  courseStaffActivity(req, String(course._id), 'Course settings updated', `Saved settings for “${course.title}”.`);
  res.json({ course: normalizeCourseLean(course.toObject()) });
}

async function archiveCourse(req, res) {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }
  if (!canEditCourseSettings(course, req.user)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  course.status = 'archived';
  await course.save();
  courseStaffActivity(req, String(course._id), 'Course archived', `Archived “${course.title}”.`);
  res.json({ course: normalizeCourseLean(course.toObject()) });
}

async function setCourseStatus(req, res) {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }
  if (!canEditCourseSettings(course, req.user)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { status } = req.body;
  if (!['draft', 'active', 'archived'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  course.status = status;
  await course.save();
  courseStaffActivity(req, String(course._id), 'Course status changed', `Status is now “${status}” for “${course.title}”.`);
  res.json({ course: normalizeCourseLean(course.toObject()) });
}

async function duplicateCourse(req, res) {
  const source = await Course.findById(req.params.id);
  if (!source) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }
  if (!canEditCourseSettings(source, req.user)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const ownerId = String(req.user._id);

  const copy = await Course.create({
    ownerId,
    ownerRole: source.ownerRole,
    title: `${source.title} (copy)`,
    category: source.category,
    description: source.description,
    coverImage: source.coverImage,
    galleryImages: [...(source.galleryImages || [])],
    passingScoreDefault: source.passingScoreDefault ?? 60,
    language: source.language,
    maxStudents: source.maxStudents,
    certificateEnabled: source.certificateEnabled,
    price: source.price ?? 0,
    currency: source.currency || 'EGP',
    packageIds: source.packageIds || [],
    status: 'draft',
    enrolledStudentIds: [],
    assistants: [],
  });
  const lessons = await Lesson.find({ courseId: source._id }).sort({ order: 1 });
  const newLessonIds = [];
  for (const l of lessons) {
    const nl = await Lesson.create({
      courseId: copy._id,
      title: l.title,
      order: l.order,
      description: l.description,
      published: false,
      subLessonIds: [],
    });
    newLessonIds.push(nl._id);
    const subs = await SubLesson.find({ lessonId: l._id }).sort({ order: 1 });
    const newSubIds = [];
    for (const s of subs) {
      const ns = await SubLesson.create({
        lessonId: nl._id,
        courseId: copy._id,
        title: s.title,
        description: s.description,
        order: s.order,
        type: s.type,
        cloudinaryAssetId: s.cloudinaryAssetId,
        cloudinaryPublicId: s.cloudinaryPublicId,
        fileUrl: s.fileUrl,
        published: false,
        estimatedMinutes: s.estimatedMinutes,
      });
      newSubIds.push(ns._id);
    }
    nl.subLessonIds = newSubIds;
    await nl.save();
  }
  copy.lessonIds = newLessonIds;
  await copy.save();
  try {
    await createInAppNotification({
      userId: ownerId,
      type: NT.COURSE_DUPLICATED,
      title: 'Course duplicated',
      body: `${copy.title} is ready as a draft.`,
      href: `/staff/courses/${copy._id}`,
      meta: { courseId: String(copy._id), sourceCourseId: String(source._id) },
    });
  } catch (e) {
    console.warn('[duplicateCourse] notify:', e.message);
  }
  courseStaffActivity(req, String(source._id), 'Course duplicated', `Created draft copy “${copy.title}”.`);
  res.status(201).json({ course: normalizeCourseLean(copy.toObject()) });
}

async function listAssessmentsForCourse(req, res) {
  const course = await getCourseForUser(req.params.id, req.user);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }
  const items = await Assessment.find({ courseId: course._id }).sort({ createdAt: -1 }).populate('subLessonId', 'title').lean();
  const aIds = items.map((i) => i._id);
  let counts = [];
  if (aIds.length) {
    counts = await Submission.aggregate([
      { $match: { assessmentId: { $in: aIds }, status: 'submitted' } },
      { $group: { _id: '$assessmentId', pendingCount: { $sum: 1 } } },
    ]);
  }
  const pendingByAssessment = new Map(counts.map((x) => [String(x._id), x.pendingCount]));
  res.json({
    items: items.map((a) => {
      const row = { ...a };
      const sub = row.subLessonId && typeof row.subLessonId === 'object' ? row.subLessonId : null;
      row.subLessonTitle = sub && sub.title ? sub.title : '';
      row.subLessonId = sub ? sub._id : row.subLessonId;
      row.pendingSubmittedCount = pendingByAssessment.get(String(row._id)) || 0;
      return row;
    }),
  });
}

module.exports = {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  archiveCourse,
  setCourseStatus,
  duplicateCourse,
  listAssessmentsForCourse,
};
