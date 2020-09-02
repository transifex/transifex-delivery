/* globals describe, it */
const { assert } = require('chai');
const config = require('../../../../../../src/config');
const apiUrls = require('../../../../../../src/services/syncer/strategies/transifex/utils/api_urls');

describe('API urls helper', () => {
  it('should return a "replaced" url', () => {
    const result = apiUrls.getUrl('GET_TRANSLATIONS', {
      organization_slug: 'oslug',
      project_slug: 'pslug',
      resource_slug: 'rslug',
      language_code: 'lcode',
    });
    assert(result, `${config.get('transifex:api_host')}resource_translations?`
      + 'filter[resource]=o:oslug:p:pslug:r:rslug&filter[language]=l:lcode'
      + '&include=resource_string');
  });

  it('should return correct auth headers', () => {
    const result = apiUrls.getHeaders('my-token');
    assert(result, {
      headers: {
        Authorization: 'ULF my-token',
        'Content-Type': 'application/vnd.api+json',
      },
    });
  });

  it('should slugify TX generated tokens', () => {
    const result = apiUrls.getHeaders('1/asd');
    assert(result, {
      headers: {
        Authorization: 'ULF 1asd',
        'Content-Type': 'application/vnd.api+json',
      },
    });
  });

  it('should throw an error if no token is available', () => {
    try {
      apiUrls.getHeaders();
    } catch (e) {
      assert.equal(true, e instanceof Error);
      assert.equal('No token given', e.message);
    }
  });
});
