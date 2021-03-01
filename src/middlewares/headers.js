const _ = require('lodash');
const md5 = require('md5');
const config = require('../config');
const logger = require('../logger');
const registry = require('../services/registry');
const syncer = require('../services/syncer/data');

const authCacheSec = config.get('settings:auth_cache_min') * 60;

// convert a list of comma separated whitelisted tokens to an array of tokens
const TOKEN_WHITELIST = _.compact(_.map(
  config.get('settings:token_whitelist').split(','),
  (token) => token.trim(),
));

/**
 * A simple "dummy" scope validation based on a given token and scope.
 *
 * @param {String} scope This is the scope of the request. Can be 'private' or
 *                       public
 * @param {String} token A token used in the response. If it is a private one
 *                       should be formed like <proj_token>:<proj_secret>. In
 *                       case of a public one the <proj_token> is enough
 *
 * @returns {Boolean|Error} This will return true if token is valid, if not
 *                          an error should be thrown
 */
function validateScope(scope, token) {
  const scopes = ['public', 'private'];
  if (!scopes.includes(scope)
    || (scope === 'private' && (!token.project_secret || !token.project_token))
  ) {
    throw new Error('Invalid Scope');
  }
  return true;
}

/**
 * Validates token against a whitelist (if enabled)
 *
 * @param {String} token A token used in the response.
 *
 * @returns {Boolean|Error} This will return true if token is whitelisted,
 *                          if not an error should be thrown
 */
function validateWhitelist(token) {
  if (TOKEN_WHITELIST.length && TOKEN_WHITELIST.indexOf(token) !== -1) {
    throw new Error('Token is not in whitelist');
  }
  return true;
}

/**
 * A middleware to validate the authorization header based on the scope of each
 * route. This will result to a token key in the response.
 *
 * example:
 *
 * res.token = {
 *   original: <full token>
 *   project_token: <first part of token>
 *   project_secret: <second part of token for private routes>
 * }
 *
 * @param {String} scope This is the scope of the request. Can be 'private' or
 *                       public
 */
function validateHeader(scope = 'private') {
  return (req, res, next) => {
    try {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const auth = parts[1].split(':');

        const token = {
          original: parts[1],
          project_token: auth[0],
        };
        if (auth[1]) {
          token.project_secret = auth[1]; // eslint-disable-line
        }

        // throws exception on fail
        validateWhitelist(token);
        validateScope(scope, token);

        req.token = token;
        next();
      } else {
        throw new Error('Invalid Token');
      }
    } catch (e) {
      res.status(403).json({
        status: 403,
        message: 'Forbidden',
      });
    }
  };
}

/**
 * Middleware that checks the cached Redis "auth" credentials,
 * stored after a successful push of source content.
 *
 * Requires validateHeader middleware.
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
async function validateAuth(req, res, next) {
  const authKey = `auth:${req.token.project_token}`;
  const clientToken = md5(req.token.original);

  let serverToken = await registry.get(authKey);
  if (!serverToken && req.token.project_secret) {
    const lockKey = `disable:auth:${clientToken}`;
    if (!(await registry.get(lockKey))) {
      if (await syncer.verifyCredentials({ token: req.token })) {
        // update authentication registry
        await registry.set(authKey, clientToken, authCacheSec);
        serverToken = clientToken;
        logger.info(`Validated credentials for project: ${req.token.project_token}`);
      } else {
        // lock credentials to throttle requests
        await registry.set(lockKey, 1, authCacheSec);
        logger.warn(`Invalid auth credentials: ${req.token.original}`);
      }
    }
  }

  if (serverToken && serverToken === clientToken) {
    next();
  } else {
    res.status(403).json({
      status: 403,
      message: 'Forbidden',
      details: 'Invalid credentials',
    });
  }
}

module.exports = {
  validateHeader,
  validateAuth,
};
