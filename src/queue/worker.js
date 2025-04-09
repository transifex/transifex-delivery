const _ = require('lodash');
const md5 = require('../helpers/md5');
const logger = require('../logger');
const config = require('../config');
const cache = require('../services/cache');
const registry = require('../services/registry');
const syncer = require('../services/syncer/data');
const { sendToTelemetry } = require('../telemetry');

const pullSuccessExpireSec = config.get('settings:pull_success_cache_min') * 60;
const pullErrorExpireSec = config.get('settings:pull_error_cache_min') * 60;
const jobStatusCacheSec = config.get('settings:job_status_cache_min') * 60;
const autoSyncJitterMin = config.get('settings:autosync_jitter_min') * 1;

/**
 * Pull content from API syncer job
 */
async function syncerPull(job) {
  const {
    key,
    filter,
    token,
    syncFunc,
    syncFuncParams,
  } = job.data;

  try {
    const data = await syncer[syncFunc](
      {
        token,
        filter,
      },
      ...syncFuncParams,
    );

    const stringData = JSON.stringify(data);
    const etag = md5(stringData);
    const cacheKey = `${key}:${etag}`;
    const { location } = await cache.setContent(cacheKey, stringData);

    await Promise.all([
      registry.set(`cache:${key}`, {
        status: 'success',
        ts: Date.now(),
        ts_jitter: _.random(autoSyncJitterMin) * 60 * 1000,
        etag,
        location,
        cacheKey,
      }, pullSuccessExpireSec),
      registry.addToSet(
        `cache:${token.project_token}:keys`,
        `cache:${key}`,
        pullSuccessExpireSec,
      ),
    ]);
  } catch (err) {
    const e = err || {};
    const statusCode = e.status || 500;
    const statusMessage = e.message || 'Server error';

    const rdata = (await registry.get(`cache:${key}`)) || {};
    if (rdata.status === 'success'
      && statusCode !== 401
      && statusCode !== 404
    ) {
      logger.error(err);
    } else {
      await Promise.all([
        registry.set(`cache:${key}`, {
          status: 'error',
          ts: Date.now(),
          ts_jitter: _.random(autoSyncJitterMin) * 60 * 1000,
          statusCode,
          statusMessage,
        }, pullErrorExpireSec),
        registry.addToSet(
          `cache:${token.project_token}:keys`,
          `cache:${key}`,
          pullSuccessExpireSec,
        ),
      ]);
      logger.warn(err);
    }
  }
}

/**
 * Push content to API syncer job
 */
async function syncerPush(job) {
  const {
    jobId,
    token,
    payload,
  } = job.data;

  await registry.set(`job:status:${jobId}`, {
    data: {
      status: 'processing',
    },
  }, jobStatusCacheSec);

  try {
    const data = await syncer.pushSourceContent({ token }, payload);

    await registry.set(`job:status:${jobId}`, {
      data: {
        details: {
          ...(_.pick(data, [
            'created',
            'updated',
            'skipped',
            'deleted',
            'failed',
          ])),
        },
        errors: data.errors,
        status: 'completed',
      },
    }, jobStatusCacheSec);

    sendToTelemetry('/native/collect/action', {
      token: token.project_token,
      action: 'push',
    }, `push:${token.project_token}`);
  } catch (err) {
    const e = err || {};
    const errors = [{
      status: `${e.status || 500}`,
      code: `${e.code || 'server error'}`,
      detail: JSON.stringify(e.details || 'Something went wrong'),
      title: e.message || 'Something went wrong',
      source: _.isObject(e.source) ? e.source : {},
    }];

    await registry.set(`job:status:${jobId}`, {
      data: {
        details: {
          created: 0,
          updated: 0,
          skipped: 0,
          deleted: 0,
          failed: _.keys((payload || {}).data || []).length,
        },
        errors,
        status: 'failed',
      },
    }, jobStatusCacheSec);
  }
}

/**
 * Exported worker function compatible with Bull’s child process mode.
 */
module.exports = async function (job) {
  const now = Date.now();
  logger.info(`Processing job ${job.id}`);

  try {
    if (job.data.type === 'syncer:pull') {
      await syncerPull(job);
    } else if (job.data.type === 'syncer:push') {
      await syncerPush(job);
    }
    logger.info(`Processed job ${job.id} in ${(Date.now() - now) / 1000} sec`);
  } catch (e) {
    logger.warn(`Failed to process job ${job.id}`);
    logger.error(e);
    throw e; // let Bull retry based on `attempts` config
  }
};
