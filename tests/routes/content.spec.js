/* globals describe, it, beforeEach, afterEach */

const chai = require('chai');
const chaiHttp = require('chai-http');
const request = require('supertest');
const nock = require('nock');
const _ = require('lodash');
const app = require('../../src/server')();
const cache = require('../../src/services/cache');
const dataHelper = require('../services/syncer/strategies/transifex/helpers/api');
const config = require('../../src/config');

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
    + 'o:oslug:p:pslug:r:rslug&filter[language]=l:lcode&include=resource_string',
  source_strings: '/resource_strings?filter[resource]='
    + 'o:oslug:p:pslug:r:rslug',
  resource_strings: '/resource_strings',
};

describe('/content', () => {
  beforeEach(async () => {
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
        }],
      }));

    nock(urls.api)
      .get(urls.resources)
      .reply(200, JSON.stringify({
        data: [{
          attributes: {
            slug: 'rslug',
          },
        }],
      }));

    // flush cache
    const keys = await cache.findKeys('*');
    await Promise.all(_.map(keys, (key) => cache.delContent(key)));
  });

  afterEach(async () => {
    nock.cleanAll();
    // invalidating cache to be fresh in any subsequent test
    // requests to cds are going to return whatever is already cached
    // and then cache is going to be updated by performing calls to transifex
    // API
    await request(app)
      .post('/invalidate')
      .set('Authorization', `Bearer ${token}:secret`);
  });

  it('should propagate an API error', async () => {
    nock(urls.api)
      .get(urls.get_translations)
      .reply(401);

    let res;
    do {
      res = await request(app)
        .get('/content/lcode')
        .set('Authorization', `Bearer ${token}:secret`);
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
        .set('Authorization', `Bearer ${token}:secret`);
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

  it('should always return an Etag while responding', async () => {
    nock(urls.api)
      .get(urls.get_translations)
      .reply(200, JSON.stringify({ data: [], links: {} }));

    let res;
    do {
      res = await request(app)
        .get('/content/lcode')
        .set('Authorization', `Bearer ${token}:secret`);
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
        .set('Authorization', `Bearer ${token}:secret`);
    } while (res.status === 202);

    expect(res.body).to.eqls({ data: {} });
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
        .set('Authorization', `Bearer ${token}:secret`)
        .set('If-None-Match', 'obsolete_value');
    } while (firstRes.status === 202);

    expect(firstRes.status).to.equal(200);
    expect(firstRes).to.have.header('ETag');

    const res = await request(app)
      .get('/content/lcode')
      .set('Authorization', `Bearer ${token}:secret`)
      .set('If-None-Match', firstRes.headers.etag);

    expect(res).to.have.status(304);
  });

  it('should push content', async () => {
    nock(urls.api)
      .get(urls.source_strings)
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

    const res = await request(app)
      .post('/content')
      .set('Authorization', `Bearer ${token}:secret`)
      .send({ data });

    expect(res.status).to.eql(200);
    expect(res.body).to.eqls({
      created: 2,
      updated: 0,
      skipped: 0,
      deleted: 0,
      failed: 0,
      errors: [],
    });
  });

  it('should get correct report and errors', async () => {
    nock(urls.api)
      .get(urls.source_strings)
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

    const res = await request(app)
      .post('/content')
      .set('Authorization', `Bearer ${token}:secret`)
      .send({ data });

    expect(res.status).to.eql(409);
    expect(res.body).to.eqls({
      created: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      failed: 2,
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

  it('should skip already pushed content', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);

    nock(urls.api).post(urls.resource_strings)
      .reply(200, {});

    const data = dataHelper.getPushSourceContent();

    const res = await request(app)
      .post('/content')
      .set('Authorization', `Bearer ${token}:secret`)
      .send({ data });

    expect(res.status).to.eql(200);
    expect(res.body).to.eqls({
      created: 1,
      updated: 0,
      deleted: 0,
      skipped: 1,
      failed: 0,
      errors: [],
    });
  });

  it('should throw an error if there are no data', async () => {
    const sourceData = dataHelper.getSourceString();
    nock(urls.api)
      .get(urls.source_strings)
      .reply(200, sourceData);

    nock(urls.api)
      .post(urls.resource_strings)
      .reply(200, {});

    const res = await request(app)
      .post('/content')
      .set('Authorization', `Bearer ${token}:secret`)
      .send({});

    expect(res.status).to.eql(422);
  });
});
