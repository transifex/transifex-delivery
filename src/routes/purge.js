const _ = require('lodash');
const express = require('express');
const { validateHeader, validateAuth } = require('../middlewares/headers');
const logger = require('../logger');
const cache = require('../services/cache');
const registry = require('../services/registry');
const { createRateLimiter } = require('../helpers/ratelimit');
const { sendToTelemetry } = require('../telemetry');

const router = express.Router();

router.post(
  '/:lang_code',
  validateHeader('trust'),
  createRateLimiter('invalidate'),
  validateAuth,
  async (req, res) => {
    try {
      const token = req.token.project_token;
      const setKey = `cache:${token}:keys`;
      let keys = await registry.listSet(setKey);
      keys = _.filter(keys, (key) => key.indexOf(`cache:${token}:${req.params.lang_code}:`) === 0);
      let count = 0;
      await Promise.all(_.map(keys, (key) => (async () => {
        const data = await registry.get(key);
        if (data) {
          count += 1;
          await registry.del(key);
          if (data.cacheKey) {
            await cache.delContent(data.cacheKey);
          }
        }
        await registry.delFromSet(setKey, key);
      })()));

      // send to telemetry
      sendToTelemetry('/native/collect/action', {
        token,
        action: 'invalidate',
      }, `invalidate:${token}`);

      res.json({
        data: {
          status: 'success',
          token,
          count,
        },
      });
    } catch (e) {
      logger.error(e);
      const response = {
        status: 'failed',
      };
      res.status(500).json({
        data: response,
      });
    }
  },
);

router.post(
  '/',
  validateHeader('trust'),
  createRateLimiter('invalidate'),
  validateAuth,
  async (req, res) => {
    try {
      const token = req.token.project_token;
      const setKey = `cache:${token}:keys`;
      let keys = await registry.listSet(setKey);
      keys = _.filter(keys, (key) => key.indexOf(`cache:${token}:`) === 0);
      let count = 0;
      await Promise.all(_.map(keys, (key) => (async () => {
        const data = await registry.get(key);
        if (data) {
          count += 1;
          await registry.del(key);
          if (data.cacheKey) {
            await cache.delContent(data.cacheKey);
          }
        }
        await registry.delFromSet(setKey, key);
      })()));

      // send to telemetry
      sendToTelemetry('/native/collect/action', {
        token,
        action: 'invalidate',
      }, `invalidate:${token}`);

      res.json({
        data: {
          status: 'success',
          token,
          count,
        },
      });
    } catch (e) {
      logger.error(e);
      res.status(500).json({
        data: {
          status: 'failed',
        },
      });
    }
  },
);

module.exports = router;
