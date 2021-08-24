const path = require('path');
const nconf = require('nconf');
const nconfYaml = require('nconf-yaml');
const _ = require('lodash');

const configDir = path.resolve(__dirname, '../config/');
const ENV_MATCH = /^tx__/;

nconf
  .env({
    separator: '__',
    lowerCase: true,
    parseValues: true,
    transform: (obj) => {
      if (!ENV_MATCH.test(obj.key)) return false;

      const ret = obj;
      ret.key = ret.key.replace(ENV_MATCH, '');

      // check for environment variable mapping
      if (_.isString(ret.value) && ret.value[0] === '$') {
        ret.value = process.env[ret.value.substr(1)];
      }
      return ret;
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
