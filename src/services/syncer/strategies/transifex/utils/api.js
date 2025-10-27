const _ = require('lodash');
const apiUrls = require('./api_urls');
const apiPayloads = require('./api_payloads');
const transformer = require('./transformer');
const axios = require('../../../../../helpers/axios');
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

  const urlParams = {
    ORGANIZATION_SLUG: `o:${options.organization_slug}`,
    PROJECT_SLUG: `p:${options.project_slug}`,
    RESOURCE_SLUG: `r:${options.resource_slug}`,
    LANGUAGE_CODE: `l:${options.lang_code}`,
  };

  // add filters
  if (options.filter_tags) {
    urlParams.FILTER_TAGS = options.filter_tags;
  }
  if (options.filter_status) {
    urlParams.FILTER_STATUS = options.filter_status;
  }

  let url = apiUrls.getUrl('GET_RESOURCE_TRANSLATIONS', urlParams);
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

  const urlParams = {
    ORGANIZATION_SLUG: `o:${options.organization_slug}`,
    PROJECT_SLUG: `p:${options.project_slug}`,
    RESOURCE_SLUG: `r:${options.resource_slug}`,
  };

  // add filter
  if (options.filter_tags) {
    urlParams.FILTER_TAGS = options.filter_tags;
  }

  let url = apiUrls.getUrl('GET_RESOURCE_STRINGS', urlParams);
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

async function getRevisions(token, options) {
  const concatenatedData = {};
  const urlParams = {
    ORGANIZATION_SLUG: `o:${options.organization_slug}`,
    PROJECT_SLUG: `p:${options.project_slug}`,
    RESOURCE_SLUG: `r:${options.resource_slug}`,
  };
  if (options.filter_tags) {
    urlParams.FILTER_TAGS = options.filter_tags;
  }
  let url = apiUrls.getUrl('GET_RESOURCE_STRINGS_REVISIONS', urlParams);
  const headers = apiUrls.getHeaders(token);
  let result = null;
  while (url) {
    logger.info(`GET ${url}`);
    const { data } = await axios.get(url, headers);
    url = data.links.next;
    result = transformer
      .parseSourceStringRevisionForIdLookup(data.data);
    Object.entries(result).forEach(([key, value]) => {
      if (key in concatenatedData) {
        concatenatedData[key] = [...concatenatedData[key], ...value];
      } else {
        concatenatedData[key] = value;
      }
    });
  }
  return concatenatedData;
}

/**
 * Makes a GET request to Transifex API to get resource strings on
 * specific keys list and creates a hashmap for quick lookups
 *
 * @param {Object} options
 * @param {String} options.organization_slug
 * @param {String} options.project_slug
 * @param {String} options.resource_slug
 * @param {Array} options.keys
 * @returns {Object} An hashmap for easy access to string  keys
 */
async function getSourceContentMapOnKeys(token, options) {
  let concatenatedData = new Map();

  const urlKey = 'GET_RESOURCE_STRINGS_FILTER_KEY';
  const urlParams = {
    ORGANIZATION_SLUG: `o:${options.organization_slug}`,
    PROJECT_SLUG: `p:${options.project_slug}`,
    RESOURCE_SLUG: `r:${options.resource_slug}`,
  };
  const headers = apiUrls.getHeaders(token);

  for (let i = 0; i < options.keys.length; i += 1) {
    const key = options.keys[i];
    const url = apiUrls.getUrl(urlKey, {
      ...urlParams,
      FILTER_KEY: key,
    });
    logger.info(`GET ${url}`);
    const { data } = await axios.get(url, headers);
    const result = transformer
      .parseSourceStringForKeyLookup(data.data);
    concatenatedData = new Map([...concatenatedData, ...result]);
  }

  return Object.fromEntries(concatenatedData);
}

