/* eslint-disable global-require */
/* eslint-disable no-console */
/* eslint-disable no-underscore-dangle */

/* Migrate registry data from CDS 1.x to 2.x */

const _ = require('lodash');
const redis = require('../src/services/registry/strategies/redis');
const config = require('../src/config');

const registryStrategy = config.get('settings:registry');
const pullSuccessExpireSec = config.get('settings:pull_success_cache_min') * 60;

let dynamodb = null;
if (registryStrategy === 'dynamodb' || registryStrategy === 'dynamodb-redis') {
  dynamodb = require('../src/services/registry/strategies/dynamodb');
}

async function start() {
  console.log('----Migrate analytics----');
  // await dynamodb.init();
  let keys = await redis._find('analytics:*');
  for (let i = 0; i < keys.length; i += 1) {
    console.log(`\nProcessing ${i} of ${keys.length}`);
    const key = keys[i];
    const ttl = await redis.getTTLSec(key);
    if (key.endsWith(':clients')) {
      if (dynamodb) {
        const data = await redis.listSet(key);
        await Promise.all(_.map(data, (entry) => dynamodb.addToSet(key, entry, ttl)));
        console.log(`Add to set ${key} <- [clients]`);
      }
    } else if (key.indexOf(':lang:') !== -1) {
      const data = await redis.get(key);
      if (dynamodb) {
        await dynamodb.set(key, data, ttl);
        console.log(`Add ${key} = ${data}`);
      }

      const setName = key.replace(/:lang:.*$/i, ':lang');
      if (dynamodb) {
        await dynamodb.addToSet(setName, key.replace(`${setName}:`, ''), ttl);
      } else {
        await redis.addToSet(setName, key.replace(`${setName}:`, ''), ttl);
      }
      console.log(`Add to set ${setName} <- ${key.replace(`${setName}:`, '')}`);
    } else if (key.indexOf(':sdk:') !== -1) {
      const data = await redis.get(key);
      if (dynamodb) {
        await dynamodb.set(key, data, ttl);
        console.log(`Add ${key} = ${data}`);
      }

      const setName = key.replace(/:sdk:.*$/i, ':sdk');
      if (dynamodb) {
        await dynamodb.addToSet(setName, key.replace(`${setName}:`, ''), ttl);
      } else {
        await redis.addToSet(setName, key.replace(`${setName}:`, ''), ttl);
      }
      console.log(`Add to set ${setName} <- ${key.replace(`${setName}:`, '')}`);
    } else {
      console.log(`Skipping ${key}`);
    }
  }

  console.log('\n----Migrating cache----');
  keys = await redis._find('cache:*');
  for (let i = 0; i < keys.length; i += 1) {
    console.log(`\nProcessing ${i} of ${keys.length}`);
    const key = keys[i];
    if (!key.endsWith(':keys')) {
      // get token
      const token = key.replace('cache:', '').split(':')[0];
      const setName = `cache:${token}:keys`;
      if (dynamodb) {
        await dynamodb.addToSet(
          setName,
          key,
          pullSuccessExpireSec,
        );
      } else {
        await redis.addToSet(
          setName,
          key,
          pullSuccessExpireSec,
        );
      }
      console.log(`Add to set ${setName} <- ${key}`);
    } else {
      console.log(`Skipping ${key}`);
    }
  }

  console.log('Migration completed');
  process.exit();
}

start();
