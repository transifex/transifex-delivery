![GitHub](https://img.shields.io/github/license/transifex/transifex-delivery)

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

You may also use CURL to get some sample content:
```
curl -X GET -H "Authorization: Bearer 1/066926bd75f0d9e52fce00c2208ac791ca0cd2c1" http://127.0.0.1:10300/languages -v -L

curl -X GET -H "Authorization: Bearer 1/066926bd75f0d9e52fce00c2208ac791ca0cd2c1" http://127.0.0.1:10300/content/en -v -L
```

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

Defaults settings are available in [config/defaults.yml](https://github.com/transifex/transifex-delivery/blob/master/config/defaults.yml).

All settings can be overriden as environment variables, following the pattern:
`TX__[PARENT]__[CHILD]=[VALUE]`

For example, to override the following settings from `defaults.yml`:

```
settings:
  registry: redis
```

You should set the following environment variable:

```
TX__SETTINGS__REGISTRY=dynamodb
```

Please check `defaults.yml` for extensive documentation on the available options.

### Environment variables mapping

You can optionally map system environment variables to the configuration by setting the variables using the `TX__VAR=$ENV_VAR` mapping. For example:

```
export TX__APP__PORT=\$PORT
```

will map the `PORT` environment variable to the `TX__APP__PORT` one.

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
Accept-version: v2

Response status: 202
- Content not ready, queued for download from Transifex
- try again later

Response status: 302
- Get content from URL

Response status: 200
Response body:
{
  "data": [
    {
      "name": "<string>",
      "code": "<string>",
      "localized_name": "<string>",
      "rtl": <boolean>
    },
    { ... }
  ],
  "meta": {
    "source_lang_code": "<string>",
    ...
  }
}
```

### Pull content

Get localized content for a specific language code.

```
GET /content/<lang-code>
GET /content/<lang-code>?filter[tags]=tag1,tag2
GET /content/<lang-code>?filter[status]=translated|reviewed|proofread|finalized

Authorization: Bearer <project-token>
Content-Type: application/json; charset=utf-8
Accept-version: v2

Response status: 202
- Content not ready, queued for download from Transifex
- try again later

Response status: 302
- Get content from URL

Response status: 200
Response body:
{
  "data": {
    "<key>": {
      "string": "<string>"
    }
  },
  "meta": {
    ...
  }
}
```

### Push content

Push source content.

Only one push is allowed per project token at the same time.
Pushing on the same project while another request is in progress will yield an
HTTP 429 error response.

**Purge content**

If `purge: true` in `meta` object, then replace the entire resource content with the pushed content of this request.

If `purge: false` in `meta` object (the default), then append the source content of this request to the existing resource content.

**Replace tags**

If `override_tags: true` in `meta` object, then replace the existing string tags with the tags of this request.

If `override_tags: false` in `meta` object (the default), then append tags from source content to tags of existing strings instead of overwriting them.

**Replace occurrences**

If `override_occurrences: true` in `meta` object, then replace the existing string occurrences with the occurrences of this request.

If `override_occurrences: false` in `meta` object (the default), then append occurrences from source content to occurrences of existing strings instead of overwriting them.

**Keep translations**

if `keep_translations: true` in `meta` object (the default), then preserve translations on source content updates.

if `keep_translations: false` in `meta` object, then delete translations on source string content updates.

**Dry run**

If `dry_run: true` in `meta` object, then emulate a content push, without doing actual changes.

```
POST /content

Authorization: Bearer <project-token>:<secret>
Content-Type: application/json; charset=utf-8
Accept-version: v2

Request body:
{
  "data": {
    "<key>": {
      "string": "<string>",
      "meta": {
        "context": "<string>"
        "developer_comment": "<string>",
        "character_limit": <number>,
        "tags": ["<string>", "<string>", ...],
        "occurrences": ["<string>", "<string>", ...]
      }
    }
    "<key>": { .. }
  },
  "meta": {
    "purge": <boolean>,
    "override_tags": <boolean>,
    "override_occurrences": <boolean>,
    "keep_translations": <boolean>,
    "dry_run": <boolean>
  }
}

Response status: 202
Response body:
{
  "data": {
    "id": "<string>",
    "links": {
      "job": "<string>"
    }
  }
}

Response status: 409
Response body:
{
  "status": 409,
  "message": "Another content upload is already in progress"
}

Response status: 429
Response body:
{
  "status": 429,
  "message": "Too many requests, please try again later."
}
```

### Job status

Get job status for push source content action:
- If "status" field is "pending" or "processing", you should check this endpoint again later
- If "status" field is "failed", then you should check for "errors"
- If "status" field is "completed", then you should check for "details" and "errors"

```
GET /jobs/content/<id>

Authorization: Bearer <project-token>:<secret>
Content-Type: application/json; charset=utf-8
Accept-version: v2

Response status: 200
Response body:
{
  "data": {
    "status": "pending"
  }
}

Response status: 200
Response body:
{
  "data": {
    "status": "processing"
  }
}

Response status: 200
Response body:
{
  "data": {
    "details": {
      "created": <number>,
      "updated": <number>,
      "skipped": <number>,
      "deleted": <number>,
      "failed": <number>
    },
    "errors": [..],
    "status": "completed"
  }
}

Response status: 200
Response body:
{
  "data": {
    "details": {
      "created": <number>,
      "updated": <number>,
      "skipped": <number>,
      "deleted": <number>,
      "failed": <number>
    },
    "errors": [{
      status: "<string>",
      code: "<string>",
      detail: "<string>",
      title: "<string>",
      source: { .. }
    }],
    "status": "failed"
  },
}
```

## Invalidate cache

Endpoint to force cache invalidation for a specific language or for
all project languages. Invalidation triggers background fetch of fresh
content for languages that are already cached in the service.

Returns the number of resources invalidated in the `count` field.

```
POST /invalidate
POST /invalidate/<lang-code>

Authorization: Bearer <project-token>:<secret>
Content-Type: application/json; charset=utf-8
Accept-version: v2

or

Authorization: Bearer <project-token>
X-TRANSIFEX-TRUST-SECRET: <transifex-secret>
Content-Type: application/json; charset=utf-8
Accept-version: v2

Request body:
{}

Response status: 200
Response body (success):
{
  "data": {
    "status": "success",
    "token": "<string>",
    "count": <number>
  },
}

Response status: 500
Response body (fail):
{
  "data": {
    "status": "failed"
  }
}
```

## Purge cache

Endpoint to purge cache for a specific resource content.

Returns the number of resources purged in the `count` field.

```
POST /purge
POST /purge/<lang-code>

Authorization: Bearer <project-token>:<secret>
Content-Type: application/json; charset=utf-8
Accept-version: v2

or

Authorization: Bearer <project-token>
X-TRANSIFEX-TRUST-SECRET: <transifex-secret>
Content-Type: application/json; charset=utf-8
Accept-version: v2

Request body:
{}

Response status: 200
Response body (success):
{
  "data": {
    "status": "success",
    "token": "<string>",
    "count": <number>
  }
}

Response status: 500
Response body (fail):
{
  "data": {
    "status": "failed"
  }
}
```

## Sync strategies

CDS works like a middleware between application SDKs and a place where content lives.
The sync strategy defines where the CDS should push or pull content.

### Transifex (default)

This is the default strategy that syncs content between CDS and Transifex, using Transifex APIv3.

## Cache strategies

Cache strategy defines an abstract interface on how caching work in CDS.
When a request is made to the CDS, the syncer strategy fetches the actual content
(source phrases, translations, available languages), and stores them in a "cache".
How and where the content is stored, is defined by the cache strategy.

### Redis cache (default)

With default settings, CDS stores content in Redis. This can work for testing or
boostraping the service in a production environment, but for real use, it is
advised to use the S3/Cloudfront or Google Cloud Storage strategy.

### S3 cache

S3 strategy stores content in S3 buckets that can be served either directly as
S3 public links or on top of a Cloudfront or other CDN infrastructure.

See "Third Party Integrations" -> "AWS" on how to enable this strategy.

### Google Cloud Storage cache

Google Cloud Storage strategy stores content in Google Cloud.

See "Third Party Integrations" -> "Google Cloud Storage" on how to enable this strategy.

## Registry strategies

Registry is a key/value storage used for storing various metadata required for the service to work.

### Redis strategy (default)

Redis is the default strategy used for the registry engine.

### DynamoDB strategy

DynamoDB strategy uses AWS DynamoDB as a key/value storage. DynamoDB enables multi-region
installation of CDS, using a the DynamoDB global table. For example, you can install CDS
on AWS Regions A, B & C. A global DynamoDB table will ensure that running instances of all
those 3 regions will sync together using active-active replication.

To enable DynamoDB strategy set the following environment variables:
```
TX__SETTINGS__REGISTRY=dynamodb
TX__DYNAMODB__TABLE_NAME=<DYNAMODB GLOBAL TABLE NAME>
```

If the table does not exist, it will be created as local.

You may use AWS CLI to create the table, for example:
```
$ aws dynamodb create-table \
    --table-name transifex-delivery \
    --attribute-definitions AttributeName=key,AttributeType=S \
    --key-schema AttributeName=key,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
```

and enable TTL on "ttl" attribute:
```
$ aws dynamodb update-time-to-live \
    --table-name transifex-delivery \
    --time-to-live-specification Enabled=true,AttributeName=ttl
```

The following AWS permissions should be enabled:
```
dynamodb:DescribeTable
dynamodb:DescribeTimeToLive
dynamodb:UpdateTimeToLive
dynamodb:DescribeLimits
dynamodb:BatchGetItem
dynamodb:BatchWriteItem
dynamodb:DeleteItem
dynamodb:GetItem
dynamodb:GetRecords
dynamodb:PutItem
dynamodb:Query
dynamodb:UpdateItem
dynamodb:Scan
```

### DynamoDB-Redis strategy

This is a hybrid strategy that combines the speed of Redis and the DynamoDB global table for multi-region setups.

To enable, set the following environment variable:
```
TX__SETTINGS__REGISTRY=dynamodb-redis
```

And setup the DynamoDB table by following the instructions of the "DynamoDB" strategy.

## Third party integrations

### AWS

You may use an AWS S3 bucket to store the cached content and optionally set a CDN (e.g. Cloudfront) on top of it to serve the content.

To enable AWS integration you need to ensure that AWS SDK can authenticate by following the [offical docs](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html).

Then, you need to configure some environment variables to enable the integration:

```
TX__SETTINGS__CACHE=s3
TX__CACHE__S3__BUCKET=<name of bucket>
TX__CACHE__S3__ACL="public-read"
TX__CACHE__S3__LOCATION="https://abcd.cloudfront.net/"  (<-- note the trailing slash)
```

The following AWS permissions should be enabled for S3 access:

```
s3:ListBucket
s3:GetBucketLocation
s3:PutObjectAcl
s3:PutObject
s3:GetObjectAcl
s3:GetObject
s3:DeleteObject
```

### Google Cloud Storage

You may use a Google Cloud Storage bucket to store the cached content and optionally set a CDN (e.g. Google CDN) on top of it to serve the content.

To enable GCS integration you need to ensure that Google SDK can authenticate by following the [offical docs](https://www.npmjs.com/package/@google-cloud/storage).

Please make sure that the bucket has the proper permissions and that the account associated with the credentials can read/write/delete in the bucket.

Then, you need to configure some environment variables to enable the integration:

```
TX__SETTINGS__CACHE=gcs
TX__CACHE__GCS__BUCKET=<name of bucket>
TX__CACHE__GCS__LOCATION="https://storage.googleapis.com/<name of bucket>/"  (<-- note the trailing slash)
```

### Azure Storage

You may use an Azure Blob Storage to store the cached content and optionally set a CDN (e.g. Azure CDN) on top of it to serve
the content.

To enable Azure integration you need to ensure that Azure SDK can authenticate by following the [offical docs](https://www.npmjs.com/package/@azure/storage-blob).

Optionally you can set an Azure storage connection string by setting the following environment variable:

```
TX__CACHE__AZURE__CONNECTION_STRING=<azure-storage-connection-string>
```

Then, you need to configure some environment variables to enable the integration:

```
TX__SETTINGS__CACHE=azure
TX__CACHE__AZURE__ACCOUNT=<azure-account-name>
TX__CACHE__AZURE__CONTAINER=<azure-storage-container-name>
TX__CACHE__AZURE__LOCATION="https://<account>.blob.core.windows.net/<container>/"  (<-- note the trailing slash)
```

### Sentry

To integrate with Sentry, provide the appropriate Sentry DSN endpoint as an environment variable:

```
TX__SENTRY__DSN=https://....
```

### NewRelic

To integrate with NewRelic, provide the appropriate license key as an environment variable:

```
TX__NEWRELIC_LICENSE_KEY=<abcd>
```

### Prometheus

Prometheus metrics can be exposed under the `/metrics` endpoint.

To enable Prometheus set the following environment variables:

```
TX__METRICS__ENABLED=1
TX__METRICS__PORT=9090 (default)
```

## Deploying to Production

To run the service on production it is required to have setup the following components:
- Redis server (set using TX__REDIS__HOST env var)
- AWS S3 bucket (optional but recommended)
- AWS Cloudfront on top of S3 or other CDN service (optional but recommended)

Service is available as a Docker image at [Docker Hub](https://hub.docker.com/r/transifex/transifex-delivery).

### Web and workers

By default, the service runs both a web service and a worker on the same container on different threads.
However there is the option to run web and workers as separate containers and
scale them in an infrustructure independently.

To run only the web service use the command:

```
npm run start-web
```

To run only the worker use the command:

```
npm run start-worker
```

### Heroku

For Heroku or other managed services you should map at least the following settings:

```
heroku set:config TX__APP__PORT=\$PORT
heroku set:config TX__REDIS__HOST=\$REDIS_URL
```

# License

Licensed under Apache License 2.0, see [LICENSE](LICENSE) file.
