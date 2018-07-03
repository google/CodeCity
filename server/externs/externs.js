/**
 * @license
 * Code City: Closure Compiler externs for node.js
 *
 * Copyright 2017 Google Inc.
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
 * @fileoverview Closure Compiler externs for node.js
 * @author cpcallen@google.com (Christopher Allen)
 * @externs
 */

/**
 * @param {string} name
 * @return {*}
 */
var require = function(name) {};

/** @type {Object} */
var module = {};

/** @constructor */
function Process() {}

/** @const {Process} */
var process;

/**
 * @param {!Array<number>=} time
 * @return {!Array<number>}
 */
process.hrtime = function(time) {};

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

/**
 * @constructor @struct
 * @param {Iterable<!Array<KEY|VALUE>>|!Array<!Array<KEY|VALUE>>=} iterable
 * @implements {Iterable<!Array<KEY|VALUE>>}
 * @template KEY, VALUE
 * @nosideeffects
 * @suppress {duplicate}
 */
function IterableWeakMap(iterable) {}

/** @return {void} */
IterableWeakMap.prototype.clear = function() {};

/**
 * @param {KEY} key
 * @return {boolean}
 */
IterableWeakMap.prototype.delete = function(key) {};

/**
 * @return {!IteratorIterable<!Array<KEY|VALUE>>}
 * @nosideeffects
 */
IterableWeakMap.prototype.entries = function() {};

/**
 * @param {function(this:THIS, VALUE, KEY, MAP)} callback
 * @param {THIS=} thisArg
 * @this {MAP}
 * @template MAP,THIS
 */
IterableWeakMap.prototype.forEach = function(callback, thisArg) {};

/**
 * @param {KEY} key
 * @return {VALUE}
 * @nosideeffects
 */
IterableWeakMap.prototype.get = function(key) {};

/**
 * @param {KEY} key
 * @return {boolean}
 * @nosideeffects
 */
IterableWeakMap.prototype.has = function(key) {};

/**
 * @return {!IteratorIterable<KEY>}
 * @nosideeffects
 */
IterableWeakMap.prototype.keys = function() {};

/**
 * @param {KEY} key
 * @param {VALUE} value
 * @return {THIS}
 * @this {THIS}
 * @template THIS
 */
IterableWeakMap.prototype.set = function(key, value) {};

/**
 * @type {number}
 * (readonly)
 */
IterableWeakMap.prototype.size;

/**
 * @return {!IteratorIterable<VALUE>}
 * @nosideeffects
 */
IterableWeakMap.prototype.values = function() {};

/**
 * @return {!Iterator<!Array<KEY|VALUE>>}
 */
IterableWeakMap.prototype[Symbol.iterator] = function() {};

/**
 * @constructor @struct
 * @param {Iterable<VALUE>|Array<VALUE>=} opt_iterable
 * @template VALUE
 * @nosideeffects
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
 */
function IterableWeakSet(opt_iterable) {}

/**
 * @param {VALUE} value
 * @return {THIS}
 * @this {THIS}
 * @template THIS
 */
IterableWeakSet.prototype.add = function(value) {};

/**
 * @return {void}
 */
IterableWeakSet.prototype.clear = function() {};

/**
 * @param {VALUE} value
 * @return {boolean}
 */
IterableWeakSet.prototype.delete = function(value) {};

/**
 * @return {!IteratorIterable<!Array<VALUE>>}
 * @nosideeffects
 */
IterableWeakSet.prototype.entries = function() {};

/**
 * @param {function(this:THIS, VALUE, VALUE, SET)} callback
 * @param {THIS=} thisArg
 * @this {SET}
 * @template SET,THIS
 */
IterableWeakSet.prototype.forEach = function(callback, thisArg) {};

/**
 * @param {VALUE} value
 * @return {boolean}
 * @nosideeffects
 */
IterableWeakSet.prototype.has = function(value) {};

/**
 * @return {!IteratorIterable<VALUE>}
 * @nosideeffects
 */
IterableWeakSet.prototype.keys = function() {};

/**
 * @type {number}
 * (readonly)
 */
IterableWeakMap.prototype.size;

/**
 * @return {!IteratorIterable<VALUE>}
 * @nosideeffects
 */
IterableWeakSet.prototype.values = function() {};

/**
 * @return {!Iterator<!Array<VALUE>>}
 */
IterableWeakSet.prototype[Symbol.iterator] = function() {};
