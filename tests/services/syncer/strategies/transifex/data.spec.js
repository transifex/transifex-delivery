/* globals describe, it, beforeEach, afterEach */

const nock = require('nock');
const _ = require('lodash');
const { expect } = require('chai');
const errors = require('../../../../../src/services/syncer/strategies/transifex/utils/errors');
const transifexData = require('../../../../../src/services/syncer/strategies/transifex/data');
const dataHelper = require('./helpers/api');
const config = require('../../../../../src/config');
const { getStringFromSourceEntity } = require('../../../../../src/services/syncer/strategies/transifex/utils/transformer');

const options = {
  token: {
    original: 'sometoken:token',
  },
};

const extendedOptions = {
  token: {
    original: 'sometoken:token',
  },
  organization_slug: 'oslug',
  project_slug: 'pslug',
  resource_slug: 'rslug',
};

const urls = {
  api: config.get('transifex:api_host'),
  organizations: '/organizations',
  projects: '/projects?filter[organization]=o:oslug',
  resources: '/resources?filter[project]=o:oslug:p:pslug',
  languages: '/projects/o:oslug:p:pslug/languages',
  translations: '/resource_translations?filter[resource]=o:oslug:p:pslug'
    + ':r:rslug&filter[language]=l:lcode&include=resource_string&'
    + `limit=${config.get('transifex:page_limit')}`,
  source_strings: '/resource_strings?filter[resource]='
    + 'o:oslug:p:pslug:r:rslug&'
    + `limit=${config.get('transifex:page_limit')}`,
  resource_strings: '/resource_strings',
  source_strings_revisions: '/resource_strings_revisions?'
    + 'filter[resource_string][resource]=o:oslug:p:pslug:r:rslug&'
    + 'limit=1000',
};

describe('Get token information', () => {
  afterEach(async () => {
    nock.cleanAll();
  });

  it('should retrieve token information', async () => {
    nock(urls.api)
      .get(urls.organizations)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'oslug',
          },
        }],
      }));

    nock(urls.api)
      .get(urls.projects)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'pslug',
          },
          relationships: {
            source_language: {
              data: {
                id: 'l:en',
              },
            },
          },
        }],
      }));

    nock(urls.api)
      .get(urls.resources)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'rslug',
            string_count: '10',
          },
        }],
      }));

    const result = await transifexData.getTokenInformation(options);
    expect(result).to.eql({
      token: {
        original: 'sometoken:token',
        organization_slug: 'oslug',
        project_slug: 'pslug',
        resource_slug: 'rslug',
        source_lang_code: 'en',
      },
    });
  });

  it('should throw 404 error if there is no organization result', async () => {
    nock(urls.api)
      .get(urls.organizations)
      .reply(200, JSON.stringify({
        data: [],
      }));
    try {
      await transifexData.getTokenInformation(options);
    } catch (e) {
      expect(e.status).to.eql(404);
    }
  });

  it('should throw 404 error if there is no project result', async () => {
    nock(urls.api)
      .get(urls.organizations)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'oslug',
          },
        }],
      }));

    nock(urls.api)
      .get(urls.projects)
      .reply(200, JSON.stringify({
        data: [],
      }));
    try {
      await transifexData.getTokenInformation(options);
    } catch (e) {
      expect(e.status).to.eql(404);
    }
  });

  it('should throw 404 error if there is no project result', async () => {
    nock(urls.api)
      .get(urls.organizations)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'oslug',
          },
        }],
      }));

    nock(urls.api)
      .get(urls.projects)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'pslug',
          },
          relationships: {
            source_language: {
              data: {
                id: 'l:en',
              },
            },
          },
        }],
      }));

    nock(urls.api)
      .get(urls.resources)
      .reply(200, JSON.stringify({
        data: [],
      }));
    try {
      await transifexData.getTokenInformation(options);
    } catch (e) {
      expect(e.status).to.eql(404);
    }
  });

  it('should throw 500 error if there is unknown error', async () => {
    nock(urls.api)
      .get(urls.organizations)
      .reply(200, JSON.stringify({
        nodata: {},
      }));

    try {
      await transifexData.getTokenInformation(options);
    } catch (e) {
      expect(e.status).to.eql(500);
    }
  });
});

