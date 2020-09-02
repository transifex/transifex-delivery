/* eslint no-console: 0 */

/**
 * CLI: Delete project
 */
const { argv } = require('yargs').argv;
const syncer = require('../services/syncer/management');

async function command() {
  if (argv.slug) {
    const payload = await syncer.deleteProject({}, {
      data: {
        slug: argv.slug,
      },
    });
    console.log('Project deleted');
    console.log('---------------');
    console.log(`Name: ${payload.data.name}`);
    console.log(`Slug: ${payload.data.slug}`);
  } else {
    console.log('Usage: npm run delete-project -- --slug=<project slug>');
  }
}

command().then(() => process.exit()).catch((err) => {
  console.log(`Error: ${err.message}`);
});
