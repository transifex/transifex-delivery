const express = require('express');

const router = express.Router();

router.get('/:lang_code', async (req, res) => {
  res.send('');
});

router.get('/', async (req, res) => {
  res.send('');
});

module.exports = router;
