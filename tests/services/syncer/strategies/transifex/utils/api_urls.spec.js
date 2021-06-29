/* globals describe, it */
const { expect } = require('chai');
const config = require('../../../../../../src/config');
const apiUrls = require('../../../../../../src/services/syncer/strategies/transifex/utils/api_urls');

describe('API urls helper', () => {
  it('should return a "replaced" url', () => {
    const result = apiUrls.getUrl('GET_RESOURCE_TRANSLATIONS', {
      ORGANIZATION_SLUG: 'o:oslug',
      PROJECT_SLUG: 'p:pslug',
      RESOURCE_SLUG: 'r:rslug',
      LANGUAGE_CODE: 'l:lcode',
    });
    expect(result).to.equal(`${config.get('transifex:api_host')}/resource_translations?`
      + 'filter[resource]=o:oslug:p:pslug:r:rslug&filter[language]=l:lcode'
      + '&include=resource_string&'
      + `limit=${config.get('transifex:page_limit')}`);
  });

  it('should return correct auth headers', () => {
    const result = apiUrls.getHeaders('my-token');
    expect(result).to.deep.equal({
      headers: {
        Authorization: 'ULF my-token',
        'Content-Type': 'application/vnd.api+json',
      },
    });
  });

  it('should throw an error if no token is available', () => {
    try {
      apiUrls.getHeaders();
    } catch (e) {
      expect(e instanceof Error).to.equal(true);
      expect(e.message).to.equal('No token given');
    }
  });
});
