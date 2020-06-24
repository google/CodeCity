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
 * @fileoverview Unit tests for internal functions of JavaScript interpreter.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const util = require('util');

const Interpreter = require('../interpreter');
const {T} = require('./testing');

/**
 * Unit tests for Interpreter.toInteger, .toLength. and .toUint32
 * @param {!T} t The test runner object.
 */
exports.testToIntegerEtc = function(t) {
  const intrp = new Interpreter;
  const cases = [
    // [value, ToInteger(value), ToLength(value), ToUint32(value)]
    [false, 0, 0, 0],
    [true, 1, 1, 1],

    [0, 0, 0, 0],
    [-0, -0, 0, 0],
    [1, 1, 1, 1],
    [-1, -1, 0, 0xffffffff],
    [0xfffffffe, 0xfffffffe, 0xfffffffe, 0xfffffffe],
    [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff],
    [0x100000000, 0x100000000, 0x100000000, 0],
    [4.5, 4, 4, 4],
    [2**53-1, 2**53-1, 2**53-1, 0xffffffff],
    [2**53, 2**53, 2**53-1, 0],
    [Infinity, Infinity, 2**53-1, 0],
    [-Infinity, -Infinity, 0, 0],
    [NaN, 0, 0, 0],

    ['0', 0, 0, 0],
    ['-0', -0, 0, 0],
    ['1', 1, 1, 1],
    ['-1', -1, 0, 0xffffffff],
    ['0xfffffffe', 0xfffffffe, 0xfffffffe, 0xfffffffe],
    ['0xffffffff', 0xffffffff, 0xffffffff, 0xffffffff],
    ['0x100000000', 0x100000000, 0x100000000, 0],
    ['4294967294', 0xfffffffe, 0xfffffffe, 0xfffffffe],
    ['4294967295', 0xffffffff, 0xffffffff, 0xffffffff],
    ['4294967296',  0x100000000, 0x100000000, 0],
    ['4.5', 4, 4, 4],
    ['9007199254740991', 2**53-1, 2**53-1, 0xffffffff],
    ['9007199254740992', 2**53, 2**53-1, 0],

    ['hello', 0, 0, 0],
    [null, 0, 0, 0],
    [undefined, 0, 0, 0],
    [new intrp.Array, 0, 0, 0],
    [new intrp.Object, 0, 0, 0],
  ];
  const funcs =
      [Interpreter.toInteger, Interpreter.toLength, Interpreter.toUint32];
  for (const [input, ...expected] of cases) {
    for (let i = 0; i < funcs.length; i++) {
      const name =  util.format('%s(%o)', funcs[i].name, input);
      t.expect(name, funcs[i](input), expected[i]);
    }
  }
};

/**
 * Unit tests for Interpreter.prototype.nativeToPseudo.
 * @param {!T} t The test runner object.
 */
exports.testNativeToPseudo = function(t) {
  const intrp = new Interpreter;

  // Test handling of Arrays (including extra non-index properties).
  const props = {0: 0, 1: 1, 2: 2, length: 3, extra: 4};
  const arr = [];
  for (const k in props) {
    if (!props.hasOwnProperty(k)) continue;
    arr[/** @type{?} */(k)] = props[k];
  }
  const pArr = intrp.nativeToPseudo(arr, intrp.ROOT);
  for (const k in props) {
    if (!props.hasOwnProperty(k)) continue;
    const name = 'testNativeToPseudo(array)["' + k + '"]';
    const r = pArr.get(k, intrp.ROOT);
    t.expect(name, r, props[k]);
  }

  // Test handling of Errors.
  const cases = [
    [Error, intrp.ERROR],
    [EvalError, intrp.EVAL_ERROR],
    [RangeError, intrp.RANGE_ERROR],
    [ReferenceError, intrp.REFERENCE_ERROR],
    [SyntaxError, intrp.SYNTAX_ERROR],
    [TypeError, intrp.TYPE_ERROR],
    [URIError, intrp.URI_ERROR],
  ];
  for (const [Err, proto] of cases) {
    const name = 'testNativeToPseudo(' + Err.prototype.name + ')';
    const errMessage = 'test ' + Err.prototype.name;
    const error = Err(errMessage);
    const pError = intrp.nativeToPseudo(error, intrp.ROOT);

    t.expect(name + ' instanceof intrp.Error',
        pError instanceof intrp.Error, true);
    t.expect(name + '.proto', pError.proto, proto);
    t.expect(name + '.message', pError.get('message', intrp.ROOT), errMessage);
    t.expect(name + '.stack', pError.get('stack', intrp.ROOT), error.stack);
  }
};

/**
 * Unit tests for Interpreter.Scope class.
 * @param {!T} t The test runner object.
 */
