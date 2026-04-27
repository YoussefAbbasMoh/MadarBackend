const { isValidDbId } = require('../lib/idCompat');
const Course = require('../models/Course');
const User = require('../models/User');
const Progress = require('../models/Progress');
const Submission = require('../models/Submission');
const {
  canEditCourseSettings,
  getCourseForUser,
  canViewStudentRoster,
  canViewCourseAnalytics,
} = require('../utils/courseAccess');
const { sanitizeAssistantPermissions } = require('../constants/assistantPermissions');
const { PLATFORM_STUDENT_VIEWERS } = require('../constants/roles');
const NT = require('../constants/notificationTypes');
const { createInAppNotification } = require('../services/inAppNotify');
const { notifyCourseTeamExceptActor, actorLabel } = require('../services/courseTeamActivity');

async function courseOr403(req) {
  const course = await Course.findById(req.params.courseId);
  if (!course) {
    const e = new Error('Course not found');
    e.status = 404;
    throw e;
  }
  const visible = await getCourseForUser(req.params.courseId, req.user);
  if (!visible) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }
  return course;
}

async function listStudents(req, res) {
  const course = await courseOr403(req);
  if (!PLATFORM_STUDENT_VIEWERS.includes(req.user.role) && !canViewStudentRoster(course, req.user)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const ids = course.enrolledStudentIds || [];
  const users = await User.find({ _id: { $in: ids } }).lean();
  const progress = await Progress.find({ courseId: course._id }).lean();
  const pmap = new Map(progress.map((p) => [String(p.studentId), p]));
  const items = users.map((u) => ({
    user: u,
    progress: pmap.get(String(u._id)) || null,
  }));
  res.json({ items });
}

async function enrollStudent(req, res) {
  const course = await courseOr403(req);
  if (!canEditCourseSettings(course, req.user) && req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { userId } = req.body;
  if (!userId || !isValidDbId(userId)) {
    res.status(400).json({ error: 'userId required' });
    return;
  }
  await Course.updateOne({ _id: course._id }, { $addToSet: { enrolledStudentIds: userId } });
  await User.findByIdAndUpdate(userId, { $addToSet: { assignedCourses: course._id } });
  await Progress.findOneAndUpdate(
    { studentId: userId, courseId: course._id },
    { $setOnInsert: { completedSubLessons: [], overallPercent: 0 } },
    { upsert: true }
  );
  try {
    const ct = course.title || 'your course';
    await createInAppNotification({
      userId,
      type: NT.COURSE_ENROLLED,
      title: `Enrolled in ${ct}`,
      body: 'Open your class to continue learning.',
      href: `/student/classes/${course._id}`,
      meta: { courseId: String(course._id) },
    });
    await notifyCourseTeamExceptActor(course._id, req.user._id, {
      type: NT.DASHBOARD_ACTIVITY,
      title: 'Roster: learner added',
      body: `${actorLabel(req.user)} enrolled a student in ${ct}.`,
      href: `/staff/courses/${course._id}`,
      meta: { courseId: String(course._id), studentId: String(userId), scope: 'roster' },
    });
  } catch (e) {
    console.warn('[courseScope.enrollStudent] notify:', e.message);
  }
  res.json({ ok: true });
}

async function removeStudent(req, res) {
  const course = await courseOr403(req);
  if (!canEditCourseSettings(course, req.user) && req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  await Course.updateOne({ _id: course._id }, { $pull: { enrolledStudentIds: req.params.userId } });
  await User.findByIdAndUpdate(req.params.userId, { $pull: { assignedCourses: course._id } });
  try {
    const ct = course.title || 'course';
    await notifyCourseTeamExceptActor(course._id, req.user._id, {
      type: NT.DASHBOARD_ACTIVITY,
      title: 'Roster: learner removed',
      body: `${actorLabel(req.user)} removed a student from ${ct}.`,
      href: `/staff/courses/${course._id}`,
      meta: { courseId: String(course._id), studentId: String(req.params.userId), scope: 'roster' },
    });
  } catch (e) {
    console.warn('[courseScope.removeStudent] notify:', e.message);
  }
  res.json({ ok: true });
}

async function analytics(req, res) {
  const course = await courseOr403(req);
  if (!canViewCourseAnalytics(course, req.user)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const enrolled = (course.enrolledStudentIds || []).length;
  const subs = await Submission.countDocuments({ courseId: course._id, status: 'graded' });
  res.json({ enrollments: enrolled, gradedSubmissions: subs });
}

async function addAssistant(req, res) {
  const course = await courseOr403(req);
  if (!canEditCourseSettings(course, req.user)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { userId, permissions } = req.body;
  if (!userId || !isValidDbId(String(userId))) {
    res.status(400).json({ error: 'valid userId required' });
    return;
  }
  const assistantUser = await User.findById(userId).select('role ownedBy').lean();
  if (!assistantUser || assistantUser.role !== 'assistant') {
    res.status(400).json({ error: 'userId must be an account with role assistant' });
    return;
  }
  if (req.user.role !== 'super_admin' && String(assistantUser.ownedBy || '') !== String(course.ownerId)) {
    res.status(403).json({ error: 'That assistant is not registered under this course owner' });
    return;
  }
  const userOid = String(userId);
  const perms = sanitizeAssistantPermissions(permissions);
  const updExisting = await Course.updateOne(
    { _id: course._id, 'assistants.userId': userOid },
    { $set: { 'assistants.$.permissions': perms } }
  );
  if (!updExisting.matchedCount) {
    await Course.updateOne({ _id: course._id }, { $push: { assistants: { userId: userOid, permissions: perms } } });
  }
  await User.findByIdAndUpdate(userId, { $addToSet: { assignedCourses: course._id } });
  try {
    if (!updExisting.matchedCount) {
      await createInAppNotification({
        userId,
        type: NT.ASSISTANT_ADDED,
        title: `Added to ${course.title || 'a course'}`,
        body: 'You now have access with the privileges your instructor set. Open the course in your workspace.',
        href: `/staff/courses/${course._id}`,
        meta: { courseId: String(course._id) },
      });
    }
  } catch (e) {
    console.warn('[courseScope.addAssistant] notify:', e.message);
  }
  res.json({ ok: true });
}

async function patchAssistant(req, res) {
  const course = await courseOr403(req);
  if (!canEditCourseSettings(course, req.user)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const targetId = req.params.userId;
  if (!isValidDbId(String(targetId))) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }
  const assistantUser = await User.findById(targetId).select('role ownedBy').lean();
  if (!assistantUser || assistantUser.role !== 'assistant') {
    res.status(400).json({ error: 'Target must be an assistant account' });
    return;
  }
  if (req.user.role !== 'super_admin' && String(assistantUser.ownedBy || '') !== String(course.ownerId)) {
    res.status(403).json({ error: 'That assistant is not registered under this course owner' });
    return;
  }
  const onCourse = (course.assistants || []).some((a) => String(a.userId) === String(targetId));
  if (!onCourse) {
    res.status(404).json({ error: 'Assistant is not on this course' });
    return;
  }
  const perms = sanitizeAssistantPermissions(req.body.permissions);
  const userOid = String(targetId);
  await Course.updateOne(
    { _id: course._id, 'assistants.userId': userOid },
    { $set: { 'assistants.$.permissions': perms } }
  );
  try {
    const ct = course.title || 'course';
    await createInAppNotification({
      userId: targetId,
      type: NT.DASHBOARD_ACTIVITY,
      title: 'Your course privileges changed',
      body: `${actorLabel(req.user)} updated your permissions on ${ct}.`,
      href: `/staff/courses/${course._id}`,
      meta: { courseId: String(course._id), scope: 'assistants' },
    });
    await notifyCourseTeamExceptActor(course._id, req.user._id, {
      type: NT.DASHBOARD_ACTIVITY,
      title: 'Assistant permissions updated',
      body: `${actorLabel(req.user)} changed assistant access on ${ct}.`,
      href: `/staff/courses/${course._id}`,
      meta: { courseId: String(course._id), scope: 'assistants' },
      extraExcludeUserIds: [String(targetId)],
    });
  } catch (e) {
    console.warn('[courseScope.patchAssistant] notify:', e.message);
  }
  res.json({ ok: true, permissions: perms });
}

async function removeAssistant(req, res) {
  const course = await courseOr403(req);
  if (!canEditCourseSettings(course, req.user)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const removedId = req.params.userId;
  await Course.updateOne({ _id: course._id }, { $pull: { assistants: { userId: removedId } } });
  await User.findByIdAndUpdate(removedId, { $pull: { assignedCourses: course._id } });
  try {
    const ct = course.title || 'course';
    await createInAppNotification({
      userId: removedId,
      type: NT.DASHBOARD_ACTIVITY,
      title: 'Removed from course team',
      body: `You no longer have staff access to ${ct}.`,
      href: '/staff/courses',
      meta: { courseId: String(course._id), scope: 'assistants' },
    });
    await notifyCourseTeamExceptActor(course._id, req.user._id, {
      type: NT.DASHBOARD_ACTIVITY,
      title: 'Assistant removed',
      body: `${actorLabel(req.user)} removed an assistant from ${ct}.`,
      href: `/staff/courses/${course._id}`,
      meta: { courseId: String(course._id), scope: 'assistants' },
      extraExcludeUserIds: [String(removedId)],
    });
  } catch (e) {
    console.warn('[courseScope.removeAssistant] notify:', e.message);
  }
  res.json({ ok: true });
}

module.exports = {
  listStudents,
  enrollStudent,
  removeStudent,
  analytics,
  addAssistant,
  patchAssistant,
  removeAssistant,
};
