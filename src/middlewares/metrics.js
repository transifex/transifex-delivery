const express = require('express');
const promBundle = require('express-prom-bundle');
const config = require('../config');
const logger = require('../logger');
const queue = require('../queue');

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

  // Custom metrics
  const jobsWaiting = new prometheusClient.Gauge({
    name: `tx_cds_${process.env.NODE_ENV}_jobs_waiting`,
    help: 'Number of jobs with a waiting status',
  });
  const jobsActive = new prometheusClient.Gauge({
    name: `tx_cds_${process.env.NODE_ENV}_jobs_active`,
    help: 'Number of jobs with an active status',
  });
  const jobsDelayed = new prometheusClient.Gauge({
    name: `tx_cds_${process.env.NODE_ENV}_jobs_delayed`,
    help: 'Number of jobs with a delayed status',
  });

  prometheusClient.register.setDefaultLabels({
    application: config.get('app:name'),
    environment: process.env.NODE_ENV,
  });
  metricsApp.get('/metrics', async (req, res) => {
    res.set('Content-Type', prometheusBundle.promClient.register.contentType);

    const counts = await queue.countJobs();
    jobsWaiting.set(counts.waiting);
    jobsActive.set(counts.active);
    jobsDelayed.set(counts.delayed);

    res.end(await prometheusBundle.promClient.register.metrics());
  });

  metricsApp.listen(config.get('metrics:port'), () => {
    logger.info(`Prometheus metrics on port ${config.get('metrics:port')}!`);
  });
}

module.exports = {
  metricsServer, // Create metrics server
  expressRequest, // Register Express middleware
  prometheusClient, // Register custom metrics
};
