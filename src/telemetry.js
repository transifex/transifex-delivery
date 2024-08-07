const { RateLimiterRedis } = require('rate-limiter-flexible');
const config = require('./config');
const logger = require('./logger');
const axios = require('./helpers/axios');
const { getClient } = require('./helpers/ioredis');

const redisClient = getClient();
const hasTelemetry = config.get('telemetry:enabled');
const telemetryHost = config.get('telemetry:host');
const reqTelemetryTimeoutMsec = config.get('telemetry:req_timeout_sec') * 1000;
const maxConcurrentReq = config.get('telemetry:max_concurrent_req');
const redisKeyPrefix = config.get('telemetry:prefix');

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 2, // points to consume
  duration: 1, // per seconds
  keyPrefix: redisKeyPrefix,
});

let concurrentReq = 0;

/**
 * Send data to telemetry service
 *
 * @param {string} path
 * @param {object} payload
 * @param {string} ratelimiterKey
 * @return {Promise<void>}
 */
async function sendToTelemetry(path, payload, ratelimiterKey) {
  // Abort if Telemetry is disabled
  if (!hasTelemetry) return;

  // Abort if we have too many requests in process
  if (concurrentReq >= maxConcurrentReq) return;

  // Abort by rate limiting the key
  if (ratelimiterKey) {
    try {
      await rateLimiter.consume(ratelimiterKey, 1);
    } catch (e) {
      return;
    }
  }

  // Increase concurrency
  concurrentReq += 1;

  // Send payload to Telemetry
  try {
    await axios.post(
      `${telemetryHost}${path}`,
      {
        data: payload,
      },
      {
        timeout: reqTelemetryTimeoutMsec,
      },
    );
  } catch (e) {
    if (e.response && e.response.status === 429) {
      logger.info(e);
    } else {
      logger.error(e);
    }
  }

  // Decrease concurrency
  concurrentReq -= 1;
}

module.exports = {
  sendToTelemetry,
};
