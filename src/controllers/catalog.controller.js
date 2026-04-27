const { isValidDbId } = require('../lib/idCompat');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const SubLesson = require('../models/SubLesson');
const User = require('../models/User');
const { publicPortfolioFromDoc } = require('../utils/instructorPortfolio');

/** Owners of at least one active course who may appear on the public instructor directory. */
const DIRECTORY_ROLES = ['instructor', 'teacher', 'doctor', 'super_admin'];

function normalizeCourse(c) {
  if (!c) return c;
  return { ...c, price: c.price ?? 0, currency: c.currency || 'EGP' };
}

async function listCourses(req, res) {
  const courses = await Course.find({ status: 'active' })
    .select('_id title description category coverImage galleryImages price currency certificateEnabled language updatedAt')
    .sort({ updatedAt: -1 })
    .lean();
  const ids = courses.map((c) => c._id);
  let lessonCountByCourse = new Map();
  if (ids.length) {
    const rows = await Lesson.aggregate([
      { $match: { courseId: { $in: ids } } },
      { $group: { _id: '$courseId', lessonCount: { $sum: 1 } } },
    ]);
    lessonCountByCourse = new Map(rows.map((r) => [String(r._id), r.lessonCount]));
  }
  const items = courses.map((c) => {
    const n = normalizeCourse(c);
    return {
      _id: c._id,
      title: c.title,
      description: c.description,
      category: c.category,
      coverImage: c.coverImage,
      galleryImages: c.galleryImages || [],
      price: n.price,
      currency: n.currency,
      certificateEnabled: c.certificateEnabled,
      language: c.language,
      updatedAt: c.updatedAt,
      lessonCount: lessonCountByCourse.get(String(c._id)) || 0,
    };
  });
  res.json({ items });
}

async function getCourse(req, res) {
  const { id } = req.params;
  if (!isValidDbId(id)) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }
  const course = await Course.findOne({ _id: id, status: 'active' }).lean();
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }
  const owner = await User.findById(course.ownerId).select('name instructorPortfolio').lean();
  const portfolio = publicPortfolioFromDoc(owner?.instructorPortfolio);
  const lessons = await Lesson.find({ courseId: course._id }).sort({ order: 1 }).select('title order description published').lean();
  const subLessons = await SubLesson.find({ courseId: course._id })
    .sort({ order: 1 })
    .select('lessonId title description order type published estimatedMinutes')
    .lean();
  const subByLesson = new Map();
  for (const s of subLessons) {
    const key = String(s.lessonId);
    const list = subByLesson.get(key) || [];
    list.push({
      title: s.title,
      description: s.description,
      order: s.order,
      type: s.type,
      published: s.published,
      estimatedMinutes: s.estimatedMinutes,
    });
    subByLesson.set(key, list);
  }
  const tree = lessons.map((l) => ({
    _id: l._id,
    title: l.title,
    order: l.order,
    description: l.description,
    published: l.published,
    subLessons: subByLesson.get(String(l._id)) || [],
  }));
  const n = normalizeCourse(course);
  res.json({
    course: {
      _id: course._id,
      title: course.title,
      description: course.description,
      category: course.category,
      coverImage: course.coverImage,
      galleryImages: course.galleryImages || [],
      price: n.price,
      currency: n.currency,
      certificateEnabled: course.certificateEnabled,
      language: course.language,
      instructorName: owner?.name || 'Instructor',
      instructor: {
        name: owner?.name || 'Instructor',
        portfolio,
      },
    },
    lessons: tree,
  });
}

/**
 * GET /catalog/instructors — distinct owners of active courses with public portfolio payload.
 */
async function listInstructors(req, res) {
  const ownerIds = await Course.distinct('ownerId', { status: 'active' });
  if (!ownerIds.length) {
    res.json({ items: [] });
    return;
  }
  const users = await User.find({
    _id: { $in: ownerIds },
    role: { $in: DIRECTORY_ROLES },
  })
    .select('name role instructorPortfolio')
    .lean();

  const counts = await Course.aggregate([
    { $match: { status: 'active', ownerId: { $in: users.map((u) => u._id) } } },
    { $group: { _id: '$ownerId', activeCourseCount: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.activeCourseCount]));

  const items = users
    .map((u) => ({
      _id: u._id,
      name: u.name || 'Instructor',
      role: u.role,
      portfolio: publicPortfolioFromDoc(u.instructorPortfolio),
      activeCourseCount: countMap.get(String(u._id)) || 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  res.json({ items });
}

/**
 * GET /catalog/instructors/:id — full public portfolio + active courses for marketing profile page.
 */
async function getInstructor(req, res) {
  const { id } = req.params;
  if (!isValidDbId(id)) {
    res.status(404).json({ error: 'Instructor not found' });
    return;
  }
  const ownsActive = await Course.exists({ ownerId: id, status: 'active' });
  if (!ownsActive) {
    res.status(404).json({ error: 'Instructor not found' });
    return;
  }
  const user = await User.findById(id).select('name role instructorPortfolio').lean();
  if (!user || !DIRECTORY_ROLES.includes(user.role)) {
    res.status(404).json({ error: 'Instructor not found' });
    return;
  }
  const courses = await Course.find({ ownerId: id, status: 'active' })
    .select('_id title description category coverImage price currency certificateEnabled')
    .sort({ updatedAt: -1 })
    .lean();

  res.json({
    instructor: {
      _id: user._id,
      name: user.name || 'Instructor',
      role: user.role,
      portfolio: publicPortfolioFromDoc(user.instructorPortfolio),
    },
    courses: courses.map((c) => {
      const n = normalizeCourse(c);
      return {
        _id: c._id,
        title: c.title,
        description: c.description,
        category: c.category,
        coverImage: c.coverImage,
        price: n.price,
        currency: n.currency,
        certificateEnabled: c.certificateEnabled,
      };
    }),
  });
}

module.exports = { listCourses, getCourse, listInstructors, getInstructor };
