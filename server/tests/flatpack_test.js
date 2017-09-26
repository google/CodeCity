/**
 * @license
 * Flatpack: Unit tests.
 *
 * Copyright 2017 Google Inc.
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
 * @fileoverview Tests for Flatpack serialization library.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const Flatpack = require('../flatpack');

/**
 * Run tests of the networking subsystem.
 * @param {!T} t The test runner object.
 */
exports.testTypeOf = function(t) {
  const cases = [
    ['undefined', 'undefined'],
    ['null', 'null'],
    ['false', 'boolean'],
    ['0', 'number'],
    ["''", 'string'],
    ['Symbol()', 'symbol'],
    ['{}', 'Object'],
    ['function (){}', 'Function'],
    ['Function.prototype', 'Function'],
    ['[]', 'Array'],
    ['Array.prototype', 'Array'],
    ['Object.create(Array.prototype)', 'Object'],
    ['new Boolean', 'Boolean'],
    ['new Number', 'Number'],
    ['new String', 'String'],
    ['Object(Symbol())', 'Symbol'],
    ['/foo/', 'RegExp'],
    ['RegExp.prototype', 'Object'],
    ['new Date', 'Date'],
    ['Date.prototype', 'Object'],
    ['new Set', 'Set'],
  ];
  for (let tc of cases) {
    let name = 'test typeOf(' + tc[0] + ')';
    let r = Flatpack.typeOf(eval('(' + tc[0] + ')'));
    if (r === tc[1]) {
      t.pass(name);
    } else {
      t.fail(name, util.format('Flatpack.typeOf(%s) === %o (expected %o)',
                               tc[0], r, tc[1]));
    }
  }
};
