const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Create a scope based rate limiter based on project_token.
 * Scopes are:
 * - push
 * - invalidate
 * - analytics
 * - jobs
 *
 * as defined in limits:... in config files.
 *
 * @param {String} scope
 * @return {*}
 */
function createRateLimiter(scope) {
  const limitPushWindowMsec = config.get(`limits:${scope}:window_sec`) * 1000;
  const limitPushMaxReq = config.get(`limits:${scope}:max_req`) * 1;
  return rateLimit({
    windowMs: limitPushWindowMsec,
    max: limitPushMaxReq,
    keyGenerator: (req) => req.token.project_token,
    message: {
      status: 429,
      message: 'Too many requests, please try again later.',
    },
  });
}

module.exports = {
  createRateLimiter,
};
