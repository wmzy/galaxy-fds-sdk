import _ from 'lodash/fp';
import wretch from 'wretch';

export default class Client {
  constructor({accessKey, secretKey, baseURL} = {}) {
    if (!accessKey || !secretKey || !baseURL) throw new Error('params error');
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.httpClient = wretch(baseURL).middlewares([
      fetch => (url, options = {}) => {
        // url = _.trimCharsEnd('?=')(url).replace(/=(?=&)/g, '')
        const headers = options.headers || {};
        options.headers = headers;
        headers['Date'] = new Date().toGMTString();
        const signature = this.sign(url, options);
        headers['Authorization'] = `Galaxy-V2 ${accessKey}:${signature}`
        return fetch(url, {...options, headers});
      }
    ]);
  }

  bucket(bucketName) {
    return new Bucket(this, bucketName);
  }

  fdsObject(bucketName, objectName) {
    return new FDSObject(this, bucketName, objectName);
  }

  sign(url, options) {
    return this.hmacSha1(this.stringToSign(url, options));
  }

  hmacSha1() {}

  parseURL() {}

  stringToSign(url, {method, headers}) {
    headers = _.mapKeys(_.toLower)(headers);
    return [method,
      headers['content-md5'] || '',
      headers['content-type'] || '',
      headers['date'],
      join('\n')(
        [this.canonicalizedHeaders(headers), this.canonicalizedResource(url)]
      )
    ].join('\n');
  }

  canonicalizedHeaders(headers) {
    return _.pipe(
      _.keys,
      _.filter(_.startsWith('x-xiaomi-')),
      _.sortBy(_.identity),
      _.map(k => `${k}:${headers[k]}`),
      _.join('\n')
    )(headers);
  }

  canonicalizedResource(url) {
    const urlObj = this.parseURL(url);
    const resourceKeys = [
      "acl",
      "quota",
      "uploads",
      "partNumber",
      "uploadId",
      "storageAccessToken",
      "metadata",
    ];
    const searchParams = urlObj.searchParams;
    const qs = _.pipe(
      _.intersection(_.toArray(searchParams.keys())),
      _.sortBy(_.identity),
      _.map(k => join('=')([k, searchParams.get(k)])),
      _.join('&')
    )(resourceKeys);
    return join('?')([urlObj.pathname, qs])
  }

  qs(query) {
    const boolKeys = [];
    const sp = new this.URLSearchParams();
    _.pipe(_.entries, _.forEach(
      ([k, v]) => {
        if (v === true) boolKeys.push(k);
        else if (_.isString(v)) sp.set(k, v);
      }
    ))(query);
    const qs = join('&')([sp.toString(), boolKeys.join('&')])
    return qs ? '?' + qs : '';
  }

  get(url, query, headers) {
    return this.httpClient.url(url + this.qs(query)).headers(headers).get().json();
  }
  post(url, body, query) {
    return this.httpClient.url(url + this.qs(query)).body(body).post().json();
  }
  put(url, body, query, headers = {}) {
    return this.httpClient.url(url + this.qs(query)).body(body).headers(headers).put().json();
  }
  delete(url) {
    return this.httpClient.url(url).delete().json();
  }

  head(url) {
    this.httpClient.url(url).head();
  }

  getEndpoint(region, service) {
    return this.get('', {endpoint: true, region, service});
  }

  // bucket

  listBuckets(authorized) {
    return this.get('', {authorizedBuckets: authorized});
  }

  putBucket(name, acl) {
    return this.put(`/${name}`, null, {'x-xiaomi-meta-acl': _.castArray(acl).join(', ')});
  }

  deleteBucket(name, acl) {
    return this.delete(`/${name}`);
  }

  putBucketACL(name, accessControlPolicy, action) {
    return this.put(`/${name}`, accessControlPolicy, {acl: true, action});
  }

  headBucket(name) {
    return this.head(`/${name}`);
  }

  getBucketMeta(name, option) {
    return this.get(`/${name}`, option);
  }

  getBucketACL(name) {
    return this.get(`/${name}`, {acl: true});
  }

  putBucketACL(name, action, body) {
    return this.put(`/${name}`, body, {acl: true, action});
  }

  // object
  listObjects(bucketName, prefix = '', options = {}) {
    return this.get(`/${bucketName}`, {prefix, ...options})
  }

