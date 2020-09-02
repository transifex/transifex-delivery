/* eslint no-console: 0 */

/**
 * CLI: Add project language
 */
const _ = require('lodash');
const { argv } = require('yargs');
const syncer = require('../services/syncer/management');

async function command() {
  if (argv.slug && argv.lang) {
    const payload = await syncer.addProjectLanguages({}, {
      data: {
        slug: argv.slug,
        target_languages: [{
          code: argv.lang,
        }],
      },
    });
    console.log('Language added');
    console.log('--------------');
    _.each(payload.data, (entry) => {
      console.log(`Language code: ${entry.code}`);
      console.log(`Language name: ${entry.name}`);
    });
  } else {
    console.log('Usage: npm run add-language -- --slug=<project slug> --lang=<target code>');
  }
}

command().then(() => process.exit()).catch((err) => {
  console.log(`Error: ${err.message}`);
});
