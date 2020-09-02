const md5 = require('md5');
const redis = require('redis');
const config = require('../../../../config');
const logger = require('../../../../logger');

const client = redis.createClient(config.get('redis:host'));
const expireSec = config.get('redis:expire_min') * 60;

/**
 * Calculate TTL based on a timestamp stored in Redis
 *
 * @param {Number} ts
 * @returns {Number} TTL in seconds
 */
function getTTL(ts) {
  const elapsedSecs = Math.round((Date.now() - ts) / 1000);
  return Math.max(0, config.get('settings:cache_ttl') - elapsedSecs);
}

/**
 * @implements {delContent}
 */
function delContent(key) {
  return new Promise((resolve) => {
    client.del(key, (err) => {
      if (err) {
        logger.warn(`Cache deletion failed for ${key} key`);
      } else {
        logger.info(`Cache deleted for ${key} key`);
      }
      resolve();
    });
  });
}

/**
 * @implements {getContent}
 */
function getContent(key) {
  return new Promise((resolve, reject) => {
    client.get(key, (err, payload) => {
      if (err) {
        reject(err);
      } else if (!payload) {
        resolve({
          data: null,
          ttl: 0,
          etag: '',
        });
      } else {
        const parsedPayload = JSON.parse(payload);
        resolve({
          data: parsedPayload.data,
          etag: parsedPayload.etag,
          ttl: getTTL(parsedPayload.ts),
        });
      }
    });
  });
}

/**
 * @implements {setContent}
 */
function setContent(key, data) {
  return new Promise((resolve, reject) => {
    const payload = {
      data,
      etag: md5(data),
      ts: Date.now(),
    };
    client.set(key, JSON.stringify(payload), 'EX', expireSec, (err) => {
      if (err) {
        logger.error(`Failed to set cache content for ${key} key`);
        reject(err);
      } else {
        logger.info(`Cache set for ${key} key`);
        resolve({
          data: payload.data,
          etag: payload.etag,
          ttl: getTTL(payload.ts),
        });
      }
    });
  });
}

/**
 * @implements {findKeys}
 */
function findKeys(pattern) {
  return new Promise((resolve, reject) => {
    client.keys(pattern, (err, keys) => {
      if (err) {
        reject(err);
      } else {
        resolve(keys || []);
      }
    });
  });
}

module.exports = {
  delContent,
  getContent,
  setContent,
  findKeys,
};
