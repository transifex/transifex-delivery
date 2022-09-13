const _ = require('lodash');
const express = require('express');
const dayjs = require('dayjs');
const { validateHeader, validateAuth } = require('../middlewares/headers');
const registry = require('../services/registry');
const config = require('../config');
const logger = require('../logger');
const { createRateLimiter } = require('../helpers/ratelimit');

const router = express.Router();
const hasAnalytics = config.get('analytics:enabled');
const analyticsRetentionDays = config.get('analytics:retention_days');

if (hasAnalytics) {
  logger.info('Analytics: enabled');
} else {
  logger.info('Analytics: disabled');
}

router.get(
  '/',
  (req, res, next) => {
    if (!hasAnalytics) {
      res.status(501).json({
        status: 501,
        message: 'Not Implemented',
      });
    } else {
      next();
    }
  },
  validateHeader('trust'),
  createRateLimiter('analytics'),
  validateAuth,
  async (req, res) => {
    const filterQuery = req.query.filter || {};
    const filterSince = filterQuery.since;
    const filterUntil = filterQuery.until;
    if (!filterSince || !filterUntil) {
      res.status(400).json({
        status: 400,
        message: 'Bad Request',
        details: 'Date filter missing: ?filter[since]=<date>&filter[until]=<date>',
      });
      return;
    }

    const dateUntil = dayjs(filterUntil);
    const dateSince = dayjs(filterSince);

    if (dateUntil.diff(dateSince, 'days') > analyticsRetentionDays) {
      res.status(400).json({
        status: 400,
        message: 'Bad Request',
        details: `Date range must be within ${analyticsRetentionDays} days`,
      });
      return;
    }

    const intervals = dateUntil.diff(dateSince, 'days');

    const response = {
      data: [],
      meta: {
        total: {
          languages: {},
          sdks: {},
        },
      },
    };

    const { total } = response.meta;

    for (let i = 0; i <= intervals; i += 1) {
      const analyticsDate = dateSince.add(i, 'day');
      const keyDay = analyticsDate.format('YYYY-MM-DD');

      const registryKey = `analytics:${req.token.project_token}:${keyDay}`;
      let entry = {
        languages: {},
        sdks: {},
        date: keyDay,
      };

      // check for aggregated results
      const aggrKey = `${registryKey}:aggr`;
      const aggrEntry = await registry.get(aggrKey);
      if (aggrEntry
          && aggrEntry.date === keyDay
          && aggrEntry.languages
          && aggrEntry.sdks
      ) {
        entry = aggrEntry;
      } else {
        await Promise.all([
          // languages
          (async () => {
            const langCodes = await registry.listSet(`${registryKey}:lang`);
            await Promise.all(_.map(langCodes, (lang) => (async () => {
              const count = await registry.get(`${registryKey}:lang:${lang}`);
              if (count > 0) {
                entry.languages[lang] = count;
              }
            })()));
          })(),
          // SDKs
          (async () => {
            const sdkVersions = await registry.listSet(`${registryKey}:sdk`);
            await Promise.all(_.map(sdkVersions, (sdk) => (async () => {
              const count = await registry.get(`${registryKey}:sdk:${sdk}`);
              if (count > 0) {
                entry.sdks[sdk] = count;
              }
            })()));
          })(),
        ]);
        // store past results in registry for future look ups
        if (dayjs().diff(analyticsDate, 'days') > 0) {
          await registry.set(aggrKey, entry, analyticsRetentionDays);
        }
      }

      // find totals
      _.each(entry.languages, (count, lang) => {
        total.languages[lang] = total.languages[lang] || 0;
        total.languages[lang] += count;
      });
      _.each(entry.sdks, (count, sdk) => {
        total.sdks[sdk] = total.sdks[sdk] || 0;
        total.sdks[sdk] += count;
      });

      response.data.push(entry);
    }

    res.json(response);
  },
);

module.exports = router;