  getObject(bucketName, objectName, range) {
    return this.httpClient
      .url(`/${bucketName}/${objectName}`)
      .headers({range})
      .get()
      .res()
  }
  getObjectACL(bucketName, objectName) {
    return this.get(`/${bucketName}/${objectName}`, {acl: true});
  }
  putObject(bucketName, objectName, body, expires, headers) {
    return this.put(`/${bucketName}/${objectName}`, body, {expires}, headers);
  }
  postObject(bucketName, body, expires) {
    return this.post(`/${bucketName}`, body, {expires});
  }
  putObjectACL(bucketName, objectName, action, body) {
    return this.put(`/${name}/${objectName}`, body, {acl: true, action});
  }
  deleteObjectACL(bucketName, objectName, action, body) {
    this.putObject(bucketName, objectName, 'delete', body)
  }
  headObject(bucketName, objectName) {
    return this.head(`/${bucketName}/${objectName}`);
  }
  getObjectMeta(bucketName, objectName) {
    return this.head(`/${bucketName}/${objectName}`);
  }
  deleteObject(bucketName, objectName) {
    return this.delete(`/${bucketName}/${objectName}`);
  }
  deleteObjects(bucketName, objects) {
    return this.put(`/${bucketName}?deleteObjects=`, objects);
  }
  restoreObject(bucketName, objectName) {
    return this.put(`/${bucketName}/${objectName}?restore=`);
  }
  renameObject(bucketName, objectName, renameTo) {
    return this.put(`/${bucketName}/${objectName}`, null, {renameTo});
  }
  prefetchObject(bucketName, objectName) {
    return this.put(`/${bucketName}/${objectName}?prefetch=`);
  }
  refreshObject(bucketName, objectName) {
    return this.put(`/${bucketName}/${objectName}?refresh=`);
  }
  initMultiPartUpload(bucketName, objectName) {
    return this.put(`/${bucketName}/${objectName}?uploads=`);
  }
  uploadPart(bucketName, objectName, body, uploadId, partNumber, headers) {
    return this.put(`/${bucketName}/${objectName}`, body, {uploadId, partNumber}, headers);
  }
  completeMultiPartUpload(bucketName, objectName, body, uploadId, expires, headers) {
    return this.put(`/${bucketName}/${objectName}`, body, {uploadId, expires}, headers);
  }
  abortMultiPartUpload(bucketName, objectName, uploadId) {
    return this.delete(`/${bucketName}/${objectName}`, {uploadId});
  }
}

class Bucket {
  constructor(client, name) {
    this.client = client;
    this.name = name;
  }

  putBucket(...rest) {
    return this.client.putBucket(this.name, ...rest)
  }

  delete(...rest) {
    return this.client.deleteBucket(this.name, ...rest)
  }

  putACL(name, ...rest) {
    return this.client.putBucketACL(this.name, ...rest)
  }

  head(name) {
    return this.client.headBucket(this.name)
  }

  getMeta(...rest) {
    return this.client.getBucketMeta(this.name, ...rest)
  }

  getACL() {
    return this.client.getBucketACL(this.name)
  }

  putACL(name, ...rest) {
    return this.client.putBucketACL(this.name, ...rest)
  }

  listObjects(...rest) {
    return this.client.listObjects(this.name, ...rest)
  }

  postObject(...rest) {
    return this.client.postObject(this.name, ...rest)
  }

  deleteObjects(...rest) {
    return this.client.deleteObjects(this.name, ...rest)
  }
}

class FDSObject {
  constructor(client, bucketName, name) {
    this.client = client;
    this.bucket = bucketName;
    this.name = name;
  }

  get(range) {
    return this.client.getObject(this.bucket, this.name, range)
  }

  getACL() {
    return this.client.getObjectACL(this.bucket, this.name)
  }

  putObject(...rest) {
    return this.client.putObject(this.bucket, this.name, ...rest)
  }

  putACL(...rest) {
    return this.client.putObjectACL(this.bucket, this.name, ...rest)
  }

  deleteACL(...rest) {
    return this.client.deleteObjectACL(this.bucket, this.name, ...rest)
  }

  headObject() {
    return this.client.headObject(this.bucket, this.name)
  }

  getMeta() {
    return this.client.getObjectMeta(this.bucket, this.name)
  }

  delete() {
    return this.client.deleteObject(this.bucket, this.name)
  }

  restore() {
    return this.client.restoreObject(this.bucket, this.name)
  }

  rename(newName) {
    return this.client.renameObject(this.bucket, this.name, newName)
  }

  prefetch() {
    return this.client.prefetchObject(this.bucket, this.name)
  }

  refresh() {
    return this.client.refreshObject(this.bucket, this.name)
  }

  initMultiPartUpload() {
    return this.client.initMultiPartUpload(this.bucket, this.name)
  }

  uploadPart(...rest) {
    return this.client.uploadPart(this.bucket, this.name, ...rest)
  }

  completeMultiPartUpload(...rest) {
    return this.client.completeMultiPartUpload(this.bucket, this.name, ...rest)
  }

  abortMultiPartUpload(uploadId) {
    return this.client.completeMultiPartUpload(this.bucket, this.name, uploadId)
  }
}

function join(str) {
  return _.pipe(_.compact, _.join(str))
}

