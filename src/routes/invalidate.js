const _ = require('lodash');
const express = require('express');
const validateHeader = require('../middlewares/headers');
const logger = require('../logger');
const cache = require('../services/cache');
const registry = require('../services/registry');

const router = express.Router();

router.post('/',
  validateHeader('private'),
  async (req, res) => {
    try {
      const token = req.token.project_token;
      const keys = await registry.find(`cache:${token}:*`);
      await Promise.all(_.map(keys, (key) => registry.del(key)));
      await Promise.all(_.map(keys, (key) => cache.delContent(key.replace('cache:', ''))));
      res.json({
        status: 'success',
        token,
        count: keys.length,
      });
    } catch (e) {
      logger.error(e);
      res.json({
        status: 'failed',
      });
    }
  });

module.exports = router;
