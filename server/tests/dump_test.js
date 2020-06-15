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
    input: [
      {filename: 'foo',
       header: ['// F1 BIOS', '// Copyright YEAR Foonly inc.', 'LINES'],
       headerSubs: {YEAR: '1978', LINES: ['// 1', '// 2']},
       contents: ['a', 'b']}],
    expected: [
      {filename: 'foo',
       header: '// F1 BIOS\n// Copyright YEAR Foonly inc.\nLINES',
       headerSubs: {YEAR: '1978', LINES: '// 1\n// 2'},
       prune: [],
       pruneRest: [],
       contents: [
         {selector: new Selector('a'), do: Do.RECURSE, reorder: false},
         {selector: new Selector('b'), do: Do.RECURSE, reorder: false}
       ],
       rest: false
      }],
  }, {
    input: [{filename: 'foo', prune: ['a', 'b'], rest: true}],
    expected: [
      {filename: 'foo', header: undefined, headerSubs: {},
       prune: [new Selector('a'), new Selector('b')],
       pruneRest: [],
       contents: [], rest: true
      }],
  }, {
    input: [{filename: 'foo', pruneRest: ['c', 'd'], rest: true}],
    expected: [
      {filename: 'foo', header: undefined, headerSubs: {},
       prune: [],
       pruneRest: [new Selector('c'), new Selector('d')],
       contents: [], rest: true
      }],
  }, {
    input: [{options: {}}, {options: {treeOnly: false}}],
    expected: [{options: {}}, {options: {treeOnly: false}}],
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
    [{}],  // Neither SpecFileItem  nor SpecOptionsItem.
    [{filename: 'foo'}],  // Missing both .contents and .rest.
    [{filename: 'foo', contents: [], rest: 'bar'}],  // .rest not bool.
    [{filename: 'foo', contents: [42]}],  // .contents[0] not object or string.
    [{filename: 'foo', contents: ['foo[']}],  // .contents[0] invalid selector.
    [{filename: 'foo', contents: [{}]}],  // ... has no .path.
    [{filename: 'foo', contents: [{path: 'bar'}]}],  // ... has no .do.
    [{filename: 'foo', contents: [{path: 'bar', do: 2}]}],  // ... invalid .do.
    [{filename: 'foo', contents: [{path: 'bar', do: 'baz'}]}],  // Ditto.
    [{filename: 'foo',  // .reorder not a boolean.
      contents: [{path: 'bar', do: 'SET', reorder: 'qux'}]}],
    [{filename: 'foo', rest: 42}],  // .rest not a boolean.
    [{filename: 'foo', rest: 'false'}],  // .rest not a boolean.
    [{filename: 'foo', prune: 'x', rest: true}], // .prune not an array.
    [{filename: 'foo', prune: ['foo['], rest: true}], // .prune[0] invalid.
    [{filename: 'foo', pruneRest: 'x', rest: true}], // .prune not an array.
    [{filename: 'foo', pruneRest: ['foo['], rest: true}], // .prune[0] invalid.
    [{options: 'not an object'}],  // .options is not an object.
  ];
  for (const input of invalid) {
    const name = util.format('configFromSpec(%o)', input);
    try {
      configFromSpec(input);
      t.fail(util.format("%O didn't throw", input));
    } catch (e) {
      if (!(e instanceof TypeError || e instanceof SyntaxError)) {
        t.fail(util.format('%O threw wrong error', input), e);
      }
    }
  }
};

/**
 * Unit tests for the dump function
 * @param {!T} t The test runner object.
 */
exports.testDump = function(t) {
  const intrp = new Interpreter({noLog: ['net']});

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
  dump(new Interpreter(), intrp, config, '/tmp');
};
