/* globals describe, it, beforeEach, afterEach */

const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const md5 = require('../../src/helpers/md5');
const cache = require('../../src/services/cache');
const registry = require('../../src/services/registry');
const { resetRegistry, populateRegistry } = require('../lib');
const app = require('../../src/server')();
require('../../src/queue').initialize();

const req = request(app);

const token = '1/abcd';
const key = `${token}:en:content`;
const content = JSON.stringify({ foo: 'bar' });
const etag = 'abcd';
const cacheKey = `${key}:${etag}`;

describe('Purge as user', () => {
  beforeEach(async () => {
    await populateRegistry(key, content);
    await registry.set(
      `auth:${token}`,
      md5(`${token}:secret`),
    );
  });

  afterEach(async () => {
    nock.cleanAll();
    await registry.del(`auth:${token}`);
    await resetRegistry();
  });

  it('should purge all languages', async () => {
    const res = await req
      .post('/purge')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      data: {
        status: 'success',
        token,
        count: 1,
      },
    });
    expect(await cache.getContent(cacheKey)).to.deep.equal({
      data: null,
    });
  });

  it('should purge specific languages', async () => {
    const res = await req
      .post('/purge/en')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      data: {
        status: 'success',
        token,
        count: 1,
      },
    });
    expect(await cache.getContent(cacheKey)).to.deep.equal({
      data: null,
    });
  });

  it('should not purge non-existing language', async () => {
    const res = await req
      .post('/purge/abcd')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      data: {
        status: 'success',
        token,
        count: 0,
      },
    });
  });

  it('should validate token', async () => {
    await registry.del(`auth:${token}`);
    const res = await req
      .post('/purge')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}_invalid:secret`);

    expect(res.status).to.equal(403);
  });
});

describe('Purge as Transifex', () => {
  beforeEach(async () => {
    await populateRegistry(key, content);
    await registry.set(
      `auth:${token}`,
      md5(`${token}:secret`),
    );
  });

  afterEach(async () => {
    nock.cleanAll();
    await registry.del(`auth:${token}`);
    await resetRegistry();
  });

  it('should purge all languages', async () => {
    const res = await req
      .post('/purge')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Transifex-Trust-Secret', 'txsecret');

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      data: {
        status: 'success',
        token,
        count: 1,
      },
    });
    expect(await cache.getContent(cacheKey)).to.deep.equal({
      data: null,
    });
  });

  it('should purge specific languages', async () => {
    const res = await req
      .post('/purge/en')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Transifex-Trust-Secret', 'txsecret');

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      data: {
        status: 'success',
        token,
        count: 1,
      },
    });
    expect(await cache.getContent(cacheKey)).to.deep.equal({
      data: null,
    });
  });

  it('should not purge non-existing language', async () => {
    const res = await req
      .post('/purge/abcd')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Transifex-Trust-Secret', 'txsecret');

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      data: {
        status: 'success',
        token,
        count: 0,
      },
    });
  });

  it('should validate token', async () => {
    await registry.del(`auth:${token}`);
    const res = await req
      .post('/purge')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Transifex-Trust-Secret', 'invalid');

    expect(res.status).to.equal(403);
  });
});