describe('Get languages', () => {
  beforeEach(async () => {
    nock(urls.api)
      .persist()
      .get(urls.organizations)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'oslug',
          },
        }],
      }));

    nock(urls.api)
      .persist()
      .get(urls.projects)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'pslug',
          },
          relationships: {
            source_language: {
              data: {
                id: 'l:en',
              },
            },
          },
        }],
      }));

    nock(urls.api)
      .persist()
      .get(urls.resources)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'rslug',
            string_count: '10',
          },
        }],
      }));
  });

  afterEach(async () => {
    nock.cleanAll();
  });

  it('should get languages', async () => {
    nock(urls.api)
      .get(urls.languages)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            code: 'l_code',
            name: 'l_name',
            rtl: true,
            localized_name: 'L Code',
          },
        }, {
          attributes: {
            code: 'l_code2',
            name: 'l_name2',
            rtl: false,
          },
        }],
      }));

    const result = await transifexData.getLanguages(options);

    expect(result).to.eql({
      data: [
        {
          code: 'en',
          localized_name: 'English',
          name: 'English',
          rtl: false,
        },
        {
          code: 'l_code',
          name: 'l_name',
          rtl: true,
          localized_name: 'L Code',
        }, {
          code: 'l_code2',
          name: 'l_name2',
          rtl: false,
          localized_name: 'l_code2',
        },
      ],
      meta: {
        source_lang_code: 'en',
      },
    });
  });

  it('should throw an error', async () => {
    nock(urls.api)
      .get(urls.languages)
      .reply(400);
    try {
      await transifexData.getLanguages(options);
    } catch (e) {
      expect(e.status).to.eql(400);
      expect(true).to.eql(e instanceof errors.APIError);
    }
  });
});

describe('Get Project Language Translations', () => {
  beforeEach(async () => {
    nock(urls.api)
      .persist()
      .get(urls.organizations)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'oslug',
          },
        }],
      }));

    nock(urls.api)
      .persist()
      .get(urls.projects)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'pslug',
          },
          relationships: {
            source_language: {
              data: {
                id: 'l:en',
              },
            },
          },
        }],
      }));

    nock(urls.api)
      .persist()
      .get(urls.resources)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'rslug',
            string_count: '10',
          },
        }],
      }));
  });

  afterEach(async () => {
    nock.cleanAll();
  });

  it('should get translations', async () => {
    nock(urls.api)
      .get(urls.translations)
      .reply(200, dataHelper.getProjectLanguageTranslations());

    const result = await transifexData
      .getProjectLanguageTranslations(extendedOptions, 'lcode');

    expect(result).to.eqls({
      data: {
        hello_world: {
          string: '{???, plural, one {hello} other {world}}',
        },
      },
    });
  });

  it('should get translations in source lang', async () => {
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, dataHelper.getSourceString());

    const result = await transifexData
      .getProjectLanguageTranslations(extendedOptions, 'en');

    expect(result).to.eqls({
      data: {
        hello_world: {
          string: '{???, plural, one {hello} other {world}}',
        },
      },
    });
  });
});

