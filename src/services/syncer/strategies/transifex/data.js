const _ = require('lodash');
const NodeCache = require('node-cache');
const api = require('./utils/api');
const errors = require('./utils/errors');
const logger = require('../../../../logger');

const TokenCache = new NodeCache({
  stdTTL: 60 * 60 * 4, // 4hours
});

/**
 * Validates the token and gets the data we need to continue.
 * In this case would look in some kind of storage for
 * blacklisted tokens and communicate with Transifex API and get
 * project_slug, organization_slug and resource_slug
 *
 * @param {Object} options
 * @param {Object} options.token
 * @returns {Object} Copy of the options object with all the required data
 */
async function getTokenInformation(options) {
  const cacheKey = options.token.original;

  // read from cache
  const cachedOptions = TokenCache.get(cacheKey);
  if (cachedOptions) {
    logger.info(`Reading token information from cache: ${cacheKey}`);
    return cachedOptions;
  }

  // cache failed, read from API
  const timerStart = Date.now();
  const info = _.cloneDeep(options);

  // Get organization slug
  try {
    const organization = await api.getOrganization(info.token.original);
    if (!organization.slug) throw new errors.APIError('Not Found', 404);

    const project = await api.getProject(info.token.original, {
      organization_slug: organization.slug,
    });

    if (!project.slug) throw new errors.APIError('Not Found', 404);

    const resource = await api.getResource(info.token.original, {
      organization_slug: organization.slug,
      project_slug: project.slug,
    });
    info.token = _.extend(info.token, {
      organization_slug: organization.slug,
      project_slug: project.slug,
      resource_slug: resource.slug,
    });
  } catch (e) {
    const status = e.response ? e.response.status : e.status;
    if (status !== 401) logger.error(e.message);
    throw new errors.APIError(e.message, status || 500);
  }
  // save to cache
  TokenCache.set(cacheKey, info);
  logger.info(`Token information stored in cache: ${cacheKey} [${Date.now() - timerStart}msec]`);
  return info;
}

/**
 * @implements {getLanguages}
 */
async function getLanguages(option) {
  const info = await getTokenInformation(option);
  try {
    const result = await api.getLanguages(info.token.original, {
      organization_slug: info.token.organization_slug,
      project_slug: info.token.project_slug,
      resource_slug: info.token.resource_slug,
    });
    return result;
  } catch (e) {
    if (e.response.status !== 401) logger.error(e);
    throw new errors.APIError(e.message, e.response.status);
  }
}

/**
 * @implements {getProjectLanguageTranslations}
 */
async function getProjectLanguageTranslations(options, langCode) {
  const info = await getTokenInformation(options);
  try {
    const result = await api.getProjectLanguageTranslations(
      info.token.original, {
        organization_slug: info.token.organization_slug,
        project_slug: info.token.project_slug,
        resource_slug: info.token.resource_slug,
        lang_code: langCode,
      },
    );
    return result;
  } catch (e) {
    if (e.response.status !== 401) logger.error(e);
    throw new errors.APIError(e.message, e.response.status);
  }
}

/**
 * @implements {pushSourceContent}
 */
async function pushSourceContent(options, payload, meta) {
  const info = await getTokenInformation(options);
  const result = await api.pushSourceContent(info.token.original, {
    organization_slug: info.token.organization_slug,
    project_slug: info.token.project_slug,
    resource_slug: info.token.resource_slug,
    payload,
    meta,
  });
  return result;
}

/**
 * @implements {pushTranslations}
 */
// eslint-disable-next-line no-unused-vars
async function pushTranslations(options, langCode, payload) {
  throw new Error('Not Implemented');
}

/**
 * @implements {getProjectLanguageStatus}
 */
// eslint-disable-next-line no-unused-vars
async function getProjectLanguageStatus(options, langCode) {
  throw new Error('Not Implemented');
}

module.exports = {
  getTokenInformation,
  getLanguages,
  getProjectLanguageStatus,
  getProjectLanguageTranslations,
  pushSourceContent,
  pushTranslations,
};
