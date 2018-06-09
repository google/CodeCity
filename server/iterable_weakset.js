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

const weak = require('weak');

/**
 * Function to clean up dead cells from an IterableWeakSet when a
 * value object has been garbaged collected.
 * @this {!IterableWeakSet} IterableWeakSet to remove GCed value from.
 * @param {!Cell} cell Cell containing GCed value.
 * @return {void}
 */
function cleanup(cell) {
  this.cells_.delete(cell);
}

// TODO(cpcallen): This exists mostly as legacy copied from
// IterableWeakMap, though it does have the useful feature of
// encapsulating the weakref.  Consider removing entirely, and just
// storing weakrefs directly.
/**
 * A wrapper to hold a value weakly in an IterableWeakSet.
 * @template VALUE
 */
class Cell {
  /**
   * @param {!IterableWeakSet} iws Set this cell will belong to (for cleanup).
   * @param {VALUE} value The value for this cell.
   */
  constructor(iws, value) {
    /** @type {!WeakRef<VALUE>} */
    this.wv = weak(value, cleanup.bind(iws, this));
  }

  /**
   * Return the cell's value (as a strong reference).
   * @return {VALUE}
   */
  getValue() {
    return weak.get(this.wv);
  }
}

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
    /** @private @const @type {!WeakMap<VALUE,!Cell>} */
    this.map_ = new WeakMap();
    /** @private @const @type {!Set<!Cell>} */
    this.cells_ = new Set();

    if (iterable === null || iterable === undefined) {
      return;
    }
    const adder = this.add;
    if (typeof adder !== 'function') {
      throw TypeError("'" + this.add + "' returned for property 'add' " +
          'of object ' + this + ' is not a function');
    }
    for (const /** ?Array<VALUE>> */ value of iterable) {
      if (typeof value !== 'object' && typeof value !== 'function' ||
          value === null) {
        throw TypeError('Iterator value ' + value + ' is not an object');
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
      const cell = new Cell(this, value);
      this.map_.set(value, cell);
      this.cells_.add(cell);
    }
    return this;
  }

  /**
   * Remove all entries from the set.
   * @return {void}
   * @override
   */
  clear() {
    for (const cell of this.cells_) {
      const value = cell.getValue();
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
    const cell = this.map_.get(value);
    if (cell) {
      this.cells_.delete(cell);
    }
    return this.map_.delete(value);
  }

  /**
   * Return a iterator over [value, value] pairs of the set.
   * @return {!IteratorIterable<!Array<VALUE>>}
   */
  *entries() {
    for (const cell of this.cells_) {
      const value = cell.getValue();
      if (value === undefined) {  // value was garbage collected.  Remove cell.
        this.cells_.delete(cell);
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
    return this.cells_.size;
  }

  /**
   * Return an iterator over the value of the set.
   * @return {!IteratorIterable<VALUE>}
   */
  *values() {
    for (const cell of this.cells_) {
      const value = cell.getValue();
      if (value === undefined) {  // value was garbage collected.  Remove cell.
        this.cells_.delete(cell);
      } else {
        yield value;
      }
    }
  }
}

IterableWeakSet.prototype[Symbol.iterator] = IterableWeakSet.prototype.entries;
IterableWeakSet.prototype.keys = IterableWeakSet.prototype.values;

module.exports = IterableWeakSet;
