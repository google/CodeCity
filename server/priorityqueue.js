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
 * A priority queue.  The priority queue stores items of arbitrary
 * type T, each with a corresponding priority of arbitrary type P.
 *
 * The priority values must have the property that they can be divided
 * into a set of equivalence classes which are totally ordered,
 * according to a comparison function compareFn.  The default
 * compareFn compares priority values using <, ===, and >; a custom
 * comparision function, using the same protocol as
 * Array.prototype.sort, may be supplied to the constructor.
 *
 * @stuct
 * @template T, P
 */
class PriorityQueue {
  /**
   * @param {function(P,P):number=} compareFn A function that defines
   *     the sort order of priorities.  Requirements are same as for
   *     the compareFn argument to Array.prototype.sort.  Priorities
   *     will otherwise be compared using <, > and ===.
   */
  constructor(compareFn) {
   /** @private @const {!Array<{item: T, priority: P}>} */
    this.heap_ = [];
    /** @private @const {!Map<T, number>} */
    this.indices_ = new Map();

    if (compareFn) {
      // Override built-in .compareFn_ with method that calls supplied
      // compareFn and checks validity of its return value.
      this.compareFn_ = function(a, b) {
        const c = compareFn(a, b);
        if (typeof c !== 'number' || Number.isNaN(c)) {
          throw new TypeError('compareFn must return non-NaN number');
        }
        return c;
      };
    }
  }

  /**
   * Compare two priorities using <, > and ===.
   *
   * N.B.: This is a consistent comparision function over strings and
   * over numbers (excluding NaN), but is NOT a consistent comparision
   * function over arbitrary JS values.
   * @private
   * @param {P} a
   * @param {P} b
   * @return {number} negative if a<b, positive if a>b, 0 if a===b.
   */
  compareFn_(a, b) {
    if (a === b) return 0;
    if (a > b) return 1;
    if (a < b) return -1;
    throw new TypeError('incomparable priority values');
  }

  /**
   * Remove the item with the minmum priority from the queue and
   * return it.
   * @return {T} The minimum-priority item just removed.
   */
  deleteMin() {
    if (this.heap_.length === 0) {
      throw RangeError('queue is empty');
    }
    const item = this.heap_[0].item;
    this.indices_.delete(item);
    if (this.heap_.length > 1) {
      this.heap_[0] = this.heap_.pop();
      // percolateDown_ will update indices_.
      this.percolateDown_(0);
    } else {
      this.heap_.pop();
    }
    return item;
  }

  /**
   * Insert an item in the queue.
   * @param {T} item The item to be inserted.
   * @param {P} priority The priority value to insert it with.
   * @return {void}
   */
  insert(item, priority) {
    this.set.call(this, item, priority);
  }

  /** @return {number} The number of items in the queue. */
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
    const heap = this.heap_;
    const entry = heap[i];
    while (true) {
      const [l, r] = children(i);
      if (l >= heap.length) break;  // No children.
      let c = l;
      if (r < heap.length &&  // Two children.  Pick smallest.
          this.compareFn_(heap[r].priority, heap[l].priority) < 0) {
        c = r;
      }
      if (this.compareFn_(entry.priority, heap[c].priority) <= 0) break;
      heap[i] = heap[c];
      this.indices_.set(heap[c].item, i);
      i = c;
    }
    heap[i] = entry;
    this.indices_.set(entry.item, i);
  }

  /**
   * Move the entry at .heap_[i] towards the root of the heap as
   * required to retain heap ordering.
   * @private
   * @param {number} i Index of node to percolate up.
   */
  percolateUp_(i) {
    const heap = this.heap_;
    const entry = heap[i];
    while (i > 0) {
      const p = parent(i);
      if (this.compareFn_(heap[p].priority, entry.priority) <= 0) break;
      heap[i] = heap[p];
      this.indices_.set(heap[p].item, i);
      i = p;
    }
    heap[i] = entry;
    this.indices_.set(entry.item, i);
  }

  /**
   * Reduce the priority of a given item.
   * @param {T} item The item to be modified.
   * @param {P} priority The new priority value.  Must not be greater
   *     than the existing value.
   * @return {void}
   */
  reducePriority(item, priority) {
    return this.set.call(this, item, priority);
  }

  /**
   * Insert an item into the queue or update its priority.  If the
   * item is already in the queue then priority must not be greater
   * than the previous priority or RangeError will be thrown.
   * @param {T} item The item to be inserted/updated.
   * @param {P} priority The (new) priority for item.
   * @return {void}
   */
  set(item, priority) {
    let i = this.indices_.get(item);
    if (i === undefined) {
      i = this.heap_.length;
      this.heap_.push({item, priority});
    } else if (this.compareFn_(priority, this.heap_[i].priority) > 0) {
      throw new RangeError('attempting to increase priority');
    } else {
      this.heap_[i].priority = priority;
    }
    // percolateUp will set/update this.indices_ entry for item.
    this.percolateUp_(i);
  }
}

exports.PriorityQueue = PriorityQueue;
exports.testOnly = {parent, children};
