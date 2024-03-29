const _ = require('lodash');
const md5 = require('../src/helpers/md5');
const cache = require('../src/services/cache');
const registry = require('../src/services/registry');

/**
 * Clear entire registry and cache
 */
async function resetRegistry() {
  const keys = await registry.findAll();
  await Promise.all(_.map(keys, (key) => (async () => {
    try {
      const data = await registry.get(key);
      if (data && data.cacheKey) {
        await cache.delContent(data.cacheKey);
      }
    } catch (err) {
      // throwing an error is normal if a key is a redis set
    }
    await registry.del(key);
  })()));
}

/**
 * Warm up registry and cache with content
 *
 * @param {String} key
 * @param {*} content
 */
async function populateRegistry(token, key, content) {
  const stringData = JSON.stringify(content);
  const etag = md5(stringData);
  const cacheKey = `${key}:${etag}`;
  const { location } = await cache.setContent(cacheKey, stringData);
  await Promise.all([
    registry.set(`cache:${key}`, {
      status: 'success',
      ts: Date.now(),
      etag,
      location,
      cacheKey,
    }),
    registry.addToSet(`cache:${token}:keys`, `cache:${key}`),
  ]);
}

module.exports = {
  resetRegistry,
  populateRegistry,
};
