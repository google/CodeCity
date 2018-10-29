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

const Interpreter = require('../interpreter');
const {dump, Do, testOnly} = require('../dump');
const fs = require('fs');
const {getInterpreter} = require('./interpreter_common');
const path = require('path');
const Selector = require('../selector');
const {T} = require('./testing');
const util = require('util');

// Unpack test-only exports from dump:
const {Dumper} = testOnly;

/** A very simle Dumper config specification, for testing. */
const simpleSpec = [{filename: 'all', rest: true}];

/**
 * Unit tests for the Dumper.prototype.isShadowed method.
 * @param {!T} t The test runner object.
 */
exports.testDumperPrototypeIsShadowed = function(t) {
  const intrp = getInterpreter();
  const dumper = new Dumper(intrp, simpleSpec);

  intrp.global.createMutableBinding('foo', 'foo');
  intrp.global.createMutableBinding('bar', 'bar');

  const inner = new Interpreter.Scope(Interpreter.Scope.Type.FUNCTION,
      intrp.ROOT, intrp.global);
  inner.createMutableBinding('foo', 'foobar!');
  dumper.scope = inner;

  t.expect("isShadowed('foo')", dumper.isShadowed('foo'), true);
  t.expect("isShadowed('bar')", dumper.isShadowed('bar'), false);
};

/**
 * Unit tests for the Dumper.prototype.primitiveToExpr method.
 * @param {!T} t The test runner object.
 */
exports.testDumperPrototypePrimitiveToExpr = function(t) {
  const intrp = getInterpreter();
  const dumper = new Dumper(intrp, simpleSpec);

  function doCases(cases) {
    for (const tc of cases) {
      const r = dumper.primitiveToExpr(tc[0]);
      t.expect(util.format('dumper.primitiveToExpr(%o)', tc[0]), r, tc[1]);
      t.expect(util.format('eval(dumper.primitiveToExpr(%o))', tc[0]),
          eval(r), tc[0]);
    }
  }

  doCases([
    [undefined, 'undefined'],
    [null, 'null'],
    [false, 'false'],
    [true, 'true'],
    [0, '0'],
    [-0, '-0'],
    [Infinity, 'Infinity'],
    [-Infinity, '-Infinity'],
    [NaN, 'NaN'],
    ['foo', "'foo'"],
  ]);

  // Shadow some names and check results are still correct.
  const inner = new Interpreter.Scope(Interpreter.Scope.Type.FUNCTION,
      intrp.ROOT, intrp.global);
  inner.createMutableBinding('Infinity', '42');
  inner.createMutableBinding('NaN', '42');
  inner.createMutableBinding('undefined', '42');
  dumper.scope = inner;

  doCases([
    [undefined, '(void 0)'],
    [Infinity, '(1/0)'],
    [-Infinity, '(-1/0)'],
    [NaN, '(0/0)'],
  ]);
};

/**
 * Unit tests for the Dumper.prototype.toExpr method.
 * @param {!T} t The test runner object.
 */
exports.testDumperPrototypeToExpr = function(t) {
  const intrp = getInterpreter();
  const dumper = new Dumper(intrp, simpleSpec);

  // Create UserFunction to dump.
  intrp.createThreadForSrc('function foo(bar) {}');
  intrp.run();
  const func = intrp.global.get('foo');

  const cases = [
    [intrp.OBJECT, "new 'Object.prototype'"],
    [func, 'function foo(bar) {}'],
    [new intrp.Object(intrp.ROOT), '{}'],
    [new intrp.Array(intrp.ROOT), '[]'],
    [new intrp.Date(new Date('1975-07-27'), intrp.ROOT),
        "new Date('1975-07-27T00:00:00.000Z')"],
    [new intrp.RegExp(/foo/ig, intrp.ROOT), '/foo/gi'],
  ];
  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const r = dumper.toExpr(tc[0], new Selector(['tc', String(i)]));
    t.expect(util.format('Dumper.p.toExpr(%s)', tc[1]), r, tc[1]);
  }
};

