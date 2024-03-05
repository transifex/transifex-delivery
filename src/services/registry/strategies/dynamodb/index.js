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
const docClient = new AWS.DynamoDB.DocumentClient(awsConfig);

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
 * @implements {addToSet}
 */
async function addToSet(key, value, expireSec) {
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
        ':set': docClient.createSet([value]),
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
 * @implements {delFromSet}
 */
async function delFromSet(key, value) {
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
 * @implements {listSet}
 */
async function listSet(key) {
  const value = await get(key);
  return (value || {}).values || [];
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
