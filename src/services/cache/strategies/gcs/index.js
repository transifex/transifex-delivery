const { Storage } = require('@google-cloud/storage');
const stream = require('stream');
const config = require('../../../../config');
const logger = require('../../../../logger');

const bucket = config.get('cache:gcs:bucket');
const location = config.get('cache:gcs:location');
const maxAge = config.get('cache:gcs:max_age');

/**
 * Convert a user key to GCS key
 *
 * @param {String} key
 * @returns {String}
 */
function keyToGCS(key) {
  return `${key}.json`.replace(/:/g, '/');
}

/**
 * @implements {delContent}
 */
function delContent(key) {
  return new Promise((resolve) => {
    const storage = new Storage();

    storage.bucket(bucket).file(keyToGCS(key)).delete()
      .then(() => {
        logger.info(`[GCS] Cache deleted for ${key} key`);
        resolve();
      })
      .catch(() => {
        logger.warn(`[GCS] Cache deletion failed for ${key} key`);
        resolve();
      });
  });
}

/**
 * @implements {getContent}
 */
function getContent(key) {
  return new Promise((resolve) => {
    const storage = new Storage();

    storage.bucket(bucket).file(keyToGCS(key)).download()
      .then((data) => {
        logger.info(`[GCS] Cache get for ${key} key`);
        resolve({
          data: data.toString('utf-8'),
        });
      })
      .catch((err) => {
        logger.debug(err);
        resolve({
          data: null,
        });
      });
  });
}

/**
 * @implements {setContent}
 */
function setContent(key, data) {
  return new Promise((resolve, reject) => {
    const storage = new Storage();
    const myBucket = storage.bucket(bucket);
    const file = myBucket.file(keyToGCS(key));

    const passthroughStream = new stream.PassThrough();
    passthroughStream.write(data);
    passthroughStream.end();

    passthroughStream
      .pipe(file.createWriteStream({
        resumable: false,
        metadata: {
          cacheControl: `max-age=${maxAge}`,
          contentType: 'application/json; charset=utf-8',
        },
      }))
      .on('finish', () => {
        logger.info(`[GCS] Cache set for ${key} key`);
        if (location === 'cache://') {
          resolve({
            location: `${location}${key}`,
          });
        } else {
          resolve({
            location: `${location}${keyToGCS(key)}`,
          });
        }
      })
      .on('error', (err) => {
        logger.error(`[GCS] Failed to set cache content for ${key} key`);
        reject(err);
      });
  });
}

/**
 * @implements {init}
 */
async function init() {
  // no-op
}

/**
 * @implements {destroy}
 */
async function destroy() {
  // no-op
}

module.exports = {
  init,
  destroy,
  delContent,
  getContent,
  setContent,
};
