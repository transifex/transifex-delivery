const config = require('../../config');
const logger = require('../../logger');
const validators = require('../../helpers/validators');

const syncer = require(`./strategies/${config.get('settings:syncer')}/data`);
logger.info(`Syncer strategy: ${config.get('settings:syncer')}`);

/**
 * Verify token/secret credentials
 *
 * @interface
 * @param {Object} options
 * @param {Object} options.token
 * @returns {Boolean}
 */
async function verifyCredentials(options) {
  const data = await syncer.verifyCredentials(options);
  return data;
}

/**
 * Gets a list of available languages for the specific token
 *
 * @interface
 * @param {Object} options
 * @param {Object} options.token
 * @returns {Object} An object with the available languages
 *  {
 *    data: [
 *      {
 *        name: <name>,
 *        code: <code>,
 *        localized_name: <localized_name>,
 *        rtl: <rtl>,
 *      }
 *    ]
 *  }
 */
async function getLanguages(options) {
  const data = await syncer.getLanguages(options);
  return data;
}

/**
 * Gets a list of available translations for the specific token/single language
 *
 * @interface
 * @param {Object} options
 * @param {Object} options.token
 * @param {Object} options.filter (optional)
 * @param {String} options.filter.tags (optional)
 * @param {String} options.filter.status (optional)
 * @param {String} lang_code The language code of the translations
 * @returns {Object} An object with the available strings and translations
 * Important: Keep in mind that the `data` key is an object
 *
 *  {
 *    data: {
 *      <string_key>: {
 *        string: <string>,
 *      }
 *    }
 *  }
 */
async function getProjectLanguageTranslations(options, langCode) {
  if (!langCode) throw new Error('A lang_code is required');
  const data = await syncer.getProjectLanguageTranslations(options, langCode);
  return data;
}

/**
 * Push source content
 *
 * @interface
 * @param {Object} options
 * @param {Object} options.token
 * @param {Object} payload
 * {
 *   data: {
 *     <key>: {
 *       string: <string>,
 *       meta: {
 *         context: <string>,
 *         developer_notes: <string>,
 *         character_limit: <number>,
 *         tags: <array>,
 *         occurrences: <array>,
 *         ...
 *       }
 *     }
 *     <key>: { .. }
 *   },
 *   meta: {
 *     purge: <boolean>,
 *     override_tags: <boolean>,
 *     dry_run: <boolean>
 *   },
 * }
 *
 * @returns {Object} Object with report on operation
 * {
 *   created: <number>,
 *   updated: <number>,
 *   skipped: <number>,
 *   deleted: <number>,
 *   failed: <number>,
 *   errors: [..],
 * }
 */
async function pushSourceContent(options, payload) {
  validators.validatePushSourceContent(payload);
  const data = await syncer.pushSourceContent(
    options,
    payload.data,
    payload.meta || {},
  );
  return data;
}

module.exports = {
  verifyCredentials,
  getLanguages,
  getProjectLanguageTranslations,
  pushSourceContent,
};
