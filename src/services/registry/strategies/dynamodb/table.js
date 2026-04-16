const AWS = require('aws-sdk');
const config = require('../../../../config');
const logger = require('../../../../logger');

const commonConfig = config.get('aws:config:common');
const dynamodbConfig = config.get('aws:config:dynamodb');

let awsConfig;
if (commonConfig || dynamodbConfig) {
  awsConfig = {
    ...(commonConfig || {}),
    ...(dynamodbConfig || {}),
  };
}

/**
 * Create or update a table
 *
 * @param {String} TableName
 * @return {Promise}
 */
async function createTable(TableName) {
  const dynamodb = new AWS.DynamoDB(awsConfig);
  const KeySchema = [
    { AttributeName: 'key', KeyType: 'HASH' },
  ];
  const AttributeDefinitions = [
    { AttributeName: 'key', AttributeType: 'S' },
  ];

  let currentSchema = {
    TableStatus: 'CREATING',
  };
  try {
    while (
      currentSchema.TableStatus === 'CREATING'
      || currentSchema.TableStatus === 'UPDATING'
    ) {
      currentSchema = await dynamodb.describeTable({ TableName }).promise();
      currentSchema = currentSchema.Table;
    }
    logger.info(`DynamoDB: Table ${TableName} already exists`);
  } catch (e) {
    // create table on development mode
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging') {
      await dynamodb.createTable({
        TableName,
        KeySchema,
        AttributeDefinitions,
        BillingMode: 'PAY_PER_REQUEST',
      }).promise();
      logger.info(`DynamoDB: Table ${TableName} created`);
    } else {
      logger.error(e);
      throw e;
    }
  }

  const ttlSchema = await dynamodb.describeTimeToLive({ TableName }).promise();
  if (ttlSchema.TimeToLiveDescription.AttributeName !== 'ttl') {
    await dynamodb.updateTimeToLive({
      TableName,
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
    }).promise();
    logger.info(`DynamoDB: Table ${TableName} enabled TTL`);
  }
}

/**
 * Delete a table
 *
 * @param {String} TableName
 * @return {Promise}
 */
async function deleteTable(TableName) {
  const dynamodb = new AWS.DynamoDB(awsConfig);
  await dynamodb.deleteTable({ TableName }).promise();
  logger.info(`DynamoDB: Table ${TableName} deleted`);
}

module.exports = {
  createTable,
  deleteTable,
};
