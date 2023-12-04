const express = require('express');
const { validateHeader } = require('../middlewares/headers');
const utils = require('../helpers/utils');
const { createRateLimiter } = require('../helpers/ratelimit');

const router = express.Router();

router.get(
  '/',
  validateHeader('public'),
  createRateLimiter('pull'),
  async (req, res) => {
    const filter = req.query.filter || {};
    const key = `${req.token.project_token}:languages`;
    utils.routerCacheHelper(
      req,
      res,
      key,
      filter,
      'getLanguages',
    );
  },
);

module.exports = router;
