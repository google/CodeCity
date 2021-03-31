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
 * @fileoverview Tests for utilities for manipulating JavaScript code.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const {quote, parseString, testOnly} = require('../code');
const {T} = require('./testing');
const util = require('util');

// Unpack test-only exports:
const {count} = testOnly;

/**
 * Unit tests for the count function.
 * @param {!T} t The test runner object.
 */
exports.testCount = function(t) {
  t.expect("count('bobob', 'b')", count('bobob', 'b'), 3);
  t.expect("count('bobob', 'bo')", count('bobob', 'bo'), 2);
  t.expect("count('bobob', 'bob')", count('bobob', 'bob'), 1);
  t.expect("count('bobobob', 'bob')", count('bobobob', 'bob'), 2);
};

/**
 * Unit tests for the quote function.
 * @param {!T} t The test runner object.
 */
exports.testQuote = function(t) {
  const cases = [
    ['foo', "'foo'"],
    ['"Hi", he said.', "'\"Hi\", he said.'"],
    ["Don't.", '"Don\'t."'],
    ['\'"', "'\\'\"'"],
    ['\0\/\b\n\r\t\v\\\x05\u2028\u2029',
         "'\\0/\\b\\n\\r\\t\\v\\\\\\x05\\u2028\\u2029'"],
  ];
  for (const tc of cases) {
    const r = quote(tc[0]);
    t.expect(util.format('quote(%o)', tc[0]), r, tc[1]);
    t.expect(util.format('eval(quote(%o))', tc[0]), eval(r), tc[0]);
  }
};

/**
 * Unit tests for the parseString function.
 * @param {!T} t The test runner object.
 */
exports.testParseString = function(t) {
  const cases = [
    `'foo'`,
    `'"Hi", he said.'`,
    `"\\"Hi\\", he said."`,
    `'Don\\'t.'`,
    `"Don't."`,
    `'\\0 \\' \\" \\/ \\b \\n \\r \\t \\v \\\\ \\x00 \\xfF \\u09aF'`,
  ];
  for (const tc of cases) {
    const r = parseString(tc);
    t.expect(util.format('parseString(%o)', tc), r, eval(tc));
  }

  const badCases = [
    `'foo`,
    `""Hi", he said."`,
    `'Don't.'`,
    `'\\j'`,
    `'\\x0'`,
    `'\\u123'`,
    `'\\x1g'`,
    `'\\x1G'`,
    `'\\u1g00'`,
    `'\\u1G00'`,
    `'\r'`,
    `'\n'`,
    `'\u2028'`,
    `'\u2029'`,
    // Pathological cases that previously caused exponential
    // backtracking.
    `'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
    `"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
  ];
  for (const tc of badCases) {
    try {
      const r = parseString(tc);
      t.fail(util.format('parseString(%o)', tc), "Didn't throw.");
    } catch (e) {
      t.pass(util.format('parseString(%o)', tc));
    }
  }
};
