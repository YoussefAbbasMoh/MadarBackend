const User = require('../models/User');
const { hashPassword } = require('../utils/password');
const { normalizePhoneE164 } = require('../utils/phone');
const env = require('../config/env');
const {
  SEED_SUPER_ADMIN_EMAIL,
  SEED_INSTRUCTOR_EMAIL,
  SEED_STUDENT_EMAIL,
  SEED_STUDENT_PHONE,
} = require('../../scripts/sample-courses-data');

/**
 * After a completely empty user collection was bootstrapped with staff, add one canonical OTP student
 * (same phone/email as `npm run seed:samples`). Gated by `env.autoSeedStaff`.
 */
async function ensureSeedDemoLearnerIfFreshDb() {
  if (!env.autoSeedStaff) return;
  const phone = normalizePhoneE164(SEED_STUDENT_PHONE);
  const existing = await User.findOne({
    $or: [{ phone }, { email: SEED_STUDENT_EMAIL.toLowerCase() }],
  })
    .select('_id')
    .lean();
  if (existing) return;
  await User.create({
    role: 'student',
    phone,
    email: SEED_STUDENT_EMAIL,
    name: 'Sample Student 01 (Seed)',
  });
  console.log(
    `[init] Created seed student (${SEED_STUDENT_EMAIL}, ${phone}) — OTP login in dev (see BeOne / seed scripts).`,
  );
}

/**
 * If the database has no super_admin / no instructor, create the standard seed staff accounts
 * (same emails and password contract as `npm run seed:samples`).
 * Gated by `env.autoSeedStaff` (off in production unless AUTO_SEED_STAFF=1).
 */
async function ensureSeedStaffIfEmpty() {
  if (!env.autoSeedStaff) return;

  const password = process.env.SEED_ACCOUNT_PASSWORD || 'admin1234';
  const passwordHash = await hashPassword(password);

  const superCount = await User.countDocuments({ role: 'super_admin' });
  if (superCount === 0) {
    const conflict = await User.findOne({ email: SEED_SUPER_ADMIN_EMAIL }).select('_id role').lean();
    if (conflict) {
      console.warn(
        `[init] No super_admin user, but ${SEED_SUPER_ADMIN_EMAIL} is already taken (role=${conflict.role}). Skipping seed super admin.`,
      );
    } else {
      await User.create({
        email: SEED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        name: 'Sample Super Admin (Seed)',
        passwordHash,
      });
      console.log(`[init] Created seed super_admin (${SEED_SUPER_ADMIN_EMAIL}) — password from SEED_ACCOUNT_PASSWORD or default admin1234`);
    }
  }

  const instructorCount = await User.countDocuments({ role: 'instructor' });
  if (instructorCount === 0) {
    const conflict = await User.findOne({ email: SEED_INSTRUCTOR_EMAIL }).select('_id role').lean();
    if (conflict) {
      console.warn(
        `[init] No instructor user, but ${SEED_INSTRUCTOR_EMAIL} is already taken (role=${conflict.role}). Skipping seed instructor.`,
      );
    } else {
      await User.create({
        email: SEED_INSTRUCTOR_EMAIL,
        role: 'instructor',
        name: 'Sample Instructor (Seed)',
        passwordHash,
      });
      console.log(`[init] Created seed instructor (${SEED_INSTRUCTOR_EMAIL}) — same password rule as super admin`);
    }
  }
}

/**
 * Non-production only: reset password hash for seed staff emails to match
 * SEED_ACCOUNT_PASSWORD or default `admin1234`, so login works after changing defaults
 * without re-running `npm run seed:samples`.
 */
async function syncDevSeedStaffPasswords() {
  const force = process.env.FORCE_SEED_STAFF_PASSWORD_SYNC === '1' || process.env.SYNC_SEED_STAFF_PASSWORD === '1';
  if (env.nodeEnv === 'production' && !force) return;

  const password = process.env.SEED_ACCOUNT_PASSWORD || 'admin1234';
  const passwordHash = await hashPassword(password);
  const emails = [SEED_SUPER_ADMIN_EMAIL, SEED_INSTRUCTOR_EMAIL];
  let matched = 0;
  for (const email of emails) {
    const res = await User.updateMany({ email: String(email).toLowerCase() }, { $set: { passwordHash } });
    matched += res.matchedCount || 0;
  }
  if (matched > 0) {
    console.log(
      `[init] Re-applied dev password to ${matched} seed staff account(s) (${emails.join(', ')}) — use SEED_ACCOUNT_PASSWORD or default admin1234`,
    );
  }
}

module.exports = { ensureSeedStaffIfEmpty, syncDevSeedStaffPasswords, ensureSeedDemoLearnerIfFreshDb };
