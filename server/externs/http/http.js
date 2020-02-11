/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Fake implementation of node.js's http module to
 *     satisfy Closure Compiler dependencies.  This is mostly an
 *     adaptation of contrib/nodejs/http.js from
 *     https://github.com/google/closure-compiler.git
 * @author cpcallen@google.com (Christopher Allen)
 */

// TODO(cpcallen): Use official externs directly.

var Buffer = require('buffer');
var events = require('events');
var net = require('net');
var stream = require('stream');

/** @const */
var http = {};

/**
 * @typedef {function(http.IncomingMessage, http.ServerResponse)}
 */
http.requestListener;

/**
 * @param {http.requestListener=} listener
 * @return {http.Server}
 */
http.createServer;

/**
 * @param {http.requestListener=} listener
 * @constructor
 * @extends events.EventEmitter
 */
http.Server = function(listener) {};

/**
 * @param {(number|string)} portOrPath
 * @param {(string|Function)=} hostnameOrCallback
 * @param {Function=} callback
 */
http.Server.prototype.listen;

/**
 * @return {void}
 */
http.Server.prototype.close;

/**
 * @constructor
 * @extends stream.Readable
 */
http.IncomingMessage = function() {};

/**
 * @type {?string}
 * */
http.IncomingMessage.prototype.method;

/**
 * @type {?string}
 */
http.IncomingMessage.prototype.url;

/**
 * @type {Object}
 * */
http.IncomingMessage.prototype.headers;

/**
 * @type {Object}
 * */
http.IncomingMessage.prototype.trailers;

/**
 * @type {string}
 */
http.IncomingMessage.prototype.httpVersion;

/**
 * @type {string}
 */
http.IncomingMessage.prototype.httpVersionMajor;

/**
 * @type {string}
 */
http.IncomingMessage.prototype.httpVersionMinor;

/**
 * @type {*}
 */
http.IncomingMessage.prototype.connection;

/**
 * @type {?number}
 */
http.IncomingMessage.prototype.statusCode;

/**
 * @type {net.Socket}
 */
http.IncomingMessage.prototype.socket;

/**
 * @param {number} msecs
 * @param {function()} callback
 * @return {void}
 */
http.IncomingMessage.prototype.setTimeout;

/**
 * @constructor
 * @extends events.EventEmitter
 * @private
 */
http.ServerResponse = function() {};

/**
 * @return {void}
 */
http.ServerResponse.prototype.writeContinue;

/**
 * @param {number} statusCode
 * @param {*=} reasonPhrase
 * @param {*=} headers
 */
http.ServerResponse.prototype.writeHead;

/**
 * @type {number}
 */
http.ServerResponse.prototype.statusCode;

/**
 * @param {string} name
 * @param {string} value
 * @return {void}
 */
http.ServerResponse.prototype.setHeader;

/**
 * @param {string} name
 * @return {string|undefined} value
 */
http.ServerResponse.prototype.getHeader;

/**
 * @param {string} name
 * @return {void}
 */
http.ServerResponse.prototype.removeHeader;

/**
 * @param {string|Array|Buffer} chunk
 * @param {string=} encoding
 * @return {void}
 */
http.ServerResponse.prototype.write;

/**
 * @param {Object} headers
 * @return {void}
 */
http.ServerResponse.prototype.addTrailers;

/**
 * @param {(string|Array|Buffer)=} data
 * @param {string=} encoding
 * @return {void}
 */
http.ServerResponse.prototype.end;

/**
 * @constructor
 * @extends events.EventEmitter
 * @private
 */
http.ClientRequest = function() {};

/**
 * @param {string|Array|Buffer} chunk
 * @param {string=} encoding
 * @return {void}
 */
http.ClientRequest.prototype.write;

/**
 * @param {(string|Array|Buffer)=} data
 * @param {string=} encoding
 * @return {void}
 */
http.ClientRequest.prototype.end;

/**
 * @return {void}
 */
http.ClientRequest.prototype.abort;

/**
 * @param {string|!Object} urlOrOptions
 * @param {!Object|function(!http.IncomingMessage)=} optionsOrCallback
 * @param {function(!http.IncomingMessage)=} callback
 * @return {http.ClientRequest}
 */
http.request = function(urlOrOptions, optionsOrCallback, callback) {};

/**
 * @param {string|!Object} urlOrOptions
 * @param {!Object|function(!http.IncomingMessage)=} optionsOrCallback
 * @param {function(!http.IncomingMessage)=} callback
 * @return {http.ClientRequest}
 */
http.get = function(urlOrOptions, optionsOrCallback, callback) {};

/**
 * @constructor
 * @extends events.EventEmitter
 */
http.Agent = function() {};

/**
 * @type {number}
 */
http.Agent.prototype.maxSockets;

/**
 * @type {number}
 */
http.Agent.prototype.sockets;

/**
 * @type {Array.<http.ClientRequest>}
 */
http.Agent.prototype.requests;

/**
 * @type {http.Agent}
 */
http.globalAgent;

module.exports = http;
