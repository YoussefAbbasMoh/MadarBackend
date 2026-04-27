const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const SubLesson = require('../models/SubLesson');
const AgentSession = require('../models/AgentSession');
const { getCourseForUser, canEditLessons } = require('../utils/courseAccess');
const { signedVideoUrl } = require('../services/cloudinary');
const NT = require('../constants/notificationTypes');
const { notifyCourseTeamExceptActor, actorLabel } = require('../services/courseTeamActivity');

function staffActivity(req, courseId, title, detail) {
  notifyCourseTeamExceptActor(courseId, req.user._id, {
    type: NT.DASHBOARD_ACTIVITY,
    title,
    body: `${actorLabel(req.user)} — ${detail}`,
    href: `/staff/courses/${courseId}`,
    meta: { scope: 'curriculum' },
  }).catch((e) => console.warn('[lesson] notify:', e.message));
}

async function assertCourseManage(req, courseId) {
  const course = await Course.findById(courseId);
  if (!course) {
    const e = new Error('Course not found');
    e.status = 404;
    throw e;
  }
  if (!canEditLessons(course, req.user)) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }
  return course;
}

async function listLessons(req, res) {
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
  res.json({ lessons: tree });
}

async function createLesson(req, res) {
  await assertCourseManage(req, req.params.id);
  const { title, description, order, published } = req.body;
  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  const course = await Course.findById(req.params.id);
  const lesson = await Lesson.create({
    courseId: course._id,
    title,
    description,
    order: order ?? (await Lesson.countDocuments({ courseId: course._id })),
    published: Boolean(published),
  });
  course.lessonIds = [...(course.lessonIds || []), lesson._id];
  await course.save();
  staffActivity(req, String(course._id), 'Curriculum: new module', `Added module “${lesson.title}”.`);
  res.status(201).json({ lesson });
}

async function updateLesson(req, res) {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }
  await assertCourseManage(req, lesson.courseId);
  const { title, order, description, published } = req.body;
  if (title !== undefined) lesson.title = title;
  if (description !== undefined) lesson.description = description;
  if (order !== undefined) lesson.order = order;
  if (published !== undefined) lesson.published = published;
  await lesson.save();
  staffActivity(req, String(lesson.courseId), 'Curriculum: module updated', `Updated module “${lesson.title}”.`);
  res.json({ lesson });
}

async function deleteLesson(req, res) {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }
  await assertCourseManage(req, lesson.courseId);
  await SubLesson.deleteMany({ lessonId: lesson._id });
  await Course.updateOne({ _id: lesson.courseId }, { $pull: { lessonIds: lesson._id } });
  const titleSnap = lesson.title;
  await lesson.deleteOne();
  staffActivity(req, String(lesson.courseId), 'Curriculum: module removed', `Removed module “${titleSnap}”.`);
  res.json({ ok: true });
}

async function reorderLessons(req, res) {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }
  await assertCourseManage(req, lesson.courseId);
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    res.status(400).json({ error: 'orderedIds array required' });
    return;
  }
  const bulk = orderedIds.map((id, idx) => ({
    updateOne: { filter: { _id: id, courseId: lesson.courseId }, update: { $set: { order: idx } } },
  }));
  if (bulk.length) await Lesson.bulkWrite(bulk);
  const course = await Course.findById(lesson.courseId);
  course.lessonIds = orderedIds;
  await course.save();
  staffActivity(req, String(lesson.courseId), 'Curriculum: module order changed', 'Reordered course modules.');
  res.json({ ok: true });
}

async function createSubLesson(req, res) {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }
  await assertCourseManage(req, lesson.courseId);
  const {
    title,
    description,
    order,
    type,
    cloudinaryPublicId,
    cloudinaryAssetId,
    fileUrl,
    published,
    estimatedMinutes,
  } = req.body;
  if (!title || !type) {
    res.status(400).json({ error: 'title and type are required' });
    return;
  }
  const sub = await SubLesson.create({
    lessonId: lesson._id,
    courseId: lesson.courseId,
    title,
    description,
    order: order ?? (await SubLesson.countDocuments({ lessonId: lesson._id })),
    type,
    cloudinaryPublicId,
    cloudinaryAssetId,
    fileUrl,
    published: Boolean(published),
    estimatedMinutes: estimatedMinutes ?? 0,
  });
  lesson.subLessonIds = [...(lesson.subLessonIds || []), sub._id];
  await lesson.save();
  staffActivity(req, String(lesson.courseId), 'Curriculum: new material', `Added “${sub.title}” (${sub.type}) in “${lesson.title}”.`);
  res.status(201).json({ subLesson: sub });
}

async function updateSubLesson(req, res) {
  const sub = await SubLesson.findById(req.params.id);
  if (!sub) {
    res.status(404).json({ error: 'Sub-lesson not found' });
    return;
  }
  await assertCourseManage(req, sub.courseId);
  const fields = [
    'title',
    'description',
    'order',
    'type',
    'cloudinaryAssetId',
    'cloudinaryPublicId',
    'fileUrl',
    'assessmentId',
    'published',
    'estimatedMinutes',
  ];
  for (const f of fields) {
    if (req.body[f] !== undefined) sub[f] = req.body[f];
  }
  await sub.save();
  staffActivity(req, String(sub.courseId), 'Curriculum: material updated', `Updated “${sub.title}”.`);
  res.json({ subLesson: sub });
}

async function deleteSubLesson(req, res) {
  const sub = await SubLesson.findById(req.params.id);
  if (!sub) {
    res.status(404).json({ error: 'Sub-lesson not found' });
    return;
  }
  await assertCourseManage(req, sub.courseId);
  await Lesson.updateOne({ _id: sub.lessonId }, { $pull: { subLessonIds: sub._id } });
  const subTitle = sub.title;
  const cid = String(sub.courseId);
  await sub.deleteOne();
  staffActivity(req, cid, 'Curriculum: material removed', `Removed material “${subTitle}”.`);
  res.json({ ok: true });
}

async function getSubLessonVideo(req, res) {
  const sub = await SubLesson.findById(req.params.id);
  if (!sub || sub.type !== 'video') {
    res.status(404).json({ error: 'Video sub-lesson not found' });
    return;
  }
  const course = await getCourseForUser(sub.courseId, req.user);
  if (!course) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (req.user.role === 'student') {
    const session = await AgentSession.findOne({
      studentId: req.user._id,
      status: 'active',
    }).lean();
    if (!session) {
      res.status(403).json({ error: 'Security Agent session required' });
      return;
    }
  }
  if (!sub.cloudinaryPublicId) {
    res.status(400).json({ error: 'Video not uploaded yet' });
    return;
  }
  try {
    const url = signedVideoUrl(sub.cloudinaryPublicId, { expiresSeconds: 600 });
    res.json({ url, expiresInSeconds: 600 });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
}

module.exports = {
  listLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  createSubLesson,
  updateSubLesson,
  deleteSubLesson,
  getSubLessonVideo,
};
