/* globals describe, it */

const { expect } = require('chai');
const _ = require('lodash');
const registry = require('../../src/services/registry');

describe('Registry', () => {
  it('should write to registry', async () => {
    await registry.set('foo', 'bar');
    expect(await registry.get('foo')).to.equal('bar');

    await registry.del('foo');
    expect(await registry.get('foo')).to.equal(undefined);
  });

  it('should write to registry with expire', async () => {
    await registry.set('foo', { key: 1 }, 10);
    expect(await registry.get('foo')).to.deep.equal({ key: 1 });

    await registry.del('foo');
    expect(await registry.get('foo')).to.equal(undefined);
  });

  it('should find keys', async () => {
    await registry.set('foo1', 'bar');
    await registry.set('foo2', 'bar');
    await registry.set('bar3', 'bar');

    expect(_.sortBy(await registry.find('foo*'))).to.deep.equal(_.sortBy([
      'foo1',
      'foo2',
    ]));

    await registry.del('foo1');
    await registry.del('foo2');
    await registry.del('bar3');
  });
});
