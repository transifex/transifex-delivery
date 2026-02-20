const AWS = require('aws-sdk');
const _ = require('lodash');
const config = require('../../../../config');
const { createTable, deleteTable } = require('./table');

const prefix = config.get('registry:prefix') || '';

const commonConfig = config.get('aws:config:common');
const dynamodbConfig = config.get('aws:config:dynamodb');

let awsConfig;
if (commonConfig || dynamodbConfig) {
  awsConfig = {
    ...(commonConfig || {}),
    ...(dynamodbConfig || {}),
  };
}

const tableName = config.get('dynamodb:table_name');
const docClient = new AWS.DynamoDB.DocumentClient({
  ...awsConfig,
  maxRetries: 5,
  retryDelayOptions: {
    customBackoff: (retryCount) => Math.min(2 ** retryCount * 50, 3000),
  },
});

const parsedShards = parseInt(config.get('dynamodb:key_shards'), 10);
const NUM_SHARDS = Number.isFinite(parsedShards) && parsedShards > 0 ? parsedShards : 5;

/**
 * Simple string hash to deterministically assign a value to a shard.
 *
 * @param {String} str
 * @returns {Number} shard index (0 to NUM_SHARDS-1)
 */
function getShardIndex(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % NUM_SHARDS;
}

/**
 * Convert a user key to DynamoDB key with prefix included
 *
 * @param {String} key
 * @returns {String}
 */
function keyToDb(key) {
  return `${prefix}${key}`;
}

/**
 * Convert a DynamoDB key to user key with prefix ommited
 *
 * @param {String} dbKey
 * @returns {String}
 */
function dbToKey(dbKey) {
  return dbKey.replace(prefix, '');
}

/**
 * @implements {del}
 */
async function del(key) {
  const params = {
    TableName: tableName,
    Key: {
      key: keyToDb(key),
    },
  };
  await docClient.delete(params).promise();
}

/**
 * @implements {get}
 */
async function get(key) {
  const params = {
    TableName: tableName,
    Key: {
      key: keyToDb(key),
    },
  };
  const data = await docClient.get(params).promise();
  if (data && data.Item) {
    if (data.Item.ttl > 0 && Date.now() > (data.Item.ttl * 1000)) {
      return undefined;
    }
    return data.Item.value;
  }
  return undefined;
}

/**
 * @implements {set}
 */
async function set(key, data, expireSec) {
  const params = {
    TableName: tableName,
    Item: {
      key: keyToDb(key),
      value: data,
      ttl: expireSec > 0
        ? Math.round(Date.now() / 1000) + expireSec
        : undefined,
    },
  };
  await docClient.put(params).promise();
}

/**
 * @implements {findAll}
 */
async function findAll() {
  const data = await docClient.scan({
    TableName: tableName,
  }).promise();
  return _.map(data.Items, (item) => dbToKey(item.key));
}

/**
 * @implements {incr}
 */
async function incr(key, increment, expireSec) {
  const ttl = expireSec > 0
    ? Math.round(Date.now() / 1000) + expireSec
    : undefined;

  let params;
  if (ttl > 0) {
    params = {
      TableName: tableName,
      Key: {
        key: keyToDb(key),
      },
      ExpressionAttributeNames: {
        '#value': 'value',
        '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':inc': increment,
        ':num0': 0,
        ':ttl': ttl,
      },
      UpdateExpression: 'SET #value = if_not_exists(#value, :num0) + :inc, #ttl = :ttl',
      ReturnValues: 'UPDATED_NEW',
    };
  } else {
    params = {
      TableName: tableName,
      Key: {
        key: keyToDb(key),
      },
      ExpressionAttributeNames: {
        '#value': 'value',
      },
      ExpressionAttributeValues: {
        ':inc': increment,
        ':num0': 0,
      },
      UpdateExpression: 'SET #value = if_not_exists(#value, :num0) + :inc',
      ReturnValues: 'UPDATED_NEW',
    };
  }

  await docClient.update(params).promise();
}

/**
 * Internal addToSet that operates on a single DynamoDB key (no sharding).
 *
 * @param {String} key
 * @param {String} value
 * @param {Number} expireSec
 * @returns {Promise<Boolean>}
 */
