/* eslint import/no-dynamic-require:0 */
const config = require('../../config');

const cache = require(`./strategies/${config.get('settings:cache')}`);

/**
 * Delete all data for a specific key
 *
 * @interface
 * @param {String} key A key that identifies a resource in cache
 */
async function delContent(key) {
  const res = await cache.delContent(key);
  return res;
}

/**
 * Retrieve content from cache based on key
 *
 * @param {String} key A key that identifies a resource in cache
 * @returns {Object}
 * {
 *   ttl: <number>,
 *   data: <stringified json>
 *   etag: <string>
 * }
 */
async function getContent(key) {
  const res = await cache.getContent(key);
  return res;
}

/**
 * Set content in cache based on a specific key
 *
 * @interface
 * @param {String} key A key that will identify a resource in cache
 * @param {String} data An object with the content to be cached
 * @returns {Object}
 * {
 *   ttl: <number>,
 *   etag: <string>,
 * }
 */
async function setContent(key, data) {
  const res = await cache.setContent(key, data);
  return res;
}

/**
 * Search cache for keys matching pattern
 *
 * @interface
 * @param {String} pattern A pattern to search for keys in cache
 * @returns {Array} array of keys
 */
async function findKeys(pattern) {
  const res = await cache.findKeys(pattern);
  return res;
}

module.exports = {
  delContent,
  getContent,
  setContent,
  findKeys,
};
