/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Fake implementation of node.js's buffer module to
 *     satisfy Closure Compiler dependencies.  This is mostly an
 *     excerpt from contrib/nodejs/buffer.js from
 *     https://github.com/google/closure-compiler.git
 * @author cpcallen@google.com (Christopher Allen)
 */

// TODO(cpcallen): Use official externs directly.

/** @constructor */
var Buffer = function() {};

module.exports = Buffer;
