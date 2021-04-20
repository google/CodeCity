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
 * @fileoverview Fake implementation of node.js's net module to
 *     satisfy Closure Compiler dependencies.
 * @author cpcallen@google.com (Christopher Allen)
 */

var Buffer = require('buffer').Buffer;
var events = require('events');

var net = {};

/**
 * @typedef {{allowHalfOpen: ?boolean}}
 */
var createOptions;

/**
 * @param {(createOptions|function(...))=} options
 * @param {function(...)=} connectionListener
 * @return {net.Server}
 */
net.createServer = function(options, connectionListener) {};

/**
 * @typedef {{port: (number|undefined),
 *            host: (string|undefined),
 *            localAddress: (string|undefined),
 *            path: (string|undefined),
 *            allowHalfOpen: (boolean|undefined)}}
 */
var connectOptions;

/**
 * @param {connectOptions|number|string} arg1
 * @param {(function(...)|string)=} arg2
 * @param {function(...)=} arg3
 * @return {!net.Socket}
 */
net.createConnection = function(arg1, arg2, arg3) {};

///////////////////////////////////////////////////////////////////////////////
// net.Server

/**
 * @constructor
 * @struct
 * @param {createOptions=} options
 * @extends {events.EventEmitter}
 */
net.Server = function(options) {};

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

///////////////////////////////////////////////////////////////////////////////
// net.Socket

/**
 * @constructor
 * @struct
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

/**
 * @param {(string|Buffer)=} data
 * @param {(string|function(...))=} encoding
 * @param {function(...)=} callback
 * @return {void}
 */
net.Socket.prototype.end = function(data, encoding, callback) {};

module.exports = net;
