const express = require('express');
const dayjs = require('dayjs');
const md5 = require('md5');
const slugify = require('slugify');
const config = require('../config');
const validateHeader = require('../middlewares/headers');
const syncer = require('../services/syncer/data');
const registry = require('../services/registry');
const utils = require('../helpers/utils');
const logger = require('../logger');

const router = express.Router();

const timeoutMsec = config.get('settings:upload_timeout_min') * 60 * 1000;
const hasAnalytics = config.get('analytics:enabled');
const analyticsRetentionSec = config.get('analytics:retention_days') * 24 * 60 * 60;

router.get('/:lang_code',
  validateHeader('public'),
  async (req, res) => {
    const sentContent = await utils.routerCacheHelper(
      req, res,
      `${req.token.project_token}:${req.params.lang_code}:content`,
      'getProjectLanguageTranslations', req.params.lang_code,
    );
    if (hasAnalytics && sentContent) {
      const clientId = md5(req.ip || 'unknown');
      const project = req.token.project_token;
      const lang = req.params.lang_code;
      const sdkVersion = slugify(req.headers['x-native-sdk'] || 'unknown');

      const dateDay = dayjs().format('YYYY-MM-DD');
      const dateMonth = dayjs().format('YYYY-MM');
      const keyDay = `analytics:${project}:${dateDay}`;
      const keyMonth = `analytics:${project}:${dateMonth}`;

      // daily stats
      registry.incr(`${keyDay}:lang:${lang}`, 1, analyticsRetentionSec);
      registry.incr(`${keyDay}:sdk:${sdkVersion}`, 1, analyticsRetentionSec);
      registry.addToSet(`${keyDay}:visitors`, clientId, analyticsRetentionSec);

      // monthly stats
      registry.incr(`${keyMonth}:lang:${lang}`, 1, analyticsRetentionSec);
      registry.incr(`${keyMonth}:sdk:${sdkVersion}`, 1, analyticsRetentionSec);
      registry.addToSet(`${keyMonth}:visitors`, clientId, analyticsRetentionSec);
    }
  });

router.post('/:lang_code',
  validateHeader('private'),
  async (req, res) => {
    req.setTimeout(timeoutMsec);
    try {
      const data = await syncer.pushTranslations(
        { token: req.token }, req.params.lang_code, req.body.data,
      );
      res.json(data);
    } catch (e) {
      if (e.status) {
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
    }
  });

router.post('/',
  validateHeader('private'),
  async (req, res) => {
    req.setTimeout(timeoutMsec);
    try {
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
    }
  });

module.exports = router;
