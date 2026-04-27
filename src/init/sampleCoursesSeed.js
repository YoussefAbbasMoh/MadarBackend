/**
 * Shared sample curriculum: 10 courses (mixed fields), lessons, sub-lessons (video/pdf/image), quizzes.
 * Used by `npm run seed:samples` and by API startup when the seed instructor owns no courses yet.
 */

const { hashPassword } = require('../utils/password');
const { normalizePhoneE164 } = require('../utils/phone');

const User = require('../models/User');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const SubLesson = require('../models/SubLesson');
const Assessment = require('../models/Assessment');
const Progress = require('../models/Progress');
const Submission = require('../models/Submission');

const {
  SEED_INSTRUCTOR_EMAIL,
  SEED_SUPER_ADMIN_EMAIL,
  SEED_STUDENT_EMAIL,
  buildSeedStudentDefs,
  courses: SAMPLE_COURSES,
} = require('../../scripts/sample-courses-data');

const SEED_STAFF_EMAILS = new Set([SEED_INSTRUCTOR_EMAIL, SEED_SUPER_ADMIN_EMAIL]);

async function ensureUser({ email, role, name, phone }, seedPassword) {
  const phoneNorm = phone ? normalizePhoneE164(phone) : undefined;
  const query = phoneNorm ? { $or: [{ email }, { phone: phoneNorm }, { phone }] } : { email };
  let user = await User.findOne(query);
  if (user) {
    if (email && user.email !== email) {
      user.email = email;
    }
    if (phoneNorm && user.phone !== phoneNorm) {
      user.phone = phoneNorm;
    }
    if (email && SEED_STAFF_EMAILS.has(email) && ['instructor', 'super_admin', 'teacher', 'doctor'].includes(role)) {
      user.role = role;
      user.name = name || user.name;
      user.passwordHash = await hashPassword(seedPassword);
    } else if (['instructor', 'super_admin', 'teacher', 'doctor'].includes(role) && !user.passwordHash) {
      user.passwordHash = await hashPassword(seedPassword);
    }
    await user.save();
    return user;
  }
  if (role === 'student') {
    return User.create({
      phone: phoneNorm || undefined,
      email: email || undefined,
      role,
      name,
    });
  }
  const passwordHash = await hashPassword(seedPassword);
  return User.create({
    email,
    role,
    name,
    passwordHash,
  });
}

async function wipeInstructorCourses(instructorId) {
  const owned = await Course.find({ ownerId: instructorId }).select('_id').lean();
  const ids = owned.map((c) => c._id);
  if (!ids.length) return;

  const assessments = await Assessment.find({ courseId: { $in: ids } }).select('_id').lean();
  const aIds = assessments.map((a) => a._id);
  if (aIds.length) await Submission.deleteMany({ assessmentId: { $in: aIds } });
  await Assessment.deleteMany({ courseId: { $in: ids } });
  await SubLesson.deleteMany({ courseId: { $in: ids } });
  await Lesson.deleteMany({ courseId: { $in: ids } });
  await Progress.deleteMany({ courseId: { $in: ids } });
  await Course.deleteMany({ _id: { $in: ids } });

  await User.updateMany({ assignedCourses: { $in: ids } }, { $pull: { assignedCourses: { $in: ids } } });
}

async function seedCourse(def, instructor) {
  const language = def.key === 'arabic-academic-writing' ? ['ar', 'en', 'bilingual'] : ['en'];

  const course = await Course.create({
    ownerId: instructor._id,
    ownerRole: 'instructor',
    title: def.title,
    category: def.category,
    description: def.description,
    coverImage: def.coverImage,
    language,
    maxStudents: 200,
    certificateEnabled: Boolean(def.certificateEnabled),
    price: def.price !== undefined && def.price !== null ? Number(def.price) : 0,
    currency: (def.currency || 'EGP').toString().trim().toUpperCase(),
    status: 'active',
    lessonIds: [],
    enrolledStudentIds: [],
    assistants: [],
  });

  const lessonIds = [];

  for (let li = 0; li < def.lessons.length; li++) {
    const ldef = def.lessons[li];
    const lesson = await Lesson.create({
      courseId: course._id,
      title: ldef.title,
      order: li,
      description: ldef.description || '',
      published: ldef.published !== false,
      subLessonIds: [],
    });

    const subIds = [];
    let subOrder = 0;

    for (const s of ldef.subLessons || []) {
      const sub = await SubLesson.create({
        lessonId: lesson._id,
        courseId: course._id,
        title: s.title,
        description: s.description || '',
        order: subOrder++,
        type: s.type,
        fileUrl: s.fileUrl,
        published: s.published !== false,
        estimatedMinutes: s.estimatedMinutes ?? 0,
      });
      subIds.push(sub._id);
    }

    if (ldef.quiz) {
      const quizSub = await SubLesson.create({
        lessonId: lesson._id,
        courseId: course._id,
        title: `Graded: ${ldef.title} — check`,
        description: 'Answer all questions. This is sample assessment data.',
        order: subOrder++,
        type: 'doc',
        published: ldef.quiz.published !== false,
        estimatedMinutes: ldef.quiz.timerMinutes || 10,
      });
      subIds.push(quizSub._id);

      const assessment = await Assessment.create({
        subLessonId: quizSub._id,
        courseId: course._id,
        type: ldef.quiz.type || 'quiz',
        questions: ldef.quiz.questions || [],
        timerMinutes: ldef.quiz.timerMinutes ?? 0,
        maxAttempts: ldef.quiz.maxAttempts ?? 3,
        showResultsImmediately: true,
        published: ldef.quiz.published !== false,
        fileUploadEnabled: Boolean(ldef.quiz.fileUploadEnabled),
        lateSubmissionAllowed: false,
        gradeWeight: 1,
      });
      quizSub.assessmentId = assessment._id;
      await quizSub.save();
    }

    lesson.subLessonIds = subIds;
    await lesson.save();
    lessonIds.push(lesson._id);
  }

  course.lessonIds = lessonIds;
  await course.save();
  return course;
}