describe('Push source Content', () => {
  beforeEach(async () => {
    nock(urls.api)
      .persist()
      .get(urls.organizations)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'oslug',
          },
        }],
      }));

    nock(urls.api)
      .persist()
      .get(urls.projects)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'pslug',
          },
          relationships: {
            source_language: {
              data: {
                id: 'l:en',
              },
            },
          },
        }],
      }));

    nock(urls.api)
      .persist()
      .get(urls.resources)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'rslug',
            string_count: '10',
          },
        }],
      }));
  });

  afterEach(async () => {
    nock.cleanAll();
  });

  it('should push new strings', async () => {
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, { data: [], links: {} });
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });

    nock(urls.api).post(urls.resource_strings)
      .reply(200, {
        data: [
          {
            somekey: 'somevalue',
          },
          {
            someotherkey: 'somevalue',
          },
        ],
      });
    const data = dataHelper.getPushSourceContent();
    const result = await transifexData.pushSourceContent(options, data);

    expect(result).to.eql({
      created: 2,
      updated: 0,
      skipped: 0,
      deleted: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [
          {
            context: [],
            key: 'somekey',
            occurrences: [],
            string: 'I am a string',
          },
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'world',
          },
        ],
        deleted: [],
        failed: [],
        skipped: [],
        updated: [],
      },
    });
  });

  it('should push new strings with dry run', async () => {
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, { data: [], links: {} });
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });

    const data = dataHelper.getPushSourceContent();
    const result = await transifexData.pushSourceContent(options, data, {
      dry_run: true,
    });

    expect(result).to.eql({
      created: 2,
      updated: 0,
      skipped: 0,
      deleted: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [
          {
            context: [],
            key: 'somekey',
            occurrences: [],
            string: 'I am a string',
          },
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'world',
          },
        ],
        deleted: [],
        failed: [],
        skipped: [],
        updated: [],
      },
    });
  });

  it('should return correct report on errors', async () => {
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, { data: [], links: {} });
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });

    nock(urls.api).post(urls.resource_strings)
      .reply(400, {
        errors: [
          {
            status: '400',
            code: 'invalid',
            title: 'Field `context` is invalid',
            detail: 'asd is not of type array',
            source: {
              pointer: '/data/0/attributes/context',
            },
          },
        ],
      });

    const data = dataHelper.getPushSourceContent();
    const result = await transifexData.pushSourceContent(options, data);

    expect(result).to.eql({
      created: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      failed: 2,
      verbose: {
        created: [],
        deleted: [],
        failed: [
          {
            context: [],
            key: 'somekey',
            occurrences: [],
            string: 'I am a string',
          },
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'world',
          },
        ],
        skipped: [],
        updated: [],
      },
      errors: [{
        status: '400',
        code: 'invalid',
        title: 'Field `context` is invalid',
        detail: 'asd is not of type array',
        source: {
          pointer: '/data/0/attributes/context',
        },
      }],
    });
  });

  it('should delete strings when purge is added', async () => {
    const sourceData = dataHelper.getSourceString();
    // get strings from TX
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });

    // mock from cds -> api
    nock(urls.api).post(urls.resource_strings)
      .reply(200, {
        data: [
          {
            somekey: 'somevalue',
          },
        ],
      });

    // mock of delete from cds -> api
    nock(urls.api)
      .delete(urls.resource_strings)
      .reply(204);

    // push from sdk -> cds
    let data = dataHelper.getPushSourceContent();
    data = _.omit(data, 'hello_world');
    const result = await transifexData.pushSourceContent(options, data, {
      purge: true,
    });

    expect(result).to.eql({
      created: 1,
      updated: 0,
      skipped: 0,
      deleted: 1,
      failed: 0,
      errors: [],
      verbose: {
        created: [
          {
            context: [],
            key: 'somekey',
            occurrences: [],
            string: 'I am a string',
          },
        ],
        deleted: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'world',
          },
        ],
        failed: [],
        skipped: [],
        updated: [],
      },
    });
  });

  it('should skip already saved strings with no changes', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });

    nock(urls.api).post(urls.resource_strings)
      .reply(200, {
        data: [
          {
            somekey: 'somevalue',
          },
        ],
      });

    const data = dataHelper.getPushSourceContent();
    const result = await transifexData.pushSourceContent(options, data, {});

    expect(result).to.eql({
      created: 1,
      updated: 0,
      skipped: 1,
      deleted: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [
          {
            context: [],
            key: 'somekey',
            occurrences: [],
            string: 'I am a string',
          },
        ],
        deleted: [],
        failed: [],
        skipped: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'world',
          },
        ],
        updated: [],
      },
    });
  });

  it('should update changed strings', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });

    nock(urls.api)
      .post(urls.resource_strings)
      .reply(200, {
        data: [
          {
            somekey: 'somevalue',
          },
        ],
      });

    const data = dataHelper.getPushSourceContent();
    data.hello_world.meta.tags = ['onetag'];
    nock(urls.api)
      .patch(`${urls.resource_strings}/${sourceData.data[0].id}`)
      .reply(200, {
        data: [{
          someotherkey: 'someothervalue',
        }],
      });

    const result = await transifexData.pushSourceContent(options, data);

    expect(result).to.eql({
      created: 1,
      updated: 1,
      deleted: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [
          {
            context: [],
            key: 'somekey',
            occurrences: [],
            string: 'I am a string',
          },
        ],
        deleted: [],
        updated: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'world',
          },
        ],
        skipped: [],
        failed: [],
      },
    });
  });

  it('should update changed strings when purge is added', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });

    nock(urls.api).post(urls.resource_strings)
      .reply(200, {
        data: [
          {
            somekey: 'somevalue',
          },
        ],
      });

    const data = dataHelper.getPushSourceContent();
    // revert string modification from fixture
    data.hello_world.string = getStringFromSourceEntity(sourceData.data[0]);
    // update tags
    data.hello_world.meta.tags = ['onetag'];
    nock(urls.api)
      .patch(`${urls.resource_strings}/${sourceData.data[0].id}`)
      .reply(200, {
        data: [{
          someotherkey: 'someothervalue',
        }],
      });

    const result = await transifexData.pushSourceContent(options, data, {
      purge: true,
    });

    expect(result).to.eql({
      created: 1,
      updated: 1,
      deleted: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [
          {
            context: [],
            key: 'somekey',
            occurrences: [],
            string: 'I am a string',
          },
        ],
        deleted: [],
        failed: [],
        skipped: [],
        updated: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: '{???, plural, one {hello} other {world}}',
          },
        ],
      },
    });
  });

  it('should add to errors when something goes wrong', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });

    // cds -> api
    nock(urls.api)
      .post(urls.resource_strings)
      .reply(400, {
        errors: [{
          message: 'something1',
        }],
      });
    // cds -> api
    nock(urls.api)
      .delete(urls.resource_strings)
      .reply(400, {
        errors: [{
          message: 'something2',
        }],
      });
    let data = dataHelper.getPushSourceContent();
    data = _.omit(data, 'hello_world');
    const result = await transifexData.pushSourceContent(options, data, {
      purge: true,
    });

    expect(result).to.eql({
      created: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      failed: 2,
      errors: [
        { message: 'something2' },
        { message: 'something1' },
      ],
      verbose: {
        created: [],
        deleted: [],
        failed: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'world',
          },
          {
            context: [],
            key: 'somekey',
            occurrences: [],
            string: 'I am a string',
          },
        ],
        skipped: [],
        updated: [],
      },
    });
  });

  it('should patch source strings if new', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });
    nock(urls.api)
      .patch(`${urls.resource_strings}/${sourceData.data[0].id}`)
      .reply(200, {
        data: [{
          someotherkey: 'someothervalue',
        }],
      });
    const result = await transifexData.pushSourceContent(
      options,
      {
        hello_world: {
          string: '{cnt, plural, one {Hello} other {World}}',
          meta: {
            context: 'frontpage:footer:verb',
            character_limit: 100,
            tags: ['foo', 'bar'],
            developer_comment: 'Wrapped in a 30px width div',
            occurrences: ['/my_project/templates/frontpage/hello.html:30'],
          },
        },
      },
      {},
    );
    expect(result).to.eql({
      created: 0,
      updated: 1,
      skipped: 0,
      deleted: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [],
        deleted: [],
        updated: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'World',
          },
        ],
        skipped: [],
        failed: [],
      },
    });
  });

  it('should patch source strings if new with keep_translations', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });
    nock(urls.api)
      .patch(`${urls.resource_strings}/${sourceData.data[0].id}`)
      .reply(200, {
        data: [{
          someotherkey: 'someothervalue',
        }],
      });
    const result = await transifexData.pushSourceContent(
      options,
      {
        hello_world: {
          string: '{cnt, plural, one {Hello} other {World}}',
          meta: {
            context: 'frontpage:footer:verb',
            character_limit: 100,
            tags: ['foo', 'bar'],
            developer_comment: 'Wrapped in a 30px width div',
            occurrences: ['/my_project/templates/frontpage/hello.html:30'],
          },
        },
      },
      { meta: { keep_translations: true } },
    );
    expect(result).to.eql({
      created: 0,
      updated: 1,
      skipped: 0,
      deleted: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [],
        deleted: [],
        updated: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'World',
          },
        ],
        skipped: [],
        failed: [],
      },
    });
  });

  it('should patch source strings if new without keep_translations', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });
    nock(urls.api)
      .patch(`${urls.resource_strings}/${sourceData.data[0].id}`)
      .reply(200, {
        data: [{
          someotherkey: 'someothervalue',
        }],
      });
    const result = await transifexData.pushSourceContent(
      options,
      {
        hello_world: {
          string: '{cnt, plural, one {Hello} other {World}}',
          meta: {
            context: 'frontpage:footer:verb',
            character_limit: 100,
            tags: ['foo', 'bar'],
            developer_comment: 'Wrapped in a 30px width div',
            occurrences: ['/my_project/templates/frontpage/hello.html:30'],
          },
        },
      },
      { meta: { keep_translations: false } },
    );
    expect(result).to.eql({
      created: 0,
      updated: 1,
      skipped: 0,
      deleted: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [],
        deleted: [],
        updated: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'World',
          },
        ],
        skipped: [],
        failed: [],
      },
    });
  });

  it('should skip patch source strings if in revisions', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, {
        data: [{
          attributes: { strings: { one: 'Hello', other: 'World' } },
          relationships: {
            resource_string: { data: { id: sourceData.data[0].id } },
          },
        }],
        links: {},
      });
    const result = await transifexData.pushSourceContent(
      options,
      {
        hello_world: {
          string: '{cnt, plural, one {Hello} other {World}}',
          meta: {
            context: 'frontpage:footer:verb',
            character_limit: 100,
            tags: ['foo', 'bar'],
            developer_comment: 'Wrapped in a 30px width div',
            occurrences: ['/my_project/templates/frontpage/hello.html:30'],
          },
        },
      },
      {},
    );
    expect(result).to.eql({
      created: 0,
      updated: 0,
      skipped: 1,
      deleted: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [],
        deleted: [],
        failed: [],
        skipped: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'World',
          },
        ],
        updated: [],
      },
    });
  });

  it('should patch source strings if new with purge', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });
    nock(urls.api)
      .patch(`${urls.resource_strings}/${sourceData.data[0].id}`)
      .reply(200, {
        data: [{
          someotherkey: 'someothervalue',
        }],
      });
    const result = await transifexData.pushSourceContent(
      options,
      {
        hello_world: {
          string: '{cnt, plural, one {Hello} other {World}}',
          meta: {
            context: 'frontpage:footer:verb',
            character_limit: 100,
            tags: ['foo', 'bar'],
            developer_comment: 'Wrapped in a 30px width div',
            occurrences: ['/my_project/templates/frontpage/hello.html:30'],
          },
        },
      },
      { meta: { purge: true } },
    );
    expect(result).to.eql({
      created: 0,
      updated: 1,
      skipped: 0,
      deleted: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [],
        deleted: [],
        updated: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'World',
          },
        ],
        skipped: [],
        failed: [],
      },
    });
  });
});

