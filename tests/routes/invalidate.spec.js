/* globals describe, it, beforeEach, afterEach */

const { expect } = require('chai');
const md5 = require('md5');
const request = require('supertest');
const cache = require('../../src/services/cache');
const registry = require('../../src/services/registry');
const { resetRegistry, populateRegistry } = require('../lib');
const app = require('../../src/server')();

const req = request(app);

const token = '1/abcd';
const key = `${token}:en:content`;
const content = JSON.stringify({ foo: 'bar' });
const etag = 'abcd';
const cacheKey = `${key}:${etag}`;

describe('Invalidate', () => {
  beforeEach(async () => {
    await populateRegistry(key, content);
  });

  afterEach(async () => {
    await resetRegistry();
  });

  it('should work', async () => {
    await registry.set(
      `auth:${token}`,
      md5(`${token}:secret`),
    );

    const res = await req
      .post('/invalidate')
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.contain({
      status: 'success',
      token,
    });
    expect(res.body.count).to.be.greaterThan(0);
    expect(await cache.getContent(cacheKey)).to.deep.equal({
      data: null,
    });

    await registry.del(`auth:${token}`);
  });

  it('should validate token', async () => {
    const res = await req
      .post('/invalidate')
      .set('Authorization', `Bearer ${token}_invalid:secret`);

    expect(res.status).to.equal(403);
  });
});