async function addToSetSingle(key, value, expireSec) {
  const ttl = expireSec > 0
    ? Math.round(Date.now() / 1000) + expireSec
    : undefined;

  let params;
  if (ttl > 0) {
    params = {
      TableName: tableName,
      Key: {
        key: keyToDb(key),
      },
      ExpressionAttributeNames: {
        '#value': 'value',
        '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':set': docClient.createSet([`${value}`]),
        ':ttl': ttl,
      },
      UpdateExpression: 'ADD #value :set SET #ttl = :ttl',
      ReturnValues: 'UPDATED_OLD',
    };
  } else {
    params = {
      TableName: tableName,
      Key: {
        key: keyToDb(key),
      },
      ExpressionAttributeNames: {
        '#value': 'value',
      },
      ExpressionAttributeValues: {
        ':set': docClient.createSet([`${value}`]),
      },
      UpdateExpression: 'ADD #value :set',
      ReturnValues: 'UPDATED_OLD',
    };
  }

  const data = await docClient.update(params).promise();
  const prevSet = ((data.Attributes || {}).value || {}).values || [];
  return (prevSet.indexOf(value) === -1);
}

/**
 * Internal delFromSet that operates on a single DynamoDB key (no sharding).
 *
 * @param {String} key
 * @param {String} value
 * @returns {Promise<Boolean>}
 */
async function delFromSetSingle(key, value) {
  const params = {
    TableName: tableName,
    Key: {
      key: keyToDb(key),
    },
    ExpressionAttributeNames: {
      '#value': 'value',
    },
    ExpressionAttributeValues: {
      ':set': docClient.createSet([`${value}`]),
    },
    UpdateExpression: 'DELETE #value :set',
    ReturnValues: 'UPDATED_OLD',
  };

  const data = await docClient.update(params).promise();
  const prevSet = ((data.Attributes || {}).value || {}).values || [];
  return (prevSet.indexOf(value) !== -1);
}

/**
 * Internal listSet that reads a single DynamoDB key (no sharding).
 *
 * @param {String} key
 * @returns {Promise<Array>}
 */
async function listSetSingle(key) {
  const value = await get(key);
  return (value || {}).values || [];
}

/**
 * @implements {addToSet}
 *
 * Writes to a sharded key based on a hash of the value.
 * This distributes writes across NUM_SHARDS DynamoDB partitions
 * to avoid hot key throttling.
 */
async function addToSet(key, value, expireSec) {
  const shard = getShardIndex(`${value}`);
  const shardKey = `${key}:${shard}`;
  const [legacyValues, shardResult] = await Promise.all([
    listSetSingle(key),
    addToSetSingle(shardKey, value, expireSec),
  ]);
  const existsInLegacy = legacyValues.indexOf(`${value}`) !== -1;
  return !existsInLegacy && shardResult;
}

/**
 * @implements {delFromSet}
 *
 * Deletes from the correct shard (determined by hashing the value).
 * Also deletes from the legacy unsharded key if the value is present there,
 * for backward compatibility with pre-sharding data. The legacy delete is
 * conditional to avoid recreating an empty DynamoDB item after the legacy
 * key's TTL has expired.
 */
async function delFromSet(key, value) {
  const shard = getShardIndex(`${value}`);
  const shardKey = `${key}:${shard}`;

  const legacyValues = await listSetSingle(key);
  const legacyHasValue = legacyValues.indexOf(`${value}`) !== -1;

  const ops = [delFromSetSingle(shardKey, value)];
  if (legacyHasValue) {
    ops.push(delFromSetSingle(key, value));
  }

  const results = await Promise.all(ops);
  return results.some(Boolean);
}

/**
 * @implements {listSet}
 *
 * Reads from all shards in parallel and merges results.
 * Also reads the legacy unsharded key for backward compatibility
 * with pre-sharding data.
 */
async function listSet(key) {
  const shardKeys = [];
  for (let i = 0; i < NUM_SHARDS; i += 1) {
    shardKeys.push(`${key}:${i}`);
  }
  const results = await Promise.all([
    listSetSingle(key), // legacy unsharded key
    ..._.map(shardKeys, (sk) => listSetSingle(sk)),
  ]);
  return _.uniq(_.flatten(results));
}

/**
 * @implements {getTTLSec}
 */
async function getTTLSec(key) {
  const params = {
    TableName: tableName,
    Key: {
      key: keyToDb(key),
    },
  };
  const data = await docClient.get(params).promise();
  if (data && data.Item && data.Item.ttl > 0) {
    return Math.max(0, Math.round(((data.Item.ttl * 1000) - Date.now()) / 1000));
  }
  return 0;
}

/**
 * @implements {init}
 */
async function init() {
  await createTable(tableName);
}

/**
 * @implements {init}
 */
async function destroy() {
  try {
    await deleteTable(tableName);
  } catch (e) {
    // noop
  }
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
