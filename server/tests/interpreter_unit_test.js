/**
 * @license
 * Code City: Interpreter internal unit tests
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
 * @fileoverview Unit tests for internal functions of JavaScript interpreter.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const util = require('util');

const Interpreter = require('../interpreter');

/**
 * Unit tests for Interpreter.toInteger, .toLength. and .toUint32
 * @param {!T} t The test runner object.
 */
exports.testToIntegerEtc = function(t) {
  var intrp = new Interpreter;
  var cases = [
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
  var funcs = [Interpreter.toInteger,
               Interpreter.toLength,
               Interpreter.toUint32];
  for (var i = 0; i < cases.length; i++) {
    var tc = cases[i];
    for (var j = 0; j < funcs.length; j++) {
      var name =  util.format('%s(%o)', funcs[j].name, tc[0]);
      var r = funcs[j](tc[0]);
      if (Object.is(r, tc[j + 1])) {
        t.pass(name);
      } else {
        t.fail(name, util.format('got: %o  want: %o', r, tc[j + 1]));
      }
    }
  }
};

/**
 * Unit tests for Interpreter.prototype.nativeToPseudo.
 * @param {!T} t The test runner object.
 */
exports.testNativeToPseudo = function(t) {
  var check = function(feature, result, expected) {
    if (Object.is(result, expected)) {
      t.pass(name + feature);
    } else {
      t.fail(name + feature,
          util.format('got %o  want %o', result, expected));
    }
  };

  var intrp = new Interpreter;

  // Test handling of Arrays (including extra non-index properties).
  var props = {0: 0, 1: 1, 2: 2, length: 3, extra: 4};
  var arr = [];
  for (var k in props) {
    if (!props.hasOwnProperty(k)) continue;
    arr[k] = props[k];
  }
  var pArr = intrp.nativeToPseudo(arr);
  for (var k in props) {
    if (!props.hasOwnProperty(k)) continue;
    var name = 'testNativeToPseudo(array)["' + k + '"]';
    var r = pArr.get(k, intrp.ROOT);
    check('.' + k, r, props[k]);
  }

  // Test handling of Errors.
  var cases = [
    [Error, intrp.ERROR],
    [EvalError, intrp.EVAL_ERROR],
    [RangeError, intrp.RANGE_ERROR],
    [ReferenceError, intrp.REFERENCE_ERROR],
    [SyntaxError, intrp.SYNTAX_ERROR],
    [TypeError, intrp.TYPE_ERROR],
    [URIError, intrp.URI_ERROR],
  ];
  for (var i = 0, tc; tc = cases[i], i < cases.length; i++) {
    var Err = tc[0], proto = tc[1];
    var name = 'testNativeToPseudo(' + Err.prototype.name + ')';
    var errName, errMessage = 'test ' + Err.prototype.name;
    var error = Err(errMessage);
    var pError = intrp.nativeToPseudo(error);

    check(' instanceof intrp.Error', pError instanceof intrp.Error, true);
    check('.proto', pError.proto, proto);
    check('.message', pError.get('message', intrp.ROOT), errMessage);
    check('.stack', pError.get('stack', intrp.ROOT), error.stack);
  }
};
