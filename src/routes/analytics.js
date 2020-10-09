const _ = require('lodash');
const express = require('express');
const md5 = require('md5');
const dayjs = require('dayjs');
const validateHeader = require('../middlewares/headers');
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
  validateHeader('private'),
  async (req, res) => {
    // authenticate
    const serverToken = await registry.get(`analyticsauth:${req.token.project_token}`);
    const clientToken = md5(req.token.original);

    if (!serverToken || (serverToken !== clientToken)) {
      res.status(403).json({
        status: 403,
        message: 'Forbidden',
      });
      return;
    }

    const filterQuery = req.query.filter || {};
    const filterSince = filterQuery.since;
    const filterUntil = filterQuery.until;
    const filterAggregate = filterQuery.aggr || 'day';
    if (!filterSince || !filterUntil) {
      res.status(400).json({
        status: 400,
        message: 'Bad Request',
        details: 'Date filter missing: ?filter[since]=<date>&filter[until]=<date>',
      });
      return;
    }

    if (filterAggregate !== 'day' && filterAggregate !== 'month') {
      res.status(400).json({
        status: 400,
        message: 'Bad Request',
        details: 'Filter aggregate invalid value: ?filter[aggr]=month or ?filter[aggr]=day',
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

    let intervals = 0;
    switch (filterAggregate) {
      case 'month':
        intervals = dateUntil.diff(dateSince, 'months');
        break;
      default:
        intervals = dateUntil.diff(dateSince, 'days');
        break;
    }

    const response = {
      data: [],
      meta: {
      },
    };

    for (let i = 0; i <= intervals; i += 1) {
      let keyDay;
      switch (filterAggregate) {
        case 'month':
          keyDay = dateSince.add(i, 'month').format('YYYY-MM');
          break;
        default:
          keyDay = dateSince.add(i, 'day').format('YYYY-MM-DD');
          break;
      }

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
            const count = await registry.get(key);
            entry.languages[key.replace(`${registryKey}:lang:`, '')] = count;
          })()));
        })(),
        // SDKs
        (async () => {
          const keys = await registry.find(`${registryKey}:sdk:*`);
          await Promise.all(_.map(keys, (key) => (async () => {
            const count = await registry.get(key);
            entry.sdks[key.replace(`${registryKey}:sdk:`, '')] = count;
          })()));
        })(),
        // visitors
        (async () => {
          entry.visitors = await registry.countSet(`${registryKey}:visitors`);
        })(),
      ]);

      response.data.push(entry);
    }

    res.json(response);
  });

module.exports = router;
