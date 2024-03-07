/* globals describe, it, beforeEach, afterEach */

const chai = require('chai');
const chaiHttp = require('chai-http');
const request = require('supertest');
const nock = require('nock');
const dataHelper = require('../services/syncer/strategies/transifex/helpers/api');
const config = require('../../src/config');
const registry = require('../../src/services/registry');
const md5 = require('../../src/helpers/md5');
const { resetRegistry } = require('../lib');
const app = require('../../src/server')();
require('../../src/queue').initialize();

chai.use(chaiHttp);
const { expect } = chai;

const token = '2/abcd';

const urls = {
  api: config.get('transifex:api_host'),
  organizations: '/organizations',
  projects: '/projects?filter[organization]=o:oslug',
  resources: '/resources?filter[project]=o:oslug:p:pslug',
  languages: '/projects/o:oslug:p:pslug/languages',
  get_translations: '/resource_translations?filter[resource]='
    + 'o:oslug:p:pslug:r:rslug&filter[language]=l:lcode&include=resource_string&'
    + `limit=${config.get('transifex:page_limit')}`,
  source_strings: '/resource_strings?filter[resource]='
    + 'o:oslug:p:pslug:r:rslug&'
    + `limit=${config.get('transifex:page_limit')}`,
  resource_strings: '/resource_strings',
  source_strings_revisions: '/resource_strings_revisions?'
    + 'filter[resource_string][resource]=o:oslug:p:pslug:r:rslug&'
    + 'limit=1000',
};

