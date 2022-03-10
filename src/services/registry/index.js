const config = require('../../config');
const logger = require('../../logger');

const registry = require(`./strategies/${config.get('settings:registry')}`);
logger.info(`Registry strategy: ${config.get('settings:registry')}`);

/**
 * Delete a key from registry
 *
 * @param {String} key
 * @returns {Promise}
 */
function del(key) {
  return registry.del(key);
}

/**
 * Get registry value by key
 *
 * @param {String} key
 * @returns {Promise<value>}
 */
function get(key) {
  return registry.get(key);
}

/**
 * Set a value to registry
 *
 * @param {String} key
 * @param {*} data
 * @param {Number} expireSec (optional)
 * @returns {Promise}
 */
function set(key, data, expireSec) {
  return registry.set(key, data, expireSec);
}

/**
 * Find all keys in registry
 *
 * @returns {Promise<Array[String]>}
 */
function findAll() {
  return registry.findAll();
}

/**
 * Increase key value
 *
 * @param {String} key
 * @param {Number} increment
 * @param {Number} expireSec (optional)
 * @returns {Promise}
 */
function incr(key, increment, expireSec) {
  return registry.incr(key, increment, expireSec);
}

/**
 * Add value to set
 *
 * @param {String} key
 * @param {*} value
 * @param {Number} expireSec (optional)
 * @returns {Promise<Boolean>} - whether a new value was added
 */
function addToSet(key, value, expireSec) {
  return registry.addToSet(key, value, expireSec);
}

/**
 * Get all values from set
 *
 * @param {String} key
 * @returns {Promise<Array>}
 */
function listSet(key) {
  return registry.listSet(key);
}

/**
 * Get remaining TTL for key.
 * Return 0 if key does not exist
 *
 * @param {String} key
 * @returns {Promise<Number>}
 */
function getTTLSec(key) {
  return registry.getTTLSec(key);
}

/**
 * Initialize registry
 *
 * @returns {Promise}
 */
function init() {
  return registry.init();
}

/**
 * Destroy registry
 *
 * @returns {Promise}
 */
function destroy() {
  return registry.destroy();
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
