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
 * @fileoverview Unit tests for the Registry class.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const Registry = require('../registry');
const {T} = require('./testing');

/**
 * Unit tests for the Interpreter.Registry class.
 * @param {!T} t The test runner object.
 */
exports.testRegistry = function(t) {
  const reg = new Registry;
  const obj = {};

  // 0: Initial condition.
  t.expect("reg.has('foo')  // 0", reg.has('foo'), false);
  try {
    reg.get('foo');
    t.fail("reg.get('foo')  // 0", "Didn't throw.");
  } catch(e) {
    t.pass("reg.get('foo')  // 0");
  }
  t.expect("reg.getKey(obj)  // 0", reg.getKey(obj), undefined);
  t.expect("reg.keys().length  // 0", reg.keys().length, 0);

  // 1: Register obj as 'foo'.
  reg.set('foo', obj);
  t.expect("reg.has('foo')  // 1", reg.has('foo'), true);
  t.expect("reg.get('foo')  // 1", reg.get('foo'), obj);
  t.expect("reg.getKey(obj)  // 1", reg.getKey(obj), 'foo');
  t.expect("reg.keys().length  // 1", reg.keys().length, 1);
  t.expect("reg.keys()[0]  // 1", reg.keys()[0], 'foo');

  // 2: Attempt to register another object as 'foo'.
  try {
    reg.set('foo', {});
    t.fail("reg.set('foo', {})  // 2", "Didn't throw.");
  } catch(e) {
    t.pass("reg.set('foo', {})  // 2");
  }
  t.expect("reg.has('foo')  // 2", reg.has('foo'), true);
  t.expect("reg.get('foo')  // 2", reg.get('foo'), obj);
  t.expect("reg.getKey(obj)  // 2", reg.getKey(obj), 'foo');
  t.expect("reg.getKey({})  // 2", reg.getKey({}), undefined);

  // 3: Attempt to register obj as 'bar'.
  try {
    reg.set('bar', obj);
    t.fail("reg.set('bar', obj)  // 3", "Didn't throw.");
  } catch(e) {
    t.pass("reg.set('bar', obj)  // 3");
  }
  t.expect("reg.has('bar')  // 3", reg.has('bar'), false);
  t.expect("reg.getKey(obj)  // 3", reg.getKey(obj), 'foo');

  // Test iterators.
  // TODO(cpcallen): test with more than one item to iterate over?
  const keys = reg.keys();
  t.expect("reg.keys().length", keys.length, 1);
  t.expect("reg.keys()[0]", keys[0], 'foo');

  const values = reg.values();
  t.expect("reg.values().length", values.length, 1);
  t.expect("reg.values()[0]", values[0], obj);

  const entries = reg.entries();
  t.expect("reg.entries().length", entries.length, 1);
  t.expect("reg.entries()[0][0]", entries[0][0], 'foo');
  t.expect("reg.entries()[0][1]", entries[0][1], obj);
};
