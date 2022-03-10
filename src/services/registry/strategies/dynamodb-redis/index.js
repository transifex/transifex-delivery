const _ = require('lodash');
const redis = require('../redis');
const dynamodb = require('../dynamodb');
const logger = require('../../../../logger');

const SYNC_KEYS = {};

// auto refresh lookups in redis
function autoSync() {
  let SYNC_PROCESSING = false;
  setInterval(() => {
    if (SYNC_PROCESSING) return;

    const keys = _.keys(SYNC_KEYS);
    if (!keys.length) return;

    logger.info(`DynamoDB-Redis: Syncing ${keys.length} keys`);

    SYNC_PROCESSING = true;
    Promise.all(_.map(keys, (key) => (async () => {
      const syncValue = SYNC_KEYS[key];
      const value = await dynamodb.get(key);
      // remove from syncer
      delete SYNC_KEYS[key];
      // key no longer exists, delete it from redis
      if (value === undefined) {
        await redis.del(key);
        return;
      }
      // value has not been modified, abort
      if (JSON.stringify(value) === syncValue) {
        return;
      }
      const expireSec = await dynamodb.getTTLSec(key);
      await redis.set(key, value, expireSec > 0 ? expireSec : undefined);
    })())).then(() => {
      SYNC_PROCESSING = false;
    }).catch((err) => {
      logger.error(err);
      SYNC_PROCESSING = false;
    });
  }, 2000);
}

function isDynamoOnly(key) {
  return `${key}`.indexOf('analytics:') === 0;
}

/**
 * @implements {del}
 */
async function del(key) {
  if (isDynamoOnly(key)) {
    await dynamodb.del(key);
  } else {
    await Promise.all([
      redis.del(key),
      dynamodb.del(key),
    ]);
  }
}

/**
 * @implements {get}
 */
async function get(key) {
  if (isDynamoOnly(key)) {
    const value = await dynamodb.get(key);
    return value;
  }

  // Found in Redis... done
  let value = await redis.get(key);
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
async function set(key, data, expireSec) {
  if (isDynamoOnly(key)) {
    await dynamodb.set(key, data, expireSec);
  } else {
    await Promise.all([
      redis.set(key, data, expireSec),
      dynamodb.set(key, data, expireSec),
    ]);
  }
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
  if (isDynamoOnly(key)) {
    await dynamodb.incr(key, increment, expireSec);
  } else {
    await Promise.all([
      dynamodb.incr(key, increment, expireSec),
      redis.del(key),
    ]);
  }
}

/**
 * @implements {addToSet}
 */
async function addToSet(key, value, expireSec) {
  if (await redis.addToSet(key, value, expireSec)) {
    const retVal = await dynamodb.addToSet(key, value, expireSec);
    return retVal;
  }
  return false;
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
  listSet,
  getTTLSec,
};
