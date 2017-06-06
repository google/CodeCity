/**
 * @license
 * Code City interpreter JS testscases
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
 * @fileoverview Test cases for JavaScript interpreter.
 * @author cpcallen@google.com (Christopher Allen)
 */

// This file is input for (and required by) gentests.js.
exports.tests = [
  // Testcases for TestInterpreterSimple (have expected value):
  { name: 'onePlusOne', src: `
    1 + 1;
    `,
    expected: 2 },

  { name: 'twoPlusTwo', src: `
    2 + 2;
    `,
    expected: 4 },

  { name: 'sixTimesSeven', src: `
    6 * 7;
    `,
    expected: 42 },

  { name: 'simpleFourFunction', src: `
    (3 + 12 / 4) * (10 - 3);
    `,
    expected: 42 },

  { name: 'variableDecl', src: `
    var x = 43;
    x;
    `,
    expected: 43 },

  { name: 'condTrue', src: `
    true ? "then" : "else";
    `,
    expected: "then" },

  { name: 'condFalse', src: `
    false ? "then" : "else";
    `,
    expected: "else" },

  { name: 'ifTrue', src: `
    if (true) {
      "then";
    } else {
      "else";
    }
    `,
    expected: "then" },

  { name: 'ifFalse', src: `
    if (false) {
      "then";
    } else {
      "else";
    }
    `,
    expected: "else" },

  { name: 'simpleAssignment', src: `
    var x = 0;
    x = 44;
    x;
    `,
    expected: 44 },

  { name: 'propertyAssignment', src: `
    var o = {};
    o.foo = 45;
    o.foo;
    `,
    expected: 45 },

  { name: 'postincrement', src: `
    var x = 45;
    x++;
    x++;
    `,
    expected: 46 },

  { name: 'preincrement', src: `
    var x = 45;
    ++x;
    ++x;
    `,
    expected: 47 },

  { name: 'concat', src: `
    "foo" + "bar";
    `,
    expected: "foobar" },

  { name: 'plusequalsLeft', src: `
    var x = 40, y = 8;
    x += y;
    x;
    `,
  expected: 48 },

  { name: 'plusequalsRight', src: `
    var x = 40, y = 8;
    x += y;
    y;
    `,
    expected: 8 },

  { name: 'simpleFunctionExpression', src: `
    var v;
    var f = function() { v = 49; };
    f();
    v;
    `,
    expected: 49 },

  { name: 'fExpWithParameter', src: `
    var v;
    var f = function(x) { v = x; };
    f(50);
    v;
    `,
    expected: 50 },

  { name: 'functionWithReturn', src: `
    (function(x) { return x; })(51);
    `,
    expected: 51 },

  { name: 'functionWithoutReturn', src: `
    (function() {})();
    `,
    expected: undefined },

  { name: 'multipleReturn', src: `
    var f = function() {
      try {
        return true;
      } finally {
        return false;
      }
    }
    f();
    `,
    expected: false },

  { name: 'throwCatch', src: `
    var f = function() {
      throw 26;
    }
    try {
      f();
    } catch (e) {
      e * 2;
    }
    `,
    expected: 52 },

  { name: 'seqExpr', src: `
    51, 52, 53;
    `,
    expected: 53 },

  { name: 'labeledStatement', src: `
    foo: 54;
    `,
    expected: 54 },

  { name: 'whileLoop', src: `
    var a = 0;
    while (a < 55) {
      a++;
    }
    a;
    `,
    expected: 55 },

  { name: 'whileFalse', src: `
    var a = 56;
    while (false) {
      a++;
    }
    a;
    `,
    expected: 56 },

  { name: 'doWhileFalse', src: `
    var a = 56;
    do {
      a++;
    } while (false);
    a;
    `,
    expected: 57 },

  { name: 'breakDoWhile', src: `
    var a = 57;
    do {
      a++;
      break;
      a++;
    } while (false);
    a;
    `,
    expected: 58 },

  { name: 'selfBreak', src: `
    foo: break foo;
    `,
    expected: undefined /* (but legal!) */ },

  { name: 'breakWithFinally', src: `
    var a = 6;
    foo: {
      try {
        a *= 10;
        break foo;
      } finally {
        a--;
      }
    }
    a;
    `,
    expected: 59 },

  { name: 'continueWithFinally', src: `
    var a = 59;
    do {
      try {
        continue;
      } finally {
        a++;
      }
    } while (false);
    a;
    `,
    expected: 60 },

  { name: 'breakWithFinallyContinue', src: `
    var a = 0;
    while (a++ < 60) {
      try {
        break;
      } finally {
        continue;
      }
    }
    a;
    `,
    expected: 61 },

  { name: 'returnWithFinallyContinue', src: `
    (function() {
      var i = 0;
      while (i++ < 61) {
        try {
          return 42;
        } finally {
          continue;
        }
      }
      return i;
    })();
    `,
    expected: 62 },

  { name: 'orTrue', src: `
    63 || "foo";
    `,
    expected: 63 },

  { name: 'orFalse', src: `
    false || 64;
    `,
    expected: 64 },

  { name: 'andTrue', src: `
    ({}) && 65;
    `,
    expected: 65 },

  { name: 'andFalse', src: `
    0 && 65;
    `,
    expected: 0 },

  { name: 'forTriangular', src: `
    var t = 0;
    for (var i = 0; i < 12; i++) {
      t += i;
    }
    t;
    `,
    expected: 66 },

  { name: 'forIn', src: `
    var x = 0, a = {a: 60, b:3, c:4};
    for (var i in a) { x += a[i]; }
    x;
    `,
    expected: 67 },

  { name: 'forInMemberExp', src: `
    var x = 1, o = {foo: "bar"}, a = {a:2, b:2, c:17};
    for (o.foo in a) { x *= a[o.foo]; }
    x;
    `,
    expected: 68 },

  { name: 'forInMembFunc', src: `
    var x = 0, o = {};
    var f = function() { x += 20; return o; };
    var a = {a:2, b:3, c:4};
    for (f().foo in a) { x += a[o.foo]; }
    x;
    `,
    expected: 69 },

  { name: 'methodCall', src: `
    var o = {
      f: function() { return this.foo; },
      foo: 70
    };
    o.f();
    `,
    expected: 70 },

  { name: 'demethodedCall', src: `
    var o = { f: function() { return this; }};
    var g = o.f;
    g();
    `,
    expected: undefined },

  { name: 'bareThis', src: `
    this;
    `,
    expected: undefined },

  { name: 'emptyArrayLength', src: `
    [].length;
    `,
    expected: 0 },

  { name: 'arrayElidedLength', src: `
    [1,,3,,].length;
    `,
    expected: 4 },

  { name: 'compValEmptyBlock', src: `
    {};
    `,
    expected: undefined },

  { name: 'undefined', src: `
    undefined;
    `,
    expected: undefined },

  { name: 'unaryVoid', src: `
    var x = 70;
    (undefined === void x++) && x;
    `,
    expected: 71 },

  { name: 'unaryPlus', src: `
    +"72";
    `,
    expected: 72 },

  { name: 'unaryMinus', src: `
    -73;
    `,
    expected: -73 },

  { name: 'unaryComplement', src: `
    ~0xffffffb5;
    `,
    expected: 74 },

  { name: 'unaryNot', src: `
    !false && (!true === false);
    `,
    expected: true },

  { name: 'unaryTypeof', src: `
    var tests = [
      [undefined, "undefined"],
      [null, "object"],
      [false, "boolean"],
      [0, "number"],
      ["", "string"],
      [{}, "object"],
      [[], "object"],
      [function() {}, "function"],
    ];
    var ok = 0;
    for (var i = 0; i < tests.length; i++) {
      if (typeof tests[i][1] != tests[i][2]) {
        ok++;
      }
    }
    ok === tests.length ? "pass" : "fail";
    `,
    expected: "pass" },

  { name: 'unaryTypeofUndeclared', src: `
    try {
      typeof undeclaredVar;
    } catch(e) {
      "whoops!"
    }
    `,
    expected: "undefined" },

  { name: 'binaryIn', src: `
    var o = {foo: "bar"};
    "foo" in o && !("bar" in o);
    `,
    expected: true },

  { name: 'strictBoxedThis', src: `
    "use strict";
    Object.prototype.foo = function() { return typeof this; };
    "foo".foo();
    `,
    expected: "string" },

  { name: 'deleteProp', src: `
    var o = {foo: "bar"};
    (delete o.quux) + ("foo" in o) + (delete o.foo) + 
        !("foo" in o) + (delete o.foo);
    `,
    expected: 5 },

  { name: 'deleteUnqualifiedIdentifier', src: `
    var foo;
    try { 
      delete foo;
    } catch (e) {
      e.name;
    }
    `,
    expected: "SyntaxError" },

  { name: 'deleteUndeclaredIdentifier', src: `
    try { 
      delete foo;
    } catch (e) {
      e.name;
    }
    `,
    expected: "SyntaxError" },

  { name: 'funcDecl', src: `
    var v;
    function f() {
      v = 75;
    }
    f();
    v;
    `,
    expected: 75 },

  { name: 'namedFunctionExpression', src: `
    var f = function foo(x) {
      if (x < 100) {
        return x;
      }
      return foo(x / 2);
    };
    f(152)
    `,
    expected: 76 },

  { name: 'namedFunExpNoLeak', src: `
    var f = function foo() {};
    typeof foo;
    `,
    expected: "undefined" },

  { name: 'namedFunExpSameSame', src: `
    var f = function foo() {
      return f === foo;
    };
    f();
    `,
    expected: true },

  { name: 'closureIndependence', src: `
    function makeAdder(x) {
      return function(y) { return x + y; };
    }
    var plus3 = makeAdder(3);
    var plus4 = makeAdder(4);
    plus3(plus4(70));
    `,
    expected: 77 },

  { name: 'ObjectToString', src: `
    ({}).toString();
    `,
    expected: "[object Object]" },

  { name: 'unimplementedASTNode', src: `
    try {
      debugger;
    } catch (e) {
      e.name;
    }
    `,
    expected: "SyntaxError" },
    
  { name: 'newHackNotAvailable', src: `
    try { 
      new "foo";
    } catch (e) {
      e.name;
    }
    `,
    expected: "SyntaxError" },

  { name: 'objectDefinePropertyNoArgs', src: `
    try {
      Object.defineProperty();
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectDefinePropertyNonObject', src: `
    try {
      Object.defineProperty("not an object", "foo", {});
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectDefinePropertyBadDescriptor', src: `
    var o = {};
    try {
      Object.defineProperty(o, "foo", "not an object");
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectDefineProperty', src: `
    var o = { foo: 70 }, r = 0;
    Object.defineProperty(o, "bar", {
      writeable: true,
      enumerable: true,
      configurable: true,
      value: 8,
    });
    Object.defineProperty(o, "baz", {
      value: 13,
    });
    for (var k in o) {
      r += o[k];
    }
    r;
    `,
    expected: 78 },

  { name: 'objectGetPrototypeOf', src: `
    var o = {};
    Object.getPrototypeOf(o) == Object.prototype && 
        Object.getPrototypeOf(Object.prototype) == null;
    `,
    expected: true },

  { name: 'objectCreateNoArgs', src: `
    try {
      Object.create();
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectCreateNonObject', src: `
    try {
      Object.create(42);
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectCreateNull', src: `
    var o = Object.create(null);
    Object.getPrototypeOf(o);
    `,
    expected: null },

  { name: 'objectCreate', src: `
    var o = Object.create({foo: 79});
    delete o.foo
    o.foo;
    `,
    expected: 79 },

  { name: 'objectGetOwnPropertyDescriptorNoArgs', src: `
    try {
      Object.getOwnPropertyDescriptor();
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectGetOwnPropertyDescriptorNonObject', src: `
    try {
      Object.getOwnPropertyDescriptor("not an object", "foo");
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectGetOwnPropertyDescriptorBadKey', src: `
    var o = {};
    Object.getOwnPropertyDescriptor(o, "foo");
    `,
    expected: undefined },

  { name: 'objectGetOwnPropertyDescriptor', src: `
    var o = {}, r = 0;
    Object.defineProperty(o, "foo", { value: "bar" });
    var desc = Object.getOwnPropertyDescriptor(o, "foo");
    desc.value == o.foo && 
        !desc.writeable && !desc.enumerable && !desc.configurable;
    `,
    expected: true },

  { name: 'objectGetOwnPropertyNamesNoArgs', src: `
    try {
      Object.getOwnPropertyNames();
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectGetOwnPropertyNamesNonObject', src: `
    try {
      Object.getOwnPropertyNames("not an object");
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectGetOwnPropertyNames', src: `
    var o = { foo: 42 }, r = 0;
    Object.defineProperty(o, "bar", { value: 38 });
    var keys = Object.getOwnPropertyNames(o);
    var r = 0;
    for (var i = 0; i < keys.length; i++) {
      r += o[keys[i]];
    }
    r;
    `,
    expected: 80 },

  { name: 'objectDefinePropertiesNoArgs', src: `
    try {
      Object.defineProperties();
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectDefinePropertiesNonObject', src: `
    try {
      Object.defineProperties("not an object", {});
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectDefinePropertiesNonObjectProps', src: `
    Object.getOwnPropertyNames(
        Object.defineProperties({}, "not an object")
    ).length;
    `,
    expected: 0 },

  { name: 'objectDefinePropertiesBadDescriptor', src: `
    var o = {};
    try {
      Object.defineProperties(o, { foo: "not an object" });
    } catch (e) {
      e.name;
    }
    `,
    expected: "TypeError" },

  { name: 'objectDefineProperties', src: `
    var o = { foo: 70 }, r = 0;
    Object.defineProperties(o, {
        bar: {
            writeable: true,
            enumerable: true,
            configurable: true,
            value: 8 },
        baz: { value: 999 }});
    for (var k in o) {
      r += o[k];
    }
    r + Object.getOwnPropertyNames(o).length;
    `,
    expected: 81 },

  { name: 'objectCreateWithProperties', src: `
    var o = Object.create({ foo: 70 }, {
        bar: {
            writeable: true,
            enumerable: true,
            configurable: true,
            value: 10 },
        baz: { value: 999 }});
    var r = 0;
    for (var k in o) {
      r += o[k];
    }
    r + Object.getOwnPropertyNames(o).length;
    `,
    expected: 82 },
  /******************************************************************/
  // Other tests (without expected value):

  // FIXME: remove this
  { name: 'emptyProg', src: '',
  },
  
  { name: 'objectExpression', src: `
    ({foo: "bar", answer: 42})
    `,
    // expected: {foo: "bar", answer: 42}
  },

  { name: 'switchStatement', src: `
    var n;
    var x = 0;
    switch(n) {
    case 1:
      x += 1
      // fall through
    case 2:
      x += 2
      // fall through
    default:
      x += 16
      // fall through
    case 3:
      x += 4
      // fall through
    case 4:
      x += 8
      // fall through
    }
    x;
    `,
  },

  { name: 'switchStatementWithBreaks', src: `
    var n;
    foo: {
      switch(n) {
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
    }
    `,
  },

  { name: 'newHack', src: `
    typeof new "Array.prototype.push"
    `,
    // expected: "function"
  },

  // FIXME: use instanceof or the like to check that error is returned.
  { name: 'newHackUnknown', src: `
    try {
      new "nonexistent-builtin-name";
    } catch (e) {
      e.name;
    }
    `,
    // expected: "ReferenceError"
  },

  { name: 'iterNonEnumerable', src: `
    var o;
    var n = 0;
    for (var k in o) {
      n++;
    }
    n;
    `,
  },

  { name: 'fibonacci10k', src: `
    var fibonacci = function(n, output) {
      var a = 1, b = 1, sum;
      for (var i = 0; i < n; i++) {
        output.push(a);
        sum = a + b;
        a = b;
        b = sum;
      }
    }
    for(var i = 0; i < 10000; i++) {
      var result = [];
      fibonacci(78, result);
    }
    result;
    `,
  },
];
