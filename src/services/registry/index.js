const _ = require('lodash');
const config = require('../../config');
const { createClient } = require('../../helpers/ioredis');

const prefix = config.get('registry:prefix') || '';
const client = createClient();

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
    client.del(keyToRedis(key), () => {
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
        reject(err);
      } else {
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

/**
 * Add value to set
 *
 * @param {String} key
 * @param {*} value
 * @param {Number} expireSec (optional)
 * @returns {Promise<Boolean>} - whether a new value was added
 */
function addToSet(key, value, expireSec) {
  return new Promise((resolve, reject) => {
    const stringValue = JSON.stringify(value);
    client.sadd(keyToRedis(key), stringValue, (err, count) => {
      if (err) {
        reject(err);
      } else if (expireSec > 0) {
        client.expire(keyToRedis(key), expireSec, (err2) => {
          if (err2) {
            reject(err2);
          } else {
            resolve(count > 0);
          }
        });
      } else {
        resolve(count > 0);
      }
    });
  });
}

/**
 * Remove value from set
 *
 * @param {String} key
 * @param {*} value
 * @returns {Promise<Boolean>} - whether an existing value was removed
 */
function removeFromSet(key, value) {
  return new Promise((resolve, reject) => {
    const stringValue = JSON.stringify(value);
    client.srem(keyToRedis(key), stringValue, (err, count) => {
      if (err) {
        reject(err);
      } else {
        resolve(count > 0);
      }
    });
  });
}

/**
 * Get all values from set
 *
 * @param {String} key
 * @returns {Promise<Array>}
 */
function listSet(key) {
  return new Promise((resolve, reject) => {
    client.smembers(keyToRedis(key), (err, members) => {
      if (err) {
        reject(err);
      } else {
        const result = _.map(members, (value) => {
          let retValue = value;
          if (value) {
            try {
              retValue = JSON.parse(value);
            } catch (e) {
              retValue = null;
            }
          }
          return retValue;
        });
        resolve(result);
      }
    });
  });
}

/**
 * Count number of values in set
 *
 * @param {String} key
 * @returns {Promise<Number>}
 */
function countSet(key) {
  return new Promise((resolve, reject) => {
    client.scard(keyToRedis(key), (err, count) => {
      if (err) {
        reject(err);
      } else {
        resolve(count || 0);
      }
    });
  });
}

/**
 * Check if value is in set
 *
 * @param {String} key
 * @param {*} value
 * @returns {Promise<Boolean>}
 */
function isSetMember(key, value) {
  return new Promise((resolve, reject) => {
    const stringValue = JSON.stringify(value);
    client.sismember(keyToRedis(key), stringValue, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(!!response);
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
  addToSet,
  removeFromSet,
  listSet,
  isSetMember,
  countSet,
};
