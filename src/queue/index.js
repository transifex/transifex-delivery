const path = require('path');
const Queue = require('bull');
const logger = require('../logger');
const config = require('../config');
const worker = require('./worker');

const queue = new Queue('sync', config.get('redis:host'));
let isInitialized = false;

/**
 * Initialize the queue system.
 */
async function initialize() {
  if (isInitialized) return;
  isInitialized = true;
  // spawn workers
  const numWorkers = parseInt(config.get('workers'), 10);
  if (numWorkers > 0) {
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
 * Return the number of jobs in the queue.
 *
 * @returns {Number}
 */
async function countJobs() {
  const count = await queue.count();
  return count;
}

module.exports = {
  initialize,
  addJob,
  countJobs,
};
