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
 * @fileoverview A WeakMap that's iterable.
 * @author cpcallen@google.com (Christohper Allen)
 */
'use strict';

const weak = require('weak');

/**
 * Function to clean up dead cells from an IterableWeakMap when a key
 * object has been garbaged collected.
 * @this {!IterableWeakMap} IterableWeakMap to remove GCed key from.
 * @param {!Cell} cell Cell containing GCed key.
 * @return {void}
 */
function cleanup(cell) {
  this.cells_.delete(cell);
}

/**
 * A weak-key, value tuple in an IterableWeakMap.
 * @template KEY, VALUE
 */
class Cell {
  /**
   * @param {!IterableWeakMap} iwm Map this cell will belong to (for cleanup).
   * @param {KEY} key The key for this cell.
   * @param {VALUE} value The value for this cell.
   */
  constructor(iwm, key, value) {
    /** @type {!WeakRef<KEY>} */
    this.wk = weak(key, cleanup.bind(iwm, this));
    /** @type {VALUE} */
    this.value = value;
  }

  /**
   * Return the cell's key (as a strong reference).
   * @return {KEY}
   */
  getKey() {
    return weak.get(this.wk);
  }
}

/**
 * A WeakMap implementing the full Map interface, including iterability.
 *
 * BUG(cpcallen): This implementation causes layered collection of
 * chained entries.  That is, if you have N entries in the
 * IterableWeakMap, where key_i === value_i+1, but none of the keys
 * are referenced elsewhere, it will take N garbage collections to
 * completely empty the map.
 * @struct
 * @implements {Iterable<!Array<KEY|VALUE>>}
 * @template KEY, VALUE
 */
// TODO(cpcallen): Make KEY a bounded to {!Object} once
// closure-compiler supports bounded generic types
class IterableWeakMap extends WeakMap {
  /**
   * @param {Iterable<!Array<KEY|VALUE>>|!Array<!Array<KEY|VALUE>>=} iterable
   */
  constructor(iterable = undefined) {
    super();
    /** @private @const @type {!Set<!Cell>} */
    this.cells_ = new Set();

    if (iterable === null || iterable === undefined) {
      return;
    }
    if (typeof this.set !== 'function') {
      throw TypeError("'" + this.set + "' returned for property 'set' " +
          'of object ' + this + ' is not a function');
    }
    for (const /** ?Array<KEY|VALUE>> */ entry of iterable) {
      if (typeof entry !== 'object' && typeof entry !== 'function' ||
          entry === null) {
        throw TypeError('Iterator value ' + entry + ' is not an entry object');
      }
      this.set(entry[0], entry[1]);
    }
  }

  /**
   * Remove all entries from the map.
   * @return {void}
   * @override
   */
  clear() {
    for (const cell of this.cells_) {
      const key = cell.getKey();
      if (key !== undefined) this.delete(key);
    }
  }

  /**
   * Remove a single entry from the map.
   * @param {KEY} key The key to be deleted.
   * @return {boolean} Was anything deleted?
   * @override
   */
  delete(key) {
    const cell = super.get(key);
    if (cell) {
      this.cells_.delete(cell);
    }
    return super.delete(key);
  }

  /**
   * Return a iterator over [key, value] pairs of the map.
   * @return {!IteratorIterable<!Array<KEY|VALUE>>}
   */
  *entries() {
    for (const cell of this.cells_) {
      const key = cell.getKey();
      if (key === undefined) {  // key was garbage collected.  Remove cell.
        this.cells_.delete(cell);
      } else {
        yield [key, cell.value];
      }
    }
  }

  /**
   * Execute the provided callback for each entry in the map, calling
   * it with thisArg as its this value and arguments key, value and
   * this map.
   * @this {MAP}
   * @param {function(this:THIS, VALUE, KEY, MAP)} callback
   * @param {THIS=} thisArg
   * @return {void}
   * @template MAP, THIS
   */
  forEach(callback, thisArg = undefined) {
    for (const [key, value] of this.entries()) {
      callback.call(thisArg, value, key, this);
    }
  }

  /**
   * Return the value corresponding to a given key.
   * @param {KEY} key The key whose corresponding value is desired.
   * @return {VALUE} The value corresponging to key, or undefined if not found.
   * @override
   */
  get(key) {
    const cell = super.get(key);
    return (cell === undefined) ? undefined : cell.value;
  }

  /**
   * Return an iterator over the keys of the map.
   * @return {!IteratorIterable<KEY>}
   */
  *keys() {
    for (const cell of this.cells_) {
      const key = cell.getKey();
      if (key === undefined) {  // key was garbage collected.  Remove cell.
        this.cells_.delete(cell);
      } else {
        yield key;
      }
    }
  }

  /**
   * Add or update the value associated with key in the map.
   * @this {THIS}
   * @param {KEY} key The key to add or update.
   * @param {VALUE} value The new value to associate with key.
   * @return {THIS}
   * @override
   * @template THIS
   */
  set(key, value) {
    if (super.has(key)) {
      super.get(key).value = value;
    } else {
      const cell = new Cell(this, key, value);
      super.set(key, cell);
      this.cells_.add(cell);
    }
    return this;
  }

  /**
   * @return {number}
   */
  get size() {
    return this.cells_.size;
  }

  /**
   * Return an iterator over the value of the map.
   * @return {!IteratorIterable<VALUE>}
   */
  *values() {
    for (const cell of this.cells_) {
      const key = cell.getKey();
      if (key === undefined) {  // key was garbage collected.  Remove cell.
        this.cells_.delete(cell);
      } else {
        yield cell.value;
      }
    }
  }
}

IterableWeakMap.prototype[Symbol.iterator] = IterableWeakMap.prototype.entries;

module.exports = IterableWeakMap;
