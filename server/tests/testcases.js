/**
 * @license
 * Code City: Server JavaScript Interpreter Testscases
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
'use strict';

module.exports = [
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
    true ? 'then' : 'else';
    `,
    expected: 'then' },

  { name: 'condFalse', src: `
    false ? 'then' : 'else';
    `,
    expected: 'else' },

  { name: 'ifTrue', src: `
    if (true) {
      'then';
    } else {
      'else';
    }
    `,
    expected: 'then' },

  { name: 'ifFalse', src: `
    if (false) {
      'then';
    } else {
      'else';
    }
    `,
    expected: 'else' },

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
    'foo' + 'bar';
    `,
    expected: 'foobar' },

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

  { name: 'throwCatchFalsey', src: `
    try {
      throw null;
    } catch (e) {
      'caught ' + String(e);
    }
    `,
    expected: 'caught null' },

  // N.B.: This and next tests have no equivalent in the test DB.
  { name: 'throwUnhandledError', src: `
    throw Error('not caught');
    `,
    expected: undefined },

  { name: 'throwUnhandledException', src: `
    throw 'not caught';
    `,
    expected: undefined },

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
    expected: 59
  },

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
    expected: 60
  },

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
    expected: 61
  },

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
    expected: 62
  },

  { name: 'orTrue', src: `
    63 || 'foo';
    `,
    expected: 63 },

  { name: 'orFalse', src: `
    false || 64;
    `,
    expected: 64 },

  { name: 'orShortcircuit', src: `
    var r = 0;
    true || (r++);
    r;
    `,
    expected: 0 },

  { name: 'andTrue', src: `
    ({}) && 65;
    `,
    expected: 65 },

  { name: 'andFalse', src: `
    0 && 65;
    `,
    expected: 0 },

  { name: 'andShortcircuit', src: `
    var r = 0;
    false && (r++);
    r;
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
    var x = 1, o = {foo: 'bar'}, a = {a:2, b:2, c:17};
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

  { name: 'arrayElidedNotDefinedNotUndefined', src: `
    var a = [,undefined,null,0,false];
    !(0 in a) && (1 in a) && (2 in a) && (3 in a) && (4 in a);
    `,
    expected: true },

  { name: 'arrayLengthPropertyDescriptor', src: `
    var a = [1, 2, 3];
    var pd = Object.getOwnPropertyDescriptor(a, 'length');
    (pd.value === 3) && pd.writable && !pd.enumerable && !pd.configurable;
    `,
    expected: true },
    
  { name: 'arrayLength', src: `
    try {
      var a;
      function checkLen(exp, desc) {
        if (a.length !== exp) {
          var msg = 'a.length === ' + a.length + ' (expected: ' + exp + ')'
          throw Error(desc ? msg + ' ' + desc : msg);
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
        if (r !== exp) {
          var msg = 'a.hasOwnProperty(' + idx + ') === ' + r;
          throw Error(desc ? msg + ' ' + desc : msg);
        }
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
        if (String(key >>> 0) === key && (key >>> 0) !== 0xffffffff) {
          throw Error('Setting a.length = 0 failed to remove property ' + key);
        }
      }

      // Make sure we didn't wipe everything!
      if (Object.getOwnPropertyNames(a).length !== 4) {
        throw Error('Setting .length == 0 removed some non-index properties');
      }
      'OK';
    } catch (e) {
      String(e);
    }
    `,
    expected: 'OK' },

  { name: 'arrayLengthWithNonWritableProps', src: `
    var a = [];
    Object.defineProperty(a, 0,
        {value: 'hi', writable: false, configurable: true});
    a.length = 0;
    a[0] === undefined && a.length === 0;
    `,
    expected: true },

  { name: 'arrayLengthWithNonConfigurableProps', src: `
    var a = [];
    Object.defineProperty(a, 0,
        {value: 'hi', writable: false, configurable: false});
    a.length = 0;
    a[0] === 'hi' && a.length === 1;
    `,
    expected: true },

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
    +'72';
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
      [undefined, 'undefined'],
      [null, 'object'],
      [false, 'boolean'],
      [0, 'number'],
      ['', 'string'],
      [{}, 'object'],
      [[], 'object'],
      [function() {}, 'function'],
    ];
    var ok = 0;
    for (var i = 0; i < tests.length; i++) {
      if (typeof tests[i][0] === tests[i][1]) {
        ok++;
      }
    }
    (ok === tests.length) ? 'pass' : 'fail';
    `,
    expected: 'pass' },

  { name: 'unaryTypeofUndeclared', src: `
    try {
      typeof undeclaredVar;
    } catch(e) {
      'whoops!'
    }
    `,
    expected: 'undefined' },

  { name: 'binaryIn', src: `
    var o = {foo: 'bar'};
    'foo' in o && !('bar' in o);
    `,
    expected: true },

  { name: 'binaryInParent', src: `
    var p = {foo: 'bar'};
    var o = Object.create(p);
    'foo' in o && !('bar' in o);
    `,
    expected: true },

  { name: 'binaryInArrayLength', src: `
    'length' in [];
    `,
    expected: true },

  { name: 'binaryInStringLength', src: `
    try {
      'length' in '';
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'instanceofBasics', src: `
    function F(){}
    var f = new F;
    f instanceof F && f instanceof Object && !(f.prototype instanceof F);
    `,
    expected: true },

  { name: 'instanceofNonObjectLHS', src: `
    function F() {}
    F.prototype = null;
    42 instanceof F;
    `,
    expected: false },

  { name: 'instanceofNonFunctionRHS', src: `
    try {
      ({}) instanceof 0;
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'instanceofNonObjectPrototype', src: `
    function F() {};
    F.prototype = 'hello';
    try {
      ({}) instanceof F;
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'deleteProp', src: `
    var o = {foo: 'bar'};
    (delete o.quux) + ('foo' in o) + (delete o.foo) +
        !('foo' in o) + (delete o.foo);
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
    expected: 'SyntaxError' },

  { name: 'deleteUndeclaredIdentifier', src: `
    try {
      delete foo;
    } catch (e) {
      e.name;
    }
    `,
    expected: 'SyntaxError' },

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
    expected: 'undefined' },

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

  { name: 'internalObjectToString', src: `
    var o = {};
    o[{}] = null;
    for(var key in o) {
      key;
    }
    `,
    expected: '[object Object]' },

  { name: 'internalFunctionToString', src: `
    var o = {}, s, f = function(){};
    o[f] = null;
    for(var key in o) {
      s = key;
    }
    /^function.*\(.*\).*{[^]*}$/.test(s);
    `,
    expected: true },

  { name: 'internalNativeFuncToString', src: `
    var o = {}, s, f = Object.create;
    o[f] = null;
    for(var key in o) {
      s = key;
    }
    /^function.*\(.*\).*{[^]*}$/.test(s);
    `,
    expected: true },

  { name: 'internalArrayToString', src: `
    var o = {};
    o[[1, 2, 3]] = null;
    for(var key in o) {
      key;
    }
    `,
    expected: '1,2,3' },

  { name: 'internalDateToString', src: `
    var o = {};
    o[new Date(0)] = null;
    for(var key in o) {
      key;
    }
    `,
    expected: (new Date(0)).toString() },

  { name: 'internalRegExpToString', src: `
    var o = {};
    o[/foo/g] = null;
    for(var key in o) {
      key;
    }
    `,
    expected: '/foo/g' },

  { name: 'internalErrorToString', src: `
    var o = {};
    o[Error('oops')] = null;
    for(var key in o) {
      key;
    }
    `,
    expected: 'Error: oops' },

  { name: 'internalArgumentsToString', src: `
    var o = {};
    (function() {
      o[arguments] = null;
    })();
    for(var key in o) {
      key;
    }
    `,
    expected: '[object Arguments]'
  },

  { name: 'debugger', src: `
    debugger;
    `,
    expected: undefined },

  { name: 'newExpression', src: `
    function T(x, y) { this.sum += x + y; };
    T.prototype = { sum: 70 }
    var t = new T(7, 0.7);
    t.sum;
    `,
    expected: 77.7 },

  { name: 'regexpSimple', src: `
    /foo/.test('foobar');
    `,
    expected: true },

  { name: 'evalSeeEnclosing', src: `
    var n = 77.77;
    eval('n');
    `,
    expected: 77.77 },

  { name: 'evalModifyEnclosing', src: `
    var n = 77.77;
    eval('n = 77.88');
    n;
    `,
    expected: 77.88 },

  { name: 'evalNoLeakingDecls', src: `
    eval('var n = 88.88');
    typeof n;
    `,
    expected: 'undefined' },

  /******************************************************************/
  // Object and Object.prototype

  { name: 'ObjectDefinePropertyNoArgs', src: `
    try {
      Object.defineProperty();
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectDefinePropertyNonObject', src: `
    try {
      Object.defineProperty('not an object', 'foo', {});
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectDefinePropertyBadDescriptor', src: `
    var o = {};
    try {
      Object.defineProperty(o, 'foo', 'not an object');
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  // This also tests iteration over (non-)enumerable properties.
  { name: 'ObjectDefineProperty', src: `
    var o = { foo: 70 }, r = 0;
    Object.defineProperty(o, 'bar', {
      writeable: true,
      enumerable: true,
      configurable: true,
      value: 8,
    });
    Object.defineProperty(o, 'baz', {
      value: 13,
    });
    for (var k in o) {
      r += o[k];
    }
    r;
    `,
    expected: 78 },

  { name: 'ObjectGetPrototypeOfNullUndefined', src: `
    var r = '', prims = [null, undefined];
    for (var i = 0; i < prims.length; i++) {
      try {
        Object.getPrototypeOf(prims[i]);
      } catch (e) {
        r += e.name;
      }
    }
    r;
    `,
    expected: 'TypeErrorTypeError' },

  // This tests for ES6 behaviour:
  { name: 'ObjectGetPrototypeOfPrimitives', src: `
    Object.getPrototypeOf(true) === Boolean.prototype &&
    Object.getPrototypeOf(1337) === Number.prototype &&
    Object.getPrototypeOf('hi') === String.prototype;
    `,
    expected: true },

  { name: 'ObjectCreateNoArgs', src: `
    try {
      Object.create();
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectCreateNonObject', src: `
    try {
      Object.create(42);
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectCreateNull', src: `
    var o = Object.create(null);
    Object.getPrototypeOf(o);
    `,
    expected: null },

  { name: 'ObjectCreate', src: `
    var o = Object.create({foo: 79});
    delete o.foo
    o.foo;
    `,
    expected: 79 },

  { name: 'ObjectGetOwnPropertyDescriptorNoArgs', src: `
    try {
      Object.getOwnPropertyDescriptor();
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectGetOwnPropertyDescriptorNonObject', src: `
    try {
      Object.getOwnPropertyDescriptor('not an object', 'foo');
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectGetOwnPropertyDescriptorBadKey', src: `
    var o = {};
    Object.getOwnPropertyDescriptor(o, 'foo');
    `,
    expected: undefined },

  { name: 'ObjectGetOwnPropertyDescriptor', src: `
    var o = {}, r = 0;
    Object.defineProperty(o, 'foo', { value: 'bar' });
    var desc = Object.getOwnPropertyDescriptor(o, 'foo');
    desc.value === o.foo &&
        !desc.writeable && !desc.enumerable && !desc.configurable;
    `,
    expected: true },

  { name: 'ObjectGetOwnPropertyNamesNoArgs', src: `
    try {
      Object.getOwnPropertyNames();
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectGetOwnPropertyNamesString', src: `
    var i, r = 0, names = Object.getOwnPropertyNames('foo');
    for (i = 0; i < names.length; i++) {
      if (names[i] === 'length') {
        r += 10;
      } else {
        r += Number(names[i]) + 1;
      }
    }
    `,
    expected: 16 },

  { name: 'ObjectGetOwnPropertyNamesNumber', src: `
    Object.getOwnPropertyNames(42).length
    `,
    expected: 0 },

  { name: 'ObjectGetOwnPropertyNamesBoolean', src: `
    Object.getOwnPropertyNames(true).length
    `,
    expected: 0 },

  { name: 'ObjectGetOwnPropertyNamesNull', src: `
    try {
      Object.getOwnPropertyNames(null).length;
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectGetOwnPropertyNamesUndefined', src: `
    try {
      Object.getOwnPropertyNames(undefined).length;
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectGetOwnPropertyNames', src: `
    var o = { foo: 42 }, r = 0;
    Object.defineProperty(o, 'bar', { value: 38 });
    var keys = Object.getOwnPropertyNames(o);
    var r = 0;
    for (var i = 0; i < keys.length; i++) {
      r += o[keys[i]];
    }
    r;
    `,
    expected: 80 },

  { name: 'ObjectDefinePropertiesNoArgs', src: `
    try {
      Object.defineProperties();
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectDefinePropertiesNonObject', src: `
    try {
      Object.defineProperties('not an object', {});
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectDefinePropertiesNonObjectProps', src: `
    try {
      Object.defineProperties({}, undefined);
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectDefinePropertiesBadDescriptor', src: `
    var o = {};
    try {
      Object.defineProperties(o, { foo: 'not an object' });
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'ObjectDefineProperties', src: `
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

  { name: 'ObjectCreateWithProperties', src: `
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

  { name: 'ObjectPrototypeToString', src: `
    ({}).toString();
    `,
    expected: '[object Object]' },

  /******************************************************************/
  // Function and Function.prototype

  { name: 'FunctionPrototypeHasNoPrototype', src: `
    Function.prototype.hasOwnProperty('prototype');
    `,
    expected: false },

  { name: 'FunctionPrototypeToStringApplyNonFunctionThrows', src: `
    try {
      Function.prototype.toString.apply({});
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'FunctionPrototypeApplyArgsUndefinedOrNull', src: `
    var n = 0;
    function f() { n += arguments.length; }
    f.apply(undefined, undefined);
    f.apply(undefined, null);
    n;
    `,
    expected: 0 },

  { name: 'FunctionPrototypeApplyArgsNonObject', src: `
    try {
      (function() {}).apply(undefined, 'not an object');
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  { name: 'FunctionPrototypeApplyArgsSparse', src: `
    (function(a, b, c) {
      if (!(1 in arguments)) {
        throw Error("Argument 1 missing");
      }
      return a + c;
    }).apply(undefined, [1, , 3]);
    `,
    expected: 4 },

  { name: 'FunctionPrototypeApplyArgsArraylike', src: `
    (function(a, b, c) {
      return a + b + c;
    }).apply(undefined, {0: 1, 1: 2, 2: 3, length: 3});
    `,
    expected: 6 },

  { name: 'FunctionPrototypeApplyArgsNonArraylike', src: `
    (function(a, b, c) {
      return a + b + c;
    }).apply(undefined, {0: 1, 1: 2, 2: 4});
    `,
    expected: NaN },  // Because undefined + undefined === NaN.

  /******************************************************************/
  // Array and Array.prototype

  { name: 'ArrayIsArrayArrayPrototype', src: `
    Array.isArray(Array.prototype);
    `,
    expected: true },

  { name: 'ArrayIsArrayArrayInstance', src: `
    Array.isArray(new Array);
    `,
    expected: true },

  { name: 'ArrayIsArrayArrayLiteral', src: `
    Array.isArray([]);
    `,
    expected: true },

  { name: 'ArrayPrototypeToStringCycleDetection', src: `
    var a = [1, , 3];
    a[1] = a;
    a.toString();
    "Didn't crash!";
    `,
    expected: "Didn't crash!" },

  { name: 'ArrayPrototypeJoin', src: `
    [1, 2, 3].join('-');
    `,
    expected: '1-2-3' },

  { name: 'ArrayPrototypeJoinCycleDetection', src: `
    var a = [1, , 3];
    a[1] = a;
    a.join('-');
    "Didn't crash!";
    `,
    expected: "Didn't crash!" },

  /******************************************************************/
  // Boolean
  { name: 'Boolean', src: `
    var tests = [
      [undefined, false],
      [null, false],
      [false, false],
      [true, true],
      [NaN, false],
      [0, false],
      [1, true],
      ['', false],
      ['foo', true],
      [{}, true],
      [[], true],
      [function() {}, true],
    ];
    var ok = 0;
    for (var i = 0; i < tests.length; i++) {
      if (Boolean(tests[i][0]) === tests[i][1]) {
        ok++;
      }
    }
    (ok === tests.length) ? 'pass' : 'fail';
    `,
    expected: 'pass' },

  /******************************************************************/
  // Number

  { name: 'Number', src: `
    var tests = [
      [undefined, NaN],
      [null, 0],
      [true, 1],
      [false, 0],
      ['42', 42],
      ['', 0],
      [{}, NaN],
      [[], 0],
      [[42], 42],
      [[1,2,3], NaN],
      [function () {}, NaN],
    ];
    var ok = 0;
    for (var i = 0; i < tests.length; i++) {
      if (Object.is(Number(tests[i][0]), tests[i][1])) {
        ok++;
      }
    }
    (ok === tests.length) ? 'pass' : 'fail';
    `,
    expected: 'pass' },

  /******************************************************************/
  // String

  { name: 'String', src: `
    var tests = [
      [undefined, 'undefined'],
      [null, 'null'],
      [true, 'true'],
      [false, 'false'],
      [0, '0'],
      [-0, '0'],
      [Infinity, 'Infinity'],
      [-Infinity, '-Infinity'],
      [NaN, 'NaN'],
      [{}, '[object Object]'],
      [[1, 2, 3,,5], '1,2,3,,5'],
    ];
    var ok = 0;
    for (var i = 0; i < tests.length; i++) {
      if (String(tests[i][0]) === tests[i][1]) {
        ok++;
      }
    }
    (ok === tests.length) ? 'pass' : 'fail';
    `,
    expected: 'pass' },

  { name: 'String.prototype.replace(string, string)',
    src: `'xxxx'.replace('xx', 'y');`,
    expected: 'yxx' },

  { name: 'String.prototype.replace(regexp, string)',
    src: `'xxxx'.replace(/(X)\\1/ig, 'y');`,
    expected: 'yy' },

  { name: 'String.prototype.replace(string, function)', src: `
    'xxxx'.replace('xx', function () {
         return '[' + Array.prototype.join.apply(arguments) + ']';
    });
    `,
    expected: '[xx,0,xxxx]xx' },

  { name: 'String.prototype.replace(regexp, function)', src: `
    'xxxx'.replace(/(X)\\1/ig, function () {
         return '[' + Array.prototype.join.apply(arguments) + ']';
    });
    `,
    expected: '[xx,x,0,xxxx][xx,x,2,xxxx]' },


  /******************************************************************/
  // RegExp

  { name: 'RegExpPrototypeTestApplyNonRegExpThrows', src: `
    try {
      /foo/.test.apply({}, ['foo']);
    } catch (e) {
      e.name;
    }
    `,
    expected: 'TypeError' },

  /******************************************************************/
  // Other tests (all are skipped):

  { name: 'newHack', src: `
    (new 'Array.prototype.push') === Array.prototype.push
    `,
    expected: true
  },

  // FIXME: use instanceof or the like to check that error is returned.
  { name: 'newHackUnknown', src: `
    try {
      new 'nonexistent-builtin-name';
    } catch (e) {
      e.name;
    }
    `,
    expected: 'ReferenceError'
  },

];
