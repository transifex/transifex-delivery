const _ = require('lodash');
const express = require('express');
const { validateHeader, validateAuth } = require('../middlewares/headers');
const logger = require('../logger');
const queue = require('../queue');
const registry = require('../services/registry');
const { createRateLimiter } = require('../helpers/ratelimit');

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
      let keys = await registry.listSet(`cache:${token}:keys`);
      keys = _.filter(keys, (key) => key.indexOf(`cache:${token}:${langCode}:content`) === 0);
      // Regular expression to match cache key with optional [tags] filter
      const contentRE = new RegExp(`cache:${_.escapeRegExp(token)}:${_.escapeRegExp(langCode)}:content(.*)`);
      let count = 0;
      _.each(keys, (key) => {
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
        queue.addJob(jobKey, {
          type: 'syncer:pull',
          key: jobKey,
          token: req.token,
          filter,
          syncFunc: 'getProjectLanguageTranslations',
          syncFuncParams: [langCode],
        });
        count += 1;
      });
      const response = {
        status: 'success',
        token,
        count,
      };
      res.json({
        data: response,
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
      // find all keys from redis
      let keys = await registry.listSet(`cache:${token}:keys`);
      keys = _.filter(keys, (key) => key.indexOf(`cache:${token}:`) === 0);
      // Regular expression to match cache key with optional [tags] filter
      const contentRE = new RegExp(`cache:${_.escapeRegExp(token)}:(.*):content(.*)`);
      let count = 0;
      _.each(keys, (key) => {
        const filter = {};
        const jobKey = key.replace('cache:', '');
        if (key === `cache:${token}:languages`) {
          queue.addJob(jobKey, {
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
            queue.addJob(jobKey, {
              type: 'syncer:pull',
              key: jobKey,
              token: req.token,
              filter,
              syncFunc: 'getProjectLanguageTranslations',
              syncFuncParams: [matches[1]],
            });
            count += 1;
          }
        }
      });
      const response = {
        status: 'success',
        token,
        count,
      };
      res.json({
        data: response,
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

module.exports = router;
