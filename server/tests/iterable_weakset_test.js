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
 * @fileoverview Test for IterableWeakSet.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const util = require('util');

const IterableWeakSet = require('../iterable_weakset');
const {T} = require('./testing');

/**
 * Request garbage collection and cycle the event loop to give
 * finalisers a chance to be run.  No guarantees about either,
 * unfortunately.
 * @return {!Promise<void>}
 */
async function gcAndFinalise() {
  // Cycle event loop to allow finalisers to run.  Need to cycle it
  // once before GC to ensure that WeakRefs can be cleared (their
  // targets can never be cleared in the same turn as the WeakRef was
  // created), then again after to allow finalisers to run.
  await new Promise((res, rej) => setImmediate(res));
  gc();
  await new Promise((res, rej) => setImmediate(res));
}

/**
 * Run some basic tests of IterableWeakSet.
 * @param {!T} t The test runner object.
 */
exports.testIterableWeakSet = async function(t) {
  const name = 'IterableWeakSet';

  const assertSame = function(got, want, desc) {
    t.expect(name + ': ' + desc, got, want);
  };

  assertSame(IterableWeakSet.prototype[Symbol.iterator],
      IterableWeakSet.prototype.values,
      'prototype[Symbol.iterator] and prototype.values are the same method');
  assertSame(IterableWeakSet.prototype.keys, IterableWeakSet.prototype.values,
      'prototype.keys and prototype.values are the same method');

  const obj1 = {x: 42};
  const obj2 = {x: 69};
  const iws = new IterableWeakSet([obj1, obj2]);
  (() => {
    // Sequester obj3 in an IIFE, because just doing tmp = undefined
    // to allow the object to be garbage collected seems to be
    // insufficient.  (Presumably V8 optimises the assignment away.)
    const obj3 = {x: 105};
    assertSame(iws.add(obj3), iws, 'iws.add(tmp)');
    assertSame(iws.has(obj3), true, 'iws.has(tmp)');
    assertSame(
        Array.from(iws.values()).map((obj) => obj.x).toString(),
        '42,69,105', '.x values from .values()');
    let count = 0;
    let sum = 0;
    iws.forEach((v1, v2, s) => {
      assertSame(v1, v2, 'value params in iws.forEach callback');
      assertSame(s, iws, 'Set param in iws.forEach callback');
      count++;
      sum += v1.x;
    });
    assertSame(count, 3, 'Iterations in iws.forEach callback');
    assertSame(sum, 42 + 69 + 105, 'Sum of .x values in iws.forEach callback');
  })();
  assertSame(iws.has(obj1), true, 'iws.has(obj)');
  assertSame(iws.has({}), false, 'iws.has({})');
  assertSame(iws.size, 3, 'iws.size');

  await gcAndFinalise();

  assertSame(iws.has(obj1), true, 'iws.has(obj) (after GC)');
  assertSame(iws.size, 2, 'iws.size (after GC)');
  const keys = Array.from(iws.keys());
  assertSame(keys.length, 2, 'Array.from(iws.keys()).length');
  assertSame(keys[0], obj1, 'Array.from(iws.keys())[0]');
  assertSame(keys[1], obj2, 'Array.from(iws.keys())[1]');

  assertSame(iws.delete({}), false, 'iws.delete({})');
  assertSame(iws.delete(obj2), true, 'iws.delete(obj)');
  assertSame(iws.size, 1, 'iws.size (after delete)');
  const values = Array.from(iws);
  assertSame(values.length, 1, 'Array.from(iws).length (after delete)');
  assertSame(values[0], obj1, 'Array.from(iws)[0]');

  iws.clear();
  assertSame(iws.has(obj1), false, 'iws.has(obj) (after clear)');
  assertSame(iws.size, 0, 'iws.size (after clear)');
};
