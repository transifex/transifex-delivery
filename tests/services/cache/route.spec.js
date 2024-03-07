/* eslint-disable no-unused-expressions */
/* globals describe, it, beforeEach, afterEach */

const sinon = require('sinon');
const { expect } = require('chai');
const request = require('supertest');
const syncer = require('../../../src/services/syncer/data');
const { resetRegistry, populateRegistry } = require('../../lib');
const app = require('../../../src/server')();
require('../../../src/queue').initialize();

const req = request(app);

const cachedToken = '1/abcd';
const cachedKey = `${cachedToken}:en:content`;
const uncachedToken = '1/efgh';
const content = JSON.stringify({ foo: 'bar' });

function sleep(ms) {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Content cache', () => {
  let sandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    await populateRegistry(cachedToken, cachedKey, content);
  });

  afterEach(async () => {
    await resetRegistry();
    afterEach(() => sandbox.restore());
  });

  it('should download content from cache', async () => {
    let res;
    do {
      res = await req
        .get('/content/en')
        .set('Accept-version', 'v2')
        .set('Authorization', `Bearer ${cachedToken}:secret`);
      await sleep(50);
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
        .set('Accept-version', 'v2')
        .set('Authorization', `Bearer ${uncachedToken}:secret`);
      await sleep(50);
    } while (res.status === 202);

    expect(res.status).to.equal(200);
    expect(res.header['content-type'])
      .to.equal('application/json; charset=utf-8');
    expect(res.header.etag).to.exist;
    expect(res.header['cache-control']).to.exist;

    // cached data
    const resCached = await req
      .get('/content/en')
      .set('Accept-version', 'v2')
      .set('Authorization', `Bearer ${uncachedToken}:secret`);

    expect(resCached.status).to.equal(200);
    expect(resCached.header.etag).to.equal(res.header.etag);
    expect(resCached.header['cache-control']).to.exist;
  });
});
