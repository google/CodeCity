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
 * @suppress {duplicate}
 */
var net = {};

/**
 * @constructor
 */
net.Server = function() {};

/**
 * @return {{port: number, family: string, address: string}}
 */
net.Server.prototype.address;

/**
 * @param {function(...)=} callback
 * @return {void}
 */
net.Server.prototype.close;

/**
 *
 * @param {number|*} port
 * @param {(string|number|function(...))=} host
 * @param {(number|function(...))=} backlog
 * @param {function(...)=} callback
 * @return {void}
 */
net.Server.prototype.listen;

/**
 * @param {string} event
 * @param {function(...)} listener
 * @return {net.Server}
 */
net.Server.prototype.on;

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
