const express = require('express');
const _ = require('lodash');
const config = require('../config');
const { validateHeader } = require('../middlewares/headers');
const syncer = require('../services/syncer/data');
const registry = require('../services/registry');
const queue = require('../queue');
const md5 = require('../helpers/md5');
const { cleanTags, routerCacheHelper, isValidTagList } = require('../helpers/utils');
const { createRateLimiter } = require('../helpers/ratelimit');
const { sendToTelemetry } = require('../telemetry');
const logger = require('../logger');

const router = express.Router();
const jobStatusCacheSec = config.get('settings:job_status_cache_min') * 60;

/**
 * Get language translations
 *
 * @param {*} req
 * @param {*} res
 */
async function getContent(req, res) {
  // pattern is:
  // - token:lang:content
  // - token:lang:content[tag1,tag2]
  let key = `${req.token.project_token}:${req.params.lang_code}:content`;

  // parse tags filter
  const filter = {};
  const tags = cleanTags(_.get(req.query, 'filter.tags'));
  if (tags) {
    // Check if tags are valid
    if (!isValidTagList(tags)) {
      res.status(400).json({
        status: 400,
        message: 'Bad Request',
        details: 'Invalid tags filter',
      });
      return;
    }

    // update filter
    filter.tags = tags;
    // add tags to key
    key = `${key}[${tags}]`;
  }

  // parse status filter
  const filterStatus = _.get(req.query, 'filter.status');
  if (filterStatus) {
    // update filter
    filter.status = filterStatus;
    // add status to key
    key = `${key}{${filterStatus}}`;
  }

  const sentContent = await routerCacheHelper(
    req,
    res,
    key,
    filter,
    'getProjectLanguageTranslations',
    req.params.lang_code,
  );

  if (sentContent) {
    sendToTelemetry('/native/collect/fetch', {
      token: req.token.project_token,
      langCode: req.params.lang_code,
      sdkVersion: req.headers['x-native-sdk'] || 'unknown',
    }, `fetch:${req.token.project_token}`);
  }
}

// ------------- Routes -------------

router.get(
  '/:lang_code',
  validateHeader('public'),
  createRateLimiter('pull'),
  getContent,
);

router.post(
  '/',
  validateHeader('private'),
  createRateLimiter('push'),
  async (req, res) => {
    // authenticate before creating an push job
    const isAuthenticated = await syncer.verifyCredentials({ token: req.token });
    if (!isAuthenticated) {
      logger.info(`Forbidden error: Invalid credentials,
        Token: ${JSON.stringify(req.token)},
        Headers: ${JSON.stringify(req.headers)},
        IP Address: ${req.ip},
        Request Details: ${JSON.stringify({
    method: req.method,
    url: req.originalUrl,
    query: req.query,
  })}`);
      res.status(403).json({
        status: 403,
        message: 'Forbidden',
        details: 'Invalid credentials',
      });
      return;
    }

    // create a unique job id based on content
    const contentHash = md5(JSON.stringify(req.body));
    const key = `${req.token.project_token}:${contentHash}:push`;
    const jobId = md5(key);

    // check if job is already in the queue
    if (await queue.hasJob(key)) {
      res.status(409).json({
        status: 409,
        message: 'Another content upload is already in progress',
      });
      return;
    }

    // update job status
    await registry.set(`job:status:${jobId}`, {
      data: {
        status: 'pending',
      },
    }, jobStatusCacheSec);

    // add job to queue
    await queue.addJob(key, {
      type: 'syncer:push',
      key,
      jobId,
      token: req.token,
      payload: req.body,
    });

    // respond
    res.status(202).json({
      data: {
        id: jobId,
        links: {
          job: `/jobs/content/${jobId}`,
        },
      },
    });
  },
);

module.exports = router;
