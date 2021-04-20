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
 * @fileoverview Fake implementation of node.js's fs module to satisfy
 *     Closure Compiler dependencies.  This is mostly an excerpt from
 *     contrib/nodejs/fs.js from
 *     https://github.com/google/closure-compiler.git
 * @author cpcallen@google.com (Christopher Allen)
 */

// TODO(cpcallen): Use official externs directly.

var Buffer = require('buffer').Buffer;
var stream = require('stream');

/** @const */
var fs = {};

/**
 * @param {string} path
 * @param {number=} mode
 */
fs.accessSync = function(path, mode) {};

/**
 * @param {number} fd
 * @return {void}
 */
fs.closeSync = function(fd) {};

/**
 * @param {string} path
 * @param {{flags: (string|undefined),
 *          encoding: (string|undefined),
 *          fd: (number|undefined),
 *          mode: (number|undefined),
 *          bufferSize: (number|undefined)}=} options
 * @return {fs.ReadStream}
 */
fs.createReadStream = function(path, options) {};

/**
 * @constructor
 * @struct
 * @extends stream.ReadableStream
 */
fs.ReadStream = function () {};

/**
 * @param {string} path
 * @param {{flags: (string|undefined),
 *          encoding: (string|undefined),
 *          mode: (number|undefined)}=} options
 * @return {fs.WriteStream}
 */
fs.createWriteStream = function(path, options) {};

/**
 * @constructor
 * @struct
 * @extends stream.WritableStream
 */
fs.WriteStream = function () {};

/**
 * @param {string} path
 * @return {boolean}
 */
fs.existsSync = function(path) {};

/**
 * @param {string} path
 * @param {string} flags
 * @param {number=} mode
 * @return {number}
 */
fs.openSync = function(path, flags, mode) {};

/**
 * @param {string} path
 * @return {Array<string>}
 */
fs.readdirSync = function(path) {};

/**
 * @param {string} filename
 * @param {string=} encoding
 * @return {string|Buffer}
 */
fs.readFileSync = function(filename, encoding) {};

/**
 * @param {string} oldPath
 * @param {string} newPath
 * @return {void}
 */
fs.renameSync = function(oldPath, newPath) {};

/**
 * @param {string} path
 * @return {fs.Stats}
 */
fs.statSync = function(path) {};

/**
 * @param {string} path
 * @return {void}
 */
fs.unlinkSync = function(path) {};

/**
 * @param {string} filename
 * @param {*} data
 * @param {string=} encoding
 * @return {void}
 */
fs.writeFileSync = function(filename, data, encoding) {};

/**
 * @param {number} fd
 * @param {string} string
 * @param {number=} position
 * @param {string=} encoding
 * @return {number}
 */
fs.writeSync = function(fd, string, position, encoding) {};
                        
/** @constructor @struct */
fs.Stats = function () {};

/** @return {boolean} */
fs.Stats.prototype.isFile;

/** @return {boolean} */
fs.Stats.prototype.isDirectory;

/** @return {boolean} */
fs.Stats.prototype.isBlockDevice;

/** @return {boolean} */
fs.Stats.prototype.isCharacterDevice;

/** @return {boolean} */
fs.Stats.prototype.isSymbolicLink;

/** @return {boolean} */
fs.Stats.prototype.isFIFO;

/** @return {boolean} */
fs.Stats.prototype.isSocket;

/** @type {number} */
fs.Stats.prototype.dev = 0;

/** @type {number} */
fs.Stats.prototype.ino = 0;

/** @type {number} */
fs.Stats.prototype.mode = 0;

/** @type {number} */
fs.Stats.prototype.nlink = 0;

/** @type {number} */
fs.Stats.prototype.uid = 0;

/** @type {number} */
fs.Stats.prototype.gid = 0;

/** @type {number} */
fs.Stats.prototype.rdev = 0;

/** @type {number} */
fs.Stats.prototype.size = 0;

/** @type {number} */
fs.Stats.prototype.blkSize = 0;

/** @type {number} */
fs.Stats.prototype.blocks = 0;

/** @type {Date} */
fs.Stats.prototype.atime;

/** @type {Date} */
fs.Stats.prototype.mtime;

/** @type {Date} */
fs.Stats.prototype.ctime;

module.exports = fs;
