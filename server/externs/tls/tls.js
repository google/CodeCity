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
 * @fileoverview Fake implementation of node.js's tls module to
 *     satisfy Closure Compiler dependencies.  This is mostly an
 *     excerpt of contrib/nodejs/tls.js from
 *     https://github.com/google/closure-compiler.git
 * @author cpcallen@google.com (Christopher Allen)
 */

// TODO(cpcallen): Use official externs directly.

var Buffer = require('buffer').Buffer;
var events = require('events');
var net = require('net');
var stream = require('stream');

/**
 * @const
 */
var tls = {};

/**
 * @constructor
 * @struct
 * @extends stream.Stream
 */
tls.CreateOptions = function () {};

/** @type {boolean} */
tls.CreateOptions.prototype.honorCipherOrder;

/** @type {boolean} */
tls.CreateOptions.prototype.requestCert;

/** @type {boolean} */
tls.CreateOptions.prototype.rejectUnauthorized;

/** @type {Array|Buffer} */
tls.CreateOptions.prototype.NPNProtocols;

/** @type {function(string)} */
tls.CreateOptions.prototype.SNICallback;

/** @type {string} */
tls.CreateOptions.prototype.sessionIdContext;

/**
 *
 * @param {tls.CreateOptions} options
 * @param {function(...)=} secureConnectionListener
 * @return {tls.Server}
 */
tls.createServer;

/**
 * @typedef {{host: string, port: number, socket: *, pfx: (string|Buffer), key: (string|Buffer), passphrase: string, cert: (string|Buffer), ca: Array.<string>, rejectUnauthorized: boolean, NPNProtocols: Array.<string|Buffer>, servername: string}}
 */
tls.ConnectOptions;

/**
 *
 * @param {number|tls.ConnectOptions} port
 * @param {(string|tls.ConnectOptions|function(...))=} host
 * @param {(tls.ConnectOptions|function(...))=} options
 * @param {function(...)=} callback
 * @return {void}
 */
tls.connect = function(port, host, options, callback) {};

// Don't need this yet, and don't have externs for crypto yet.
// /**
//  * @param {crypto.Credentials=} credentials
//  * @param {boolean=} isServer
//  * @param {boolean=} requestCert
//  * @param {boolean=} rejectUnauthorized
//  * @return {tls.SecurePair}
//  */
// tls.createSecurePair;

/**
 * @constructor
 * @struct
 * @extends events.EventEmitter
 */
tls.SecurePair = function() {};

/**
 * @constructor
 * @struct
 * @extends net.Server
 */
tls.Server = function() {};

/**
 * @param {string} hostname
 * @param {string|Buffer} credentials
 * @return {void}
 */
tls.Server.prototype.addContext = function(hostname, credentials) {};

/**
 * @constructor
 * @struct
 * @extends stream.Duplex
 */
tls.CleartextStream = function() {};

/**
 * @type {boolean}
 */
tls.CleartextStream.prototype.authorized;

/**
 * @type {?string}
 */
tls.CleartextStream.prototype.authorizationError;

/**
 * @return {Object.<string,(string|Object.<string,string>)>}
 */
tls.CleartextStream.prototype.getPeerCertificate;

/**
 * @return {{name: string, version: string}}
 */
tls.CleartextStream.prototype.getCipher;

/**
 * @return {{port: number, family: string, address: string}}
 */
tls.CleartextStream.prototype.address;

/**
 * @type {string}
 */
tls.CleartextStream.prototype.remoteAddress;

/**
 * @type {number}
 */
tls.CleartextStream.prototype.remotePort;

module.exports = tls;
