/* eslint-disable no-unused-expressions */
/* globals describe, it, beforeEach, afterEach */

const sinon = require('sinon');
const { expect } = require('chai');
const request = require('supertest');
const _ = require('lodash');
const cache = require('../../../src/services/cache');
const syncer = require('../../../src/services/syncer/data');
const registry = require('../../../src/services/registry');
const app = require('../../../src/server')();

const req = request(app);

const cachedToken = '1/abcd';
const cachedKey = `${cachedToken}:en:content`;

const uncachedToken = '1/efgh';
const uncachedKey = `${uncachedToken}:en:content`;

const content = JSON.stringify({ foo: 'bar' });

describe('Content cache', () => {
  let sandbox;

  beforeEach(async () => {
    // flush cache
    const keys = await registry.find('*');
    await Promise.all(_.map(keys, (key_) => cache.delContent(key_.replace('cache:', ''))));
    await Promise.all(_.map(keys, (key_) => registry.del(key_)));

    sandbox = sinon.createSandbox();
    await registry.set(`cache:${cachedKey}`, {
      status: 'success',
      etag: '123',
      ts: Date.now(),
      location: `cache://${cachedKey}`,
    });
    await cache.setContent(cachedKey, content);
  });

  afterEach(async () => {
    await cache.delContent(cachedKey);
    await cache.delContent(uncachedKey);
    afterEach(() => sandbox.restore());
  });

  it('should download content from cache', async () => {
    let res;
    do {
      res = await req
        .get('/content/en')
        .set('Authorization', `Bearer ${cachedToken}:secret`);
    } while (res.status === 202);

    expect(res.status).to.equal(200);
    expect(res.header['content-type']).to.equal('application/json; charset=utf-8');
    expect(res.header['cache-control']).to.exist;
    expect(res.header.etag).to.exist;
  });

  it('should cache response', async () => {
    sandbox.stub(syncer, 'getProjectLanguageTranslations').returns(content);

    // fresh data
    let res;
    do {
      res = await req
        .get('/content/en')
        .set('Authorization', `Bearer ${uncachedToken}:secret`);
    } while (res.status === 202);

    expect(res.status).to.equal(200);
    expect(res.header['content-type'])
      .to.equal('application/json; charset=utf-8');
    expect(res.header.etag).to.exist;
    expect(res.header['cache-control']).to.exist;

    // cached data
    const resCached = await req
      .get('/content/en')
      .set('Authorization', `Bearer ${uncachedToken}:secret`);

    expect(resCached.status).to.equal(200);
    expect(resCached.header.etag).to.equal(res.header.etag);
    expect(resCached.header['cache-control']).to.exist;
  });
});
