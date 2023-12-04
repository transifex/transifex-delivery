if (process.env.TX__NEWRELIC_LICENSE_KEY) {
  // eslint-disable-next-line global-require
  require('newrelic');
}

const { isNumber } = require('lodash');
const server = require('./server');
const metrics = require('./middlewares/metrics');
const config = require('./config');
const logger = require('./logger');
const queue = require('./queue');
const registry = require('./services/registry');
const cache = require('./services/cache');

async function launch() {
  let startWeb = true;
  let startWorker = true;

  if (process.argv.indexOf('--only=web') !== -1) {
    startWorker = false;
  } else if (process.argv.indexOf('--only=worker') !== -1) {
    startWeb = false;
  }

  if (startWeb) {
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
      attachedApplication.headersTimeout = (keepAliveTimeoutSec + 1) * 1000;
    }

    // graceful shutdown of server
    process.on('SIGTERM', () => {
      logger.info('SIGTERM: closing HTTP server');
      attachedApplication.close(() => {
        logger.info('SIGTERM: server closed');
        process.exit(0);
      });
      // failsafe timeout
      setTimeout(() => {
        logger.info('SIGTERM: timeout reached, killing process');
        process.exit(0);
      }, 5000);
    });
  }

  if (startWorker) {
    // start queue system. If we are also serving web, prefer running
    // worker as a background process
    queue.initialize(startWeb);
  }
}

// launch after registry and cache have been initialized
Promise.all([
  registry.init(),
  cache.init(),
]).then(() => {
  launch();
});
