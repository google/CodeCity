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
 * @fileoverview Test the ES6 functions of the server.
 * @author fraser@google.com (Neil Fraser)
 */

// Test automatic setting of function .name properties.
tests.functionNameSetting = function() {
  var myAssignedFunc;
  myAssignedFunc = function() {};
  console.assert(myAssignedFunc.name === 'myAssignedFunc',
      'Assignment expression sets anonymous function name');

  var o = {myPropFunc: function() {}};
  console.assert(o.myPropFunc.name === 'myPropFunc',
      'Object expression sets anonymous function name');

  var myVarDeclFunc = function() {};
  console.assert(myVarDeclFunc.name === 'myVarDeclFunc',
      'Variable declaration sets anonymous function name');
};

// Run some tests of the various constructors and their associated
// literals and prototype objects.
tests.builtinClassesES6 = function() {
  var classes = [
    {
      constructor: WeakMap,
      classStr: '[object WeakMap]',
      prototypeClass: '[object Object]',
      functionNotConstructor: true  // WeakMap() can't be called without new.
    },
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
    // No need to check literals.
  }
};

///////////////////////////////////////////////////////////////////////////////
// Object and Object.prototype

tests.ObjectSetPrototypeOfNullUndefined = function() {
  try {
    Object.setPrototypeOf(null, null);
    console.assert(false, "Object.setPrototypeOf(null, ...) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.setPrototypeOf(null, ...) wrong error');
  }
  try {
    Object.setPrototypeOf(undefined, null);
    console.assert(false, "Object.setPrototypeOf(undefined, ...) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.setPrototypeOf(undefined, ...) wrong error');
  }
};

tests.ObjectSetPrototypeOfPrimitives = function() {
  console.assert(Object.setPrototypeOf(true, null) === true,
      'Object.setPrototypeOf boolean');
  console.assert(Object.setPrototypeOf(1337, null) === 1337,
      'Object.setPrototypeOf number');
  console.assert(Object.setPrototypeOf('hi', null) === 'hi',
      'Object.setPrototypeOf string');
};

tests.ObjectSetPrototypeOf = function() {
  var o = {parent: 'o'};
  var p = {parent: 'p'};
  var q = Object.create(o);
  console.assert(Object.setPrototypeOf(q, p) === q,
      'Object.setPrototypeOf(q, p) return value');
  console.assert(Object.getPrototypeOf(q) === p,
      'Object.setPrototypeOf(q, p) new parent');
  console.assert(q.parent === 'p',
      'Object.setPrototypeOf(q, p) inheritance');
};

tests.ObjectSetPrototypeOfToNull = function() {
  var o = {parent: 'o'};
  var q = Object.create(o);
  console.assert(Object.setPrototypeOf(q, null) === q,
      'Object.setPrototypeOf(q, null) return value');
  console.assert(Object.getPrototypeOf(q) === null,
      'Object.setPrototypeOf(q, null) new parent');
};

tests.ObjectSetPrototypeOfCircular = function() {
  var o = {};
  var p = Object.create(o);
  try {
    Object.setPrototypeOf(o, p);
    console.assert(false, "Object.setPrototypeOf(o, p) didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Object.setPrototypeOf(o, p) wrong error');
  }
};

tests.ObjectIs = function() {
  console.assert(Object.is('foo', 'foo'), 'equal strings');
  console.assert(Object.is(Array, Array), 'equal objects');

  console.assert(!Object.is('foo', 'bar'), 'unequal strings');
  console.assert(!Object.is([], []), 'unequal objects');

  var test = {a: 1};
  console.assert(Object.is(test, test), 'custom object');

  console.assert(Object.is(null, null), 'null');

  console.assert(!Object.is(0, -0), 'unequal zero');
  console.assert(Object.is(-0, -0), 'negative zero');
  console.assert(Object.is(NaN, 0/0), 'NaN');
};

///////////////////////////////////////////////////////////////////////////////
// Function and Function.prototype

tests.FunctionPrototypeBindClassConstructor = function() {
  var f = WeakMap.bind();
  try {
    f();
    console.assert(false, "Calling bound class constructor didn't throw");
  } catch (e) {
    console.assert(e.name === 'TypeError',
        'Calling bound class constructor threw wrong error');
  }
}

tests.FunctionPrototypeBindClassConstructorNew = function() {
  console.assert(String(new (WeakMap.bind())) === '[object WeakMap]',
      'FunctionPrototypeBindClassConstructorNew');
};

///////////////////////////////////////////////////////////////////////////////
// Array and Array.prototype

tests.ArrayFind = function() {
  var inventory = [
      {name: 'apples', quantity: 2},
      {name: 'bananas', quantity: 0},
      {name: 'cherries', quantity: 5}
  ];
  function isCherries(fruit) {
    return fruit.name === 'cherries';
  }
  console.assert([].find(isCherries) === undefined, 'Array.find 0');
  console.assert(inventory.find(isCherries) === inventory[2], 'Array.find 1');
};

tests.ArrayFindIndex = function() {
  var inventory = [
      {name: 'apples', quantity: 2},
      {name: 'bananas', quantity: 0},
      {name: 'cherries', quantity: 5}
  ];
  function isCherries(fruit) {
    return fruit.name === 'cherries';
  }
  console.assert([].findIndex(isCherries) === -1, 'Array.findIndex 0');
  console.assert(inventory.findIndex(isCherries) === 2, 'Array.findIndex 1');
};

///////////////////////////////////////////////////////////////////////////////
// String and String.prototype

tests.StringBooleanSearchFunctions = function() {
  var str = 'To be, or not to be, that is the question.';

  console.assert(str.includes('To be'), 'Includes "To be"');
  console.assert(str.includes('question'), 'Includes "question"');
  console.assert(!str.includes('nonexistent'), 'Includes "nonexistent"');
  console.assert(!str.includes('To be', 1), 'Includes "To be" (1)');
  console.assert(!str.includes('TO BE'), 'Includes "TO BE"');

  console.assert(str.startsWith('To be'), 'StartsWith "To be"');
  console.assert(!str.startsWith('not to be'), 'StartsWith "not to be"');
  console.assert(str.startsWith('not to be', 10), 'StartsWith "not to be" (10)');

  console.assert(str.endsWith('question.'), 'EndsWith "question."');
  console.assert(!str.endsWith('to be'), 'EndsWith "to be"');
  console.assert(str.endsWith('to be', 19), 'EndsWith "to be" (19)');
};

tests.StringRepeat = function() {
  try {
    'abc'.repeat(-1);
    console.assert(false, 'Repeat Negative');
  } catch (e) {
    console.assert(e.name === 'RangeError',
                   'Repeat Negative Error');
  }
  console.assert('abc'.repeat(0) === '', 'Repeat 0');
  console.assert('abc'.repeat(1) === 'abc', 'Repeat 1');
  console.assert('abc'.repeat(2) === 'abcabc', 'Repeat 2');
  console.assert('abc'.repeat(3.5) === 'abcabcabc', 'Repeat 3.5');
  try {
    'abc'.repeat(1 / 0);
    console.assert(false, 'RegExpPrototypeTestApplyNonRegExpThrows');
  } catch (e) {
    console.assert(e.name === 'RangeError',
                   'RegExpPrototypeTestApplyNonRegExpThrowsError');
  }
};

///////////////////////////////////////////////////////////////////////////////
// Number

tests.NumberEpsilon = function() {
  console.assert(Number.EPSILON > 0, 'Epsilon > zero');
  console.assert(Number.EPSILON < 0.001, 'Epsilon < 0.001');
};

tests.NumberIsFinite = function() {
  console.assert(!Number.isFinite(Infinity), 'Number.isFinite Infinity');
  console.assert(!Number.isFinite(NaN), 'Number.isFinite NaN');
  console.assert(!Number.isFinite(-Infinity), 'Number.isFinite -Infinity');
  console.assert(Number.isFinite(0), 'Number.isFinite 0');
  console.assert(Number.isFinite(2e64), 'Number.isFinite 2e64');
  console.assert(!Number.isFinite('0'), 'Number.isFinite "0"');
  console.assert(!Number.isFinite(null), 'Number.isFinite null');
};

tests.NumberIsNaN = function() {
  console.assert(Number.isNaN(NaN), 'Number.isNaN NaN');
  console.assert(Number.isNaN(Number.NaN), 'Number.isNaN Number.NaN');
  console.assert(Number.isNaN(0 / 0), 'Number.isNaN 0 / 0');
  console.assert(!Number.isNaN('NaN'), 'Number.isNaN "NaN"');
  console.assert(!Number.isNaN(undefined), 'Number.isNaN undefined');
  console.assert(!Number.isNaN({}), 'Number.isNaN {}');
  console.assert(!Number.isNaN('blabla'), 'Number.isNaN "blabla"');
  console.assert(!Number.isNaN(true), 'Number.isNaN true');
  console.assert(!Number.isNaN(null), 'Number.isNaN null');
  console.assert(!Number.isNaN(37), 'Number.isNaN 37');
  console.assert(!Number.isNaN('37'), 'Number.isNaN "37"');
  console.assert(!Number.isNaN('37.37'), 'Number.isNaN "37.37"');
  console.assert(!Number.isNaN(''), 'Number.isNaN ""');
  console.assert(!Number.isNaN(' '), 'Number.isNaN " "');
};

tests.NumberIsInteger = function() {
  console.assert(Number.isInteger(-17), 'Number.isInteger -17');
  console.assert(Number.isInteger(Math.pow(2, 64)), 'Number.isInteger 2**64');
  console.assert(Number.isInteger(-Math.pow(2, 64)), 'Number.isInteger -2**64');
  console.assert(!Number.isInteger(NaN), 'Number.isInteger NaN');
  console.assert(!Number.isInteger(Infinity), 'Number.isInteger Infinity');
  console.assert(!Number.isInteger('3'), 'Number.isInteger "3"');
  console.assert(!Number.isInteger(3.1), 'Number.isInteger 3.1');
  console.assert(Number.isInteger(3.0), 'Number.isInteger 3.0');
};

tests.NumberIsSafeInteger = function() {
  console.assert(Number.isSafeInteger(3), 'Number.isSafeInteger 3');
  console.assert(!Number.isSafeInteger(Math.pow(2, 53)), 'Number.isSafeInteger 2**53');
  console.assert(Number.isSafeInteger(Math.pow(2, 53) - 1), 'Number.isSafeInteger 2**53-1');
  console.assert(!Number.isSafeInteger(NaN), 'Number.isSafeInteger NaN');
  console.assert(!Number.isSafeInteger(Infinity), 'Number.isSafeInteger Infinity');
  console.assert(!Number.isSafeInteger('3'), 'Number.isSafeInteger "3"');
  console.assert(!Number.isSafeInteger(3.1), 'Number.isSafeInteger 3.1');
  console.assert(Number.isSafeInteger(3.0), 'Number.isSafeInteger 3.0');
};

tests.NumberMaxSafeInteger = function() {
  console.assert(Number.MAX_SAFE_INTEGER + 1 === Math.pow(2, 53),
      'Number.MAX_SAFE_INTEGER');
  console.assert(Number.isSafeInteger(Number.MAX_SAFE_INTEGER),
      'Number.isSafeInteger(Number.MAX_SAFE_INTEGER);');
  console.assert(!Number.isSafeInteger(Number.MAX_SAFE_INTEGER + 1),
      'Number.isSafeInteger(Number.MAX_SAFE_INTEGER + 1);');
};

tests.NumberMinSafeInteger = function() {
  console.assert(Number.MIN_SAFE_INTEGER === -(Math.pow(2, 53) - 1),
      'Number.MIN_SAFE_INTEGER');
  console.assert(Number.isSafeInteger(Number.MIN_SAFE_INTEGER),
      'Number.isSafeInteger(Number.MIN_SAFE_INTEGER);');
  console.assert(!Number.isSafeInteger(Number.MIN_SAFE_INTEGER - 1),
      'Number.isSafeInteger(Number.MIN_SAFE_INTEGER - 1);');
};

///////////////////////////////////////////////////////////////////////////////
// Math

tests.MathAcosh = function() {
  console.assert(Number.isNaN(Math.acosh(-1)), 'Math.acosh -1');
  console.assert(Number.isNaN(Math.acosh(0)), 'Math.acosh 0');
  console.assert(Number.isNaN(Math.acosh(0.5)), 'Math.acosh 0.5');
  console.assert(Math.acosh(1) === 0, 'Math.acosh 1');
  console.assert(Math.acosh(2).toPrecision(10) === '1.316957897', 'Math.acosh 2');
};

tests.MathAsinh = function() {
  console.assert(Math.asinh(1).toPrecision(10) === '0.8813735870', 'Math.asinh 1');
  console.assert(Math.asinh(0) === 0, 'Math.asinh 0');
};

tests.MathAtanh = function() {
  console.assert(Number.isNaN(Math.atanh(-2)), 'Math.atanh -2');
  console.assert(Math.atanh(-1) === -Infinity, 'Math.atanh -1');
  console.assert(Math.atanh(0) === 0, 'Math.atanh 0');
  console.assert(Math.atanh(0.5).toPrecision(10) === '0.5493061443', 'Math.atanh 0.5');
  console.assert(Math.atanh(1) === Infinity, 'Math.atanh 1');
  console.assert(Number.isNaN(Math.atanh(2)), 'Math.atanh 2');
};

tests.MathCbrt = function() {
  console.assert(Number.isNaN(Math.cbrt(NaN)), 'Math.cbrt NaN');
  console.assert(Math.cbrt(-1) === -1, 'Math.cbrt -1');
  console.assert(Object.is(Math.cbrt(-0), -0), 'Math.cbrt -0');
  console.assert(Math.cbrt(-Infinity) === -Infinity, 'Math.cbrt -Infinity');
  console.assert(Object.is(Math.cbrt(0), 0), 'Math.cbrt 0');
  console.assert(Math.cbrt(1) === 1, 'Math.cbrt 1');
  console.assert(Math.cbrt(Infinity) === Infinity, 'Math.cbrt Infinity');
  console.assert(Math.cbrt(null) === 0, 'Math.cbrt null');
  console.assert(Math.cbrt(2).toPrecision(10) === '1.259921050', 'Math.cbrt 2');
};

tests.MathClz32 = function() {
  console.assert(Math.clz32(1) === 31, 'Math.clz32 1');
  console.assert(Math.clz32(1000) === 22, 'Math.clz32 1000');
  console.assert(Math.clz32() === 32, 'Math.clz32 ()');
  console.assert(Math.clz32(NaN) === 32, 'Math.clz32 NaN');
  console.assert(Math.clz32(Infinity) === 32, 'Math.clz32 Infinity');
  console.assert(Math.clz32(-Infinity) === 32, 'Math.clz32 -Infinity');
  console.assert(Math.clz32(0) === 32, 'Math.clz32 0');
  console.assert(Math.clz32(-0) === 32, 'Math.clz32 -0');
  console.assert(Math.clz32(null) === 32, 'Math.clz32 null');
  console.assert(Math.clz32(undefined) === 32, 'Math.clz32 undefined');
  console.assert(Math.clz32('foo') === 32, 'Math.clz32 "foo"');
  console.assert(Math.clz32({}) === 32, 'Math.clz32 {}');
  console.assert(Math.clz32([]) === 32, 'Math.clz32 []');
  console.assert(Math.clz32(true) === 31, 'Math.clz32 true');
  console.assert(Math.clz32(3.5) === 30, 'Math.clz32 3.5');
};

tests.MathCosh = function() {
  console.assert(Math.cosh(-1).toPrecision(10) === '1.543080635', 'Math.cosh -1');
  console.assert(Math.cosh(0) === 1, 'Math.cosh 0');
  console.assert(Math.cosh(1).toPrecision(10) === '1.543080635', 'Math.cosh 1');
};

tests.MathExpm1 = function() {
  console.assert(Math.expm1(-1).toPrecision(10) === '-0.6321205588', 'Math.expm1 -1');
  console.assert(Math.expm1(0) === 0, 'Math.expm1 0');
  console.assert(Math.expm1(1).toPrecision(10) === '1.718281828', 'Math.expm1 1');
};

tests.MathFround = function() {
  console.assert(Math.fround(1.5) === 1.5, 'Math.fround 1.5');
  console.assert(Math.fround(1.337).toPrecision(10) === '1.337000012', 'Math.fround 1.337');
  console.assert(Math.fround(Math.pow(2, 150)) === Infinity, 'Math.fround 2**150');
  console.assert(Number.isNaN(Math.fround('abc')), 'Math.fround "abc"');
  console.assert(Number.isNaN(Math.fround(NaN)), 'Math.fround NaN');
};

tests.MathHypot = function() {
  console.assert(Math.hypot(3, 4) === 5, 'Math.hypot 3, 4');
  console.assert(Math.hypot(3, 4, 5).toPrecision(10) === '7.071067812', 'Math.hypot 3, 4, 5');
  console.assert(Math.hypot() === 0, 'Math.hypot ()');
  console.assert(Number.isNaN(Math.hypot(NaN)), 'Math.hypot NaN');
  console.assert(Number.isNaN(Math.hypot(3, 4, 'foo')), 'Math.hypot 3, 4, "foo"');
  console.assert(Math.hypot(3, 4, '5').toPrecision(10) === '7.071067812', 'Math.hypot 3, 4, "5"');
  console.assert(Math.hypot(-3) === 3, 'Math.hypot -3');
};

tests.MathImul = function() {
  console.assert(Math.imul(2, 4) === 8, 'Math.imul 2, 4');
  console.assert(Math.imul(-1, 8) === -8, 'Math.imul -1, 8');
  console.assert(Math.imul(-2, -2) === 4, 'Math.imul -2, -2');
  console.assert(Math.imul(0xffffffff, 5) === -5, 'Math.imul 0xffffffff, 5');
  console.assert(Math.imul(0xfffffffe, 5) === -10, 'Math.imul 0xfffffffe, 5');
};

tests.MathLog10 = function() {
  console.assert(Math.log10(2).toPrecision(10) === '0.3010299957', 'Math.log10 2');
  console.assert(Math.log10(1) === 0, 'Math.log10 1');
  console.assert(Math.log10(0) === -Infinity, 'Math.log10 0');
  console.assert(Number.isNaN(Math.log10(-2)), 'Math.log10 -2');
  console.assert(Math.log10(100000) === 5, 'Math.log10 100000');
};

tests.MathLog1p = function() {
  console.assert(Math.log1p(1).toPrecision(10) === '0.6931471806', 'Math.log1p 1');
  console.assert(Math.log1p(0) === 0, 'Math.log1p 0');
  console.assert(Math.log1p(-1) === -Infinity, 'Math.log1p -1');
  console.assert(Number.isNaN(Math.log1p(-2)), 'Math.log1p -2');
};

tests.MathLog2 = function() {
  console.assert(Math.log2(3).toPrecision(10) === '1.584962501', 'Math.log2 3');
  console.assert(Math.log2(2) === 1, 'Math.log2 2');
  console.assert(Math.log2(1) === 0, 'Math.log2 1');
  console.assert(Math.log2(0) === -Infinity, 'Math.log2 0');
  console.assert(Number.isNaN(Math.log2(-2)), 'Math.log2 -2');
  console.assert(Math.log2(1024) === 10, 'Math.log2 1024');
};

tests.MathSign = function() {
  console.assert(Math.sign(3) === 1, 'Math.sign 3');
  console.assert(Math.sign(-3) === -1, 'Math.sign -3');
  console.assert(Math.sign('-3') === -1, 'Math.sign "-3"');
  console.assert(Object.is(Math.sign(0), 0), 'Math.sign 0');
  console.assert(Object.is(Math.sign(-0), -0), 'Math.sign -0');
  console.assert(Number.isNaN(Math.sign(NaN)), 'Math.sign NaN');
  console.assert(Number.isNaN(Math.sign('foo')), 'Math.sign "foo"');
  console.assert(Number.isNaN(Math.sign()), 'Math.sign undefined');
};

tests.MathSinh = function() {
  console.assert(Math.sinh(0) === 0, 'Math.sinh 0');
  console.assert(Math.sinh(1).toPrecision(10) === '1.175201194', 'Math.sinh 1');
};

tests.MathTanh = function() {
  console.assert(Math.tanh(0) === 0, 'Math.tanh 0');
  console.assert(Math.tanh(Infinity) === 1, 'Math.tanh Infinity');
  console.assert(Math.tanh(1).toPrecision(10) === '0.7615941560', 'Math.tanh 1');
};

tests.MathTrunc = function() {
  console.assert(Math.trunc(13.37) === 13, 'Math.trunc 13.37');
  console.assert(Math.trunc(42.84) === 42, 'Math.trunc 42.84');
  console.assert(Object.is(Math.trunc(0.123), 0), 'Math.trunc 0.123');
  console.assert(Object.is(Math.trunc(-0.123), -0), 'Math.trunc -0.123');
  console.assert(Math.trunc('-1.123') === -1, 'Math.trunc "-1.123"');
  console.assert(Number.isNaN(Math.trunc(NaN)), 'Math.trunc NaN');
  console.assert(Number.isNaN(Math.trunc('foo')), 'Math.trunc "foo"');
  console.assert(Number.isNaN(Math.trunc()), 'Math.trunc undefined');
};

///////////////////////////////////////////////////////////////////////////////
// WeakMap and WeakMap.prototype

tests.WeakMap = function() {
  var w = new WeakMap;
  var p = {};
  var o = Object.create(p);
  console.assert(!w.has(p), 'WeakMapPrototypeHasNonKey');
  console.assert(!w.delete(p), 'WeakMapPrototypeDeleteNonKey');
  console.assert(w.set(o, 'o') === w, 'WeakMapPrototypeSet');
  console.assert(w.get(o) === 'o', 'WeakMapPrototypeGet');
  console.assert(w.get(p) === undefined, 'WeakMapPrototypeGetNonKey');
  console.assert(w.has(o), 'WeakMapPrototypeHas');
  console.assert(w.delete(o), 'WeakMapPrototypeDelete');
  console.assert(!w.has(o), 'WeakMapPrototypeHasNonKey');
};

tests.WeakMapPrototypeMethodsRejectInvalid = function() {
  var w = new WeakMap;
  var name = 'WeakMapPrototypeMethodsReject';
  function expectError(method, thisVal, args) {
    var label = String(thisVal === w ? args : 'ThisIs' + args);
    try {
      w[method].apply(thisVal, args);
      console.assert(false, name + label);
    } catch (e) {
      console.assert(e.name === 'TypeError', name + label + 'Error');
    }
  }
  var methods = ['delete', 'get', 'has', 'set'];
  var values = [null, undefined, true, false, 0, 42, '', 'hi'];
  for (var i = 0; i < methods.length; i++) {
    var method = methods[i];
    for (var j = 0; j < values.length; j++) {
      var value = values[j];
      expectError(method, value, [{}]);
      expectError(method, w, [value]);
    }
    expectError(method, WeakMap.prototpye, [{}]);  // Ordinary object.
  }
};
