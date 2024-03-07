const _ = require('lodash');
const express = require('express');
const { validateHeader, validateAuth } = require('../middlewares/headers');
const logger = require('../logger');
const queue = require('../queue');
const registry = require('../services/registry');
const { createRateLimiter } = require('../helpers/ratelimit');
const { sendToTelemetry } = require('../telemetry');
const { isValidTagList } = require('../helpers/utils');

const router = express.Router();

router.post(
  '/:lang_code',
  validateHeader('trust'),
  createRateLimiter('invalidate'),
  validateAuth,
  async (req, res) => {
    try {
      const token = req.token.project_token;
      const langCode = req.params.lang_code;
      // find all language keys from redis
      const setKey = `cache:${token}:keys`;
      let keys = await registry.listSet(setKey);
      keys = _.filter(keys, (key) => key.indexOf(`cache:${token}:${langCode}:content`) === 0);
      // Regular expression to match cache key with optional [tags] filter
      const contentRE = new RegExp(`cache:${_.escapeRegExp(token)}:${_.escapeRegExp(langCode)}:content(.*)`);
      let count = 0;

      await Promise.all(_.map(keys, (key) => (async () => {
        // Clean up remnant keys
        const data = await registry.get(key);
        if (!data) {
          logger.info(`Remove empty cache key ${key} during invalidation`);
          await registry.delFromSet(setKey, key);
          return;
        }
        if (data.status !== 'success') {
          logger.info(`Remove failed cache key ${key} during invalidation`);
          await registry.del(key);
          await registry.delFromSet(setKey, key);
          return;
        }

        const filter = {};
        const jobKey = key.replace('cache:', '');
        const matches = key.match(contentRE);
        // optionally match [tags] filter
        try {
          let tags = matches[1];
          // extract comma separated tags content
          tags = tags.match(/\[(.*)\]/);
          // eslint-disable-next-line prefer-destructuring
          filter.tags = tags[1];
          // Do a sanity check
          if (!isValidTagList(filter.tags)) {
            logger.info(`Remove previously invalid cache key ${key} during invalidation`);
            await registry.del(key);
            await registry.delFromSet(setKey, key);
            return;
          }
        } catch (e) {
          // no-op
        }
        // optionally match {status} filter
        try {
          let status = matches[1];
          status = status.match(/\{(.*)\}/);
          // eslint-disable-next-line prefer-destructuring
          filter.status = status[1];
        } catch (e) {
          // no-op
        }
        await queue.addJob(jobKey, {
          type: 'syncer:pull',
          key: jobKey,
          token: req.token,
          filter,
          syncFunc: 'getProjectLanguageTranslations',
          syncFuncParams: [langCode],
        });
        count += 1;
      })()));

      logger.info(`Invalidate ${token} over ${count} resources for ${langCode} language`);

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

router.post(
  '/',
  validateHeader('trust'),
  createRateLimiter('invalidate'),
  validateAuth,
  async (req, res) => {
    try {
      const token = req.token.project_token;
      // find all keys from redis
      const setKey = `cache:${token}:keys`;
      let keys = await registry.listSet(setKey);
      keys = _.filter(keys, (key) => key.indexOf(`cache:${token}:`) === 0);
      // Regular expression to match cache key with optional [tags] filter
      const contentRE = new RegExp(`cache:${_.escapeRegExp(token)}:(.*):content(.*)`);
      let count = 0;

      await Promise.all(_.map(keys, (key) => (async () => {
        // Clean up remnant keys
        const data = await registry.get(key);
        if (!data) {
          logger.info(`Remove empty cache key ${key} during invalidation`);
          await registry.delFromSet(setKey, key);
          return;
        }
        if (data.status !== 'success') {
          logger.info(`Remove failed cache key ${key} during invalidation`);
          await registry.del(key);
          await registry.delFromSet(setKey, key);
          return;
        }

        const filter = {};
        const jobKey = key.replace('cache:', '');
        if (key === `cache:${token}:languages`) {
          await queue.addJob(jobKey, {
            type: 'syncer:pull',
            key: jobKey,
            token: req.token,
            filter,
            syncFunc: 'getLanguages',
            syncFuncParams: [],
          });
          count += 1;
        } else {
          const matches = key.match(contentRE);
          // matches[1] holds the language
          if (matches && matches[1]) {
            // optionally match [tags] filter
            try {
              let tags = matches[2];
              // extract comma separated tags content
              tags = tags.match(/\[(.*)\]/);
              // eslint-disable-next-line prefer-destructuring
              filter.tags = tags[1];
              // Do a sanity check
              if (!isValidTagList(filter.tags)) {
                logger.info(`Remove previously invalid cache key ${key} during invalidation`);
                await registry.del(key);
                await registry.delFromSet(setKey, key);
                return;
              }
            } catch (e) {
              // no-op
            }
            // optionally match {status} filter
            try {
              let status = matches[2];
              status = status.match(/\{(.*)\}/);
              // eslint-disable-next-line prefer-destructuring
              filter.status = status[1];
            } catch (e) {
              // no-op
            }
            await queue.addJob(jobKey, {
              type: 'syncer:pull',
              key: jobKey,
              token: req.token,
              filter,
              syncFunc: 'getProjectLanguageTranslations',
              syncFuncParams: [matches[1]],
            });
            count += 1;
          } else {
            logger.info(`Remove erroneous cache key ${key} during invalidation`);
            await registry.del(key);
            await registry.delFromSet(setKey, key);
          }
        }
      })()));

      logger.info(`Invalidate ${token} over ${count} resources for all languages`);

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
