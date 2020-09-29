/* globals describe, it, beforeEach, afterEach */

const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const _ = require('lodash');
const cache = require('../../src/services/cache');
const registry = require('../../src/services/registry');
const app = require('../../src/server')();

const req = request(app);
const config = require('../../src/config');

const token = '1/abcd';

const urls = {
  api: config.get('transifex:api_host'),
  organizations: '/organizations',
  projects: '/projects?filter[organization]=o:oslug',
  resources: '/resources?filter[project]=o:oslug:p:pslug',
  languages: '/projects/o:oslug:p:pslug/languages',
};

describe('/languages', () => {
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
    // flush cache
    const keys = await registry.find('*');
    await Promise.all(_.map(keys, (key_) => cache.delContent(key_.replace('cache:', ''))));
    await Promise.all(_.map(keys, (key_) => registry.del(key_)));
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

    let res;
    do {
      res = await req
        .get('/languages')
        .set('Authorization', `Bearer ${token}:secret`);
    } while (res.status === 202);

    expect(res.status).to.equal(200);
    expect(res.body).to.eqls({
      data: [
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
    });
  });
});
