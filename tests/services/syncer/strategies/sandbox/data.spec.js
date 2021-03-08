/* globals describe, it, beforeEach, afterEach */

const { expect } = require('chai');
const syncMgmt = require('../../../../../src/services/syncer/strategies/sandbox/management');
const syncData = require('../../../../../src/services/syncer/strategies/sandbox/data');

const SOURCE = {
  data: {
    key1: {
      string: 'string1',
      meta: {
        tags: ['foo', 'bar'],
      },
    },
    key2: {
      string: 'string2',
      meta: {
        tags: ['foo'],
      },
    },
  },
};

const TRANSLATIONS = {
  data: {
    key1: {
      string: 'translation1',
    },
    key2: {
      string: 'translation2',
    },
  },
};

async function clearProjects() {
  try {
    await syncMgmt.deleteProject({}, { data: { slug: 'foo' } });
  } catch (e) {
    // no=op
  }
}

describe('Sandbox data strategy', () => {
  let project;

  beforeEach(async () => {
    await clearProjects();
    project = await syncMgmt.createProject({}, {
      data: {
        slug: 'foo',
        name: 'Foo',
        source_lang_code: 'en',
      },
    });
    await syncMgmt.addProjectLanguages({}, {
      data: {
        slug: 'foo',
        target_languages: [{
          code: 'fr',
        }],
      },
    });
  });

  afterEach(async () => {
    await clearProjects();
  });

  it('should get languages', async () => {
    // add language
    const res = await syncData.getLanguages(project.meta);
    expect(res).to.deep.equal({
      data: [
        {
          name: 'English',
          code: 'en',
          localized_name: 'English',
          rtl: false,
        },
        {
          name: 'French',
          code: 'fr',
          localized_name: 'Français',
          rtl: false,
        },
      ],
      meta: {
        source_lang_code: 'en',
      },
    });
  });

  it('should push content', async () => {
    let res = await syncData.pushSourceContent(project.meta, SOURCE);
    expect(res).to.deep.equal({
      created: 2,
      updated: 0,
      skipped: 0,
      deleted: 0,
      failed: 0,
      errors: [],
    });

    // try again with same content
    res = await syncData.pushSourceContent(project.meta, SOURCE);
    expect(res).to.deep.equal({
      created: 0,
      updated: 0,
      skipped: 2,
      deleted: 0,
      failed: 0,
      errors: [],
    });
  });

  it('should push translations', async () => {
    let res = await syncData.pushTranslations(project.meta, 'fr', TRANSLATIONS);
    expect(res).to.deep.equal({
      created: 2,
      updated: 0,
      skipped: 0,
      deleted: 0,
      failed: 0,
      errors: [],
    });

    // push again
    res = await syncData.pushTranslations(project.meta, 'fr', TRANSLATIONS);
    expect(res).to.deep.equal({
      created: 0,
      updated: 0,
      skipped: 2,
      deleted: 0,
      failed: 0,
      errors: [],
    });
  });

  it('should get translations', async () => {
    await syncData.pushSourceContent(project.meta, SOURCE);
    await syncData.pushTranslations(project.meta, 'fr', TRANSLATIONS);

    // get translations
    let res = await syncData.getProjectLanguageTranslations(project.meta, 'fr');
    expect(res).to.deep.equal(TRANSLATIONS);

    // get translations with one tag filter
    res = await syncData.getProjectLanguageTranslations({
      ...project.meta,
      filter: {
        tags: 'foo',
      },
    }, 'fr');
    expect(res).to.deep.equal({
      data: {
        key1: {
          string: 'translation1',
        },
        key2: {
          string: 'translation2',
        },
      },
    });

    // get translations with another tag filter
    res = await syncData.getProjectLanguageTranslations({
      ...project.meta,
      filter: {
        tags: 'bar',
      },
    }, 'fr');
    expect(res).to.deep.equal({
      data: {
        key1: {
          string: 'translation1',
        },
      },
    });

    // get translations with two tags filter
    res = await syncData.getProjectLanguageTranslations({
      ...project.meta,
      filter: {
        tags: 'foo,bar',
      },
    }, 'fr');
    expect(res).to.deep.equal({
      data: {
        key1: {
          string: 'translation1',
        },
      },
    });

    // get translations with no matching tags filter
    res = await syncData.getProjectLanguageTranslations({
      ...project.meta,
      filter: {
        tags: 'notag',
      },
    }, 'fr');
    expect(res).to.deep.equal({
      data: {},
    });
  });

  it('should verify valid credentials', async () => {
    const res = await syncData.verifyCredentials(project.meta);
    expect(res).to.equal(true);
  });

  it('should not verify invalid credentials', async () => {
    const res = await syncData.verifyCredentials({
      token: 'invalid',
      secret: 'invalid',
    });
    expect(res).to.equal(false);
  });
});
