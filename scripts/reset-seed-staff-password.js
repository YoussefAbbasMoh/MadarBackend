/**
 * Force-reset password for seed.superadmin@lms.local and seed.instructor@lms.local
 * to SEED_ACCOUNT_PASSWORD or default admin1234.
 *
 *   cd backend && node scripts/reset-seed-staff-password.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { connectDb } = require('../src/config/db');
const { disconnectPrisma } = require('../src/db/prisma');
const { hashPassword } = require('../src/utils/password');
const User = require('../src/models/User');
const { SEED_SUPER_ADMIN_EMAIL, SEED_INSTRUCTOR_EMAIL } = require('./sample-courses-data');

const password = process.env.SEED_ACCOUNT_PASSWORD || 'admin1234';

async function main() {
  await connectDb();
  const passwordHash = await hashPassword(password);
  const emails = [SEED_SUPER_ADMIN_EMAIL, SEED_INSTRUCTOR_EMAIL];
  const res = await User.updateMany({ email: { $in: emails } }, { $set: { passwordHash } });
  console.log('Emails:', emails.join(', '));
  console.log('Password from SEED_ACCOUNT_PASSWORD or default: admin1234');
  console.log('Matched users:', res.matchedCount, '| modified:', res.modifiedCount);
  if (res.matchedCount === 0) {
    console.warn('No users matched — run npm run seed:samples first to create seed accounts.');
  }
  await disconnectPrisma();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
