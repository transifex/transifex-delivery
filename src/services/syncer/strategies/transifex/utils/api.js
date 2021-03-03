const axios = require('axios');
const _ = require('lodash');
const apiUrls = require('./api_urls');
const apiPayloads = require('./api_payloads');
const transformer = require('./transformer');
const logger = require('../../../../../logger');

/**
 * Make a GET request to Transifex API to get an Organization based on
 * the token
 *
 * @returns {Object} An object with the Organization basic information
 */
async function getOrganization(token) {
  const url = apiUrls.getUrl('ORGANIZATIONS');

  logger.info(`GET ${url}`);
  const apiResult = await axios.get(url, apiUrls.getHeaders(token));
  const { data } = apiResult.data;

  let result = {};
  if (data[0]) result = data[0].attributes;
  return result;
}

/**
 * Make a GET request to Transifex API to get an Project based on
 * the token and a specific Organization slug
 *
 * @param {Object} options
 * @param {String} options.organization_slug
 * @returns {Object} An object with the Project basic information
 */
async function getProject(token, options) {
  const url = apiUrls.getUrl('PROJECTS', {
    ORGANIZATION_SLUG: `o:${options.organization_slug}`,
  });

  logger.info(`GET ${url}`);
  const apiResult = await axios.get(url, apiUrls.getHeaders(token));
  const { data } = apiResult.data;

  let result = {};
  if (data[0]) {
    const { attributes, relationships } = data[0];
    result = attributes;
    // also extract source language
    const sourceLangId = _.get(relationships, 'source_language.data.id');
    if (sourceLangId) {
      result.source_lang_code = sourceLangId.replace(/^l:/, '');
    }
  }
  return result;
}

/**
 * Make a GET request to Transifex API to get an Project based on
 * the token and a specific Organization slug and Project Slug
 *
 * @param {Object} options
 * @param {String} options.organization_slug
 * @param {String} options.project_slug
 * @returns {Object} An object with the Resource basic information
 */
async function getResource(token, options) {
  const url = apiUrls.getUrl('RESOURCES', {
    ORGANIZATION_SLUG: `o:${options.organization_slug}`,
    PROJECT_SLUG: `p:${options.project_slug}`,
  });

  logger.info(`GET ${url}`);
  const apiResult = await axios.get(url, apiUrls.getHeaders(token));
  const { data } = apiResult.data;

  let result = {};
  if (data[0]) result = data[0].attributes;
  return result;
}

/**
 * Makes a GET request to Transifex API to get all the available languages
 * for a project
 *
 * @param {Object} options
 * @param {String} options.organization_slug
 * @param {String} options.project_slug
 * @returns {Object} An object with all the available languages for a project
 */
async function getTargetLanguages(token, options) {
  const url = apiUrls.getUrl('LANGUAGES', {
    ORGANIZATION_SLUG: `o:${options.organization_slug}`,
    PROJECT_SLUG: `p:${options.project_slug}`,
  });
  const result = {
    data: [],
  };

  logger.info(`GET ${url}`);
  const { data } = await axios.get(url, apiUrls.getHeaders(token));
  result.data = transformer.parseLanguages(data.data);
  return result;
}

/**
 * Makes a GET request to Transifex API to get all the available translations
 * for a project/language
 *
 * @param {Object} options
 * @param {String} options.organization_slug
 * @param {String} options.project_slug
 * @param {String} options.lang_code
 * @returns {Object} An object with all the available translations for a
 *                   project
 */
async function getProjectLanguageTranslations(token, options) {
  let concatenatedData = new Map();

  let urlKey = 'GET_RESOURCE_TRANSLATIONS';
  let urlParams = {
    ORGANIZATION_SLUG: `o:${options.organization_slug}`,
    PROJECT_SLUG: `p:${options.project_slug}`,
    RESOURCE_SLUG: `r:${options.resource_slug}`,
    LANGUAGE_CODE: `l:${options.lang_code}`,
  };

  // add filter
  if (options.filter_tags) {
    urlKey = 'GET_RESOURCE_TRANSLATIONS_FILTER_TAGS';
    urlParams = {
      ...urlParams,
      FILTER_TAGS: options.filter_tags,
    };
  }

  let url = apiUrls.getUrl(urlKey, urlParams);
  let result = null;
  while (url) {
    logger.info(`GET ${url}`);
    const { data } = await axios.get(url, apiUrls.getHeaders(token));
    url = data.links.next;
    const keysHashmap = transformer
      .parseSourceStringForIdLookup(data.included);
    result = transformer
      .parseProjectLanguageTranslations(data.data, keysHashmap);
    concatenatedData = new Map([...concatenatedData, ...result]);
  }
  return {
    data: Object.fromEntries(concatenatedData),
  };
}

