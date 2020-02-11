/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Fake implementation of node.js's https module to
 *     satisfy Closure Compiler dependencies.  This is mostly an
 *     adaptation of contrib/nodejs/https.js from
 *     https://github.com/google/closure-compiler.git
 * @author cpcallen@google.com (Christopher Allen)
 */

// TODO(cpcallen): Use official externs directly.

var Buffer = require('buffer');
var http = require('http');
var tls = require('tls');

/** @const */
var https = {};

/**
 * @constructor
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
 * @extends http.Agent
 */
https.Agent = function() {};

/**
 * @type {https.Agent}
 */
https.globalAgent;

module.exports = https;
