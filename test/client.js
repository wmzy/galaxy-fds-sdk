import fs from 'fs';
import _ from 'lodash/fp';
import should from 'should';
import fetchMock from 'fetch-mock';
import wretch from 'node-wretch';
import Client from '../src/node';

const accessKey = process.env.FDS_APP_KEY;
const secretKey = process.env.FDS_APP_SECRET;
const baseURL = process.env.FDS_BASE_URL;
const bucketName = process.env.FDS_BUCKET;
const objectName = process.env.FDS_OBJECT;

describe('Client', function () {
  beforeEach(function () {
    this.fetchMock = fetchMock.sandbox()
    wretch().polyfills({fetch: this.fetchMock});

    this.client = new Client({
      accessKey,
      secretKey,
      baseURL
    });
    this.bucket = this.client.bucket(bucketName);
    this.fdsObject = this.client.fdsObject(bucketName, objectName);
  })

  it('sign', function () {
    this.client.stringToSign('https://fds.api.xiaomi.com/foo?bar&baz=1&uploadId=1&acl', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Content-MD5': '0412bee1a7bf845f176c5c0d1ae7cf07',
          'X-Xiaomi-Meta-Content-Length': '10',
          'X-Xiaomi-Meta-ACL': 'PUBLIC_READ',
          Date: 'Sat, 30 Dec 2017 00:04:08 GMT'
        }
      })
      .should.be.equal(
        `GET
0412bee1a7bf845f176c5c0d1ae7cf07
application/json
Sat, 30 Dec 2017 00:04:08 GMT
x-xiaomi-meta-acl:PUBLIC_READ
x-xiaomi-meta-content-length:10
/foo?acl&uploadId=1`
      );
  })

  describe('Bucket', function () {
    const urlPrefix = `${baseURL}/${bucketName}`

    it('list buckets', async function () {
      this.fetchMock.get(`${baseURL}?authorizedBuckets`,
        {
          owner: {id: '333'},
          buckets: [
            {creationTime: 0, name: 'xxx', numObjects: 0, orgId: '3334444', usedSpace: 0}
          ]
        }
      );
      await this.client.listBuckets(true);
      this.fetchMock.called().should.be.true();
    });

    it('head bucket', async function () {
      this.fetchMock.head(`${urlPrefix}`,
        {
          owner: {id: '333'},
          buckets: [
            {creationTime: 0, name: 'xxx', numObjects: 0, orgId: '3334444', usedSpace: 0}
          ]
        }
      );
      await this.client.headBucket(bucketName);
      this.fetchMock.called().should.be.true();
      await this.bucket.head();
      twiceRequestShouldBeSame(this.fetchMock);
    });

    it('get bucket meta', async function () {
      this.fetchMock.get(`${urlPrefix}`,
        {
          creationTime: 0,
          name: 'xxx',
          numObjects: 0,
          orgId: '3334444',
          usedSpace: 0
        }
      );
      await this.client.getBucketMeta(bucketName);
      this.fetchMock.called().should.be.true();
      await this.bucket.getMeta();
      twiceRequestShouldBeSame(this.fetchMock);
    });

    it('get bucket acl', async function () {
      this.fetchMock.get(`${urlPrefix}?acl`,
        {
          creationTime: 0,
          name: 'xxx',
          numObjects: 0,
          orgId: '3334444',
          usedSpace: 0
        }
      );
      await this.client.getBucketACL(bucketName);
      this.fetchMock.called().should.be.true();
      await this.bucket.getACL();
      twiceRequestShouldBeSame(this.fetchMock);
    });
  })


  describe('Object', function () {
    const urlPrefix = `${baseURL}/${bucketName}/${objectName}`

    it('list objects', async function () {
      this.fetchMock.get(`${baseURL}/${bucketName}?prefix=`,
      {
        commonPrefixes: [],
        delimiter: "",
        marker: "",
        maxKeys: 1000,
        name: "bn",
        nextMarker: "bn/change-management/20171025/f9f8ja62-0ca4-47cb-8f53-fcc499494ca6",
        objects: [{
          name: "0244c8a0-9c54-406a-8c7d-c62b1a80d9cf",
          owner: {
            id: "22222"
          },
          size: 3,
          uploadTime: 1488248369818
        }],
        prefix: "",
        truncated: true
      }
      );
      await this.client.listObjects(bucketName);
      this.fetchMock.called().should.be.true();
      await this.bucket.listObjects();
      twiceRequestShouldBeSame(this.fetchMock);
    });

    it('get object', async function () {
      this.fetchMock.get(`${urlPrefix}`, 200);
      await this.client.getObject(bucketName, objectName);
      this.fetchMock.called().should.be.true();
      await this.fdsObject.get();
      twiceRequestShouldBeSame(this.fetchMock);
    });
  })
});

function twiceRequestShouldBeSame(fetchMock) {
  const {matched} = fetchMock.calls();
  matched[0].should.be.deepEqual(matched[1]);
}
