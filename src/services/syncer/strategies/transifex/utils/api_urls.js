const config = require('../../../../../config');

const TRANSIFEX_API_HOST = config.get('transifex:api_host');
const PAGE_LIMIT = config.get('transifex:page_limit');

// Keep a key/string to replace in url
const TRANSIFEX_API_KEYS = {
  ORGANIZATION_SLUG: 'o:organization_slug',
  PROJECT_SLUG: 'p:project_slug',
  LANGUAGE_CODE: 'l:language_code',
  RESOURCE_SLUG: 'r:resource_slug',
  FILTER_TAGS: 'f:tags',
  FILTER_KEY: 'f:key',
};

// Keep in one place the APIs entity keys
const ENTITY_IDS = {
  ORGANIZATION: 'o:organization_slug',
  PROJECT: 'o:organization_slug:p:project_slug',
  RESOURCE: 'o:organization_slug:p:project_slug:r:resource_slug',
  LANGUAGE: 'l:language_code',
  TAGS: 'f:tags',
  KEY: 'f:key',
};

const TRANSIFEX_API_URLS = {
  LANGUAGES: `/projects/${ENTITY_IDS.PROJECT}/languages`,
  RESOURCE_TRANSLATIONS: '/resource_translations',
  GET_RESOURCE_TRANSLATIONS: '/resource_translations?'
    + `filter[resource]=${ENTITY_IDS.RESOURCE}&`
    + `filter[language]=${ENTITY_IDS.LANGUAGE}&include=resource_string&`
    + `limit=${PAGE_LIMIT}`,
  GET_RESOURCE_TRANSLATIONS_FILTER_TAGS: '/resource_translations?'
    + `filter[resource]=${ENTITY_IDS.RESOURCE}&`
    + `filter[language]=${ENTITY_IDS.LANGUAGE}&include=resource_string&`
    + `filter[resource_string][tags][all]=${ENTITY_IDS.TAGS}&`
    + `limit=${PAGE_LIMIT}`,
  RESOURCE_STRINGS: '/resource_strings',
  GET_RESOURCE_STRINGS: '/resource_strings?'
    + `filter[resource]=${ENTITY_IDS.RESOURCE}&`
    + `limit=${PAGE_LIMIT}`,
  GET_RESOURCE_STRINGS_FILTER_KEY: '/resource_strings?'
    + `filter[resource]=${ENTITY_IDS.RESOURCE}&`
    + `filter[key]=${ENTITY_IDS.KEY}&`
    + `limit=${PAGE_LIMIT}`,
  GET_RESOURCE_STRINGS_FILTER_TAGS: '/resource_strings?'
    + `filter[resource]=${ENTITY_IDS.RESOURCE}&`
    + `filter[tags][all]=${ENTITY_IDS.TAGS}&`
    + `limit=${PAGE_LIMIT}`,
  ORGANIZATIONS: '/organizations',
  PROJECTS: `/projects?filter[organization]=${ENTITY_IDS.ORGANIZATION}`,
  RESOURCES: `/resources?filter[project]=${ENTITY_IDS.PROJECT}`,
  GET_RESOURCE_STRINGS_REVISIONS: '/resource_strings_revisions?'
    + `filter[resource_string][resource]=${ENTITY_IDS.RESOURCE}&`
    + `limit=${PAGE_LIMIT}`,
  GET_RESOURCE_STRINGS_REVISIONS_FILTER_TAGS: '/resource_strings_revisions?'
    + `filter[resource_string][resource]=${ENTITY_IDS.RESOURCE}&`
    + `filter[resource_string][tags][all]=${ENTITY_IDS.TAGS}&`
    + `limit=${PAGE_LIMIT}`,
  GET_RESOURCE_STRINGS_REVISIONS_FILTER_KEY: '/resource_strings_revisions?'
    + `filter[resource_string][resource]=${ENTITY_IDS.RESOURCE}&`
    + `filter[resource_string][key]=${ENTITY_IDS.KEY}&`
    + `limit=${PAGE_LIMIT}`,
};

function getUrl(url, parameters) {
  let result = `${TRANSIFEX_API_HOST}${TRANSIFEX_API_URLS[url]}`;

  for (const item in parameters) {
    if (Object.prototype.hasOwnProperty.call(parameters, item)) {
      result = result.replace(TRANSIFEX_API_KEYS[item], parameters[item]);
    }
  }
  return result;
}

function getHeaders(token, isBulk) {
  if (!token) throw new Error('No token given');
  const bulk = isBulk ? ';profile="bulk"' : '';
  return {
    headers: {
      Authorization: `ULF ${token}`,
      'Content-Type': `application/vnd.api+json${bulk}`,
    },
  };
}

function getPageSize() {
  return PAGE_LIMIT;
}

module.exports = {
  getUrl,
  getHeaders,
  getPageSize,
};
