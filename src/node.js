import crypto from 'crypto';
import {URL, URLSearchParams} from 'url';
import 'node-wretch';
import Client from './client';

Client.prototype.hmacSha1 = function (str) {
  return crypto.createHmac('sha1', this.secretKey)
    .update(str)
    .digest('base64');
}

Client.prototype.parseURL = function (url) {
  return new URL(url);
}

Client.prototype.URLSearchParams = URLSearchParams;

export default Client;
