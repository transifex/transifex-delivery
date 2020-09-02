/* eslint-disable no-unused-vars */

/**
 * @implements {createProject}
 */
async function createProject(options, payload) {
  throw new Error('Not Implemented');
}

/**
 * @implements {deleteProject}
 */
async function deleteProject(options, payload) {
  throw new Error('Not Implemented');
}

/**
* @implements {listProjects}
*/
async function listProjects(options) {
  throw new Error('Not Implemented');
}

/**
 * @implements {addProjectLanguages}
 */
async function addProjectLanguages(options, payload) {
  throw new Error('Not Implemented');
}

/**
 * @implements {deleteProjectLanguages}
 */
async function deleteProjectLanguages(options, payload) {
  throw new Error('Not Implemented');
}

module.exports = {
  createProject,
  deleteProject,
  listProjects,
  addProjectLanguages,
  deleteProjectLanguages,
};
