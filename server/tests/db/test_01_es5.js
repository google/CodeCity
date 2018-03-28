/**
 * @license
 * Code City: Testing code.
 *
 * Copyright 2017 Google Inc.
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
 * @fileoverview Test the ES5 functions of the server.
 * @author fraser@google.com (Neil Fraser)
 */


// Run some tests of the various constructors and their associated
// literals and prototype objects.
tests.builtinClasses = function() {
  var classes = [
    {
      constructor: Object,
      literal: {},
      prototypeProto: null,
      classStr: '[object Object]',
    },
    {
      constructor: Function,
      literal: function(){},
      prototypeType: 'function',
      classStr: '[object Function]',
    },
    {
      constructor: Array,
      literal: [],
      classStr: '[object Array]',
    },
    {
      constructor: RegExp,
      literal: /foo/,
      classStr: '[object RegExp]',
      prototypeClass: '[object Object]' // Was 'RegExp' in ES5.1.
    },
    {
      constructor: Date,
      classStr: '[object Date]',
      prototypeClass: '[object Object]' // Was 'RegExp' in ES5.1.
    },
    {
      constructor: Error,
      classStr: '[object Error]',
    },
    {
      constructor: EvalError,
      prototypeProto: Error.prototype,
      classStr: '[object Error]',
    },
    {
      constructor: RangeError,
      prototypeProto: Error.prototype,
      classStr: '[object Error]',
    },
    {
      constructor: ReferenceError,
      prototypeProto: Error.prototype,
      classStr: '[object Error]',
    },
    {
      constructor: SyntaxError,
      prototypeProto: Error.prototype,
      classStr: '[object Error]',
    },
    {
      constructor: TypeError,
      prototypeProto: Error.prototype,
      classStr: '[object Error]',
    },
    {
      constructor: URIError,
      prototypeProto: Error.prototype,
      classStr: '[object Error]',
    },
    {
      constructor: Boolean,
      literal: true,
      literalType: 'boolean',
      noInstance: true,
      classStr: '[object Boolean]',
    },
    {
      constructor: Number,
      literal: 42,
      literalType: 'number',
      noInstance: true,
      classStr: '[object Number]',
    },
    {
      constructor: String,
      literal: "hello",
      literalType: 'string',
      noInstance: true,
      classStr: '[object String]',
    }
  ];
  for (var i = 0, tc; (tc = classes[i]); i++) {
    var c = tc.constructor;
    var prototypeType = (tc.prototypeType || 'object');
    // Check constructor is a function:
    console.assert(typeof c === 'function', c + ' isFunction');
    // Check constructor's proto is Function.prototype
    console.assert(Object.getPrototypeOf(c) === Function.prototype,
        c + ' protoIsFunctionPrototype');
    // Check prototype is of correct type:
    console.assert(typeof c.prototype === prototypeType,
        c + ' prototypeIs');
    // Check prototype has correct class:
    console.assert(
        Object.prototype.toString.apply(c.prototype) ===
        tc.prototypeClass || tc.classStr,
        c + ' prototypeClassIs');
    // Check prototype has correct proto:
    console.assert(
        Object.getPrototypeOf(c.prototype) ===
        (tc.prototypeProto === undefined ? Object.prototype : tc.prototypeProto),
        c + ' prototypeProtoIs');
    // Check prototype's .constructor is constructor:
    console.assert(c.prototype.constructor === c,
        c + ' prototypeConstructorIs');

    if (!tc.noInstance) {
      // Check instance's type:
      console.assert(typeof new c === prototypeType, c + ' instanceIs');
      // Check instance's proto:
      console.assert(Object.getPrototypeOf(new c) === c.prototype,
          c + ' instancePrototypeIs');
      // Check instance's class:
      console.assert(Object.prototype.toString.apply(new c) === tc.classStr,
          c + ' instanceClassIs');
      // Check instance is instanceof its contructor:
      console.assert((new c) instanceof c, c + ' instanceIsInstanceof');
    }
    if (tc.literal) {
      var literalType = (tc.literalType || prototypeType);
      // Check literal's type:
      console.assert(typeof tc.literal === literalType, c + ' literalIs');
      // Check literal's proto:
      console.assert(Object.getPrototypeOf(tc.literal) === c.prototype,
          c + ' literalPrototypeIs');
      // Check literal's class:
      console.assert(
          Object.prototype.toString.apply(tc.literal) === tc.classStr,
          c + ' literalClassIs');
      // Primitives can never be instances.
      if (literalType === 'object' || literalType === 'function') {
        // Check literal is instanceof its constructor.
        console.assert(tc.literal instanceof c, c + ' literalIsInstanceof');
      }
    }
  }
};

// Run some tests of switch statements with fallthrough.
tests.switchFallthrough = function() {
  var expected = [28, 31, 30, 12, 8];
  for (var i = 0; i < expected.length; i++) {
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
    console.assert(x === expected[i], 'switch fallthrough ' + i);
  }
};

// Run some tests of switch statements.
tests.switchBreak = function() {
  var expected = [30, 20, 20, 30, 40];
  for (var i = 0; i < expected.length; i++) {
    var x;
    foo: {
      switch (i) {
        case 1:
          x = 10;
          // fall through
        case 2:
          x = 20;
          break;
        default:
          x = 50;
          // fall through
        case 3:
          x = 30;
          break foo;
        case 4:
          x = 40;
      }
    }
    console.assert(x === expected[i], 'switch ' + i);
  }
};

