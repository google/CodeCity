/**
 * @license
 * Code City: serialisation to eval-able JS (tests)
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
 * @fileoverview Tests for Saving the state of the interpreter as
 *     eval-able JS.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const {configFromSpec, Do, dump} = require('../dump');
const fs = require('fs');
const Interpreter = require('../interpreter');
const path = require('path');
const Selector = require('../selector');
const {T} = require('./testing');
const util = require('util');

/**
 * Unit tests for the dump function
 * @param {!T} t The test runner object.
 */
exports.testConfigFromSpec = function(t) {
  const cases = [{
    input: [],
    expected: [],
  }, {
    input: [{filename: 'foo', contents: ['a', 'b']}],
    expected: [
      {filename: 'foo',
       contents: [
         {selector: new Selector('a'), do: Do.RECURSE, reorder: false},
         {selector: new Selector('b'), do: Do.RECURSE, reorder: false}
       ],
       rest: false
      }
    ],
  }];
  for (const {input, expected} of cases) {
    const out = configFromSpec(input);
    t.expect(util.format('configFromSpec(%o)', input),
             util.format('%o', out),
             util.format('%o', expected));
  }

  const invalid = [
    undefined,  // Not an array.
    'a string',  // Not an array.
    {object: 'not array'},  // Not an array.
    ['array', 'of', 'strings'],  // Array but not  of objects.
    [{problem: 'no filename'}],  // Is object but has no .filename.
    [{filename: 'foo'}],  // Missing both .contents and .rest.
    [{filename: 'foo', contents: [], rest: 'bar'}],  // .rest not bool.
    [{filename: 'foo', contents: [42]}],  // .contents[0] not an object.
    [{filename: 'foo', contents: [{}]}],  // ... has no .path.
    [{filename: 'foo', contents: [{path: 'bar'}]}],  // ... has no .do.
    [{filename: 'foo', contents: [{path: 'bar', do: 2}]}],  // ... invalid .do.
    [{filename: 'foo', contents: [{path: 'bar', do: 'baz'}]}],  // Ditto.
    [{filename: 'foo',  // .reorder not a boolean.
      contents: [{path: 'bar', do: 'SET', reorder: 'qux'}]}],
    [{filename: 'foo', rest: 42}],  // .rest not a boolean.
    [{filename: 'foo', rest: 'false'}],  // .rest not a boolean.
  ];
  for (const input of invalid) {
    const name = util.format('configFromSpec(%o)', input);
    try {
      configFromSpec(input);
      t.fail(input + " didn't throw");
    } catch (e) {
      if (!(e instanceof TypeError)) {
        t.fail(input + ' threw wrong error', e);
      }
    }
  }
};

/**
 * Unit tests for the dump function
 * @param {!T} t The test runner object.
 */
exports.testDump = function(t) {
  const intrp = new Interpreter();

  // Load tinycore.
  const coreDir = 'tests/tinycore';
  for (const file of fs.readdirSync(coreDir) || []) {
    if (file.match(/^(core|test).*\.js$/)) {
      const filename = path.join(coreDir, file);
      intrp.createThreadForSrc(String(fs.readFileSync(filename, 'utf8')));
      intrp.run();
    }
  }
  intrp.stop();  // Close any listening sockets, so node will exit.

  const specText = fs.readFileSync(path.join(coreDir, 'dump_spec.json'));
  const spec = JSON.parse(String(specText));
  var config = configFromSpec(spec);
  dump(intrp, config);
};
