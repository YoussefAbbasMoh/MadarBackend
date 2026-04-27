require('dotenv').config();
const { connectDb } = require('./config/db');
const { startWorkers } = require('./queues/workers');
const { ensureBullMqRedis, isBullMqRedisEnabled } = require('./queues/bullMqRedis');
require('./models');

async function main() {
  await connectDb();
  try {
    const { getRedis } = require('./config/redis');
    await getRedis().ping();
  } catch (e) {
    console.error('Redis not reachable:', e.message);
    process.exit(1);
  }
  await ensureBullMqRedis();
  if (!isBullMqRedisEnabled()) {
    console.error('Redis 5+ required for npm run worker. Use docker compose -f docker-compose.redis.yml up -d or Memurai.');
    process.exit(1);
  }
  startWorkers();
  console.log('LMS BullMQ workers running');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