/**
 * Unit tests for the Dumper.prototype.dumpBinding method.
 * @param {!T} t The test runner object.
 */
exports.testDumperPrototypeDumpBinding = function(t) {
  const intrp = getInterpreter();
  const dumper = new Dumper(intrp, simpleSpec);

  // Create various objects to dump.
  intrp.createThreadForSrc(`
      var obj = {a: 1, b: 2, c:3};
      var child1 = Object.create(obj);
      var child2 = Object.create(obj);

      function f1(arg) {}
      var f2 = function(arg) {};
      Object.setPrototypeOf(f2, null);
      f2.prototype = Object.prototype;
      f2.f3 = function f4(arg) {};
      Object.setPrototypeOf(f2.f3, null);
      f2.f3.prototype = obj;

      var arr = [42, 69, 105, obj];
      var sparse = [0, , 2];
      Object.setPrototypeOf(sparse, arr);
      sparse.length = 4;

      var date = new Date('1975-07-27');

      var re1 = /foo/ig;
      var re2 = /bar/g;
      Object.setPrototypeOf(re2, re1);
      re2.lastIndex = 42;
  `);
  intrp.run();
  const func = intrp.global.get('foo');

  // Check generated output for (and post-dump status of) specific bindings.
  const cases = [  // Order matters.
    ['Object', Do.DECL, 'var Object;\n'],
    ['Object', Do.DECL, ''],
    ['Object', Do.SET, "Object = new 'Object';\n"],
    ['Object', Do.SET, ''],
    ['Object.prototype', Do.SET,
        "Object.prototype = new 'Object.prototype';\n"],

    ['child1', Do.SET, 'var child1 = {};\n'],
    ['obj', Do.SET, 'var obj = {};\n'],
    ['obj', Do.RECURSE, 'obj.a = 1;\nobj.b = 2;\nobj.c = 3;\n'],
    ['child2', Do.RECURSE, 'var child2 = Object.create(obj);\n'],

    ['f1', Do.DECL, 'var f1;\n'],
    // TODO(cpcallen): Really want 'function f1(arg) {};\n'.
    ['f1', Do.SET, 'f1 = function f1(arg) {};\n'],
    ['f2', Do.SET, 'var f2 = function(arg) {};\n'],
    ['f2.f3', Do.DECL, 'f2.f3 = undefined;\n'],
    ['f2.f3', Do.SET, 'f2.f3 = function f4(arg) {};\n'],
    ['f2.f3^', Do.SET, 'Object.setPrototypeOf(f2.f3, null);\n'],
    ['f2.f3', Do.RECURSE, "f2.f3.prototype = obj;\n"],

    // TODO(cpcallen): Realy want 'var arr = [42, 69, 105, obj];\n'.
    ['arr', Do.RECURSE, 'var arr = [];\narr[0] = 42;\narr[1] = 69;\n' +
        'arr[2] = 105;\narr[3] = obj;\n'],
    // TODO(cpcallen): really want 'var sparse = [0, , 2];\nsparse.length = 4;'.
    ['sparse', Do.RECURSE, 'var sparse = [];\n' +
        // BUG(cpcallen) should have: 'Object.setPrototypeOf(sparse, arr);\n' +
        'sparse[0] = 0;\nsparse[2] = 2;\nsparse.length = 4;\n'],

    ['date', Do.SET, "var date = new Date('1975-07-27T00:00:00.000Z');\n"],

    ['re1', Do.SET, 'var re1 = /foo/gi;\n'],
    ['re2', Do.RECURSE, 'var re2 = /bar/g;\n' +
        // BUG(cpcallen) should have: 'Object.setPrototypeOf(re2, re1);\n' +
        're2.lastIndex = 42;\n'],
  ];
  for (const tc of cases) {
    const s = new Selector(tc[0]);
    // Check output code.
    const code = dumper.dumpBinding(s, tc[1]);
    t.expect(util.format('Dumper.p.dumpBinding(<%s>, %o)', s, tc[1]),
             code, tc[2]);
    // Check work recorded.
    const info  = dumper.getInfoForSelector(s);
    t.expect(util.format('Binding status of <%s>', s),
        info.getDone(s[s.length - 1]), tc[1]);
  }

  // Check status of (some of the) additional bindings that will be
  // set implicitly as a side effect of the code generated above, and
  // that their values have the expected references (where
  // object-valued and already dumped).
  const implicit = [
    ['Object.length', Do.SET],
    ['Object.name', Do.SET],

    ['obj^', Do.SET, 'Object.prototype'],
    ['child1^', Do.DECL, 'obj'],
    ['child2^', Do.SET, 'obj'],

    ['f1^', Do.SET],
    ['f1.length', Do.SET],
    ['f1.name', Do.SET],
    ['f1.prototype', Do.SET, 'f1.prototype'],
    ['f1.prototype.constructor', Do.SET, 'f1'],
    ['f2^', Do.DECL],
    ['f2.length', Do.SET],
    ['f2.name', Do.SET],
    ['f2.prototype', Do.DECL, 'Object.prototype'],
    ['f2.f3^', Do.SET],
    ['f2.f3.length', Do.SET],
    // TODO(cpcallen): enable this once code is correct.
    // ['f2.f3.name', Do.UNSTARTED],  // N.B.: not implicitly set.
    ['f2.f3.prototype', Do.RECURSE, 'obj'],

    ['arr^', Do.SET],
    ['arr.length', Do.SET],
    ['sparse^', Do.DECL, 'arr'],  // BUG(cpcallen): should be Do.SET.
    ['sparse.length', Do.SET],

    ['date^', Do.SET],

    ['re1^', Do.SET],
    ['re1.source', Do.SET],
    ['re1.global', Do.SET],
    ['re1.ignoreCase', Do.SET],
    ['re1.multiline', Do.SET],
    ['re1.lastIndex', Do.SET],
    ['re2^', Do.DECL, 're1'],  // BUG(cpcallen): should be Do.SET.
  ];
  for (const tc of implicit) {
    const s = new Selector(tc[0]);
    const info  = dumper.getInfoForSelector(s);
    t.expect(util.format('Binding status of <%s>', s),
        info.getDone(s[s.length - 1]), tc[1]);
    if (tc[2]) {
      const value = dumper.getValueForSelector(s);
      const valueInfo = dumper.getObjectInfo(value);
      t.expect(util.format('Ref for %s', s), String(valueInfo.ref), tc[2]);
    }
  }
};

/**
 * Unit tests for the Dumper class
 * @param {!T} t The test runner object.
 */
exports.testDumper = function(t) {
  let intrp = getInterpreter();
  let dumper = new Dumper(intrp, simpleSpec);

  // Test dump.
  intrp = new Interpreter({noLog: ['net', 'unhandled']});

  // Hack to install stubs for builtins found in codecity.js.
  for (const bi of ['CC.log', 'CC.checkpoint', 'CC.shutdown']) {
    new intrp.NativeFunction({id: bi, length: 0,});
  }

  // Load demo core.
  const coreDir = '../demo';
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
        {path: '$.utils', do: Do.SET},
        '$.physical',
        '$.thing',
        '$.room',
        '$.user',
        '$.execute',
        {path: '$.userDatabase', do: Do.SET},
        '$.connection',
        {path: '$.servers', do: Do.SET},
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
        {path: '$.www', do: Do.SET},
        {path: '$.www.ROUTER', do: Do.SET},
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
        {path: '$.db', do: Do.SET},
        '$.db.tempID',
      ],
    }, {
      filename: 'core_90_world',
      rest: true,
    },
  ];

};
