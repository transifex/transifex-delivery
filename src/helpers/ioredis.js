const Redis = require('ioredis');
const config = require('../config');

let singletonClient;

function createClient() {
  const redisUrl = config.get('redis:host');
  if (redisUrl) {
    const redisOpts = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
    if (redisUrl.toLowerCase().indexOf('rediss://') === 0) {
      redisOpts.tls = {
        rejectUnauthorized: false,
      };
    }
    return new Redis(redisUrl, redisOpts);
  }
  return new Redis({
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

function getClient() {
  if (singletonClient) {
    return singletonClient;
  }
  singletonClient = createClient();
  return singletonClient;
}

module.exports = {
  createClient,
  getClient,
};
