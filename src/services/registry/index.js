const config = require('../../config');
const logger = require('../../logger');

const registry = require(`./strategies/${config.get('settings:registry')}`);
logger.info(`Registry strategy: ${config.get('settings:registry')}`);

/**
 * Delete a key from registry
 *
 * @param {String} key
 * @param {Object} params (optional)
 * @returns {Promise}
 */
function del(key, params) {
  return registry.del(key, params);
}

/**
 * Get registry value by key
 *
 * @param {String} key
 * @param {Object} params (optional)
 * @returns {Promise<value>}
 */
function get(key, params) {
  return registry.get(key, params);
}

/**
 * Set a value to registry
 *
 * @param {String} key
 * @param {*} data
 * @param {Number} expireSec (optional)
 * @param {Object} params (optional)
 * @returns {Promise}
 */
function set(key, data, expireSec, params) {
  return registry.set(key, data, expireSec, params);
}

/**
 * Find all keys in registry
 *
 * @param {Object} params (optional)
 * @returns {Promise<Array[String]>}
 */
function findAll(params) {
  return registry.findAll(params);
}

/**
 * Increase key value
 *
 * @param {String} key
 * @param {Number} increment
 * @param {Number} expireSec (optional)
 * @param {Object} params (optional)
 * @returns {Promise}
 */
function incr(key, increment, expireSec, params) {
  return registry.incr(key, increment, expireSec, params);
}

/**
 * Add value to set
 *
 * @param {String} key
 * @param {*} value
 * @param {Number} expireSec (optional)
 * @param {Object} params (optional)
 * @returns {Promise<Boolean>} - whether a new value was added
 */
function addToSet(key, value, expireSec, params) {
  return registry.addToSet(key, value, expireSec, params);
}

/**
 * Get all values from set
 *
 * @param {String} key
 * @param {Object} params (optional)
 * @returns {Promise<Array>}
 */
function listSet(key, params) {
  return registry.listSet(key, params);
}

/**
 * Get remaining TTL for key.
 * Return 0 if key does not exist
 *
 * @param {String} key
 * @param {Object} params (optional)
 * @returns {Promise<Number>}
 */
function getTTLSec(key, params) {
  return registry.getTTLSec(key, params);
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
