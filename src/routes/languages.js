const express = require('express');
const validateHeader = require('../middlewares/headers');
const utils = require('../helpers/utils');

const router = express.Router();

router.get('/',
  validateHeader('public'), async (req, res) => {
    utils.routerCacheHelper(req, res, `${req.token.project_token}:languages`,
      'getLanguages');
  });

module.exports = router;
