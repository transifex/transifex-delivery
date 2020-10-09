const md5 = require('md5');
const logger = require('../logger');
const config = require('../config');
const cache = require('../services/cache');
const registry = require('../services/registry');
const syncer = require('../services/syncer/data');

const registryExpireSec = config.get('registry:expire_min') * 60;
const hasAnalytics = config.get('analytics:enabled');
const analyticsRetentionSec = config.get('analytics:retention_days') * 24 * 60 * 60;

/**
 * Pull content from API syncer job
 *
 * @param {*} job
 */
async function syncerPull(job) {
  const {
    key,
    token,
    syncFunc,
    syncFuncParams,
  } = job.data;
  try {
    const data = await syncer[syncFunc](
      {
        token,
      },
      ...syncFuncParams,
    );
    const stringData = JSON.stringify(data);
    const etag = md5(stringData);
    const cacheKey = `${key}:${etag}`;
    const { location } = await cache.setContent(cacheKey, stringData);
    await registry.set(`cache:${key}`, {
      status: 'success',
      ts: Date.now(),
      etag,
      location,
      cacheKey,
    }, registryExpireSec);
    // store valid credentials for analytics endpoints
    if (hasAnalytics) {
      await registry.set(
        `analyticsauth:${token.project_token}`,
        md5(token.original),
        analyticsRetentionSec,
      );
    }
  } catch (e) {
    // gracefully handle 4xx errors and store them in cache
    if (e.status && e.status >= 400 && e.status < 500) {
      await registry.set(`cache:${key}`, {
        status: 'error',
        ts: Date.now(),
        statusCode: e.status || 404,
        statusMessage: e.message || 'Not found',
      }, registryExpireSec);
    } else {
      throw e;
    }
  }
}

module.exports = (job) => {
  const proc = async () => {
    const now = Date.now();
    logger.info(`Processing job ${job.id}`);
    try {
      if (job.data.type === 'syncer:pull') {
        await syncerPull(job);
      }
    } catch (e) {
      logger.warn(`Failed to process job ${job.id}`);
      logger.error(e);
      throw e; // throw error to restart the job
    }
    logger.info(`Processed job ${job.id} in ${(Date.now() - now) / 1000}sec`);
  };
  return proc();
};
