/**
 * @license
 * Copyright 2020 Google LLC
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
 * @fileoverview A priority queue implemented using a heap.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

// Rant: I can't believe I have to write this myself, but a fairly
// extensive search of GitHub and NPM did not turn up an existing
// package that:
//
// - Allowed arbitrary JS values (including objects) in the queue,
// - Does comparison by ===, SameValueZero or SameValue (Object.is)
//   rather than using deepEquals or something equally foolish,
// - Provided a decreasePriority method.

/**
 * Returns the parent index of a given index in a heap.
 * @private
 * @param {number} i Index to get parent of.
 * @return {number} Index of parent, or -1 if i is 0.
 */
function parent(i) {
  if (i <= 0) return -1;
  return Math.floor((i - 1) / 2);
}

/**
 * Returns the child indices of a given index in a heap.
 * @private
 * @param {number} i Index to get children of.
 * @return !Array<number> Two-element array of indicies of the chilren.
 */
function children(i) {
  return [(i * 2) + 1, (i * 2) + 2];
}

/**
 * A priority queue.
 * @stuct
 * @template T
 */
class PriorityQueue {
  constructor() {
   /** @private @const {!Array<{value: T, priority: number}>} */
    this.heap_ = [];
    /** @private @const {!Map<T,number>} */
    this.indices_ = new Map();
  }

  /**
   * Remove the minimum
   * @return {T} The minimum-priority item just removed.
   */
  deleteMin() {
    if (this.heap_.length === 0) {
      throw RangeError('queue is empty');
    }
    const value = this.heap_[0].value;
    this.indices_.delete(value);
    if (this.heap_.length > 1) {
      this.heap_[0] = this.heap_.pop();
      // percolateDown_ will update indices_.
      this.percolateDown_(0);
    } else {
      this.heap_.pop();
    }
    return value;
  }

  /**
   * Insert an item in the queue.
   * @param {T} value The item to be inserted.
   * @param {number} priority The priority value to insert it with.
   * @return {void}
   */
  insert(value, priority) {
    this.set.call(this, value, priority);
  }

  /** @return {number} */
  get length() {
    return this.heap_.length;
  }

  /**
   * Move the entry at .heap_[i] towards the leaves of the heap as
   * required to retain heap ordering.
   * @private
   * @param {number} i Index of node to percolate up.
   */
  percolateDown_(i) {
    const entry = this.heap_[i];
    while (true) {
      const [l, r] = children(i);
      if (l >= this.heap_.length) break;  // No children.
      let c = l;
      if (r < this.heap_.length &&  // Two children.  Pick smallest.
          this.heap_[r].priority < this.heap_[l].priority) {
        c = r;
      }
      if (entry.priority <= this.heap_[c].priority) break;
      this.heap_[i] = this.heap_[c];
      this.indices_.set(this.heap_[c].value, i);
      i = c;
    }
    this.heap_[i] = entry;
    this.indices_.set(entry.value, i);
  }

  /**
   * Move the entry at .heap_[i] towards the root of the heap as
   * required to retain heap ordering.
   * @private
   * @param {number} i Index of node to percolate up.
   */
  percolateUp_(i) {
    const entry = this.heap_[i];
    while (i > 0) {
      const p = parent(i);
      if (this.heap_[p].priority <= entry.priority) break;
      this.heap_[i] = this.heap_[p];
      this.indices_.set(this.heap_[p].value, i);
      i = p;
    }
    this.heap_[i] = entry;
    this.indices_.set(entry.value, i);
  }

  /**
   * Reduce the priority of a given value.
   * @param {T} value The item to be modified.
   * @param {number} priority The new priority value.  Must not be
   *     greater than the existing value.
   * @return {void}
   */
  reducePriority(value, priority) {
    return this.set.call(this, value, priority);
  }

  /**
   * Insert an item into the queue or update its priority.  If the
   * value is already in the queue then priority must not be greater
   * than the previous priority or RangeError will be thrown.
   * @param {T} value The item to be inserted/updated.
   * @param {number} priority The (new) priority for value.
   * @return {void}
   */
  set(value, priority) {
    let i = this.indices_.get(value);
    if (i === undefined) {
      i = this.heap_.length;
      this.heap_.push({value, priority});
    } else if (this.heap_[i].priority < priority) {
      throw new RangeError('attempting to increase priority');
    } else {
      this.heap_[i].priority = priority;
    }
    // percolateUp will set/update this.indices_ entry for value.
    this.percolateUp_(i);
  }
}

exports.PriorityQueue = PriorityQueue;
exports.testOnly = {parent, children};
