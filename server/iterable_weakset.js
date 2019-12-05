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
 * @fileoverview A WeakSet that's iterable.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const IterableWeakMap = require('./iterable_weakmap');

/**
 * A WeakSet implementing the full Set interface, including iterability.
 * @struct
 * @extends {WeakSet}
 * @implements {Iterable<!Array<VALUE>>}
 * @template VALUE
 */
// TODO(cpcallen): Make VALUE bounded to {!Object} once
// Closure Compiler supports bounded generic types.
class IterableWeakSet {
  /**
   * @param {!Iterable<!Array<VALUE>>|!Array<!Array<VALUE>>=} iterable
   */
  constructor(iterable = undefined) {
    /** @private @const @type {!IterableWeakMap<VALUE, undefined>}} */
    this.map_ = new IterableWeakMap();

    if (iterable === null || iterable === undefined) {
      return;
    }
    const adder = this.add;
    if (typeof adder !== 'function') {
      throw new TypeError("'" + this.add + "' returned for property 'add' " +
          'of object ' + this + ' is not a function');
    }
    for (const /** !VALUE */ value of iterable) {
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
    this.map_.set(value, undefined);
    return this;
  }

  /**
   * Remove all entries from the set.
   * @return {void}
   * @override
   */
  clear() {
    this.map_.clear();
  }

  /**
   * Remove a single entry from the set.
   * @param {VALUE} value The value to be deleted.
   * @return {boolean} Was anything deleted?
   * @override
   */
  delete(value) {
    return this.map_.delete(value);
  }

  /**
   * Return a iterator over [value, value] pairs of the set.
   * @return {!IteratorIterable<!Array<VALUE>>}
   */
  *entries() {
    for (const [value, ignored] of this.map_) {
      yield [value, value];
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
    for (const value of this) {
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
    return this.map_.size;
  }

  /**
   * Return an iterator over the value of the set.
   * @return {!IteratorIterable<VALUE>}
   */
  *values() {
    for (const [value, ignored] of this.map_) {
      yield value;
    }
  }
}

IterableWeakSet.prototype[Symbol.iterator] = IterableWeakSet.prototype.values;
IterableWeakSet.prototype.keys = IterableWeakSet.prototype.values;

module.exports = IterableWeakSet;
