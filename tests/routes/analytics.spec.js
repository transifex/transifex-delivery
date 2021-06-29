/* globals describe, it, beforeEach, afterEach */

const { expect } = require('chai');
const dayjs = require('dayjs');
const request = require('supertest');
const md5 = require('../../src/helpers/md5');
const registry = require('../../src/services/registry');
const { resetRegistry, populateRegistry } = require('../lib');
const app = require('../../src/server')();

const req = request(app);

const token = '1/abcd';
const key = `${token}:en:content`;
const content = JSON.stringify({ foo: 'bar' });

describe('Analytics as user', () => {
  beforeEach(async () => {
    await populateRegistry(key, content);
  });

  afterEach(async () => {
    await resetRegistry();
  });

  it('returns daily results', async () => {
    await registry.set(
      `auth:${token}`,
      md5(`${token}:secret`),
    );

    const today = dayjs().format('YYYY-MM-DD');
    const res = await req
      .get(`/analytics?filter[since]=${today}&filter[until]=${today}`)
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      data: [{
        languages: {},
        sdks: {},
        date: today,
        clients: 0,
      }],
      meta: {
        total: {
          languages: {},
          sdks: {},
          clients: 0,
        },
      },
    });
  });

  it('authenticates', async () => {
    const today = dayjs().format('YYYY-MM-DD');
    const res = await req
      .get(`/analytics?filter[since]=${today}&filter[until]=${today}`)
      .set('Authorization', `Bearer ${token}:secret`);

    expect(res.status).to.equal(403);
  });

  it('validates filters', async () => {
    await registry.set(
      `auth:${token}`,
      md5(`${token}:secret`),
    );

    const today = dayjs().format('YYYY-MM-DD');

    // wrong filter
    let res = await req
      .get(`/analytics?filter[any]=${today}&filter[until]=${today}`)
      .set('Authorization', `Bearer ${token}:secret`);
    expect(res.status).to.equal(400);

    // missing date range filter
    res = await req
      .get(`/analytics?filter[since]=${today}`)
      .set('Authorization', `Bearer ${token}:secret`);
    expect(res.status).to.equal(400);
  });

  it('validates date range', async () => {
    await registry.set(
      `auth:${token}`,
      md5(`${token}:secret`),
    );
    const res = await req
      .get('/analytics?filter[since]=2000-01-01&filter[until]=2021-01-01')
      .set('Authorization', `Bearer ${token}:secret`);
    expect(res.status).to.equal(400);
  });
});

describe('Analytics as Transifex', () => {
  beforeEach(async () => {
    await populateRegistry(key, content);
  });

  afterEach(async () => {
    await resetRegistry();
  });

  it('returns daily results', async () => {
    await registry.set(
      `auth:${token}`,
      md5(`${token}:secret`),
    );

    const today = dayjs().format('YYYY-MM-DD');
    const res = await req
      .get(`/analytics?filter[since]=${today}&filter[until]=${today}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Transifex-Trust-Secret', 'txsecret');

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      data: [{
        languages: {},
        sdks: {},
        date: today,
        clients: 0,
      }],
      meta: {
        total: {
          languages: {},
          sdks: {},
          clients: 0,
        },
      },
    });
  });

  it('authenticates', async () => {
    const today = dayjs().format('YYYY-MM-DD');
    const res = await req
      .get(`/analytics?filter[since]=${today}&filter[until]=${today}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Transifex-Trust-Secret', 'invalid');

    expect(res.status).to.equal(403);
  });
});
