/* globals describe, it, beforeEach, afterEach */

const chai = require('chai');
const chaiHttp = require('chai-http');
const request = require('supertest');
const nock = require('nock');
const dataHelper = require('../services/syncer/strategies/transifex/helpers/api');
const config = require('../../src/config');
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

describe('POST /proxy/pull', () => {
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

  it('should translate html', async () => {
    nock(urls.api)
      .get(urls.get_translations)
      .reply(200, dataHelper.getProjectLanguageTranslations());

    const res = await request(app)
      .post('/proxy/pull/lcode')
      .send({
        data: {
          format: 'html',
          content: '<html><body><p>Hello world</p></body></html>',
        },
      })
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      data: {
        format: 'html',
        content: '<html lang="lcode"><head></head><body><p>Hello world</p></body></html>',
      },
    });
  });

  it('should translate html fragment', async () => {
    nock(urls.api)
      .get(urls.get_translations)
      .reply(200, dataHelper.getProjectLanguageTranslations());

    const res = await request(app)
      .post('/proxy/pull/lcode')
      .send({
        data: {
          format: 'html-fragment',
          content: '<p>Hello world</p>',
        },
      })
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      data: {
        format: 'html-fragment',
        content: '<p>Hello world</p>',
      },
    });
  });

  it('should validate format', async () => {
    const res = await request(app)
      .post('/proxy/pull/lcode')
      .send({
        data: {
          format: 'foo',
          content: '<html><body><p>Hello world</p></body></html>',
        },
      })
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(400);
  });

  it('should validate content', async () => {
    const res = await request(app)
      .post('/proxy/pull/lcode')
      .send({
        data: {
          format: 'foo',
        },
      })
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(400);
  });
});

describe('POST /content', () => {
  it('should push html', async () => {
    const res = await request(app)
      .post('/proxy/push')
      .send({
        data: {
          format: 'html',
          content: '<html><body><p>Hello world</p></body></html>',
        },
      })
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.eql(202);
    expect(res.body).to.eqls({
      data: {
        count: 1,
      },
    });
  });
});
