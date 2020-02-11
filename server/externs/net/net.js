/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Fake implementation of node.js's net module to
 *     satisfy Closure Compiler dependencies.
 * @author cpcallen@google.com (Christopher Allen)
 */

var Buffer = require('buffer');
var events = require('events');

var net = {};

/**
 * @typedef {{port: (number|undefined),
 *            host: (string|undefined),
 *            localAddress: (string|undefined),
 *            path: (string|undefined),
 *            allowHalfOpen: (boolean|undefined)}}
 */
net.ConnectOptions;

/**
 * @param {net.ConnectOptions|number|string} arg1
 * @param {(function(...)|string)=} arg2
 * @param {function(...)=} arg3
 * @return {!net.Socket}
 */
net.createConnection = function(arg1, arg2, arg3) {};

///////////////////////////////////////////////////////////////////////////////
// net.Server

/**
 * @constructor
 */
net.Server = function() {};

/**
 * @return {{port: number, family: string, address: string}}
 */
net.Server.prototype.address = function() {};

/**
 * @param {function(...)=} callback
 * @return {void}
 */
net.Server.prototype.close = function(callback) {};

/**
 *
 * @param {number|*} port
 * @param {(string|number|function(...))=} host
 * @param {(number|function(...))=} backlog
 * @param {function(...)=} callback
 * @return {void}
 */
net.Server.prototype.listen = function(port, host, backlog, callback) {};

/**
 * @param {string} event
 * @param {function(...)} listener
 * @return {net.Server}
 */
net.Server.prototype.on = function(event, listener) {};

///////////////////////////////////////////////////////////////////////////////
// net.Socket

/**
 * @constructor
 * @param {{fd: ?*, type: ?string, allowHalfOpen: ?boolean}=} options
 * @extends events.EventEmitter
 */
net.Socket = function(options) {};

/**
 * @param {string|Buffer} data
 * @param {(string|function(...))=} encoding
 * @param {function(...)=} callback
 * @return {void}
 */
net.Socket.prototype.write = function(data, encoding, callback) {};

module.exports = net;