async function getRevisionsOnKeys(token, options) {
  const concatenatedData = {};

  const urlKey = 'GET_RESOURCE_STRINGS_REVISIONS_FILTER_KEY';
  const urlParams = {
    ORGANIZATION_SLUG: `o:${options.organization_slug}`,
    PROJECT_SLUG: `p:${options.project_slug}`,
    RESOURCE_SLUG: `r:${options.resource_slug}`,
  };
  const headers = apiUrls.getHeaders(token);

  for (let i = 0; i < options.keys.length; i += 1) {
    const key = options.keys[i];
    const url = apiUrls.getUrl(urlKey, {
      ...urlParams,
      FILTER_KEY: key,
    });
    logger.info(`GET ${url}`);
    const { data } = await axios.get(url, headers);
    const result = transformer
      .parseSourceStringRevisionForIdLookup(data.data);
    Object.entries(result).forEach(([revisionKey, value]) => {
      if (revisionKey in concatenatedData) {
        concatenatedData[revisionKey] = [
          ...concatenatedData[revisionKey],
          ...value,
        ];
      } else {
        concatenatedData[revisionKey] = value;
      }
    });
  }

  return concatenatedData;
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
  const chunks = _.chunk(options.payload || [], 150);

  let createdStrings = [];
  let errors = [];
  const successPayloads = [];
  const failedPayloads = [];

  for (const originalChunk of chunks) {
    const cleanChunk = originalChunk.map((p) => _.omit(p, ['metaKey', 'metaAttrs']));
    try {
      logger.info(`POST ${url}`);
      const { data } = await axios.post(url, { data: cleanChunk }, headers);
      createdStrings = _.concat(createdStrings, data.data);
      successPayloads.push(...originalChunk);
    } catch (e) {
      errors = _.concat(errors, _.get(e, 'response.data.errors', [e.message]));
      failedPayloads.push(...originalChunk);
    }
  }
  return {
    createdStrings,
    errors,
    successPayloads,
    failedPayloads,
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
  const payloads = options.payload || [];

  let updatedStrings = [];
  let errors = [];
  const successPayloads = [];
  const failedPayloads = [];

  for (const original of payloads) {
    const clean = _.omit(original, ['metaKey', 'metaAttrs']);
    try {
      logger.info(`PATCH ${url}`);
      const { data } = await axios.patch(
        `${url}/${clean.id}`,
        { data: clean },
        headers,
      );
      updatedStrings = _.concat(updatedStrings, data.data);
      successPayloads.push(original);
    } catch (e) {
      errors = _.concat(errors, _.get(e, 'response.data.errors', [e.message]));
      failedPayloads.push(original);
    }
  }
  return {
    updatedStrings,
    errors,
    successPayloads,
    failedPayloads,
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
  const chunks = _.chunk(options.payload || [], 150);

  let count = 0;
  let errors = [];
  const successPayloads = [];
  const failedPayloads = [];

  for (const originalChunk of chunks) {
    const cleanChunk = originalChunk.map((p) => _.omit(p, ['metaKey', 'metaAttrs']));
    try {
      await axios({
        url,
        method: 'delete',
        data: { data: cleanChunk },
        ...headers,
      });
      count += originalChunk.length;
      successPayloads.push(...originalChunk);
    } catch (e) {
      errors = _.concat(errors, _.get(e, 'response.data.errors', [e.message]));
      failedPayloads.push(...originalChunk);
    }
  }

  return {
    count,
    errors,
    successPayloads,
    failedPayloads,
  };
}

/**
 * Delete translations via the API using PATCH
 *
 * @param {Object} token
 * @param {Object} options
 * @param {String} options.payload A list of payloads to patch
 * @returns {Object} An object with the updated strings and errors
 *
 */
async function deleteTranslationContent(token, options) {
  const url = apiUrls.getUrl('RESOURCE_TRANSLATIONS');
  const headers = apiUrls.getHeaders(token, true);
  const payloads = _.chunk(options.payload, 150);

  let deletedTranslations = [];
  let errors = [];

  for (const payload of payloads) {
    try {
      logger.info(`PATCH ${url}`);
      const { data } = await axios.patch(
        url,
        { data: payload },
        headers,
      );
      deletedTranslations = _.concat(deletedTranslations, data.data);
    } catch (e) {
      errors = _.concat(errors, _.get(e, 'response.data.errors', [e.message]));
    }
  }

  return {
    deletedTranslations,
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
 *   updated: <a number of strings that were updated>,
 *   deleted: <a number of strings that were deleted>,
 *   errors: <an array with all the errors>,
 * }
 */
async function pushSourceContent(token, options) {
  const strings = options.payload;
  const meta = options.meta || {};

  const createPayloads = [];
  const updatePayloads = [];
  const deletePayloads = [];
  const deleteTranslationPayloads = [];

  let existingStrings = {};
  let existingRevisions = {};
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let deleted = 0;
  let errors = [];

  const verbose = {
    created: [],
    updated: [],
    deleted: [],
    skipped: [],
    failed: [],
  };

  function toArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return String(val)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function toVerboseEntry(key, attrs) {
    const a = attrs || {};
    const ctx = Array.isArray(a.context) ? a.context : [];
    const occurrences = toArray(a.occurrences || []);
    let stringValue = '';

    const { strings: str } = a;

    if (typeof str === 'string') {
      stringValue = str;
    } else if (str && typeof str === 'object') {
      if (typeof str.other !== 'undefined' && str.other !== null) {
        stringValue = str.other;
      } else {
        stringValue = Object.values(str).filter(Boolean).join(' ');
      }
    }

    return {
      string: stringValue || '',
      key,
      occurrences,
      context: ctx,
    };
  }

  function preparePayloadForPost(attributes, key) {
    const resourceId = `o:${options.organization_slug}`
      + `:p:${options.project_slug}:r:${options.resource_slug}`;

    const payload = apiPayloads.getPushStringPayload(resourceId, attributes);
    payload.metaKey = key;
    payload.metaAttrs = attributes;
    createPayloads.push(payload);
  }

  function preparePayloadForPatch(key, attributes, mustPatchStrings) {
    const payload = apiPayloads.getPatchStringPayload(
      existingStrings[key].id,
      attributes,
      mustPatchStrings,
    );
    payload.metaKey = key;
    payload.metaAttrs = attributes;
    updatePayloads.push(payload);
  }

  function preparePayloadForDelete(key) {
    const existing = existingStrings[key] || {};
    if (!existing.id) return;
    const payload = apiPayloads.getDeleteStringPayload(existing.id);
    payload.metaKey = key;
    payload.metaAttrs = existing.attributes ? existing.attributes : {};
    deletePayloads.push(payload);
  }

  const payloadKeys = _.keys(strings);
  // check for optimal strategy to update content, reducing API calls
  const resource = await getResource(token, options);
  const resourceId = `${options.organization_slug}:${options.project_slug}:${options.resource_slug}`;

  if (!meta.purge) {
    logger.info(`Pushing ${payloadKeys.length} of ${resource.string_count} strings [${resourceId}]`);
    // if requests to get whole resource are less than the strings to be
    // pushed then fetch the whole resource
    if ((resource.string_count / apiUrls.getPageSize()) < payloadKeys.length) {
      [existingStrings, existingRevisions] = await Promise.all([
        getSourceContentMap(token, options),
        getRevisions(token, options),
      ]);
    } else {
      // ...else fetch details on specific keys we want to upload
      [existingStrings, existingRevisions] = await Promise.all([
        getSourceContentMapOnKeys(token, { ...options, keys: payloadKeys }),
        getRevisionsOnKeys(token, { ...options, keys: payloadKeys }),
      ]);
    }
  } else {
    logger.info(`Purging ${payloadKeys.length} of ${resource.string_count} strings [${resourceId}]`);
    // get all source strings
    [existingStrings, existingRevisions] = await Promise.all([
      getSourceContentMap(token, options),
      getRevisions(token, options),
    ]);
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
  const common = new Set();

  for (const key in strings) {
    if (Object.prototype.hasOwnProperty.call(strings, key)) {
      let attributes = {};
      const existingString = existingStrings[key];
      attributes = transformer.parseSourceStringForAPI(key, strings[key]);

      if (existingString) {
        common.add(key);
        // append tags
        if (meta.override_tags !== true) {
          attributes.tags = _.compact(_.uniq(
            _.union(existingString.attributes.tags, attributes.tags),
          ));
        }
        // append occurences
        if (meta.override_occurrences !== true) {
          attributes.occurrences = _.compact(_.uniq(
            _.union(
              (existingString.attributes.occurrences || '').split(','),
              (attributes.occurrences || '').split(','),
            ),
          )).join(',');
        }

        attributes.keep_translations = meta.keep_translations;
      }

      if (!existingString) {
        preparePayloadForPost(attributes, key);
      } else {
        const revisions = existingRevisions[existingString.id] || [];
        let mustPatchStrings = apiPayloads.stringContentChanged(
          attributes,
          existingString,
          revisions,
        );
        const mustPatchMetadata = apiPayloads.stringMetadataChanged(
          attributes,
          existingString.attributes,
        );
        // Temporary fix for tikogames org to always update strings
        // until we implement the update_previous_source_strings flag
        if (options.organization_slug === 'tikogames') {
          mustPatchStrings = true;
        }

        // Log the organization accessing the revision list
        // This helps us track usage and identify which orgs are actively using it
        // so we can reach out if we plan to disable this feature in the future
        if (_.some(
          revisions,
          (revision) => _.isEqual(attributes.strings, revision),
        )) {
          logger.info(`Accessed revision list, org: ${options.organization_slug}`);
        }

        if (mustPatchStrings || mustPatchMetadata) {
          preparePayloadForPatch(key, attributes, mustPatchStrings);
        } else {
          skipped += 1;
          verbose.skipped.push(toVerboseEntry(key, attributes));
        }
      }
    }
  }

  // prepare delete payloads only if purge is True
  if (meta.purge === true) {
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

  if (meta.dry_run) {
    deleted += deletePayloads.length;
    created += createPayloads.length;
    updated += updatePayloads.length;

    verbose.created.push(
      ...createPayloads.map((p) => toVerboseEntry(p.metaKey, p.metaAttrs)),
    );
    verbose.updated.push(
      ...updatePayloads.map((p) => toVerboseEntry(p.metaKey, p.metaAttrs)),
    );
    verbose.deleted.push(
      ...deletePayloads.map((p) => toVerboseEntry(p.metaKey, p.metaAttrs)),
    );
  } else {
    // Send for Delete and return errors
    const deletedStrings = await deleteSourceContent(token, {
      payload: deletePayloads,
    });
    deleted += deletedStrings.count;
    errors = _.concat(errors, deletedStrings.errors);

    const successDeleted = new Set(deletedStrings.successPayloads || []);
    deletePayloads.forEach((p) => {
      const entry = toVerboseEntry(p.metaKey, p.metaAttrs);
      (successDeleted.has(p) ? verbose.deleted : verbose.failed).push(entry);
    });

    // Send for post and return created and errors
    const postedStrings = await postSourceContent(token, {
      payload: createPayloads,
    });
    created += postedStrings.createdStrings.length;
    errors = _.concat(errors, postedStrings.errors);

    const successCreated = new Set(postedStrings.successPayloads || []);
    createPayloads.forEach((p) => {
      const entry = toVerboseEntry(p.metaKey, p.metaAttrs);
      (successCreated.has(p) ? verbose.created : verbose.failed).push(entry);
    });

    // Send for Patch and return updated and errors
    const patchedStrings = await patchSourceContent(token, {
      payload: updatePayloads,
    });
    updated += (patchedStrings.successPayloads || []).length;
    errors = _.concat(errors, patchedStrings.errors);

    const successUpdated = new Set(patchedStrings.successPayloads || []);
    updatePayloads.forEach((p) => {
      const entry = toVerboseEntry(p.metaKey, p.metaAttrs);
      (successUpdated.has(p) ? verbose.updated : verbose.failed).push(entry);
    });

    // Send for delete translations
    if (!_.isEmpty(deleteTranslationPayloads)) {
      // Get target languages
      let targetLanguageCodes = [];
      try {
        const { data } = (await getTargetLanguages(token, options));
        targetLanguageCodes = _.map(data, (lang) => lang.code);
      } catch (err) {
        // no-op
      }
      for (let i = 0; i < targetLanguageCodes.length; i += 1) {
        const langCode = targetLanguageCodes[i];
        // Add lang code in the payload
        const payload = _.map(deleteTranslationPayloads, (entry) => ({
          ...entry,
          id: `${entry.id}:l:${langCode}`,
        }));
        // Delete language batch
        const deletedTranslations = await deleteTranslationContent(token, {
          payload,
        });
        errors = _.concat(errors, deletedTranslations.errors);
      }
    }
  }

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
    verbose,
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
  getRevisions,
  getRevisionsOnKeys,
};