/**
 * Makes a GET request to Transifex API to get resource strings and creates
 * a hashmap for quick lookups
 *
 * @param {Object} options
 * @param {String} options.organization_slug
 * @param {String} options.project_slug
 * @param {String} options.resource_slug
 * @returns {Object} An hashmap for easy access to string  keys
 */
async function getSourceContentMap(token, options) {
  let concatenatedData = new Map();

  let urlKey = 'GET_RESOURCE_STRINGS';
  let urlParams = {
    ORGANIZATION_SLUG: `o:${options.organization_slug}`,
    PROJECT_SLUG: `p:${options.project_slug}`,
    RESOURCE_SLUG: `r:${options.resource_slug}`,
  };

  // add filter
  if (options.filter_tags) {
    urlKey = 'GET_RESOURCE_STRINGS_FILTER_TAGS';
    urlParams = {
      ...urlParams,
      FILTER_TAGS: options.filter_tags,
    };
  }

  let url = apiUrls.getUrl(urlKey, urlParams);
  const headers = apiUrls.getHeaders(token);

  let result = null;
  while (url) {
    logger.info(`GET ${url}`);
    const { data } = await axios.get(url, headers);
    url = data.links.next;
    result = transformer
      .parseSourceStringForKeyLookup(data.data);
    concatenatedData = new Map([...concatenatedData, ...result]);
  }

  return Object.fromEntries(concatenatedData);
}

/**
 * Creates new content via the API by using POST after content is being chunked
 * to 150 items
 *
 * @param {Object} token
 * @param {Object} options
 * @param {String} options.payload A list of payloads to post
 * @returns {Object} An object with the created strings and errors
 *
 */
async function postSourceContent(token, options) {
  const url = apiUrls.getUrl('RESOURCE_STRINGS');
  const headers = apiUrls.getHeaders(token, true);
  const payloads = _.chunk(options.payload, 150);

  let createdStrings = [];
  let errors = [];

  for (const payload in payloads) {
    if (Object.prototype.hasOwnProperty.call(payloads, payload)) {
      try {
        logger.info(`POST ${url}`);
        const { data } = await axios.post(url,
          { data: payloads[payload] }, headers);
        createdStrings = _.concat(createdStrings, data.data);
      } catch (e) {
        errors = _.concat(errors, e.response.data.errors);
      }
    }
  }
  return {
    createdStrings,
    errors,
  };
}

/**
 * Updates content via the API by using PATCH
 *
 * @param {Object} token
 * @param {Object} options
 * @param {String} options.payload A list of payloads to patch
 * @returns {Object} An object with the updated strings and errors
 *
 */
async function patchSourceContent(token, options) {
  const url = apiUrls.getUrl('RESOURCE_STRINGS');
  const headers = apiUrls.getHeaders(token);
  const payloads = options.payload;

  let updatedStrings = [];
  let errors = [];

  for (const payload in payloads) {
    if (Object.prototype.hasOwnProperty.call(payloads, payload)) {
      try {
        logger.info(`PATCH ${url}`);
        const { data } = await axios.patch(`${url}/${payloads[payload].id}`,
          { data: payloads[payload] }, headers);
        updatedStrings = _.concat(updatedStrings, data.data);
      } catch (e) {
        errors = _.concat(errors, e.response.data.errors);
      }
    }
  }
  return {
    updatedStrings,
    errors,
  };
}

/**
 * Deletes content via the API by using DELETE
 *
 * @param {Object} token
 * @param {Object} options
 * @param {String} options.payload A list of payloads to delte
 * @returns {Object} An object with the number of deleted strings and errors
 *
 */
async function deleteSourceContent(token, options) {
  const url = apiUrls.getUrl('RESOURCE_STRINGS');
  const headers = apiUrls.getHeaders(token, true);
  const payloads = _.chunk(options.payload, 150);

  let count = 0;
  let errors = [];

  for (const payload in payloads) {
    if (Object.prototype.hasOwnProperty.call(payloads, payload)) {
      try {
        await axios({
          url,
          method: 'delete',
          data: {
            data: payloads[payload],
          },
          ...headers,
        });
        count += payloads[payload].length;
      } catch (e) {
        errors = _.concat(errors, e.response.data.errors);
      }
    }
  }

  return {
    count,
    errors,
  };
}

