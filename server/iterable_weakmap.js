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
 * @fileoverview A WeakMap that's iterable.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

/**
 * A (WeakRef<KEY>, value) tuple in an IterableWeakMap.
 * @template KEY, VALUE
 */
class Cell {
  /**
   * @param {!WeakRef<KEY>} ref A WeakRef to the key for this cell.
   * @param {VALUE} value The value for this cell.
   */
  constructor(ref, value) {
    /** @type {!WeakRef<KEY>} */
    this.ref = ref;
    /** @type {VALUE} */
    this.value = value;
  }
}

/**
 * A WeakMap implementing the full Map interface, including iterability.
 * @struct
 * @implements {Iterable<!Array<KEY|VALUE>>}
 * @template KEY, VALUE
 */
// TODO(cpcallen): Make KEY a bounded to {!Object} once
// Closure Compiler supports bounded generic types
class IterableWeakMap extends WeakMap {
  /**
   * @param {!Iterable<!Array<KEY|VALUE>>|!Array<!Array<KEY|VALUE>>=} iterable
   */
  constructor(iterable = undefined) {
    super();
    /** @private @const @type {!Set<!WeakRef<KEY>>} */
    this.refs_ = new Set();
    /**
     * @private @const
     * @type {!FinalizationRegistry<VALUE, !WeakRef<VALUE>, !WeakRef<VALUE>>}
     */
    this.finalisers_ = new FinalizationRegistry(ref => {
      this.refs_.delete(ref);
    });

    if (iterable === null || iterable === undefined) {
      return;
    }
    const adder = this.set;
    if (typeof adder !== 'function') {
      throw new TypeError("'" + this.set + "' returned for property 'set' " +
          'of object ' + this + ' is not a function');
    }
    for (const /** ?Array<KEY|VALUE>> */ entry of iterable) {
      if (typeof entry !== 'object' && typeof entry !== 'function' ||
          entry === null) {
        throw new TypeError(
            'Iterator value ' + entry + ' is not an entry object');
      }
      adder.call(this, entry[0], entry[1]);
    }
  }

  /**
   * Remove all entries from the map.
   * @return {void}
   * @override
   */
  clear() {
    for (const ref of this.refs_) {
      const key = ref.deref();
      if (key !== undefined) this.delete(key);
    }
    this.refs_.clear();  // Remove anything GCed but not finalised.
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
      this.refs_.delete(cell.ref);
      this.finalisers_.unregister(cell.ref);
    }
    return super.delete(key);
  }

  /**
   * Return a iterator over [key, value] pairs of the map.
   * @return {!IteratorIterable<!Array<KEY|VALUE>>}
   */
  *entries() {
    for (const ref of this.refs_) {
      const key = ref.deref();
      if (key === undefined) {  // key was garbage collected.  Remove ref.
        this.refs_.delete(ref);
      } else {
        yield [key, super.get(key).value];
      }
    }
  }

  /**
   * Execute the provided callback for each entry in the map, calling
   * it with thisArg as its this value and arguments key, value and
   * this map.
   * @this {MAP}
   * @param {function(this:THIS, VALUE, KEY, IterableWeakMap<KEY, VALUE>)}
   *     callback
   * @param {THIS=} thisArg
   * @return {void}
   * @template MAP, THIS
   */
  forEach(callback, thisArg = undefined) {
    for (const [key, value] of this) {
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
    return cell && cell.value;
  }

  /**
   * Return an iterator over the keys of the map.
   * @return {!IteratorIterable<KEY>}
   */
  *keys() {
    for (const [key, value] of this) {
      yield key;
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
      const ref = new WeakRef(key);
      const cell = new Cell(ref, value);
      super.set(key, cell);
      this.refs_.add(ref);
      this.finalisers_.register(key, ref, ref);
    }
    return this;
  }

  /**
   * @return {number}
   */
  get size() {
    return this.refs_.size;
  }

  /**
   * Return an iterator over the value of the map.
   * @return {!IteratorIterable<VALUE>}
   */
  *values() {
    for (const [key, value] of this) {
      yield value;
    }
  }
}

IterableWeakMap.prototype[Symbol.iterator] = IterableWeakMap.prototype.entries;

module.exports = IterableWeakMap;
