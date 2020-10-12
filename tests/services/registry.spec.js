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

  it('should increment keys', async () => {
    await registry.incr('foo', 1);
    await registry.incr('foo', 2);
    expect(await registry.get('foo')).to.equal(3);
    await registry.del('foo');
  });

  it('should increment keys with expire', async () => {
    await registry.incr('foo', 1);
    await registry.incr('foo', 2, 1);
    expect(await registry.get('foo')).to.equal(3);
    await new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });
    expect(await registry.get('foo')).to.equal(undefined);
  });

  it('adds to set', async () => {
    await registry.addToSet('test:add_to_set', 'a');
    await registry.addToSet('test:add_to_set', 'a');
    await registry.addToSet('test:add_to_set', 'b');
    expect(await registry.countSet('test:add_to_set')).to.equal(2);
  });

  it('removes from set', async () => {
    await registry.addToSet('test:rem_from_set', 'a');
    await registry.addToSet('test:rem_from_set', 'b');
    await registry.removeFromSet('test:rem_from_set', 'c');
    await registry.removeFromSet('test:rem_from_set', 'b');
    expect(await registry.countSet('test:rem_from_set')).to.equal(1);
  });

  it('lists set', async () => {
    await registry.addToSet('test:list_set', 'a');
    await registry.addToSet('test:list_set', 'b');
    const values = await registry.listSet('test:list_set');
    expect(values.sort()).to.deep.equal(['a', 'b'].sort());
  });

  it('queries set members', async () => {
    await registry.addToSet('test:is_set_member', 'a');
    expect(await registry.isSetMember('test:is_set_member', 'a')).to.equal(true);
    expect(await registry.isSetMember('test:is_set_member', 'b')).to.equal(false);
  });
});
