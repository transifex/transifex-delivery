[![Build Status](https://travis-ci.org/transifex/transifex-delivery.svg?branch=master)](https://travis-ci.org/transifex/transifex-delivery) ![GitHub](https://img.shields.io/github/license/transifex/transifex-delivery)

# Transifex Content Delivery Service

A service that caches and serves content for Transifex Native app localization.

This project adheres to the Contributor Covenant [code of conduct](CODE_OF_CONDUCT.md).
To contribute to Transifex Content Delivery Service, please check out the [contribution guidelines](CONTRIBUTING.md).

## Installation

To run CDS you need to have Docker and docker-compose installed. All functionality is wrapped around a Makefile that handles building the docker image, running tests and launching the service:

```
make build
make test
make up
```

CDS will be available at `http://localhost:10300` and you can check if it works by visiting `http://localhost:10300/health` endpoint.

### Use an interactive debugger

1. First, make sure the main container is not running:

   ```sh
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
   ```

2. Then, run `make debug`.

3. Open a chrome browser and type `chrome:inspect` in the address bar. Under "remote target", you should see a target for a `./src/index.js` module and an `inspect` link; click it. This will open a window with the developer tools and an active breakpoint on the first line of `./src/index.js`.

4. Press `F8` to let the process continue and thus import and discover all source files.

5. Press ctrl-p to open the file finder, find the file you want and add a breakpoint using the mouse (try the `/health` endpoint in `./src/server.js`). You can also add a `debugger;` statement in your code (temporarily) to add a breakpoint.

6. Try to invoke the breakpoint by sending a request to CDS using curl or whatever. The process should stop, and you will be able to debug the part of the application where the breakpoint is.

_Note: `nodemon` is not running so any changes you make to the source code will not be reflected in the running process. You will need to stop (with `ctrl-c`) and restart the process._

## Environment variables

Defaults settings are available in `config/defaults.yml`.

All settings can be overriden using environment variables such as:

```
# The name of the service and the listening port
TX__APP__NAME=transifex-delivery
TX__APP__PORT=10300

# How long content will be considered "fresh" unless manually invalidated
TX__SETTINGS__CACHE_TTL=5400 (in seconds)

# Upload size limit for pushing content
TX__SETTINGS__REQUEST_SIZE_LIMIT=50mb

# Upload timeout in minutes
TX__SETTINGS__UPLOAD_TIMEOUT_MIN=10

# The path where content will be cached in files
TX__SETTINGS__DISK_STORAGE_PATH=/tmp

# Optionally, a whitelist of project tokens
TX__SETTINGS__TOKEN_WHITELIST=key1,key2

# Syncer strategy (transifex or sandbox)
TX__SETTINGS__SYNCER=transifex

# Cache strategy (disk is the only available option at the moment)
TX__SETTINGS__CACHE=disk

# Redis host
TX__REDIS__HOST=redis://transifex-delivery-redis

# Redis expiration keys
TX__REDIS__EXPIRE_MIN=21600

# Number of workers to process content
TX__WORKERS=1

# If Prometheus metrics should be enabled,
# along with a Prometheus listening port at /metrics endpoint
TX__METRICS__ENABLED=0
TX__METRICS__PORT=9090

# For Sentry integration, provide the appropriate Sentry DSN endpoint
TX__SENTRY__DSN=https://....

# For NewRelic integration, provide the appropriate license key
TX__NEWRELIC_LICENSE_KEY=<abcd>
```

## Service API

CDS exposes a set of HTTPS endpoints to retrieve and push content or invalidate the cache.

### Authentication

Authentication happens through a public project token, that identifies a resource and allows serving of content, and a secret, that can be used for pushing content or other operations that might cause alterations.

All API endpoints authenticate using a `Bearer` token, provided through an `Authorization` header:

```
# Read-only access to resources
Authorization: Bearer <project-token>

# Read-write access to resources
Authorization: Bearer <project-token>:<secret>
```

### Languages

Get a list of languages associated with a content resource.

```
GET /languages

Authorization: Bearer <project-token>
Content-Type: application/json; charset=utf-8

Response status: 202
- Content not ready, queued for download from Transifex
- try again later

Response status: 200
Response body:
{
  "data": [
    {
      "name": "<lang name>",
      "code": "<lang code>",
      "localized_name": "<localized version of name>",
      "rtl": true/false
    },
    { ... }
  ],
  "meta": {
    ...
  }
}
```

### Pull content

Get localized content for a specific language code.

```
GET /content/<lang-code>

Authorization: Bearer <project-token>
Content-Type: application/json; charset=utf-8

Response status: 202
- Content not ready, queued for download from Transifex
- try again later

Response status: 200
Response body:
{
  data: {
    <key>: {
      'string': <string>
    }
  },
  meta: {
    ...
  }
}
```

### Get localization progress

TBD

### Push content

Push source content.

If `purge: true` in `meta` object, then replace the entire resource content with the pushed content of this request.

If `purge: false` in `meta` object (the default), then append the source content of this request to the existing resource content.

```
POST /content

Authorization: Bearer <project-token>:<secret>
Content-Type: application/json; charset=utf-8

Request body:
{
  data: {
    <key>: {
      string: <source string>,
      meta: {
        context: <array>
        developer_comment: <string>,
        character_limit: <number>,
        tags: <array>,
      }
    }
    <key>: { .. }
  },
  meta: {
    purge: <boolean>
  }
}

Response body:
{
  created: <number>,
  updated: <number>,
  skipped: <number>,
  deleted: <number>,
  failed: <number>,
  errors: [..],
}
```

### Push translations (Sandbox only)

Push translations.

```
POST /content/<lang-code>

Authorization: Bearer <project-token>:<secret>
Content-Type: application/json; charset=utf-8

Request body:
{
  data: {
    <key>: {
      string: <source string>,
    }
    <key>: { .. }
  },
}

Response body:
{
  created: <number>,
  updated: <number>,
  skipped: <number>,
  deleted: <number>
  failed: <number>,
  errors: [..],
}
```

## Invalidate cache

Endpoint to force cache invalidation for a specific resource content.

```
POST /invalidate

Authorization: Bearer <project-token>
Content-Type: application/json; charset=utf-8

Request body:
{}

Response body (success):
{
  status: 'success',
  token: <project-token>,
  count: <number of languages uncached>,
}

Response body (fail):
{
  status: 'failed',
}
```

## Sync strategies

CDS works like a middleware between application SDKs and a place where content lives. The sync strategy defines where the CDS should push or pull content.

### Transifex (default)

This is the default strategy that syncs content between CDS and Transifex, using Transifex APIv3.

### Sandbox

A local strategy that can be used as a playground, where data are stored in files within the CDS service.

This strategy is useful for developers that want to try out Transifex native integrations without an account in www.transifex.com.

## Cache strategies

Cache strategy defines an abstract interface on how caching work in CDS. At the moment only redis cache is supported, but the service could be extended with more strategies.

# License

Licensed under Apache License 2.0, see [LICENSE](LICENSE) file.
