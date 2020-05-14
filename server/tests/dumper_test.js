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

const {Dumper, Do, testOnly, Writable} = require('../dumper');
const {getInterpreter} = require('./interpreter_common');
const Interpreter = require('../interpreter');
const path = require('path');
const Selector = require('../selector');
const {T} = require('./testing');
const util = require('util');

// Unpack test-only exports:
const {ObjectDumper} = testOnly;

/**
 * A mock Writable, for testing.
 * @implements {Writable}
 */
class MockWritable {
  constructor() {
    /** @const {!Array<string>} */
    this.output = [];
  }

  /** @override */
  write(chunk) {
    this.output.push(String(chunk));
  }

  /** @return {string} */
  toString() {
    return this.output.join('');
  }
}

/**
 * Tests for the ObjectDumper.prototype.isWritable method.
 * @suppress {accessControls}
 */
exports.testObjectDumperPrototypeIsWritable = function(t) {
  const intrp = getInterpreter();
  const pristine = new Interpreter();
  const dumper = new Dumper(pristine, intrp);

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

  const objectPrototypeDumper = dumper.getObjectDumper_(intrp.OBJECT);
  objectPrototypeDumper.ref = new Selector('Object.prototype');
  const parentDumper = dumper.getObjectDumper_(parent);
  parentDumper.ref = new Selector('parent');
  const childDumper = dumper.getObjectDumper_(child);
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
 * Unit tests for the Dumper.prototype.isShadowed_ method.
 * @param {!T} t The test runner object.
 * @suppress {accessControls}
 */
exports.testDumperPrototypeIsShadowed_ = function(t) {
  const intrp = getInterpreter();
  const pristine = new Interpreter();
  const dumper = new Dumper(pristine, intrp);

  intrp.global.createMutableBinding('foo', 'foo');
  intrp.global.createMutableBinding('bar', 'bar');

  const inner = new Interpreter.Scope(Interpreter.Scope.Type.FUNCTION,
      intrp.ROOT, intrp.global);
  inner.createMutableBinding('foo', 'foobar!');
  dumper.scope = inner;

  t.expect("isShadowed_('foo')", dumper.isShadowed_('foo'), true);
  t.expect("isShadowed_('bar')", dumper.isShadowed_('bar'), false);
};

/**
 * Unit tests for the Dumper.prototype.exprForPrimitive_ method.
 * @param {!T} t The test runner object.
 * @suppress {accessControls}
 */
exports.testDumperPrototypeExprForPrimitive_ = function(t) {
  const intrp = getInterpreter();
  const pristine = new Interpreter();
  const dumper = new Dumper(pristine, intrp);

  function doCases(cases) {
    for (const tc of cases) {
      const r = dumper.exprForPrimitive_(tc[0]);
      t.expect(util.format('dumper.exprForPrimitive_(%o)', tc[0]), r, tc[1]);
      t.expect(util.format('eval(dumper.exprForPrimitive_(%o))', tc[0]),
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
 * Tests for the Dumper.prototype.exprFor_ method.
 * @param {!T} t The test runner object.
 * @suppress {accessControls}
 */
exports.testDumperPrototypeExprFor_ = function(t) {
  const intrp = getInterpreter();
  const pristine = new Interpreter();
  const dumper = new Dumper(pristine, intrp);

  // Give references to needed builtins.
  for (const b of [
    'Date', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'TypeError',
    'SyntaxError', 'URIError', 'PermissionError'
  ]) {
    dumper.getObjectDumper_(/** @type {!Interpreter.prototype.Object} */
        (intrp.builtins.get(b))).ref = new Selector(b);
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
    [new intrp.Error(intrp.ROOT, intrp.OBJECT), "new Error()"],
    [new intrp.Error(intrp.ROOT, null), "new Error()"],
  ];
  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const r = dumper.exprFor_(tc[0], new Selector(['tc', String(i)]));
    t.expect(util.format('Dumper.p.exprFor_(%s)', tc[1]), r, tc[1]);
  }
};

/**
 * Tests for the ObjectDumper and ScopeDumper.prototype.survey
 * methods.
 * @param {!T} t The test runner object.
 * @suppress {accessControls}
 */
exports.testDumperSurvey = function(t) {
  const intrp = new Interpreter();

  // Create various variables to dump.
  intrp.createThreadForSrc(`
      var foo = (function() {
        var obj = {};
        var unreachable = {iAmUnreachable: undefined};
        bar = function baz() {return unreachable;};
        function quux() {return obj;};
        quux.prototype.obj = obj;
        (new 'Object.setOwnerOf')(bar, obj);
        return quux;
        arguments;  // Not reached, but forces Arguments instantiation.
      })();
      var bar;  // N.B.: hoisted.
      var orphanArgs = (function() {return arguments;})();
  `);
  intrp.run();

  // Create Dumper with pristine Interpreter instance to compare to;
  // get ScopeDumper for global scope.  Dumper constructor performs
  // survey.
  const pristine = new Interpreter();
  const dumper = new Dumper(pristine, intrp);

  // Get intrp.Objects created by test program.
  const baz = /** @type {!Interpreter.prototype.UserFunction} */(
      intrp.global.get('bar'));  // Function baz was stored in var bar.
  const quux = /** @type {!Interpreter.prototype.UserFunction} */(
      intrp.global.get('foo'));  // IIFE returned quux; was stored in var foo.
  const obj = /** @type {!Interpreter.prototype.Object} */(
      quux.scope.get('obj'));
  const unreachable = /** @type {!Interpreter.prototype.Object} */(
      quux.scope.get('unreachable'));

  // Get SubDumpers for objects created by test program.
  const globalDumper = dumper.getScopeDumper_(intrp.global);
  const bazDumper = dumper.getObjectDumper_(baz);
  const bazScopeDumper = dumper.getScopeDumper_(baz.scope);
  const quuxDumper = dumper.getObjectDumper_(quux);
  const quuxScopeDumper = dumper.getScopeDumper_(quux.scope);
  const objDumper = dumper.getObjectDumper_(obj);
  const unreachableDumper = dumper.getObjectDumper_(unreachable);

  // Verify types of scopes, via ScopeDumpers.
  t.expect('bazScopeDumper.scope.type', bazScopeDumper.scope.type, 'funexp');
  t.expect('quuxScopeDumper.scope.type',
      quuxScopeDumper.scope.type, 'function');

  // Check relationship of functions and scopes recorded by survey.
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
  const quuxArgs = /** @type {!Interpreter.prototype.Arguments} */(
      quuxScopeDumper.scope.get('arguments'));
  const orphanArgs = /** @type {!Interpreter.prototype.Arguments} */(
      intrp.global.get('arguments'));
  t.expect('argumentsScopeDumpers.size',
      dumper.argumentsScopeDumpers.size, 1);
  t.assert('argumentsScopeDumpers.get(quuxArgs) === quuxScopeDumper',
      dumper.argumentsScopeDumpers.get(quuxArgs) === quuxScopeDumper);
  t.assert('argumentsScopeDumpers.get(orphanArgs) === quuxScopeDumper',
      dumper.argumentsScopeDumpers.get(orphanArgs) === undefined);

  // Check preferredRef of various objects.
  t.expect('bazDumper.preferredRef (as Selector)',
           bazDumper.getSelector(/*preferred=*/true).toString(), 'bar');
  t.expect('quuxDumper.preferredRef (as Selector)',
           quuxDumper.getSelector(/*preferred=*/true).toString(), 'foo');
  t.expect('objDumper.preferredRef (as Selector)',
           objDumper.getSelector(/*preferred=*/true).toString(),
           'foo.prototype.obj');
  // Can't create preferred Selector for unreachable (it's
  // unreachable!), so check .preferredRef manually.
  t.expect('unreachableDumper.preferredRef.part',
           unreachableDumper.preferredRef.part, 'unreachable');
  t.expect('unreachableDumper.preferredRef.dumper',
           unreachableDumper.preferredRef.dumper, quuxScopeDumper);
  t.expect('unreachableDumper.preferredRef.part',
           unreachableDumper.preferredRef.part, 'unreachable');
};

/**
 * Unit tests for the Dumper.prototype.exprForSelector_ method.
 * @param {!T} t The test runner object.
 * @suppress {accessControls}
 */
exports.testDumperPrototypeExprForSelector_ = function(t) {
  const intrp = getInterpreter();
  const pristine = new Interpreter();
  const dumper = new Dumper(pristine, intrp);

  // Test dumping selector before and after dumping Object.getPrototypeOf.
  const selector = new Selector('foo.bar^.baz');
  t.expect(util.format('Dumper.p.exprForSelector_(%s)  // 0', selector),
           dumper.exprForSelector_(selector),
           "(new 'Object.getPrototypeOf')(foo.bar).baz");
  dumper.getObjectDumper_(/** @type {!Interpreter.prototype.Object} */
      (intrp.builtins.get('Object.getPrototypeOf'))).ref =
          new Selector('MyObject.myGetPrototypeOf');
  t.expect(util.format('Dumper.p.exprForSelector_(%s)  // 1', selector),
           dumper.exprForSelector_(selector),
           'MyObject.myGetPrototypeOf(foo.bar).baz');
};

/**
 * Tests for the Dumper.prototype.dumpBinding method, and by
 * implication most of ScopeDumper and ObjectDumper.
 * @param {!T} t The test runner object.
 */
exports.testDumperPrototypeDumpBinding = function(t) {
  /**  @type {string} Common minimal init src for all testcases. */
  const common = "var Object = new 'Object';\n" +
      ['defineProperty', 'create', 'preventExtensions',
       'setPrototypeOf', 'setOwnerOf', 'prototype'].map(
           (member) => `
               Object.${member} = new 'Object.${member}';
               Object.defineProperty(Object, '${member}', {enumerable: false});
           `).join('');

  /**
   * @type {!Array<{src: string,
   *                prune: (!Array<(string|number)>|undefined),
   *                skip: (!Array<(string|number)>|undefined),
   *                set: (!Array<(string|number)>|undefined),
   *                dump: (!Array<(string|number)>|undefined),
   *                after: (!Array<(string|number)>|undefined)}>}
   */
  const cases = [
    { // Test basics: DECL/SET/ATTR/DONE/RECURSE for variables and properties.
      title: 'basics',
      src: `
        var prune = 'not dumped';
        var skip = 'skipped';
        var obj = {a: {x: 1}, b: 2, c: 3,
                   u: undefined, skip: 'skipped', prune: 'not dumped'};
        Object.defineProperty(obj, 'a', {enumerable: false});
      `,
      prune: ['prune', 'obj.prune'],
      skip: ['skip', 'obj.skip'],
      set: ['Object', 'Object.setPrototypeOf', 'Object.defineProperty'],
      dump: [
        // [ selector, todo, expected output, expected done (default: todo) ]
        // Order matters.
        ['prune', Do.SET, '', Do.UNSTARTED],
        ['skip', Do.SET, "var skip = 'skipped';\n", Do.RECURSE],
        ['obj', Do.DECL, 'var obj;\n'],
        ['obj', Do.SET, 'obj = {};\n', Do.DONE],

        ['obj.a', Do.DECL, 'obj.a = undefined;\n'],
        ['obj.a', Do.SET, 'obj.a = {};\n'],
        ['obj.a', Do.ATTR,
         "Object.defineProperty(obj, 'a', {enumerable: false});\n"],
        ['obj.a', Do.RECURSE, 'obj.a.x = 1;\n'],
        ['obj.b', Do.SET, 'obj.b = 2;\n', Do.RECURSE],
        ['obj.u', Do.DECL, 'obj.u = undefined;\n', Do.RECURSE],
        ['obj', Do.RECURSE, 'obj.c = 3;\n', Do.DONE],
        ['obj.prune', Do.SET, '', Do.UNSTARTED],
        ['obj.skip', Do.SET, "obj.skip = 'skipped';\n", Do.RECURSE],
        ['obj', Do.RECURSE, ''],
      ],
      after: [
        // [ selector, expected done ]
        ['obj^', Do.RECURSE],
        ['obj.c', Do.RECURSE],
      ],
    },

    { // Test recursion in face of incomplet(able) properties.
      title: 'recursion 1',
      src: `
        var obj = {a: {id: 'a'}, b: {id: 'b'}, c: {id: 'c'}};
        obj.a.self = obj.a;
        obj.b.self = obj.b;
        obj.c.parent = obj;
      `,
      // Mark obj.b.id to be skipped and obj.c.id to be pruned;
      // attempting to dump obj recursively should be leave obj.a as
      // RECUSE, obj.b and obj.c as DONE, and obj.a.id still
      // UNSTARTED.  obj.c left at DONE.
      prune: ['obj.c.id'],
      skip: ['obj.b.id'],
      dump: [
        ['obj', Do.RECURSE,
         // TODO(cpcallen): really want "var obj = {a: {id: 'a'}, ...".
         'var obj = {};\n' +
             "obj.a = {};\nobj.a.id = 'a';\nobj.a.self = obj.a;\n" +
             'obj.b = {};\nobj.b.self = obj.b;\n' +
             "obj.c = {};\nobj.c.parent = obj;\n", Do.DONE],
      ],
      after: [
        ['obj.a', Do.RECURSE],
        ['obj.a.self', Do.RECURSE],
        ['obj.a.id', Do.RECURSE],
        ['obj.b', Do.DONE],
        ['obj.b.self', Do.DONE],
        ['obj.b.id', Do.UNSTARTED],
        ['obj.c', Do.DONE],
        ['obj.c.id', Do.UNSTARTED],
        ['obj.c.parent', Do.DONE],
      ],
    },

    { // Test recursion that tries to revisit starting object.
      title: 'recursion 2',
      src: `
        var obj = {v: 42};
        obj.obj = obj;
      `,
      dump: [
        ['obj', Do.DONE, 'var obj = {};\n'],
        // TODO(cpcallen): might prefer '...obj.v = 42\n'.
        ['obj.obj', Do.RECURSE, 'obj.obj = obj;\nobj.obj.v = 42;\n'],
        ['obj', Do.RECURSE, ''],
      ],
      after: [
        ['obj.v', Do.RECURSE],
      ],
    },

    { // Test dumping property attributes.
      title: 'attributes',
      src: `
        var obj = {w: {}, e: {}, c: {}};
        Object.defineProperty(obj, 'w', {writable: false});
        Object.defineProperty(obj, 'e', {enumerable: false});
        Object.defineProperty(obj, 'c', {configurable: false});
      `,
      set: ['Object', 'obj'],
      dump: [
        ['obj.w', Do.ATTR, "obj.w = {};\n" +
            "(new 'Object.defineProperty')(obj, 'w', {writable: false});\n"],

        ['Object.defineProperty', Do.SET,
         "Object.defineProperty = new 'Object.defineProperty';\n"],

        ['obj.e', Do.ATTR, "obj.e = {};\n" +
            "Object.defineProperty(obj, 'e', {enumerable: false});\n"],
        ['obj.c', Do.ATTR, "obj.c = {};\n" +
            "Object.defineProperty(obj, 'c', {configurable: false});\n"],
      ],
    },

    { // Test correct dumping inherited-non-writable properties.
      title: 'non-writable',
      src: `
        var parent = {foo: 0};
        var child = [];
        for (var i = 0; i <= 4; i++) {
          child[i] = Object.create(parent);
          child[i].foo = i;
        }
        child[4].foo = undefined;  // Will have DECL do SET implicitly.
        // Make it impossible to set child[i].foo by assignment.
        Object.defineProperty(parent, 'foo', {writable: false});
      `,
      // Object.create is polyfilled; dumper won't call polyfill.
      set: ['Object', 'Object.defineProperty', 'parent', 'child',
            'child[0]', 'child[1]', 'child[2]', 'child[3]', 'child[4]'],
      dump: [
        // Inherited non-writable property doesn't exist yet.
        ['child[0].foo', Do.SET, 'child[0].foo = 0;\n', Do.RECURSE],

        ['parent', Do.RECURSE, 'parent.foo = 0;\n' +
            "Object.defineProperty(parent, 'foo', {writable: false});\n"],

        ['child[1].foo', Do.DECL, "Object.defineProperty(child[1], 'foo', " +
            '{writable: true, enumerable: true, configurable: true});\n'],
        ['child[1].foo', Do.SET, "child[1].foo = 1;\n", Do.RECURSE],

        ['child[2].foo', Do.SET, "Object.defineProperty(child[2], 'foo', " +
            '{writable: true, enumerable: true, configurable: true,' +
            ' value: 2});\n', Do.RECURSE],

        ['child[3].foo', Do.ATTR, "Object.defineProperty(child[3], 'foo', " +
            '{writable: true, enumerable: true, configurable: true,' +
            ' value: 3});\n', Do.RECURSE],

        ['child[4].foo', Do.DECL, "Object.defineProperty(child[4], 'foo', " +
            '{writable: true, enumerable: true, configurable: true});\n',
         Do.RECURSE],
      ],
      after: [
        ['child[0]^', Do.DONE, 'parent'],
        ['child[1]^', Do.DONE, 'parent'],
        ['child[2]^', Do.DONE, 'parent'],
        ['child[3]^', Do.DONE, 'parent'],
        ['child[4]^', Do.DONE, 'parent'],
      ],
    },

    { // Test dumping {proto} bindings.
      title: '{proto}',
      src: `
        var parent = {};
        var child0 = Object.create(parent);
        var child1 = Object.create(parent);
        var child2 = Object.create(parent);
        var child3 = Object.create(parent);
     `,
      set: ['Object'],  // N.B.: Object.create is polyfilled.
      dump: [
        ['child0', Do.DONE, 'var child0 = {};\n'],
        ['child1', Do.DONE, 'var child1 = {};\n'],
        ['child2', Do.DONE, 'var child2 = {};\n'],
        ['parent', Do.DONE, 'var parent = {};\n'],
        ['child3', Do.DONE, "var child3 = (new 'Object.create')(parent);\n"],

        ['child1^', Do.SET, "(new 'Object.setPrototypeOf')(child1, parent);\n",
         Do.DONE],

        ['Object.setPrototypeOf', Do.SET,
         "Object.setPrototypeOf = new 'Object.setPrototypeOf';\n"],

        ['child2^', Do.SET, 'Object.setPrototypeOf(child2, parent);\n',
         Do.DONE],
      ],
      after: [
        ['child0^', Do.DECL],
        ['child1^', Do.DONE, 'parent'],
        ['child2^', Do.DONE, 'parent'],
        ['child3^', Do.DONE, 'parent'],
      ]
    },

    { // Test dumping {proto} bindings: null-protoype objects.
      title: 'null {proto}',
      src: `
        var objs = {obj: {}, fun: function() {}, arr: []};
        for (var p in objs) {
          Object.setPrototypeOf(objs[p], null);
        }
      `,
      set: ['Object', 'Object.setPrototypeOf', 'objs'],
      dump: [
        ['objs.obj', Do.DONE, "objs.obj = (new 'Object.create')(null);\n"],
        ['objs.obj{proto}', Do.DONE, '', Do.RECURSE],
        ['objs.fun', Do.DONE, 'objs.fun = function() {};\n'],
        ['objs.fun{proto}', Do.SET, 'Object.setPrototypeOf(objs.fun, null);\n',
         Do.RECURSE],
        ['objs.arr', Do.DONE, 'objs.arr = [];\n'],
        ['objs.arr{proto}', Do.SET, 'Object.setPrototypeOf(objs.arr, null);\n',
         Do.RECURSE],
      ],
    },

    { // Test dumping {owner} bindings.
      title: '{owner}',
      src: `
        var CC = {};
        CC.root = new 'CC.root';
        var setPerms = new 'setPerms';

        var alice = {};
        alice.thing = (function() {setPerms(alice); return {};})();
        var bob = {};
        bob.thing = {};
        Object.setOwnerOf(bob.thing, bob);
        var unowned = {};
        Object.setOwnerOf(unowned, null);
      `,
      set: ['Object', 'CC', 'CC.root'],
      dump: [
        ['alice', Do.DONE, 'var alice = {};\n'],
        ['alice.thing', Do.DONE, 'alice.thing = {};\n'],
        ['alice.thing{owner}', Do.SET, "(new 'Object.setOwnerOf')" +
            '(alice.thing, alice);\n', Do.DONE],
        ['Object.setOwnerOf', Do.SET,
         "Object.setOwnerOf = new 'Object.setOwnerOf';\n"],
        ['bob', Do.RECURSE, 'var bob = {};\nbob.thing = {};\n' +
            "Object.setOwnerOf(bob.thing, bob);\n"],
        ['unowned', Do.SET, 'var unowned = {};\n', Do.DONE],
        ['unowned{owner}', Do.SET, 'Object.setOwnerOf(unowned, null);\n',
         Do.RECURSE],
      ],
      after: [
        ['alice', Do.DONE],
        ['alice{owner}', Do.DONE, 'CC.root'],
        ['alice.thing{owner}', Do.DONE, 'alice'],
        ['bob', Do.RECURSE],
        ['bob{owner}', Do.RECURSE, 'CC.root'],
        ['bob.thing{owner}', Do.RECURSE, 'bob'],
      ],
    },

    { // Test dumping extensibility.
      title: 'extensibility',
      src: `
        var obj1 = {id: 1};
        var obj2 = {id: 2};
        Object.preventExtensions(obj1);
        Object.preventExtensions(obj2);
      `,
      set: ['Object', 'obj1', 'obj2'],
      dump: [
        ['obj1.id', Do.SET, 'obj1.id = 1;\n', Do.RECURSE],
        ['obj1', Do.RECURSE, "(new 'Object.preventExtensions')(obj1);\n"],

        ['Object.preventExtensions', Do.SET,
         "Object.preventExtensions = new 'Object.preventExtensions';\n",],

        // Verify property set before extensibility prevented.
        ['obj2', Do.RECURSE, 'obj2.id = 2;\nObject.preventExtensions(obj2);\n'],
      ],
    },

    { // Test (not) dumping immutable bindings in the global scope.
      title: 'immutables',
      dump: [
        ['NaN', Do.RECURSE, ''],
        ['Infinity', Do.RECURSE, ''],
        ['undefined', Do.RECURSE, ''],
        ['eval', Do.RECURSE, ''],
      ],
    },

    { // Test dumping Function objects.
      title: 'Function',
      src: `
        var Function = new 'Function';

        function f1(arg) {}
        var f2 = function F2(arg) {};
        var obj = {f3: function() {}};
        var f4 = new Function('a1', 'a2,a3', 'a4, a5', '');
      `,
      set: ['obj'],
      dump: [
        // BUG(cpcallen): Really want 'function f1(arg) {};\n'.
        ['f1', Do.SET, 'var f1 = function f1(arg) {};\n', Do.DONE],
        // BUG(cpcallen): this causes a crash.
        // ['f1', Do.RECURSE, '', Do.RECURSE],
        ['f2', Do.SET, 'var f2 = function F2(arg) {};\n', Do.DONE],
        ['obj.f3', Do.SET, 'obj.f3 = function() {};\n', Do.DONE],
        // BUG(cpcallen): Really want '... = Function(...', due to scoping.
        ['f4', Do.SET, 'var f4 = function(a1,a2,a3,a4, a5) {};\n', Do.DONE],
        // TODO(ES5): verify that f4.name gets deleted.
      ],
      after: [
        ['f1^', Do.DONE],
        ['f1.length', Do.RECURSE],
        ['f1.name', Do.RECURSE],
        ['f1.prototype', Do.DONE, 'f1.prototype'],
        ['f1.prototype.constructor', Do.DONE, 'f1'],
        ['f2^', Do.DONE],
        ['f2.length', Do.RECURSE],
        ['f2.name', Do.RECURSE],
        ['f2.prototype', Do.DONE, 'f2.prototype'],
        ['f2.prototype.constructor', Do.DONE, 'f2'],
        ['obj.f3^', Do.DONE],
        ['obj.f3.length', Do.RECURSE],
        ['obj.f3.name', Do.UNSTARTED],  // N.B.: not implicitly set.
        ['obj.f3.prototype', Do.DONE, 'obj.f3.prototype'],
        ['obj.f3.prototype.constructor', Do.DONE, 'obj.f3'],
        ['f4^', Do.DONE],
        // TODO(ES6): verify that f4.name is implicitly set to 'anonymous'.
        ['f4.length', Do.RECURSE],
        ['f4.prototype', Do.DONE, 'f4.prototype'],
        ['f4.prototype.constructor', Do.DONE, 'f4'],
      ],
    },

    { // Test Function objects with usable and unusable .prototype
      // objects.  Note that we don't need to worry about the
      // attributes of the .prototype property, because a function
      // object's .prototype is always non-configurable.
      title: 'Function .prototype',
      src: `
        var f1 = function() {};
        var f2 = function() {};
        var f3 = function() {};
        var obj1 = f1.prototype;
        var obj2 = f2.prototype;
        f3.prototype = [];
      `,
      set: ['Object', 'Object.defineProperty'],
      dump: [
        // No problem if f1 dumped before obj1.
        ['f1', Do.RECURSE, 'var f1 = function() {};\n'],
        ['obj1', Do.DONE, 'var obj1 = f1.prototype;\n'],
        // Surmountable difficulty if obj2 dumped before f2.
        ['obj2', Do.DONE, 'var obj2 = {};\n'],
        ['f2', Do.DONE, 'var f2 = function() {};\n'],
        ['f2.prototype', Do.DONE, 'f2.prototype = obj2;\n'],
        ['f2', Do.RECURSE, 'f2.prototype.constructor = f2;\n' +
            "Object.defineProperty(f2.prototype, 'constructor', " +
            '{enumerable: false});\n'],
        // Non-plain-Object .protype values require special handling too.
        ['f3', Do.DONE, 'var f3 = function() {};\n'],
        ['f3', Do.RECURSE, 'f3.prototype = [];\n'],
      ],
      after: [
        ['obj1', Do.DONE, 'f1.prototype'],  // Var not RECURSEed (only object).
        ['f1.prototype.constructor', Do.RECURSE, 'f1'],
        ['f2.prototype', Do.RECURSE, 'obj2'],
        ['f2.prototype.constructor', Do.RECURSE, 'f2'],
      ],
    },

    { // Test dumping Function objects' .prototype.constructor property.
      title: 'Function .prototype.constructor',
      src: `
        var f1 = function() {};
        var f2 = function() {};
        var f3 = function() {};
        Object.defineProperty(f2.prototype, 'constructor',
                              {enumerable: true});
        Object.defineProperty(f3.prototype, 'constructor',
                              {writable: false, value: 42});
      `,
      set: ['Object', 'Object.defineProperty', 'f1', 'f2', 'f3'],
      dump: [
        ['f3.prototype', Do.DONE, ''],
        ['f3.prototype.constructor', Do.SET,
         'f3.prototype.constructor = 42;\n'],
        ['f3.prototype', Do.RECURSE, 'Object.defineProperty(f3.prototype, ' +
            "'constructor', {writable: false});\n"],
      ],
      after: [
        ['f1.prototype.constructor', Do.DONE],
        ['f2.prototype.constructor', Do.SET],
      ],
    },

    { // Test dumping Function objects' .name property.
      title: 'Function .name',
      src: `
        var f1 = function() {};
        var f2 = function() {};
        Object.defineProperty(f1, 'name', {value: 'Hi!'});
        delete f2.name;
      `,
      set: ['Object', 'Object.defineProperty', 'f1', 'f2'],
      dump: [
        ['f1', Do.RECURSE, "Object.defineProperty(f1, 'name', " +
            "{value: 'Hi!'});\n"],
        ['f2', Do.RECURSE, 'delete f2.name;\n'],
      ],
    },

    { // Test dumping Array objects.
      title: 'Array',
      src: `
        var Array = new 'Array';

        var obj = {};
        var arr = [42, 69, 105, obj, {}];
        var sparse = [0, , 2];
        Object.setPrototypeOf(sparse, null);
        sparse.length = 4;
      `,
      set: ['Object', 'Object.setPrototypeOf', 'obj'],
      dump: [
        // TODO(cpcallen): really want 'var arr = [42, 69, 105, obj, {}];\n'.
        ['arr', Do.RECURSE, 'var arr = [];\narr[0] = 42;\narr[1] = 69;\n' +
            'arr[2] = 105;\narr[3] = obj;\narr[4] = {};\n'],
        // TODO(cpcallen): really want something like
        //     'var sparse = [0, , 2];\nsparse.length = 4;'.
        ['sparse', Do.RECURSE, 'var sparse = [];\n' +
            'Object.setPrototypeOf(sparse, null);\n' +
            'sparse[0] = 0;\nsparse[2] = 2;\nsparse.length = 4;\n'],
      ],
      after: [
        ['arr^', Do.RECURSE],
        ['arr.length', Do.RECURSE],
        ['sparse^', Do.RECURSE],
        ['sparse.length', Do.RECURSE],
      ],
    },

    { // Test dumping Date objects.
      title: 'Date',
      src: `
        var Date = new 'Date';

        var date1 = new Date('1975-07-27');
        var date2 = new Date('1979-01-04');
      `,
      dump: [
        ['date1', Do.SET,
         "var date1 = new (new 'Date')('1975-07-27T00:00:00.000Z');\n",
         Do.DONE],
        ['Date', Do.SET, "var Date = new 'Date';\n", Do.DONE],
        ['date2', Do.SET, "var date2 = new Date('1979-01-04T00:00:00.000Z');\n",
         Do.DONE],
      ],
      after: [
        ['date1^', Do.DONE],
        ['date2^', Do.DONE],
      ],
    },

    { // Test dumping RegExp objects.
      title: 'RegExp',
      src: `
        var RegExp = new 'RegExp';

        var re0 = new RegExp();
        var re1 = /foo/ig;
        var re2 = /bar/g;
        Object.setPrototypeOf(re2, re1);
        re2.lastIndex = 42;
        var re3 = /baz/m;
        Object.setPrototypeOf(re3, re1);
      `,
      set: ['Object', 'Object.setPrototypeOf'],
      dump: [
        ['re0', Do.SET, 'var re0 = /(?:)/;\n', Do.DONE],
        ['re1', Do.SET, 'var re1 = /foo/gi;\n', Do.DONE],
        ['re2', Do.RECURSE, 'var re2 = /bar/g;\n' +
            'Object.setPrototypeOf(re2, re1);\n' +
            're2.lastIndex = 42;\n'],
        ['re3', Do.SET, 'var re3 = /baz/m;\n', Do.DONE],
        ['re3^', Do.SET, 'Object.setPrototypeOf(re3, re1);\n', Do.DONE],
      ],
      after: [
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
        ['re3.source', Do.RECURSE],
        ['re3.global', Do.RECURSE],
        ['re3.ignoreCase', Do.RECURSE],
        ['re3.multiline', Do.RECURSE],
        ['re3.lastIndex', Do.RECURSE],
      ],
    },

    { // Test dumping Error objects.
      title: 'Error',
      src: `
        var Error = new 'Error';
        var TypeError = new 'TypeError';
        var RangeError = new 'RangeError';

        var error1 = new Error('message1');
        error1.stack = 'stack1';  // Because it's otherwise kind of random.
        var error2 = new TypeError('message2');
        error2.stack = 'stack2';
        var error3 = new RangeError();
        Object.setPrototypeOf(error3, error1);
        error3.message = 69;
        Object.defineProperty(error3, 'message', {writable: false});
        delete error3.stack;
      `,
      set: ['Object', 'Object.defineProperty', 'Object.setPrototypeOf'],
      dump: [
        ['error1', Do.SET, "var error1 = new (new 'Error')('message1');\n",
         Do.DONE],
        ['error1', Do.RECURSE, "error1.stack = 'stack1';\n"],
        ['Error', Do.SET, "var Error = new 'Error';\n", Do.DONE],
        ['TypeError', Do.SET, "var TypeError = new 'TypeError';\n", Do.DONE],
        ['RangeError', Do.SET, "var RangeError = new 'RangeError';\n", Do.DONE],
        ['error2', Do.SET, "var error2 = new TypeError('message2');\n",
         Do.DONE],
        ['error2', Do.RECURSE, "error2.stack = 'stack2';\n"],
        ['error3', Do.SET, 'var error3 = new Error();\n', Do.DONE],
        ['error3.message', Do.ATTR, 'error3.message = 69;\n' +
            "Object.defineProperty(error3, 'message', {writable: false});\n",
         Do.RECURSE],
        ['error3', Do.RECURSE, 'delete error3.stack;\n' +
            'Object.setPrototypeOf(error3, error1);\n'],
      ],
      after: [
        ['error1.message', Do.RECURSE],
        ['error2.message', Do.RECURSE],
      ],
    },

    { // Test dumping builtin objects.
      title: 'Builtins',
      src: '',
      dump: [
        ['Object', Do.DONE, "var Object = new 'Object';\n"],
        ['Object.prototype', Do.SET,
         "Object.prototype = new 'Object.prototype';\n"],
      ],
    },
  ];

  for (const tc of cases) {
    const prefix = 'dumpBinding: ' + tc.title + ': ';

    // Create Interprerter and objects to dump.  Run minimal common
    // init then any testcase-specific init source.
    const intrp = new Interpreter();
    intrp.createThreadForSrc(common);
    if (tc.src) intrp.createThreadForSrc(tc.src);
    intrp.run();

    // Create Dumper with pristine Interpreter instance to compare to.
    const pristine = new Interpreter();
    const dumper = new Dumper(pristine, intrp);

    // Set a few object .done flags in advance, to limit recursive
    // dumping of builtins in tests.
    for (const builtin of [intrp.OBJECT, intrp.FUNCTION, intrp.ARRAY,
                           intrp.REGEXP, intrp.ERROR, intrp.TYPE_ERROR,
                           intrp.RANGE_ERROR]) {
      /** @suppress {accessControls} */
      dumper.getObjectDumper_(builtin).done = ObjectDumper.Done.DONE_RECUSIVELY;
    };
    // Set a few binding .done flags in advance to simulate things
    // already being dumped or being marked for deferred dumping.
    for (const ss of tc.prune || []) {
      dumper.prune(new Selector(ss));
    }
    for (const ss of tc.skip || []) {
      dumper.skip(new Selector(ss));
    }
    for (const ss of tc.set || []) {
      dumper.dumpBinding(new Selector(ss), Do.SET);
    }

    // Check generated output for (and post-dump status of) specific bindings.
    for (const [ss, todo, expected, done] of tc.dump || []) {
      const s = new Selector(ss);
      // Dump binding and check output code.
      const result = new MockWritable();
      dumper.setOptions({output: result});
      dumper.unskip(s);
      dumper.dumpBinding(s, todo);
      t.expect(util.format('%sDumper.p.dumpBinding(<%s>, %o)', prefix,
                           s, todo), String(result), expected);
      // Check work recorded.
      /** @suppress {accessControls} */
      const {dumper: d, part} = dumper.getComponentsForSelector_(s);
      t.expect(util.format('%sBinding status of <%s> (after dump)', prefix, s),
               d.getDone(part), done === undefined ? todo : done);
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
    for (const [ss, done, valueRef] of tc.after || []) {
      const s = new Selector(ss);
      /** @suppress {accessControls} */
      const {dumper: d, part} = dumper.getComponentsForSelector_(s);
      t.expect(util.format('%sbinding status of <%s> (implicit)', prefix, s),
               d.getDone(part), done);
      if (valueRef) {
        /** @suppress {accessControls} */
        const c = dumper.getComponentsForSelector_(s);
        const value = c.dumper.getValue(dumper, c.part);
        if (value instanceof intrp.Object) {
          /** @suppress {accessControls} */
          const objDumper = dumper.getObjectDumper_(value);
          t.expect(util.format('%sref for %s', prefix, s),
                   String(objDumper.ref), valueRef);
        } else {
          t.fail(prefix, util.format('%s did not evaluate to an object', s));
        }
      }
    }
  }
};

/**
 * Tests for the ScopeDumper.prototype.dump method.
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
  const dumper = new Dumper(pristine, intrp);
  /** @suppress {accessControls} */
  const globalDumper = dumper.getScopeDumper_(intrp.global);

  // Dump one binding and check result.
  let result = new MockWritable();
  dumper.setOptions({output: result});
  globalDumper.dumpBinding(dumper, 'obj', Do.SET);
  t.expect("ScopeDumper.p.dumpBinding(..., 'obj', Do.SET, ...) outputs",
           String(result), "var obj = (new 'Object.create')(null);\n");

  // Dump the rest & check result.
  dumper.setOptions({output: (result = new MockWritable())});
  globalDumper.dump(dumper);
  t.expect('ScopeDumper.p.dump(...) outputs', String(result),
           'var value = 42;\nobj.prop = 69;\n');
};

/**
 * Unit tests for Dumper.prototype.warn
 * @param {!T} t The test runner object.
 */
exports.testDumperPrototypeWarn = function(t) {
  const intrp = new Interpreter();
  const dumper = new Dumper(intrp, intrp, {verbose: false});
  const output = new MockWritable();
  dumper.setOptions({output: output});
  dumper.warn('1');
  dumper.warn('2\n');
  dumper.indent = '  ';
  dumper.warn('3\n4');
  t.expect('Dumper.prototype.warn(...) output', String(output),
           '// 1\n// 2\n  // 3\n  // 4\n');
};
