/**
 * MUDAR: create demo tenant, client super admin, backfill tenantId / classroom kind, optional seed.
 *
 * Usage (from backend folder):
 *   npm run mudar:bootstrap-tenant
 *
 * Requires DATABASE_URL. Runs `npx prisma migrate deploy` when possible, then idempotent data steps.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const { execSync } = require('child_process');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { connectDb, disconnectPrisma } = require('../src/config/db');
const { getModels, getSequelize } = require('../src/db/prisma');
const { hashPassword } = require('../src/utils/password');
const env = require('../src/config/env');

const TENANT_SLUG = 'demo';
const TENANT_NAME = 'Demo Academy';
const ADMIN_EMAIL = 'admin@demo.com';
const ADMIN_PASSWORD = '123456';
const ADMIN_ROLE = 'client_super_admin';

const PLATFORM_ROLES = ['mudar_super_admin', 'super_admin'];

function tryMigrateDeploy() {
  try {
    execSync('npx prisma migrate deploy', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: process.env,
    });
  } catch {
    console.warn(
      '[mudar:bootstrap-tenant] `npx prisma migrate deploy` failed (offline DB or drift). Apply SQL migrations manually if columns are missing.',
    );
  }
}

async function backfillDenormalizedTenantIds(sequelize, tenantId) {
  const esc = (v) => sequelize.escape(v);
  const tid = esc(tenantId);
  const statements = [
    `UPDATE "Lesson" l SET "tenantId" = c."tenantId" FROM "Course" c WHERE l."courseId" = c."id" AND l."tenantId" IS NULL AND c."tenantId" = ${tid}`,
    `UPDATE "SubLesson" s SET "tenantId" = c."tenantId" FROM "Course" c WHERE s."courseId" = c."id" AND s."tenantId" IS NULL AND c."tenantId" = ${tid}`,
    `UPDATE "Assessment" a SET "tenantId" = c."tenantId" FROM "Course" c WHERE a."courseId" = c."id" AND a."tenantId" IS NULL AND c."tenantId" = ${tid}`,
    `UPDATE "Submission" s SET "tenantId" = c."tenantId" FROM "Course" c WHERE s."courseId" = c."id" AND s."tenantId" IS NULL AND c."tenantId" = ${tid}`,
    `UPDATE "Progress" p SET "tenantId" = c."tenantId" FROM "Course" c WHERE p."courseId" = c."id" AND p."tenantId" IS NULL AND c."tenantId" = ${tid}`,
    `UPDATE "Message" m SET "tenantId" = c."tenantId" FROM "Course" c WHERE m."courseId" = c."id" AND m."tenantId" IS NULL AND c."tenantId" = ${tid}`,
    `UPDATE "LiveSession" ls SET "tenantId" = c."tenantId" FROM "Course" c WHERE ls."courseId" = c."id" AND ls."tenantId" IS NULL AND c."tenantId" = ${tid}`,
    `UPDATE "CourseEnrollment" ce SET "tenantId" = c."tenantId" FROM "Course" c WHERE ce."courseId" = c."id" AND ce."tenantId" IS NULL AND c."tenantId" = ${tid}`,
    `UPDATE "CourseAssistant" ca SET "tenantId" = c."tenantId" FROM "Course" c WHERE ca."courseId" = c."id" AND ca."tenantId" IS NULL AND c."tenantId" = ${tid}`,
    `UPDATE "UserAssignedCourse" uac SET "tenantId" = c."tenantId" FROM "Course" c WHERE uac."courseId" = c."id" AND uac."tenantId" IS NULL AND c."tenantId" = ${tid}`,
    `UPDATE "Notification" n SET "tenantId" = u."tenantId" FROM "User" u WHERE n."userId" = u."id" AND n."tenantId" IS NULL AND u."tenantId" = ${tid}`,
    `UPDATE "Transaction" t SET "tenantId" = c."tenantId" FROM "Course" c WHERE t."courseId" IS NOT NULL AND t."courseId" = c."id" AND t."tenantId" IS NULL AND c."tenantId" = ${tid}`,
    `UPDATE "Transaction" t SET "tenantId" = u."tenantId" FROM "User" u WHERE t."tenantId" IS NULL AND t."studentId" = u."id" AND u."tenantId" = ${tid}`,
    `UPDATE "AgentSession" a SET "tenantId" = u."tenantId" FROM "User" u WHERE a."studentId" = u."id" AND a."tenantId" IS NULL AND u."tenantId" = ${tid}`,
    `UPDATE "Package" SET "tenantId" = ${tid} WHERE "tenantId" IS NULL`,
    `UPDATE "PromoCode" SET "tenantId" = ${tid} WHERE "tenantId" IS NULL`,
  ];
  for (const sql of statements) {
    try {
      await sequelize.query(sql);
    } catch (e) {
      if (e && String(e.message).includes('column') && String(e.message).includes('does not exist')) {
        console.warn('[mudar:bootstrap-tenant] Skipping statement (column missing — run migrations):', sql.slice(0, 88));
        continue;
      }
      throw e;
    }
  }
}

async function seedSampleClassroom(models, tenantId) {
  const { User, Course, Lesson, SubLesson, Assessment, CourseEnrollment } = models;
  const teacherEmail = 'teacher@demo.com';
  let teacher = await User.findOne({ where: { email: teacherEmail, tenantId } });
  if (!teacher) {
    teacher = await User.create({
      id: uuidv4(),
      email: teacherEmail,
      name: 'Demo Teacher',
      role: 'teacher',
      tenantId,
      passwordHash: await hashPassword(ADMIN_PASSWORD),
    });
  }

  const studentEmails = ['student1@demo.com', 'student2@demo.com', 'student3@demo.com'];
  const students = [];
  for (let i = 0; i < studentEmails.length; i += 1) {
    const em = studentEmails[i];
    let s = await User.findOne({ where: { email: em, tenantId } });
    if (!s) {
      s = await User.create({
        id: uuidv4(),
        email: em,
        name: `Demo Student ${i + 1}`,
        role: 'student',
        tenantId,
        phone: `+201555000${String(i + 1).padStart(3, '0')}`,
      });
    }
    students.push(s);
  }

  let course = await Course.findOne({
    where: { tenantId, title: 'Introduction Classroom (sample)' },
  });
  if (!course) {
    course = await Course.create({
      id: uuidv4(),
      tenantId,
      kind: 'classroom',
      ownerId: teacher.id,
      ownerRole: 'teacher',
      title: 'Introduction Classroom (sample)',
      category: 'General',
      description: 'Sample classroom content after MUDAR bootstrap.',
      status: 'active',
      language: ['en'],
      maxStudents: 50,
      certificateEnabled: false,
      price: 0,
      currency: 'EGP',
      packageIds: [],
      lessonIds: [],
    });
  } else if (course.kind !== 'classroom') {
    await course.update({ kind: 'classroom' });
  }

  let lesson = await Lesson.findOne({ where: { courseId: course.id, title: 'Welcome lesson' } });
  if (!lesson) {
    lesson = await Lesson.create({
      id: uuidv4(),
      courseId: course.id,
      tenantId,
      title: 'Welcome lesson',
      order: 0,
      description: 'Getting started',
      published: true,
      subLessonIds: [],
    });
  }

  let sub = await SubLesson.findOne({ where: { lessonId: lesson.id, title: 'Overview' } });
  if (!sub) {
    sub = await SubLesson.create({
      id: uuidv4(),
      lessonId: lesson.id,
      courseId: course.id,
      tenantId,
      title: 'Overview',
      description: 'Read this overview to continue.',
      order: 0,
      type: 'doc',
      published: true,
      estimatedMinutes: 5,
    });
  }

  const existingQuiz = await Assessment.findOne({ where: { subLessonId: sub.id } });
  if (!existingQuiz) {
    await Assessment.create({
      id: uuidv4(),
      subLessonId: sub.id,
      courseId: course.id,
      tenantId,
      type: 'quiz',
      label: 'Quick check',
      questions: [
        {
          id: 'q1',
          type: 'mcq',
          prompt: 'What is 2 + 2?',
          options: [
            { id: 'a', label: '3' },
            { id: 'b', label: '4' },
            { id: 'c', label: '5' },
          ],
          correctOptionId: 'b',
          points: 1,
        },
      ],
      timerMinutes: 10,
      published: true,
      passingScore: 60,
    });
  }

  for (const s of students) {
    const ex = await CourseEnrollment.findOne({ where: { courseId: course.id, studentId: s.id } });
    if (!ex) {
      await CourseEnrollment.create({
        courseId: course.id,
        studentId: s.id,
        tenantId,
        createdAt: new Date(),
      });
    } else if (!ex.tenantId) {
      await ex.update({ tenantId });
    }
  }

  return { teacher, students, course };
}

async function main() {
  tryMigrateDeploy();
  await connectDb();
  const sequelize = getSequelize();
  const models = getModels();
  const { Tenant, User, Course } = models;

  const [tenant] = await Tenant.findOrCreate({
    where: { slug: TENANT_SLUG },
    defaults: {
      id: uuidv4(),
      name: TENANT_NAME,
      status: 'active',
      branding: {},
      settings: {},
    },
  });
  if (tenant.name !== TENANT_NAME) await tenant.update({ name: TENANT_NAME });
  const tenantId = tenant.id;

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  let admin = await User.findOne({ where: { email: ADMIN_EMAIL, tenantId } });
  if (!admin) {
    admin = await User.create({
      id: uuidv4(),
      email: ADMIN_EMAIL,
      name: 'Demo Client Admin',
      role: ADMIN_ROLE,
      tenantId,
      passwordHash,
    });
  } else {
    await admin.update({ passwordHash, role: ADMIN_ROLE, tenantId });
  }

  await User.update(
    { tenantId },
    { where: { tenantId: null, role: { [Op.notIn]: PLATFORM_ROLES } } },
  );

  await Course.update({ tenantId }, { where: { tenantId: null } });
  try {
    await Course.update({ kind: 'classroom' }, { where: { [Op.or]: [{ kind: null }, { kind: '' }] } });
  } catch (e) {
    if (!String(e.message || '').includes('kind')) throw e;
    console.warn('[mudar:bootstrap-tenant] Skipping Course.kind update (column missing).');
  }

  await backfillDenormalizedTenantIds(sequelize, tenantId);

  await seedSampleClassroom(models, tenantId);

  const base = String(env.mudarBaseDomain || 'localhost')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0];
  const apiPort = env.port || 2000;
  const tenantHost = `${TENANT_SLUG}.${base}`;
  console.log('\n======== MUDAR bootstrap (demo tenant) ========');
  console.log('Tenant:', TENANT_NAME, `(${TENANT_SLUG})`, 'id=', tenantId);
  console.log('Workspace URL (set Host or X-Mudar-Tenant-Slug):');
  console.log(`  http://${tenantHost}:${apiPort}   (API)`);
  console.log(`  http://${tenantHost}:3000   (example web — use your Vite port if different)`);
  console.log('Admin (email / password):');
  console.log(`  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log('================================================\n');

  await disconnectPrisma();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
