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

const {dump, Do} = require('../dump');
const fs = require('fs');
const Interpreter = require('../interpreter');
const path = require('path');
const {T} = require('./testing');

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

  const spec = [
    {
      filename: 'core_00_es5',
      contents: [
        'Object',
        'Function',
        'Array',
        'String',
        'Boolean',
        'Number',
        'Date',
        'RegExp',
        'Error',
        'EvalError',
        'RangeError',
        'ReferenceError',
        'SyntaxError',
        'TypeError',
        'URIError',
        'Math',
        'JSON',
        'decodeURI',
        'decodeURIComponent',
        'encodeURI',
        'encodeURIComponent',
        'escape',
        'isFinite',
        'isNan',
        'parseFloat',
        'parseInt',
        'unescape',
      ],
    }, {
      filename: 'core_00_es6',
      contents: [
        'Object.is',
        'Object.setPrototypeOf',
        'Array.prototype.find',
        'Array.prototype.findIndex',
        'String.prototype.endsWith',
        'String.prototype.includes',
        'String.prototype.repeat',
        'String.prototype.startsWith',
        'Number.isFinite',
        'Number.isNaN',
        'Number.isSafeInteger',
        'Number.EPSILON',
        'Number.MAX_SAFE_INTEGER',
        'Math.sign',
        'Math.trunc',
        'WeakMap',
      ],
    }, {
      filename: 'core_00_esx',
      contents: [
        'Object.getOwnerOf',
        'Object.setOwnerOf',
        'Thread',
        'PermissionError',
        'Array.prototype.join',
        'suspend',
        'setTimeout',
        'clearTimeout',
      ],
    }, {
      filename: 'core_10_base',
      contents: [
        {path: 'user', do: Do.DECL},
        {path: '$', do: Do.SET},
        '$.system',
        {path: '$.utils', do: Do.ATTR},
        '$.physical',
        '$.thing',
        '$.room',
        '$.user',
        '$.execute',
        {path: '$.userDatabase', do: Do.ATTR},
        '$.connection',
        {path: '$.servers', do: Do.ATTR},
        '$.servers.telnet',
      ],
    }, {
      filename: 'core_11_$.utils.command',
      contents: [
        '$.utils.command',
        '$.utils.match',
      ],
    }, {
      filename: 'core_12_$.utils.selector',
      contents: ['$.utils.selector'],
    }, {
      filename: 'core_13_$.utils.code',
      contents: ['$.utils.code'],
    }, {
      filename: 'core_20_$.utils.acorn_pre',
    }, {
      filename: 'core_21_$.utils.acorn',
      symlink: '../server/node_modules/acorn/dist/acorn.js',
    }, {
      filename: 'core_22_$.utils.acorn_post',
    }, {
      filename: 'core_30_$.servers.http',
      contents: ['$.servers.http'],
    }, {
      filename: 'core_31_$.jssp',
      contents: ['$.jssp'],
    }, {
      filename: 'core_32_$.www',
      contents: [
        {path: '$.www', do: Do.ATTR},
        {path: '$.www.ROUTER', do: Do.ATTR},
        '$.www[404]',
        '$.www.homepage',
        '$.www.robots',
      ],
    }, {
      filename: 'core_33_$.www.editor',
      contents: ['$.www.editor'],
    }, {
      filename: 'core_34_$.www.code',
      contents: ['$.www.code'],
    }, {
      filename: 'core_40_$.db.tempId',
      contents: [
        {path: '$.db', do: Do.ATTR},
        '$.db.tempID',
      ],
    }, {
      filename: 'core_90_world',
      rest: true,
    },
  ];

  dump(intrp, spec);
};
