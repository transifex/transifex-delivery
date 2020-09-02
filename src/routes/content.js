const express = require('express');
const config = require('../config');
const validateHeader = require('../middlewares/headers');
const syncer = require('../services/syncer/data');
const utils = require('../helpers/utils');
const logger = require('../logger');

const router = express.Router();

const timeoutMsec = config.get('settings:upload_timeout_min') * 60 * 1000;

router.get('/:lang_code',
  validateHeader('public'),
  async (req, res) => {
    utils.routerCacheHelper(
      req, res,
      `${req.token.project_token}:${req.params.lang_code}:content`,
      'getProjectLanguageTranslations', req.params.lang_code,
    );
  });

router.post('/:lang_code',
  validateHeader('private'),
  async (req, res) => {
    req.setTimeout(timeoutMsec);
    try {
      const data = await syncer.pushTranslations(
        { token: req.token }, req.params.lang_code, req.body.data,
      );
      res.json(data);
    } catch (e) {
      if (e.status) {
        res.status(e.status).json({
          status: e.status,
          message: e.message,
          details: e.details,
        });
      } else {
        logger.error(e);
        res.status(500).json({
          status: 500,
          message: 'An error occured!',
        });
      }
    }
  });

router.post('/',
  validateHeader('private'),
  async (req, res) => {
    req.setTimeout(timeoutMsec);
    try {
      const data = await syncer
        .pushSourceContent({ token: req.token }, req.body);

      let status = 200;
      if (data.errors.length) status = 409;

      res.status(status).json(data);
    } catch (e) {
      if (e.status) {
        if (e.status !== 401) logger.error(e);
        res.status(e.status).json({
          status: e.status,
          message: e.message,
          details: e.details,
        });
      } else {
        logger.error(e);
        res.status(500).json({
          status: 500,
          message: 'An error occured!',
        });
      }
    }
  });

module.exports = router;
