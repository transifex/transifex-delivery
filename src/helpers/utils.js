const cache = require('../services/cache');
const queue = require('../queue');
const logger = require('../logger');

/**
 * Respond to request using cache payload
 *
 * @param {*} res
 * @param {*} cdata
 */
function cacheResponse(res, cdata) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('ETag', cdata.etag);
  res.setHeader('Cache-Control', `max-age=${cdata.ttl}`);
  res.send(cdata.data);
}

/**
 * Error response
 *
 * @param {*} res
 * @param {*} error
 */
function responseError(res, error) {
  if (error.status) {
    logger.warn(error);
    res.status(error.status).json({
      status: error.status,
      message: error.message,
    });
  } else {
    logger.error(error);
    res.status(500).json({
      status: 500,
      message: 'An error occured!',
    });
  }
}

const routerCacheHelper = async (
  req, res, key, syncFunc, ...syncFuncParams
) => {
  // try to fetch content from cache
  try {
    const cdata = await cache.getContent(key);
    if (cdata.data) {
      //  if we have a cache hit
      if (req.header('If-None-Match')
        && req.header('If-None-Match') === cdata.etag
      ) {
        res.status(304)
          .set('ETag', req.header('If-None-Match'))
          .send();
      } else {
        cacheResponse(res, cdata);
      }
    } else {
      // check for custom status and abort
      const sdata = await cache.getContent(`${key}:status`);
      if (sdata.data) {
        const response = JSON.parse(sdata.data);
        res.status(response.status).json({
          status: response.status,
          message: response.message,
        });
        return;
      }
      // ack, proceed
      res.status(202).send();
    }
    if (cdata.data && cdata.ttl > 0) return;
  } catch (e) {
    responseError(res, e);
  }

  // refresh data async
  queue.addJob(key, {
    type: 'syncer:pull',
    key,
    token: req.token,
    syncFunc,
    syncFuncParams,
  });
};

module.exports = {
  routerCacheHelper,
};
