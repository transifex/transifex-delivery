const _ = require('lodash');
const express = require('express');
const validateHeader = require('../middlewares/headers');
const logger = require('../logger');
const cache = require('../services/cache');

const router = express.Router();

router.post('/',
  validateHeader('private'),
  async (req, res) => {
    try {
      const token = req.token.project_token;
      const keys = await cache.findKeys(`${token}:*`);
      await Promise.all(_.map(keys, (key) => cache.delContent(key)));
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
