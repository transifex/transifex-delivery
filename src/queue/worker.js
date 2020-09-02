const logger = require('../logger');
const cache = require('../services/cache');
const syncer = require('../services/syncer/data');

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
    await cache.setContent(key, JSON.stringify(data));
  } catch (e) {
    // gracefully handle 4xx errors and store them in cache
    if (e.status && e.status >= 400 && e.status < 500) {
      await cache.setContent(`${key}:status`, JSON.stringify({
        error: true,
        status: e.status,
        message: e.message || '',
      }));
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