// Run some tests of evaluation of binary expressions, as defined in
// §11.5--11.11 of the ES5.1 spec.
tests.binary = function() {
  var cases = [
    // Addition / concatenation:
    ["1 + 1", 2],
    ["'1' + 1", '11'],
    ["1 + '1'", '11'],

    // Subtraction:
    ["'1' - 1", 0],

    // Multiplication:
    ["'5' * '5'", 25],

    ["-5 * 0", -0],
    ["-5 * -0", 0],

    ["1 * NaN", NaN],
    ["Infinity * NaN", NaN],
    ["-Infinity * NaN", NaN],

    ["Infinity * Infinity", Infinity],
    ["Infinity * -Infinity", -Infinity],
    ["-Infinity * -Infinity", Infinity],
    ["-Infinity * Infinity", -Infinity],
    // FIXME: add overflow/underflow cases

    // Division:
    ["35 / '7'", 5],

    ["1 / 1", 1],
    ["1 / -1", -1],
    ["-1 / -1", 1],
    ["-1 / 1", -1],

    ["1 / NaN", NaN],
    ["NaN / NaN", NaN],
    ["NaN / 1", NaN],

    ["Infinity / Infinity", NaN],
    ["Infinity / -Infinity", NaN],
    ["-Infinity / -Infinity", NaN],
    ["-Infinity / Infinity", NaN],

    ["Infinity / 0", Infinity],
    ["Infinity / -0", -Infinity],
    ["-Infinity / -0", Infinity],
    ["-Infinity / 0", -Infinity],

    ["Infinity / 1", Infinity],
    ["Infinity / -1", -Infinity],
    ["-Infinity / -1", Infinity],
    ["-Infinity / 1", -Infinity],

    ["1 / Infinity", 0],
    ["1 / -Infinity", -0],
    ["-1 / -Infinity", 0],
    ["-1 / Infinity", -0],

    ["0 / 0", NaN],
    ["0 / -0", NaN],
    ["-0 / -0", NaN],
    ["-0 / 0", NaN],

    ["1 / 0", Infinity],
    ["1 / -0", -Infinity],
    ["-1 / -0", Infinity],
    ["-1 / 0", -Infinity],
    // FIXME: add overflow/underflow cases

    // Remainder:
    ["20 % 5.5", 3.5],
    ["20 % -5.5", 3.5],
    ["-20 % -5.5", -3.5],
    ["-20 % 5.5", -3.5],

    ["1 % NaN", NaN],
    ["NaN % NaN", NaN],
    ["NaN % 1", NaN],

    ["Infinity % 1", NaN],
    ["-Infinity % 1", NaN],
    ["1 % 0", NaN],
    ["1 % -0", NaN],
    ["Infinity % 0", NaN],
    ["Infinity % -0", NaN],
    ["-Infinity % -0", NaN],
    ["-Infinity % 0", NaN],

    ["0 % 1", 0],
    ["-0 % 1", -0],
    // FIXME: add overflow/underflow cases

    // Left shift:
    ["10 << 2", 40],
    ["10 << 28", -1610612736],
    ["10 << 33", 20],
    ["10 << 34", 40],

    // Signed right shift:
    ["10 >> 4", 0],
    ["10 >> 33", 5],
    ["10 >> 34", 2],
    ["-11 >> 1", -6],
    ["-11 >> 2", -3],

    // Signed right shift:
    ["10 >>> 4", 0],
    ["10 >>> 33", 5],
    ["10 >>> 34", 2],
    ["-11 >>> 0", 0xfffffff5],
    ["-11 >>> 1", 0x7ffffffa],
    ["-11 >>> 2", 0x3ffffffd],
    ["4294967338 >>> 0", 42],

    // Bitwise:
    ["0x3 | 0x5", 0x7],
    ["0x3 ^ 0x5", 0x6],
    ["0x3 & 0x5", 0x1],

    ["NaN | 0", 0],
    ["-0 | 0", 0],
    ["Infinity | 0", 0],
    ["-Infinity | 0", 0],

    // Comparisons:
    //
    // (This is mainly about making sure that the binary operators are
    // hooked up to the abstract relational comparison algorithm
    // correctly; that algorithm is tested separately to make sure
    // details of comparisons are correct.)
    ["1 < 2", true],
    ["2 < 2", false],
    ["3 < 2", false],

    ["1 <= 2", true],
    ["2 <= 2", true],
    ["3 <= 2", false],

    ["1 > 2", false],
    ["2 > 2", false],
    ["3 > 2", true],

    ["1 >= 2", false],
    ["2 >= 2", true],
    ["3 >= 2", true],

    // (Ditto for abstract equality comparison algorithm.)
    ["1 == 1", true],
    ["2 == 1", false],
    ["2 == 2", true],
    ["1 == 2", false],

    ["1 == '1'", true],

    ["1 != 1", false],
    ["2 != 1", true],
    ["2 != 2", false],
    ["1 != 2", true],

    ["1 != '1'", false],

    // (Ditto for abstract strict equality comparison algorithm.)
    ["1 === 1", true],
    ["2 === 1", false],
    ["2 === 2", true],
    ["1 === 2", false],

    ["1 === '1'", false],

    ["1 !== 1", false],
    ["2 !== 1", true],
    ["2 !== 2", false],
    ["1 !== 2", true],

    ["1 !== '1'", true],
  ];

  // Object.is is part of ES6, not ES5, so provide a helper function.
  // Copied from:
  // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/is
  function is(x, y) {
    // SameValue algorithm
    if (x === y) { // Steps 1-5, 7-10
      // Steps 6.b-6.e: +0 != -0
      return x !== 0 || 1 / x === 1 / y;
    } else {
     // Step 6.a: NaN == NaN
     return x !== x && y !== y;
    }
  }

  for (var i = 0, tc; (tc = cases[i]); i++) {
    var actual = eval(tc[0]);
    var expected = tc[1];
    console.assert(is(actual, expected), tc[0] +
                   ' Actual: ' + actual  + ' Expected: ' + expected);
  }
};

// Run some tests of the Abstract Relational Comparison Algorithm, as defined
// in §11.8.5 of the ES5.1 spec and as embodied by the '<' operator.
tests.arca = function() {
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
  function arca(a, b) {
    return ((a < b) || (a >= b)) ? (a < b) : undefined;
  }
  for (var i = 0, tc; (tc = cases[i]); i++) {
    console.assert(tc[1] === eval('arca(' + tc[0] + ')'), 'ARCA: ' + tc[0]);
  }
};

// Run some tests of the Abstract Equality Comparison Algorithm and
// the Abstract Strict Equality Comparison Algorithm, as defined in
// §11.9.3 and §11.9.6 respectively of the ES5.1 spec and as embodied
// by the '==' and '===' operators.
tests.aeca_aseca = function() {
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
  function aeca(a, b) {
    return a == b;
  }
  function aseca(a, b) {
    return a === b;
  }
  for (var i = 0, tc; (tc = cases[i]); i++) {
    console.assert(tc[1] === eval('aeca(' + tc[0] + ')'), 'AECA: ' + tc[0]);
    console.assert(tc[2] === eval('aseca(' + tc[0] + ')'), 'ASECA: ' + tc[0]);
  }
};

tests.isFinite = function() {
  console.assert(!isFinite(Infinity), 'isFinite Infinity');
  console.assert(!isFinite(NaN), 'isFinite NaN');
  console.assert(!isFinite(-Infinity), 'isFinite -Infinity');
  console.assert(isFinite(0), 'isFinite 0');
  console.assert(isFinite(2e64), 'isFinite 2e64');
  console.assert(isFinite('0'), 'isFinite "0"');
  console.assert(isFinite(null), 'isFinite null');
};

tests.isNaN = function() {
  console.assert(isNaN(NaN), 'isNaN NaN');
  console.assert(isNaN(0 / 0), 'isNaN 0 / 0');
  console.assert(isNaN('NaN'), 'isNaN "NaN"');
  console.assert(isNaN(undefined), 'isNaN undefined');
  console.assert(isNaN({}), 'isNaN {}');
  console.assert(isNaN('blabla'), 'isNaN "blabla"');
  console.assert(!isNaN(true), 'isNaN true');
  console.assert(!isNaN(null), 'isNaN null');
  console.assert(!isNaN(37), 'isNaN 37');
  console.assert(!isNaN('37'), 'isNaN "37"');
  console.assert(!isNaN('37.37'), 'isNaN "37.37"');
  console.assert(!isNaN(''), 'isNaN ""');
  console.assert(!isNaN(' '), 'isNaN " "');
};

// Run some tests of Number.toString(radix) with various different
// radix arguments.
tests.toString = function() {
  var cases = [
    ['(42).toString()', '42'],
    ['(42).toString(16)', '2a'],
    // Old versions of Node incorrectly reports '-132.144444'.
    ['(-42.4).toString(5)', '-132.2'],
    ['(42).toString("2")', '101010'],
    ['(-3.14).toString()', '-3.14'],
    ['(999999999999999999999999999).toString()', '1e+27'],
    ['(NaN).toString()', 'NaN'],
    ['(Infinity).toString()', 'Infinity'],
    ['(-Infinity).toString()', '-Infinity'],
  ];
  for (var i = 0, tc; (tc = cases[i]); i++) {
    console.assert(tc[1] === eval(tc[0]), 'toString: ' + tc[0]);
  }
};

