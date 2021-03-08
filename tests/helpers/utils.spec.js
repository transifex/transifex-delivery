/* globals describe, it */

const { expect } = require('chai');

const {
  arrayContainsArray,
  cleanTags,
} = require('../../src/helpers/utils');

describe('arrayContainsArray', () => {
  it('should test arrays', () => {
    expect(arrayContainsArray()).to.equal(false);
    expect(arrayContainsArray(['a'])).to.equal(false);
    expect(arrayContainsArray([], ['a'])).to.equal(false);
    expect(arrayContainsArray(['a', 'b'], ['c'])).to.equal(false);
    expect(arrayContainsArray(['a', 'b'], ['b', 'c'])).to.equal(false);

    expect(arrayContainsArray(['a', 'b'], ['b'])).to.equal(true);
    expect(arrayContainsArray(['a', 'b', 'c'], ['c', 'a'])).to.equal(true);
    expect(arrayContainsArray(['a', 'b', 'c'], ['c', 'a', 'b'])).to.equal(true);
    expect(arrayContainsArray(['a', 'b', 'c'], ['a', 'a', 'b'])).to.equal(true);
  });
});

describe('cleanTags', () => {
  it('should sanitize tags string', () => {
    expect(cleanTags()).to.equal('');
    expect(cleanTags('t')).to.equal('t');
    expect(cleanTags('a,, b')).to.equal('a,b');
    expect(cleanTags('a, b   ,c  ')).to.equal('a,b,c');
  });
});
