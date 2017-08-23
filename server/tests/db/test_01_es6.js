/**
 * @license
 * Code City: Testing code.
 *
 * Copyright 2017 Google Inc.
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
 * @fileoverview Test the ES6 functions of the server.
 * @author fraser@google.com (Neil Fraser)
 */


tests.is = function() {
  console.assert(Object.is('foo', 'foo'), 'equal strings');
  console.assert(Object.is(Array, Array), 'equal objects');

  console.assert(!Object.is('foo', 'bar'), 'unequal strings');
  console.assert(!Object.is([], []), 'unequal objects');

  var test = {a: 1};
  console.assert(Object.is(test, test), 'custom object');

  console.assert(Object.is(null, null), 'null');

  console.assert(!Object.is(0, -0), 'unequal zero');
  console.assert(Object.is(-0, -0), 'negative zero');
  console.assert(Object.is(NaN, 0/0), 'NaN');
};