tests.basicMath = function() {
  console.assert(1 + 1 === 2, 'onePlusOne');
  console.assert(2 + 2 === 4,'twoPlusTwo');
  console.assert(6 * 7 === 42, 'sixTimesSeven');
  console.assert((3 + 12 / 4) * (10 - 3) === 42, 'simpleFourFunction');
};

tests.basicVariables = function() {
  var x = 43;
  console.assert(x === 43, 'variableDecl');
  x = 44;
  console.assert(x === 44, 'simpleAssignment');
};

tests.ternary = function() {
  console.assert((true ? 'then' : 'else') === 'then', 'condTrue');
  console.assert((false ? 'then' : 'else') === 'else', 'condFalse');
};

tests.ifElse = function() {
  var ifTrue;
  if (true) {
    ifTrue = 'then';
  } else {
    ifTrue = 'else';
  }
  console.assert(ifTrue === 'then', 'ifTrue');
  var ifFalse;
  if (false) {
    ifFalse = 'then';
  } else {
    ifFalse = 'else';
  }
  console.assert(ifFalse === 'else', 'ifFalse');
};

tests.propertyAssignment = function() {
  var o = {};
  o.foo = 45;
  console.assert(o.foo == 45, 'propertyAssignment');
};

tests.increment = function() {
  var postincrement = 45;
  postincrement++;
  console.assert(postincrement++ === 46, 'postincrement');
  var preincrement = 45;
  ++preincrement;
  console.assert(++preincrement === 47, 'preincrement');
};

tests.concat = function() {
  console.assert('foo' + 'bar' === 'foobar', 'concat');
};

tests.plusEquals = function() {
  var plusequalsLeft = 40;
  var plusequalsRight = 8;
  plusequalsLeft += plusequalsRight;
  console.assert(plusequalsLeft === 48, 'plusequalsLeft');
  console.assert(plusequalsRight === 8, 'plusequalsRight');
};

tests.simpleFunctionExpression = function() {
  var value;
  var f = function() {
    value = 49;
  };
  f();
  console.assert(value === 49, 'simpleFunctionExpression');
};

tests.fExpWithParameter = function() {
  var value;
  var f = function(x) {
    value = x;
  };
  f(50);
  console.assert(value === 50, 'fExpWithParameter');
};

tests.functionReturn = function() {
  console.assert('functionWithReturn', (function(x) { return x; })(51), 51);
  console.assert('functionWithoutReturn', (function() {})(), undefined);
  var multipleReturn = function() {
    try {
      return true;
    } finally {
      return false;
    }
  };
  console.assert(multipleReturn() === false, 'multipleReturn');
};

tests.throwCatch = function() {
  var f = function() {
    throw 26;
  };
  var result;
  try {
    f();
  } catch (e) {
    result = e * 2;
  }
  console.assert(result === 52, 'throwCatch');
};

tests.throwCatchFalsey = function() {
  var result;
  try {
    throw null;
  } catch (e) {
    result = 'caught ' + String(e);
  }
  console.assert(result === 'caught null', 'throwCatchFalsey');
};

tests.seqExpr = function() {
  console.assert((51, 52, 53) === 53, 'seqExpr');
};

tests.labeledStatement = function() {
  foo: var x = 54;
  console.assert(x === 54, 'labeledStatement');
};

tests.whileLoop = function() {
  var a = 0;
  while (a < 55) {
    a++;
  }
  console.assert(a === 55, 'whileLoop');
};

tests.whileFalse = function() {
  var a = 56;
  while (false) {
    a++;
  }
  console.assert(a === 56, 'whileFalse');
};

tests.doWhileFalse = function() {
  var a = 56;
  do {
    a++;
  } while (false);
  console.assert(a === 57, 'doWhileFalse');
};

tests.breakDoWhile = function() {
  var a = 57;
  do {
    a++;
    break;
    a++;
  } while (false);
  console.assert(a === 58, 'breakDoWhile');
};

tests.selfBreak = function() {
  console.assert(eval('foo: break foo;') === undefined, 'selfBreak');
};

tests.breakWithFinally = function() {
  var a = 6;
  foo: {
    try {
      a *= 10;
      break foo;
    } finally {
      a--;
    }
  }
  console.assert(a === 59, 'breakWithFinally');
};

tests.continueWithFinally = function() {
  var a = 59;
  do {
    try {
      continue;
    } finally {
      a++;
    }
  } while (false);
  console.assert(a === 60, 'continueWithFinally');
};

tests.breakWithFinallyContinue = function() {
  var a = 0;
  while (a++ < 60) {
    try {
      break;
    } finally {
      continue;
    }
  }
  console.assert(a === 61, 'breakWithFinallyContinue');
};

tests.returnWithFinallyContinue = function() {
  var f = function() {
    var i = 0;
    while (i++ < 61) {
      try {
        return 42;
      } finally {
        continue;
      }
    }
    return i;
  };
  console.assert(f() === 62, 'returnWithFinallyContinue');
};

tests.or = function() {
  console.assert((63 || 'foo') === 63, 'orTrue');
  console.assert((false || 64) === 64, 'orFalse');
  var r = 0;
  true || (r++);
  console.assert(r === 0, 'orShortcircuit');
};

tests.and = function() {
  console.assert((({}) && 65) === 65, 'andTrue');
  console.assert((0 && 65) === 0, 'andFalse');
  var r = 0;
  false && (r++);
  console.assert(r === 0, 'andShortcircuit');
};

tests.forTriangular = function() {
  var t = 0;
  for (var i = 0; i < 12; i++) {
    t += i;
  }
  console.assert(t === 66, 'forTriangular');
};

tests.forIn = function() {
  var x = 0, a = {a: 60, b:3, c:4};
  for (var i in a) { x += a[i]; }
  console.assert(x === 67, 'forIn');
};

tests.forInMemberExp = function() {
  var x = 1, o = {foo: 'bar'}, a = {a:2, b:2, c:17};
  for (o.foo in a) { x *= a[o.foo]; }
  console.assert(x === 68, 'forInMemberExp');
};

tests.forInMembFunc = function() {
  var x = 0, o = {};
  var f = function() { x += 20; return o; };
  var a = {a:2, b:3, c:4};
  for (f().foo in a) { x += a[o.foo]; }
  console.assert(x === 69, 'forInMembFunc');
};

tests.forInNullUndefined = function() {
  var x = 0, o = {};
  var f = function() { x++; return o; };
  for (f().foo in null) { x++; }
  for (f().foo in undefined) { x++; }
  console.assert(x === 0, 'forInNullUndefined');
};
  
tests.thisInMethod = function() {
  var o = {
    f: function() { return this.foo; },
    foo: 70
  };
  console.assert(o.f() === 70, 'thisInMethod');
};

tests.thisInFormerMethod = function() {
  var o = { f: function() { return this; }};
  var g = o.f;
  console.assert(g() === undefined, 'thisInFormerMethod');
};

tests.testThis = function() {
  console.assert(this === tests, 'testThis');
  console.assert(eval('this') === tests, 'evalThis');
  console.assert(tests.testThis.globalThis === undefined, 'globalThis');
};

tests.testThis.globalThis = this;

tests.strictBoxedThis = function() {
  // Run a test to ensure that 'this' is a primitive in methods invoked on
  // primitives.  (This also tests that interpreter is running in strict mode;
  // in sloppy mode this will be boxed.)
  try {
    Object.prototype.foo = function() { return typeof this; };
    console.assert('foo'.foo() === 'string', 'strictBoxedThis');
  } finally {
    console.assert(delete Object.prototype.foo, 'strictBoxedThisDelete');
  }
};

