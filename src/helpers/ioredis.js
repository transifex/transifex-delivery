const Redis = require('ioredis');
const config = require('../config');

function createClient() {
  const redisUrl = config.get('redis:host');
  if (redisUrl) {
    let redisOpts;
    if (redisUrl.toLowerCase().indexOf('rediss://') === 0) {
      redisOpts = {
        tls: {
          rejectUnauthorized: false,
        },
      };
    }
    return new Redis(redisUrl, redisOpts);
  }
  return new Redis();
}

module.exports = {
  createClient,
};
