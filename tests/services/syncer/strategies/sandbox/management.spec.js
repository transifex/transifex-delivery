/* globals describe, it, beforeEach, afterEach */

const { expect } = require('chai');
const syncMgmt = require('../../../../../src/services/syncer/strategies/sandbox/management');

async function clearProjects() {
  try {
    await syncMgmt.deleteProject({}, { data: { slug: 'foo' } });
  } catch (e) {
    // no-op
  }
}

describe('Sandbox sync strategy', () => {
  beforeEach(async () => {
    await clearProjects();
    await syncMgmt.createProject({}, {
      data: {
        slug: 'foo',
        name: 'Foo',
        source_lang_code: 'en',
      },
    });
  });

  afterEach(async () => {
    await clearProjects();
  });

  it('should add/remove language', async () => {
    // add language
    let res = await syncMgmt.addProjectLanguages({}, {
      data: {
        slug: 'foo',
        target_languages: [{
          code: 'fr',
        }],
      },
    });

    expect(res).to.deep.equal({
      data: [{
        code: 'fr',
        name: 'fr',
      }],
    });

    // remove language
    res = await syncMgmt.deleteProjectLanguages({}, {
      data: {
        slug: 'foo',
        target_languages: [{
          code: 'fr',
        }],
      },
    });

    expect(res).to.deep.equal({
      data: [{
        code: 'fr',
        name: 'fr',
      }],
    });
  });
});
