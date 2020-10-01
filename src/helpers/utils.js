const cache = require('../services/cache');
const queue = require('../queue');
const logger = require('../logger');
const registry = require('../services/registry');
const config = require('../config');

const maxAge = config.get('settings:cache_ttl');
const autoSyncMSec = config.get('settings:autosync_min') * 60 * 1000;

const routerCacheHelper = async (
  req, res, key, syncFunc, ...syncFuncParams
) => {
  // helper function to add sync job once
  let jobAdded = false;
  function addJob() {
    if (jobAdded) return;
    jobAdded = true;
    // refresh data async
    queue.addJob(key, {
      type: 'syncer:pull',
      key,
      token: req.token,
      syncFunc,
      syncFuncParams,
    });
  }

  try {
    const rdata = await registry.get(`cache:${key}`) || {};
    switch (rdata.status) {
      case 'success':
        if (req.header('If-None-Match')
          && req.header('If-None-Match') === rdata.etag
        ) {
          res.status(304)
            .set('ETag', req.header('If-None-Match'))
            .send();
        } else if (rdata.location.startsWith('cache://')) {
          const cdata = await cache.getContent(rdata.location.replace('cache://', ''));
          if (cdata && cdata.data) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('ETag', rdata.etag);
            res.setHeader('Cache-Control', `max-age=${maxAge}`);
            res.send(cdata.data);
          } else {
            res.status(202).send();
            addJob();
          }
        } else {
          res.redirect(rdata.location);
        }
        // check for auto refresh
        if ((Date.now() - rdata.ts) >= autoSyncMSec) {
          addJob();
        }
        break;
      case 'error':
        res.status(rdata.statusCode).send(rdata.statusMessage);
        break;
      default:
        res.status(202).send();
        addJob();
        break;
    }
  } catch (e) {
    logger.error(e);
    res.sendStatus(500);
  }
};

module.exports = {
  routerCacheHelper,
};
