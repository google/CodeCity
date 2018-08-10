/**
 * @license
 * IterableWeakMap
 *
 * Copyright 2018 Google Inc.
 * https://github.com/NeilFraser/CodeCity
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
 * @fileoverview A WeakSet that's iterable.
 * @author cpcallen@google.com (Christohper Allen)
 */
'use strict';

// TODO(cpcallen): Improve (or better: remove) weakref-related type decls.

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
const weak = require('weak');

/**
 * Declared to quiet closure-compiler warnings.
 */
weak.get;

/**
 * A WeakSet implementing the full Set interface, including iterability.
 * @extends {WeakSet}
 * @implements {Iterable<!Array<VALUE>>}
 * @template VALUE
 */
// TODO(cpcallen): Make VALUE a bounded to {!Object} once
// closure-compiler supports bounded generic types
class IterableWeakSet {
  /**
   * @param {Iterable<!Array<VALUE>>|!Array<!Array<VALUE>>=} iterable
   */
  constructor(iterable = undefined) {
    /** @private @const @type {!WeakMap<VALUE,!WeakRef<VALUE>>} */
    this.map_ = new WeakMap();
    /** @private @const @type {!Set<!WeakRef<VALUE>>} */
    this.set_ = new Set();

    if (iterable === null || iterable === undefined) {
      return;
    }
    const adder = this.add;
    if (typeof adder !== 'function') {
      throw new TypeError("'" + this.add + "' returned for property 'add' " +
          'of object ' + this + ' is not a function');
    }
    for (const /** ?Array<VALUE>> */ value of iterable) {
      if (typeof value !== 'object' && typeof value !== 'function' ||
          value === null) {
        throw new TypeError('Iterator value ' + value + ' is not an object');
      }
      adder.call(this, value);
    }
  }

  /**
   * Add the value to the set.
   * @this {THIS}
   * @param {VALUE} value The value to add.
   * @return {THIS}
   * @override
   * @template THIS
   */
  add(value) {
    if (!this.map_.has(value)) {
      const wr = weak(value, () => this.set_.delete(wr));
      this.map_.set(value, wr);
      this.set_.add(wr);
    }
    return this;
  }

  /**
   * Remove all entries from the set.
   * @return {void}
   * @override
   */
  clear() {
    for (const wr of this.set_) {
      const value = weak.get(wr);
      if (value !== undefined) this.delete(value);
    }
  }

  /**
   * Remove a single entry from the set.
   * @param {VALUE} value The value to be deleted.
   * @return {boolean} Was anything deleted?
   * @override
   */
  delete(value) {
    const wr = this.map_.get(value);
    if (wr) {
      this.set_.delete(wr);
    }
    return this.map_.delete(value);
  }

  /**
   * Return a iterator over [value, value] pairs of the set.
   * @return {!IteratorIterable<!Array<VALUE>>}
   */
  *entries() {
    for (const wr of this.set_) {
      const value = weak.get(wr);
      if (value === undefined) {  // value was garbage collected.  Remove wr.
        this.set_.delete(wr);
      } else {
        yield [value, value];
      }
    }
  }

  /**
   * Execute the provided callback for each entry in the set, calling
   * it with thisArg as its this value and argument value (twice) and
   * this set.
   * @this {SET}
   * @param {function(this:THIS, VALUE, VALUE, SET)} callback
   * @param {THIS=} thisArg
   * @return {void}
   * @template SET, THIS
   */
  forEach(callback, thisArg = undefined) {
    for (const value of this.values()) {
      callback.call(thisArg, value, value, this);
    }
  }

  /**
   * Return true iff value is a member of this set.
   * @param {VALUE} value
   * @return {boolean}
   */
  has(value) {
    return this.map_.has(value);
  }
  
  /**
   * @return {number}
   */
  get size() {
    return this.set_.size;
  }

  /**
   * Return an iterator over the value of the set.
   * @return {!IteratorIterable<VALUE>}
   */
  *values() {
    for (const wr of this.set_) {
      const value = weak.get(wr);
      if (value === undefined) {  // value was garbage collected.  Remove wr.
        this.set_.delete(wr);
      } else {
        yield value;
      }
    }
  }
}

IterableWeakSet.prototype[Symbol.iterator] = IterableWeakSet.prototype.entries;
IterableWeakSet.prototype.keys = IterableWeakSet.prototype.values;

module.exports = IterableWeakSet;
