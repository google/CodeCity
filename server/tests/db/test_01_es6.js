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
 * @fileoverview Test the ES6 functions of the server.
 * @author fraser@google.com (Neil Fraser)
 */


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

tests.NumberIsSafeInteger = function() {
  console.assert(Number.isSafeInteger(3), 'Number.isSafeInteger 3');
  console.assert(!Number.isSafeInteger(Math.pow(2, 53)), 'Number.isSafeInteger 2^53');
  console.assert(Number.isSafeInteger(Math.pow(2, 53) - 1), 'Number.isSafeInteger 2^53-1');
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
