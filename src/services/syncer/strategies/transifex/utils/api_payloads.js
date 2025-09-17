const _ = require('lodash');

const PATCH_ATTRIBUTES = ['character_limit', 'tags', 'developer_comment', 'occurrences'];

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

function getPatchStringPayload(stringId, attributes, mustPatchStrings) {
  return {
    attributes: _.pick(
      attributes,
      mustPatchStrings
        ? [...PATCH_ATTRIBUTES, 'strings']
        : PATCH_ATTRIBUTES,
    ),
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

function getDeleteTranslationsPayload(stringId) {
  return {
    attributes: {
      strings: null,
    },
    id: stringId,
    type: 'resource_translations',
  };
}

function stringContentChanged(attributes, existingString) {
  return (
    !_.isEqual(attributes.strings, existingString.attributes.strings)
  );
}
function stringMetadataChanged(attributes, existingAttributes) {
  const filteredAttrs = _.filter(
    PATCH_ATTRIBUTES,
    (attr) => !_.isUndefined(attributes[attr]),
  );

  const cleanAttributes = _.pick(attributes, filteredAttrs);
  const cleanExistingAttributes = _.pick(existingAttributes, filteredAttrs);

  if (_.isEmpty(cleanAttributes.tags)) {
    delete cleanAttributes.tags;
  }
  if (_.isEmpty(cleanExistingAttributes.tags)) {
    delete cleanExistingAttributes.tags;
  }

  return !_.isEqual(
    cleanAttributes,
    cleanExistingAttributes,
  );
}

module.exports = {
  getPushStringPayload,
  getPatchStringPayload,
  getDeleteStringPayload,
  getDeleteTranslationsPayload,
  stringMetadataChanged,
  stringContentChanged,
};
