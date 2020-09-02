const glob = require('glob');
const fs = require('fs');
const _ = require('lodash');
const config = require('../../../../../config');

const DISK_PATH = config.get('settings:disk_storage_path');

/**
 * Read file as json
 *
 * @param {String} path
 * @returns {Object} Json response
 */
function readFileJSON(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(`${DISK_PATH}/${path}`, (err, data) => {
      if (err) return reject();
      return resolve(JSON.parse(data));
    });
  });
}

/**
 * Write json object to file
 *
 * @param {String} path
 * @param {Object} json
 * @returns {Object} Json object
 */
function writeFileJSON(path, json) {
  return new Promise((resolve, reject) => {
    fs.writeFile(`${DISK_PATH}/${path}`, JSON.stringify(json), (err) => {
      if (err) return reject();
      return resolve(json);
    });
  });
}

/**
 * Delete json file
 *
 * @param {String} path
 */
function deleteFileJSON(path) {
  return new Promise((resolve) => {
    fs.unlink(`${DISK_PATH}/${path}`, () => {
      resolve();
    });
  });
}

/**
 * Scan for json files
 */
function findFiles(pattern) {
  return new Promise((resolve, reject) => {
    glob(
      `${DISK_PATH}/${pattern}`,
      (err, files) => {
        if (err) return reject(err);
        return resolve(_.map(files, (file) => file.replace(`${DISK_PATH}/`, '')));
      },
    );
  });
}

module.exports = {
  readFileJSON,
  writeFileJSON,
  deleteFileJSON,
  findFiles,
};
