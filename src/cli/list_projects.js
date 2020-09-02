/* eslint no-console: 0 */

/**
 * CLI: List projects
 */
const _ = require('lodash');
const syncer = require('../services/syncer/management');

async function command() {
  const projects = await syncer.listProjects({});
  if (!projects.data.length) {
    console.log('No projects available');
  } else {
    projects.data.forEach((project) => {
      console.log('---------------');
      console.log(`Name: ${project.name}`);
      console.log(`Slug: ${project.slug}`);
      console.log(`Project token: ${project.meta.token}`);
      console.log(`Project secret: ${project.meta.secret}`);
      console.log(`Source language code: ${project.source_language.code}`);
      _.each(project.target_languages, (lang) => {
        console.log(`Target language code: ${lang.code}`);
      });
    });
  }
}

command().then(() => process.exit()).catch((err) => {
  console.log(`Error: ${err.message}`);
});
