/* globals describe, it, beforeEach, afterEach */

const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const nock = require('nock');
const md5 = require('../../src/helpers/md5');
const registry = require('../../src/services/registry');
const queue = require('../../src/queue');
const { resetRegistry, populateRegistry } = require('../lib');
const app = require('../../src/server')();
require('../../src/queue').initialize();

const req = request(app);

const token = '1/abcd';
const key = `${token}:en:content`;
const content = JSON.stringify({ foo: 'bar' });

describe('Invalidate as user', () => {
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    await populateRegistry(token, key, content);
    await registry.set(
      `auth:${token}`,
      md5(`${token}:secret`),
    );
  });

  afterEach(async () => {
    nock.cleanAll();
    sandbox.restore();
    await registry.del(`auth:${token}`);
    await resetRegistry();
  });

  it('should invalidate all languages', async () => {
    const spy = sandbox.spy(queue, 'addJob');

    const res = await req
      .post('/invalidate')
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
    expect(spy.callCount).to.be.greaterThan(0);
  });

  it('should invalidate specific languages', async () => {
    const spy = sandbox.spy(queue, 'addJob');

    const res = await req
      .post('/invalidate/en')
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
    expect(spy.callCount).to.equal(1);
  });

  it('should validate token', async () => {
    await registry.del(`auth:${token}`);

    const res = await req
      .post('/invalidate')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}_invalid:secret`);

    expect(res.status).to.equal(403);
  });
});

describe('Invalidate as Transifex', () => {
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    await populateRegistry(token, key, content);
    await registry.set(
      `auth:${token}`,
      md5(`${token}:secret`),
    );
  });

  afterEach(async () => {
    nock.cleanAll();
    sandbox.restore();
    await registry.del(`auth:${token}`);
    await resetRegistry();
  });

  it('should invalidate all languages', async () => {
    const spy = sandbox.spy(queue, 'addJob');

    const res = await req
      .post('/invalidate')
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
    expect(spy.callCount).to.be.greaterThan(0);
  });

  it('should invalidate specific languages', async () => {
    const spy = sandbox.spy(queue, 'addJob');

    const res = await req
      .post('/invalidate/en')
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
    expect(spy.callCount).to.equal(1);
  });

  it('should validate token', async () => {
    await registry.del(`auth:${token}`);

    const res = await req
      .post('/invalidate')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Transifex-Trust-Secret', 'invalid');

    expect(res.status).to.equal(403);
  });
});
