const config = require('../../config');
const validators = require('../../helpers/validators');

const syncer = require(`./strategies/${config.get('settings:syncer')}/management`);

/**
 * Create a new project
 *
 * @interface
 * @param {Object} options Generic options
 * @param {Object} payload
 * {
 *   data: {
 *     name: <project name>,
 *     slug: <project slug>,
 *     source_lang_code: <source language code>,
 *   }
 * }
 *
 * @returns {Object} An object describing the project
 * {
 *   data: {
 *     name: <project name>,
 *     slug: <project slug>,
 *     source_language: {
 *       code: <language code>,
 *       name: <language name>,
 *     },
 *   },
 *   meta: {
 *     token: <project token>,
 *     secret: <project secret>,
 *   },
 * }
 */
async function createProject(options, payload) {
  validators.validateCreateProject(payload);
  const data = await syncer.createProject(options, payload);
  return data;
}

/**
 * Delete a project
 *
 * @interface
 * @param {Object} options Generic options
 * @param {Object} payload
 * {
 *   data: {
 *     slug: <project slug>,
 *   }
 * }
 *
 * @returns {Object} An object describing the deleted project
 * {
 *   data: {
 *     name: <project name>,
 *     slug: <project slug>,
 *   },
 * }*
 */
async function deleteProject(options, payload) {
  validators.validateDeleteProject(payload);
  const data = await syncer.deleteProject(options, payload);
  return data;
}

/**
 * List all projects
 *
 * @interface
 * @returns {Object} An object describing available projects
 * {
 *   data: [{
 *     name: <project name>,
 *     slug: <project slug>,
 *     source_language: {
 *       code: <language code>,
 *       name: <language name>,
 *     },
 *     target_languages: [{
 *       code: <language code>,
 *       name: <language name>,
 *     }],
 *     meta: {
 *       token: <project token>,
 *       secret: <project secret>,
 *     }
 *   }]
 * }
 */
async function listProjects(options) {
  const data = await syncer.listProjects(options);
  return data;
}

/**
 * Add translation languages to project
 *
 * @interface
 * @param {String} options Generic options
 * @param {Object} payload
 * {
 *   data: {
 *     slug: <project slug>,
 *     target_languages: [{
 *      code: <language code>,
 *     }],
 *   }
 * }
 * @returns {Object} An object describing new languages added
 * {
 *   data: [{
 *     code: <language code>,
 *     name: <language name>,
 *   }]
 * }
 */
async function addProjectLanguages(options, payload) {
  validators.validateAddProjectLanguages(payload);
  const data = await syncer.addProjectLanguages(options, payload);
  return data;
}

/**
 * Delete translation languages from project
 *
 * @interface
 * @param {String} options Generic options
 * @param {Object} payload
 * {
 *   data: {
 *     slug: <project slug>,
 *     target_languages: [{
 *      code: <language code>,
 *     }],
 *   }
 * }
 * @returns {Object} An object describing languages deleted
 * {
 *   data: [{
 *     code: <language code>,
 *     name: <language name>,
 *   }]
 * }
 */
async function deleteProjectLanguages(options, payload) {
  validators.validateDeleteProjectLanguages(payload);
  const data = await syncer.deleteProjectLanguages(options, payload);
  return data;
}

module.exports = {
  createProject,
  deleteProject,
  listProjects,
  addProjectLanguages,
  deleteProjectLanguages,
};
