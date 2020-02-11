/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Fake implementation of node.js's stream module to
 *     satisfy Closure Compiler dependencies.  This is mostly an
 *     adaptation of contrib/nodejs/stream.js from
 *     https://github.com/google/closure-compiler.git
 * @author cpcallen@google.com (Christopher Allen)
 */

// TODO(cpcallen): Use official externs directly.

var events = require('events');
var Buffer = require('buffer');

/** @const */
var stream = {};

/**
 * @constructor
 * @param {Object=} options
 * @extends events.EventEmitter
 */
stream.Stream = function(options) {};

/**
 * @param {stream.Writable} dest
 * @param {{end: boolean}=} pipeOpts
 * @return {stream.Writable}
 */
stream.Stream.prototype.pipe;

/**
 * @constructor
 * @param {Object=} options
 * @extends stream.Stream
 */
stream.Readable = function(options) {};

/**
 * @type {boolean}
 * @deprecated
 */
stream.Readable.prototype.readable;

/**
 * @protected
 * @param {string|Buffer|null} chunk
 * @return {boolean}
 */
stream.Readable.prototype.push;

/**
 * @param {string|Buffer|null} chunk
 * @return {boolean}
 */
stream.Readable.prototype.unshift;

/**
 * @param {string} enc
 * @return {void}
 */
stream.Readable.prototype.setEncoding;

/**
 * @param {number=} n
 * @return {Buffer|string|null}
 */
stream.Readable.prototype.read;

/**
 * @protected
 * @param {number} n
 * @return {void}
 */
stream.Readable.prototype._read;

/**
 * @param {stream.Writable=} dest
 * @return {stream.Readable}
 */
stream.Readable.prototype.unpipe;

/**
 * @return {void}
 */
stream.Readable.prototype.resume;

/**
 * @return {void}
 */
stream.Readable.prototype.pause;

/**
 * @param {stream.Stream} stream
 * @return {stream.Readable}
 */
stream.Readable.prototype.wrap;

/**
 * @constructor
 * @extends stream.Readable
 */
stream.ReadableStream = function() {};

/**
 * @type {boolean}
 */
stream.ReadableStream.prototype.readable;

/**
 * @param {string=} encoding
 * @return {void}
 */
stream.ReadableStream.prototype.setEncoding;

/**
 * @return {void}
 */
stream.ReadableStream.prototype.destroy;

/**
 * @constructor
 * @param {Object=} options
 * @extends stream.Stream
 */
stream.Writable = function(options) {};

/**
 * @deprecated
 * @type {boolean}
 */
stream.Writable.prototype.writable;

/**
 * @param {string|Buffer} chunk
 * @param {string=} encoding
 * @param {function(*=)=} cb
 * @return {boolean}
 */
stream.Writable.prototype.write;

/**
 * @protected
 * @param {string|Buffer} chunk
 * @param {string} encoding
 * @param {function(*=)} cb
 * @return {void}
 */
stream.Writable.prototype._write;

/**
 * @param {string|Buffer=} chunk
 * @param {string=} encoding
 * @param {function(*=)=} cb
 * @return {void}
 */
stream.Writable.prototype.end;

/**
 * @constructor
 * @extends stream.Writable
 */
stream.WritableStream = function() {};

/**
 * @return {void}
 */
stream.WritableStream.prototype.drain;

/**
 * @type {boolean}
 */
stream.WritableStream.prototype.writable;

/**
 * @param {string|Buffer} buffer
 * @param {string=} encoding
 * @return {void}
 */
stream.WritableStream.prototype.write;

/**
 * @param {string|Buffer=} buffer
 * @param {string=} encoding
 * @param {function(*=)=} cb
 * @return {void}
 */
stream.WritableStream.prototype.end;

/**
 * @return {void}
 */
stream.WritableStream.prototype.destroy;

/**
 * @return {void}
 */
stream.WritableStream.prototype.destroySoon;

/**
 * @constructor
 * @param {Object=} options
 * @extends stream.Readable
 * Xextends stream.Writable
 */
stream.Duplex = function(options) {};

/**
 * @type {boolean}
 */
stream.Duplex.prototype.allowHalfOpen;


/**
 * @param {Object=} options
 * @constructor
 * @extends stream.Duplex
 */
stream.Transform = function(options) {};

/**
 * @protected
 * @param {string|Buffer} chunk
 * @param {string} encoding
 * @param {function(*=)} cb
 * @return {void}
 */
stream.Transform._transform;

/**
 * @protected
 * @param {function(*=)} cb
 * @return {void}
 */
stream.Transform._flush;

/**
 * @param {Object=} options
 * @constructor
 * @extends stream.Transform
 */
stream.PassThrough = function(options) {};

module.exports = stream;
