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


tests.ObjectIs = function() {
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

tests.StringBooleanSearchFunctions = function() {
  var str = 'To be, or not to be, that is the question.';

  console.assert(str.includes('To be'), 'Includes "To be"');
  console.assert(str.includes('question'), 'Includes "question"');
  console.assert(!str.includes('nonexistent'), 'Includes "nonexistent"');
  console.assert(!str.includes('To be', 1), 'Includes "To be" (1)');
  console.assert(!str.includes('TO BE'), 'Includes "TO BE"');

  console.assert(str.startsWith('To be'), 'StartsWith "To be"');
  console.assert(!str.startsWith('not to be'), 'StartsWith "not to be"');
  console.assert(str.startsWith('not to be', 10), 'StartsWith "not to be" (10)');

  console.assert(str.endsWith('question.'), 'EndsWith "question."');
  console.assert(!str.endsWith('to be'), 'EndsWith "to be"');
  console.assert(str.endsWith('to be', 19), 'EndsWith "to be" (19)');
};

tests.StringRepeat = function() {
  try {
    'abc'.repeat(-1);
    console.assert(false, 'Repeat Negative');
  } catch (e) {
    console.assert(e.name === 'RangeError',
                   'Repeat Negative Error');
  }
  console.assert('abc'.repeat(0) === '', 'Repeat 0');
  console.assert('abc'.repeat(1) === 'abc', 'Repeat 1');
  console.assert('abc'.repeat(2) === 'abcabc', 'Repeat 2');
  console.assert('abc'.repeat(3.5) === 'abcabcabc', 'Repeat 3.5');
  try {
    'abc'.repeat(1 / 0);
    console.assert(false, 'RegExpPrototypeTestApplyNonRegExpThrows');
  } catch (e) {
    console.assert(e.name === 'RangeError',
                   'RegExpPrototypeTestApplyNonRegExpThrowsError');
  }
};

