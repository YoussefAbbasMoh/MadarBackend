const IORedis = require('ioredis');
const env = require('../config/env');

let connection;

function getBullConnection() {
  if (!connection) {
    connection = new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

module.exports = { getBullConnection };
