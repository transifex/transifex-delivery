/* globals describe, it, beforeEach, afterEach */

const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const app = require('../../src/server')();
require('../../src/queue').initialize();

const req = request(app);
const config = require('../../src/config');
const { resetRegistry } = require('../lib');

const token = '1/abcd';

const urls = {
  api: config.get('transifex:api_host'),
  organizations: '/organizations',
  projects: '/projects?filter[organization]=o:oslug',
  resources: '/resources?filter[project]=o:oslug:p:pslug',
  languages: '/projects/o:oslug:p:pslug/languages',
};

describe('GET /languages', () => {
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

    let res;
    do {
      res = await req
        .get('/languages')
        .set('Accept-version', 'v2')
        .set('Authorization', `Bearer ${token}:secret`);
    } while (res.status === 202);

    expect(res.status).to.equal(200);
    expect(res.body).to.eqls({
      data: [
        {
          code: 'en',
          localized_name: 'English',
          name: 'English',
          rtl: false,
        },
        {
          code: 'l_code',
          localized_name: 'L Code',
          name: 'l_name',
          rtl: true,
        },
        {
          code: 'l_code2',
          localized_name: 'l_code2',
          name: 'l_name2',
          rtl: false,
        },
      ],
      meta: {
        source_lang_code: 'en',
      },
    });
  });
});
