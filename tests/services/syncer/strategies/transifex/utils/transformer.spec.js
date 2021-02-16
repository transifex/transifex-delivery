/* globals describe, it */

const { expect } = require('chai');
const _ = require('lodash');

const { getLanguageInfo } = require('../../../../../../src/helpers/languages');
const transformer = require('../../../../../../src/services/syncer/strategies/transifex/utils/transformer');
const api = require('../helpers/api');

describe('Transformer', () => {
  it('should parse languages', () => {
    const response = api.getTargetLanguages();
    let result = transformer.parseLanguages(response.data);
    expect(result).to.eql([{
      code: response.data[0].attributes.code,
      localized_name: getLanguageInfo(
        response.data[0].attributes.code,
      ).localized_name,
      name: response.data[0].attributes.name,
      rtl: response.data[0].attributes.rtl,
    }]);

    result = transformer.parseLanguages();
    expect(result).to.eql([]);

    result = transformer.parseLanguages([]);
    expect(result).to.eql([]);
  });

  it('should create a hashmap with string keys', () => {
    const response = api.getProjectLanguageTranslations();
    let result = transformer.parseSourceStringForIdLookup(response.included);
    const key = 'o:oslug:p:pslug:r:rslug:s:shash';
    const expected = new Map([[key, ['hello_world', true]]]);

    expect(_.isEqual(result, expected)).to.eql(true);

    result = transformer.parseSourceStringForIdLookup([]);
    expect(_.isEqual(result, new Map())).to.eql(true);

    result = transformer.parseSourceStringForIdLookup();
    expect(_.isEqual(result, new Map())).to.eql(true);
  });

  it('should parse project languages translations', () => {
    const response = api.getProjectLanguageTranslations();
    const included = transformer.parseSourceStringForIdLookup(
      response.included,
    );

    const data = response.data[0];
    let result = transformer.parseProjectLanguageTranslations(
      response.data, included,
    );

    let expected = new Map([['hello_world', {
      string: (
        '{???, plural, '
          + `one {${data.attributes.strings.one}} `
          + `other {${data.attributes.strings.other}}}`
      ),
    }]]);
    expect(_.isEqual(result, expected)).to.eql(true);

    data.attributes.strings = null;
    result = transformer.parseProjectLanguageTranslations(
      response.data, included,
    );

    expected = new Map([
      ['hello_world', {
        string: '',
      }],
    ]);

    expect(_.isEqual(result, expected)).to.eql(true);

    result = transformer.parseProjectLanguageTranslations(
      response.data, new Map(),
    );

    expected = new Map();
    expect(_.isEqual(result, expected)).to.eql(true);

    result = transformer.parseProjectLanguageTranslations([], new Map());
    expected = new Map();
    expect(_.isEqual(result, expected)).to.eql(true);

    result = transformer.parseProjectLanguageTranslations(null, new Map());
    expected = new Map();
    expect(_.isEqual(result, expected)).to.eql(true);
  });

  it('should parse project source string', () => {
    const payload = api.getPushSourceContent();
    const key = 'somekey';
    const data = payload[key];
    const result = transformer.parseSourceStringForAPI(key, data);

    expect(result).to.eql({
      context: data.meta.context,
      developer_comment: data.meta.developer_comment,
      tags: data.meta.tags,
      character_limit: data.meta.character_limit,
      key,
      strings: {
        other: data.string,
      },
      pluralized: false,
    });
  });

  it('should parse project source string and omit keys when needed', () => {
    const key = 'somekey';
    const data = {
      [key]: {
        stromg: 'some string',
      },
    };
    const result = transformer.parseSourceStringForAPI(key, data);

    expect(result).to.eql({
      context: [],
      key,
      strings: {
        other: '',
      },
      pluralized: false,
    });
  });

  it(`should parse source string and return a hashmap with
    parseSourceStringForIdLookup`, () => {
    const data = api.getSourceString();
    let result = transformer.parseSourceStringForIdLookup(data.data);
    const expected = new Map([
      ['o:oslug:p:pslug:r:rslug:s:shash', ['hello_world', true]],
    ]);
    expect(_.isEqual(result, expected)).to.eql(true);

    result = transformer.parseSourceStringForIdLookup([]);
    expect(_.isEqual(result, new Map())).to.eql(true);

    result = transformer.parseSourceStringForIdLookup();
    expect(_.isEqual(result, new Map())).to.eql(true);
  });

  it(`should parse source string and return a hashmap with
    parseSourceStringForKeyLookup`, () => {
    const data = api.getSourceString();
    let result = transformer.parseSourceStringForKeyLookup(data.data);

    const expected = new Map();
    expected.set('hello_world', {
      attributes: {
        key: 'hello_world',
        strings: {
          one: 'hello',
          other: 'world',
        },
        pluralized: true,
        context: ['frontpage', 'footer', 'verb'],
        tags: ['foo', 'bar'],
        developer_comment: 'Wrapped in a 30px width div',
        character_limit: 100,
        occurrences: '/my_project/templates/frontpage/hello.html:30',
      },
      payload: {
        character_limit: 100,
        tags: ['foo', 'bar'],
        developer_comment: 'Wrapped in a 30px width div',
      },
      id: 'o:oslug:p:pslug:r:rslug:s:shash',
    });
    expect(_.isEqual(result, expected)).to.eql(true);

    result = transformer.parseSourceStringForKeyLookup([]);
    expect(result).to.eqls(new Map());

    result = transformer.parseSourceStringForKeyLookup();
    expect(result).to.eqls(new Map());
  });
});
