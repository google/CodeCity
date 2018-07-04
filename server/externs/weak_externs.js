/**
 * @license
 * Code City: Closure Compiler externs for node.js
 *
 * Copyright 2018 Google Inc.
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
 * @fileoverview Closure Compiler externs for the weak npm module.
 * @author cpcallen@google.com (Christopher Allen)
 * @externs
 */

/**
 * @constructor
 * @template REF
 */
var WeakRef = function() {};

/**
 * @param {T} obj
 * @param {!Function} callback
 * @return {!WeakRef<T>}
 * @template T
 * @suppress {duplicate}
 */
var weak = function(obj, callback) {};

/**
 * @param {!WeakRef<T>} ref
 * @return {T}
 * @template T
 */
weak.get = function(ref) {};

// TODO(cpcallen): The following declarations exist only to work
// around https://github.com/google/closure-compiler/issues/2932, and
// should be removed once that bug is fixed.

/** @type {!Function} */
var addCallback;

/** @type {!Function} */
var callbacks;

/** @type {!Function} */
var removeCallback;

/** @type {!Function} */
var removeCallbacks;
