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
 * @fileoverview Test for IterableWeakMap.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const util = require('util');

const IterableWeakMap = require('../iterable_weakmap');
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
 * Run some basic tests of IterableWeakMap.
 * @param {!T} t The test runner object.
 */
exports.testIterableWeakMap = async function(t) {
  const name = 'IterableWeakMap';

  const assertSame = function(got, want, desc) {
    t.expect(name + ': ' + desc, got, want);
  };

  assertSame(IterableWeakMap.prototype[Symbol.iterator],
      IterableWeakMap.prototype.entries,
      'prototype[Symbol.iterator] and prototype.entries are the same method');

  const obj1 = {};
  const obj2 = {};
  const iwm = new IterableWeakMap([[obj1, 42], [obj2, 69]]);
  (() => {
    // Sequester obj3 in an IIFE, because just doing tmp = undefined
    // to allow the object to be garbage collected seems to be
    // insufficient.  (Presumably V8 optimises the assignment away.)
    const obj3 = {};
    assertSame(iwm.set(obj3, 105), iwm, 'iwm.set(tmp, 105)');
    assertSame(iwm.get(obj3), 105, 'iwm.get(tmp)');
    assertSame(Array.from(iwm.values()).reduce((x, y) => x + y), 42 + 69 + 105,
        'sum of .values()');
    let count = 0;
    let sum = 0;
    iwm.forEach((v, k, m) => {
      assertSame(m, iwm, 'Map param in iwm.forEach callback');
      count++;
      sum += v;
    });
    assertSame(count, 3, 'Iterations in iwm.forEach callback');
    assertSame(sum, 42 + 69 + 105, 'Sum of values in iwm.forEach callback');
  })();
  assertSame(iwm.get(obj1), 42, 'iwm.get(obj)');
  assertSame(iwm.has(obj1), true, 'iwm.has(obj)');
  assertSame(iwm.has({}), false, 'iwm.has({})');
  assertSame(iwm.size, 3, 'iwm.size');

  await gcAndFinalise();
  
  assertSame(iwm.has(obj1), true, 'iwm.has(obj) (after GC)');
  assertSame(iwm.get(obj1), 42, 'iwm.get(obj) (after GC)');
  assertSame(iwm.size, 2, 'iwm.size (after GC)');
  const keys = Array.from(iwm.keys());
  assertSame(keys.length, 2, 'Array.from(iwm.keys()).length');
  assertSame(keys[0], obj1, 'Array.from(iwm.keys())[0]');
  assertSame(keys[1], obj2, 'Array.from(iwm.keys())[1]');

  assertSame(iwm.delete({}), false, 'iwm.delete({})');
  assertSame(iwm.delete(obj2), true, 'iwm.delete(obj)');
  assertSame(iwm.size, 1, 'iwm.size (after delete)');
  const entries = Array.from(iwm);
  assertSame(entries.length, 1, 'Array.from(iwm).length (after delete)');
  assertSame(entries[0][0], obj1, 'Array.from(iwm)[0][0]');
  assertSame(entries[0][1], 42, 'Array.from(iwm)[0][1]');

  iwm.clear();
  assertSame(iwm.has(obj1), false, 'iwm.has(obj) (after clear)');
  assertSame(iwm.get(obj1), undefined, 'iwm.get(obj) (after clear)');
  assertSame(iwm.size, 0, 'iwm.size (after clear)');
};

/**
 * Test for correct handling of cyclic garbage in IterableWeakMap.
 * @param {!T} t The test runner object.
 */
exports.testIterableWeakMapCyclic = async function(t) {
  const iwm = new IterableWeakMap;
  (() => {
    const objs = [{}, {}, {}];
    iwm.set(objs[0], objs[0]);  // obj[0] is held circularly.
    iwm.set(objs[1], objs[2]);  // obj[1] and [2] are held by each other.
    iwm.set(objs[2], objs[1]);
  })();
  t.expect('IterableWeakMapCyclic: iwm.size (before GC)', iwm.size, 3);

  await gcAndFinalise();

  t.expect('IterableWeakMapCyclic: iwm.size (after GC)', iwm.size, 0);
};

/**
 * Test for layered collection of IterableWeakMap.
 *
 * When a WeakMap contains a chain of object (i.e., wm.get(o1) === o2,
 * wm.get(o2) === o3, etc.) all should simultaneously be eligible for
 * collection if the 'head' object becomes unreachable.  This test
 * will either pass (if that is true of IterableWeakMap) or issue a
 * warning if it takes several GCs to entierly empty the map.
 * @param {!T} t The test runner object.
 */
exports.testIterableWeakMapLayeredGC = async function(t) {
  /* N.B.: This test seems to be deterministic but very sensitive to
   * seemingly insignificant code changes, which can (for no obvious
   * reason, but probably due to some internal optimisations) result
   * in the IterableWeakMap keys not being garbage collected at all.
   *
   * This can be difficult to debug, because e.g. adding a console.log
   * call inside the loop that calls gc() will make the problem go
   * away.
   */
  const name =  'IterableWeakMapLayeredGC';
  const iwm = new IterableWeakMap;

  // Make a chain of entries.
  (() => {
    const objs = [{}, {}, {}, {}, {}];
    for (let i = 0; i < objs.length; i++) {
      iwm.set(objs[i], objs[i + 1]);
    }
  })();

  const limit = 10;  // objs.length * 2
  let count = 0;
  for (; count < limit && iwm.size > 0; count++) {
    await gcAndFinalise();
  }

  if (count >= limit) {
    t.fail(name, 'Test failed to terminate in a reasonable time.');
  } else if (count > 1) {
    t.result('WARN', name,
             'IterableWeakMap causes layered GC! (' + count + ' iterations)');
  } else {
    t.pass(name);
  }
};
