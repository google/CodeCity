/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Fake implementation of node.js's https module to
 *     satisfy Closure Compiler dependencies.  This is mostly an
 *     adaptation of contrib/nodejs/https.js from
 *     https://github.com/google/closure-compiler.git
 * @author cpcallen@google.com (Christopher Allen)
 */

// TODO(cpcallen): Use official externs directly.

var Buffer = require('buffer').Buffer;
var http = require('http');
var tls = require('tls');

/** @const */
var https = {};

/**
 * @constructor
 * @struct
 * @extends tls.Server
 */
https.Server = function() {};

/**
 * @param {...*} var_args
 * @return {void}
 */
https.Server.prototype.listen;

/**
 * @param {function()=} callback
 * @return {void}
 */
https.Server.prototype.close;

/**
 * @param {tls.CreateOptions} options
 * @param {function(http.IncomingMessage, http.ServerResponse)=} requestListener
 * @return {!https.Server}
 */
https.createServer;

/**
 * @typedef {{host: ?string, hostname: ?string, port: ?number, method: ?string, path: ?string, headers: ?Object.<string,string>, auth: ?string, agent: ?(https.Agent|boolean), pfx: ?(string|Buffer), key: ?(string|Buffer), passphrase: ?string, cert: ?(string|Buffer), ca: ?Array.<string>, ciphers: ?string, rejectUnauthorized: ?boolean}}
 */
https.ConnectOptions;

/**
 * @param {string|!Object} urlOrOptions
 * @param {!Object|function(!http.IncomingMessage)=} optionsOrCallback
 * @param {function(!http.IncomingMessage)=} callback
 * @return {http.ClientRequest}
 */
https.request = function(urlOrOptions, optionsOrCallback, callback) {};

/**
 * @param {string|!Object} urlOrOptions
 * @param {!Object|function(!http.IncomingMessage)=} optionsOrCallback
 * @param {function(!http.IncomingMessage)=} callback
 * @return {http.ClientRequest}
 */
https.get = function(urlOrOptions, optionsOrCallback, callback) {};

/**
 * @constructor
 * @struct
 * @extends http.Agent
 */
https.Agent = function() {};

/**
 * @type {https.Agent}
 */
https.globalAgent;

module.exports = https;