/**
 * Ensures seed staff + 10 students, wipes seed instructor's prior sample courses, creates 10 courses with lessons/materials,
 * enrolls each seed student in one sample course by index (student 01 → first course, …), creates Progress rows.
 *
 * @param {{ log?: Pick<Console, 'log'> }} | undefined} options
 */
async function seedFullSampleCurriculum(options = {}) {
  const log = options.log || console;
  const seedPassword = process.env.SEED_ACCOUNT_PASSWORD || 'admin1234';

  const instructor = await ensureUser(
    {
      email: SEED_INSTRUCTOR_EMAIL,
      role: 'instructor',
      name: 'Sample Instructor (Seed)',
    },
    seedPassword,
  );
  await ensureUser(
    {
      email: SEED_SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      name: 'Sample Super Admin (Seed)',
    },
    seedPassword,
  );

  const studentDefs = buildSeedStudentDefs();
  const students = [];
  for (const def of studentDefs) {
    if (def.email === SEED_STUDENT_EMAIL) {
      await User.updateMany({ email: SEED_STUDENT_EMAIL }, { $set: { phone: def.phone } });
    }
    students.push(
      await ensureUser(
        {
          email: def.email,
          phone: def.phone,
          role: 'student',
          name: def.name,
        },
        seedPassword,
      ),
    );
  }

  await wipeInstructorCourses(instructor._id);
  log.log('Cleared previous courses for', SEED_INSTRUCTOR_EMAIL);

  const created = [];
  for (const def of SAMPLE_COURSES) {
    const course = await seedCourse(def, instructor);
    created.push(course);
    log.log('Created:', course.title, `(${course._id})`);
  }

  if (created.length && students.length) {
    const nPair = Math.min(students.length, created.length);
    for (let i = 0; i < nPair; i += 1) {
      const st = students[i];
      const course = created[i];
      await Course.updateOne({ _id: course._id }, { $addToSet: { enrolledStudentIds: st._id } });
      await User.updateOne({ _id: st._id }, { $addToSet: { assignedCourses: course._id } });
      await Progress.findOneAndUpdate(
        { studentId: st._id, courseId: course._id },
        { $setOnInsert: { completedSubLessons: [], overallPercent: 0 } },
        { upsert: true, new: true },
      );
    }
    for (let i = nPair; i < students.length; i += 1) {
      const st = students[i];
      const course = created[i % created.length];
      await Course.updateOne({ _id: course._id }, { $addToSet: { enrolledStudentIds: st._id } });
      await User.updateOne({ _id: st._id }, { $addToSet: { assignedCourses: course._id } });
      await Progress.findOneAndUpdate(
        { studentId: st._id, courseId: course._id },
        { $setOnInsert: { completedSubLessons: [], overallPercent: 0 } },
        { upsert: true, new: true },
      );
    }
  }

  log.log('\n--- Sample accounts ---');
  log.log('Super admin:', SEED_SUPER_ADMIN_EMAIL, '| password:', seedPassword);
  log.log('Instructor:', SEED_INSTRUCTOR_EMAIL, '| password:', seedPassword);
  log.log('Students (10) — phone OTP (dev often accepts 000000); each row is enrolled in one sample course:');
  for (let i = 0; i < studentDefs.length; i += 1) {
    const def = studentDefs[i];
    const title = created[i] ? created[i].title : `(extra → ${created[i % created.length]?.title})`;
    log.log(' ', def.name, '|', def.phone, def.email ? `| ${def.email}` : '', '|', title);
  }
  log.log(
    `\nSplit roster: ${students.length} seed students mapped to ${created.length} courses (one primary seat per index; extras round-robin).\n`,
  );

  return { instructor, students, courses: created };
}

module.exports = {
  seedFullSampleCurriculum,
  SEED_INSTRUCTOR_EMAIL,
};
