const { rateLimit } = require('express-rate-limit');
const { default: RedisStore } = require('rate-limit-redis');
const config = require('../config');
const { getClient } = require('./ioredis');

const redisClient = getClient();

/**
 * Create a scope based rate limiter based on project_token.
 * Scopes are:
 * - push
 * - invalidate
 * - jobs
 *
 * as defined in limits:... in config files.
 *
 * @param {String} scope
 * @return {*}
 */
function createRateLimiter(scope) {
  const redisKeyPrefix = config.get('limits:prefix');
  const limitPushWindowMsec = config.get(`limits:${scope}:window_sec`) * 1000;
  const limitPushMaxReq = config.get(`limits:${scope}:max_req`) * 1;
  return rateLimit({
    windowMs: limitPushWindowMsec,
    limit: limitPushMaxReq,
    keyGenerator: (req) => req.token.project_token,
    message: {
      status: 429,
      message: 'Too many requests, please try again later.',
    },
    // Redis store configuration
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: `${redisKeyPrefix}${scope}:`,
    }),
  });
}

module.exports = {
  createRateLimiter,
};
