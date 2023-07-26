const { RateLimiterMemory } = require('rate-limiter-flexible');
const config = require('./config');
const logger = require('./logger');
const axios = require('./helpers/axios');

const hasTelemetry = config.get('telemetry:enabled');
const telemetryHost = config.get('telemetry:host');
const reqTelemetryTimeoutMsec = config.get('telemetry:req_timeout_sec') * 1000;

const rateLimiter = new RateLimiterMemory({
  points: 2, // points to consume
  duration: 1, // per seconds
});

/**
 * Send data to telemetry service
 *
 * @param {string} path
 * @param {object} payload
 * @param {string} ratelimiterKey
 * @return {Promise<void>}
 */
async function sendToTelemetry(path, payload, ratelimiterKey) {
  if (!hasTelemetry) return;
  if (ratelimiterKey) {
    try {
      await rateLimiter.consume(ratelimiterKey, 1);
    } catch (e) {
      return;
    }
  }
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
    logger.error(e);
  }
}

module.exports = {
  sendToTelemetry,
};