tests.emptyArrayLength = function() {
  console.assert([].length === 0, 'emptyArrayLength');
};

tests.arrayElidedLength = function() {
  console.assert([1,,3,,].length === 4, 'arrayElidedLength');
};

tests.arrayElidedNotDefinedNotUndefined = function() {
  var a = [,undefined,null,0,false];
  console.assert(!(0 in a) && (1 in a) && (2 in a) && (3 in a) && (4 in a),
                 'arrayElidedNotDefinedNotUndefined');
};

tests.arrayLengthPropertyDescriptor = function() {
  var a = [1, 2, 3];
  var pd = Object.getOwnPropertyDescriptor(a, 'length');
  console.assert((pd.value === 3), 'arrayLengthPropertyDescriptorValue');
  console.assert(pd.writable && !pd.enumerable && !pd.configurable,
                 'arrayLengthPropertyDescriptor');
};

tests.arrayLength = function() {
  var a;
  function checkLen(exp, desc) {
    if (a.length !== exp) {
      var msg = 'a.length === ' + a.length + ' (expected: ' + exp + ')';
      console.assert(false, desc ? msg + ' ' + desc : msg);
    }
  }

  // Empty array has length == 0
  a = [];
  checkLen(0, 'on empty array');

  // Adding non-numeric properties does not increase length:
  a['zero'] = 0;
  checkLen(0, 'after setting non-index property on []');

  // Adding numeric properties >= length does increase length:
  for (var i = 0; i < 5; i++) {
    a[i] = i;
    checkLen(i + 1, 'after setting a[' + i + ']');
  }

  // .length works propery even for large, sparse arrays, and even
  // if values are undefined:
  for (i = 3; i <= 31; i++) {
    var idx = (1 << i) >>> 0;  // >>> 0 converts int32 to uint32
    a[idx] = undefined;
    checkLen(idx + 1, 'after setting a[' + idx + ']');
  }

  // Adding numeric properties < length does not increase length:
  a[idx - 1] = 'not the largest';
  checkLen(idx + 1, 'after setting non-largest element');

  // Verify behaviour around largest possible index:
  a[0xfffffffd] = null;
  checkLen(0xfffffffe);
  a[0xfffffffe] = null;
  checkLen(0xffffffff);
  a[0xffffffff] = null;  // Not an index.
  checkLen(0xffffffff);  // Unchanged.
  a[0x100000000] = null; // Not an index.
  checkLen(0xffffffff);  // Unchanged.

  function checkIdx(idx, exp, desc) {
    var r = a.hasOwnProperty(idx);
    var msg = 'a.hasOwnProperty(' + idx + ') === ' + r;
    console.assert(r === exp, desc ? msg + ' ' + desc : msg);
  }

  // Setting length to existing value should have no effect:
  a.length = 0xffffffff;
  checkIdx(0xfffffffd, true);
  checkIdx(0xfffffffe, true);
  checkIdx(0xffffffff, true);
  checkIdx(0x100000000, true);

  // Setting length one less than maximum should remove largest
  // index, but leave properties with keys too large to be indexes:
  a.length = 0xfffffffe;
  checkIdx(0xfffffffd, true);
  checkIdx(0xfffffffe, false);
  checkIdx(0xffffffff, true);
  checkIdx(0x100000000, true);

  // Setting length to zero should remove all index properties:
  a.length = 0;
  for (var key in a) {
    if (!a.hasOwnProperty(key)) {
      continue;
    }
    console.assert(String(key >>> 0) !== key || (key >>> 0) === 0xffffffff,
                   'Setting a.length = 0 failed to remove property ' + key);
  }

  // Make sure we didn't wipe everything!
  console.assert(Object.getOwnPropertyNames(a).length === 4,
                 'Setting .length = 0 removed some non-index properties');
};

tests.arrayLengthWithNonWritableProps = function() {
  var a = [];
  Object.defineProperty(a, 0,
      {value: 'hi', writable: false, configurable: true});
  a.length = 0;
  console.assert(a[0] === undefined && a.length === 0,
                 'arrayLengthWithNonWritableProps');
};

tests.arrayLengthWithNonConfigurableProps = function() {
  var a = [];
  Object.defineProperty(a, 0,
      {value: 'hi', writable: false, configurable: false});
  try {
    a.length = 0;
    console.assert(false, 'arrayLengthWithNonConfigurableProps');
  } catch (e) {
    console.assert(e.name === 'TypeError',
                   'arrayLengthWithNonConfigurableProps');
  }
};

tests.compValEmptyBlock = function() {
  console.assert(eval('{}') === undefined, 'compValEmptyBlock');
};

tests.unaryVoid = function() {
  var x = 70;
  console.assert((undefined === void x++) && x === 71, 'unaryVoid');
};

tests.unaryPlusMinus = function() {
  console.assert(+'72' === 72, 'unaryPlus');
  console.assert(-73 === -73, 'unaryPlus');
};

tests.unaryComplement = function() {
  console.assert(~0xffffffb5 === 74, 'unaryComplement');
};

tests.unaryNot = function() {
  console.assert(!false && (!true === false), 'unaryNot');
};

tests.unaryTypeof = function() {
  console.assert(typeof undefined === 'undefined', 'unaryTypeofUndefined');
  console.assert(typeof null === 'object', 'unaryTypeofNull');
  console.assert(typeof false === 'boolean', 'unaryTypeofBoolean');
  console.assert(typeof 0 === 'number', 'unaryTypeofNumber');
  console.assert(typeof '' === 'string', 'unaryTypeofString');
  console.assert(typeof {} === 'object', 'unaryTypeofObject');
  console.assert(typeof [] === 'object', 'unaryTypeofArray');
  console.assert(typeof function() {} === 'function', 'unaryTypeofFunction');
  console.assert(typeof undeclaredVar === 'undefined', 'unaryTypeofUndeclared');
};

tests.binaryIn = function() {
  var o = {foo: 'bar'};
  console.assert('foo' in o && !('bar' in o), 'binaryIn');
};

tests.binaryInParent = function() {
  var p = {foo: 'bar'};
  var o = Object.create(p);
  console.assert('foo' in o && !('bar' in o), 'binaryInParent');
};

tests.binaryInArrayLength = function() {
  console.assert('length' in [], 'binaryInArrayLength');
};

tests.binaryInStringLength = function() {
  try {
    'length' in '';
    console.assert(false, 'binaryInStringLength');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'binaryInStringLengthError');
  }
};

tests.instanceofBasics = function() {
  function F(){}
  var f = new F;
  console.assert(f instanceof F, 'instanceofBasics1');
  console.assert(f instanceof Object, 'instanceofBasics2');
  console.assert(!(f.prototype instanceof F), 'instanceofBasics3');
};

tests.instanceofNonObjectLHS = function() {
  function F() {}
  F.prototype = null;
  console.assert(!(42 instanceof F), 'instanceofNonObjectLHS');
};

tests.instanceofNonFunctionRHS = function() {
  try {
    ({}) instanceof 0;
    console.assert(false, 'instanceofNonFunctionRHS');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'instanceofNonFunctionRHSError');
  }
};

tests.instanceofNonObjectPrototype = function() {
  function F() {};
  F.prototype = 'hello';
  try {
    ({}) instanceof F;
    console.assert(false, 'instanceofNonObjectPrototype');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'instanceofNonObjectPrototypeError');
  }
};

