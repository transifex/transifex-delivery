const express = require('express');
const rateLimit = require('express-rate-limit');
const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const { parseHTML } = require('linkedom');
const { TxNativeDOM } = require('@transifex/dom');
const { createNativeInstance, normalizeLocale } = require('@transifex/native');
const { default: Redlock } = require('redlock');
const config = require('../config');
const { validateHeader } = require('../middlewares/headers');
const logger = require('../logger');
const { createClient } = require('../helpers/ioredis');

const limitPushWindowMsec = config.get('limits:push:window_sec') * 1000;
const limitPushMaxReq = config.get('limits:push:max_req') * 1;
const diskPath = config.get('proxy:disk_path');
const maxAgeSec = config.get('proxy:max_age');

const router = express.Router();
const redlock = new Redlock([createClient()]);

function validatePayload(req, res, next) {
  req.form = req.body.data || {};

  if (!req.form.content) {
    res.status(400).json({
      status: 400,
      message: 'Bad Request',
      details: 'Missing "content" field from body',
    });
    return;
  }

  if (!req.form.format) {
    res.status(400).json({
      status: 400,
      message: 'Bad Request',
      details: 'Missing "format" field from body',
    });
    return;
  }

  try {
    let document;
    switch (req.form.format) {
      case 'html':
        document = parseHTML(req.form.content).document;
        break;
      case 'html-fragment':
        document = parseHTML(`<html><body>${req.form.content}</body></html>`).document;
        break;
      default:
        res.status(400).json({
          status: 400,
          message: 'Bad Request',
          details: 'format field must be of type "html" or "html-fragment"',
        });
        return;
    }
    const txdom = new TxNativeDOM();
    txdom.attachDOM(document);
    req.txdom = txdom;
    next();
  } catch (err) {
    logger.error(err);
    res.status(500).json({
      data: {
        status: 'failed',
        message: 'Could not parse HTML',
      },
    });
  }
}

/**
 * Write to cache using Redis lock
 *
 * @param {String} filePath
 * @param {*} json
 */
async function writeToCache(filePath, json) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(json);
    redlock.acquire([filePath], 5000).then((lock) => {
      fs.writeFile(filePath, data, (err) => {
        lock.release();
        if (err) {
          logger.error(err);
          reject(err);
        } else {
          logger.info(`Saving proxy cache: ${filePath}`);
          resolve();
        }
      });
    }).catch(reject);
  });
}

/**
 * Read from cache using Redis lock
 *
 * @param {String} filePath
 * @returns {Object} data
 * @returns {*} data.json
 * @returns {Boolean} data.expired
 */
async function readFromCache(filePath) {
  return new Promise((resolve, reject) => {
    redlock.acquire([filePath], 5000).then((lock) => {
      fs.readFile(filePath, (readErr, data) => {
        lock.release();
        if (readErr) {
          reject(readErr);
          return;
        }
        // read timestamp
        fs.stat(filePath, (statErr, stats) => {
          if (statErr) {
            reject(statErr);
            return;
          }

          try {
            const json = JSON.parse(data);
            const diffSec = Math.abs(new Date() - stats.mtime) / 1000;
            resolve({
              json,
              expired: diffSec > maxAgeSec,
            });
          } catch (err) {
            reject(err);
          }
        });
      });
    }).catch(reject);
  });
}

router.post('/push',
  validateHeader('private'),
  validatePayload,
  rateLimit({
    windowMs: limitPushWindowMsec,
    max: limitPushMaxReq,
    keyGenerator: (req) => req.token.project_token,
    message: {
      status: 429,
      message: 'Too many requests, please try again later.',
    },
  }),
  async (req, res) => {
    const tx = createNativeInstance({
      cdsHost: `${req.protocol}://${req.get('host')}`,
      token: req.token.project_token,
      secret: req.token.project_secret,
    });

    const strings = req.txdom.getStringsJSON({
      occurrences: req.form.occurrences,
      tags: req.form.tags,
    });

    // Push them to Transifex for translation
    try {
      await tx.pushSource(strings, {
        noWait: true,
      });
    } catch (err) {
      if (err.response) {
        // queued
        if (err.response.status !== 409) {
          res.status(err.response.status).json(err.response.data);
          return;
        }
      } else {
        res.status(500).json({
          data: {
            status: 'failed',
            message: 'Could not push content',
          },
        });
        return;
      }
    }

    res.status(202).json({
      data: {
        count: _.keys(strings).length,
      },
    });
  });

router.post('/pull/:lang_code',
  validateHeader('public'),
  validatePayload,
  async (req, res) => {
    const tx = createNativeInstance({
      cdsHost: `${req.protocol}://${req.get('host')}`,
      token: req.token.project_token,
    });

    const langCode = normalizeLocale(req.params.lang_code);
    const filePath = path.join(diskPath,
      `proxy.content.${req.token.project_token.replace(/\//g, '_')}.${langCode}.json`);
    let saveToCache = true;

    // read from cache
    try {
      const data = await readFromCache(filePath);
      tx.cache.update(langCode, data.json);
      saveToCache = false;

      if (data.expired) {
        // update file cache
        const refreshTX = createNativeInstance({
          cdsHost: tx.cdsHost,
          token: tx.token,
        });
        refreshTX.setCurrentLocale(langCode).then(() => {
          // save to file cache
          if (refreshTX.cache.hasTranslations(langCode)) {
            writeToCache(filePath, refreshTX.cache.getTranslations(langCode)).catch(logger.error);
          }
        }).catch(logger.error);
      }
    } catch (err) {
      // pass
    }

    await tx.setCurrentLocale(langCode);
    req.txdom.toLanguage(tx.getCurrentLocale(), tx.t);

    // save to file cache
    if (saveToCache && tx.cache.hasTranslations(langCode)) {
      writeToCache(filePath, tx.cache.getTranslations(langCode)).catch(logger.error);
    }

    let content = '';
    switch (req.form.format) {
      case 'html':
        content = req.txdom.document.toString();
        break;
      case 'html-fragment':
        content = req.txdom.document.body.innerHTML;
        break;
      default:
        break;
    }

    res.json({
      data: {
        format: req.form.format,
        content,
      },
    });
  });

module.exports = router;
