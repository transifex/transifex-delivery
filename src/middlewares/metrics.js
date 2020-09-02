const express = require('express');
const promBundle = require('express-prom-bundle');
const config = require('../config');
const logger = require('../logger');

const isEnabled = config.get('metrics:enabled');
const prometheusBundle = isEnabled ? promBundle({
  includePath: true,
  includeMethod: true,
  autoregister: false, // Do not register the metrics endpoint
  promClient: {
    collectDefaultMetrics: {},
  },
}) : {};

const prometheusClient = isEnabled ? prometheusBundle.promClient : {};

if (isEnabled) {
  prometheusClient.register.setDefaultLabels({
    application: config.get('app:name'),
    environment: process.env.NODE_ENV,
  });
}

/**
 * Express middleware that should be applied before
 * any other middleware
 *
 * @param {*} app
 */
function expressRequest(app) {
  if (!isEnabled) return;
  app.use(prometheusBundle);
}

/**
 * Dedicated server for prometheus metrics data collection
 */
function metricsServer() {
  if (!isEnabled) return;
  const metricsApp = express();
  metricsApp.use('/metrics', prometheusBundle.metricsMiddleware);
  metricsApp.listen(config.get('metrics:port'), () => {
    logger.info(`Prometheus metrics on port ${config.get('metrics:port')}!`);
  });
}

module.exports = {
  metricsServer, // Create metrics server
  expressRequest, // Register Express middleware
  prometheusClient, // Register custom metrics
};
