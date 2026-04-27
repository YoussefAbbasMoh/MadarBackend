const { Worker } = require('bullmq');
const { getBullConnection } = require('./connection');
const { isBullMqRedisEnabled } = require('./bullMqRedis');
const names = require('./names');
const AgentSession = require('../models/AgentSession');

const defaultJobOpts = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
};

const workers = [];

function startWorkers() {
  if (!isBullMqRedisEnabled()) {
    console.warn('[workers] BullMQ workers not started (Redis < 5 or probe failed).');
    return;
  }
  const connection = getBullConnection();

  workers.push(
    new Worker(
      names.AGENT_HEARTBEAT,
      async (job) => {
        const { sessionToken } = job.data || {};
        if (!sessionToken) return;
        await AgentSession.updateOne({ sessionToken, status: 'active' }, { $set: { heartbeatAt: new Date() } });
      },
      { connection, concurrency: 4 }
    )
  );

  const logWorker = (queueName) =>
    new Worker(
      queueName,
      async (job) => {
        console.log(`[queue:${queueName}]`, job.name, job.id);
      },
      { connection, concurrency: queueName === names.WHATSAPP ? 2 : 4, defaultJobOptions: defaultJobOpts }
    );

  workers.push(logWorker(names.WHATSAPP));
  workers.push(logWorker(names.INAPP));
  workers.push(logWorker(names.SCHEDULED));
  workers.push(logWorker(names.PDF_REPORT));
  workers.push(logWorker(names.THUMBNAILS));
}

async function stopWorkers() {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
}

module.exports = { startWorkers, stopWorkers };
