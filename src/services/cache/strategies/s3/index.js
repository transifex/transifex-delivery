const aws = require('aws-sdk');
const config = require('../../../../config');
const logger = require('../../../../logger');

const bucket = config.get('cache:s3:bucket');
const acl = config.get('cache:s3:acl');
const location = config.get('cache:s3:location');
const maxAge = config.get('cache:s3:max_age');

if (config.get('cache:s3:region')) {
  aws.config.update({
    region: config.get('cache:s3:region'),
  });
}

if (config.get('cache:s3:force_path_style')) {
  aws.config.update({
    s3ForcePathStyle: true,
  });
}

if (config.get('cache:s3:access_key_id') && config.get('cache:s3:secret_access_key')) {
  aws.config.update({
    credentials: {
      accessKeyId: config.get('cache:s3:access_key_id'),
      secretAccessKey: config.get('cache:s3:secret_access_key'),
    },
  });
}

if (config.get('cache:s3:endpoint')) {
  aws.config.update({
    endpoint: config.get('cache:s3:endpoint'),
  });
}

if (config.get('cache:s3:create_bucket')) {
  const s3 = new aws.S3();
  s3.createBucket({
    Bucket: bucket,
  }, (err, data) => {
    if (err) logger.error(err);
    else logger.info(data);
  });
}

/**
 * Convert a user key to S3 key
 *
 * @param {String} key
 * @returns {String}
 */
function keyToS3(key) {
  return `${key}.json`.replace(/:/g, '/');
}

/**
 * @implements {delContent}
 */
function delContent(key) {
  return new Promise((resolve) => {
    const s3 = new aws.S3();
    const options = {
      Bucket: bucket,
      Key: keyToS3(key),
    };
    s3.deleteObject(options, (err) => {
      if (err) {
        logger.warn(`[S3] Cache deletion failed for ${key} key`);
      } else {
        logger.info(`[S3] Cache deleted for ${key} key`);
      }
      resolve();
    });
  });
}

/**
 * @implements {getContent}
 */
function getContent(key) {
  return new Promise((resolve) => {
    const s3 = new aws.S3();
    const options = {
      Bucket: bucket,
      Key: keyToS3(key),
    };
    s3.getObject(options, (err, data) => {
      if (err) {
        resolve({
          data: null,
        });
      } else {
        resolve({
          data: data.Body.toString('utf-8'),
        });
      }
    });
  });
}

/**
 * @implements {setContent}
 */
function setContent(key, data) {
  return new Promise((resolve, reject) => {
    const s3 = new aws.S3();
    const options = {
      Bucket: bucket,
      Key: keyToS3(key),
      Body: data,
      CacheControl: `max-age=${maxAge}`,
      ContentType: 'application/json; charset=utf-8',
      ACL: acl,
    };
    s3.putObject(options, (err) => {
      if (err) {
        logger.error(`[S3] Failed to set cache content for ${key} key`);
        reject(err);
      } else {
        logger.info(`[S3] Cache set for ${key} key`);
        resolve({
          location: `${location}${key}`,
        });
      }
    });
  });
}

module.exports = {
  delContent,
  getContent,
  setContent,
};