tests.deleteProp = function() {
  var o = {foo: 'bar'};
  console.assert(delete o.quux, 'deleteProp1');
  console.assert('foo' in o, 'deleteProp2');
  console.assert(delete o.foo, 'deleteProp3');
  console.assert(!('foo' in o), 'deleteProp4');
  console.assert(delete o.foo, 'deleteProp5');
};

tests.deleteNonexistentFromPrimitive = function() {
  console.assert(delete false.nonexistent, 'deleteNonexistentFromPrimitive');
  console.assert(delete (42).toString, 'deleteInheritedFromPrimitive');
};

// This "actually" tries to delete the non-configurable own .length
// property from the auto-boxed String instance created by step 4a of
// algorithm in §11.4.1 of the ES 5.1 spec.  We have to use a string
// here, because only String instances have own properties (and yes:
// they are all non-configurable, so delete *always* fails).
tests.deleteOwnFromPrimitive = function() {
  try {
    delete 'hello'.length;
    console.assert(false, 'deleteOwnFromPrimitive');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'deleteOwnFromPrimitive');
  }
};

tests.funcDecl = function() {
  var v;
  function f() {
    v = 75;
  }
  f();
  console.assert(v === 75, 'funcDecl');
};

tests.namedFunctionExpression = function() {
  var f = function foo(x) {
    if (x < 100) {
      return x;
    }
    return foo(x / 2);
  };
  console.assert(f(152) === 76, 'namedFunctionExpression');
};

tests.namedFunExpNoLeak = function() {
  var f = function foo() {};
  console.assert(typeof foo === 'undefined', 'namedFunExpNoLeak');
};

tests.namedFunExpSameSame = function() {
  var f = function foo() {
    return f === foo;
  };
  console.assert(f(), 'namedFunExpSameSame');
};

tests.closureIndependence = function() {
  function makeAdder(x) {
    return function(y) { return x + y; };
  }
  var plus3 = makeAdder(3);
  var plus4 = makeAdder(4);
  console.assert(plus3(plus4(70)) === 77, 'closureIndependence');
};

tests.internalObjectToString = function() {
  var o = {};
  o[{}] = null;
  for(var key in o) {
  }
  console.assert(key === '[object Object]', 'internalObjectToString');
};

tests.internalFunctionToString = function() {
  var o = {}, s, f = function(){};
  o[f] = null;
  for(var key in o) {
    s = key;
  }
  console.assert(/^function.*\(.*\).*{[^]*}$/.test(s), 'internalFunctionToString');
};

tests.internalNativeFuncToString = function() {
  var o = {}, s, f = Object.create;
  o[f] = null;
  for(var key in o) {
    s = key;
  }
  console.assert(/^function.*\(.*\).*{[^]*}$/.test(s), 'internalNativeFuncToString');
};

tests.internalArrayToString = function() {
  var o = {};
  o[[1, 2, 3]] = null;
  for(var key in o) {
  }
  console.assert(key === '1,2,3', 'internalArrayToString');
};

tests.internalDateToString = function() {
  var o = {};
  o[new Date(0)] = null;
  for(var key in o) {
  }
  console.assert(key === (new Date(0)).toString(), 'internalDateToString');
};

tests.internalRegExpToString = function() {
  var o = {};
  o[/foo/g] = null;
  for(var key in o) {
  }
  console.assert(key === '/foo/g', 'internalRegExpToString');
};

tests.internalErrorToString = function() {
  var o = {};
  o[Error('oops')] = null;
  for(var key in o) {
  }
  console.assert(key === 'Error: oops', 'internalErrorToString');
};

tests.internalArgumentsToString = function() {
  var o = {};
  (function() {
    o[arguments] = null;
  })();
  for(var key in o) {
  }
  console.assert(key === '[object Arguments]', 'internalArgumentsToString');
};

tests.debugger = function() {
  console.assert(eval('debugger') === undefined, 'debugger');
};

tests.newExpression = function() {
  function T(x, y) { this.sum += x + y; };
  T.prototype = { sum: 70 };
  var t = new T(7, 0.7);
  console.assert(t.sum === 77.7, 'newExpression');
};

tests.newExpressionReturnObj = function() {
  function T() { return {}; };
  T.prototype = { p: 'the prototype' };
  console.assert((new T).p === undefined, 'newExpressionReturnObj');
};

tests.newExpressionReturnObj = function() {
  function T() { return 0; };
  T.prototype = { p: 'the prototype' };
  console.assert((new T).p === 'the prototype', 'newExpressionReturnObj');
};

tests.regexpSimple = function() {
  console.assert(/foo/.test('foobar'), 'regexpSimple');
};

tests.evalSeeEnclosing = function() {
  var n = 77.77;
  console.assert(eval('n') === 77.77, 'evalSeeEnclosing');
};

tests.evalIndirectNoSeeEnclosing = function() {
  var n = 77.77, gEval = eval;
  try {
    gEval('n');
    console.assert(false, 'evalIndirectNoSeeEnclosing');
  } catch (e) {
    console.assert(e.name === 'ReferenceError', 'evalIndirectNoSeeEnclosing');
  }
  try {
    (function() { return eval; })()('n');
    console.assert(false, 'evalIndirectNoSeeEnclosing2');
  } catch (e) {
    console.assert(e.name === 'ReferenceError', 'evalIndirectNoSeeEnclosing2');
  }
};

tests.evalIndirectSeeGlobal = function() {
  var gEval = eval;
  console.assert(gEval('typeof Array') === 'function', 'evalIndirectSeeGlobal');
};

tests.evalModifyEnclosing = function() {
  var n = 77.77;
  eval('n = 77.88');
  console.assert(n === 77.88, 'evalModifyEnclosing');
};

tests.evalNoLeakingDecls = function() {
  eval('var n = 88.88');
  console.assert(typeof n === 'undefined', 'evalNoLeakingDecls');
};

tests.callEvalOrder = function() {
  var r = "";
  function log(x) {
    r += x;
    return function () {};
  };
  (log('f'))(log('a'), log('b'), log('c'));
  console.assert(r === 'fabc', 'callEvalOrder');
};

tests.callEvalArgsBeforeCallability = function() {
  try {
    var invalid = undefined;
    function t() { throw {name: 'args'}; };
    invalid(t());
    console.assert(false, 'callEvalArgsBeforeCallability');
  } catch(e) {
    console.assert(e.name === 'args', 'callEvalArgsBeforeCallability');
  }
};

tests.callNonCallable = function() {
  function check(v) {
    try {
      v();
      console.assert(false, 'callNonCallable' + v);
    } catch(e) {
      console.assert(e.name === 'TypeError', 'callNonCallable' + v);
    }
  }
  check(undefined);
  check(null);
  check(false);
  check(42);
  check('hello');
  check(Object.create(Function.prototype));
};

//////////////////////////////////////////////////////////////
// Object and Object.prototype

tests.ObjectDefinePropertyNoArgs = function() {
  try {
    Object.defineProperty();
    console.assert(false, 'ObjectDefinePropertyNoArgs');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectDefinePropertyNoArgsError');
  }
};

tests.ObjectDefinePropertyNonObject = function() {
  try {
    Object.defineProperty('not an object', 'foo', {});
    console.assert(false, 'ObjectDefinePropertyNonObject');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectDefinePropertyNonObjectError');
  }
};

tests.ObjectDefinePropertyBadDescriptor = function() {
  var o = {};
  try {
    Object.defineProperty(o, 'foo', 'not an object');
    console.assert(false, 'ObjectDefinePropertyBadDescriptor');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectDefinePropertyBadDescriptorError');
  }
};

