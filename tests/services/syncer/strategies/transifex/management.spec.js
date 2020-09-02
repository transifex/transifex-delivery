/* globals describe, it */

const { assert } = require('chai');
const transifexManagement = require('../../../../../src/services/syncer/strategies/transifex/management');

describe('Transifex Management Strategy', () => {
  it('should throw an error on createProject', async () => {
    try {
      await transifexManagement.createProject();
    } catch (e) {
      assert.equal(true, e instanceof Error);
      assert.equal('Not Implemented', e.message);
    }
  });

  it('should throw an error on deleteProject', async () => {
    try {
      await transifexManagement.deleteProject();
    } catch (e) {
      assert.equal(true, e instanceof Error);
      assert.equal('Not Implemented', e.message);
    }
  });

  it('should throw an error on listProjects', async () => {
    try {
      await transifexManagement.listProjects();
    } catch (e) {
      assert.equal(true, e instanceof Error);
      assert.equal('Not Implemented', e.message);
    }
  });

  it('should throw an error on addProjectLanguages', async () => {
    try {
      await transifexManagement.addProjectLanguages();
    } catch (e) {
      assert.equal(true, e instanceof Error);
      assert.equal('Not Implemented', e.message);
    }
  });

  it('should throw an error on deleteProjectLanguages', async () => {
    try {
      await transifexManagement.deleteProjectLanguages();
    } catch (e) {
      assert.equal(true, e instanceof Error);
      assert.equal('Not Implemented', e.message);
    }
  });
});
