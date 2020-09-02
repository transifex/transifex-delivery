/* eslint no-console: 0 */

/**
 * CLI: Delete project language
 */
const _ = require('lodash');
const { argv } = require('yargs');
const syncer = require('../services/syncer/management');

async function command() {
  if (argv.slug && argv.lang) {
    const payload = await syncer.deleteProjectLanguages({}, {
      data: {
        slug: argv.slug,
        target_languages: [{
          code: argv.lang,
        }],
      },
    });
    console.log('Language deleted');
    console.log('--------------');
    _.each(payload.data, (entry) => {
      console.log(`Language code: ${entry.code}`);
      console.log(`Language name: ${entry.name}`);
    });
  } else {
    console.log('Usage: npm run delete-language -- --slug=<project slug> --lang=<target code>');
  }
}

command().then(() => process.exit()).catch((err) => {
  console.log(`Error: ${err.message}`);
});
