const express = require('express');
const { createRateLimiter } = require('../helpers/ratelimit');
const { validateHeader, validateAuth } = require('../middlewares/headers');
const registry = require('../services/registry');

const router = express.Router();

router.get(
  '/content/:id',
  validateHeader('trust'),
  createRateLimiter('jobs'),
  validateAuth,
  async (req, res) => {
    const response = await registry.get(`job:status:${req.params.id}`);
    if (response) {
      res.json(response);
    } else {
      res.status(404).json({
        status: 404,
        message: 'Not found',
        details: 'Invalid job id or job expired',
      });
    }
  },
);

module.exports = router;
