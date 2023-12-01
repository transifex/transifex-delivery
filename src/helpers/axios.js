// globally patch axios with retry logic
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const logger = require('../logger');

// add a default timeout
axios.defaults.timeout = 2 * 60 * 1000; // 2 minutes

// add retry logic
axiosRetry(axios, {
  retryDelay: (retryCount) => {
    logger.info(`Axios retry request #${retryCount}`);
    return retryCount * 1500;
  },
});

module.exports = axios;
