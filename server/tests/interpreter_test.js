/**
 * @license
 * Code City: Interpreter JS Tests
 *
 * Copyright 2017 Google Inc.
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
 * @fileoverview Tests for JavaScript interpreter.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

var util = require('util');

var Interpreter = require('../');
var autoexec = require('../autoexec');
var testcases = require('./testcases');

/**
 * Run a test of the interpreter.
 * @param {!T} t The test runner object.
 * @param {string} name The name of the test.
 * @param {string} src The code to be evaled.
 * @param {number|string|boolean|null|undefined} expected The expected
 *     completion value.
 */
function runTest(t, name, src, expected) {
  var interpreter = new Interpreter();
  interpreter.appendCode(autoexec);
  interpreter.run();

  var err = undefined;
  try {
    interpreter.appendCode(src);
    interpreter.run();
  } catch (e) {
    err = e;
  }
  var r = interpreter.pseudoToNative(interpreter.value);

  if (err) {
    t.crash(name, util.format('%s\n%s', src, err.stack));
  } else if (r !== expected) {
    t.fail(name, util.format('%s\ngot: %j  want: %j', src, r, expected));
  } else {
    t.pass(name);
  }
  return true;
}

/**
 * Run the simple tests in testcases.js
 * @param {T} t The test runner object.
 */
exports.testSimple = function(t) {
  for (var i = 0; i < testcases.length; i++) {
    var tc = testcases[i];
    if ('expected' in tc) {
      runTest(t, tc.name, tc.src, tc.expected);
    } else {
      t.skip(tc.name);
    }
  }
};

/**
 * Run some tests of the various constructors and their associated
 * literals and prototype objects.
 * @param {T} t The test runner object.
 */
exports.testClasses = function(t) {
  var classes = {
    Object: {
      prototypeProto: 'null',
      literal: '{}'
    },
    Function: {
      prototypeType: 'function',
      listeral: 'function(){}'
    },
    Array: {
      literal: '[]'
    },
    RegExp: {
      prototypeClass: 'Object', // Was 'RegExp' in ES5.1.
      literal: '/foo/'
    },
    Date: {
      prototypeClass: 'Object' // Was 'RegExp' in ES5.1.
    },
    Error: {},
    EvalError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    RangeError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    ReferenceError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    SyntaxError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    TypeError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    URIError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    Boolean: {
      literal: 'false',
      literalType: 'boolean',
      noInstance: true,
    },
    Number: {
      literal: '42',
      literalType: 'number',
      noInstance: true,
    },
    String: {
      literal: '"hello"',
      literalType: 'string',
      noInstance: true,
    },
  };   
  for (var c in classes) {
    var name, src, tc = classes[c];
    // Check constructor is a function:
    name = c + 'IsFunction';
    src = 'typeof ' + c + ';';
    runTest(t, name, src, 'function');
    // Check constructor's proto is Function.prototype
    name = c + 'ProtoIsFunctionPrototype';
    src = 'Object.getPrototypeOf(' + c + ') === Function.prototype;';
    runTest(t, name, src, true);
    // Check prototype is of correct type:
    var prototypeType = (tc.prototypeType || 'object');
    name = c + 'PrototypeIs' + prototypeType
    src = 'typeof ' + c + '.prototype;';
    runTest(t, name, src, prototypeType);
    // Check prototype has correct class:
    var prototypeClass = (tc.prototypeClass || tc.class || c);
    name = c + 'PrototypeClassIs' + prototypeClass;
    src = 'Object.prototype.toString.apply(' + c + '.prototype);';
    runTest(t, name, src, '[object ' + prototypeClass + ']');
    // Check prototype has correct proto:
    var prototypeProto = (tc.prototypeProto || 'Object.prototype');
    name = c + 'PrototypeProtoIs' + prototypeProto;
    src = 'Object.getPrototypeOf(' + c + '.prototype) === ' +
        prototypeProto + ';';
    runTest(t, name, src, true);
    // Check prototype's .constructor is constructor:
    name = c + 'PrototypeConstructorIs' + c;
    src = c + '.prototype.constructor === ' + c + ';';
    runTest(t, name, src, true);

    var cls = tc.class || c;
    if (!tc.noInstance) {
      // Check instance's type:
      name = c + 'InstanceIs' + prototypeType;
      src = 'typeof (new ' + c + ');';
      runTest(t, name, src, prototypeType);
      // Check instance's proto:
      name = c + 'InstancePrototypeIs' + c + 'Prototype';
      src = 'Object.getPrototypeOf(new ' + c + ') === ' + c + '.prototype;';
      runTest(t, name, src, true);
      // Check instance's class:
      name = c + 'InstanceClassIs' + cls,
      src = 'Object.prototype.toString.apply(new ' + c + ');';
      runTest(t, name, src, '[object ' + cls + ']');
    }
    if (tc.literal) {
      // Check literal's type:
      var literalType = (tc.literalType || prototypeType);
      name = c + 'LiteralIs' + literalType;
      src = 'typeof (' + tc.literal + ');';
      runTest(t, name, src, literalType);
      // Check literal's proto:
      name = c + 'LiteralPrototypeIs' + c + 'Prototype';
      src = 'Object.getPrototypeOf(' + tc.literal + ') === ' + c +
          '.prototype;';
      runTest(t, name, src, true);
      // Check literal's class:
      name = c + 'LiteralClassIs' + cls,
      src = 'Object.prototype.toString.apply(' + tc.literal + ');';
      runTest(t, name, src, '[object ' + cls + ']');
    }
  }
};

