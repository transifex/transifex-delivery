const _ = require('lodash');

function getPushStringPayload(resourceId, attributes) {
  return {
    attributes,
    relationships: {
      resource: {
        data: {
          id: resourceId,
          type: 'resources',
        },
      },
    },
    type: 'resource_strings',
  };
}

function getPatchStringPayload(stringId, attributes) {
  return {
    attributes: _.omit(attributes, ['context', 'key', 'strings', 'pluralized']),
    id: stringId,
    type: 'resource_strings',
  };
}

function getDeleteStringPayload(stringId) {
  return {
    id: stringId,
    type: 'resource_strings',
  };
}

module.exports = {
  getPushStringPayload,
  getPatchStringPayload,
  getDeleteStringPayload,
};
