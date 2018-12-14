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
 * Unit tests for the ObjectDumper.prototype.isWritable method.
 */
exports.testObjectDumperPrototypeIsWritable = function(t) {
  const intrp = getInterpreter();
  const pristine = new Interpreter();
  const dumper = new Dumper(intrp, pristine, simpleSpec);

  const root = intrp.ROOT;
  const writable =
      {writable: true, enumerable: true, configurable: true, value: true};
  const nonwritable =
      {writable: false, enumerable: true, configurable: true, value: false};

  // Create some objects and properties.
  intrp.OBJECT.defineProperty('foo', nonwritable, root);
  const parent = new intrp.Object(root);
  parent.defineProperty('bar', nonwritable, root);
  parent.defineProperty('baz', writable, root);
  const child = new intrp.Object(root, parent);
  child.defineProperty('foo', writable, root);
  child.defineProperty('bar', writable, root);
  child.defineProperty('baz', writable, root);

  const objectPrototypeDumper = dumper.getObjectDumper(intrp.OBJECT);
  objectPrototypeDumper.ref = new Selector('Object.prototype');
  const parentDumper = dumper.getObjectDumper(parent);
  parentDumper.ref = new Selector('parent');
  const childDumper = dumper.getObjectDumper(child);
  childDumper.ref = new Selector('child');
  objectPrototypeDumper.proto = null;
  parentDumper.proto = intrp.OBJECT;
  childDumper.proto = intrp.OBJECT;

  objectPrototypeDumper.dumpBinding(dumper, 'foo', Do.SET);
  parentDumper.dumpBinding(dumper, Selector.PROTOTYPE, Do.SET);
  parentDumper.dumpBinding(dumper, 'bar', Do.SET);
  childDumper.dumpBinding(dumper, Selector.PROTOTYPE, Do.DECL);
  t.expect("childDumper.isWritable('foo')  // 0",
      childDumper.isWritable(dumper, 'foo'), true);
  t.expect("childDumper.isWritable('bar')  // 0",
      childDumper.isWritable(dumper, 'bar'), true);
  t.expect("childDumper.isWritable('baz')  // 0",
      childDumper.isWritable(dumper, 'baz'), true);

  objectPrototypeDumper.dumpBinding(dumper, 'foo', Do.ATTR);
  parentDumper.dumpBinding(dumper, 'bar', Do.ATTR);
  t.expect("childDumper.isWritable('foo')  // 1",
      childDumper.isWritable(dumper, 'foo'), false);
  t.expect("childDumper.isWritable('bar')  // 1",
      childDumper.isWritable(dumper, 'bar'), true);
  t.expect("childDumper.isWritable('baz')  // 1",
      childDumper.isWritable(dumper, 'baz'), true);

  childDumper.dumpBinding(dumper, Selector.PROTOTYPE, Do.SET);
  t.expect("childDumper.isWritable('foo')  // 2",
      childDumper.isWritable(dumper, 'foo'), false);
  t.expect("childDumper.isWritable('bar')  // 2",
      childDumper.isWritable(dumper, 'bar'), false);
  t.expect("childDumper.isWritable('baz')  // 2",
      childDumper.isWritable(dumper, 'baz'), true);

  childDumper.dumpBinding(dumper, 'foo', Do.DECL);
  childDumper.dumpBinding(dumper, 'bar', Do.DECL);
  childDumper.dumpBinding(dumper, 'baz', Do.DECL);
  t.expect("childDumper.isWritable('foo')  // 3",
      childDumper.isWritable(dumper, 'foo'), true);
  t.expect("childDumper.isWritable('bar')  // 3",
      childDumper.isWritable(dumper, 'bar'), true);
  t.expect("childDumper.isWritable('baz')  // 3",
      childDumper.isWritable(dumper, 'baz'), true);
};

/**
 * Unit tests for the Dumper.prototype.isShadowed method.
 * @param {!T} t The test runner object.
 */
