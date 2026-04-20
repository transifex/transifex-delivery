/* globals describe, it, beforeEach, before */

const { expect } = require('chai');
const _ = require('lodash');
const registry = require('../../../../../src/services/registry/strategies/dynamodb');

describe('DynamoDB registry', () => {
  before(async () => {
    await registry.init();
  });

  beforeEach(async () => {
    const keys = await registry.findAll();
    await Promise.all(_.map(keys, (key) => (async () => {
      await registry.del(key);
    })()));
  });

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

  it('should find all keys', async () => {
    await registry.set('foo1', 'bar');
    await registry.set('foo2', 'bar');
    await registry.set('bar3', 'bar');

    expect(_.sortBy(await registry.findAll())).to.deep.equal(_.sortBy([
      'foo1',
      'foo2',
      'bar3',
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
    expect(await registry.addToSet('test:add_to_set', 'a')).to.equal(true);
    expect(await registry.addToSet('test:add_to_set', 'a')).to.equal(false);
    expect(await registry.addToSet('test:add_to_set', 'b')).to.equal(true);
    expect((await registry.listSet('test:add_to_set')).length).to.equal(2);
  });

  it('adds to set with TTL', async () => {
    expect(await registry.addToSet('test:add_to_set_ttl', 'a', 10)).to.equal(true);
    expect(await registry.addToSet('test:add_to_set_ttl', 'a', 10)).to.equal(false);
    expect(await registry.addToSet('test:add_to_set_ttl', 'b', 10)).to.equal(true);
    expect((await registry.listSet('test:add_to_set_ttl')).length).to.equal(2);
  });

  it('returns false when value already exists in legacy unsharded set', async () => {
    await registry.set('test:legacy_add_to_set', { values: ['a'] });
    expect(await registry.addToSet('test:legacy_add_to_set', 'a')).to.equal(false);
    expect((await registry.listSet('test:legacy_add_to_set')).sort()).to.deep.equal(['a']);
  });

  it('lists set', async () => {
    await registry.addToSet('test:list_set', 'a');
    await registry.addToSet('test:list_set', 'b');
    const values = await registry.listSet('test:list_set');
    expect(values.sort()).to.deep.equal(['a', 'b'].sort());
  });

  it('removes from set', async () => {
    await registry.addToSet('test:del_from_set', 'a');
    await registry.addToSet('test:del_from_set', 'b');
    expect(await registry.delFromSet('test:del_from_set', 'a')).to.equal(true);
    expect(await registry.delFromSet('test:del_from_set', 'a')).to.equal(false);

    let values = await registry.listSet('test:del_from_set');
    expect(values.sort()).to.deep.equal(['b']);

    expect(await registry.delFromSet('test:del_from_set', 'b')).to.equal(true);
    values = await registry.listSet('test:del_from_set');
    expect(values).to.deep.equal([]);
  });

  it('listSet returns empty array for a key that has never been written', async () => {
    // Arrange - no setup, key does not exist in DynamoDB or any shard
    // Act
    const values = await registry.listSet('test:nonexistent_sharded_set');
    // Assert
    expect(values).to.deep.equal([]);
  });

  it('addToSet and listSet handle a set spanning all shards including duplicate shards', async () => {
    // Arrange
    // Shard assignments (NUM_SHARDS=5): a→2, b→3, c→4, d→0, e→1, f→2
    // 'a' and 'f' share shard 2 — exercises multi-value-per-shard behavior
    const entries = ['a', 'b', 'c', 'd', 'e', 'f'];
    // Act
    await Promise.all(entries.map((v) => registry.addToSet('test:all_shards_set', v)));
    const result = await registry.listSet('test:all_shards_set');
    // Assert
    expect(result.sort()).to.deep.equal(entries.sort());
  });

  it('listSet returns all values when multiple values exist in unsharded legacy data', async () => {
    // Arrange - simulate a token written before sharding was introduced
    const legacyValues = ['cache:tok:en:content', 'cache:tok:fr:content', 'cache:tok:de:content'];
    await registry.set('test:legacy_multi_values', { values: legacyValues });
    // Act
    const result = await registry.listSet('test:legacy_multi_values');
    // Assert
    expect(result.sort()).to.deep.equal(legacyValues.sort());
  });

  it('listSet deduplicates a value present in both the legacy key and a shard key', async () => {
    // Arrange - seed 'a' in the legacy key, then addToSet 'a' (it also lands in shard 2)
    // and add 'b' as a new shard-only value
    await registry.set('test:shard_dedup_set', { values: ['a'] });
    await registry.addToSet('test:shard_dedup_set', 'a'); // 'a' now exists in legacy AND shard 2
    await registry.addToSet('test:shard_dedup_set', 'b'); // 'b' only in shard 3
    // Act
    const result = await registry.listSet('test:shard_dedup_set');
    // Assert - 'a' appears exactly once despite being in two places
    expect(result.sort()).to.deep.equal(['a', 'b']);
  });

  it('addToSet writes to a shard sub-key and leaves the base key empty', async () => {
    // Arrange - 'a' hashes to shard 2 (charCode 97, 97 % 5 = 2)
    await registry.addToSet('test:shard_key_placement', 'a');
    // Act
    const baseKeyData = await registry.get('test:shard_key_placement');
    const shardKeyData = await registry.get('test:shard_key_placement:2');
    // Assert
    expect(baseKeyData).to.equal(undefined);
    expect(shardKeyData).to.not.equal(undefined);
    expect(shardKeyData.values).to.include('a');
  });
});