describe('Push source Content (per string key strategy)', () => {
  beforeEach(async () => {
    nock(urls.api)
      .persist()
      .get(urls.organizations)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'oslug',
          },
        }],
      }));

    nock(urls.api)
      .persist()
      .get(urls.projects)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'pslug',
          },
          relationships: {
            source_language: {
              data: {
                id: 'l:en',
              },
            },
          },
        }],
      }));

    nock(urls.api)
      .persist()
      .get(urls.resources)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'rslug',
            string_count: '100000000',
          },
        }],
      }));
  });

  afterEach(async () => {
    nock.cleanAll();
  });

  it('should push new strings', async () => {
    nock(urls.api)
      .get(`${urls.source_strings}&filter[key]=somekey`)
      .reply(200, { data: [], links: {} });
    nock(urls.api)
      .get(`${urls.source_strings_revisions}&filter[resource_string][key]=somekey`)
      .reply(200, { data: [], links: {} });

    nock(urls.api)
      .get(`${urls.source_strings}&filter[key]=hello_world`)
      .reply(200, { data: [], links: {} });
    nock(urls.api)
      .get(`${urls.source_strings_revisions}&filter[resource_string][key]=hello_world`)
      .reply(200, { data: [], links: {} });

    nock(urls.api).post(urls.resource_strings)
      .reply(200, {
        data: [
          {
            somekey: 'somevalue',
          },
          {
            someotherkey: 'somevalue',
          },
        ],
      });
    const data = dataHelper.getPushSourceContent();
    const result = await transifexData.pushSourceContent(options, data);

    expect(result).to.eql({
      created: 2,
      updated: 0,
      skipped: 0,
      deleted: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [
          {
            context: [],
            key: 'somekey',
            occurrences: [],
            string: 'I am a string',
          },
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'world',
          },
        ],
        deleted: [],
        failed: [],
        skipped: [],
        updated: [],
      },
    });
  });

  it('should patch source strings if new', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(`${urls.source_strings}&filter[key]=hello_world`)
      .reply(200, sourceData);
    nock(urls.api)
      .get(`${urls.source_strings_revisions}&filter[resource_string][key]=hello_world`)
      .reply(200, { data: [], links: {} });
    nock(urls.api)
      .patch(`${urls.resource_strings}/${sourceData.data[0].id}`)
      .reply(200, {
        data: [{
          someotherkey: 'someothervalue',
        }],
      });
    const result = await transifexData.pushSourceContent(
      options,
      {
        hello_world: {
          string: '{cnt, plural, one {Hello} other {World}}',
          meta: {
            context: 'frontpage:footer:verb',
            character_limit: 100,
            tags: ['foo', 'bar'],
            developer_comment: 'Wrapped in a 30px width div',
            occurrences: ['/my_project/templates/frontpage/hello.html:30'],
          },
        },
      },
      {},
    );
    expect(result).to.eql({
      created: 0,
      updated: 1,
      skipped: 0,
      deleted: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [],
        deleted: [],
        updated: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'World',
          },
        ],
        skipped: [],
        failed: [],
      },
    });
  });

  it('should skip patch source strings if in revisions', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(`${urls.source_strings}&filter[key]=hello_world`)
      .reply(200, sourceData);
    nock(urls.api)
      .get(`${urls.source_strings_revisions}&filter[resource_string][key]=hello_world`)
      .reply(200, {
        data: [{
          attributes: { strings: { one: 'Hello', other: 'World' } },
          relationships: {
            resource_string: { data: { id: sourceData.data[0].id } },
          },
        }],
        links: {},
      });
    const result = await transifexData.pushSourceContent(
      options,
      {
        hello_world: {
          string: '{cnt, plural, one {Hello} other {World}}',
          meta: {
            context: 'frontpage:footer:verb',
            character_limit: 100,
            tags: ['foo', 'bar'],
            developer_comment: 'Wrapped in a 30px width div',
            occurrences: ['/my_project/templates/frontpage/hello.html:30'],
          },
        },
      },
      {},
    );
    expect(result).to.eql({
      created: 0,
      updated: 0,
      skipped: 1,
      deleted: 0,
      failed: 0,
      errors: [],
      verbose: {
        created: [],
        deleted: [],
        failed: [],
        skipped: [
          {
            context: [],
            key: 'hello_world',
            occurrences: [
              '/my_project/templates/frontpage/hello.html:30',
            ],
            string: 'World',
          },
        ],
        updated: [],
      },
    });
  });
});

describe('Verify credentials', () => {
  afterEach(async () => {
    nock.cleanAll();
  });

  it('should verify on valid credentials', async () => {
    nock(urls.api)
      .get(urls.organizations)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'oslug',
          },
        }],
      }));

    nock(urls.api)
      .get(urls.projects)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'pslug',
          },
          relationships: {
            source_language: {
              data: {
                id: 'l:en',
              },
            },
          },
        }],
      }));

    nock(urls.api)
      .get(urls.resources)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'rslug',
            string_count: '10',
          },
        }],
      }));

    const result = await transifexData.verifyCredentials({
      token: {
        original: 'valid:valid',
      },
    });
    expect(result).to.eql(true);
  });

  it('should not verify on invalid credentials', async () => {
    nock(urls.api)
      .get(urls.organizations)
      .reply(200, JSON.stringify({
        data: [],
      }));

    const result = await transifexData.verifyCredentials({
      token: {
        original: 'invalid:invalid',
      },
    });
    expect(result).to.eql(false);
  });
});
