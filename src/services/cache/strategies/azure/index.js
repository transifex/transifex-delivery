const { DefaultAzureCredential } = require('@azure/identity');
const { BlobServiceClient } = require('@azure/storage-blob');
const config = require('../../../../config');
const logger = require('../../../../logger');

const accountName = config.get('cache:azure:account');
const containerName = config.get('cache:azure:container');
const connectionString = config.get('cache:azure:connection_string');
const location = config.get('cache:azure:location');

/**
 * A helper method used to read a Node.js readable stream into a Buffer
 *
 * @param {*} readableStream
 * @return {*}
 */
async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

/**
 * Convert a user key to GCS key
 *
 * @param {String} key
 * @returns {String}
 */
function keyToAzure(key) {
  return `${key}.json`.replace(/:/g, '/');
}

/**
 * Create an Azure storage client
 *
 * @return {*}
 */
function createClient() {
  if (connectionString) {
    return BlobServiceClient.fromConnectionString(connectionString);
  }
  return new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  );
}

/**
 * @implements {delContent}
 */
async function delContent(key) {
  try {
    const blobName = keyToAzure(key);
    const containerClient = createClient().getContainerClient(containerName);
    const client = containerClient.getBlobClient(blobName);
    await client.delete({
      deleteSnapshots: 'include',
    });
    logger.info(`[Azure] Cache deleted for ${key} key`);
  } catch (err) {
    logger.warn(`[Azure] Cache deletion failed for ${key} key`);
  }
}

/**
 * @implements {getContent}
 */
async function getContent(key) {
  try {
    const blobName = keyToAzure(key);
    const containerClient = createClient().getContainerClient(containerName);
    const client = containerClient.getBlobClient(blobName);
    const downloadBlockBlobResponse = await client.download();
    const payload = JSON.parse((
      await streamToBuffer(downloadBlockBlobResponse.readableStreamBody)
    ).toString());
    logger.info(`[Azure] Cache get for ${key} key`);
    return {
      data: payload,
    };
  } catch (err) {
    logger.debug(err);
    return {
      data: null,
    };
  }
}

/**
 * @implements {setContent}
 */
async function setContent(key, data) {
  try {
    const content = JSON.stringify(data);
    const blobName = keyToAzure(key);
    const containerClient = createClient().getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.upload(content, content.length);
    logger.info(`[Azure] Cache set for ${key} key`);
    if (location === 'cache://') {
      return {
        location: `${location}${key}`,
      };
    }
    return {
      location: `${location}${blobName}`,
    };
  } catch (err) {
    logger.error(`[Azure] Failed to set cache content for ${key} key`);
    throw err;
  }
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
