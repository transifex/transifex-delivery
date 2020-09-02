/* eslint no-console: 0 */

/**
 * CLI: Create project
 */
const { argv } = require('yargs');
const syncer = require('../services/syncer/management');

async function command() {
  if (argv.name && argv.slug && argv.sourcelang) {
    const payload = await syncer.createProject({}, {
      data: {
        name: argv.name,
        slug: argv.slug,
        source_lang_code: argv.sourcelang,
      },
    });
    console.log('Project created');
    console.log('---------------');
    console.log(`Name: ${payload.data.name}`);
    console.log(`Slug: ${payload.data.slug}`);
    console.log(`Source language code: ${payload.data.source_language.code}`);
    console.log(`Project token: ${payload.meta.token}`);
    console.log(`Project secret: ${payload.meta.secret}`);
  } else {
    console.log('Usage: npm run create-project -- --name=<project name> --slug=<project slug> --sourcelang=<lang code>');
  }
}

command().then(() => process.exit()).catch((err) => {
  console.log(`Error: ${err.message}`);
});
