const _ = require('lodash');
const redis = require('../redis');
const dynamodb = require('../dynamodb');
const logger = require('../../../../logger');

const SYNC_KEYS = {};

// auto refresh lookups in redis
function autoSync() {
  let SYNC_PROCESSING = false;

  setInterval(async () => {
    if (SYNC_PROCESSING) return;

    const keys = _.keys(SYNC_KEYS);
    if (!keys.length) return;

    logger.info(`DynamoDB-Redis: Syncing ${keys.length} keys`);

    SYNC_PROCESSING = true;

    // Do this serially to avoid throttling errors from DynamoDB
    for (let i = 0; i < keys.length; i += 1) {
      try {
        const key = keys[i];
        const syncValue = SYNC_KEYS[key];
        const value = await dynamodb.get(key);
        // remove from syncer
        delete SYNC_KEYS[key];
        // key no longer exists, delete it from redis
        if (value === undefined) {
          await redis.del(key);
        } else if (JSON.stringify(value) !== syncValue) {
          const expireSec = await dynamodb.getTTLSec(key);
          await redis.set(key, value, expireSec > 0 ? expireSec : undefined);
        }
      } catch (err) {
        logger.error(err);
      }
    }

    SYNC_PROCESSING = false;
  }, 2000);
}

/**
 * @implements {del}
 */
async function del(key) {
  await Promise.all([
    redis.del(key),
    dynamodb.del(key),
  ]);
}

/**
 * @implements {get}
 */
async function get(key, params) {
  // Found in Redis... done
  let value = await redis.get(key);

  // Special flag to not propagate to DynamoDB
  if (params && params.local === true) {
    return value;
  }

  if (value !== undefined) {
    SYNC_KEYS[key] = JSON.stringify(value);
    return value;
  }

  // Get it from DynamoDB
  value = await dynamodb.get(key);
  if (value !== undefined) {
    const expireSec = await dynamodb.getTTLSec(key);
    await redis.set(key, value, expireSec > 0 ? expireSec : undefined);
  }
  return value;
}

/**
 * @implements {set}
 */
async function set(key, data, expireSec, params) {
  // Special flag to not propagate to DynamoDB
  if (params && params.local === true) {
    await redis.set(key, data, expireSec);
    return;
  }

  await Promise.all([
    redis.set(key, data, expireSec),
    dynamodb.set(key, data, expireSec),
  ]);
}

/**
 * @implements {findAll}
 */
function findAll() {
  return dynamodb.findAll();
}

/**
 * @implements {incr}
 */
async function incr(key, increment, expireSec) {
  await Promise.all([
    dynamodb.incr(key, increment, expireSec),
    redis.del(key),
  ]);
}

/**
 * @implements {addToSet}
 */
async function addToSet(key, value, expireSec) {
  const retVal = await dynamodb.addToSet(key, value, expireSec);
  return retVal;
}

/**
 * @implements {delFromSet}
 */
async function delFromSet(key, value) {
  const retVal = await dynamodb.delFromSet(key, value);
  return retVal;
}

/**
 * @implements {listSet}
 */
function listSet(key) {
  return dynamodb.listSet(key);
}

/**
 * @implements {getTTLSec}
 */
function getTTLSec(key) {
  return dynamodb.getTTLSec(key);
}

/**
 * @implements {init}
 */
async function init() {
  await Promise.all([
    redis.init(),
    dynamodb.init(),
  ]);
  autoSync();
}

/**
 * @implements {destroy}
 */
async function destroy() {
  await Promise.all([
    redis.destroy(),
    dynamodb.destroy(),
  ]);
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
  delFromSet,
  listSet,
  getTTLSec,
};