function sleep(ms) {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('GET /content', () => {
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
    await resetRegistry();
  });

  it('should propagate an API error', async () => {
    nock(urls.api)
      .get(urls.get_translations)
      .reply(401);

    let res;
    do {
      res = await request(app)
        .get('/content/lcode')
        .set('Accept-version', 'v2')
        .set('Authorization', `Bearer ${token}:secret`);
      await sleep(50);
    } while (res.status === 202);

    expect(res.status).to.equal(401);
  });

  it('should get content translations based on language', async () => {
    nock(urls.api)
      .get(urls.get_translations)
      .reply(200, dataHelper.getProjectLanguageTranslations());

    let res;
    do {
      res = await request(app)
        .get('/content/lcode')
        .set('Accept-version', 'v2')
        .set('Authorization', `Bearer ${token}:secret`);
      await sleep(50);
    } while (res.status === 202);

    const expected = {
      data: {
        hello_world: {
          string: '{???, plural, one {hello} other {world}}',
        },
      },
    };

    expect(res.status).to.equal(200);
    expect(res.body).to.eql(expected);
  });

  it('should get content on source language', async () => {
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, dataHelper.getSourceString());

    let res;
    do {
      res = await request(app)
        .get('/content/en')
        .set('Accept-version', 'v2')
        .set('Authorization', `Bearer ${token}:secret`);
      await sleep(50);
    } while (res.status === 202);

    const expected = {
      data: {
        hello_world: {
          string: '{???, plural, one {hello} other {world}}',
        },
      },
    };

    expect(res.status).to.equal(200);
    expect(res.body).to.eql(expected);
  });

  it('should not get content on invalid tags', async () => {
    const res = await request(app)
      .get('/content/en?filter[tags]=/../../')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(400);
  });

  it('should always return an Etag while responding', async () => {
    nock(urls.api)
      .get(urls.get_translations)
      .reply(200, JSON.stringify({ data: [], links: {} }));

    let res;
    do {
      res = await request(app)
        .get('/content/lcode')
        .set('Accept-version', 'v2')
        .set('Authorization', `Bearer ${token}:secret`);
      await sleep(50);
    } while (res.status === 202);

    expect(res.status).to.equal(200);
    expect(res).to.have.header('ETag');
    // eslint-disable-next-line no-unused-expressions
    expect(res.headers.etag).not.to.be.undefined;
  });

  it('should return empty response', async () => {
    nock(urls.api)
      .get(urls.get_translations)
      .reply(200, JSON.stringify({ data: [], links: {} }));

    let res;
    do {
      res = await request(app)
        .get('/content/lcode')
        .set('Accept-version', 'v2')
        .set('Authorization', `Bearer ${token}:secret`);
      await sleep(50);
    } while (res.status === 202);

    expect(res.body).to.eqls({
      data: {},
    });
  });

  it('should return No Modified - 304', async () => {
    nock(urls.api)
      .get(urls.get_translations)
      .reply(200, JSON.stringify({ data: [], links: {} }));

    // let's get a valid etag and make sure that nothing has changed
    let firstRes;
    do {
      firstRes = await request(app)
        .get('/content/lcode')
        .set('Accept-version', 'v2')
        .set('Authorization', `Bearer ${token}:secret`)
        .set('If-None-Match', 'obsolete_value');
      await sleep(50);
    } while (firstRes.status === 202);

    expect(firstRes.status).to.equal(200);
    expect(firstRes).to.have.header('ETag');

    const res = await request(app)
      .get('/content/lcode')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`)
      .set('If-None-Match', firstRes.headers.etag);

    expect(res).to.have.status(304);
  });
});

describe('POST /content', () => {
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

    await registry.set(
      `auth:${token}`,
      md5(`${token}:secret`),
    );
  });

  afterEach(async () => {
    nock.cleanAll();
    await resetRegistry();
  });

  it('should push content', async () => {
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

    let res = await request(app)
      .post('/content')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`)
      .send({ data });

    expect(res.status).to.eql(202);

    // poll
    let status = '';
    const jobUrl = res.body.data.links.job;
    while (status !== 'completed') {
      await sleep(100);
      res = await request(app)
        .get(jobUrl)
        .set('Authorization', `Bearer ${token}:secret`);
      expect(res.status).to.eql(200);
      status = res.body.data.status;
    }

    expect(res.body).to.eqls({
      data: {
        details: {
          created: 2,
          updated: 0,
          skipped: 0,
          deleted: 0,
          failed: 0,
        },
        errors: [],
        status: 'completed',
      },
    });
  });

  it('should discard empty keys of strings', async () => {
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
          {
            'hello\n你好世\n': 'somevalue',
          },
        ],
      });

    const data = dataHelper.getPushSourceContent();

    let res = await request(app)
      .post('/content')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`)
      .send({
        data: {
          ...data,
          'hello\n你好世\n': { string: 'somevalue' },
          '': { string: 'empty key' },
          ' ': { string: 'key as space' },
          '    ': { string: '' },
          'Empty string key': { string: '' },
        },
      });

    expect(res.status).to.eql(202);

    // poll
    let status = '';
    const jobUrl = res.body.data.links.job;
    while (status !== 'completed') {
      await sleep(100);
      res = await request(app)
        .get(jobUrl)
        .set('Authorization', `Bearer ${token}:secret`);
      expect(res.status).to.eql(200);
      status = res.body.data.status;
    }

    expect(res.body).to.eqls({
      data: {
        details: {
          created: 3,
          updated: 0,
          skipped: 0,
          deleted: 0,
          failed: 0,
        },
        errors: [],
        status: 'completed',
      },
    });
  });

  it('should get correct report and errors', async () => {
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

    let res = await request(app)
      .post('/content')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`)
      .send({ data });

    expect(res.status).to.eql(202);

    // poll
    let status = '';
    const jobUrl = res.body.data.links.job;
    while (status !== 'completed') {
      await sleep(100);
      res = await request(app)
        .get(jobUrl)
        .set('Authorization', `Bearer ${token}:secret`);
      expect(res.status).to.eql(200);
      status = res.body.data.status;
    }

    expect(res.body).to.eqls({
      data: {
        details: {
          created: 0,
          updated: 0,
          skipped: 0,
          deleted: 0,
          failed: 2,
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
        status: 'completed',
      },
    });
  });

  it('should skip already pushed content', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });

    nock(urls.api).post(urls.resource_strings)
      .reply(200, {});

    const data = dataHelper.getPushSourceContent();

    let res = await request(app)
      .post('/content')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`)
      .send({ data });

    expect(res.status).to.eql(202);

    // poll
    let status = '';
    const jobUrl = res.body.data.links.job;
    while (status !== 'completed') {
      await sleep(100);
      res = await request(app)
        .get(jobUrl)
        .set('Authorization', `Bearer ${token}:secret`);
      expect(res.status).to.eql(200);
      status = res.body.data.status;
    }

    expect(res.body).to.eqls({
      data: {
        details: {
          created: 1,
          updated: 0,
          deleted: 0,
          skipped: 1,
          failed: 0,
        },
        errors: [],
        status: 'completed',
      },
    });
  });

  it('should throw an error if there are no data', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });

    nock(urls.api)
      .post(urls.resource_strings)
      .reply(200, {});

    let res = await request(app)
      .post('/content')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`)
      .send({});

    // poll
    let status = '';
    const jobUrl = res.body.data.links.job;
    while (status !== 'failed') {
      await sleep(100);
      res = await request(app)
        .get(jobUrl)
        .set('Authorization', `Bearer ${token}:secret`);
      expect(res.status).to.eql(200);
      status = res.body.data.status;
    }

    expect(res.body).to.eqls({
      data: {
        details: {
          created: 0,
          updated: 0,
          skipped: 0,
          deleted: 0,
          failed: 0,
        },
        errors: [{
          code: 'invalid',
          detail: '"\\"data\\" is required"',
          status: '422',
          title: 'Invalid Payload',
          source: {},
        }],
        status: 'failed',
      },
    });
  });

  it('should not throw an error if data has no strings', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);
    nock(urls.api)
      .get(urls.source_strings_revisions)
      .reply(200, { data: [], links: {} });

    nock(urls.api)
      .post(urls.resource_strings)
      .reply(200, {});

    let res = await request(app)
      .post('/content')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`)
      .send({ data: {} });

    // poll
    let status = '';
    const jobUrl = res.body.data.links.job;
    while (status !== 'completed') {
      await sleep(100);
      res = await request(app)
        .get(jobUrl)
        .set('Authorization', `Bearer ${token}:secret`);
      expect(res.status).to.eql(200);
      status = res.body.data.status;
    }

    expect(res.body).to.eqls({
      data: {
        details: {
          created: 0,
          updated: 0,
          skipped: 0,
          deleted: 0,
          failed: 0,
        },
        errors: [],
        status: 'completed',
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
    const data = {
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
    };
    let res = await request(app)
      .post('/content')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`)
      .send({ data });
    expect(res.status).to.eql(202);

    // poll
    let status = '';
    const jobUrl = res.body.data.links.job;
    while (status !== 'completed') {
      await sleep(100);
      res = await request(app)
        .get(jobUrl)
        .set('Authorization', `Bearer ${token}:secret`);
      expect(res.status).to.eql(200);
      status = res.body.data.status;
    }

    expect(res.body).to.eqls({
      data: {
        details: {
          created: 0,
          updated: 1,
          skipped: 0,
          deleted: 0,
          failed: 0,
        },
        errors: [],
        status: 'completed',
      },
    });
  });
});
