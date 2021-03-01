const _ = require('lodash');
const { getLanguageInfo } = require('../../../../helpers/languages');
const { PROJECTS_FILE, CONTENT_FILE } = require('./utils/constants');
const { readFileJSON, writeFileJSON } = require('./utils/files');

/**
 * Locate a project by token
 *
 * @param {String} token
 * @return {Object} project entry
 */
async function getProjectByToken(token) {
  try {
    const projects = await readFileJSON(PROJECTS_FILE);
    const project = _.find(_.values(projects), { token });
    if (!project) throw new Error('Could not find project by token');
    return project;
  } catch (e) {
    throw new Error('Could not find any projects');
  }
}

/**
 * Get a file path based on project and language
 *
 * @param {String} projectSlug
 * @param {String} langCode
 * @returns {String}
 */
function getContentFile(projectSlug, langCode) {
  return CONTENT_FILE
    .replace('{__project__}', projectSlug)
    .replace('{__lang__}', langCode);
}

/**
 * @implements {verifyCredentials}
 */
async function verifyCredentials(options) {
  try {
    const project = await getProjectByToken(options.token);
    return !!project;
  } catch (e) {
    return false;
  }
}

/**
 * @implements {getLanguages}
 */
async function getLanguages(options) {
  const project = await getProjectByToken(options.token);
  return {
    data: _.map([project.source_lang_code, ...project.target_languages], (code) => {
      const lang = getLanguageInfo(code);
      return {
        name: lang.name,
        code,
        localized_name: lang.localized_name,
        rtl: lang.rtl,
      };
    }),
    meta: {
      source_lang_code: project.source_lang_code,
    },
  };
}

/**
 * @implements {getProjectLanguageTranslations}
 */
async function getProjectLanguageTranslations(options, langCode) {
  const project = await getProjectByToken(options.token);
  const filename = getContentFile(project.slug, langCode);
  const translations = {};

  try {
    const data = await readFileJSON(filename);
    _.each(data, (value, key) => {
      translations[key] = {
        string: value,
      };
    });
  } catch (e) {
    if (project.target_languages.indexOf(langCode) === -1) {
      throw new Error('Language does not exist');
    }
  }

  return {
    data: translations,
  };
}

/**
 * @implements {pushSourceContent}
 */
async function pushSourceContent(options, payload) {
  const project = await getProjectByToken(options.token);
  const filename = getContentFile(project.slug, project.source_lang_code);
  let data = {};
  try {
    data = await readFileJSON(filename);
  } catch (e) {
    // no-op
  }

  if (payload.meta && payload.meta.purge) data = {};

  let created = 0;
  let updated = 0;
  let skipped = 0;

  const failed = 0;
  const deleted = 0;
  const errors = [];

  _.each(payload.data, (value, key) => {
    if (!data[key]) created += 1;
    else if (data[key] === value.string) skipped += 1;
    else updated += 1;
    data[key] = value.string;
  });

  await writeFileJSON(filename, data);

  return {
    created,
    updated,
    skipped,
    deleted,
    failed,
    errors,
  };
}

/**
 * @implements {pushTranslations}
 */
async function pushTranslations(options, langCode, payload) {
  const project = await getProjectByToken(options.token);

  if (project.target_languages.indexOf(langCode) === -1) {
    throw new Error(`Project does not have target language ${langCode}`);
  }

  const filename = getContentFile(project.slug, langCode);

  let data = {};
  try {
    data = await readFileJSON(filename);
  } catch (e) {
    // no-op
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const failed = 0;
  const deleted = 0;
  const errors = [];

  _.each(payload.data, (value, key) => {
    if (!data[key]) created += 1;
    else if (data[key] === value.string) skipped += 1;
    else updated += 1;
    data[key] = value.string;
  });

  await writeFileJSON(filename, data);

  return {
    created,
    updated,
    skipped,
    deleted,
    failed,
    errors,
  };
}

module.exports = {
  verifyCredentials,
  getLanguages,
  getProjectLanguageTranslations,
  pushSourceContent,
  pushTranslations,
};
