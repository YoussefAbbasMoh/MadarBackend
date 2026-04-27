const Redis = require('ioredis');
const env = require('./env');

let client;

function getRedis() {
  if (!client) {
    client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }
  return client;
}

module.exports = { getRedis };
