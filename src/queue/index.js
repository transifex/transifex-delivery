const path = require('path');
const Queue = require('bull');
const { createClient } = require('../helpers/ioredis');
const logger = require('../logger');
const config = require('../config');
const worker = require('./worker');

const queue = new Queue(config.get('queue:name'), {
  createClient: () => createClient(),
});
let isInitialized = false;

/**
 * Initialize the queue system.
 */
async function initialize(subProcess) {
  if (isInitialized) return;
  isInitialized = true;
  // spawn workers
  const numWorkers = parseInt(config.get('queue:workers'), 10);
  if (numWorkers > 0 && subProcess) {
    logger.info(`Spawning ${numWorkers} workers`);
    queue.process(numWorkers, path.join(__dirname, 'worker.js'));
  } else {
    logger.info('Using internal workers');
    queue.process(worker);
  }
}

/**
 * Add a job in the queue system. If jobId already exists, job will be
 * discarded.
 *
 * @param {String} jobId
 * @param {Object} payload
 */
async function addJob(jobId, payload) {
  await queue.add(payload, {
    jobId,
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 3,
  });
}

/**
 * Check if job exists.
 *
 * @param {String} jobId
 */
async function hasJob(jobId) {
  const job = await queue.getJob(jobId);
  return !!job;
}

/**
 * Return the number of jobs in the queue.
 *
 * @returns {Object}
 */
async function countJobs() {
  const counts = await queue.getJobCounts();
  return counts;
}

module.exports = {
  initialize,
  addJob,
  hasJob,
  countJobs,
};
