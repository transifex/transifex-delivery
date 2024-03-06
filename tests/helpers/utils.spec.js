/* globals describe, it */

const { expect } = require('chai');

const {
  arrayContainsArray,
  cleanTags,
  isValidTagList,
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

describe('isValidTagList', () => {
  it('should validate tags', () => {
    expect(isValidTagList('')).to.equal(true);
    expect(isValidTagList(null)).to.equal(true);
    expect(isValidTagList('tag')).to.equal(true);
    expect(isValidTagList('tag1,tag2,tag3')).to.equal(true);
    expect(isValidTagList('tag1\ntag2')).to.equal(false);
    expect(isValidTagList("tag',' OR 'x'='x'")).to.equal(false);
    expect(isValidTagList('../../')).to.equal(false);
    expect(isValidTagList('C:\\Windows\\System32')).to.equal(false);
    expect(isValidTagList("!@#$%^&*()-_+=[{}]';:\\|<>,.?/")).to.equal(true);
    expect(isValidTagList('tag1!,tag2@,tag3#')).to.equal(true);
  });
});