/**
 * Run some tests of switch statement with fallthrough.
 * @param {T} t The test runner object.
 */
exports.testSwitchStatementFallthrough = function(t) {
  var code = `
      var x = 0;
      switch (i) {
        case 1:
          x += 1;
          // fall through
        case 2:
          x += 2;
          // fall through
        default:
          x += 16;
          // fall through
        case 3:
          x += 4;
          // fall through
        case 4:
          x += 8;
          // fall through
      }
      x;`;
  var expected = [28, 31, 30, 12, 8];
  for (var i = 0; i < expected.length; i++) {
    var src = 'var i = ' + i + ';\n' + code;
    runTest(t, 'switch fallthrough ' + i, src, expected[i]);
  }
};

/**
 * Run some tests of switch statement completion values.
 * @param {T} t The test runner object.
 */
exports.testSwitchStatementBreaks = function(t) {
  var code = `
      foo: {
        switch (i) {
          case 1:
            10;
            // fall through
          case 2:
            20;
            break;
          default:
            50;
            // fall through
          case 3:
            30;
            break foo;
          case 4:
            40;
        }
      }`;
  var expected = [30, 20, 20, 30, 40];
  for (var i = 0; i < expected.length; i++) {
    var src = 'var i = ' + i + ';\n' + code;
    runTest(t, 'switch completion ' + i, src, expected[i]);
  }
};

/**
 * Run some tests of the Abstract Relational Comparison Algorithm, as
 * defined in §11.8.5 of the ES5.1 spec and as embodied by the '<'
 * operator.
 * @param {T} t The test runner object.
 */
