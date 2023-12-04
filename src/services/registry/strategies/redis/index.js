const _ = require('lodash');
const config = require('../../../../config');
const { getClient } = require('../../../../helpers/ioredis');

const prefix = config.get('registry:prefix') || '';
const client = getClient();

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
 * @implements {del}
 */
function del(key) {
  return new Promise((resolve) => {
    client.del(keyToRedis(key), () => {
      resolve();
    });
  });
}

/**
 * @implements {get}
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
 * @implements {set}
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

// eslint-disable-next-line no-underscore-dangle
function _find(pattern) {
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
 * @implements {findAll}
 */
function findAll() {
  return _find('*');
}

/**
 * @implements {incr}
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
 * @implements {addToSet}
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
 * @implements {listSet}
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
 * @implements {getTTLSec}
 */
function getTTLSec(key) {
  return new Promise((resolve, reject) => {
    client.ttl(keyToRedis(key), (err, payload) => {
      if (err) {
        reject(err);
      } else {
        resolve(Math.max(0, payload));
      }
    });
  });
}

/**
 * @implements {init}
 */
async function init() {
  // noop
}

/**
 * @implements {init}
 */
async function destroy() {
  // noop
}

module.exports = {
  init,
  destroy,
  del,
  get,
  set,
  findAll,
  incr,
  addToSet,
  listSet,
  getTTLSec,
  // private
  _find,
};
