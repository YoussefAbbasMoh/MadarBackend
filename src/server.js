const http = require('http');
const app = require('./app');
const { connectDb } = require('./config/db');
const env = require('./config/env');
const User = require('./models/User');
const Course = require('./models/Course');
const {
  ensureSeedStaffIfEmpty,
  syncDevSeedStaffPasswords,
  ensureSeedDemoLearnerIfFreshDb,
} = require('./init/ensureSeedStaff');
const { seedFullSampleCurriculum, SEED_INSTRUCTOR_EMAIL } = require('./init/sampleCoursesSeed');
const { attachChatServer } = require('./sockets/chat');
const { startWorkers } = require('./queues/workers');

async function main() {
  await connectDb();

  const initialUserCount = await User.countDocuments();
  await ensureSeedStaffIfEmpty();
  await syncDevSeedStaffPasswords();
  if (initialUserCount === 0) {
    await ensureSeedDemoLearnerIfFreshDb();
  }

  if (env.autoSeedStaff) {
    const seedInstructor = await User.findOne({ email: SEED_INSTRUCTOR_EMAIL }).select('_id').lean();
    if (seedInstructor) {
      const ownedCount = await Course.countDocuments({ ownerId: seedInstructor._id });
      if (ownedCount === 0) {
        console.log('[init] Seeding 10 sample courses (lessons + materials + quizzes) for test accounts…');
        await seedFullSampleCurriculum({ log: console });
      }
    }
  }

  try {
    const { getRedis } = require('./config/redis');
    getRedis().on('error', (err) => console.error('Redis error', err));
    await getRedis().ping();
  } catch (e) {
    console.warn('Redis not reachable:', e.message);
  }

  const server = http.createServer(app);
  attachChatServer(server, app);

  if (env.enableInlineWorkers) {
    startWorkers();
    console.log('BullMQ inline workers enabled (set ENABLE_INLINE_WORKERS=0 to disable)');
  }

  server.listen(env.port, () => {
    console.log(`LMS API + Socket.IO listening on port ${env.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  if (process.execArgv.includes('--watch')) {
    console.error(
      '\nTip: `npm run dev` uses watch mode and will keep restarting after a failed start.\n' +
        'Fix DATABASE_URL / PostgreSQL (see messages above), or run `npm run start` once to see a single error without restarts.\n',
    );
  }
  process.exit(1);
});
