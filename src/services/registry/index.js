const redis = require('redis');
const _ = require('lodash');
const config = require('../../config');
const logger = require('../../logger');

const prefix = config.get('registry:prefix') || '';
const client = redis.createClient(config.get('redis:host'));

/**
 * Convert a user key to Redis key with prefix included
 *
 * @param {String} key
 * @returns {String}
 */
function keyToRedis(key) {
  return `${prefix}${key}`;
}

/**
 * Convert a Redis key to user key with prefix ommited
 *
 * @param {String} redisKey
 * @returns {String}
 */
function redisToKey(redisKey) {
  return redisKey.replace(prefix, '');
}

/**
 * Delete a key from registry
 *
 * @param {String} key
 * @returns {Promise}
 */
function del(key) {
  return new Promise((resolve) => {
    client.del(keyToRedis(key), (err) => {
      if (err) {
        logger.warn(`Registry deletion failed for ${key} key`);
      } else {
        logger.info(`Registry deleted for ${key} key`);
      }
      resolve();
    });
  });
}

/**
 * Get registry value by key
 *
 * @param {String} key
 * @returns {Promise<value>}
 */
function get(key) {
  return new Promise((resolve, reject) => {
    client.get(keyToRedis(key), (err, payload) => {
      if (err) {
        reject(err);
      } else if (!payload) {
        resolve();
      } else {
        resolve(JSON.parse(payload));
      }
    });
  });
}

/**
 * Set a value to registry
 *
 * @param {String} key
 * @param {*} data
 * @param {Number} expireSec (optional)
 * @returns {Promise}
 */
function set(key, data, expireSec) {
  return new Promise((resolve, reject) => {
    function callback(err) {
      if (err) {
        logger.error(`Failed to set registry for ${key} key`);
        reject(err);
      } else {
        logger.info(`Registry set for ${key} key`);
        resolve();
      }
    }

    if (expireSec > 0) {
      client.set(keyToRedis(key), JSON.stringify(data), 'EX', expireSec, callback);
    } else {
      client.set(keyToRedis(key), JSON.stringify(data), callback);
    }
  });
}

/**
 * Find keys in registry
 *
 * @param {String} pattern
 * @returns {Promise<Array[String]>}
 */
function find(pattern) {
  return new Promise((resolve, reject) => {
    client.keys(keyToRedis(pattern), (err, keys) => {
      if (err) {
        reject(err);
      } else {
        resolve(_.map(keys || [], (key) => redisToKey(key)));
      }
    });
  });
}

/**
 * Increase key value
 *
 * @param {String} key
 * @param {Number} increment
 * @param {Number} expireSec (optional)
 * @returns {Promise}
 */
function incr(key, increment, expireSec) {
  return new Promise((resolve, reject) => {
    client.incrby(keyToRedis(key), increment, (err) => {
      if (err) {
        reject(err);
      } else if (expireSec > 0) {
        client.expire(keyToRedis(key), expireSec, (err2) => {
          if (err2) {
            reject(err2);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
}

module.exports = {
  del,
  get,
  set,
  find,
  incr,
};
