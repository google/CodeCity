/**
 * @license
 * IterableWeakMap Tests
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
 * @fileoverview Test for IterableWeakMap.
 * @author cpcallen@google.com (Christohper Allen)
 */
'use strict';

let IterableWeakMap = require('../iterable_weakmap');
let util = require('util');

/**
 * Run some basic tests of IterableWeakMap.
 * @param {!T} t The test runner object.
 */
exports.testIterableWeakMap = function(t) {
  let name = 'IterableWeakMap';

  let assertSame = function(got, want, desc) {
    if (got === want) {
      t.pass(name + ': ' + desc);
    } else {
      t.fail(name + ': ' + desc, util.format('got %o  want %o', got, want));
    }
  };

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

  gc();
  assertSame(iwm.has(obj1), true, 'iwm.has(obj) (after GC)');
  assertSame(iwm.get(obj1), 42, 'iwm.get(obj) (after GC)');
  assertSame(iwm.size, 2, 'iwm.size (after GC)');
  const keys = Array.from(iwm.keys());
  assertSame(keys.length, 2, 'Array.from(iwm.keys()).length');
  assertSame(keys[0], obj1, 'Array.from(iwm.keys())[0]');
  assertSame(keys[1], obj2, 'Array.from(iwm.keys())[1]');

  assertSame(iwm.delete({}), false, 'iwm.delete({})');
  assertSame(iwm.delete(obj2), true, 'iwm.delete(obj)');
  assertSame(iwm.size, 1, 'iwm.size (still)');
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
 * Test for layered collection of IterableWeakMap.
 *
 * When a WeakMap contains a chain of object (i.e., wm.get(o1) === o2,
 * wm.get(o2) === o3, etc.) all should simultaneously be eligible for
 * collection if the 'head' object becomes unreachable.  This test
 * will either pass (if that is true of IterableWeakMap) or issue a
 * warning if it takes several GCs to entierly empty the map.
 * @param {!T} t The test runner object.
 */
exports.testIterableWeakMapLayeredGC = function(t) {
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
    let objs = [{}, {}, {}, {}, {}];
    for (let i = 0; i < objs.length; i++) {
      iwm.set(objs[i], objs[i + 1]);
    }
  })();
    
  const limit = 10;  // objs.length * 2
  let count = 0;
  for (; count < limit && iwm.size > 0; count++) {
    gc();
  }
  
  if (count >= limit) {
    t.fail(name, 'Test failed to terminate in a reasonable time.');
  } else if (count > 1) {
    t.result('WARN', name, 'IterableWeakMap causes layered GC!');
  } else {
    t.pass(name);
  }
};