exports.testDumperPrototypeIsShadowed = function(t) {
  const intrp = getInterpreter();
  const pristine = new Interpreter();
  const dumper = new Dumper(intrp, pristine, simpleSpec);

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
 * Unit tests for the Dumper.prototype.exprForPrimitive method.
 * @param {!T} t The test runner object.
 */
exports.testDumperPrototypeExprForPrimitive = function(t) {
  const intrp = getInterpreter();
  const pristine = new Interpreter();
  const dumper = new Dumper(intrp, pristine, simpleSpec);

  function doCases(cases) {
    for (const tc of cases) {
      const r = dumper.exprForPrimitive(tc[0]);
      t.expect(util.format('dumper.exprForPrimitive(%o)', tc[0]), r, tc[1]);
      t.expect(util.format('eval(dumper.exprForPrimitive(%o))', tc[0]),
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
 * Unit tests for the Dumper.prototype.exprFor method.
 * @param {!T} t The test runner object.
 */
exports.testDumperPrototypeExprFor = function(t) {
  const intrp = getInterpreter();
  const pristine = new Interpreter();
  const dumper = new Dumper(intrp, pristine, simpleSpec);

  // Give references to needed builtins.
  for (const b of [
    'Date', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'TypeError',
    'SyntaxError', 'URIError', 'PermissionError'
  ]) {
    dumper.getObjectDumper(intrp.builtins.get(b)).ref = new Selector(b);
  }

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
    [new intrp.Error(intrp.ROOT, intrp.ERROR), "new Error()"],
    [new intrp.Error(intrp.ROOT, intrp.ERROR, 'message'),
        "new Error('message')"],
    [new intrp.Error(intrp.ROOT, intrp.EVAL_ERROR), "new EvalError()"],
    [new intrp.Error(intrp.ROOT, intrp.RANGE_ERROR), "new RangeError()"],
    [new intrp.Error(intrp.ROOT, intrp.REFERENCE_ERROR),
         "new ReferenceError()"],
    [new intrp.Error(intrp.ROOT, intrp.SYNTAX_ERROR), "new SyntaxError()"],
    [new intrp.Error(intrp.ROOT, intrp.TYPE_ERROR), "new TypeError()"],
    [new intrp.Error(intrp.ROOT, intrp.URI_ERROR), "new URIError()"],
    [new intrp.Error(intrp.ROOT, intrp.PERM_ERROR), "new PermissionError()"],
  ];
  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const r = dumper.exprFor(tc[0], new Selector(['tc', String(i)]));
    t.expect(util.format('Dumper.p.exprFor(%s)', tc[1]), r, tc[1]);
  }
};

/**
 * Unit tests for the Dumper.prototype.exprForSelector method.
 * @param {!T} t The test runner object.
 */
exports.testDumperPrototypeExprForSelector = function(t) {
  const intrp = getInterpreter();
  const pristine = new Interpreter();
  const dumper = new Dumper(intrp, pristine, simpleSpec);

  // Test dumping selector before and after dumping Object.getPrototypeOf.
  const selector = new Selector('foo.bar^.baz');
  t.expect(util.format('Dumper.p.exprForSelector(%s)  // 0', selector),
           dumper.exprForSelector(selector),
           "(new 'Object.getPrototypeOf')(foo.bar).baz");
  dumper.getObjectDumper(intrp.builtins.get('Object.getPrototypeOf')).ref =
      new Selector('MyObject.myGetPrototypeOf');
  t.expect(util.format('Dumper.p.exprForSelector(%s)  // 1', selector),
           dumper.exprForSelector(selector),
           'MyObject.myGetPrototypeOf(foo.bar).baz');
};

/**
 * Tests for the Dumper.prototype.dumpBinding method, and by
 * implication most of ScopeDumper and ObjectDumper.
 * @param {!T} t The test runner object.
 */
exports.testDumperPrototypeDumpBinding = function(t) {
  const intrp = getInterpreter();

  // Create various objects to dump.
  intrp.createThreadForSrc(`
      Object.defineProperty(Object, 'name', {writable: true});
      var obj = {a: 1, b: 2, c:3};
      var nullProtoObj = Object.create(null);

      var parent = {foo: 'foo'};
      var child1 = Object.create(parent);
      var child2 = Object.create(parent);
      var child3 = Object.create(parent);
      child1.foo = 'foo2';
      child2.foo = 'foo2';
      child2.bar = 'bar2';
      Object.defineProperty(parent, 'foo', {writable: false});
      Object.defineProperty(child1, 'foo', {enumerable: false});
      Object.defineProperty(child2, 'foo', {enumerable: false});
      Object.defineProperty(child2, 'bar', {configurable: false});
      Object.preventExtensions(child2);

      function f1(arg) {}
      var f2 = function(arg) {};
      Object.setPrototypeOf(f2, null);
      f2.prototype = Object.prototype;
      f2.f3 = function f4(arg) {};
      f2.undef = undefined;
      Object.setPrototypeOf(f2.f3, null);
      f2.f3.prototype = obj;
      delete f2.f3.name;

      var arr = [42, 69, 105, obj];
      var sparse = [0, , 2];
      Object.setPrototypeOf(sparse, arr);
      sparse.length = 4;

      var date1 = new Date('1975-07-27');
      var date2 = new Date('1979-01-04');

      var re1 = /foo/ig;
      var re2 = /bar/g;
      Object.setPrototypeOf(re2, re1);
      re2.lastIndex = 42;
      var re3 = /baz/m;
      Object.setPrototypeOf(re3, re1);

      var error1 = new Error('message1');
      error1.stack = 'stack1';  // Because it's otherwise kind of random.
      var error2 = new TypeError('message2');
      error2.stack = 'stack2';
      var error3 = new RangeError();
      Object.setPrototypeOf(error3, error1);
      error3.message = 69;
      Object.defineProperty(error3, 'message', {writable: false});
      delete error3.stack;

      var alice = {};
      alice.thing = (function() {setPerms(alice); return {};})();
      var bob = {};
      bob.thing = {};
      Object.setOwnerOf(bob.thing, bob);

      Object.defineProperty(Object.prototype, 'bar',
          {writable: false, enumerable: true, configurable: true,
           value: 'bar'});  // Naughty!
  `);
  intrp.run();

  // Create Dumper with pristine Interpreter instance to compare to.
  const pristine = new Interpreter();
  const dumper = new Dumper(intrp, pristine, simpleSpec);
  // Set a few flags in advance, to limit recursive dumping of
  // builtins in tests.
  for (const builtin of [intrp.OBJECT, intrp.FUNCTION, intrp.ARRAY,
                         intrp.REGEXP, intrp.ERROR, intrp.TYPE_ERROR,
                         intrp.RANGE_ERROR]) {
    dumper.visiting.add(dumper.getObjectDumper(builtin));
  };

  // Check generated output for (and post-dump status of) specific bindings.
  const cases = [
    // [ selector, todo, expected output, expected done (if === todo) ]
    // Order (somewhat) matters.
    ['NaN', Do.RECURSE, ''],
    ['Infinity', Do.RECURSE, ''],
    ['undefined', Do.RECURSE, ''],
    ['eval', Do.RECURSE, ''],
    
    ['Object', Do.DECL, 'var Object;\n'],
    ['Object', Do.DECL, ''],
    ['Object', Do.SET, "Object = new 'Object';\n", Do.DONE],
    ['Object', Do.DONE, '', Do.DONE],
    ['Object.prototype', Do.SET,
        "Object.prototype = new 'Object.prototype';\n"],
    ['Object.prototype.bar', Do.SET, "Object.prototype.bar = 'bar';\n"],
    ['Object.prototype.bar', Do.ATTR, "(new 'Object.defineProperty')(" +
        "Object.prototype, 'bar', {writable: false});\n"],
    ['Object.defineProperty', Do.SET,
        "Object.defineProperty = new 'Object.defineProperty';\n"],

    ['CC', Do.SET, 'var CC = {};\n', Do.DONE],
    ['CC.root', Do.RECURSE, "CC.root = new 'CC.root';\n"],

    ['obj', Do.SET, 'var obj = {};\n', Do.DONE],
    ['obj', Do.RECURSE, 'obj.a = 1;\nobj.b = 2;\nobj.c = 3;\n'],
    ['nullProtoObj', Do.RECURSE,
        "var nullProtoObj = (new 'Object.create')(null);\n"],

    // TODO(cpcallen): Really want "var child1 = {foo: 'foo'};\n".
    ['child1', Do.SET, 'var child1 = {};\n', Do.DONE],
    // TODO(cpcallen): Really want "var child2 = {foo: 'foo'};\n".
    ['child2', Do.SET, 'var child2 = {};\n', Do.DONE],
    ['parent', Do.RECURSE, "var parent = {};\nparent.foo = 'foo';\n" +
        "Object.defineProperty(parent, 'foo', {writable: false});\n"],

    ['child1.foo', Do.DECL, 'child1.foo = undefined;\n'],
    ['child1.foo', Do.SET, "child1.foo = 'foo2';\n"],
    ['child1.foo', Do.ATTR,
        "Object.defineProperty(child1, 'foo', {enumerable: false});\n"],
    ['child2^', Do.SET, "(new 'Object.setPrototypeOf')(child2, parent);\n",
        Do.DONE],
    ['child2.foo', Do.DECL, "Object.defineProperty(child2, 'foo', " +
        '{writable: true, enumerable: true, configurable: true});\n'],
    ['child2.foo', Do.SET, "child2.foo = 'foo2';\n"],
    ['child2.foo', Do.ATTR,
        "Object.defineProperty(child2, 'foo', {enumerable: false});\n"],
    ['child2.bar', Do.SET, "Object.defineProperty(child2, 'bar', " +
        "{writable: true, enumerable: true, value: 'bar2'});\n", Do.ATTR],
    ['child2', Do.RECURSE, '(new \'Object.preventExtensions\')(child2);\n'],

    ['child3', Do.RECURSE, "var child3 = (new 'Object.create')(parent);\n"],

    ['Object.setPrototypeOf', Do.SET,
        "Object.setPrototypeOf = new 'Object.setPrototypeOf';\n"],

    ['f1', Do.DECL, 'var f1;\n'],
    // TODO(cpcallen): Really want 'function f1(arg) {};\n'.
    ['f1', Do.SET, 'f1 = function f1(arg) {};\n', Do.DONE],
    ['f2', Do.SET, 'var f2 = function(arg) {};\n', Do.DONE],
    ['f2.f3', Do.DECL, 'f2.f3 = undefined;\n'],
    ['f2.f3', Do.SET, 'f2.f3 = function f4(arg) {};\n', Do.ATTR],
    ['f2.undef', Do.DECL, 'f2.undef = undefined;\n', Do.ATTR],
    ['f2.f3^', Do.SET, 'Object.setPrototypeOf(f2.f3, null);\n', Do.DONE],
    ['f2.f3', Do.RECURSE, "delete f2.f3.name;\nf2.f3.prototype = obj;\n"],

    // TODO(cpcallen): Realy want 'var arr = [42, 69, 105, obj];\n'.
    ['arr', Do.RECURSE, 'var arr = [];\narr[0] = 42;\narr[1] = 69;\n' +
        'arr[2] = 105;\narr[3] = obj;\n'],
    // TODO(cpcallen): really want 'var sparse = [0, , 2];\nsparse.length = 4;'.
    ['sparse', Do.RECURSE, 'var sparse = [];\n' +
        'Object.setPrototypeOf(sparse, arr);\n' +
        'sparse[0] = 0;\nsparse[2] = 2;\nsparse.length = 4;\n'],

    ['date1', Do.SET,
        "var date1 = new (new 'Date')('1975-07-27T00:00:00.000Z');\n", Do.DONE],
    ['Date', Do.SET, "var Date = new 'Date';\n", Do.DONE],
    ['date2', Do.SET, "var date2 = new Date('1979-01-04T00:00:00.000Z');\n",
        Do.DONE],

    ['re1', Do.SET, 'var re1 = /foo/gi;\n', Do.DONE],
    ['re2', Do.RECURSE, 'var re2 = /bar/g;\n' +
        'Object.setPrototypeOf(re2, re1);\n' +
        're2.lastIndex = 42;\n'],
    ['re3', Do.SET, 'var re3 = /baz/m;\n', Do.DONE],
    ['re3^', Do.SET, 'Object.setPrototypeOf(re3, re1);\n', Do.DONE],

    ['error1', Do.SET, "var error1 = new (new 'Error')('message1');\n",
        Do.DONE],
    ['error1', Do.RECURSE, "error1.stack = 'stack1';\n"],
    ['Error', Do.SET, "var Error = new 'Error';\n", Do.DONE],
    ['TypeError', Do.SET, "var TypeError = new 'TypeError';\n", Do.DONE],
    ['RangeError', Do.SET, "var RangeError = new 'RangeError';\n", Do.DONE],
    ['error2', Do.SET, "var error2 = new TypeError('message2');\n", Do.DONE],
    ['error2', Do.RECURSE, "error2.stack = 'stack2';\n"],
    ['error3', Do.SET, 'var error3 = new Error();\n', Do.DONE],
    ['error3.message', Do.ATTR, 'error3.message = 69;\n' +
        "Object.defineProperty(error3, 'message', {writable: false});\n"],
    ['error3', Do.RECURSE, 'delete error3.stack;\n' +
        'Object.setPrototypeOf(error3, error1);\n'],

    ['alice', Do.SET, 'var alice = {};\n', Do.DONE],
    ['alice.thing', Do.ATTR, 'alice.thing = {};\n'],
    ['alice.thing{owner}', Do.SET, "(new 'Object.setOwnerOf')" +
        '(alice.thing, alice);\n', Do.DONE],
    ['Object.setOwnerOf', Do.SET,
        "Object.setOwnerOf = new 'Object.setOwnerOf';\n"],
    ['bob', Do.RECURSE, 'var bob = {};\nbob.thing = {};\n' +
        "Object.setOwnerOf(bob.thing, bob);\n"],
  ];
  for (const tc of cases) {
    const s = new Selector(tc[0]);
    // Dump binding and check output code.
    const code = dumper.dumpBinding(s, tc[1]);
    t.expect(util.format('Dumper.p.dumpBinding(<%s>, %o)', s, tc[1]),
             code, tc[2]);
    // Check work recorded.
    const parentDumper  = dumper.getDumperForSelectorParent(s);
    t.expect(util.format('Binding status of <%s> (after dump)', s),
        parentDumper.getDone(s[s.length - 1]), tc[3] || tc[1]);
  }

  // Check status of (some of the) additional bindings that will be
  // set implicitly as a side effect of the code generated above, and
  // that their values have the expected references (where
  // object-valued and already dumped).
  //
  // TODO(cpcallen): The value checks are NOT checking the dumped
  // value (or even, for .proto, the internal record of the current
  // value), but instead just the ref of the actual value in the
  // interpreter being dumped.  That's not really too useful, so maybe
  // they should be removed.
  const implicit = [
    // [ selector, expected done, expected value (as selector) ]
    ['Object.length', Do.ATTR],
    ['Object.name', Do.SET],

    ['obj^', Do.RECURSE, 'Object.prototype'],
    ['child1^', Do.DECL],
    ['child2^', Do.RECURSE, 'parent'],
    ['child3^', Do.RECURSE, 'parent'],

    ['f1^', Do.DONE],
    ['f1.length', Do.ATTR],
    ['f1.name', Do.ATTR],
    ['f1.prototype', Do.SET, 'f1.prototype'],
    ['f1.prototype.constructor', Do.SET, 'f1'],
    ['f2^', Do.DECL],
    ['f2.length', Do.ATTR],
    ['f2.name', Do.ATTR],
    ['f2.prototype', Do.DECL, 'Object.prototype'],
    ['f2.f3^', Do.RECURSE],
    ['f2.f3.length', Do.RECURSE],
    // TODO(cpcallen): enable this once code is correct.
    // ['f2.f3.name', Do.UNSTARTED],  // N.B.: not implicitly set.
    ['f2.f3.prototype', Do.RECURSE, 'obj'],

    ['arr^', Do.RECURSE],
    ['arr.length', Do.RECURSE],
    ['sparse^', Do.RECURSE, 'arr'],
    ['sparse.length', Do.RECURSE],

    ['date1^', Do.DONE],
    ['date2^', Do.DONE],

    ['re1^', Do.RECURSE],
    ['re1.source', Do.RECURSE],
    ['re1.global', Do.RECURSE],
    ['re1.ignoreCase', Do.RECURSE],
    ['re1.multiline', Do.RECURSE],
    ['re1.lastIndex', Do.RECURSE],
    ['re2^', Do.RECURSE, 're1'],
    ['re2.source', Do.RECURSE],
    ['re2.global', Do.RECURSE],
    ['re2.ignoreCase', Do.RECURSE],
    ['re2.multiline', Do.RECURSE],
    ['re2.lastIndex', Do.RECURSE],
    ['re3^', Do.DONE, 're1'],
    ['re3.source', Do.ATTR],
    ['re3.global', Do.ATTR],
    ['re3.ignoreCase', Do.ATTR],
    ['re3.multiline', Do.ATTR],
    ['re3.lastIndex', Do.ATTR],

    ['error1.message', Do.RECURSE],
    ['error2.message', Do.RECURSE],

    ['alice{owner}', Do.DONE, 'CC.root'],
    ['alice.thing{owner}', Do.DONE, 'alice'],
    ['bob{owner}', Do.RECURSE, 'CC.root'],
    ['bob.thing{owner}', Do.RECURSE, 'bob'],
  ];
  for (const tc of implicit) {
    const s = new Selector(tc[0]);
    const parentDumper  = dumper.getDumperForSelectorParent(s);
    t.expect(util.format('Binding status of <%s> (implicit)', s),
        parentDumper.getDone(s[s.length - 1]), tc[1]);
    if (tc[2]) {
      const objDumper = dumper.getObjectDumper(dumper.valueForSelector(s));
      t.expect(util.format('Ref for %s', s), String(objDumper.ref), tc[2]);
    }
  }
};

/**
 * Unit test for the ScopeDumper.prototype.dump method.
 * @param {!T} t The test runner object.
 */
exports.testScopeDumperPrototypeDump = function(t) {
  const intrp = new Interpreter();

  // Create various variables to dump.
  intrp.createThreadForSrc(`
      var value = 42;
      var obj = (new 'Object.create')(null);
      obj.prop = 69;
  `);
  intrp.run();

  // Create Dumper with pristine Interpreter instance to compare to;
  // get ScopeDumper for global scope.
  const pristine = new Interpreter();
  const dumper = new Dumper(intrp, pristine, simpleSpec);
  const globalDumper = dumper.getScopeDumper(intrp.global);

  // Dump one binding and check result.
  dumper.output.length = 0;
  globalDumper.dumpBinding(dumper, 'obj', Do.SET);
  let code = dumper.output.join('');
  t.expect("ScopeDumper.p.dumpBinding(..., 'obj', Do.SET, ...) outputs",
      code, "var obj = (new 'Object.create')(null);\n");

  // Dump the rest & check result.
  dumper.output.length = 0;
  globalDumper.dump(dumper);
  code = dumper.output.join('');
  t.expect('ScopeDumper.p.dump(...) outputs', code,
      'var value = 42;\nobj.prop = 69;\n');
};

/**
 * Unit test for the ObjectDumper and ScopeDumper.prototype.survey
 * dump methods.
 * @param {!T} t The test runner object.
 */
exports.testDumperSurvey = function(t) {
  const intrp = new Interpreter();

  // Create various variables to dump.
  intrp.createThreadForSrc(`
      var foo = (function() {
        var x = 42;
        bar = function baz() {return x;};
        function quux() {return -x;};
        return quux;
      })();
      var bar;  // N.B.: hoisted.
      var orphanArgs = (function() {return arguments;})();
  `);
  intrp.run();

  // Create Dumper with pristine Interpreter instance to compare to;
  // get ScopeDumper for global scope.  Dumper constructor performs
  // survey.
  const pristine = new Interpreter();
  const dumper = new Dumper(intrp, pristine, simpleSpec);

  // Check relationship of functions and scopes recorded by survey.
  const baz = /** @type {!Interpreter.prototype.UserFunction} */(
      intrp.global.get('bar'));
  const quux = /** @type {!Interpreter.prototype.UserFunction} */(
      intrp.global.get('foo'));
  const globalDumper = dumper.getScopeDumper(intrp.global);
  const bazDumper = dumper.getObjectDumper(baz);
  const bazScopeDumper = dumper.getScopeDumper(baz.scope);
  const quuxDumper = dumper.getObjectDumper(quux);
  const quuxScopeDumper = dumper.getScopeDumper(quux.scope);

  t.expect('bazScopeDumper.scope.type', bazScopeDumper.scope.type, 'funexp');
  t.expect('quuxScopeDumper.scope.type',
      quuxScopeDumper.scope.type, 'function');

  t.expect('globalDumper.innerFunctions.size',
      globalDumper.innerFunctions.size, 0);
  t.expect('globalDumper.innerScopes.size', globalDumper.innerScopes.size, 1);
  t.assert('globalDumper.innerScopes.has(/* quux.scope */)',
      globalDumper.innerScopes.has(quuxScopeDumper));

  t.expect('quuxScopeDumper.innerFunctions.size',
      quuxScopeDumper.innerFunctions.size, 1);
  t.assert('quuxScopeDumper.innerFunctions.has(/* quux */)',
      quuxScopeDumper.innerFunctions.has(quuxDumper));
  t.expect('quuxScopeDumper.innerScopes.size',
      quuxScopeDumper.innerScopes.size, 1);
  t.assert('quuxScopeDumper.innerScopes.has(/* baz.scope */)',
      quuxScopeDumper.innerScopes.has(bazScopeDumper));

  t.expect('bazScopeDumper.innerFunctions.size',
      bazScopeDumper.innerFunctions.size, 1);
  t.assert('bazScopeDumper.innerFunctions.has(/* baz */)',
      bazScopeDumper.innerFunctions.has(bazDumper));
  t.expect('bazScopeDumper.innerScopes.size',
      bazScopeDumper.innerScopes.size, 0);

  // Check relationship of Arguments objects and scopes recorded by survey.
  const quuxArgs = quuxScopeDumper.scope.get('arguments');
  const orphanArgs = /** @type{!Interpreter.prototype.Arguments} */(
      intrp.global.get('arguments'));
  t.expect('argumentsScopeDumpers.size',
      dumper.argumentsScopeDumpers.size, 1);
  t.assert('argumentsScopeDumpers.get(quuxArgs) === quuxScopeDumper',
      dumper.argumentsScopeDumpers.get(quuxArgs) === quuxScopeDumper);
  t.assert('argumentsScopeDumpers.get(orphanArgs) === quuxScopeDumper',
      dumper.argumentsScopeDumpers.get(orphanArgs) === undefined);
};

/**
 * Unit tests for the Dumper class
 * @param {!T} t The test runner object.
 */
exports.testDumper = function(t) {
  const intrp = getInterpreter();
  const pristine = getInterpreter();
  const dumper = new Dumper(intrp, pristine, simpleSpec);

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

};
