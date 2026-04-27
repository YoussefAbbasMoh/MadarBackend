/**
 * Seeds ~10 full sample courses (lessons, sub-lessons, media URLs, quizzes).
 *
 * Usage (from backend folder):
 *   cd backend && npm run seed:samples
 *
 * Requires PostgreSQL. Env: DATABASE_URL
 * Optional: SEED_ACCOUNT_PASSWORD (default admin1234)
 *
 * Idempotent: removes all courses owned by the seed instructor, then recreates.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { connectDb } = require('../src/config/db');
const { disconnectPrisma } = require('../src/db/prisma');
const { seedFullSampleCurriculum } = require('../src/init/sampleCoursesSeed');

async function main() {
  await connectDb();
  await seedFullSampleCurriculum({ log: console });
  await disconnectPrisma();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
