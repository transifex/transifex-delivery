const _ = require('lodash');

const PATCH_ATTRIBUTES = ['character_limit', 'tags', 'developer_comment'];

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

// If the string extracted from the codebase is unknown to Transifex (ie is
// neither the latest upstream version nor any of the previous revisions), we
// must update the string on Transifex
function stringContentChanged(attributes, existingString, revisions) {
  return (
    !_.isEqual(attributes.strings, existingString.attributes.strings)
    && !_.some(
      revisions,
      (revision) => _.isEqual(attributes.strings, revision),
    )
  );
}
function stringMetadataChanged(attributes, existingAttributes) {
  const filteredAttrs = _.filter(PATCH_ATTRIBUTES,
    (attr) => !_.isUndefined(attributes[attr]));

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
  stringMetadataChanged,
  stringContentChanged,
};
