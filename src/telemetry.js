const config = require('./config');
const logger = require('./logger');
const axios = require('./helpers/axios');

const hasTelemetry = config.get('telemetry:enabled');
const telemetryHost = config.get('telemetry:host');
const reqTelemetryTimeoutMsec = config.get('telemetry:req_timeout_sec') * 1000;

/**
 * Send data to telemetry service
 *
 * @param {string} path
 * @param {object} payload
 * @return {Promise<void>}
 */
async function sendToTelemetry(path, payload) {
  if (!hasTelemetry) return;
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
