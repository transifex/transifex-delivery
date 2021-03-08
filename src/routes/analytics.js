const _ = require('lodash');
const express = require('express');
const dayjs = require('dayjs');
const { validateHeader, validateAuth } = require('../middlewares/headers');
const registry = require('../services/registry');
const config = require('../config');

const router = express.Router();
const hasAnalytics = config.get('analytics:enabled');
const analyticsRetentionDays = config.get('analytics:retention_days');

router.get('/',
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
          clients: 0,
        },
      },
    };

    const { total } = response.meta;
    const clients = {};

    for (let i = 0; i <= intervals; i += 1) {
      const keyDay = dateSince.add(i, 'day').format('YYYY-MM-DD');

      const registryKey = `analytics:${req.token.project_token}:${keyDay}`;
      const entry = {
        languages: {},
        sdks: {},
        date: keyDay,
      };

      await Promise.all([
        // languages
        (async () => {
          const keys = await registry.find(`${registryKey}:lang:*`);
          await Promise.all(_.map(keys, (key) => (async () => {
            const slug = key.replace(`${registryKey}:lang:`, '');
            const count = await registry.get(key);
            entry.languages[slug] = count;
            total.languages[slug] = total.languages[slug] || 0;
            total.languages[slug] += count;
          })()));
        })(),
        // SDKs
        (async () => {
          const keys = await registry.find(`${registryKey}:sdk:*`);
          await Promise.all(_.map(keys, (key) => (async () => {
            const slug = key.replace(`${registryKey}:sdk:`, '');
            const count = await registry.get(key);
            entry.sdks[slug] = count;
            total.sdks[slug] = total.sdks[slug] || 0;
            total.sdks[slug] += count;
          })()));
        })(),
        // clients
        (async () => {
          const hashes = await registry.listSet(`${registryKey}:clients`);
          entry.clients = hashes.length;
          _.each(hashes, (hash) => {
            clients[hash] = true;
          });
        })(),
      ]);

      response.data.push(entry);
    }

    response.meta.total.clients = _.keys(clients).length;

    res.json(response);
  });

module.exports = router;
