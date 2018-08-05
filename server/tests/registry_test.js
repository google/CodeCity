/**
 * @license
 * Code City: Registry tests
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

  // 1: Register obj as 'foo'.
  reg.set('foo', obj);
  t.expect("reg.has('foo')  // 1", reg.has('foo'), true);
  t.expect("reg.get('foo')  // 1", reg.get('foo'), obj);
  t.expect("reg.getKey(obj)  // 1", reg.getKey(obj), 'foo');

  // 2: Register another object as 'foo'.
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
};