exports.testScope = function(t) {
  const intrp = new Interpreter;
  const outer = new Interpreter.Scope(
      Interpreter.Scope.Type.DUMMY, intrp.ROOT, null, 'this');
  const inner = new Interpreter.Scope(
      Interpreter.Scope.Type.DUMMY, intrp.ROOT, outer);

  // 0: Initial condition.
  t.expect("outer.this  // 0", outer.this, 'this');
  t.expect("inner.this  // 0", inner.this, 'this');
  t.expect("outer.hasBinding('foo')  // 0", outer.hasBinding('foo'), false);
  t.expect("outer.resolve('foo')  // 0", outer.resolve('foo'), null);
  t.expect("inner.resolve('foo')  // 0", inner.resolve('foo'), null);

  // 1: Create outer binding.
  outer.createMutableBinding('foo', 42);
  t.expect("outer.hasBinding('foo')  // 1", outer.hasBinding('foo'), true);
  t.expect("inner.hasBinding('foo')  // 1", inner.hasBinding('foo'), false);
  t.expect("outer.resolve('foo')  // 1", outer.resolve('foo'), outer);
  t.expect("inner.resolve('foo')  // 1", inner.resolve('foo'), outer);
  t.expect("outer.get('foo')  // 1", outer.get('foo'), 42);
  t.expect("getValueFromScope(outer, 'foo', ...)  // 1",
      intrp.getValueFromScope(outer, 'foo'), 42);
  t.expect("getValueFromScope(inner, 'foo', ...)  // 1",
      intrp.getValueFromScope(inner, 'foo'), 42);

  try {
    outer.createMutableBinding('foo', 42);
    t.fail("outer.createMutableBinding('foo', ...)  // 1", "Didn't throw.");
  } catch (e) {
    t.pass("outer.createMutableBinding('foo', ...)  // 1");
  }

  // 2: Set outer binding.
  outer.set('foo', 69);
  t.expect("outer.get('foo')  // 2", outer.get('foo'), 69);
  t.expect("getValueFromScope(inner, 'foo', ...)  // 2",
      intrp.getValueFromScope(inner, 'foo'), 69);
  t.expect("getValueFromScope(outer, 'foo', ...)  // 2",
      intrp.getValueFromScope(outer, 'foo'), 69);

  // 3: Create inner binding.
  inner.createImmutableBinding('foo', 105);
  t.expect("outer.hasBinding('foo')  // 3", outer.hasBinding('foo'), true);
  t.expect("inner.hasBinding('foo')  // 3", inner.hasBinding('foo'), true);
  t.expect("outer.resolve('foo')  // 3", outer.resolve('foo'), outer);
  t.expect("inner.resolve('foo')  // 3", inner.resolve('foo'), inner);
  t.expect("outer.get('foo')  // 3", outer.get('foo'), 69);
  t.expect("inner.get('foo')  // 3", inner.get('foo'), 105);
  t.expect("getValueFromScope(inner, 'foo', ...)  // 3",
      intrp.getValueFromScope(inner, 'foo'), 105);
  t.expect("getValueFromScope(outer, 'foo', ...)  // 3",
      intrp.getValueFromScope(outer, 'foo'), 69);

  // 4: Try to create duplicate binding.
  try {
    outer.createMutableBinding('foo', 17);
    t.fail("outer.createMutableBinding('foo', ...)  // 4", "Didn't throw.");
  } catch (e) {
    t.pass("outer.createMutableBinding('foo', ...)  // 4");
  }

  // 5: Try to set immutable binding (two different ways)
  t.assert("inner.set('foo', 37) instanceof TypeError",
           inner.set('foo', 37) instanceof TypeError);
  try {
    intrp.setValueToScope(inner, 'foo', 37);
    t.fail("setValueToScope(inner, 'foo', 37, ...)  // 5", "Didn't throw.");
  } catch (e) {
    t.pass("setValueToScope(inner, 'foo', 37, ...)  // 5");
  }
};

/**
 * Unit tests for Interpreter.Source class.
 * @param {!T} t The test runner object.
 */
exports.testSource = function(t) {
  let src = new Interpreter.Source('ABCDEF');
  let name = "Source('ABCDEF')";

  src = src.slice(0, 6);
  t.expect(name + '.toString()', String(src), 'ABCDEF');

  src = src.slice(1, 5);
  name += '.slice(1, 5)';
  t.expect(name + '.toString()', String(src), 'BCDE');

  src = src.slice(2, 4);
  name += '.slice(2, 4)';
  t.expect(name + '.toString()', String(src), 'CD');

  const s = '1\n.2\n..3\n.4\n5\n';
  const pos3 = s.indexOf('3');
  src = new Interpreter.Source(s);
  name = util.format('Source(%o)', s);
  let lc = src.lineColForPos(pos3);
  t.expect(name + '.lineColForPos(' + pos3 + ').line', lc.line, 3);
  t.expect(name + '.lineColForPos(' + pos3 + ').col', lc.col, 3);

  src = src.slice(2, 12);
  name += '.slice(2, 12)';
  lc = src.lineColForPos(pos3);
  t.expect(name + '.lineColForPos(' + pos3 + ').line', lc.line, 2);
  t.expect(name + '.lineColForPos(' + pos3 + ').col', lc.col, 3);

  src = src.slice(2, 12);
  name += '.slice(2, 12)';
  lc = src.lineColForPos(pos3);
  t.expect(name + '.toString()', String(src), '.2\n..3\n.4\n');

  t.expect(name + '.lineColForPos(' + pos3 + ').line', lc.line, 2);
  t.expect(name + '.lineColForPos(' + pos3 + ').col', lc.col, 3);

  src = new Interpreter.Source('startBound').slice(0, 5).slice(0, 0);
  name = "Source('startBound').slice(0, 5).slice(0, 0)";
  lc = src.lineColForPos(0);
  t.expect(name + '.lineColForPos(0).line', lc.line, 1);
  t.expect(name + '.lineColForPos(0).col', lc.line, 1);
  t.expect(name + '.toString()', String(src), '');

  src = new Interpreter.Source('endBound').slice(3, 8).slice(8, 8);
  name = "Source('endBound').slice(3, 8).slice(8, 8)";
  lc = src.lineColForPos(8);
  t.expect(name + '.lineColForPos(8).line', lc.line, 1);
  t.expect(name + '.lineColForPos(8).col', lc.line, 1);
  t.expect(name + '.toString()', String(src), '');
};