exports.testArca = function(t) {
  var cases = [
    ['0, NaN', undefined],
    ['NaN, NaN', undefined],
    ['NaN, 0', undefined],
    
    ['1, 1', false],
    ['0, -0', false],
    ['-0, 0', false],
    
    ['Infinity, Number.MAX_VALUE', false],
    ['Number.MAX_VALUE, Infinity', true],
    ['-Infinity, -Number.MAX_VALUE', true],
    ['-Number.MAX_VALUE, -Infinity', false],
    
    ['1, 2', true],
    ['2, 1', false],
    
    // String comparisons:
    ['"", ""', false],
    ['"", " "', true],
    ['" ", ""', false],
    ['" ", " "', false],
    ['"foo", "foobar"', true],
    ['"foo", "bar"', false],
    ['"foobar", "foo"', false],
    ['"10", "9"', true],
    ['"10", 9', false],
    
    // \ufb00 vs. \U0001f019: this test fails if we do simple
    // lexicographic comparison of UTF-8 or UTF-32.  The latter
    // character is a larger code point and sorts later in UTF8,
    // but in UTF16 it gets replaced by two surrogates, both of
    // which are smaller than \uf000.
    ['"ﬀ", "🀙"', false],
    
    // Mixed:
    ['11, "2"', false],  // Numeric
    ['2, "11"', true],   // Numeric
    ['"11", "2"', true], // String
  ];
  for (var i in cases) {
    var tc = cases[i];
    var src = `
        (function(a,b){
          return ((a < b) || (a >= b)) ? (a < b) : undefined;
        })(${tc[0]});`;
    runTest(t, 'ARCA: ' + tc[0], src, tc[1]);
  }
};

/**
 * Run some tests of the Abstract Equality Comparison Algorithm and
 * the Abstract Strict Equality Comparison Algorithm, as defined in
 * §11.9.3 and §11.9.6 respectiveyl of the ES5.1 spec and as embodied
 * by the '==' and '===' operators.
 * @param {T} t The test runner object.
 */
exports.testAeca = function(t) {
  var cases = [
    ['false, false', true, true],  // Numeric
    ['false, true', false, false], // Numeric
    ['true, true', true, true],    // Numeric
    ['true, false', false, false], // Numeric

    // Numeric comparisons:
    ['0, NaN', false, false],
    ['NaN, NaN', false, false],
    ['NaN, 0', false, false],

    ['1, 1', true, true],
    ['0, -0', true, true],
    ['-0, 0', true, true],

    ['Infinity, Number.MAX_VALUE', false, false],
    ['Number.MAX_VALUE, Infinity', false, false],
    ['Infinity, -Number.MAX_VALUE', false, false],
    ['-Number.MAX_VALUE, -Infinity', false, false],

    ['1, 2', false, false],
    ['2, 1', false, false],

    // String comparisons:
    ['"", ""', true, true],
    ['"", " "', false, false],
    ['" ", ""', false, false],
    ['" ", " "', true, true],
    ['"foo", "foobar"', false, false],
    ['"foo", "bar"', false, false],
    ['"foobar", "foo"', false, false],
    ['"10", "9"', false, false],

    // Null / undefined:
    ['undefined, undefined', true, true],
    ['undefined, null', true, false],
    ['null, null', true, true],
    ['null, undefined', true, false],

    // Objects:
    ['Object.prototype, Object.prototype', true, true],
    ['{}, {}', false, false],

    // Mixed:
    ['"10", 10', true, false],   // Numeric
    ['10, "10"', true, false],   // Numeric
    ['"10", 9', false, false],   // Numeric
    ['"10", "9"', false, false], // String
    ['"10", "10"', true, true],  // String

    ['false, 0', true, false],  // Numeric
    ['false, 1', false, false], // Numeric
    ['true, 1', true, false],   // Numeric
    ['true, 0', false, false],  // Numeric
    ['0, false', true, false],  // Numeric
    ['1, false', false, false], // Numeric
    ['1, true', true, false],   // Numeric
    ['0, true', false, false],  // Numeric

    ['null, false', false, false],
    ['null, 0', false, false],
    ['null, ""', false, false],
    ['false, null', false, false],
    ['0, null', false, false],
    ['"", null', false, false],

    ['{}, false', false, false],
    ['{}, 0', false, false],
    ['{}, ""', false, false],
    ['{}, null', false, false],
    ['{}, undefined', false, false],
  ];
  for (var i in cases) {
    var tc = cases[i];
    var src = `(function(a,b){ return a == b })(${tc[0]});`;
    runTest(t, 'AECA: ' + tc[0], src, tc[1]);
    src = `(function(a,b){ return a === b })(${tc[0]});`;
    runTest(t, 'ASECA: ' + tc[0], src, tc[2]);
  }
};
