const _ = require('lodash');
const Sentry = require('@sentry/node');
const Transport = require('winston-transport');
const config = require('./config');

let isActive = false;

// initialize sentry based on configuration
if (config.get('sentry:dsn')) {
  Sentry.init({
    dsn: config.get('sentry:dsn'),
  });
  isActive = true;
}

/**
 * This is part of the sentry/utils code that we decided to add here
 * to avoid issues since this gets updated and breaks from time to time
 */
function isError(wat) {
  switch (Object.prototype.toString.call(wat)) {
    case '[object Error]':
    case '[object Exception]':
    case '[object DOMException]':
      return true;
    default:
      return wat instanceof Error;
  }
}

/**
 * Custom winston transport
 * Inspired by https://www.npmjs.com/package/winston-sentry-log
 */
class SentryTransport extends Transport {
  log(info, callback) {
    const { message, fingerprint } = info;
    const meta = { ...(_.omit(info, ['level', 'message', 'label'])) };
    setImmediate(() => {
      this.emit('logged', info.level);
    });
    const context = {};
    context.level = info.level;
    context.extra = _.omit(meta, ['user']);
    context.fingerprint = [fingerprint, process.env.NODE_ENV];
    Sentry.configureScope((scope) => {
      const user = _.get(meta, 'user');
      if (_.has(context, 'extra')) {
        Object.keys(context.extra).forEach((key) => {
          scope.setExtra(key, context.extra[key]);
        });
      }
      if (!_.isEmpty(this.tags)) {
        Object.keys(this.tags).forEach((key) => {
          scope.setTag(key, this.tags[key]);
        });
      }
      if (user) {
        scope.setUser(user);
      }
      if (context.level === 'error' || context.level === 'fatal') {
        Sentry.captureException(isError(info) ? info : new Error(message));
      }
      return callback(null, true);
    });
  }
}

/**
 * Express middleware that should be applied before
 * any other middleware
 *
 * @param {*} app
 */
function expressRequest(app) {
  if (!isActive) return;
  app.use(Sentry.Handlers.requestHandler());
}

/**
 * Error middleware that should be applied before
 * any other error handling middleware
 *
 * @param {*} app
 */
function expressError(app) {
  if (!isActive) return;
  app.use(Sentry.Handlers.errorHandler());
}

/* **************************************************************** */

module.exports = {
  isActive,
  expressRequest,
  expressError,
  SentryTransport,
};
