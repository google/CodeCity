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
 * @fileoverview Closure Compiler externs for node.js, mostly
 *     excerpted from contrib/nodejs/globals.js from
 *     https://github.com/google/closure-compiler.git
 * @author cpcallen@google.com (Christopher Allen)
 * @externs
 */

// TODO(cpcallen): Use official externs directly.

/** @const {string} */
var __filename;

/** @const {string} */
var __dirname;

/** @type {!Object} */
var exports;

/** @param {boolean=} full */
var gc = function(full) {};

/** @type {!Object} */
var module;

/**
 * @param {string} name
 * @return {?}
 */
function require(name) {}

/** @type {!Object} */
require.main;

/**
 * @param {string} request
 * @param {!Object=} options
 * @return {string}
 */
require.resolve = function(request, options) {};

///////////////////////////////////////////////////////////////////////////////
// process

/** @const */
var process = {};

/** @type {string} */
process.arch;

/** @type {!Array<string>} */
process.argv;

/** @return {string} */
process.cwd = function () {};

/** @type {!Object<string, string>} */
process.env;

/** @param {number=} code */
process.exit = function (code) {};

/**
 * @param {!Array<number>=} time
 * @return {!Array<number>}
 */
process.hrtime = function(time) {};

/**
 * @param {number} pid
 * @param {string|number} signal
 */
process.kill = function (pid, signal) {};

/**
 * This is actually inherited from EventEmitter
 *     (===require('events')), but redefined here since
 *     closure-compiler won't let us require() that definition in an
 *     externs file.
 * @param {string|symbol} event
 * @param {function(...)} listener
 */
process.on = function(event, listener) {};

/**
 * Also inherited from EventEmitter.
 * @param {string|symbol} event
 * @param {function(...)} listener
 */
process.once = function(event, listener) {};

/** @type {number} */
process.pid;

/** @type {string} */
process.platform;

/** @type {string} */
process.version;

/** @type {!Object<string>} */
process.versions;
