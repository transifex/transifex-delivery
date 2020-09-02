const path = require('path');
const nconf = require('nconf');
const nconfYaml = require('nconf-yaml');

const configDir = path.resolve(__dirname, '../config/');
const ENV_MATCH = /^tx__/;

nconf
  .env({
    separator: '__',
    lowerCase: true,
    parseValues: true,
    transform: (obj) => {
      if (!ENV_MATCH.test(obj.key)) return false;

      // eslint-disable-next-line no-param-reassign
      obj.key = obj.key.replace(ENV_MATCH, '');
      return obj;
    },
  })
  .file('environment', {
    file: path.join(configDir, `${process.env.NODE_ENV}.yml`),
    format: nconfYaml,
  })
  .file('defaults', {
    file: path.join(configDir, 'defaults.yml'),
    format: nconfYaml,
  });

module.exports = nconf;
