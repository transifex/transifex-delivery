const express = require('express');
const { validateHeader } = require('../middlewares/headers');
const utils = require('../helpers/utils');

const router = express.Router();

router.get(
  '/',
  validateHeader('public'),
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
