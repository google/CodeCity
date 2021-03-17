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

/** @const */
var util = {};

/**
 * @param {*} object
 * @param {?util.inspect.Options=} options
 * @return {string}
 */
util.inspect = function(object, options) {};

/**
 * @const {symbol}
 */
util.inspect.custom;

/**
 * @typedef {{showHidden: (boolean|undefined),
 *            depth: (number|null|undefined),
 *            colors: (boolean|undefined),
 *            customInspect: (boolean|undefined),
 *            showProxy: (boolean|undefined),
 *            maxArrayLength: (number|undefined),
 *            maxStringLength: (number|undefined),
 *            breakLength: (number|undefined),
 *            compact: (boolean|number|undefined),
 *            sorted: (boolean|!Function|undefined)}}
 */
util.inspect.Options;

/**
 * @param {string} format
 * @param {...*} var_args
 * @return {string}
 */
util.format = function(format, var_args) {};

module.exports = util;
