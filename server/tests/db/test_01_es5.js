/**
 * @license
 * Copyright 2017 Google LLC
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
      prototypeClass: '[object Object]', // Was 'RegExp' in ES5.1.
      functionNotConstructor: true  // Date() doesn't construct.
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
      if (!tc.functionNotConstructor) {
        // Recheck instances when constructor called as function:
        // Recheck instance's type:
        console.assert(typeof c() === prototypeType, c + ' returnIs');
        // Recheck instance's proto:
        console.assert(Object.getPrototypeOf(c()) === c.prototype,
            c + ' returnPrototypeIs');
        // Recheck instance's class:
        console.assert(Object.prototype.toString.apply(c()) === tc.classStr,
            c + ' returnClassIs');
        // Recheck instance is instanceof its contructor:
        console.assert(c() instanceof c, c + ' returnIsInstanceof');
      }
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

tests.propertyOnPrimitive = function() {
  console.assert('foo'.length === 3, 'propertyOnPrimitiveGet');
  try {
    'foo'.bar = 42;
    console.assert('foo'.length === 3, 'propertyOnPrimitiveSet');
  } catch (e) {
    console.assert(e.name === 'TypeError', 'propertyOnPrimitiveSetError');
  }
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

tests.funExpWithParameter = function() {
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

tests.switchDefaultFirst = function() {
  var r;
  switch ('not found') {
    default:
      r = 'OK';
      break;
    case 'decoy':
      r = 'fail';
  };
  console.assert(r === 'OK', 'switchDefaultFirst');
}

tests.switchDefaultOnly = function() {
  var r;
  switch ('not found') {
    default:
      r = 'OK';
      break;
  };
  console.assert(r === 'OK', 'switchDefaultOnly');
}

tests.switchEmptyToEnd = function() {
  switch ('foo') {
    default:
      console.assert(false, 'switchEmptyToEnd');
    case 'foo':
    case 'bar':
  }
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

tests.nullUndefinedProps = function() {
  try {
    undefined.foo;
    console.assert(false, "undefined.foo didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError', 'undefined.foo wrong error');
  }
  try {
    var c = 0;
    undefined.foo = c++;
    console.assert(false, "undefined.foo = ... didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError', 'undefined.foo = ... wrong error');
    console.assert(c === 0, 'undefined.foo = ... evaluated RHS');
  }
  try {
    null.foo;
    console.assert(false, "null.foo didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError', 'null.foo wrong error');
  }
  try {
    c = 0;
    null.foo = c++;
    console.assert(false, "null.foo = ... didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError', 'null.foo = ... wrong error');
    console.assert(c === 0, 'null.foo = ... evaluated RHS');
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
  var f = function half(x) {
    if (x < 100) {
      return x;
    }
    return half(x / 2);
  };
  console.assert(f(152) === 76, 'namedFunctionExpression');

  f = function foo() {return foo;};
  console.assert(f() === f, 'namedFunExpNameBinding');

  f = function foo() {};
  console.assert(typeof foo === 'undefined', 'namedFunExpBindingNoLeak');

  try {
    (function foo() {foo = null;})();
    console.assert(false, "namedFunExpNameBindingImmutable didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
      'namedFunExpNameBindingImmutable wrong error');
  }

  f = function foo(foo) {
    foo += 0.1;  // Verify mutability.
    return foo;
  };
  console.assert(f(76) === 76.1, 'nameFunExpNameBindingShadowedByParam');

  f = function foo() {
    var foo;
    foo = 76.2;  // Verify mutability.
    return foo;
  };
  console.assert(f(76) === 76.2, 'nameFunExpNameBindingShadowedByVar');
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

tests.evalEmptyBlock = function() {
  // A bug in eval would cause it to return the value of the
  // previously-evaluated ExpressionStatement if the eval program did
  // not contain any ExpressionStatements.
  'fail';
  console.assert(eval('{}') === undefined, 'evalEmptyBlock');
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

///////////////////////////////////////////////////////////////////////////////
// Object and Object.prototype

tests.ObjectDefinePropertyNoArgs = function() {
  try {
    Object.defineProperty();
    console.assert(false, "Object.defineProperty() didn't throw");
  } catch (e) {
    console.assert(
        e.name === 'TypeError', 'Object.defineProperty() wrong error');
  }
};

tests.ObjectDefinePropertyNonObject = function() {
  try {
    Object.defineProperty('not an object', 'foo', {});
    console.assert(false, "Object.defineProperty non-object didn't throw");
  } catch (e) {
    console.assert(
        e.name === 'TypeError', 'Object.defineProperty non-object wrong error');
  }
};

tests.ObjectDefinePropertyBadDescriptor = function() {
  var o = {};
  try {
    Object.defineProperty(o, 'foo', 'not an object');
    console.assert(false, "Object.defineProperty bad descriptor didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.defineProperty bad descriptor wrong error');
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
  console.assert(r === 78, 'Object.defineProperty');
};

tests.ObjectGetPrototypeOfNullUndefined = function() {
  try {
    Object.getPrototypeOf(null);
    console.assert(false, "Object.getPrototypeOf null didn't throw");
  } catch (e) {
    console.assert(
        e.name === 'TypeError', 'Object.getPrototypeOf null wrong error');
  }
  try {
    Object.getPrototypeOf(undefined);
    console.assert(false, "Object.getPrototypeOf undefined didn't throw");
  } catch (e) {
    console.assert(
        e.name === 'TypeError', 'Object.getPrototypeOf undefined wrong error');
  }
};

tests.ObjectGetPrototypeOfPrimitives = function() {
  // This tests for ES6 behaviour.
  console.assert(Object.getPrototypeOf(true) === Boolean.prototype,
      'Object.getPrototypeOf boolean');
  console.assert(Object.getPrototypeOf(1337) === Number.prototype,
      'Object.getPrototypeOf number');
  console.assert(Object.getPrototypeOf('hi') === String.prototype,
      'Object.getPrototypeOf string');
};

tests.ObjectCreateNoArgs = function() {
  try {
    Object.create();
    console.assert(false, "Object.create() didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError', 'Object.create() wrong error');
  }
};

tests.ObjectCreateNonObject = function() {
  try {
    Object.create(42);
    console.assert(false, "Object.create non-object didn't throw");
  } catch (e) {
    console.assert(
        e.name === 'TypeError', 'Object.create non-object wrong error');
  }
};

tests.ObjectCreateNull = function() {
  var o = Object.create(null);
  console.assert(Object.getPrototypeOf(o) === null, 'Object.create null');
};

tests.ObjectCreate = function() {
  var o = Object.create({foo: 79});
  delete o.foo;
  console.assert(o.foo === 79, 'Object.create');
};

tests.ObjectGetOwnPropertyDescriptorNoArgs = function() {
  try {
    Object.getOwnPropertyDescriptor();
    console.assert(false, "Object.getOwnPropertyDescriptor() didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.getOwnPropertyDescriptor() wrong error');
  }
};

tests.ObjectGetOwnPropertyDescriptorNonObject = function() {
  try {
    Object.getOwnPropertyDescriptor('not an object', 'foo');
    console.assert(
        false, "Object.getOwnPropertyDescriptor non-object didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.getOwnPropertyDescriptor non-object wrong error');
  }
};

tests.ObjectGetOwnPropertyDescriptorBadKey = function() {
  var o = {};
  console.assert(Object.getOwnPropertyDescriptor(o, 'foo') === undefined,
      'Object.getOwnPropertyDescriptor bad key');
};

tests.ObjectGetOwnPropertyDescriptor = function() {
  var o = {}, r = 0;
  Object.defineProperty(o, 'foo', { value: 'bar' });
  var desc = Object.getOwnPropertyDescriptor(o, 'foo');
  console.assert(desc.value === o.foo, 'Object.getOwnPropertyDescriptor value');
  console.assert(!desc.writable, 'Object.getOwnPropertyDescriptor writable');
  console.assert(
      !desc.enumerable, 'Object.getOwnPropertyDescriptor enumerable');
  console.assert(
      !desc.configurable, 'Object.getOwnPropertyDescriptor configurable');
};

tests.ObjectGetOwnPropertyNamesNoArgs = function() {
  try {
    Object.getOwnPropertyNames();
    console.assert(false, "Object.getOwnPropertyNames() didn't throw");
  } catch (e) {
    console.assert(
        e.name === 'TypeError', 'Object.getOwnPropertyNames() wrong error');
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
  console.assert(r === 16, 'Object.getOwnPropertyNames(string)');
};

tests.ObjectGetOwnPropertyNamesNumber = function() {
  console.assert( Object.getOwnPropertyNames(42).length === 0,
                 'Object.getOwnPropertyNames(number)');
};

tests.ObjectGetOwnPropertyNamesBoolean = function() {
  console.assert(Object.getOwnPropertyNames(true).length === 0,
                 'Object.getOwnPropertyNames(boolean)');
};

tests.ObjectGetOwnPropertyNamesNull = function() {
  try {
    Object.getOwnPropertyNames(null);
    console.assert(false, "Object.getOwnPropertyNames(null) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.getOwnPropertyNames(null) wrong error');
  }
};

tests.ObjectGetOwnPropertyNamesUndefined = function() {
  try {
    Object.getOwnPropertyNames(undefined);
    console.assert(false, "Object.getOwnPropertyNames(undefined) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.getOwnPropertyNames(undefined) wrong error');
  }
};

tests.ObjectGetOwnPropertyNames = function() {
  var o = Object.create({baz: 999});
  o.foo = 42;
  Object.defineProperty(o, 'bar', { value: 38 });
  var keys = Object.getOwnPropertyNames(o);
  var r = 0;
  for (var i = 0; i < keys.length; i++) {
    r += o[keys[i]];
  }
  console.assert(r === 80, 'Object.getOwnPropertyNames');
};

tests.ObjectDefinePropertiesNoArgs = function() {
  try {
    Object.defineProperties();
    console.assert(false, "Object.defineProperties() didn't throw");
  } catch (e) {
    console.assert(
        e.name === 'TypeError', 'Object.defineProperties() wrong error');
  }
};

tests.ObjectDefinePropertiesNonObject = function() {
  try {
    Object.defineProperties('not an object', {});
    console.assert(false, "Object.defineProperties non-object didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.defineProperties non-object wrong error');
  }
};

tests.ObjectDefinePropertiesNonObjectProps = function() {
  try {
    Object.defineProperties({}, undefined);
    console.assert(
        false, "Object.defineProperties non-object props didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.defineProperties non-object props wrong error');
  }
};

tests.ObjectDefinePropertiesBadDescriptor = function() {
  var o = {};
  try {
    Object.defineProperties(o, { foo: 'not an object' });
    console.assert(
        false, "Object.defineProperties bad descriptor didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.defineProperties bad descriptor wrong error');
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
  console.assert(o.bar === 20, 'Object.defineProperty +WEC');
  Object.defineProperty(o, 'baz', {
    writable: true,
    enumerable: true,
    configurable: false
  });
  console.assert(o.baz === undefined, 'Object.defineProperty +WE-C 1');
  Object.defineProperty(o, 'baz', {
    value: 8
  });
  console.assert(o.baz === 8, 'Object.defineProperty +WE-C 2');
  Object.defineProperty(o, 'quux', {
    enumerable: false,
    value: 13
  });
  console.assert(o.baz === 8, 'Object.defineProperty -WEC');
  for (var k in o) {
    r += o[k];
  }
  console.assert(r === 78, 'Object.defineProperty enumerability');
  console.assert(Object.getOwnPropertyNames(o).length === 4,
      'Object.defineProperty result .length wrong');
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
  console.assert(r === 82, 'Object.create(..., properties)');
};

tests.ObjectPrototypeToString = function() {
  console.assert(({}).toString() === '[object Object]',
      'Object.prototype.toString');
};

tests.ObjectPrototypeHasOwnProperty = function() {
  var o = Object.create({baz: 999});
  o.foo = 42;
  Object.defineProperty(o, 'bar', { value: 41, enumerable: true });
  var r = 0;
  for (var key in o) {
    if (!o.hasOwnProperty(key)) continue;
    r += o[key];
  }
  console.assert(r === 83, 'Object.prototype.hasOwnProperty');
};

tests.ObjectPrototypeIsPrototypeOf = function() {
  var pfx = 'Object.prototype.isPrototypeOf';
  console.assert(!Boolean.prototype.isPrototypeOf(false),
                 'Boolean.prototype.isPrototypeOf(false)');
  console.assert(!Number.prototype.isPrototypeOf(0),
                 'Number.prototype.isPrototypeOf(0)');
  console.assert(!String.prototype.isPrototypeOf(''),
                 "String.prototype.isPrototypeOf('')");
  console.assert(!Object.prototype.isPrototypeOf.call(false, false),
                 pfx + '.call(false, false)');
  console.assert(!Object.prototype.isPrototypeOf.call(0, 0),
                 pfx + '.call(0, 0)');
  console.assert(!Object.prototype.isPrototypeOf.call('', ''),
                pfx + ".call('', '')");
  console.assert(!Object.prototype.isPrototypeOf.call(null, null),
                 pfx + '.call(null, null)');
  console.assert(!Object.prototype.isPrototypeOf.call(undefined, undefined),
                 pfx + '.call(undefined, undefined)');
  try {
    Object.prototype.isPrototypeOf.call(null, Object.create(null));
    console.assert(false, pfx + ".call(null, ...) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
                   pfx + '.call(null, ...) wrong error');
  }
  try {
    Object.prototype.isPrototypeOf.call(undefined, Object.create(undefined));
    console.assert(false, pfx + ".call(undefined, ...) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
                   pfx + '.call(undefined, ...) wrong error');
  }

  var g = {};
  var p = Object.create(g);
  var o = Object.create(p);
  console.assert(!o.isPrototypeOf(o), pfx + ' self');
  console.assert(!Object.prototype.isPrototypeOf(Object.create(null)),
                 pfx + ' unrelated');
  console.assert(!o.isPrototypeOf({}), pfx + ' siblings');
  console.assert(g.isPrototypeOf(o), pfx + ' grandchild');
  console.assert(p.isPrototypeOf(o), pfx + ' child');
  console.assert(!o.isPrototypeOf(p), pfx + ' parent');
  console.assert(!o.isPrototypeOf(g), pfx + ' grandparent');
};

tests.ObjectPrototypePropertyIsEnumerable = function() {
  try {
    Object.prototype.propertyIsEnumerable.call(null, '');
    console.assert(
        false, "Object.prototype.propertyIsEnumerable(null) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.prototype.propertyIsEnumerable(null) wrong error');
  }
  try {
    Object.prototype.propertyIsEnumerable.call(undefined, '');
    console.assert(
        false, "Object.prototype.propertyIsEnumerable(undefined) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.prototype.propertyIsEnumerable(undefined) wrong error');
  }
  var OppIE = Object.prototype.propertyIsEnumerable;
  console.assert(OppIE.call('foo', '0'),
                 'Object.prototype.propertyIsEnumerable primitive true');
  console.assert(!OppIE.call('foo', 'length'),
                 'Object.prototype.propertyIsEnumerable primitive false');
  var o = {foo: 'foo'};
  Object.defineProperty(o, 'bar', {value: 'bar', enumerable: false});
  console.assert(o.propertyIsEnumerable('foo'),
                 'Object.prototype.propertyIsEnumerable true');
  console.assert(!o.propertyIsEnumerable('bar'),
                 'Object.prototype.propertyIsEnumerable false 1');
  console.assert(!o.propertyIsEnumerable('baz'),
                 'Object.prototype.propertyIsEnumerable false 2');
};

///////////////////////////////////////////////////////////////////////////////
// Function and Function.prototype

tests.FunctionConstructor = function() {
  var f = new Function;
  console.assert(f() === undefined, 'new Function() returns callable');
  console.assert(f.length === 0, 'new Function() .length');
  var actual = String(f);
  var expected = 'function anonymous(\n) {\n\n}';
  console.assert(actual === expected, 'new Function() .toString() ' +
      'Actual: "' + actual + '" Expected: "' + expected + '"');

  f = new Function('return 42;');
  console.assert(f() === 42, 'new Function simple returns callable');
  console.assert(f.length === 0, 'new Function simple .length');
  actual = String(f);
  expected = 'function anonymous(\n) {\nreturn 42;\n}';
  console.assert(actual === expected, 'new Function simple .toString() ' +
      'Actual: "' + actual + '" Expected: "' + expected + '"');

  f = new Function('a, b', 'c', 'return a + b * c;');
  console.assert(f(2, 3, 10) === 32, 'new Function with args returns callable');
  console.assert(f.length === 3, 'new Function with args .length');
  actual = String(f);
  expected = 'function anonymous(a, b,c\n) {\nreturn a + b * c;\n}';
  console.assert(actual === expected, 'new Function with args .toString() ' +
      'Actual: "' + actual + '" Expected: "' + expected + '"');
};

tests.FunctionPrototypeHasNoPrototype = function() {
  console.assert(Function.prototype.hasOwnProperty('prototype') === false,
      'Function.prototype has no .prototype');
};

tests.FunctionPrototypeToStringApplyNonFunctionThrows = function() {
  try {
    Function.prototype.toString.apply({});
    console.assert(
        false, "Function.prototype.toString.apply non-function didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Function.prototype.toString().apply non-function wrong error');
  }
};

tests.FunctionPrototypeApplyNonFuncThrows = function() {
  try {
    var o = {};
    o.apply = Function.prototype.apply;
    o.apply();
    console.assert(false, "Function.prototype.apply non-function didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Function.prototype.apply non-function wrong error');
  }
};

tests.FunctionPrototypeApplyThis = function() {
  var o = {};
  function f() { return this; }
  console.assert(f.apply(o, []) === o, 'Function.prototype.apply this');
};

tests.FunctionPrototypeApplyArgsUndefinedOrNull = function() {
  var n = 0;
  function f() { n += arguments.length; }
  f.apply(undefined, undefined);
  f.apply(undefined, null);
  console.assert(n === 0, 'Function.prototype.apply(undefined) or null');
};

tests.FunctionPrototypeApplyArgsNonObject = function() {
  try {
    (function() {}).apply(undefined, 'not an object');
    console.assert(
        false, "Function.prototype.apply(..., non-object) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Function.prototype.apply(...., non-object) wrong error');
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
      'Function.prototype.apply(..., sparse)');
};

tests.FunctionPrototypeApplyArgsArraylike = function() {
  var n = (function(a, b, c) {
       return a + b + c;
     }).apply(undefined, {0: 1, 1: 2, 2: 3, length: 3});
  console.assert(n === 6, 'Function.prototype.apply(..., array-like)');
};

tests.FunctionPrototypeApplyArgsNonArraylike = function() {
  console.assert(isNaN((function(a, b, c) {
    return a + b + c;
  }).apply(undefined, {0: 1, 1: 2, 2: 4})),
      'Function.prototype.apply(..., non-array-like)');
};

tests.FunctionPrototypeCallNonFuncThrows = function() {
  try {
    var o = {};
    o.call = Function.prototype.call;
    o.call();
    console.assert(false, "Function.prototype.call non-func didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Function.prototype.call non-func wrong error');
  }
};

tests.FunctionPrototypeCallThis = function() {
  var o = {};
  function f() { return this; }
  console.assert(f.call(o) === o, 'Function.prototype.call this');
};

tests.FunctionPrototypeCallNoArgs = function() {
  function f() { return arguments.length; }
  console.assert(f.call(undefined) === 0, 'Function.prototype.call no args');
};

tests.FunctionPrototypeCall = function() {
  var f = function(a, b, c) {
    if (!(1 in arguments)) {
      throw Error("Argument 1 missing");
    }
    return a + c;
  };
  console.assert(f.call(undefined, 1, 2, 3) === 4, 'Function.prototype.call');
};

tests.FunctionPrototypeBindNonFuncThrows = function() {
  try {
    var o = {};
    o.bind = Function.prototype.bind;
    o.bind();
    console.assert(false, "Function.prototype.bind non-func didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Function.prototype.bind non-func wrong error');
  }
};

tests.FunctionPrototypeBindThis = function() {
  var o = {};
  function f() { return this; }
  console.assert(f.bind(o)() === o, 'Function.prototype.bind this');
};

tests.FunctionPrototypeBindNoArgs = function() {
  function f() { return arguments.length; }
  console.assert(f.bind(undefined)() === 0, 'Function.prototype.bind no args');
};

tests.FunctionPrototypeBind = function() {
  var d = 4;
  var f = function(a, b, c) {
    return a + b + c + d;
  };
  console.assert(f.bind(undefined, 1).bind(undefined, 2)(3) === 10,
      'Function.prototype.bind');
};

tests.FunctionPrototypeBindCallBF = function() {
  var constructed;
  function Foo() {constructed = (this instanceof Foo)}
  var f = Foo.bind();
  f();
  console.assert(constructed === false,
      'Function.prototype.bind: calling bound function calls target');
};

tests.FunctionPrototypeBindConstructBF = function() {
  var constructed;
  function Foo() {constructed = (this instanceof Foo)}
  var f = Foo.bind();
  new f;
  console.assert(constructed === true,
      'Function.prototype.bind: constructing bound function constructs target');
};

tests.FunctionPrototypeCallBindConstructBF = function() {
  var invoked;
  function Foo() {invoked = true;}
  var f = Foo.call.bind(Foo);
  try {
    new f;
    console.assert(false, "Calling bound call function didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Calling bound call function threw wrong error');
  }
  console.assert(!invoked, 'Calling bound call function invoked call target');
};

///////////////////////////////////////////////////////////////////////////////
// Array and Array.prototype

tests.ArrayNoArgs = function() {
  var a = new Array;
  console.assert(Array.isArray(a), 'new Array() returns array');
  console.assert(a.length === 0, '(new Array().length');
};

tests.ArrayNumericArg = function() {
  var a = new Array(42);
  console.assert(Array.isArray(a), 'new Array(number) returns array');
  console.assert(!(0 in a), 'new Array(number) has no first item');
  console.assert(!(41 in a), 'new Array(number) has no last item');
  console.assert(a.length === 42, 'new Array(number).length');
};

tests.ArrayNonNumericArg = function() {
  var a = new Array('foo');
  console.assert(Array.isArray(a), 'new Array(non-number) returns array');
  console.assert(a.length === 1, 'new Array(non-number).length');
  console.assert(a[0] ==='foo', 'new Array(non-number)[0]');
};

tests.ArrayMultipleArgs = function() {
  var a = new Array(1, 2, 3);
  console.assert(Array.isArray(a), 'new Array(multiple...) return array');
  console.assert(a.length === 3, 'new Array(multiple...).ength');
  console.assert(String(a) ==='1,2,3', 'new Array(multiple...).toString()');
};

tests.ArrayIsArrayArrayPrototype = function() {
  console.assert(
      Array.isArray(Array.prototype), 'Array.isArray Array.prototype');
};

tests.ArrayIsArrayArrayInstance = function() {
  console.assert(Array.isArray(new Array), 'Array.isArray Array instance');
};

tests.ArrayIsArrayArrayLiteral = function() {
  console.assert(Array.isArray([]), 'Array.isArray Array literal');
};

tests.ArrayIsArrayArrayLike = function() {
  console.assert(!Array.isArray({0: 'foo', 1: 'bar', length: 2}),
      'Array.isArray(array-like)');
};

tests.ArrayPrototypeConcat = function() {
  var a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
  var c = a.concat();
  console.assert(a.length === 6 && c.length === 6 && c !== a &&
      String(c) === String(a), 'Array.prototype.concat()');

  var o = {0: 'quux', 1: 'quuux', length: 2};
  c = [].concat(['foo', 'bar'], 'baz', undefined, o);
  console.assert(c.length === 5 && '3' in c && c[3] === undefined &&
      String(c) === 'foo,bar,baz,,[object Object]',
      'Array.prototype.concat(...)');

  o = {0: 'foo', 1: 'bar', length: 2};
  c = Array.prototype.concat.call(o, 'baz', [, 'quux', 'quuux']);
  console.assert(c.length === 5 &&
      String(c) === '[object Object],baz,,quux,quuux',
      'Array.prototype.concat.call(object, ...)');
};

tests.ArrayPrototypeIndexOf = function() {
  console.assert([1, 2, 3, 2, 1].indexOf(2) === 1, 'Array.prototype.indexOf');
  console.assert([1, 2, 3, 2, 1].indexOf(4) === -1,
      'Array.prototype.indexOf not found');
  console.assert([1, 2, 3, 2, 1].indexOf(2, 2) === 3,
      'Array.prototype.indexOf(..., +)');
  console.assert([1, 2, 3, 2, 1].indexOf(1, -3) === 4,
      'Array.prototype.indexOf(..., -)');
  console.assert(['x', NaN, 'y'].indexOf(NaN) === -1,
      'Array.prototype.indexOf NaN');

  var o = {0: 1, 1: 2, 2: 3, 3: 2, 4: 1, length: 5};
  console.assert(Array.prototype.indexOf.call(o, 2) === 1,
      'Array.prototype.indexOf.call(array-like, ...)');
};

tests.ArrayPrototypeJoin = function() {
  console.assert([1, 2, 3].join('-') === '1-2-3', 'Array.prototype.join');
};

tests.ArrayPrototypeLastIndexOf = function() {
  console.assert([1, 2, 3, 2, 1].lastIndexOf(2) === 3,
      'Array.prototype.lastIndexOf');
  console.assert([1, 2, 3, 2, 1].lastIndexOf(4) === -1,
      'Array.prototype.lastIndexOf not found');
  console.assert([1, 2, 3, 2, 1].lastIndexOf(2, 2) === 1,
      'Array.prototype.lastIndexOf(..., +)');
  console.assert([1, 2, 3, 2, 1].lastIndexOf(1, -3) === 0,
      'Array.prototype.lastIndexOf(..., -)');

  var o = {0: 1, 1: 2, 2: 3, 3: 2, 4: 1, length: 5};
  console.assert(Array.prototype.lastIndexOf.call(o, 2) === 3,
      'Array.prototype.lastIndexOf.call(array-like, ...)');
};

tests.ArrayPrototypeJoinCycleDetection = function() {
  var a = [1, , 3];
  a[1] = a;
  a.join('-');
  // Didn't crash!
  console.assert(true, 'Array.prototype.join cycle detection');
};

tests.ArrayPrototypePop = function() {
  var a = ['foo', 'bar', 'baz'];
  var r = a.pop();
  console.assert(a.length === 2 && r === 'baz', 'Array.prototype.pop');

  a = [];
  r = a.pop();
  console.assert(
      a.length === 0 && r === undefined, 'Array.prototype.pop empty array');

  var o = {0: 'foo', 1: 'bar', 2: 'baz', length: 3};
  r = Array.prototype.pop.apply(o);
  console.assert(
      o.length === 2 && r === 'baz', 'Array.prototype.pop.apply(array-like)');

  o = {length: 0};
  r = Array.prototype.pop.apply(o);
  console.assert(o.length === 0 && r === undefined,
      'Array.prototype.pop.apply(empty array-like)');

  o = {5000000000000000: 'foo',
       5000000000000001: 'quux',
       length: 5000000000000002};
  r = Array.prototype.pop.apply(o);
  console.assert(o.length === 5000000000000001 && o[5000000000000000] === 'foo',
      'Array.prototype.pop.apply(huge array-like)');
};

tests.ArrayPrototypePush = function() {
  var a = [];
  console.assert(a.push('foo') === 1 && a.push('bar') === 2 &&
      a.length === 2 && a[0] === 'foo' && a[1] === 'bar',
      'Array.prototype.push');

  var o = {length: 0};
  console.assert(Array.prototype.push.call(o, 'foo') === 1 &&
      Array.prototype.push.call(o, 'bar') === 2 &&
      o.length === 2 && o[0] === 'foo' && o[1] === 'bar',
      'Array.prototype.push.call(array-like, ...)');

  var o = {length: 5000000000000000};
  console.assert(Array.prototype.push.call(o, 'foo') === 5000000000000001 &&
      Array.prototype.push.call(o, 'bar') === 5000000000000002 &&
      o[5000000000000000] === 'foo' && o[5000000000000001] === 'bar' &&
      o.length === 5000000000000002,
      'Array.prototype.push.call(huge array-like, ...)');
};

tests.ArrayPrototypeReverse = function () {
  var a = [1, 2, 3];
  console.assert(a.reverse() === a && a.length === 3 && String(a) === '3,2,1',
      'Array.prototype.reverse odd-length');

  a = [1, 2, , 4];
  console.assert(a.reverse() === a && a.length === 4 && String(a) === '4,,2,1',
      'Array.prototype.reverse even-length');

  a = [];
  console.assert(a.reverse() === a && a.length === 0,
      'Array.prototype.reverse empty');

  var o = {0: 1, 1: 2, 2: 3, length: 3};
  console.assert(Array.prototype.reverse.call(o) === o &&
      o.length === 3 && Array.prototype.slice.apply(o).toString() === '3,2,1',
      'Array.prototype.reverse.call(odd-length array-like)');

  o = {0: 1, 1: 2, 3: 4, length: 4};
  console.assert(Array.prototype.reverse.call(o) === o &&
      o.length === 4 && Array.prototype.slice.apply(o).toString() === '4,,2,1',
      'Array.prototype.reverse.call(even-length array-like)');

  o = {length: 0};
  console.assert(Array.prototype.reverse.call(o) === o && o.length === 0,
      'Array.prototype.reverse.call(empty array-like)');
};

tests.ArrayPrototypeShift = function() {
  var a = ['foo', 'bar', 'baz'];
  var r = a.shift();
  console.assert(a.length === 2 && a[0] === 'bar' && a[1] === 'baz' &&
      r === 'foo', 'Array.prototype.shift');

  a = [];
  r = a.shift();
  console.assert(
      a.length === 0 && r === undefined, 'Array.prototype.shift empty array');

  var o = {0: 'foo', 1: 'bar', 2: 'baz', length: 3};
  r = Array.prototype.shift.apply(o);
  console.assert(o.length === 2 && o[0] === 'bar' && o[1] === 'baz' &&
      r === 'foo', 'Array.prototype.shift.apply(array-like)');

  o = {length: 0};
  r = Array.prototype.shift.apply(o);
  console.assert(o.length === 0 && r === undefined,
      'Array.prototype.shift.apply(empty array-like)');

  // SKIP until more efficient shift implementation available.
  console.log('SKIP:\tArray.prototype.shift.apply(huge array-like)');
  // o = {5000000000000000: 'foo',
  //      5000000000000001: 'quux',
  //      length: 5000000000000002};
  // r = Array.prototype.shift.apply(o);
  // console.assert(o.length === 5000000000000001 && o[5000000000000000] === 'quux',
  //     'Array.prototype.shift.apply(huge array-like)');
};

tests.ArrayPrototypeSlice = function() {
  var a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
  var s = a.slice();
  console.assert(a.length === 6 && s.length === 6 && String(s) === String(a),
      'Array.prototype.slice()');

  s = a.slice(-2);
  console.assert(a.length === 6 && s.length === 2 && String(s) === 'quux,quuux',
      'Array.prototype.slice(-)');

  s = a.slice(1, 4);
  console.assert(a.length === 6 && s.length === 3 && !('2' in s) &&
      String(s) === 'bar,baz,', 'Array.prototype.slice(+, +)');

  s = a.slice(1, -2);
  console.assert(a.length === 6 && s.length === 3 && !('2' in s) &&
      String(s) === 'bar,baz,', 'Array.prototype.slice(+, +)');

  var o = {0: 'foo', 1: 'bar', 2: 'baz', 4: 'quux', 5: 'quuux', length: 6};
  s = Array.prototype.slice.call(o, 1, -2);
  console.assert(o.length === 6 && s.length === 3 && !('2' in s) &&
      String(s) === 'bar,baz,', 'Array.prototype.slice.call(array-like, -, +)');

  o = {
    5000000000000000: 'foo', 5000000000000001: 'bar',
    5000000000000002: 'baz', 5000000000000004: 'quux',
    5000000000000005: 'quuux', length: 5000000000000006
  };
  s = Array.prototype.slice.call(o, -5, -2);
  console.assert(o.length === 5000000000000006 &&
      s.length === 3 && !('2' in s) && String(s) === 'bar,baz,',
      'Array.prototype.slice.call(huge array-like, -, -)');
};

tests.ArrayPrototypeSort = function() {
  console.assert([5, 2, 3, 1, 4].sort().join() === '1,2,3,4,5',
      'Array.prototype.sort()');

  // TODO(cpcallen):
  console.assert(['z', undefined, 10, , 'aa', null, 'a', 5, NaN, , 1].sort()
      .map(String).join() === '1,10,5,NaN,a,aa,null,z,undefined,,',
      'Array.prototype.sort() compaction');
  
  console.assert([99, 9, 10, 11, 1, 0, 5].sort(function(a, b) {return a - b;})
      .join() === '0,1,5,9,10,11,99',
      'Array.prototype.sort(comparefn)');

  // TODO(cpcallen):
  console.assert(['z', undefined, 10, , 'aa', null, 'a', 5, NaN, , 1].sort(
      function(a, b) {
        // Try to put undefineds first - should not succeed.
        if (a === undefined) return b === undefined ? 0 : -1;
        if (b === undefined) return 1;
        // Reverse order of ususal sort.
        a = String(a);
        b = String(b);
        if (a > b) return -1;
        if (b > a) return 1;
        return 0;
      }).map(String).join() === 'z,null,aa,a,NaN,5,10,1,undefined,,',
      'Array.prototype.sort(comparefn) compaction');
};

tests.ArrayPrototypeSplice = function() {
  var a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
  var s = a.splice();
  console.assert(a.length === 6 && String(a) === 'foo,bar,baz,,quux,quuux' &&
      s.length === 0 && String(s) === '', 'Array.prototype.splice()');

  a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
  s = a.splice(-2);
  console.assert(a.length === 4 && String(a) === 'foo,bar,baz,' &&
      s.length === 2 && String(s) === 'quux,quuux',
      'Array.prototype.splice(-)');

  a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
  s = a.splice(1, 3, 'bletch');
  console.assert(a.length === 4 && String(a) === 'foo,bletch,quux,quuux' &&
      s.length === 3 && String(s) === 'bar,baz,',
      'Array.prototype.splice(+, +, ...)');

  var o = {0: 'foo', 1: 'bar', 2: 'baz', 4: 'quux', 5: 'quuux', length: 6};
  s = Array.prototype.splice.call(o, 0, 100, 'bletch');
  console.assert(!Array.isArray(o) && o.length === 1 &&
      Object.keys(o).length === 2 && o[0] === 'bletch' &&
      s.length === 6 && !('3' in s) && String(s) === 'foo,bar,baz,,quux,quuux',
      'Array.prototype.splice.call(array-like, 0, large, ...)');

  o = {
    5000000000000000: 'foo', 5000000000000001: 'bar',
    5000000000000002: 'baz', 5000000000000004: 'quux',
    5000000000000005: 'quuux', length: 5000000000000006
  };
  s = Array.prototype.splice.call(o, -2, -999, 'bletch', 'qux');
  console.assert(!Array.isArray(o) && o.length === 5000000000000008 &&
      o[5000000000000004] === 'bletch' && o[5000000000000005] === 'qux' &&
      o[5000000000000006] === 'quux' && o[5000000000000007] === 'quuux' &&
      Array.isArray(s) && s.length === 0,
      'Array.prototype.splice.call(huge array-like, -, -)');
};

tests.ArrayPrototypeToStringCycleDetection = function() {
  var a = [1, , 3];
  a[1] = a;
  a.toString();
  // Didn't crash!
  console.assert(true, 'Array.prototype.toString cycle detection');
};

tests.ArrayPrototypeUnshift = function() {
  var a = [];
  console.assert(a.unshift('foo') === 1 && a.unshift('bar') === 2 &&
      a.length === 2 && a[0] === 'bar' && a[1] === 'foo',
      'Array.prototype.unshift');

  var o = {length: 0};
  console.assert(Array.prototype.unshift.call(o, 'foo') === 1 &&
      Array.prototype.unshift.call(o, 'bar') === 2 &&
      o.length === 2 && o[0] === 'bar' && o[1] === 'foo',
      'Array.prototype.unshift.call(array-like, ...)');

  // SKIP until more efficient unshift implementation available.
  console.log('SKIP:\tArray.prototype.unshift.apply(huge array-like, ...)');
  // var o = {length: 5000000000000000};
  // console.assert(Array.prototype.unshift.call(o, 'foo') === 5000000000000001 &&
  //     Array.prototype.unshift.call(o, 'bar') === 5000000000000002 &&
  //     o[5000000000000000] === 'foo' && o[5000000000000001] === 'bar' &&
  //     o.length === 5000000000000002,
  //     'Array.prototype.unshift.call(huge array-like, ...)');
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
                   'Array legal index ' + JSON.stringify(tc[0]));
    var a = [];
    try {
      a.length = tc[0];
      if (isNaN(tc[2])) {
        console.assert(false,
            "Array illegal .length didn't throw " + JSON.stringify(tc[0]));
      }
    } catch (e) {
      console.assert(e.name === 'RangeError',
           'Array illegal .length wrong error ' + JSON.stringify(tc[0]));
    }
  }
};


///////////////////////////////////////////////////////////////////////////////
// Boolean and Boolean.prototype

tests.Boolean = function() {
  console.assert(Boolean(undefined) === false, 'Boolean undefined');
  console.assert(Boolean(null) === false, 'Boolean null');
  console.assert(Boolean(false) === false, 'Boolean false');
  console.assert(Boolean(true) === true, 'Boolean true');
  console.assert(Boolean(NaN) === false, 'Boolean NaN');
  console.assert(Boolean(0) === false, 'Boolean 0');
  console.assert(Boolean(1) === true, 'Boolean 1');
  console.assert(Boolean('') === false, 'Boolean empty string');
  console.assert(Boolean('foo') === true, 'Boolean non-empty string');
  console.assert(Boolean({}) === true, 'Boolean object');
  console.assert(Boolean([]) === true, 'Boolean array');
  console.assert(Boolean(function() {}) === true, 'Boolean function');
};

tests.BooleanPrototypeToString = function () {
  console.assert(Boolean.prototype.toString() === 'false',
      'Boolean.prototype.toString()');
  console.assert(Boolean.prototype.toString.call(true) === 'true',
      'Boolean.prototype.toString.call(true)');
  console.assert(Boolean.prototype.toString.call(false) === 'false',
                 'Boolean.prototype.toString.call(false)');
  try {
    Boolean.prototype.toString.call({});
    console.assert(false, "Boolean.prototype.toString.call({}) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Boolean.prototype.toString.call({}) wrong error');
  }
};

tests.BooleanPrototypeValueOf = function () {
  console.assert(Boolean.prototype.valueOf() === false,
      'Boolean.prototype.valueOf()');
  console.assert(Boolean.prototype.valueOf.call(true) === true,
      'Boolean.prototype.valueOf.call(true)');
  console.assert(Boolean.prototype.valueOf.call(false) === false,
                 'Boolean.prototype.valueOf.call(false)');
  try {
    Boolean.prototype.valueOf.call({});
    console.assert(false, "Boolean.prototype.valueOf.call({}) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Boolean.prototype.valueOf.call({}) wrong error');
  }
};

///////////////////////////////////////////////////////////////////////////////
// Number and Number.prototype

tests.Number = function() {
  console.assert(Number() === 0, 'Number()');
  console.assert(isNaN(Number(undefined)), 'Number undefined');
  console.assert(Number(null) === 0, 'Number null');
  console.assert(Number(true) === 1, 'Number true');
  console.assert(Number(false) === 0, 'Number false');
  console.assert(Number('42') === 42, "Number '42'");
  console.assert(isNaN(Number('Hello')), 'Number non-empty string');
  console.assert(Number('') === 0, 'Number empty string');
  console.assert(Number(3.1) === 3.1, 'Number number');
  console.assert(isNaN(Number({})), 'Number object');
  console.assert(Number([]) === 0, 'Number []');
  console.assert(Number([42]) === 42, 'Number [42]');
  console.assert(isNaN(Number([1,2,3])), 'Number [1,2,3]');
  console.assert(isNaN(Number(function() {})), 'Number function');
  console.assert(isNaN(Number.NaN), 'Number NaN');
  console.assert(!isFinite(Number.POSITIVE_INFINITY), 'Number  +Infinity');
  console.assert(!isFinite(Number.NEGATIVE_INFINITY), 'Number  -Infinity');
  console.assert(Number.POSITIVE_INFINITY === -Number.NEGATIVE_INFINITY,
      'Number infinities');
};

tests.NumberPrototypeToString = function () {
  console.assert(Number.prototype.toString() === '0',
      'Number.prototype.toString()');
  console.assert(Number.prototype.toString.call(84) === '84',
      'Number.prototype.toString.call(85)');
  try {
    Number.prototype.toString.call({});
    console.assert(false, "Number.prototype.toString.call({}) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Number.prototype.toString.call({}) wrong error');
  }
};

// Run some tests of Number.toString(radix) with various different
// radix arguments.
tests.NumberPrototypeToStringRadix = function() {
  var cases = [
    [42, , '42'],
    [42, 16, '2a'],
    // Old versions of Node incorrectly reports '-132.144444'.
    [-42.4, 5, '-132.2'],
    [42, '2', '101010'],
    [-3.14, , '-3.14'],
    [999999999999999999999999999, undefined, '1e+27'],
    [NaN, undefined, 'NaN'],
    [Infinity, , 'Infinity'],
    [-Infinity, , '-Infinity'],
  ];
  for (var i = 0, tc; (tc = cases[i]); i++) {
    console.assert(Number.prototype.toString.call(tc[0], tc[1]) === tc[2],
        'Number.prototype.toString.call(' + tc[0] + ', ' + tc[1] + ')');
  }
};

tests.NumberPrototypeValueOf = function () {
  console.assert(Number.prototype.valueOf() === 0,
      'Number.prototype.valueOf()');
  console.assert(Number.prototype.valueOf.call(85) === 85,
      'Number.prototype.valueOf.call(85)');
  try {
    Number.prototype.valueOf.call({});
    console.assert(false, "Number.prototype.valueOf.call({}) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Number.prototype.valueOf.call({}) wrong error');
  }
};

///////////////////////////////////////////////////////////////////////////////
// String and String.prototype

tests.String = function() {
  console.assert(String() === '', 'String()');
  console.assert(String(undefined) === 'undefined', 'String undefined');
  console.assert(String(null) === 'null', 'String null');
  console.assert(String(true) === 'true', 'String true');
  console.assert(String(false) === 'false', 'String false');
  console.assert(String(0) === '0', 'String 0');
  console.assert(String(-0) === '0', 'String -0');
  console.assert(String(Infinity) === 'Infinity', 'String +Infinity');
  console.assert(String(-Infinity) === '-Infinity', 'String -Infinity');
  console.assert(String(NaN) === 'NaN', 'String NaN');
  console.assert(String({}) === '[object Object]', 'String object');
  console.assert(String([1, 2, 3,,5]) === '1,2,3,,5', 'String array');
};

tests.StringPrototypeLength = function() {
  console.assert(String.prototype.length === 0, 'String.prototype.length');
};

tests.StringPrototypeReplaceStringString = function() {
  console.assert('xxxx'.replace('xx', 'y') === 'yxx',
      'String.prototype.replace(string, string)');
};

tests.StringPrototypeReplaceRegExpString = function() {
  console.assert('xxxx'.replace(/(X)\1/ig, 'y') === 'yy',
      'String.prototype.replace(regexp, string)');
};

tests.StringPrototypeReplaceStringFunction = function() {
  var str = 'xxxx'.replace('xx', function () {
      return '[' + Array.prototype.join.apply(arguments) + ']';
  });
  console.assert(str === '[xx,0,xxxx]xx',
      'String.prototype.replace(string, function)');
};

tests.StringPrototypeReplaceRegExpFunction = function() {
  var str = 'xxxx'.replace(/(X)\1/ig, function () {
      return '[' + Array.prototype.join.apply(arguments) + ']';
  });
  console.assert(str === '[xx,x,0,xxxx][xx,x,2,xxxx]',
      'String.prototype.replace(regexp, function)');
};

tests.StringPrototypeSearch = function() {
  console.assert('hello'.search('H') === -1,
      'String.prototype.search(string) not found');
  console.assert('hello'.search('ll') === 2,
      'String.prototype.search(string) found');
  console.assert('hello'.search(/H/) === -1,
      'String.prototype.search(regexp) not found');
  console.assert('hello'.search(/(.)\1/) === 2,
      'String.prototype.search(regexp) found');
};

tests.StringPrototypeToString = function () {
  console.assert(String.prototype.toString() === '',
      'String.prototype.toString()');
  console.assert(String.prototype.toString.call('a string') === 'a string',
      "String.prototype.toString.call('a string')");
  try {
    String.prototype.toString.call({});
    console.assert(false, "String.prototype.toString.call({}) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'String.prototype.toString.call({}) wrong error');
  }
};

tests.StringPrototypeValueOf = function () {
  console.assert(String.prototype.valueOf() === '',
      'String.prototype.valueOf()');
  console.assert(String.prototype.valueOf.call('a string') === 'a string',
      "String.prototype.valueOf.call('a string')");
  try {
    String.prototype.valueOf.call({});
    console.assert(false, "String.prototype.valueOf.call({}) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'String.prototype.valueOf.call({}) wrong error');
  }
};

///////////////////////////////////////////////////////////////////////////////
// RegExp

tests.RegExpPrototypeTestApplyNonRegExpThrows = function() {
  try {
    /foo/.test.apply({}, ['foo']);
    console.assert(
        false, "RegExp.prototype.test.apply(non-regexp) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'RegExp.prototype.test.apply(non-regexp) wrong error');
  }
};

///////////////////////////////////////////////////////////////////////////////
// JSON

tests.JsonStringify = function () {
  var obj = {string: 'foo', number: 42, true: true, false: false, null: null,
       object: { obj: {}, arr: [] }, array: [{}, []] };
  var str = '{"string":"foo","number":42,"true":true,"false":false,' +
      '"null":null,"object":{"obj":{},"arr":[]},"array":[{},[]]}';
  console.assert(JSON.stringify(obj) === str, 'JSON.stringify basic');

  console.assert(JSON.stringify(function(){}) === undefined,
      'JSON.stringify(function(){})');

  console.assert(JSON.stringify([function(){}]) === '[null]',
      'JSON.stringify([function(){}])');

  console.assert(JSON.stringify({f: function(){}}) === '{}',
      'JSON.stringify({f: function(){}})');

  str = '{"string":"foo","number":42}';
  console.assert(JSON.stringify(obj, ['string', 'number']) === str,
      'JSON.stringify filter');

  str = '{\n  "string": "foo",\n  "number": 42\n}';
  console.assert(JSON.stringify(obj, ['string', 'number'], 2) === str,
      'JSON.stringify pretty number');

  str = '{\n--"string": "foo",\n--"number": 42\n}';
  console.assert(JSON.stringify(obj, ['string', 'number'], '--') === str,
      'JSON.stringify pretty string');

  obj = {e: 'enumerable', ne: 'nonenumerable'};
  Object.defineProperty(obj, 'ne', {enumerable: false});
  console.assert(JSON.stringify(obj) === '{"e":"enumerable"}',
      'JSON.stringify nonenumerable');

  console.assert(JSON.stringify(Object.create({foo: 'bar'})) === '{}',
      'JSON.stringify inherited');

  obj = {};
  obj.circular = obj;
  try {
    JSON.stringify(obj);
    console.assert(false, "JSON.stringify didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError', 'JSON.stringify wrong error');
  }
};

///////////////////////////////////////////////////////////////////////////////
// Other built-in functions

tests.decodeUriThrows = function() {
  try {
    decodeURI('%xy');
    console.assert(false, "decodeURI(invalid-URI) didn't throw");
  } catch (e) {
    console.assert(e.name === 'URIError', 'decodeURI(invalid-URI) wrong error');
  }
};

///////////////////////////////////////////////////////////////////////////////
// Other tests

tests.newHack = function() {
  console.assert(
      (new 'Array.prototype.push') === Array.prototype.push, 'new hack');
};

tests.newHackUnknown = function() {
  try {
    new 'nonexistent-builtin-name';
    console.assert(false, "new hack with unknown built-in didn't throw");
  } catch (e) {
    console.assert(e.name === 'ReferenceError',
        'new hack with unknown built-in wrong error');
  }
};

tests.newHacknNonLiteral = function() {
  try {
    var builtin = 'Object.prototype';
    new builtin;
    console.assert(false, "new hack with non-literal didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'new hack with non-literal wrong error');
  }
};

tests.es6CausesSyntaxErrors = function() {
  var tests = [
    // Class statements & expressions
    'class Foo{};',
    'false && class Foo{};',
     // Arrow functions.
    'false && [].map((item) => String(item));',
     // For-of statement.
    'for (var x of [1, 2, 3]) {};',
     // Let & const.
    'let x;',
    'const x;',
  ];
  for (var i = 0; i < tests.length; i++) {
    var src = tests[i];
    try {
      eval(tests[i]);
      console.assert(false, "es5 didn't throw for: " + src);
    } catch (e) {
      console.assert(e.name === 'SyntaxError',
          'es5 threw wrong error for: ' + src);
    }
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
      console.assert(false, "strict mode didn't throw for: " + src);
    } catch (e) {
      console.assert(e.name === 'SyntaxError',
          'strict mode wrong error for: ' + src);
    }
  }
};
