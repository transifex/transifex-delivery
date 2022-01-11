const _ = require('lodash');
const { getLanguageInfo } = require('../../../../../helpers/languages');
const {
  explodePlurals,
  implodePlurals,
} = require('../../../../../helpers/plurals');

/**
 * From an API source or translation entity, extract the
 * actual string
 *
 * @param {*} entity
 * @return {String}
 */
function getStringFromSourceEntity(entity) {
  let string;
  if (!entity.attributes.strings) {
    string = '';
  } else if (entity.attributes.pluralized) {
    string = implodePlurals(entity.attributes.strings);
  } else {
    string = entity.attributes.strings.other;
  }
  return string;
}

/**
 * Get a payload transform data for ULF required for available languages
 * @param {Array} payload
 * @returns {Array} An array with all the required data
 *  [
 *    {
 *      name: <name>,
 *      code: <code>,
 *      localized_name: <localized_name>,
 *      rtl: <rtl>,
 *    }
 *  ]
 *
 */
function parseLanguages(payload) {
  let data = [];
  if (!payload) return data;
  data = payload.map((item) => {
    const lang = getLanguageInfo(item.attributes.code);
    return {
      name: item.attributes.name,
      code: item.attributes.code,
      localized_name: item.attributes.localized_name || lang.localized_name,
      rtl: item.attributes.rtl,
    };
  });
  return data;
}

/**
 * Get a payload transform data for ULF required for available translations for
 * a specific languages
 * @param {Array} payload
 * @returns {Map} A map with all the required data
 *  {
 *    {
 *      <string_key>: {
 *        string: <string>
 *      }
 *    }
 *  }
 */
function parseProjectLanguageTranslations(payload, keysHashmap) {
  const data = new Map();
  if (!payload) return data;

  payload.forEach((item) => {
    const match = keysHashmap.get(item.relationships.resource_string.data.id);
    if (match) {
      const [id, pluralized] = match;
      let string;
      if (!item.attributes.strings) {
        string = '';
      } else if (pluralized) {
        string = implodePlurals(item.attributes.strings);
      } else {
        string = item.attributes.strings.other;
      }
      data.set(id, { string });
    }
  });

  return data;
}

/**
 * Get a payload transform data for ULF required for available translations for
 * source language
 * @param {Array} payload
 * @returns {Map} A map with all the required data
 *  {
 *    {
 *      <string_key>: {
 *        string: <string>
 *      }
 *    }
 *  }
 */
function parseProjectLanguageSources(payload) {
  const data = new Map();
  if (!payload) return data;

  _.forEach(payload, (item) => {
    const string = getStringFromSourceEntity(item);
    data.set(item.attributes.key, { string });
  });

  return data;
}

/**
 * Creates a hashmap which includes resource string ids and keys
 *
 * @param {Array} payload
 * @returns {Map} A map with the required data
 * {
 *    <resource string id>: <string key>,
 *    ...
 * }
 */
function parseSourceStringForIdLookup(payload) {
  const data = new Map();
  if (!payload) return data;

  payload.forEach((resourceString) => {
    data.set(
      resourceString.id,
      [resourceString.attributes.key, resourceString.attributes.pluralized],
    );
  });
  return data;
}

/**
 * Creates a hashmap with the string keys. Is used for lookups
 *
 * @param {Array} payload
 * @returns {Map} A Map with the required data
 * {
 *    <string id>: null,
 *    ...
 * }
 */
function parseSourceStringForKeyLookup(payload) {
  const data = new Map();
  if (!payload) return data;

  payload.forEach((resourceString) => {
    const { attributes } = resourceString;
    const { key } = attributes;
    let item = {};

    item = {
      attributes: {
        key,
        strings: attributes.strings,
        context: attributes.context,
        pluralized: attributes.pluralized,
        occurrences: attributes.occurrences,
      },
      payload: {},
      id: resourceString.id,
    };

    if (attributes.character_limit) {
      item.attributes.character_limit = attributes.character_limit;
      item.payload.character_limit = attributes.character_limit;
    }
    if (attributes.tags && attributes.tags.length) {
      item.attributes.tags = attributes.tags;
      item.payload.tags = attributes.tags;
    }
    if (attributes.developer_comment) {
      item.attributes.developer_comment = attributes.developer_comment;
      item.payload.developer_comment = attributes.developer_comment;
    }

    data.set(key, item);
  });
  return data;
}

/**
 * Transform a payload to a Transifex API V3 string push
 *
 * @param {String} key The string's key
 * @param {Object} payload The requested payload
 * @returns {Object} An object with the appropriate payload format
 * {
 *   context: <string>,
 *   key: <string_key>,
 *   strings: {
 *     other: <string>,
 *   },
 *   pluralized: false,
 * }
 */
function parseSourceStringForAPI(key, payload) {
  const [variableName, strings] = explodePlurals(payload.string || '');
  const result = {
    key,
    strings,
    pluralized: !!variableName,
  };

  if (_.get(payload, 'meta.character_limit')) {
    result.character_limit = payload.meta.character_limit;
  }

  if (_.get(payload, 'meta.tags')) result.tags = payload.meta.tags;

  if (_.get(payload, 'meta.developer_comment')) {
    result.developer_comment = payload.meta.developer_comment;
  }

  if (_.get(payload, 'meta.occurrences')) {
    result.occurrences = _.join(payload.meta.occurrences, ',');
  }

  const context = _.get(payload, 'meta.context') || '';
  if (Array.isArray(context)) {
    result.context = _.join(context, ':');
  } else {
    result.context = context;
  }

  return result;
}

module.exports = {
  parseLanguages,
  parseProjectLanguageTranslations,
  parseProjectLanguageSources,
  parseSourceStringForAPI,
  parseSourceStringForKeyLookup,
  parseSourceStringForIdLookup,
  getStringFromSourceEntity,
};