tests.ObjectDefineProperty = function() {
  // This also tests iteration over (non-)enumerable properties.
  var o = { foo: 70 }, r = 0;
  Object.defineProperty(o, 'bar', {
    writable: true,
    enumerable: true,
    configurable: true,
    value: 8
  });
  Object.defineProperty(o, 'baz', {
    value: 13
  });
  for (var k in o) {
    r += o[k];
  }
  console.assert(r === 78, 'ObjectDefineProperty');
};

tests.ObjectGetPrototypeOfNullUndefined = function() {
  try {
    Object.getPrototypeOf(null);
    console.assert(false, 'ObjectGetPrototypeOfNull');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectGetPrototypeOfNullError');
  }
  try {
    Object.getPrototypeOf(undefined);
    console.assert(false, 'ObjectGetPrototypeOfUndefined');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectGetPrototypeOfUndefinedError');
  }
};

tests.ObjectGetPrototypeOfPrimitives = function() {
  // This tests for ES6 behaviour.
  console.assert(Object.getPrototypeOf(true) === Boolean.prototype, 'ObjectGetPrototypeOfBoolean');
  console.assert(Object.getPrototypeOf(1337) === Number.prototype, 'ObjectGetPrototypeOfNumber');
  console.assert(Object.getPrototypeOf('hi') === String.prototype, 'ObjectGetPrototypeOfString');
};

tests.ObjectCreateNoArgs = function() {
  try {
    Object.create();
    console.assert(false, 'ObjectCreateNoArgs');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectCreateNoArgsError');
  }
};

tests.ObjectCreateNonObject = function() {
  try {
    Object.create(42);
    console.assert(false, 'ObjectCreateNonObject');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectCreateNonObjectError');
  }
};

tests.ObjectCreateNull = function() {
  var o = Object.create(null);
  console.assert(Object.getPrototypeOf(o) === null, 'ObjectCreateNull');
};

tests.ObjectCreate = function() {
  var o = Object.create({foo: 79});
  delete o.foo;
  console.assert(o.foo === 79, 'ObjectCreate');
};

tests.ObjectGetOwnPropertyDescriptorNoArgs = function() {
  try {
    Object.getOwnPropertyDescriptor();
    console.assert(false, 'ObjectGetOwnPropertyDescriptorNoArgs');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectGetOwnPropertyDescriptorNoArgsError');
  }
};

tests.ObjectGetOwnPropertyDescriptorNonObject = function() {
  try {
    Object.getOwnPropertyDescriptor('not an object', 'foo');
    console.assert(false, 'ObjectGetOwnPropertyDescriptorNonObject');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectGetOwnPropertyDescriptorNonObjectError');
  }
};

tests.ObjectGetOwnPropertyDescriptorBadKey = function() {
  var o = {};
  console.assert(Object.getOwnPropertyDescriptor(o, 'foo') === undefined,
                 'ObjectGetOwnPropertyDescriptorBadKey');
};

tests.ObjectGetOwnPropertyDescriptor = function() {
  var o = {}, r = 0;
  Object.defineProperty(o, 'foo', { value: 'bar' });
  var desc = Object.getOwnPropertyDescriptor(o, 'foo');
  console.assert(desc.value === o.foo, 'ObjectGetOwnPropertyDescriptorValue');
  console.assert(!desc.writable, 'ObjectGetOwnPropertyDescriptorWritable');
  console.assert(!desc.enumerable, 'ObjectGetOwnPropertyDescriptorEnumerable');
  console.assert(!desc.configurable, 'ObjectGetOwnPropertyDescriptorConfigurable');
};

tests.ObjectGetOwnPropertyNamesNoArgs = function() {
  try {
    Object.getOwnPropertyNames();
    console.assert(false, 'ObjectGetOwnPropertyNamesNoArgs');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectGetOwnPropertyNamesNoArgsError');
  }
};

tests.ObjectGetOwnPropertyNamesString = function() {
  var i, r = 0, names = Object.getOwnPropertyNames('foo');
  for (i = 0; i < names.length; i++) {
    if (names[i] === 'length') {
      r += 10;
    } else {
      r += Number(names[i]) + 1;
    }
  }
  console.assert(r === 16, 'ObjectGetOwnPropertyNamesString');
};

tests.ObjectGetOwnPropertyNamesNumber = function() {
  console.assert( Object.getOwnPropertyNames(42).length === 0,
                 'ObjectGetOwnPropertyNamesNumber');
};

tests.ObjectGetOwnPropertyNamesBoolean = function() {
  console.assert(Object.getOwnPropertyNames(true).length === 0,
                 'ObjectGetOwnPropertyNamesBoolean');
};

tests.ObjectGetOwnPropertyNamesNull = function() {
  try {
    Object.getOwnPropertyNames(null).length;
    console.assert(false, 'ObjectGetOwnPropertyNamesNull');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectGetOwnPropertyNamesNullError');
  }
};

tests.ObjectGetOwnPropertyNamesUndefined = function() {
  try {
    Object.getOwnPropertyNames(undefined).length;
    console.assert(false, 'ObjectGetOwnPropertyNamesUndefined');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectGetOwnPropertyNamesUndefinedError');
  }
};

tests.ObjectGetOwnPropertyNames = function() {
  var o = { foo: 42 }, r = 0;
  Object.defineProperty(o, 'bar', { value: 38 });
  var keys = Object.getOwnPropertyNames(o);
  var r = 0;
  for (var i = 0; i < keys.length; i++) {
    r += o[keys[i]];
  }
  console.assert(r === 80, 'ObjectGetOwnPropertyNames');
};

tests.ObjectDefinePropertiesNoArgs = function() {
  try {
    Object.defineProperties();
    console.assert(false, 'ObjectDefinePropertiesNoArgs');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectDefinePropertiesNoArgsError');
  }
};

tests.ObjectDefinePropertiesNonObject = function() {
  try {
    Object.defineProperties('not an object', {});
    console.assert(false, 'ObjectDefinePropertiesNonObject');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectDefinePropertiesNonObjectError');
  }
};

tests.ObjectDefinePropertiesNonObjectProps = function() {
  try {
    Object.defineProperties({}, undefined);
    console.assert(false, 'ObjectDefinePropertiesNonObjectProps');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectDefinePropertiesNonObjectPropsError');
  }
};

tests.ObjectDefinePropertiesBadDescriptor = function() {
  var o = {};
  try {
    Object.defineProperties(o, { foo: 'not an object' });
    console.assert(false, 'ObjectDefinePropertiesBadDescriptor');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'ObjectDefinePropertiesBadDescriptorError');
  }
};

tests.ObjectDefineProperty = function() {
  var o = { foo: 50 }, r = 0;
  Object.defineProperty(o, 'bar', {
    writable: true,
    enumerable: true,
    configurable: true,
    value: 0
  });
  o.bar = 20;
  console.assert(o.bar === 20, 'ObjectDefineProperty+WEC');
  Object.defineProperty(o, 'baz', {
    writable: true,
    enumerable: true,
    configurable: false
  });
  console.assert(o.baz === undefined, 'ObjectDefineProperty+WE-C1');
  Object.defineProperty(o, 'baz', {
    value: 8
  });
  console.assert(o.baz === 8, 'ObjectDefineProperty+WE-C2');
  Object.defineProperty(o, 'quux', {
    enumerable: false,
    value: 13
  });
  console.assert(o.baz === 8, 'ObjectDefineProperty-WEC');
  for (var k in o) {
    r += o[k];
  }
  console.assert(r === 78, 'ObjectDefinePropertyEnumerability');
  console.assert(Object.getOwnPropertyNames(o).length === 4,
                 'ObjectDefinePropertyCount');
};

