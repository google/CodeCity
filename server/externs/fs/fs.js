/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Fake implementation of node.js's fs module to satisfy
 *     Closure Compiler dependencies.  This is mostly an excerpt from
 *     contrib/nodejs/fs.js from
 *     https://github.com/google/closure-compiler.git
 * @author cpcallen@google.com (Christopher Allen)
 */

// TODO(cpcallen): Use official externs directly.

var Buffer = require('buffer');

/** @const */
var fs = {};

/**
 * @param {string} path
 * @param {number} mode
 */
fs.accessSync = function(path, mode) {};

/**
 * @param {string} path
 * @return {boolean}
 */
fs.existsSync = function(path) {};

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

/** @constructor */
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
