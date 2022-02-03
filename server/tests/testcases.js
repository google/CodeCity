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
 * @fileoverview Test cases for JavaScript interpreter.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

// Testcases for testSimple in interpreter_test.js.
module.exports = [
  {src: `1 + 1;`, expected: 2},
  {src: `2 + 2;`, expected: 4},
  {src: `6 * 7;`, expected: 42},
  {src: `(3 + 12 / 4) * (10 - 3);`, expected: 42},
  {src: `var x = 43; x;`, expected: 43},
  {src: `true ? 'then' : 'else';`, expected: 'then'},
  {src: `false ? 'then' : 'else';`, expected: 'else'},
  {
    name: 'if(true)',
    src: `
      if (true) {
        'then';
      } else {
        'else';
      }
    `,
    expected: 'then',
  },
  {
    name: 'if(false)',
    src: `
      if (false) {
        'then';
      } else {
        'else';
      }
    `,
    expected: 'else',
  },
  {
    name: 'simpleAssignment',
    src: `var x = 0; x = 44; x;`,
    expected: 44,
  },
  {
    name: 'propertyAssignment',
    src: `var o = {}; o.foo = 45; o.foo;`,
    expected: 45,
  },
  {
    name: 'getPropertyOnPrimitive',
    src: `'foo'.length;`,
    expected: 3,
  },
  {
    name: 'setPropertyOnPrimitive',
    src: `
      try {
        'foo'.bar = 42;
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {src: `var x = 45; x++; x++;`, expected: 46},
  {src: `var x = 45; ++x; ++x;`, expected: 47},
  {src: `'foo' + 'bar';`, expected: 'foobar'},
  {
    name: 'Effect of += on left argument',
    src: `var x = 40, y = 8; x += y; x;`,
    expected: 48,
  },
  {
    name: 'Effect of += on right argument',
    src: `var x = 40, y = 8; x += y; y;`,
    expected: 8,
  },
  {
    name: 'FunctionExpression',
    src: `var v, f = function() {v = 49;}; f(); v;`,
    expected: 49,
  },
  {
    name: 'variable assignment sets anonymous function name',
    src: `
      var myAssignedFunc;
      myAssignedFunc = function() {};
      myAssignedFunc.name;
    `,
    expected: 'myAssignedFunc',
  },
  {
    name: 'property assignment does not set anonymous FunctionExpression name',
    src: `
      var obj = {};
      obj.myMethod = function() {};
      obj.myMethod.name;
    `,
    expected: '',
  },
  {
    // This one is a CodeCity extension.
    name: 'property assignment optionally sets anonymous function name',
    src: `
      var obj = {};
      obj.myMethod = function() {};
      obj.myMethod.name;
    `,
    options: {methodNames: true},
    expected: 'myMethod',
  },
  {
    name: 'object expression sets anonymous FunctionExpression name',
    src: `({myPropFunc: function() {}}).myPropFunc.name;`,
    expected: 'myPropFunc',
  },
  {
    name: 'variable declaration sets anonymous FunctionExpression name',
    src: `var myVarDeclFunc = function() {}; myVarDeclFunc.name;`,
    expected: 'myVarDeclFunc',
  },
  {
    name: 'funExpWithParameter',
    src: `var v; var f = function(x) {v = x;}; f(50); v;`,
    expected: 50,
  },
  {
    name: 'funExpParameterNotShadowedByVar',
    src: `var f = function(x) {var x; return x;}; f(50.1);`,
    expected: 50.1,
  },
  {
    name: 'funExpParameterNotShadowedByVar',
    src: `var f = function(x) {var x = 50.2; return x;}; f(50.2);`,
    expected: 50.2,
  },
  {
    name: 'functionWithReturn',
    src: `(function(x) {return x;})(51);`,
    expected: 51,
  },
  {
    name: 'functionWithoutReturn',
    src: `(function() {})();`,
    expected: undefined,
  },
  {
    name: 'multipleReturn',
    src: `
      var f = function() {
        try {
          return true;
        } finally {
          return false;
        }
      }
      f();
    `,
    expected: false,
  },
  {
    name: 'throwCatch',
    src: `
      var f = function() {
        throw 26;
      }
      try {
        f();
      } catch (e) {
        e * 2;
      }
    `,
    expected: 52,
  },
  {
    name: 'throwCatchFalsey',
    src: `
      try {
        throw null;
      } catch (e) {
        'caught ' + String(e);
      }
    `,
    expected: 'caught null',
  },
  // N.B.: This and next tests have no equivalent in the test DB.
  {
    name: 'throwUnhandledError',
    src: `throw new Error('not caught');`,
    options: {noLog: ['unhandled']},
    expected: undefined,
  },
  {
    name: 'throwUnhandledException',
    src: `throw 'not caught';`,
    options: {noLog: ['unhandled']},
    expected: undefined,
  },
  {
    src: `try {throw new Error('not caught');} finally {}`,
    options: {noLog: ['unhandled']},
    expected: undefined,
  },
  {
    src: `try {throw 'not caught';} finally {}`,
    options: {noLog: ['unhandled']},
    expected: undefined,
  },
  {src: `51, 52, 53;`, expected: 53},
  {
    name: 'sequenceExpression',
    src: `
      var x, y, z;
      x = (y = 60, z = 5, 0.5);
      x + y + z;
    `,
    expected: 65.5,
  },
  {
    name: 'labeledStatement',
    src: `foo: 54;`,
    expected: 54,
  },
  {
    name: 'whileLoop',
    src: `
      var a = 0;
      while (a < 55) a++;
      a;
    `,
    expected: 55,
  },
  {
    name: 'while(false)',
    src: `
      var a = 56;
      while (false) a++;
      a;
    `,
    expected: 56,
  },
  {
    name: 'do ... while(false)',
    src: `
      var a = 56;
      do a++; while (false);
      a;
    `,
    expected: 57,
  },
  {
    name: 'do ... break ... while',
    src: `
      var a = 57;
      do {
        a++;
        break;
        a++;
      } while (false);
      a;
    `,
    expected: 58,
  },
  {
    src: `foo: break foo;`,
    expected: undefined,  // (but legal!)
  },
  {
    name: 'try ... break ... finally',
    src: `
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
    expected: 59,
  },
  {
    name: 'do ... while with try ... continue ... finally ...',
    src: `
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
    expected: 60,
  },
  {
    name: 'while with try ... break ... finally continue',
    src: `
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
    expected: 61,
  },
  {
    name: 'while with try ... return ... finally continue',
    src: `
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
    expected: 62,
  },
  {src: `63 || 'foo';`, expected: 63},
  {src: `false || 64;`, expected: 64},
  {
    name: '|| short-circuit',
    src: `var r = 0; true || (r++); r;`,
    expected: 0,
  },
  {src: `({}) && 65;`, expected: 65},
  {src: `0 && 65;`, expected: 0},
  {
    name: '&&  sort-circuit',
    src: `var r = 0; false && (r++); r;`,
    expected: 0,
  },
  {
    name: 'for',
    src: `
      var t = 0;
      for (var i = 0; i < 12; i++) {
        t += i;
      }
      t;
    `,
    expected: 66,
  },
  {
    name: 'forIn',
    src: `
      var x = 0, a = {a: 60, b:3, c:4};
      for (var i in a) {x += a[i];}
      x;
    `,
    expected: 67,
  },
  {
    name: 'forInMemberExp',
    src: `
      var x = 1, o = {foo: 'bar'}, a = {a:2, b:2, c:17};
      for (o.foo in a) {x *= a[o.foo];}
      x;
    `,
    expected: 68,
  },
  {
    name: 'forInMembFunc',
    src: `
      var x = 0, o = {};
      var f = function() {x += 20; return o;};
      var a = {a:2, b:3, c:4};
      for (f().foo in a) {x += a[o.foo];}
      x;
    `,
    expected: 69,
  },
  {
    name: 'forInNullUndefined',
    src: `
      var x = 0, o = {};
      var f = function() {x++; return o;};
      for (f().foo in null) {x++;}
      for (f().foo in undefined) {x++;}
      x;
    `,
    expected: 0,
  },
  {
    name: 'switchDefaultFirst',
    src: `
      switch ('not found') {
        default:
          'OK';
          break;
        case 'decoy':
          'fail';
      };
    `,
    expected: 'OK',
  },
  {
    name: 'switchDefaultOnly',
    src: `
      switch ('not found') {
        default:
          'OK';
      };
    `,
    expected: 'OK',
  },
  {
    name: 'switchEmptyToEnd',
    src: `
      'ok';
      switch ('foo') {
        default:
          'fail';
        case 'foo':
        case 'bar':
      };
    `,
    expected: 'ok',
  },
  {
    name: 'value of this in function call',
    src: `
      var f = function() {return this;};
      f();
    `,
    expected: undefined,
  },
  {
    name: 'value of this in method call',
    src: `
      var obj = {method: function() {return this;}};
      obj.method() === obj;
    `,
    expected: true,
  },
  {
    name: 'value of this in method called as function',
    src: `
      var obj = {method: function() {return this;}};
      var f = obj.method;
      f();
    `,
    expected: undefined,
  },
  {
    name: 'value of this outside function body',
    src: `this === undefined;`,
    expected: true,
  },
  {
    name: 'value of this not boxed (in strict mode)',
    destructive: true,  // Modifies String.prototype!
    src: `
      String.prototype.method = function() {return typeof this;};
      'a primitive string'.method();
    `,
    expected: 'string',  // Would be an [object String] in non-strict mode.
  },
  {src: `[].length;`, expected: 0},
  {src: `[1,,3,,].length;`, expected: 4},
  {
    name: 'arrayElidedNotDefinedNotUndefined',
    src: `
      var a = [,undefined,null,0,false];
      !(0 in a) && (1 in a) && (2 in a) && (3 in a) && (4 in a);
    `,
    expected: true,
  },
  {
    name: 'arrayLengthPropertyDescriptor',
    src: `
      var a = [1, 2, 3];
      var pd = Object.getOwnPropertyDescriptor(a, 'length');
      (pd.value === 3) && pd.writable && !pd.enumerable && !pd.configurable;
    `,
    expected: true,
  },
  {
    name: 'arrayLength',
    src: `
      try {
        var a;
        function checkLen(exp, desc) {
          if (a.length !== exp) {
            var msg = 'a.length === ' + a.length + ' (expected: ' + exp + ')'
            throw new Error(desc ? msg + ' ' + desc : msg);
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
            throw new Error(desc ? msg + ' ' + desc : msg);
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
            throw new Error(
                'Setting a.length = 0 failed to remove property ' + key);
          }
        }
        // Make sure we didn't wipe everything!
        if (Object.getOwnPropertyNames(a).length !== 4) {
          throw new Error(
              'Setting .length == 0 removed some non-index properties');
        }
        'OK';
      } catch (e) {
        String(e);
      }
    `,
    expected: 'OK',
  },
  {
    name: 'arrayLengthWithNonWritableProps',
    src: `
      var a = [];
      Object.defineProperty(a, 0,
          {value: 'hi', writable: false, configurable: true});
      a.length = 0;
      a[0] === undefined && a.length === 0;
    `,
    expected: true,
  },
  {
    name: 'arrayLengthWithNonConfigurableProps',
    src: `
      var a = [];
      Object.defineProperty(a, 0,
          {value: 'hi', writable: false, configurable: false});
      try {
        a.length = 0;
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'compValEmptyBlock',
    src: `{};`,
    expected: undefined,
  },
  {src: `undefined;`, expected: undefined},
  {
    name: 'unaryVoid',
    src: `var x = 70; (undefined === void x++) && x;`,
    expected: 71,
  },
  {src: `+'72';`, expected: 72},
  {src: `-73;`, expected: -73},
  {src: `~0xffffffb5;`, expected: 74},
  {src: `!false && (!true === false);`, expected: true},

  {src: `typeof undefined;`, expected: 'undefined'},
  {src: `typeof null;`, expected: 'object'},
  {src: `typeof false;`, expected: 'boolean'},
  {src: `typeof 0;`, expected: 'number'},
  {src: `typeof '';`, expected: 'string'},
  {src: `typeof {};`, expected: 'object'},
  {src: `typeof [];`, expected: 'object'},
  {src: `typeof function() {};`, expected: 'function'},
  {
    name: 'unaryTypeofUndeclared',
    src: `
      try {
        typeof undeclaredVar;
      } catch (e) {
        'whoops!'
      }
    `,
    expected: 'undefined',
  },
  {
    name: 'binaryIn',
    src: `var o = {foo: 'bar'}; 'foo' in o && !('bar' in o);`,
    expected: true,
  },
  {
    name: 'binaryInParent',
    src: `
      var p = {foo: 'bar'};
      var o = Object.create(p);
      'foo' in o && !('bar' in o);
    `,
    expected: true,
  },
  {src: `'length' in [];`, expected: true},
  {
    name: 'binaryInStringLength',
    src: `
      try {
        'length' in '';
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'instanceofBasics',
    src: `
      function F(){}
      var f = new F;
      f instanceof F && f instanceof Object && !(f.prototype instanceof F);
    `,
    expected: true,
  },
  {
    name: 'instanceofNonObjectLHS',
    src: `
      function F() {}
      F.prototype = null;
      42 instanceof F;
    `,
    expected: false,
  },
  {
    name: 'instanceofNonFunctionRHS',
    src: `
      try {
        ({}) instanceof 0;
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'instanceofNonObjectPrototype',
    src: `
      function F() {};
      F.prototype = 'hello';
      try {
        ({}) instanceof F;
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'undefined.foo',
    src: `
      try {
        undefined.foo;
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'undefined.foo = ...',
    src: `
      try {
        var c = 0;
        undefined.foo = c++;
      } catch (e) {
        e.name + ',' + c;
      }
    `,
    expected: 'TypeError,0',
  },
  {
    name: 'null.foo',
    src: `
      try {
        null.foo;
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'null.foo = ...',
    src: `
      try {
        var c = 0;
        null.foo = c++;
      } catch (e) {
        e.name + ',' + c;
      }
    `,
    expected: 'TypeError,0',
  },
  {
    name: 'delete',
    src: `
      var o = {foo: 'bar'};
      (delete o.quux) + ('foo' in o) + (delete o.foo) +
          !('foo' in o) + (delete o.foo);
    `,
    expected: 5,
  },
  {
    name: 'deleteNonexistentFromPrimitive',
    src: `(delete false.nonexistent) && (delete (42).toString);`,
    expected: true,
  },
  // This "actually" tries to delete the non-configurable own .length
  // property from the auto-boxed String instance created by step 4a
  // of algorithm in §11.4.1 of the ES 5.1 spec.  We have to use a
  // string here, because only String instances have own properties
  // (and yes: they are all non-configurable, so delete *always*
  // fails).
  {
    name: 'deleteOwnFromPrimitive',
    src: `
      try {
        delete 'hello'.length;
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'funcDecl',
    src: `
      var v;
      function f() {
        v = 75;
      }
      f();
      v;
    `,
    expected: 75,
  },
  {
    name: 'namedFunctionExpression',
    src: `
      var f = function half(x) {
        if (x < 100) {
          return x;
        }
        return half(x / 2);
      };
      f(152)
    `,
    expected: 76,
  },
  {
    name: 'namedFunExpNameBinding',
    src: `var f = function foo() {return foo;}; f() === f;`,
    expected: true,
  },
  {
    name: 'namedFunExpNameBindingNoLeak',
    src: `var f = function foo() {}; typeof foo;`,
    expected: 'undefined',
  },
  {
    name: 'namedFunExpNameBindingImmutable',
    src: `
      var f = function foo() {
        try {
          foo = null;
        } catch (e) {
          return e.name;
        }
      };
      f();
    `,
    expected: 'TypeError',
  },
  {
    name: 'namedFunExpNameBindingShadowedByParam',
    src: `
      var f = function foo(foo) {
        foo += 0.1;  // Verify mutability.
        return foo;
      };
      f(76);
    `,
    expected: 76.1,
  },
  {
    name: 'namedFunExpNameBindingShadowedByVar',
    src: `
      var f = function foo() {
        var foo;
        foo = 76.2;  // Verify mutability.
        return foo;
      };
      f();
    `,
    expected: 76.2,
  },
  {
    name: 'closureIndependence',
    src: `
      function makeAdder(x) {
        return function(y) {return x + y;};
      }
      var plus3 = makeAdder(3);
      var plus4 = makeAdder(4);
      plus3(plus4(70));
    `,
    expected: 77,
  },
  {
    name: 'internalObjectToString',
    src: `
      var o = {};
      o[{}] = null;
      for(var key in o) {
        key;
      }
    `,
    expected: '[object Object]',
  },
  {
    name: 'internalFunctionToString',
    src: `
      var o = {}, s, f = function(){};
      o[f] = null;
      for(var key in o) {
        s = key;
      }
      /^function.*\(.*\).*{[^]*}$/.test(s);
    `,
    expected: true,
  },
  {
    name: 'internalNativeFuncToString',
    src: `
      var o = {}, s, f = Object.create;
      o[f] = null;
      for(var key in o) {
        s = key;
      }
      /^function.*\(.*\).*{[^]*}$/.test(s);
    `,
    expected: true,
  },
  {
    name: 'internalArrayToString',
    src: `
      var o = {};
      o[[1, 2, 3]] = null;
      for(var key in o) {
        key;
      }
    `,
    expected: '1,2,3',
  },
  {
    name: 'internalDateToString',
    src: `
      var o = {};
      o[new Date(0)] = null;
      for(var key in o) {
        key;
      }
    `,
    expected: (new Date(0)).toString(),
  },
  {
    name: 'internalRegExpToString',
    src: `
      var o = {};
      o[/foo/g] = null;
      for(var key in o) {
        key;
      }
    `,
    expected: '/foo/g',
  },
  {
    name: 'internalErrorToString',
    src: `
      var o = {};
      o[Error('oops')] = null;
      for(var key in o) {
        key;
      }
    `,
    expected: 'Error: oops',
  },
  {
    name: 'internalArgumentsToString',
    src: `
      var o = {};
      (function() {
        o[arguments] = null;
      })();
      for(var key in o) {
        key;
      }
    `,
    expected: '[object Arguments]',
  },
  {src: `debugger;`, expected: undefined},
  {
    name: 'newExpression',
    src: `
      function T(x, y) {this.sum += x + y;};
      T.prototype = {sum: 70}
      var t = new T(7, 0.7);
      t.sum;
    `,
    expected: 77.7,
  },
  {
    name: 'newExpressionReturnObj',
    src: `
      function T() {return {};};
      T.prototype = {p: 'the prototype'};
      (new T).p;
    `,
    expected: undefined,
  },
  {
    name: 'newExpressionReturnPrimitive',
    src: `
      function T() {return 0;};
      T.prototype = {p: 'the prototype'};
      (new T).p;
    `,
    expected: 'the prototype',
  },
  {src: `/foo/.test('foobar');`, expected: true},
  {
    name: 'evalSeeEnclosing',
    src: `var n = 77.77; eval('n');`,
    expected: 77.77,
  },
  {
    name: 'evalIndirectNoSeeEnclosing',
    src: `
      (function() {
        var n = 77.77, gEval = eval;
        try {
          gEval('n');
        } catch (e) {
          return e.name;
        }
      })();
    `,
    expected: 'ReferenceError',
  },
  {
    name: 'evalIndirectNoSeeEnclosing2',
    src: `
      (function() {
        var n = 77.77;
        try {
          (function() {return eval;})()('n');
        } catch (e) {
          return e.name;
        }
      })();
    `,
    expected: 'ReferenceError',
  },
  {
    name: 'evalIndirectSeeGlobal',
    src: `var gEval = eval; gEval('typeof Array');`,
    expected: 'function',
  },
  {
    name: 'evalModifyEnclosing',
    src: `var n = 77.77; eval('n = 77.88'); n;`,
    expected: 77.88,
  },
  {
    name: 'evalNoLeakingDecls',
    src: `eval('var n = 88.88'); typeof n;`,
    expected: 'undefined',
  },
  // A bug in eval would cause it to return the value of the
  // previously-evaluated ExpressionStatement if the eval program did
  // not contain any ExpressionStatements.
  {
    name: 'evalEmptyBlock',
    src: `'fail'; eval('{}');`,
    expected: undefined,
  },
  {
    name: 'callEvalOrder',
    src: `
      var r = '';
      function log(x) {
        r += x;
        return function() {};
      };
      (log('f'))(log('a'), log('b'), log('c'));
      r;
    `,
    expected: 'fabc',
  },
  {
    name: 'callEvalArgsBeforeCallability',
    src: `
      try {
        var invalid = undefined;
        function t() {throw {name: 'args'};};
        invalid(t());
      } catch(e) {
        e.name;
      }
    `,
    expected: 'args',
  },
  {
    name: 'callNonCallable',
    src: `
      var tests = [
        undefined,
        null,
        false,
        42,
        'hello',
        Object.create(Function.prototype),
      ];
      var ok = 0;
      for (var i = 0; i < tests.length; i++) {
        try {
          tests[i]();
        } catch (e) {
          var r = e;
          if (e.name === 'TypeError') {
            ok++;
          }
        }
      }
      (ok === tests.length) ? 'pass' : 'fail';
    `,
    expected: 'pass',
  },

  /////////////////////////////////////////////////////////////////////////////
  // Object and Object.prototype
  {
    name: 'Object.defineProperty()',
    src: `
      try {
        Object.defineProperty();
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.defineProperty non-object',
    src: `
      try {
        Object.defineProperty('not an object', 'foo', {});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.defineProperty bad descriptor',
    src: `
      var o = {};
      try {
        Object.defineProperty(o, 'foo', 'not an object');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  // This also tests iteration over (non-)enumerable properties.
  {
    name: 'Object.defineProperty',
    src: `
      var o = {foo: 50}, r = 0;
      Object.defineProperty(o, 'bar', {
        writable: true,
        enumerable: true,
        configurable: true,
        value: 0
      });
      o.bar = 20;
      Object.defineProperty(o, 'baz', {
        writable: true,
        enumerable: true,
        configurable: false
      });
      Object.defineProperty(o, 'baz', {
        value: 4,
      });
      Object.defineProperty(o, 'quux', {
        enumerable: false,
        value: 13
      });
      for (var k in o) {
        r += o[k];
      }
      r += Object.getOwnPropertyNames(o).length;
      r;
    `,
    expected: 78,
  },
  {
    name: 'Object.getPrototypeOf(null) and undefined',
    src: `
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
    expected: 'TypeErrorTypeError',
  },
  // This tests for ES6 behaviour:
  {
    name: 'Object.getPrototypeOf primitives',
    src: `
      Object.getPrototypeOf(true) === Boolean.prototype &&
      Object.getPrototypeOf(1337) === Number.prototype &&
      Object.getPrototypeOf('hi') === String.prototype;
    `,
    expected: true,
  },
  {
    name: 'Object.setPrototypeOf(null, ...) and undefined',
    src: `
      var r = '', prims = [null, undefined];
      for (var i = 0; i < prims.length; i++) {
        try {
          Object.setPrototypeOf(prims[i], null);
        } catch (e) {
          r += e.name;
        }
      }
      r;
    `,
    expected: 'TypeErrorTypeError',
  },
  {
    name: 'Object.setPrototypeOf primitives',
    src: `
      Object.setPrototypeOf(true, null) === true &&
      Object.setPrototypeOf(1337, null) === 1337 &&
      Object.setPrototypeOf('hi', null) === 'hi';
    `,
    expected: true,
  },
  {
    name: 'Object.setPrototypeOf',
    src: `
      var o = {parent: 'o'};
      var p = {parent: 'p'};
      var q = Object.create(o);
      Object.setPrototypeOf(q, p) === q &&
          Object.getPrototypeOf(q) === p && q.parent;
    `,
    expected: 'p',
  },
  {
    name: 'Object.setPrototypeOf(..., null)',
    src: `
      var o = {parent: 'o'};
      var q = Object.create(o);
      Object.setPrototypeOf(q, null) === q && Object.getPrototypeOf(q);
    `,
    expected: null,
  },
  {
    name: 'Object.setPrototypeOf circular',
    src: `
      var o = {};
      var p = Object.create(o);
      try {
        Object.setPrototypeOf(o, p);
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.create()',
    src: `
      try {
        Object.create();
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.create non-object prototype',
    src: `
      try {
        Object.create(42);
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.create(null) prototype',
    src: `Object.getPrototypeOf(Object.create(null));`,
    expected: null,
  },
  {
    name: 'Object.create',
    src: `
      var o = Object.create({foo: 79});
      delete o.foo
      o.foo;
    `,
    expected: 79,
  },
  {
    name: 'Object.getOwnPropertyDescriptor()',
    src: `
      try {
        Object.getOwnPropertyDescriptor();
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.getOwnPropertyDescriptor non-object',
    src: `
      try {
        Object.getOwnPropertyDescriptor('not an object', 'foo');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.getOwnPropertyDescriptor bad key',
    src: `Object.getOwnPropertyDescriptor({}, 'foo');`,
    expected: undefined,
  },
  {
    name: 'Object.getOwnPropertyDescriptor',
    src: `
      var o = {}, r = 0;
      Object.defineProperty(o, 'foo', {value: 'bar'});
      var desc = Object.getOwnPropertyDescriptor(o, 'foo');
      desc.value === o.foo &&
          !desc.writable && !desc.enumerable && !desc.configurable;
    `,
    expected: true,
  },
  {
    name: 'Object.getOwnPropertyNames()',
    src: `
      try {
        Object.getOwnPropertyNames();
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.getOwnPropertyNames string',
    src: `
      var i, r = 0, names = Object.getOwnPropertyNames('foo');
      for (i = 0; i < names.length; i++) {
        if (names[i] === 'length') {
          r += 10;
        } else {
          r += Number(names[i]) + 1;
        }
      }
    `,
    expected: 16,
  },
  {src: `Object.getOwnPropertyNames(42).length`, expected: 0},
  {src: `Object.getOwnPropertyNames(true).length`, expected: 0},
  {
    name: 'Object.getOwnPropertyNames(null)',
    src: `
      try {
        Object.getOwnPropertyNames(null).length;
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.getOwnPropertyNames(undefined)',
    src: `
      try {
        Object.getOwnPropertyNames(undefined).length;
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.getOwnPropertyNames',
    src: `
      var o = Object.create({baz: 999});
      o.foo = 42;
      Object.defineProperty(o, 'bar', {value: 38});
      var keys = Object.getOwnPropertyNames(o);
      var r = 0;
      for (var i = 0; i < keys.length; i++) {
        r += o[keys[i]];
      }
      r;
    `,
    expected: 80,
  },
  {
    name: 'Object.defineProperties()',
    src: `
      try {
        Object.defineProperties();
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.defineProperties non-object',
    src: `
      try {
        Object.defineProperties('not an object', {});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.defineProperties non-object props',
    src: `
      try {
        Object.defineProperties({}, undefined);
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.defineProperties bad descriptor',
    src: `
      var o = {};
      try {
        Object.defineProperties(o, {foo: 'not an object'});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.defineProperties',
    src: `
      var o = {foo: 70}, r = 0;
      Object.defineProperties(o, {
          bar: {
              writable: true,
              enumerable: true,
              configurable: true,
              value: 8 },
          baz: {value: 999}});
      for (var k in o) {
        r += o[k];
      }
      r + Object.getOwnPropertyNames(o).length;
    `,
    expected: 81,
  },
  {
    name: 'Object.create(..., properties)',
    src: `
      var o = Object.create({foo: 70}, {
          bar: {
              writable: true,
              enumerable: true,
              configurable: true,
              value: 10 },
          baz: {value: 999}});
      var r = 0;
      for (var k in o) {
        r += o[k];
      }
      r + Object.getOwnPropertyNames(o).length;
    `,
    expected: 82,
  },
  {
    name: 'Object.assign',
    src: `
      var p = {x: 'inherited enumerable', y: 'inherited nonenumerable'};
      var o = Object.create(p);
      o.a = 'own enumerable';
      o.b = 'own nonenumerable';
      o.c = 'own enumerable';
      Object.defineProperty(p, 'y', {enumerable: false});
      Object.defineProperty(o, 'b', {enumerable: false});

      var t = {a: 'to be overwritten', b: 'not overwritten', d: 'preserved'};

      Object.assign(t, o, {e: 'extra'});
      [Object.getOwnPropertyNames(t).length,
       t.a, t.b, t.c, t.d, t.e].toString();
    `,
    expected:
      '5,own enumerable,not overwritten,own enumerable,preserved,extra',
  },
  {
    name: 'Object.getOwnPropertyNames',
    src: `
      var p = {x: 'inherited enumerable', y: 'inherited nonenumerable'};
      var o = Object.create(p);
      o.a = 'own enumerable';
      o.b = 'own nonenumerable';
      o.c = 'own enumerable';
      Object.defineProperty(p, 'y', {enumerable: false});
      Object.defineProperty(o, 'b', {enumerable: false});
      Object.getOwnPropertyNames(o).toString();
    `,
    expected: 'a,b,c',
  },
  {
    name: 'Object.keys',
    src: `
      var p = {x: 'inherited enumerable', y: 'inherited nonenumerable'};
      var o = Object.create(p);
      o.a = 'own enumerable';
      o.b = 'own nonenumerable';
      o.c = 'own enumerable';
      Object.defineProperty(p, 'y', {enumerable: false});
      Object.defineProperty(o, 'b', {enumerable: false});
      Object.keys(o).toString();
    `,
    expected: 'a,c',
  },
  {
    name: 'Object.prototype.toString',
    src: `({}).toString();`,
    expected: '[object Object]',
  },
  {
    name: 'Object.protoype.hasOwnProperty',
    src: `
      var o = Object.create({baz: 999});
      o.foo = 42;
      Object.defineProperty(o, 'bar', {value: 41, enumerable: true});
      var r = 0;
      for (var key in o) {
        if (!o.hasOwnProperty(key)) continue;
        r += o[key];
      }
      r;
    `,
    expected: 83,
  },
  {
    name: 'Object.protoype.isPrototypeOf primitives',
    src: `
      Boolean.prototype.isPrototypeOf(false) ||
      Number.prototype.isPrototypeOf(0) ||
      String.prototype.isPrototypeOf('') ||
      Object.prototype.isPrototypeOf.call(false, false) ||
      Object.prototype.isPrototypeOf.call(0, 0) ||
      Object.prototype.isPrototypeOf.call('', '') ||
      Object.prototype.isPrototypeOf.call(null, null) ||
      Object.prototype.isPrototypeOf.call(undefined, undefined);
    `,
    expected: false,
  },
  {
    name: 'Object.protoype.isPrototypeOf.call(null, ...)',
    src: `
      try {
        Object.prototype.isPrototypeOf.call(null, Object.create(null));
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.protoype.isPrototypeOf.call(undefined, ...)',
    src: `
      try {
        Object.prototype.isPrototypeOf
          .call(undefined, Object.create(undefined));
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.protoype.isPrototypeOf self',
    src: `var o = {}; o.isPrototypeOf(o);`,
    expected: false,
  },
  {src: `Object.prototype.isPrototypeOf(Object.create(null))`, expected: false},
  {
    name: 'Object.protoype.isPrototypeOf related',
    src: `
      var g = {};
      var p = Object.create(g);
      var o = Object.create(p);
      !o.isPrototypeOf({}) &&
      g.isPrototypeOf(o) && p.isPrototypeOf(o) &&
      !o.isPrototypeOf(p) && !o.isPrototypeOf(g);
    `,
    expected: true,
  },
  {
    name: 'Object.protoype.propertyIsEnumerable(null)',
    src: `
      try {
        Object.prototype.propertyIsEnumerable.call(null, '');
      } catch(e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'ObjectProtoypePropertyIsEnumerableUndefined',
    src: `
      try {
        Object.prototype.propertyIsEnumerable.call(undefined, '');
      } catch(e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Object.protoype.propertyIsEnumerable primitives',
    src: `
      var OppIE = Object.prototype.propertyIsEnumerable;
      OppIE.call('foo', '0') && !OppIE.call('foo', 'length');
    `,
    expected: true,
  },
  {
    name: 'Object.protoype.propertyIsEnumerable',
    src: `
      var o = {foo: 'foo'};
      Object.defineProperty(o, 'bar', {value: 'bar', enumerable: false});
      o.propertyIsEnumerable('foo') && !o.propertyIsEnumerable('bar') &&
          !o.propertyIsEnumerable('baz');
    `,
    expected: true,
  },

  /////////////////////////////////////////////////////////////////////////////
  // Function and Function.prototype
  {
    name: 'new Function() returns callable',
    src: `new Function()();`,
    expected: undefined,
  },
  {src: `(new Function()).length;`, expected: 0},
  {src: `new Function().toString()`, expected: 'function anonymous(\n) {\n\n}'},
  {
    name: 'new Function(/* body */) returns callable',
    src: `new Function('return 42;')();`,
    expected: 42,
  },
  {
    name: 'Function constructor accepts trailing line comments in body',
    src: `typeof new Function('//');`,
    expected: 'function',
  },
  {src: `new Function(/* body */).length;`, expected: 0},
  {
    src: `new Function('return 42;').toString()`,
    expected: 'function anonymous(\n) {\nreturn 42;\n}'
  },
  {
    name: 'new Function(/* args... */, /* body */) returns callable',
    src: `new Function('a, b', 'c', 'return a + b * c;')(2, 3, 10);`,
    expected: 32,
  },
  {
    name: "(new Function('a, b', 'c', /* body */)).length",
    src: `new Function('a, b', 'c', 'return a + b * c;').length;`,
    expected: 3,
  },
  {
    name: 'new Function(/* args... */, /* body */).toString()',
    src: `new Function('a, b', 'c', 'return a + b * c;').toString()`,
    expected: 'function anonymous(a, b,c\n) {\nreturn a + b * c;\n}',
  },
  {
    name: 'Function constructor accepts non-ASCII parameter names',
    src: `new Function('fußball', '').toString()`,
    expected: 'function anonymous(fußball\n) {\n\n}',
  },
  {
    name: 'Function constructor rejects non-unicode-letter parameter names',
    src: `
      try {
        new Function('a…z', '');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'SyntaxError',
  },
  {
    name: 'Function constructor accepts block comments in parameter list',
    src: `new Function('a, /*test*/b', 'c', 'return a + b * c;')(2, 4, 10)`,
    expected: 42,
  },
  {
    name: 'Function constructor accepts line comments in parameter list',
    src: `new Function('a, b', 'c //test', 'return a + b * c;')(2, 4, 10)`,
    expected: 42,
  },
  {
    name: 'Function constructor parameter line comments hide later parameters',
    src: `new Function('dummy //', 'escape', 'return typeof escape')(0, 0);`,
    expected: 'function',
  },

  {
    name: 'Function.prototype has no .prototype',
    src: `Function.prototype.hasOwnProperty('prototype');`,
    expected: false,
  },
  {
    src: `Function.prototype.toString()`,
    expected: 'function () { [native code] }'
  },
  {
    name: 'Function.prototype.toString.call(/* non-function */) throws',
    src: `
      try {
        Function.prototype.toString.call({});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Function.prototype.toSting on NativeFunction',
    src: `escape.toString();`,
    expected: 'function escape() { [native code] }',
  },
  {
    name: 'Function.prototype.toSting on modified NativeFunction',
    destructive: true,  // Modifies escape.
    src: `
      // Delete escape's original .name make it inherit a new one.
      delete escape.name;
      Object.setPrototypeOf(escape, function parent() {});
      escape.toString();
    `,
    expected: 'function escape() { [native code] }',
  },
  {
    name: 'Function.prototype.apply.call(/* non-function */) throws',
    src: `
      try {
        Function.prototype.apply.call({});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Function.prototype.apply this',
    src: `
      var o = {};
      function f() {return this;}
      f.apply(o, []) === o;
    `,
    expected: true,
  },
  {
    name: 'Function.prototype.apply(..., undefined) or null',
    src: `
      var n = 0;
      function f() {n += arguments.length;}
      f.apply(undefined, undefined);
      f.apply(undefined, null);
      n;
    `,
    expected: 0,
  },
  {
    name: 'Function.prototype.apply(..., /* non-object */) throws',
    src: `
      try {
        (function() {}).apply(undefined, 'not an object');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Function.prototype.apply(..., /* sparse array */)',
    src: `
      (function(a, b, c) {
        if (!(1 in arguments)) {
          throw new Error('arguments[1] missing');
        }
        return a + c;
      }).apply(undefined, [1, , 3]);
    `,
    expected: 4,
  },
  {
    name: 'Function.prototype.apply(..., /* array-like */)',
    src: `
      (function(a, b, c) {
        return a + b + c;
      }).apply(undefined, {0: 1, 1: 2, 2: 3, length: 3});
    `,
    expected: 6,
  },
  {
    name: 'Function.prototype.apply(..., /* non-array-like */)',
    src: `
      (function(a, b, c) {
        return a + b + c;
      }).apply(undefined, {0: 1, 1: 2, 2: 4});
    `,
    expected: NaN  // Because undefined + undefined === NaN.,
  },
  {
    name: 'Function.prototype.call.call(/* non-function */) throws',
    src: `
      try {
        Function.prototype.call.call({});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Function.prototype.call this',
    src: `
      var o = {};
      function f() {return this;}
      f.call(o) === o;
    `,
    expected: true,
  },
  {
    name: 'Function.prototype.call() gives arguments.length === 0',
    src: `(function() {return arguments.length;}).call();`,
    expected: 0,
  },
  {
    name: 'Function.prototype.call(..., /* sparse array */)',
    src: `
      (function(a, b, c) {
        if (!(1 in arguments)) {
          throw new Error('Argument 1 missing');
        }
        return a + c;
      }).call(undefined, 1, 2, 3);
    `,
    expected: 4,
  },
  {
    name: 'Function.prototype.bind.call(/* non-function */) throws',
    src: `
      try {
        Function.prototype.bind.call({});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'Function.prototype.bind this',
    src: `
      var o = {};
      function f() {return this;}
      f.bind(o)() === o;
    `,
    expected: true,
  },
  {
    name: 'Function.prototype.bind no args',
    src: `(function() {return arguments.length;}).bind()();`,
    expected: 0,
  },
  {
    name: 'Function.prototype.bind',
    src: `
      var d = 4;
      (function(a, b, c) {
        return a + b + c + d;
      }).bind(undefined, 1).bind(undefined, 2)(3);
    `,
    expected: 10,
  },
  {
    name: 'Function.prototype.bind call BF',
    src: `
      var constructed;
      function Foo() {constructed = (this instanceof Foo)}
      var f = Foo.bind();
      f();
      constructed;
    `,
    expected: false,
  },
  {
    name: 'Function.prototype.bind construct BF',
    src: `
      var constructed;
      function Foo() {constructed = (this instanceof Foo)}
      var f = Foo.bind();
      new f;
      constructed;
    `,
    expected: true,
  },
  {
    name: 'Function.prototype.call.bind construct BF',
    src: `
      var invoked;
      function Foo() {invoked = true};
      var f = Foo.call.bind(Foo);
      try {
        new f;
      } catch (e) {
        !invoked && e.name;
      }
    `,
    expected: 'TypeError',
  },
  // N.B.: tests of semantics of class constructors are unavoidably ES6.
  {
    name: 'Function.prototype.bind class constructor w/o new',
    src: `
      var f = WeakMap.bind();  // Should be O.K.
      try {
        f();
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  // N.B.: tests of semantics of class constructors are unavoidably ES6.
  {
    name: 'Function.prototype.bind class constructor',
    src: `String(new (WeakMap.bind()));`,
    expected: '[object WeakMap]',
  },

  /////////////////////////////////////////////////////////////////////////////
  // Array and Array.prototype
  {
    name: 'new Array()',
    src: `var a = new Array(); Array.isArray(a) && a.length;`,
    expected: 0,
  },
  {
    name: 'newArray(/* number */)',
    src: `
      var a = new Array(42);
      Array.isArray(a) && !(0 in a) && !(41 in a) && a.length;
    `,
    expected: 42,
  },
  {
    name: 'new Array(/* non-number */)',
    src: `
      var a = new Array('foo');
      Array.isArray(a) && a.length === 1 && a[0];
    `,
    expected: 'foo',
  },
  {
    name: 'new Array(/* multiple args */)',
    src: `
      var a = new Array(1, 2, 3);
      Array.isArray(a) && a.length === 3 && String(a);
    `,
    expected: '1,2,3',
  },
  {src: `Array.isArray(Array.prototype);`, expected: true},
  {src: `Array.isArray(new Array);`, expected: true},
  {src: `Array.isArray([]);`, expected: true},
  {src: `Array.isArray({0: 'foo', 1: 'bar', length: 2});`, expected: false},
  {
    name: 'Array.prototype.concat()',
    src: `
      var a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
      var c = a.concat();
      a.length === 6 && c.length === 6 && c !== a && String(c);
    `,
    expected: 'foo,bar,baz,,quux,quuux',
  },
  {
    name: 'Array.prototype.concat(...)',
    src: `
      var o = {0: 'quux', 1: 'quuux', length: 2};
      var c = [].concat(['foo', 'bar'], 'baz', undefined, o);
      c.length === 5 && '3' in c && c[3] === undefined && String(c);
    `,
    expected: 'foo,bar,baz,,[object Object]',
  },
  {
    name: 'Array.prototype.concat.call(object, ...)',
    src: `
      var o = {0: 'foo', 1: 'bar', length: 2};
      var c = Array.prototype.concat.call(o, 'baz', [, 'quux', 'quuux']);
      c.length === 5 && String(c);
    `,
    expected: '[object Object],baz,,quux,quuux',
  },
  {src: `[1, 2, 3, 2, 1].includes(2);`, expected: true},
  {src: `[1, 2, 3, 2, 1].includes(4);`, expected: false},
  {
    name: 'Array.prototype.includes fromIndex',
    src: `[1, 2, 3, 2, 1].includes(2, 2);`,
    expected: true,
  },
  {
    name: 'Array.prototype.includes negative fromIndex',
    src: `[1, 2, 3, 2, 1].includes(1, -3);`,
    expected: true,
  },
  {src: `['x', NaN, 'y'].includes(NaN);`, expected: true},
  {
    name: 'Array.prototype.includes.call(array-like, ...)',
    src: `
      var o = {0: 1, 1: 2, 2: 3, 3: 2, 4: 1, length: 5};
      Array.prototype.includes.call(o, 2);
    `,
    expected: true,
  },
  {
    name: 'Array.prototype.indexOf',
    src: `[1, 2, 3, 2, 1].indexOf(2);`,
    expected: 1,
  },
  {
    name: 'Array.prototype.indexOf not found',
    src: `[1, 2, 3, 2, 1].indexOf(4);`,
    expected: -1,
  },
  {
    name: 'Array.prototype.indexOf fromIndex',
    src: `[1, 2, 3, 2, 1].indexOf(2, 2);`,
    expected: 3,
  },
  {
    name: 'Array.prototype.indexOf negative fromIndex',
    src: `[1, 2, 3, 2, 1].indexOf(1, -3);`,
    expected: 4,
  },
  {
    name: 'Array.prototype.indexOf NaN',
    src: `['x', NaN, 'y'].indexOf(NaN);`,
    expected: -1,
  },
  {
    name: 'Array.prototype.indexOf.call(array-like, ...)',
    src: `
      var o = {0: 1, 1: 2, 2: 3, 3: 2, 4: 1, length: 5};
      Array.prototype.indexOf.call(o, 2);
    `,
    expected: 1,
  },
  {
    name: 'Array.prototype.join',
    src: `[1, 2, 3].join('-');`,
    expected: '1-2-3',
  },
  {
    name: 'Array.prototype.join cycle detection',
    src: `
      var a = [1, , 3];
      a[1] = a;
      a.join('-');
      "Didn't crash!";
    `,
    expected: 'Didn\'t crash!',
  },
  {
    name: 'Array.prototype.lastIndexOf',
    src: `[1, 2, 3, 2, 1].lastIndexOf(2);`,
    expected: 3,
  },
  {
    name: 'Array.prototype.lastIndexOf not found',
    src: `[1, 2, 3, 2, 1].lastIndexOf(4);`,
    expected: -1,
  },
  {
    name: 'Array.prototype.lastIndexOf(..., +)',
    src: `[1, 2, 3, 2, 1].lastIndexOf(2, 2);`,
    expected: 1,
  },
  {
    name: 'Array.prototype.lastIndexOf(..., -)',
    src: `[1, 2, 3, 2, 1].lastIndexOf(1, -3);`,
    expected: 0,
  },
  {
    name: 'Array.prototype.lastIndexOf.call(array-like, ...)',
    src: `
      var o = {0: 1, 1: 2, 2: 3, 3: 2, 4: 1, length: 5};
      Array.prototype.lastIndexOf.call(o, 2);
    `,
    expected: 3,
  },
  {
    name: 'Array.prototype.pop',
    src: `
      var a = ['foo', 'bar', 'baz'];
      var r = a.pop();
      a.length === 2 && r;
    `,
    expected: 'baz',
  },
  {
    name: 'Array.prototype.pop empty array',
    src: `
      var a = [];
      var r = a.pop();
      a.length === 0 && r;
    `,
    expected: undefined,
  },
  {
    name: 'Array.prototype.pop.apply(array-like)',
    src: `
      var o = {0: 'foo', 1: 'bar', 2: 'baz', length: 3};
      var r = Array.prototype.pop.apply(o);
      o.length === 2 && r;
    `,
    expected: 'baz',
  },
  {
    name: 'Array.prototype.pop.apply(empty array-like)',
    src: `
      var o = {length: 0};
      var r = Array.prototype.pop.apply(o);
      o.length === 0 && r;
    `,
    expected: undefined,
  },
  {
    name: 'Array.prototype.pop.apply(huge array-like)',
    src: `
      var o = {5000000000000000: 'foo',
               5000000000000001: 'quux',
               length: 5000000000000002};
      var r = Array.prototype.pop.apply(o);
      o.length === 5000000000000001 && o[5000000000000000] === 'foo' && r;
    `,
    expected: 'quux',
  },
  {
    name: 'Array.prototype.push',
    src: `
      var a = [];
      a.push('foo') === 1 && a.push('bar') === 2 &&
          a.length === 2 && a[0] === 'foo' && a[1] === 'bar';
    `,
    expected: true,
  },
  {
    name: 'Array.prototype.push.call(array-like, ...)',
    src: `
      var o = {length: 0};
      Array.prototype.push.call(o, 'foo') === 1 &&
          Array.prototype.push.call(o, 'bar') === 2 &&
          o.length === 2 && o[0] === 'foo' && o[1] === 'bar';
    `,
    expected: true,
  },
  {
    name: 'Array.prototype.push.call(huge array-like, ...)',
    src: `
      var o = {length: 5000000000000000};
      var o = {length: 5000000000000000};
      Array.prototype.push.call(o, 'foo') === 5000000000000001 &&
          Array.prototype.push.call(o, 'bar') === 5000000000000002 &&
          o[5000000000000000] === 'foo' && o[5000000000000001] === 'bar' &&
          o.length === 5000000000000002
    `,
    expected: true,
  },
  {
    name: 'Array.prototype.reverse odd-length',
    src: `
      var a = [1, 2, 3];
      a.reverse() === a && a.length === 3 && String(a);
    `,
    expected: '3,2,1',
  },
  {
    name: 'Array.prototype.reverse even-length',
    src: `
      var a = [1, 2, , 4];
      a.reverse() === a && a.length === 4 && String(a);
    `,
    expected: '4,,2,1',
  },
  {
    name: 'Array.prototype.reverse empty',
    src: `
      var a = [];
      a.reverse() === a && a.length;
    `,
    expected: 0,
  },
  {
    name: 'Array.prototype.reverse.call(odd-length array-like)',
    src: `
      var o = {0: 1, 1: 2, 2: 3, length: 3};
      Array.prototype.reverse.call(o) === o && o.length === 3 &&
          Array.prototype.slice.apply(o).toString();
    `,
    expected: '3,2,1',
  },
  {
    name: 'Array.prototype.reverse.call(even-length array-like)',
    src: `
      var o = {0: 1, 1: 2, 3: 4, length: 4};
      Array.prototype.reverse.call(o) === o && o.length === 4 &&
          Array.prototype.slice.apply(o).toString();
    `,
    expected: '4,,2,1',
  },
  {
    name: 'Array.prototype.reverse.call(empty array-like)',
    src: `
      var o = {length: 0};
      Array.prototype.reverse.call(o) === o && o.length;
    `,
    expected: 0,
  },
  {
    name: 'Array.prototype.shift',
    src: `
      var a = ['foo', 'bar', 'baz'];
      var r = a.shift();
      a.length === 2 && a[0] === 'bar' && a[1] === 'baz' && r;
    `,
    expected: 'foo',
  },
  {
    name: 'Array.prototype.shift empty array',
    src: `
      var a = [];
      var r = a.shift();
      a.length === 0 && r;
    `,
    expected: undefined,
  },
  {
    name: 'Array.prototype.shift.apply(array-like)',
    src: `
      var o = {0: 'foo', 1: 'bar', 2: 'baz', length: 3};
      var r = Array.prototype.shift.apply(o);
      o.length === 2 && o[0] === 'bar' && o[1] === 'baz' && r;
    `,
    expected: 'foo',
  },
  {
    name: 'Array.prototype.shift.apply(empty array-like)',
    src: `
      var o = {length: 0};
      var r = Array.prototype.shift.apply(o);
      o.length === 0 && r;
    `,
    expected: undefined,
  },
  {
    name: 'Array.prototype.shift.apply(huge array-like)',
    src: `
      var o = {5000000000000000: 'foo',
               5000000000000001: 'quux',
               length: 5000000000000002};
      var r = Array.prototype.shift.apply(o);
      o.length === 5000000000000001 && o[5000000000000000] === 'quux' && r;
    `,
    // SKIP until more efficient shift implementation available.
    /* expected: 'foo' */
  },
  {
    name: 'Array.prototype.slice()',
    src: `
      var a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
      var s = a.slice();
      a.length === 6 && s.length === 6 && String(s);
    `,
    expected: 'foo,bar,baz,,quux,quuux',
  },
  {
    name: 'Array.prototype.slice(-)',
    src: `
      var a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
      var s = a.slice(-2);
      a.length === 6 && s.length === 2 && String(s);
    `,
    expected: 'quux,quuux',
  },
  {
    name: 'Array.prototype.slice(+, +)',
    src: `
      var a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
      var s = a.slice(1, 4);
      a.length === 6 && s.length === 3 && !('2' in s) && String(s);
    `,
    expected: 'bar,baz,',
  },
  {
    name: 'Array.prototype.slice(+, -)',
    src: `
      var a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
      var s = a.slice(1, -2);
      a.length === 6 && s.length === 3 && !('2' in s) && String(s);
    `,
    expected: 'bar,baz,',
  },
  {
    name: 'Array.prototype.slice.call(array-like, -, +)',
    src: `
      var o = {
        0: 'foo', 1: 'bar', 2: 'baz', 4: 'quux', 5: 'quuux', length: 6
      };
      var s = Array.prototype.slice.call(o, -5, 4);
      !Array.isArray(o) && o.length === 6 &&
          Array.isArray(s) && s.length === 3 && !('2' in s) && String(s);
    `,
    expected: 'bar,baz,',
  },
  {
    name: 'Array.prototype.slice.call(huge array-like, -, -)',
    src: `
      var o = {
        5000000000000000: 'foo', 5000000000000001: 'bar',
        5000000000000002: 'baz', 5000000000000004: 'quux',
        5000000000000005: 'quuux', length: 5000000000000006
      };
      var s = Array.prototype.slice.call(o, -5, -2);
      !Array.isArray(o) && o.length === 5000000000000006 &&
          Array.isArray(s) && s.length === 3 && !('2' in s) && String(s);
    `,
    expected: 'bar,baz,',
  },
  {
    name: 'Array.prototype.sort()',
    src: `[5, 2, 3, 1, 4].sort().join();  // Sorts ASCIIbetically.`,
    expected: '1,2,3,4,5',
  },
  {
    name: 'Array.prototype.sort() compaction',
    src: `
      ['z', undefined, 10, , 'aa', null, 'a', 5, NaN, , 1].sort()
          .map(String).join();
    `,
    expected: '1,10,5,NaN,a,aa,null,z,undefined,,',
  },
  {
    name: 'Array.prototype.sort(/* comparefn */)',
    src: `
      [99, 9, 10, 11, 1, 0, 5]
          .sort(function(a, b) {return a - b;}).join();
    `,
    expected: '0,1,5,9,10,11,99',
  },
  {
    name: 'Array.prototype.sort(/* comparefn */) compaction',
    src: `
      ['z', undefined, 10, , 'aa', null, 'a', 5, NaN, , 1]
          .sort(function(a, b) {
            // Try to put undefineds first - should not succeed.
            if (a === undefined) return b === undefined ? 0 : -1;
            if (b === undefined) return 1;
            // Reverse order of ususal sort.
            a = String(a);
            b = String(b);
            if (a > b) return -1;
            if (b > a) return 1;
            return 0;
          }).map(String).join();
    `,
    expected: 'z,null,aa,a,NaN,5,10,1,undefined,,',
  },
  {
    name: 'Array.prototype.splice()',
    src: `
      var a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
      var s = a.splice();
      a.length === 6 && s.length === 0 && String(a) + ':' + String(s);
    `,
    expected: 'foo,bar,baz,,quux,quuux:',
  },
  {
    name: 'Array.prototype.splice(-)',
    src: `
      var a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
      var s = a.splice(-2);
      a.length === 4 && s.length === 2 && String(a) + ':' + String(s);
    `,
    expected: 'foo,bar,baz,:quux,quuux',
  },
  {
    name: 'Array.prototype.splice(+, +, ...)',
    src: `
      var a = ['foo', 'bar', 'baz', , 'quux', 'quuux'];
      var s = a.splice(1, 3, 'bletch');
      a.length === 4 && s.length === 3 && String(a) + ':' + String(s);
    `,
    expected: 'foo,bletch,quux,quuux:bar,baz,',
  },
  {
    name: 'Array.prototype.splice.call(array-like, 0, large, ...)',
    src: `
      var o = {
        0: 'foo', 1: 'bar', 2: 'baz', 4: 'quux', 5: 'quuux', length: 6
      };
      var s = Array.prototype.splice.call(o, 0, 100, 'bletch');
      !Array.isArray(o) && o.length === 1 && Object.keys(o).length === 2 &&
      o[0] === 'bletch' &&
      Array.isArray(s) && s.length === 6 && !('3' in s) && String(s);
    `,
    expected: 'foo,bar,baz,,quux,quuux',
  },
  {
    name: 'Array.prototype.splice.call(huge array-like, -, -, many...)',
    src: `
      var o = {
        5000000000000000: 'foo', 5000000000000001: 'bar',
        5000000000000002: 'baz', 5000000000000004: 'quux',
        5000000000000005: 'quuux', length: 5000000000000006
      };
      var s = Array.prototype.splice.call(o, -2, -999, 'bletch', 'qux');
      !Array.isArray(o) && o.length === 5000000000000008 &&
          o[5000000000000004] === 'bletch' && o[5000000000000005] === 'qux' &&
          o[5000000000000006] === 'quux' && o[5000000000000007] === 'quuux' &&
          Array.isArray(s) && s.length === 0;
    `,
    expected: true,
  },
  {
    name: 'Array.prototype.toString cycle detection',
    src: `
      var a = [1, , 3];
      a[1] = a;
      a.toString();
      "Didn't crash!";
    `,
    expected: 'Didn\'t crash!',
  },
  {
    name: 'Array.prototype.toString.call(obj-w/join)',
    src: `Array.prototype.toString.apply({join: function() {return 'OK';}});`,
    expected: 'OK',
  },
  {
    name: 'Array.prototype.toString.call(array-like)',
    src: `Array.prototype.toString.apply({0: 'foo', 1: 'bar', length: 2});`,
    expected: '[object Object]',
  },
  {
    name: 'Array.prototype.unshift',
    src: `
      var a = [];
      a.unshift('foo') === 1 && a.unshift('bar') === 2 &&
          a.length === 2 && a[0] === 'bar' && a[1] === 'foo';
    `,
    expected: true,
  },
  {
    name: 'Array.prototype.unshift.call(array-like, ...)',
    src: `
      var o = {length: 0};
      Array.prototype.unshift.call(o, 'foo') === 1 &&
          Array.prototype.unshift.call(o, 'bar') === 2 &&
          o.length === 2 && o[0] === 'bar' && o[1] === 'foo';
    `,
    expected: true,
  },
  {
    name: 'Array.prototype.unshift.call(huge array-like, ...)',
    src: `
      var o = {length: 5000000000000000};
      var o = {length: 5000000000000000};
      Array.prototype.unshift.call(o, 'foo') === 5000000000000001 &&
          Array.prototype.push.call(o, 'bar') === 5000000000000002 &&
          o[5000000000000000] === 'bar' && o[5000000000000001] === 'foo' &&
          o.length === 5000000000000002
    `,
    // SKIP until more efficient unshift implementation available.
    /* expected: true */
  },

  /////////////////////////////////////////////////////////////////////////////
  // Boolean and Boolean.prototype
  {src: `Boolean(undefined);`, expected: false},
  {src: `Boolean(null);`, expected: false},
  {src: `Boolean(false);`, expected: false},
  {src: `Boolean(true);`, expected: true},
  {src: `Boolean(NaN);`, expected: false},
  {src: `Boolean(0);`, expected: false},
  {src: `Boolean(1);`, expected: true},
  {src: `Boolean('');`, expected: false},
  {src: `Boolean('foo');`, expected: true},
  {src: `Boolean({});`, expected: true},
  {src: `Boolean([]);`, expected: true},
  {src: `Boolean(function() {});`, expected: true},

  {src: `Boolean.prototype.toString();`, expected: 'false'},
  {src: `Boolean.prototype.toString.call(true);`, expected: 'true'},
  {src: `Boolean.prototype.toString.call(false);`, expected: 'false'},
  {
    name: 'Boolean.prototype.toString.call non-Boolean object',
    src: `
      try {
        Boolean.prototype.toString.call({});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {src: `Boolean.prototype.valueOf();`, expected: false},
  {src: `Boolean.prototype.valueOf.call(true);`, expected: true},
  {src: `Boolean.prototype.valueOf.call(false);`, expected: false},
  {
    name: 'Boolean.prototype.valueOf.call non-Boolean object',
    src: `
      try {
        Boolean.prototype.valueOf.call({});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },

  /////////////////////////////////////////////////////////////////////////////
  // Number and Number.prototype
  {src: `Number();`, expected: 0},
  {src: `Number(undefined);`, expected: NaN},
  {src: `Number(null);`, expected: 0},
  {src: `Number(true);`, expected: 1},
  {src: `Number(false);`, expected: 0},
  {src: `Number('42');`, expected: 42},
  {src: `Number('');`, expected: 0},
  {src: `Number({});`, expected: NaN},
  {src: `Number([]);`, expected: 0},
  {src: `Number([42]);`, expected: 42},
  {src: `Number([1,2,3]);`, expected: NaN},
  {src: `Number(function() {});`, expected: NaN},

  {
    name: 'Number.MAX_SAFE_INTEGER',
    src: `
      Number.MAX_SAFE_INTEGER + 1 === Math.pow(2, 53) &&
          Number.isSafeInteger(Number.MAX_SAFE_INTEGER) &&
          !Number.isSafeInteger(Number.MAX_SAFE_INTEGER + 1);
    `,
    expected: true,
  },
  {src: `Number.prototype.toString();`, expected: '0'},
  {src: `Number.prototype.toString.call(84);`, expected: '84'},
  {
    name: 'Number.prototype.toString.call non-Number object',
    src: `
      try {
        Number.prototype.toString.call({});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {src: `Number.prototype.valueOf();`, expected: 0},
  {src: `Number.prototype.valueOf.call(85);`, expected: 85},
  {
    name: 'Number.prototype.valueOf.call non-Number object',
    src: `
      try {
        Number.prototype.valueOf.call({});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },

  /////////////////////////////////////////////////////////////////////////////
  // String and String.prototype
  {src: `String();`, expected: ''},
  {src: `String(undefined);`, expected: 'undefined'},
  {src: `String(null);`, expected: 'null'},
  {src: `String(true);`, expected: 'true'},
  {src: `String(false);`, expected: 'false'},
  {src: `String(0);`, expected: '0'},
  {src: `String(-0);`, expected: '0'},
  {src: `String(Infinity);`, expected: 'Infinity'},
  {src: `String(-Infinity);`, expected: '-Infinity'},
  {src: `String(NaN);`, expected: 'NaN'},
  {src: `String({});`, expected: '[object Object]'},
  {src: `String([1, 2, 3,,5]);`, expected: '1,2,3,,5'},

  {
    name: 'String calls valueOf',
    src: `
      var o = Object.create(null);
      o.valueOf = function() {return 'OK';};
      String(o);
    `,
    expected: 'OK',
  },
  {
    name: 'String calling valueOf returns string',
    src: `
      var o = Object.create(null);
      o.valueOf = function() {return 42;};
      String(o);
    `,
    expected: '42',
  },
  {
    name: 'String calling valueOf throws',
    src: `
      var o = Object.create(null);
      o.valueOf = function() {return {};};
      try {
        String(o);
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'String calls toString',
    src: `
      var o = Object.create(null);
      o.valueOf = function() {return 'Whoops: called valueOf';};
      o.toString = function() {return 'OK';};
      String(o);
    `,
    expected: 'OK',
  },
  {
    name: 'String calling toString returns string',
    src: `
      var o = Object.create(null);
      o.valueOf = function() {return 42;};
      String(o);
    `,
    expected: '42',
  },
  {
    name: 'String calling toString throws',
    src: `
      var o = Object.create(null);
      o.valueOf = function() {return {};};
      o.toString = function() {return {};};
      try {
        String(o);
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {src: `String.prototype.length;`, expected: 0},
  {
    name: 'String.prototype.replace(string, string)',
    src: `'xxxx'.replace('xx', 'y');`,
    expected: 'yxx',
  },
  {
    name: 'String.prototype.replace(regexp, string)',
    src: `'xxxx'.replace(/(X)\\1/ig, 'y');`,
    expected: 'yy',
  },
  {
    name: 'String.prototype.replace(string, function)',
    src: `
      'xxxx'.replace('xx', function() {
           return '[' + Array.prototype.join.apply(arguments) + ']';
      });
    `,
    expected: '[xx,0,xxxx]xx',
  },
  {
    name: 'String.prototype.replace(regexp, function)',
    src: `
      'xxxx'.replace(/(X)\\1/ig, function() {
           return '[' + Array.prototype.join.apply(arguments) + ']';
      });
    `,
    expected: '[xx,x,0,xxxx][xx,x,2,xxxx]',
  },
  {
    name: 'String.prototype.search(string) not found',
    src: `'hello'.search('H')`,
    expected: -1,
  },
  {
    name: 'String.prototype.search(string) found',
    src: `'hello'.search('ll')`,
    expected: 2,
  },
  {
    name: 'String.prototype.search(regexp) not found',
    src: `'hello'.search(/H/)`,
    expected: -1,
  },
  {
    name: 'String.prototype.search(regexp) found',
    src: `'hello'.search(/(.)\\1/)`,
    expected: 2,
  },
  {src: `String.prototype.toString();`, expected: ''},
  {
    name: 'String.prototype.toString.call primitive',
    src: `String.prototype.toString.call('a string');`,
    expected: 'a string',
  },
  {
    name: 'String.prototype.toString.call non-String object',
    src: `
      try {
        String.prototype.toString.call({});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {src: `String.prototype.valueOf();`, expected: ''},
  {
    name: 'String.prototype.valueOf.call primitive',
    src: `String.prototype.valueOf.call('a string');`,
    expected: 'a string',
  },
  {
    name: 'String.prototype.valueOf.call non-String object',
    src: `
      try {
        String.prototype.valueOf.call({});
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },

  /////////////////////////////////////////////////////////////////////////////
  // RegExp
  {src: `new RegExp(undefined).source`, expected: '(?:)'},
  {src: `new RegExp(null).source`, expected: 'null'},
  {src: `new RegExp(true).source`, expected: 'true'},
  {src: `new RegExp(false).source`, expected: 'false'},
  {src: `new RegExp('').source`, expected: '(?:)'},
  {src: `new RegExp('foo').source`, expected: 'foo'},
  {src: `new RegExp('0').source`, expected: '0'},
  {src: `new RegExp({}).source`, expected: '[object Object]'},
  {src: `new RegExp([]).source`, expected: '(?:)'},

  {src: `RegExp(undefined).source`, expected: '(?:)'},
  {src: `RegExp(null).source`, expected: 'null'},
  {src: `RegExp(true).source`, expected: 'true'},
  {src: `RegExp(false).source`, expected: 'false'},
  {src: `RegExp('').source`, expected: '(?:)'},
  {src: `RegExp('foo').source`, expected: 'foo'},
  {src: `RegExp('0').source`, expected: '0'},
  {src: `RegExp({}).source`, expected: '[object Object]'},
  {src: `RegExp([]).source`, expected: '(?:)'},

  // TODO(ES6):
  // {src: `new RegExp('foo', '').flags`, expected: ''},
  // {src: `new RegExp('foo', 'g').flags`, expected: 'g'},
  // {src: `new RegExp('foo', 'i').flags`, expected: 'i'},
  // {src: `new RegExp('foo', 'gi').flags`, expected: 'gi'},
  // {src: `new RegExp('foo', 'm').flags`, expected: 'm'},
  // {src: `new RegExp('foo', 'gm').flags`, expected: 'gm'},
  // {src: `new RegExp('foo', 'im').flags`, expected: 'im'},
  // {src: `new RegExp('foo', 'gim').flags`, expected: 'gim'},

  {src: `new RegExp('foo', '').global`, expected: false},
  {src: `new RegExp('foo', 'g').global`, expected: true},
  {src: `new RegExp('foo', '').ignoreCase`, expected: false},
  {src: `new RegExp('foo', 'i').ignoreCase`, expected: true},
  {src: `new RegExp('foo', '').multiline`, expected: false},
  {src: `new RegExp('foo', 'm').multiline`, expected: true},

  {
    name: "new RegExp('', 'x') throws",
    src: `
      try {
        new RegExp('', 'x');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'SyntaxError',
  },
  {
    name: "new RegExp('', 'gg') throws",
    src: `
      try {
        new RegExp('', 'gg');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'SyntaxError',
  },

  // Check behaviour of RegExp when called with and without new, when
  // pattern is itself a RegExp, and flags are or are not supplied.
  {src: `var re = /foo/; new RegExp(re) === re;`, expected: false},
  {src: `var re = /foo/; RegExp(re) === re;`, expected: true},
  {src: `var re = /foo/; RegExp(re, 'm') === re;`, expected: false},
  {src: `var re = /foo/m; RegExp(re, 'm') === re;`, expected: false},
  {src: `var re = /foo/m; RegExp(re) === re;`, expected: true},
  {
    name: 'RegExp called as function checks .constructor',
    src: `
      function SubClass() {};
      Object.setPrototypeOf(SubClass, RegExp);
      Object.setPrototypeOf(SubClass.prototype, RegExp.prototype);
      var re = /foo/;
      re.constructor = SubClass;
      RegExp(re) === re;
    `,
    expected: false,
  },
  // TODO(ES6):
  // {src: `var re = /foo/m; RegExp(re, 'i').flags;`, expected: 'i'},
  {src: `var re = /foo/m; RegExp(re, 'i').multiline;`, expected: false},
  {src: `var re = /foo/m; RegExp(re, 'i').ignoreCase;`, expected: true},


  // Check behaviour of RegExp.prototype methods.
  {
    name: 'RegExp.prototype.exec.call(undefined) throws',
    src: `
      try {
        RegExp.prototype.exec.call(undefined, 'foo');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'RegExp.prototype.exec.call(non-regexp) throws',
    src: `
      try {
        RegExp.prototype.exec.call({}, 'foo');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {src: `/undefined/.exec(undefined).length;`, expected: 1},
  {src: `/null/.exec(null).length;`, expected: 1},
  {
    name: 'RegExp.prototype.test.call(undefined) throws',
    src: `
      try {
        RegExp.prototype.test.call(undefined);
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError'
  },
  {
    name: 'RegExp.prototype.test.call(/* non-regexp */) throws',
    src: `
      try {
        RegExp.Prototype.test.call({}, 'foo');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },

  /////////////////////////////////////////////////////////////////////////////
  // Error and Error.prototype (and all the other native error types too)
  {
    name: 'new Error has .stack',
    src: `
      // Use eval to make parsing .stack easier.
      var e = eval('new Error;');
      var lines = e.stack.split('\\n');
      lines[0].trim();
    `,
    expected: 'at "new Error;" 1:1',
  },
  {
    name: 'thrown Error has .stack',
    src: `
      try {
        (function buggy() {1 instanceof 2;})();
      } catch (e) {
        var lines = e.stack.split('\\n');
      }
      lines[0].trim();
    `,
    expected: 'at buggy 1:19',
  },
  {
    name: 'Error .stack correctly reports anonymous function',
    src: `
      // Use eval to make parsing .stack easier.
      var e = eval('(function() {return new Error;})()');
      var lines = e.stack.split('\\n');
      lines[0].trim();
    `,
    expected: 'at anonymous function 1:20',
  },
  // Bug #241.
  {
    name: 'Error .stack correctly blames MemberExpression',
    src: `
      function foo() {
        switch (1) {
          case 1:
            return undefined.hasNoProperties;
        }
      }
      try {
        foo();
      } catch (e) {
        var lines = e.stack.split('\\n');
      }
      lines[0].trim();
    `,
    expected: 'at foo 4:20',
  },
  {
    name: 'Error .stack correctly blames Identifier',
    src: `
      function foo() {
        return undefinedVariable;
      }
      try {
        foo();
      } catch (e) {
        var lines = e.stack.split('\\n');
      }
      lines[0].trim();
    `,
    expected: 'at foo 2:16',
  },

  /////////////////////////////////////////////////////////////////////////////
  // JSON
  {
    name: 'JSON.parse(undefined) throws',
    src: `
      try {
        JSON.parse(undefined);
      } catch (e) {
        e.name;
      }
    `,
    expected: 'SyntaxError',
  },
  {src: `JSON.parse(null);`, expected: null},
  {src: `JSON.parse(true);`, expected: true},
  {src: `JSON.parse(false);`, expected: false},
  {src: `JSON.parse(42);`, expected: 42},
  {
    name: "JSON.parse('') throws",
    src: `
      try {
        JSON.parse('');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'SyntaxError',
  },
  {
    name: 'JSON.parse([]) throws',
    src: `
      try {
        JSON.parse([]);  // Equivalent to JSON.parse('');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'SyntaxError',
  },
  {
    name: 'JSON.parse({}) throws',
    src: `
      try {
        JSON.parse({});  // Equivalent to JSON.parse('[object Object]');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'SyntaxError',
  },

  {src: `JSON.stringify(undefined);`, expected: undefined},
  {src: `JSON.stringify(null);`, expected: 'null'},
  {src: `JSON.stringify(true);`, expected: 'true'},
  {src: `JSON.stringify(false);`, expected: 'false'},
  {src: `JSON.stringify(42);`, expected: '42'},
  {src: `JSON.stringify('string');`, expected: '"string"'},
  {src: `JSON.stringify([1,2,,4]);`, expected: '[1,2,null,4]'},
  {
    name: 'JSON.stringify({...})',
    src: `
      JSON.stringify({
          string: 'foo', number: 42, true: true, false: false, null: null,
          object: {obj: {}, arr: []}, array: [{}, []] });
    `,
    expected: '{"string":"foo","number":42,"true":true,"false":false,' +
        '"null":null,"object":{"obj":{},"arr":[]},"array":[{},[]]}',
  },
  {src: `JSON.stringify(function(){});`, expected: undefined},
  {src: `JSON.stringify([function(){}]);`, expected: '[null]'},
  {src: `JSON.stringify({f: function(){}});`, expected: '{}'},
  {
    name: 'JSON.stringify({...}, [/* filter array */])',
    src: `
      JSON.stringify({
          string: 'foo', number: 42, true: true, false: false, null: null,
          object: {obj: {}, arr: []}, array: [{}, []] },
          ['string', 'number']);
    `,
    expected: '{"string":"foo","number":42}',
  },
  {
    name: 'JSON.stringify({...}, [...], /* space number */)',
    src: `
      JSON.stringify({
          string: 'foo', number: 42, true: true, false: false, null: null,
          object: {obj: {}, arr: []}, array: [{}, []] },
          ['string', 'number'], 2);
    `,
    expected: '{\n  "string": "foo",\n  "number": 42\n}',
  },
  {
    name: 'JSON.stringify({...}, [...], /* space  string */)',
    src: `
      JSON.stringify({
          string: 'foo', number: 42, true: true, false: false, null: null,
          object: {obj: {}, arr: []}, array: [{}, []] },
          ['string', 'number'], '--');
    `,
    expected: '{\n--"string": "foo",\n--"number": 42\n}',
  },
  {
    name: 'JSON.stringify ignores nonenumerable properties',
    src: `
      var obj = {e: 'enumerable', ne: 'nonenumerable'};
      Object.defineProperty(obj, 'ne', {enumerable: false});
      JSON.stringify(obj);
    `,
    expected: '{"e":"enumerable"}',
  },
  {
    name: 'JSON.stringify ignores inherited properties',
    src: `JSON.stringify(Object.create({foo: 'bar'}));`,
    expected: '{}',
  },
  {
    name: 'JSON.stringify throws when value is cyclic',
    src: `
      var obj = {};
      obj.circular = obj;
      try {
        JSON.stringify(obj);
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },

  /////////////////////////////////////////////////////////////////////////////
  // Other built-in functions
  {
    name: 'decodeURI throws',
    src: `
      try {
        decodeURI('%xy');
      } catch (e) {
        e.name;
      }
    `,
    expected: 'URIError',
  },

  /////////////////////////////////////////////////////////////////////////////
  // WeakMap
  {
    name: 'WeakMap',
    src: `
      var w = new WeakMap;
      var p = {};
      var o = Object.create(p);
      var fails = 0;
      !w.has(p) || fails++;
      !w.delete(p) || fails++;
      w.set(o, 'o') === w || fails++;
      w.get(o) === 'o' || fails++;
      w.get(p) === undefined || fails++;
      w.has(o) || fails++;
      w.delete(o) || fails++;
      !w.has(o) || fails++;
      fails;
    `,
    expected: 0,
  },
  {
    name: 'WeakMap.prototype methods reject non-WeakMap this',
    src: `
      var w = new WeakMap;
      var fails = 0;
      function expectError(method, thisVal, args) {
        try {
          w[method].apply(thisVal, args);
          fails++;
        } catch (e) {
          if (e.name !== 'TypeError') fails++;
        }
      }
      var methods = ['delete', 'get', 'has', 'set'];
      var values = [null, undefined, true, false, 0, 42, '', 'hi'];
      for (var i = 0; i < methods.length; i++) {
        var method = methods[i];
        for (var j = 0; j < values.length; j++) {
          var value = values[j];
          expectError(method, value, [{}]); // Can't call method on non-WeakMap.
          expectError(method, w, [value]); // Can't store non-object in WeakMap.
        }
        // WeakMap.prototype is an ordinary object, not a WeakMap.
        expectError(method, WeakMap.prototpye, [{}]);
      }
      fails;
    `,
    expected: 0,
  },
  {
    name: 'WeakMap',
    src: `
      var w = new WeakMap;
      var p = {};
      var o = Object.create(p);
      var fails = 0;
      !w.has(p) || fails++;
      !w.delete(p) || fails++;
      w.set(o, 'o') === w || fails++;
      w.get(o) === 'o' || fails++;
      w.get(p) === undefined || fails++;
      w.has(o) || fails++;
      w.delete(o) || fails++;
      !w.has(o) || fails++;
      fails;
    `,
    expected: 0,
  },

  /////////////////////////////////////////////////////////////////////////////
  // Thread and Thread.prototype:
  // TODO(cpallen): change .eval to .program when test harness no
  //     longer relies on eval.
  {
    name: 'Thread.callers() ownership',
    src: `
      var owner = {};
      setPerms(owner);
      var callers = Thread.callers();
      Object.getOwnerOf(callers) === owner &&
          Object.getOwnerOf(callers[0]) === owner;
    `,
    expected: true,
  },
  {
    name: 'Thread.callers()[0].eval',
    src: `Thread.callers()[0].eval`,
    expected: 'Thread.callers()[0].eval',
  },
  {
    name: 'Thread.callers()[0].line & .col',
    src: `var frame = Thread.callers()[0]; frame.line + "," + frame.col;`,
    expected: '1,13',
  },
  {
    name: 'Thread.callers()[/* last */].program',
    src: `
      var callers = Thread.callers();
      typeof callers[callers.length - 1].program;
    `,
    expected: 'string',
  },
  {
    name: 'Thread.callers()[0].callerPerms',
    src: `
      CC.root.name = 'root';
      var user = {name: 'user'};
      function f() {
        return Thread.callers()[0].callerPerms.name;
      }
      setPerms(user);
      f();
    `,
    expected: 'user',
  },
  // Time limit tests.  Actual enforcement is tested in
  // interpreter_tests.js; this is just checking behaviour of get/set
  // builtins.
  {
    name: 'Thread.prototype.getTimeLimit() initially 0',
    src: `Thread.current().getTimeLimit();`,
    expected: 0,
  },
  {
    name: 'Thread.prototype.setTimeLimit()',
    src: `
      Thread.current().setTimeLimit(1000);
      Thread.current().getTimeLimit();
    `,
    expected: 1000,
  },
  {
    name: 'Thread.prototype.setTimeLimit(...)',
    src: `
      Thread.current().setTimeLimit(1000);
      Thread.current().getTimeLimit();
    `,
    expected: 1000,
  },
  // Check invalid time limits are rejected.
  {
    name: 'Thread.prototype.setTimeLimit(/* invalid value */) throws',
    src: `
      Thread.current().setTimeLimit(1000);
      var invalid = [0, 1001, NaN, 'foo', true, {}];
      var failures = [];
      for (var i = 0; i < invalid.length; i++) {
        try {
          Thread.current().setTimeLimit(invalid[i]);
          failures.push(invalid[i]);
        } catch (e) {
        }
      }
      (failures.length === 0) ? 'OK' : String(failures);
    `,
    expected: 'OK',
  },

  /////////////////////////////////////////////////////////////////////////////
  // Permissions system:
  {
    name: 'perms returns root',
    src: `perms() === CC.root;`,
    expected: true,
  },
  {
    name: 'setPerms',
    src: `
      CC.root.name = 'Root';
      var bob = {};
      bob.name = 'Bob';
      var r = '';
      r += perms().name;
      (function() {
        setPerms(bob);
        r += perms().name;
        // Perms revert at end of scope.
      })();
      r += perms().name;
      r;
    `,
    expected: 'RootBobRoot',
  },
  {
    name: 'getOwnerOf',
    src: `
      var bob = {};
      var roots = {};
      setPerms(bob);
      var bobs = new Object;
      Object.getOwnerOf(Object) === CC.root &&
      Object.getOwnerOf(roots) === CC.root &&
      Object.getOwnerOf(bobs) === bob
    `,
    expected: true,
  },
  {
    name: 'setOwnerOf',
    src: `
      var bob = {};
      var obj = {};
      Object.setOwnerOf(obj, bob) === obj && Object.getOwnerOf(obj) === bob;
    `,
    expected: true,
  },

  /////////////////////////////////////////////////////////////////////////////
  // Other tests:
  {
    name: 'new hack',
    src: `(new 'Array.prototype.push') === Array.prototype.push`,
    expected: true,
  },
  {
    name: 'new hack with unkown builtin',
    src: `
      try {
        new 'nonexistent-builtin-name';
      } catch (e) {
        e.name;
      }
    `,
    expected: 'ReferenceError',
  },
  {
    name: 'new hack with other than string literal',
    src: `
      try {
        var builtin = 'Object.prototype';
        new builtin;
      } catch (e) {
        e.name;
      }
    `,
    expected: 'TypeError',
  },
  {
    name: 'ES6 causes syntax errors',
    src: `
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
      var failed = [];
      for (var i = 0; i < tests.length; i++) {
        try {
          eval(tests[i]);
          failed.push("Didn't throw: " + tests[i]);
        } catch (e) {
          if (e.name !== 'SyntaxError') {
            failed.push('Wrong error: ' + tests[i] + ' threw ' + String(e));
          }
        }
      }
      failed.length ? failed.join('\\n') : 'OK';
    `,
    expected: 'OK',
  },
  {
    name: 'Strict mode syntax errors',
    src: `
      var tests = [
        // With statement.
        'var o = {foo: 42}; var f = function() {with (o) {foo;}};',
        // Binding eval in global scope, or arguments in a function.
        'var eval = "rebinding eval?!?";',
        '(function() {arguments = undefined;});',
        // Duplicate argument names.
        '(function(a, a) {});',
        "new Function('a', 'a', '');",
        // Octal numeric literals.
        '0777;',
        // Delete of unqualified or undeclared identifier.
        'var foo; delete foo;',
        'delete foo;',
      ];
      var failed = [];
      for (var i = 0; i < tests.length; i++) {
        try {
          eval(tests[i]);
          failed.push("Didn't throw: " + tests[i]);
        } catch (e) {
          if (e.name !== 'SyntaxError') {
            failed.push('Wrong error: ' + tests[i] + ' threw ' + String(e));
          }
        }
      }
      failed.length ? failed.join('\\n') : 'OK';
    `,
    expected: 'OK',
  },
  {
    name: 'Stack overflow errors',
    src: `
      try {
        (function f() {f();})();
      } catch (e) {
        e.name;
      }
    `,
    options: {stackLimit: 100},
    expected: 'RangeError',
  },
  {
    name: 'Minimum stack depth limit',
    src: `
      function f() {
        try {
          return f() + 1;
        } catch (e) {
          return 1;
        }
      }
      var limit = f();
      limit > 100 ? 'OK' : limit;
    `,
    options: {stackLimit: 1000},
    expected: 'OK',
  },
];
