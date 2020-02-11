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

/** @const */
var path = {};

/**
 * @param {string} path
 * @return {string}
 */
path.dirname = function(path) {};

/**
 * @param {string} path
 * @return {string}
 */
path.extname = function(path) {};

/**
 * @param {...string} var_args
 * @return {string}
 */
path.join = function(var_args) {};

module.exports = path;
