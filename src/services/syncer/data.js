const config = require('../../config');
const validators = require('../../helpers/validators');

const syncer = require(`./strategies/${config.get('settings:syncer')}/data`);

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
 * Gets localization status of project language
 *
 * @interface
 * @param {Object} options
 * @param {Object} options.token
 * @returns {Object} An object with statistics
 *  {
 *    data: [
 *      //TBD
 *    ]
 *  }
 */
const getProjectLanguageStatus = async (options, langCode) => {
  if (!langCode) throw new Error('A lang_code is required');

  const data = await syncer.getProjectLanguageStatus(options, langCode);
  return data;
};

/**
 * Gets a list of available translations for the specific token/single language
 *
 * @interface
 * @param {Object} options
 * @param {Object} options.token
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
 *         context: <>,
 *         developer_notes: <>,
 *         ...
 *       }
 *     }
 *     <key>: { .. }
 *   },
 *   meta: {
 *     purge: <boolean>,
 *   },
 * }
 *
 * @returns {Object} Object with report on operation
 * {
 *   created: <number>,
 *   updated: <number>,
 *   skipped: <number>,
 *   errors: [..],
 * }
 */
async function pushSourceContent(options, payload) {
  validators.validatePushSourceContent(payload);
  const data = await syncer.pushSourceContent(options,
    payload.data, payload.meta || {});
  return data;
}

/**
 * Push translations
 *
 * @interface
 * @param {Object} options
 * @param {Object} options.token
 * @param {String} lang_code The language code of the translations
 * @param {Object} payload
 * {
 *   data: {
 *     <key>: {
 *       string: <string>,
 *     },
 *     <key>: { .. }
 *   }
 * }
 *
 * @returns {Object} Object with report on operation
 * {
 *   created: <number>,
 *   updated: <number>,
 *   skipped: <number>,
 *   errors: [..],
 * }
 */
async function pushTranslations(options, langCode, payload) {
  if (!langCode) throw new Error('A lang_code is required');
  validators.validatePushTranslations(payload);

  const data = await syncer.pushTranslations(options, langCode, payload);
  return data;
}

module.exports = {
  getLanguages,
  getProjectLanguageStatus,
  getProjectLanguageTranslations,
  pushSourceContent,
  pushTranslations,
};