/**
 * Sends content to Transifex.
 * Gets a request with a payload and applies some logic to differenciate
 * strings that:
 *   - Are already in Transifex and need to be updated
 *   - Strings to be created
 *
 * We do this by:
 * - Start with getting all existing content from the API
 * - Differenciate content that needs to be created or updated
 * - Do POST/PATCH actions and return the results
 * - Send a report as a response with all the changes or errorrs in the content
 *
 * @param {Object} options
 * @param {String} options.organization_slug
 * @param {String} options.project_slug
 * @param {String} options.resource_slug
 * @returns {Object} An object with a report on the actions and errors
 *
 * {
 *   created: <a number of strings created>,
 *   failed: <a number of strings failed to be saved>,
 *   skipped: <a number of strings that were skipped>,
 *   errors: <an array with all the errors>,
 * }
 */

async function pushSourceContent(token, options) {
  const strings = options.payload;
  const { meta } = options;

  const createPayloads = [];
  const updatePayloads = [];
  const deletePayloads = [];

  let existingStrings = {};
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let deleted = 0;
  let errors = [];

  function stringNeedsUpdate(attributes, existingAttributes) {
    return !_.isEqual(attributes, existingAttributes);
  }

  function preparePayloadForPost(attributes) {
    const resourceId = `o:${options.organization_slug}`
      + `:p:${options.project_slug}:r:${options.resource_slug}`;

    const payload = apiPayloads.getPushStringPayload(resourceId, attributes);
    createPayloads.push(payload);
  }

  function preparePayloadForPatch(key, attributes) {
    const payload = apiPayloads.getPatchStringPayload(
      existingStrings[key].id, attributes,
    );
    updatePayloads.push(payload);
  }

  function preparePayloadForDelete(key) {
    const payload = apiPayloads.getDeleteStringPayload(existingStrings[key].id);
    deletePayloads.push(payload);
  }

  // Create payload for each string
  // existingStrings: Set of strings already in TX.
  // common: Set of strings both in pushed set and in TX.
  // existingMinusCommon: Set of strings in TX not included in common (i.e.
  //   the diff between existingStrings and common)
  //
  // - If a pushed string does not exist in TX we add it.
  // - If a pushed string exists already in TX (common):
  //     + If the pushed string needs update (change in tags, context etc)
  //       we patch it to TX
  //     + else we do nothing, we skip the string
  // - For strings that already existed in TX but do not exist in the
  //   pushed strings set (existingMinusCommon):
  //     + if purge option is true we delete them
  //     + if purge option is false we skip them - leave them be (essentialy
  //       we append to them).
  existingStrings = await getSourceContentMap(token, options);
  const common = new Set();

  for (const key in strings) {
    if (Object.prototype.hasOwnProperty.call(strings, key)) {
      let attributes = {};
      const existingString = existingStrings[key];

      if (existingString) {
        common.add(key);
      }

      attributes = transformer.parseSourceStringForAPI(key, strings[key]);
      if (!existingString) {
        preparePayloadForPost(attributes);
      } else if (stringNeedsUpdate(attributes, existingString.attributes)) {
        preparePayloadForPatch(key, attributes);
      } else {
        skipped += 1;
      }
    }
  }

  // prepare delete payloads only if purge is True
  if (meta && meta.purge === true) {
    const existingMinusCommon = new Set();
    for (const key in existingStrings) {
      if (!common.has(key)) {
        existingMinusCommon.add(key);
      }
    }
    for (const key of existingMinusCommon.keys()) {
      preparePayloadForDelete(key);
    }
  }

  // Send for post and return created and errors
  const postedStrings = await postSourceContent(token, {
    payload: createPayloads,
  });
  created += postedStrings.createdStrings.length;
  errors = _.concat(errors, postedStrings.errors);

  // Send for Patch and return updated and errors
  const patchedStrings = await patchSourceContent(token, {
    payload: updatePayloads,
  });
  updated += patchedStrings.updatedStrings.length;
  errors = _.concat(errors, patchedStrings.errors);

  // Send for Delete and return errors
  const deletedStrings = await deleteSourceContent(token, {
    payload: deletePayloads,
  });
  deleted += deletedStrings.count;
  errors = _.concat(errors, deletedStrings.errors);

  return {
    created,
    updated,
    skipped,
    deleted,
    failed:
      createPayloads.length
      + updatePayloads.length
      + deletePayloads.length
      - (created + updated + deleted),
    errors,
  };
}

module.exports = {
  getOrganization,
  getProject,
  getResource,
  getTargetLanguages,
  getProjectLanguageTranslations,
  getSourceContentMap,
  pushSourceContent,
  patchSourceContent,
  postSourceContent,
};
