/* globals describe, it, beforeEach, afterEach */

const sinon = require('sinon');
const { expect } = require('chai');
const cache = require('../../../../../src/services/cache/strategies/redis');

const cachedToken = '1/abcd';
const cachedKey = `${cachedToken}:en:content`;

const content = JSON.stringify({ foo: 'bar' });

describe('Redis cache', () => {
  let sandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    await cache.setContent(cachedKey, content);
  });

  afterEach(async () => {
    await cache.delContent(cachedKey);
    afterEach(() => sandbox.restore());
  });

  it('should read cache', async () => {
    const payload = await cache.getContent(cachedKey);
    expect(payload.data).to.equal(content);
  });

  it('should handle invalid cache', async () => {
    const payload = await cache.getContent('invalid_key');
    expect(payload).to.deep.equal({
      data: null,
    });
  });

  it('should handle concurrent read/write', async () => {
    const key = '1/test_key';
    const contentOld = JSON.stringify({ foo: 'bar' });
    const contentNew = JSON.stringify({ foo2: 'bar2' });

    // set initial content
    await cache.setContent(key, contentOld);

    // get content stream
    const cachedData = await cache.getContent(key);
    // concurrent update data
    const promise = cache.setContent(key, contentNew);

    expect(cachedData.data).to.equal(contentOld);

    await promise;

    const cachedDataNew = await cache.getContent(key);
    expect(cachedDataNew.data).to.equal(contentNew);

    // cleanup
    await cache.delContent(key);
  });

  it('should handle concurrent write', async () => {
    const key = '1/test_key';
    const contentOld = JSON.stringify({ foo: 'bar' });
    const contentNew = JSON.stringify({ foo2: 'bar2' });

    // set initial content concurrently
    const promise = cache.setContent(key, contentOld);
    const promiseNew = cache.setContent(key, contentNew);

    await Promise.all([promise, promiseNew]);

    const { data } = await cache.getContent(key);

    // we expect for content to be written by at least one of the two sets
    // eslint-disable-next-line no-unused-expressions
    expect(data).to.be.string;

    // cleanup
    await cache.delContent(key);
  });
});
