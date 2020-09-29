/* globals describe, it, beforeEach, afterEach */

const _ = require('lodash');
const { expect } = require('chai');
const request = require('supertest');
const cache = require('../../src/services/cache');
const registry = require('../../src/services/registry');
const app = require('../../src/server')();

const req = request(app);

const token = '1/abcd';
const key = `${token}:en:content`;
const content = JSON.stringify({ foo: 'bar' });

describe('Invalidate', () => {
  beforeEach(async () => {
    // flush cache
    const keys = await registry.find('*');
    await Promise.all(_.map(keys, (key_) => cache.delContent(key_.replace('cache:', ''))));
    await Promise.all(_.map(keys, (key_) => registry.del(key_)));

    await registry.set(`cache:${key}`, content);
    await cache.setContent(key, content);
  });

  afterEach(async () => {
    await cache.delContent(key);
  });

  it('should work', async () => {
    const res = await req
      .post('/invalidate')
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.contain({
      status: 'success',
      token,
    });
    expect(res.body.count).to.be.greaterThan(0);
  });

  it('should work on invalid token', async () => {
    const res = await req
      .post('/invalidate')
      .set('Authorization', `Bearer ${token}_invalid:secret`);

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      status: 'success',
      token: `${token}_invalid`,
      count: 0,
    });
  });
});
