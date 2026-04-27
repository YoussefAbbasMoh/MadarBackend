const { Queue } = require('bullmq');
const { getBullConnection } = require('./connection');
const { isBullMqRedisEnabled } = require('./bullMqRedis');
const names = require('./names');

let queues;

function noopQueue(label) {
  return {
    add: async () => {
      console.warn(`[queues:${label}] add() skipped — BullMQ disabled (need Redis >= 5).`);
      return { id: 'skipped', name: label };
    },
  };
}

function getNoopQueues() {
  return {
    whatsapp: noopQueue(names.WHATSAPP),
    inapp: noopQueue(names.INAPP),
    scheduled: noopQueue(names.SCHEDULED),
    pdfReport: noopQueue(names.PDF_REPORT),
    thumbnails: noopQueue(names.THUMBNAILS),
    agentHeartbeat: noopQueue(names.AGENT_HEARTBEAT),
  };
}

function getQueues() {
  if (!isBullMqRedisEnabled()) {
    return getNoopQueues();
  }
  if (!queues) {
    const connection = getBullConnection();
    const makeQueue = (name) => new Queue(name, { connection });
    queues = {
      whatsapp: makeQueue(names.WHATSAPP),
      inapp: makeQueue(names.INAPP),
      scheduled: makeQueue(names.SCHEDULED),
      pdfReport: makeQueue(names.PDF_REPORT),
      thumbnails: makeQueue(names.THUMBNAILS),
      agentHeartbeat: makeQueue(names.AGENT_HEARTBEAT),
    };
  }
  return queues;
}

module.exports = { getQueues, names };
