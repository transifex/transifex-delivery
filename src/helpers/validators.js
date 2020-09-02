const joi = require('joi');

const PUSH_SOURCE_CONTENT_SCHEMA = joi.object().keys({
  data: joi.object().pattern(/\w/,
    joi.object().keys(
      {
        string: joi.string().required(),
        meta: joi.any(),
      },
    ))
    .required(),
  meta: joi.object().keys({
    purge: joi.boolean(),
  }),
});

const PUSH_TRANSLATIONS_SCHEMA = joi.object().keys({
  data: joi.object().pattern(/\w/,
    joi.object().keys(
      {
        string: joi.string().required(),
      },
    ))
    .required(),
});

const CREATE_PROJECT_SCHEMA = joi.object().keys({
  data: joi.object().keys({
    name: joi.any().required(),
    slug: joi.alternatives().try(
      joi.string().max(32),
      joi.number().max(32),
      joi.string().token().max(32),
    ).required(),
    source_lang_code: joi.any().required(),
  }).required(),
});

const DELETE_PROJECT_SCHEMA = joi.object().keys({
  data: joi.object().keys({
    slug: joi.alternatives().try(
      joi.string().max(32),
      joi.number().max(32),
      joi.string().token().max(32),
    ).required(),
  }).required(),
});

const ADD_PROJECT_LANGUAGES_SCHEMA = joi.object().keys({
  data: joi.object().keys({
    slug: joi.alternatives().try(
      joi.string().max(32),
      joi.number().max(32),
      joi.string().token().max(32),
    ).required(),
    target_languages: joi.array().items(
      joi.object().keys({
        code: joi.string().required(),
      }).required(),
    ).required(),
  }).required(),
});

const DELETE_PROJECT_LANGUAGES_SCHEMA = joi.object().keys({
  data: joi.object().keys({
    slug: joi.alternatives().try(
      joi.string().max(32),
      joi.number().max(32),
      joi.string().token().max(32),
    ).required(),
    target_languages: joi.array().items(
      joi.object().keys({
        code: joi.string().required(),
      }).required(),
    ).required(),
  }).required(),
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
    } else {
      err.message = details.map((i) => i.message).join(',');
    }
    throw err;
  }
}

function validatePushSourceContent(payload) {
  const { error } = joi.validate(payload, PUSH_SOURCE_CONTENT_SCHEMA);
  handleResult(error, true);
}

function validatePushTranslations(payload) {
  const { error } = joi.validate(payload, PUSH_TRANSLATIONS_SCHEMA);
  handleResult(error, true);
}

function validateCreateProject(payload) {
  const { error } = joi.validate(payload, CREATE_PROJECT_SCHEMA);
  handleResult(error);
}

function validateDeleteProject(payload) {
  const { error } = joi.validate(payload, DELETE_PROJECT_SCHEMA);
  handleResult(error);
}

function validateAddProjectLanguages(payload) {
  const { error } = joi.validate(payload, ADD_PROJECT_LANGUAGES_SCHEMA);
  handleResult(error);
}

function validateDeleteProjectLanguages(payload) {
  const { error } = joi.validate(payload, DELETE_PROJECT_LANGUAGES_SCHEMA);
  handleResult(error);
}

module.exports = {
  validatePushSourceContent,
  validatePushTranslations,
  validateCreateProject,
  validateDeleteProject,
  validateAddProjectLanguages,
  validateDeleteProjectLanguages,
};
