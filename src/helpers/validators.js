const joi = require('joi');

const PUSH_SOURCE_CONTENT_ROOT_SCHEMA = joi.object().keys({
  data: joi.object().required(),
  meta: joi.object(),
}).required();

const PUSH_SOURCE_CONTENT_DATA_SCHEMA = joi.object().pattern(/./, joi.object().keys(
  {
    string: joi.string().allow(''),
    meta: joi.any(),
  },
)).required();

const PUSH_SOURCE_CONTENT_META_SCHEMA = joi.object().keys({
  purge: joi.boolean(),
  override_tags: joi.boolean(),
  override_occurrences: joi.boolean(),
  keep_translations: joi.boolean(),
  dry_run: joi.boolean(),
});

/**
 * Handle a data validation result
 *
 * @param {Object} error An error Object from the data validation
 * @param {Boolean} isWeb A boolean to understand if this is an web API
 *                         response or any other kind eg terminal
 *
 * @returns {Error} Throws an error only if there is one passed
 */
function handleResult(error, isWeb) {
  if (error !== null) {
    const { details } = error;
    const err = new Error();
    if (isWeb) {
      err.message = 'Invalid Payload';
      err.details = details;
      err.status = 422;
      err.code = 'invalid';
    } else {
      err.message = details.map((i) => i.message).join(',');
    }
    throw err;
  }
}

function validatePushSourceContentRoot(payload) {
  const { error } = joi.validate(payload, PUSH_SOURCE_CONTENT_ROOT_SCHEMA);
  handleResult(error, true);
}

function validatePushSourceContentData(payload) {
  const { error } = joi.validate(payload, PUSH_SOURCE_CONTENT_DATA_SCHEMA);
  handleResult(error, true);
}

function validatePushSourceContentMeta(payload) {
  const { error } = joi.validate(payload, PUSH_SOURCE_CONTENT_META_SCHEMA);
  handleResult(error, true);
}

module.exports = {
  validatePushSourceContentRoot,
  validatePushSourceContentData,
  validatePushSourceContentMeta,
};
