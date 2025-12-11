const path = require('path');
const Queue = require('bull');
const { createClient } = require('../helpers/ioredis');
const logger = require('../logger');
const config = require('../config');
const worker = require('./worker');

// Always create a new Redis client
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

const TERMINAL_STATES = ['completed', 'failed'];
const MAX_JOB_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Add a job to the queue system.
 *
 * Behavior:
 * - If no job with this jobId exists, create a new job.
 * - If a job with this jobId exists:
 *    - If it's in a terminal state (completed/failed) OR older than MAX_JOB_AGE_MS,
 *      treat it as "zombie/stalled-like", remove it, and create a new job.
 *    - Otherwise, reuse the existing job (no new job is created).
 *
 * @param {String} jobId
 * @param {Object} payload
 * @returns {Promise<Job>} Bull Job instance
 */
async function addJob(jobId, payload) {
  const existing = await queue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();
    const createdAt = existing.timestamp || 0;
    const now = Date.now();
    const ageMs = createdAt ? (now - createdAt) : null;

    logger.info(
      '[queue] Found existing job',
      JSON.stringify({
        jobId,
        state,
        createdAt,
        ageMs,
      }),
    );

    const shouldRemove = (
      TERMINAL_STATES.includes(state)
      && ageMs !== null && ageMs > MAX_JOB_AGE_MS
    );
    if (shouldRemove) {
      logger.error(
        '[queue] Existing job considered zombie (too old)',
        JSON.stringify({
          jobId,
          state,
          ageMs,
          maxAgeMs: MAX_JOB_AGE_MS,
        }),
      );
      logger.info(
        '[queue] Removing existing job before enqueuing new one',
        JSON.stringify({ jobId, state, ageMs }),
      );
      try {
        await existing.remove();
      } catch (error) {
        logger.error('[queue] Error removing existing job', {
          jobId,
          state,
          ageMs,
        });
      }
    }
  }

  const job = await queue.add(payload, {
    jobId,
    removeOnComplete: true,
    removeOnFail: true,
  });
  return job;
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