tests.ObjectCreateWithProperties = function() {
  var o = Object.create({ foo: 70 }, {
      bar: {
          writable: true,
          enumerable: true,
          configurable: true,
          value: 10 },
      baz: { value: 999 }});
  var r = 0;
  for (var k in o) {
    r += o[k];
  }
  r += Object.getOwnPropertyNames(o).length;
  console.assert(r === 82, 'ObjectCreateWithProperties');
};

tests.ObjectPrototypeToString = function() {
  console.assert(({}).toString() === '[object Object]', 'ObjectPrototypeToString');
};

//////////////////////////////////////////////////////////////
// Function and Function.prototype

tests.FunctionConstructor = function() {
  var f = new Function('return 42;');
  console.assert(f() === 42, 'FunctionConstructorNoArgs');
  var expected = 'function() {return 42;}';
  var actual = String(f);
  console.assert(actual === expected, 'FunctionConstructorNoArgs Actual: "'
      + actual + '" Expected: "' + expected + '"');

  var f = new Function('a, b', 'c', 'return a + b * c;');
  console.assert(f(2, 3, 10) === 32, 'FunctionConstructorArgs');
  var expected = 'function(a, b, c) {return a + b * c;}';
  var actual = String(f);
  console.assert(actual === expected, 'FunctionConstructorArgs Actual: "'
      + actual + '" Expected: "' + expected + '"');
};

tests.FunctionPrototypeHasNoPrototype = function() {
  console.assert(Function.prototype.hasOwnProperty('prototype') === false,
                 'FunctionPrototypeHasNoPrototype');
};

tests.FunctionPrototypeToStringApplyNonFunctionThrows = function() {
  try {
    Function.prototype.toString.apply({});
    console.assert(false, 'FunctionPrototypeToStringApplyNonFunctionThrows');
  } catch (e) {
    console.assert(e.name === 'TypeError',
                   'FunctionPrototypeToStringApplyNonFunctionThrowsError');
  }
};

tests.FunctionPrototypeApplyNonFuncThrows = function() {
  try {
    var o = {};
    o.apply = Function.prototype.apply;
    o.apply();
    console.assert(false, 'FunctionPrototypeApplyNonFuncThrows');
  } catch (e) {
    console.assert(e.name === 'TypeError',
                   'FunctionPrototypeApplyNonFuncThrowsError');
  }
};

tests.FunctionPrototypeApplyThis = function() {
  var o = {};
  function f() { return this; }
  console.assert(f.apply(o, []) === o, 'FunctionPrototypeApplyThis');
};

tests.FunctionPrototypeApplyArgsUndefinedOrNull = function() {
  var n = 0;
  function f() { n += arguments.length; }
  f.apply(undefined, undefined);
  f.apply(undefined, null);
  console.assert(n === 0, 'FunctionPrototypeApplyArgsUndefinedOrNull');
};

tests.FunctionPrototypeApplyArgsNonObject = function() {
  try {
    (function() {}).apply(undefined, 'not an object');
    console.assert(false, 'FunctionPrototypeApplyArgsNonObject');
  } catch (e) {
    console.assert(e.name === 'TypeError',
                   'FunctionPrototypeApplyArgsNonObjectError');
  }
};

tests.FunctionPrototypeApplyArgsSparse = function() {
  var f = function(a, b, c) {
    if (!(1 in arguments)) {
      throw Error("Argument 1 missing");
    }
    return a + c;
  };
  console.assert(f.apply(undefined, [1, , 3]) === 4,
                 'FunctionPrototypeApplyArgsSparse');
};

tests.FunctionPrototypeApplyArgsArraylike = function() {
  var n = (function(a, b, c) {
       return a + b + c;
     }).apply(undefined, {0: 1, 1: 2, 2: 3, length: 3});
  console.assert(n === 6, 'FunctionPrototypeApplyArgsArraylike');
};

tests.FunctionPrototypeApplyArgsNonArraylike = function() {
  console.assert(isNaN((function(a, b, c) {
    return a + b + c;
  }).apply(undefined, {0: 1, 1: 2, 2: 4})),
                 'FunctionPrototypeApplyArgsNonArraylike');
};

tests.FunctionPrototypeCallNonFuncThrows = function() {
  try {
    var o = {};
    o.call = Function.prototype.call;
    o.call();
    console.assert(false, 'FunctionPrototypeCallNonFuncThrows');
  } catch (e) {
    console.assert(e.name === 'TypeError',
                   'FunctionPrototypeCallNonFuncThrowsError');
  }
};

tests.FunctionPrototypeCallThis = function() {
  var o = {};
  function f() { return this; }
  console.assert(f.call(o) === o, 'FunctionPrototypeCallThis');
};

tests.FunctionPrototypeCallNoArgs = function() {
  function f() { return arguments.length; }
  console.assert(f.call(undefined) === 0, 'FunctionPrototypeCallNoArgs');
};

tests.FunctionPrototypeCall = function() {
  var f = function(a, b, c) {
    if (!(1 in arguments)) {
      throw Error("Argument 1 missing");
    }
    return a + c;
  };
  console.assert(f.call(undefined, 1, 2, 3) === 4, 'FunctionPrototypeCallArgs');
};

//////////////////////////////////////////////////////////////
// Array and Array.prototype

tests.ArrayIsArrayArrayPrototype = function() {
  console.assert(Array.isArray(Array.prototype), 'ArrayIsArrayArrayPrototype');
};

tests.ArrayIsArrayArrayInstance = function() {
  console.assert(Array.isArray(new Array), 'ArrayIsArrayArrayInstance');
};

tests.ArrayIsArrayArrayLiteral = function() {
  console.assert(Array.isArray([]), 'ArrayIsArrayArrayLiteral');
};

tests.ArrayPrototypeToStringCycleDetection = function() {
  var a = [1, , 3];
  a[1] = a;
  a.toString();
  // Didn't crash!
  console.assert(true, 'ArrayPrototypeToStringCycleDetection');
};

tests.ArrayPrototypeJoin = function() {
  console.assert([1, 2, 3].join('-') === '1-2-3', 'ArrayPrototypeJoin');
};

tests.ArrayPrototypeJoinCycleDetection = function() {
  var a = [1, , 3];
  a[1] = a;
  a.join('-');
  // Didn't crash!
  console.assert(true, 'ArrayPrototypeJoinCycleDetection');
};

