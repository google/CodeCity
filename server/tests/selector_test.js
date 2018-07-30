/**
 * @license
 * Code City: Selectors (tests)
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
 * @fileoverview Test for CSS-style selectors for JS objects.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const Selector = require('../selector');
const {T} = require('./testing');
const util = require('util');

/**
 * Unit tests for Selector
 * @param {!T} t The test runner object.
 */
exports.testSelector = function(t) {
  const cases = [
    ['foo', 1, 'foo', 'foo', 'foo'],
    [['foo'], 1, 'foo', 'foo', 'foo'],

    ['foo.bar', 2, 'foo', 'bar', 'foo.bar'],
    [['foo', 'bar'], 2, 'foo', 'bar', 'foo.bar'],

    [['foo', '42'], 2, 'foo', '42', 'foo[42]'],

    [['foo', 'bar baz'], 2, 'foo', 'bar baz', "foo['bar baz']"],

    [['foo', '"\'"'], 2, 'foo', '"\'"', "foo['\"\\'\"']"],

    [['foo', "'\"'"], 2, 'foo', "'\"'", 'foo["\'\\"\'"]'],

    ['foo.bar.baz', 3, 'foo', 'baz', 'foo.bar.baz'],
    [['foo', 'bar', 'baz'], 3, 'foo', 'baz', 'foo.bar.baz'],
  ];
  for (const tc of cases) {
    const s = new Selector(tc[0]);
    const name = util.format('new Selector(%o)', tc[0]);
    t.expect(name + '.length', s.length, tc[1]);
    t.expect(name + '[0]', s[0], tc[2]);
    t.expect(name + '[/*last*/]', s[s.length - 1], tc[3]);
    t.expect(name + '.toString()', s.toString(), tc[4]);
    t.expect(name + '.toExpr()', s.toExpr(), tc[4]);
  }
};

