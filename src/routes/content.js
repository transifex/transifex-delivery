const express = require('express');
const dayjs = require('dayjs');
const _ = require('lodash');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { validateHeader } = require('../middlewares/headers');
const syncer = require('../services/syncer/data');
const registry = require('../services/registry');
const queue = require('../queue');
const md5 = require('../helpers/md5');
const { cleanTags, routerCacheHelper } = require('../helpers/utils');
const logger = require('../logger');

const router = express.Router();

const timeoutMsec = config.get('settings:upload_timeout_min') * 60 * 1000;
const hasAnalytics = config.get('analytics:enabled');
const analyticsRetentionSec = config.get('analytics:retention_days') * 24 * 60 * 60;
const pushThrottleTimeoutSec = config.get('settings:push_throttle_timeout_min') * 60;
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
  let filter = {};
  const tags = cleanTags(_.get(req.query, 'filter.tags'));
  if (tags) {
    // update filter
    filter = {
      tags,
    };
    // add tags to key
    key = `${key}[${tags}]`;
  }
  const sentContent = await routerCacheHelper(
    req, res,
    key, filter,
    'getProjectLanguageTranslations', req.params.lang_code,
  );
  if (hasAnalytics && sentContent) {
    const clientId = md5(req.ip || 'unknown');

    const project = req.token.project_token;
    const lang = req.params.lang_code;
    const sdkVersion = (req.headers['x-native-sdk'] || 'unknown').replace(/ /g, '-');

    const dateDay = dayjs().format('YYYY-MM-DD');
    const keyDay = `analytics:${project}:${dateDay}`;
    if (await registry.addToSet(`${keyDay}:clients`, clientId, analyticsRetentionSec)) {
      registry.incr(`${keyDay}:lang:${lang}`, 1, analyticsRetentionSec);
      registry.incr(`${keyDay}:sdk:${sdkVersion}`, 1, analyticsRetentionSec);
    }
  }
}

/**
 * Push source strings (version 1)
 *
 * @param {*} req
 * @param {*} res
 */
async function postContentV1(req, res) {
  const throttleKey = `throttle:push:${req.token.project_token}`;
  if (await registry.get(throttleKey)) {
    res.status(429).json({
      status: 429,
      message: 'Another content upload is already in progress',
    });
    return;
  }

  req.setTimeout(timeoutMsec);
  try {
    await registry.set(throttleKey, 1, pushThrottleTimeoutSec);

    const data = await syncer
      .pushSourceContent({ token: req.token }, req.body);

    let status = 200;
    if (data.errors.length) status = 409;

    res.status(status).json(data);
  } catch (e) {
    if (e.status) {
      if (e.status !== 401) logger.error(e);
      res.status(e.status).json({
        status: e.status,
        message: e.message,
        details: e.details,
      });
    } else {
      logger.error(e);
      res.status(500).json({
        status: 500,
        message: 'An error occured!',
      });
    }
  } finally {
    await registry.del(throttleKey);
  }
}

/**
 * Push source strings (version 2)
 *
 * @param {*} req
 * @param {*} res
 */
async function postContentV2(req, res) {
  // authenticate before creating an push job
  const isAuthenticated = await syncer.verifyCredentials({ token: req.token });
  if (!isAuthenticated) {
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
  const jobId = uuidv4();

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
}

// ------------- Routes -------------

router.get('/:lang_code',
  validateHeader('public'),
  getContent);

router.post('/',
  validateHeader('private'),
  (req, res) => {
    if (req.version === 'v2') {
      postContentV2(req, res);
    } else {
      postContentV1(req, res);
    }
  });

module.exports = router;