tests.ArrayLegalIndexLength = function() {
  var cases = [
    // [value, asIndex, asLength]
    [false, 0, 0],
    [true, 0, 1],

    [0, 1, 0],
    [1, 2, 1],
    [0xfffffffe, 0xffffffff, 0xfffffffe],
    [0xffffffff, 0, 0xffffffff],
    [0x100000000, 0, NaN],
    [4.5, 0, NaN],
    [-1, 0, NaN],

    ['0', 1, 0],
    ['1', 2, 1],
    ['0xfffffffe', 0, 0xfffffffe],
    ['0xffffffff', 0, 0xffffffff],
    ['0x100000000', 0, NaN],
    ['4294967294', 4294967295, 0xfffffffe],
    ['4294967295', 0, 0xffffffff],
    ['4294967296', 0, NaN],
    ['4.5', 0, NaN],
    ['-1', 0, NaN],

    ['hello', 0, NaN],
    [null, 0, 0],  // wat
    [undefined, 0, NaN],
    [[], 0, 0],  // wat!
    [{}, 0, NaN],
  ];
  for (var i = 0, tc; (tc = cases[i]); i++) {
    var a = [];
    a[tc[0]] = true;
    console.assert(a.length === tc[1],
                   'ArrayLegalIndex ' + JSON.stringify(tc[0]));
    var a = [];
    try {
      a.length = tc[0];
      if (isNaN(tc[2])) {
        console.assert(false, 'ArrayLegalLength ' + JSON.stringify(tc[0]));
      }
    } catch (e) {
      console.assert(e.name === 'RangeError',
                     'ArrayLegalLengthError ' + JSON.stringify(tc[0]));
    }
  }
};


//////////////////////////////////////////////////////////////
// Boolean

tests.Boolean = function() {
  console.assert(Boolean(undefined) === false, 'BooleanUndefined');
  console.assert(Boolean(null) === false, 'BooleanNull');
  console.assert(Boolean(false) === false, 'BooleanFalse');
  console.assert(Boolean(true) === true, 'BooleanTrue');
  console.assert(Boolean(NaN) === false, 'BooleanNaN');
  console.assert(Boolean(0) === false, 'BooleanZero');
  console.assert(Boolean(1) === true, 'BooleanOne');
  console.assert(Boolean('') === false, 'BooleanEmptyString');
  console.assert(Boolean('foo') === true, 'BooleanString');
  console.assert(Boolean({}) === true, 'BooleanObject');
  console.assert(Boolean([]) === true, 'BooleanArray');
  console.assert(Boolean(function() {}) === true, 'BooleanFunction');
};

//////////////////////////////////////////////////////////////
// Number

tests.Number = function() {
  console.assert(isNaN(Number(undefined)), 'NumberUndefined');
  console.assert(Number(null) === 0, 'NumberNull');
  console.assert(Number(true) === 1, 'NumberTrue');
  console.assert(Number(false) === 0, 'NumberFalse');
  console.assert(Number('42') === 42, 'NumberString42');
  console.assert(isNaN(Number('Hello')), 'NumberString');
  console.assert(Number('') === 0, 'NumberEmptyString');
  console.assert(Number(3.1) === 3.1, 'NumberNumber');
  console.assert(isNaN(Number({})), 'NumberObject');
  console.assert(Number([]) === 0, 'NumberArrayEmpty');
  console.assert(Number([42]) === 42, 'NumberArray42');
  console.assert(isNaN(Number([1,2,3])), 'NumberArray123');
  console.assert(isNaN(Number(function() {})), 'NumberFunction');
  console.assert(isNaN(Number.NaN), 'NumberNaN');
  console.assert(!isFinite(Number.POSITIVE_INFINITY), 'Number +Infinity');
  console.assert(!isFinite(Number.NEGATIVE_INFINITY), 'Number -Infinity');
  console.assert(Number.POSITIVE_INFINITY === -Number.NEGATIVE_INFINITY,
      'Number Infinities');
};

//////////////////////////////////////////////////////////////
// String

tests.String = function() {
  console.assert(String(undefined) === 'undefined', 'StringUndefined');
  console.assert(String(null) === 'null', 'StringNull');
  console.assert(String(true) === 'true', 'StringTrue');
  console.assert(String(false) === 'false', 'StringFalse');
  console.assert(String(0) === '0', 'StringZero');
  console.assert(String(-0) === '0', 'StringNegativeZero');
  console.assert(String(Infinity) === 'Infinity', 'StringInfinity');
  console.assert(String(-Infinity) === '-Infinity', 'StringNegativeInfinity');
  console.assert(String(NaN) === 'NaN', 'StringNaN');
  console.assert(String({}) === '[object Object]', 'StringObject');
  console.assert(String([1, 2, 3,,5]) === '1,2,3,,5', 'StringArray');
};

tests.replaceStringString = function() {
  console.assert('xxxx'.replace('xx', 'y') === 'yxx', 'replaceStringString');
};

tests.replaceRegExpString = function() {
  console.assert('xxxx'.replace(/(X)\1/ig, 'y') === 'yy', 'replaceRegExpString');
};

tests.replaceStringFunction = function() {
  var str = 'xxxx'.replace('xx', function () {
      return '[' + Array.prototype.join.apply(arguments) + ']';
  });
  console.assert(str === '[xx,0,xxxx]xx', 'replaceStringFunction');
};

tests.replaceRegExpFunction = function() {
  var str = 'xxxx'.replace(/(X)\1/ig, function () {
      return '[' + Array.prototype.join.apply(arguments) + ']';
  });
  console.assert(str === '[xx,x,0,xxxx][xx,x,2,xxxx]', 'replaceRegExpFunction');
};

tests.search = function() {
  console.assert('hello'.search('H') === -1, 'searchStringCase');
  console.assert('hello'.search('ll') === 2, 'searchString');
  console.assert('hello'.search(/H/) === -1, 'searchRegExpCase');
  console.assert('hello'.search(/(.)\1/) === 2, 'searchRegExp');
};

//////////////////////////////////////////////////////////////
// RegExp

tests.RegExpPrototypeTestApplyNonRegExpThrows = function() {
  try {
    /foo/.test.apply({}, ['foo']);
    console.assert(false, 'RegExpPrototypeTestApplyNonRegExpThrows');
  } catch (e) {
    console.assert(e.name === 'TypeError',
                   'RegExpPrototypeTestApplyNonRegExpThrowsError');
  }
};

//////////////////////////////////////////////////////////////
// JSON

tests.JsonStringify = function () {
  var obj = {string: 'foo', number: 42, true: true, false: false, null: null,
       object: { obj: {}, arr: [] }, array: [{}, []] };
  var str = '{"string":"foo","number":42,"true":true,"false":false,' +
      '"null":null,"object":{"obj":{},"arr":[]},"array":[{},[]]}';
  console.assert(JSON.stringify(obj) === str, 'JsonStringify');
};

//////////////////////////////////////////////////////////////
// Other tests

tests.newHack = function() {
  console.assert((new 'Array.prototype.push') === Array.prototype.push,
                 'newHack');
};

tests.newHackUnknown = function() {
  // FIXME: use instanceof or the like to check that error is returned.
  try {
    new 'nonexistent-builtin-name';
    console.assert(false, 'newHackUnknown');
  } catch (e) {
    console.assert(e.name === 'ReferenceError', 'newHackUnknownError');
  }
};

tests.strictModeSyntaxErrors = function() {
  var tests = [
    // With statement.
    'var o = { foo: 42 }; var f = function() { with (o) { foo; }};',

    // Binding eval in global scope, or arguments in a function.
    'var eval = "rebinding eval?!?";',
    '(function() { arguments = undefined; });',

    // Duplicate argument names.
    '(function(a, a) {});',

    // Octal numeric literals.
    '0777;',

    // Delete of unqualified or undeclared identifier.
    'var foo; delete foo;',
    'delete foo;',
  ];
  for (var i = 0; i < tests.length; i++) {
    var src = tests[i];
    try {
      eval(tests[i]);
      console.assert(false, 'strictModeSyntaxErrors ' + src);
    } catch (e) {
      console.assert(e.name === 'SyntaxError', 'strictModeSyntaxErrors ' + src);
    }
  }
};
