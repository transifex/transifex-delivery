const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const queue = require('./queue');
const config = require('./config');
const { version } = require('../package.json');
const sentry = require('./sentry');
const logger = require('./logger');
const metrics = require('./middlewares/metrics');
const languagesRouter = require('./routes/languages');
const contentRouter = require('./routes/content');
const statusRouter = require('./routes/status');
const invalidateRouter = require('./routes/invalidate');
const purgeRouter = require('./routes/purge');
const analyticsRouter = require('./routes/analytics');

module.exports = () => {
  // setup express and routes
  const app = express();
  app.disable('x-powered-by');

  // Enable trust proxy for parsing X-Forwarded-* headers
  if (config.get('settings:trust_proxy')) {
    app.set('trust proxy', true);
  }

  // The request handler must be the first middleware on the app
  sentry.expressRequest(app);

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', {
      stream: logger.stream,
    }));
  }

  const requestSizeLimit = config.get('settings:request_size_limit');

  app.use(bodyParser.urlencoded({
    extended: true,
    limit: requestSizeLimit,
  }));
  app.use(bodyParser.json({
    extended: true,
    limit: requestSizeLimit,
  }));
  app.use(cors());
  app.use(compression());

  // for nagios health check
  app.get('/health', async (req, res) => {
    res.json({
      version,
      status: 'ok',
      queue: await queue.countJobs(),
    });
  });

  // attach prometheus middleware
  metrics.expressRequest(app);

  app.use('/languages', languagesRouter);
  app.use('/content', contentRouter);
  app.use('/status', statusRouter);
  app.use('/invalidate', invalidateRouter);
  app.use('/purge', purgeRouter);
  app.use('/analytics', analyticsRouter);

  app.get('/', (req, res) => res.send('ok'));

  // The error handler must be before any other error middleware
  sentry.expressError(app);

  // start queue system
  queue.initialize();

  return app;
};
