const _ = require('lodash');
const { v4: uuidv4 } = require('uuid');
const { PROJECTS_FILE, CONTENT_FILE } = require('./utils/constants');
const {
  readFileJSON,
  writeFileJSON,
  deleteFileJSON,
  findFiles,
} = require('./utils/files');

/**
 * @implements {createProject}
 */
async function createProject(options, payload) {
  const { data } = payload;

  // read projects
  let projects = {};
  try {
    projects = await readFileJSON(PROJECTS_FILE);
  } catch (e) {
    // no-op
  }

  if (projects[data.slug]) {
    throw new Error(`Project with slug ${data.slug} already exists`);
  }

  projects[data.slug] = {
    name: data.name,
    slug: data.slug,
    source_lang_code: data.source_lang_code,
    token: uuidv4(),
    secret: uuidv4(),
    target_languages: [],
  };
  await writeFileJSON(PROJECTS_FILE, projects);

  return {
    data: {
      name: data.name,
      slug: data.slug,
      source_language: {
        code: data.source_lang_code,
        name: data.source_lang_code,
      },
    },
    meta: {
      token: projects[data.slug].token,
      secret: projects[data.slug].secret,
    },
  };
}

/**
 * @implements {deleteProject}
 */
async function deleteProject(options, payload) {
  const { slug } = payload.data;

  let projects;
  try {
    projects = await readFileJSON(PROJECTS_FILE);
  } catch (e) {
    throw new Error('Could not find any projects');
  }

  const project = projects[slug];

  if (!project) {
    throw Error(`Project slug ${slug} does not exist`);
  }

  delete projects[slug];
  await writeFileJSON(PROJECTS_FILE, projects);

  // remove content files
  const pattern = CONTENT_FILE
    .replace('{__project__}', slug)
    .replace('{__lang__}', '*');
  const files = await findFiles(pattern);
  await Promise.all(_.map(files, (file) => deleteFileJSON(file)));

  return {
    data: {
      name: project.name,
      slug: project.slug,
    },
  };
}

/**
 * @implements {listProjects}
 */
async function listProjects() {
  let projects = {};
  try {
    projects = await readFileJSON(PROJECTS_FILE);
  } catch (e) {
    // no-op
  }

  return {
    data: _.map(projects, (project) => ({
      name: project.name,
      slug: project.name,
      source_language: {
        code: project.source_lang_code,
        name: project.source_lang_code,
      },
      target_languages: _.map(project.target_languages, (code) => ({
        code,
        name: code,
      })),
      meta: {
        token: project.token,
        secret: project.secret,
      },
    })),
  };
}

/**
 * @implements {addProjectLanguages}
 */
async function addProjectLanguages(options, payload) {
  const { slug } = payload.data;
  let projects;
  try {
    projects = await readFileJSON(PROJECTS_FILE);
  } catch (e) {
    throw new Error('Could not find any projects');
  }

  const project = projects[slug];
  if (!project) {
    throw Error(`Project slug ${slug} does not exist`);
  }

  const addedLanguages = [];
  _.each(payload.data.target_languages, (entry) => {
    if (project.target_languages.indexOf(entry.code) === -1) {
      project.target_languages.push(entry.code);
      addedLanguages.push({
        code: entry.code,
        name: entry.code,
      });
    }
  });

  await writeFileJSON(PROJECTS_FILE, projects);

  return {
    data: addedLanguages,
  };
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
  const { slug } = payload.data;
  let projects;
  try {
    projects = await readFileJSON(PROJECTS_FILE);
  } catch (e) {
    throw new Error('Could not find any projects');
  }

  const project = projects[slug];
  if (!project) {
    throw Error(`Project slug ${slug} does not exist`);
  }

  const deletedLanguages = [];
  _.each(payload.data.target_languages, (entry) => {
    if (project.target_languages.indexOf(entry.code) >= 0) {
      project.target_languages = _.without(project.target_languages, entry.code);
      deletedLanguages.push({
        code: entry.code,
        name: entry.code,
      });
    }
  });

  await writeFileJSON(PROJECTS_FILE, projects);

  return {
    data: deletedLanguages,
  };
}

module.exports = {
  createProject,
  deleteProject,
  listProjects,
  addProjectLanguages,
  deleteProjectLanguages,
};
