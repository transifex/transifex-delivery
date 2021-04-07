if (process.env.TX__NEWRELIC_LICENSE_KEY) {
  // eslint-disable-next-line global-require
  require('newrelic');
}

const { isNumber } = require('lodash');
const server = require('./server');
const metrics = require('./middlewares/metrics');
const config = require('./config');
const logger = require('./logger');

// The service is started this way in order to able to test the routes
// without starting the server itself
const app = server();

const attachedApplication = app.listen(config.get('app:port'), () => {
  logger.info(`Listening on port ${config.get('app:port')}!`);
  metrics.metricsServer();
});

const keepAliveTimeoutSec = config.get('settings:keep_alive_timeout_sec');
if (isNumber(keepAliveTimeoutSec) && keepAliveTimeoutSec >= 0) {
  attachedApplication.keepAliveTimeout = keepAliveTimeoutSec * 1000;
}
