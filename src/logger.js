const _ = require('lodash');
const winston = require('winston');
const config = require('./config');
const sentry = require('./sentry');

const transports = [];
const logsFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

_.each(config.get('log:transports'), (options, name) => {
  // Transports in winston are declared in pascalCase
  const Transport = winston.transports[_.upperFirst(_.camelCase(name))];
  if (!Transport) {
    throw Error(`Unknown winston transport: ${name}`);
  }
  transports.push(new Transport({
    format: logsFormat,
    ...options,
  }));
});

if (sentry.isActive) {
  transports.push(new sentry.SentryTransport({
    level: 'error',
  }));
}

const logger = winston.createLogger({
  defaultMeta: {
    service: config.get('app:name'),
    environment: process.env.NODE_ENV,
  },
  transports,
  silent: config.get('log:silent'),
});

// stream object to be used by morgan for express logs
logger.stream = {
  write: (message) => {
    logger.info(message);
  },
};

module.exports = logger;
