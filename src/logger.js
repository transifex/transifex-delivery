const _ = require('lodash');
const winston = require('winston');
const config = require('./config');
const sentry = require('./sentry');

const transports = [];
const logsFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
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

module.exports = winston.createLogger({
  defaultMeta: {
    service: config.get('app:name'),
    environment: process.env.NODE_ENV,
  },
  transports,
  silent: config.get('log:silent'),
});
