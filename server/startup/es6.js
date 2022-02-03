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
 * @fileoverview Polyfills to bring the server's partial JavaScript
 * implementation to include some features of ECMAScript 2015 (ES6).
 * @author fraser@google.com (Neil Fraser)
 */

// Global objects.
var WeakMap = new 'WeakMap';

(function() {
  // Hack to work around restriction that the 'new hack' only works on
  // literal strings.  Note name must not contain any double quotes or
  // backslashes, because we have no easy way to escape them yet!
  var builtin = function(name) {
    return eval('new "' + name + '"');
  };

  var classes = ['WeakMap'];
  // Prototypes of global constructors.
  for (var i = 0; i < classes.length; i++) {
    var constructor = builtin(classes[i]);
    Object.defineProperty(constructor, 'prototype', {
                          configurable: false,
                          enumerable: false,
                          writable: false,
                          value: builtin(classes[i] + '.prototype')
                          });
    Object.defineProperty(constructor.prototype, 'constructor', {
                          configurable: true,
                          enumerable: false,
                          writable: true,
                          value: constructor
                          });
  }

  // Struct is a list of tuples:
  //     [Object, 'Object', [static methods], [instance methods]]

  var struct = [
    [Object, 'Object', ['is', 'setPrototypeOf'], []],
    [String, 'String', [], ['endsWith', 'includes', 'repeat', 'startsWith']],
    [Number, 'Number', ['isFinite', 'isInteger', 'isNaN', 'isSafeInteger'], []],
    [Math, 'Math', ['acosh', 'asinh', 'atanh', 'cbrt', 'clz32', 'cosh', 'expm1',
                    'fround', 'hypot', 'imul', 'log10', 'log1p', 'log2', 'sign',
                    'sinh', 'tanh', 'trunc'], []],
    [WeakMap, 'WeakMap', [], ['delete', 'get', 'has', 'set']],
  ];
  for (var i = 0; i < struct.length; i++) {
    var obj = struct[i][0];
    var objName = struct[i][1];
    var staticMethods = struct[i][2];
    var instanceMethods = struct[i][3];
    for (var j = 0; j < staticMethods.length; j++) {
      var member = staticMethods[j];
      Object.defineProperty(obj, member,
          {configurable: true,
           enumerable: false,
           writable: true,
           value: builtin(objName + '.' + member)});
    }
    for (var j = 0; j < instanceMethods.length; j++) {
      var member = instanceMethods[j];
      Object.defineProperty(obj.prototype, member,
          {configurable: true,
           enumerable: false,
           writable: true,
           value: builtin(objName + '.prototype.' + member)});
    }
  }
})();

///////////////////////////////////////////////////////////////////////////////
// Object constructor polyfills
///////////////////////////////////////////////////////////////////////////////

Object.assign = function assign(target, varArgs) {
  // The length property of the assign method is 2.
  if (target === null || target === undefined) {
    throw new TypeError('Cannot convert undefined or null to object');
  }
  target = Object(target);

  for (var i = 1; i < arguments.length; i++) {
    var src = arguments[i];
    if (src !== null && src !== undefined) {
      var keys = Object.keys(src);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        target[key] = src[key];
      }
    }
  }
  return target;
};
Object.defineProperty(Array, 'assign', {enumerable: false});


///////////////////////////////////////////////////////////////////////////////
// Array constructor polyfills
///////////////////////////////////////////////////////////////////////////////

Array.from = function(arrayLike/*, mapFn, thisArg */) {
  // Polyfill adapted from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
  // The length property of the from method is 1.  
  var isCallable = function (fn) {
    return typeof fn === 'function' || Object.prototype.toString.call(fn) === '[object Function]';
  };
  var toInteger = function (value) {
    var number = Number(value);
    if (isNaN(number)) { return 0; }
    if (number === 0 || !isFinite(number)) { return number; }
    return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
  };
  var toLength = function (value) {
    var len = toInteger(value);
    return Math.min(Math.max(len, 0), Number.MAX_SAFE_INTEGER);
  };

  // 1. Let C be the this value.
  var C = this;

  // 2. Let items be ToObject(arrayLike).
  var items = Object(arrayLike);

  // 3. ReturnIfAbrupt(items).
  if (arrayLike == null) {
    throw new TypeError('Array.from requires an array-like object - not null or undefined');
  }

  // 4. If mapfn is undefined, then let mapping be false.
  var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
  var T;
  if (typeof mapFn !== 'undefined') {
    // 5. else
    // 5. a If IsCallable(mapfn) is false, throw a TypeError exception.
    if (!isCallable(mapFn)) {
      throw new TypeError('Array.from: when provided, the second argument must be a function');
    }

    // 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
    if (arguments.length > 2) {
      T = arguments[2];
    }
  }

  // 10. Let lenValue be Get(items, "length").
  // 11. Let len be ToLength(lenValue).
  var len = toLength(items.length);

  // 13. If IsConstructor(C) is true, then
  // 13. a. Let A be the result of calling the [[Construct]] internal method
  // of C with an argument list containing the single item len.
  // 14. a. Else, Let A be ArrayCreate(len).
  var A = isCallable(C) ? Object(new C(len)) : new Array(len);

  // 16. Let k be 0.
  var k = 0;
  // 17. Repeat, while k < len… (also steps a - h)
  var kValue;
  while (k < len) {
    kValue = items[k];
    if (mapFn) {
      A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
    } else {
      A[k] = kValue;
    }
    k += 1;
  }
  // 18. Let putStatus be Put(A, "length", len, true).
  A.length = len;
  // 20. Return A.
  return A;
};
Object.defineProperty(Array, 'from', {enumerable: false});

///////////////////////////////////////////////////////////////////////////////
// Array.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

Array.prototype.find = function find(callback/*, thisArg*/) {
  // Polyfill copied from:
  // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/find
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.find called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback +
                        ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var thisArg = arguments[1];
  for (var k = 0; k < len; k++) {
    var kValue = o[k];
    if (callback.call(thisArg, kValue, k, o)) {
      return kValue;
    }
  }
  return undefined;
};
Object.defineProperty(Array.prototype, 'find', {enumerable: false});

Array.prototype.findIndex = function findIndex(callback/*, thisArg*/) {
  // Polyfill copied from:
  // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.findIndex called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback +
                        ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var thisArg = arguments[1];
  for (var k = 0; k < len; k++) {
    var kValue = o[k];
    if (callback.call(thisArg, kValue, k, o)) {
      return k;
    }
  }
  return -1;
};
Object.defineProperty(Array.prototype, 'findIndex', {enumerable: false});

(function() {
  function toInteger(value) {
    var number = Number(value);
    if (isNaN(number)) {
      return 0;
    } else if (number === 0 || !isFinite(number)) {
      return number;
    }
    return Math.trunc(number);
  }

  function toLength(value) {
    var len = toInteger(value);
    if (len <= 0) {
      return 0;
    }
    return Math.min(len, Number.MAX_SAFE_INTEGER);  // Handles len === Infinity.
  }

  // For cycle detection in array to string and error conversion; see
  // spec bug github.com/tc39/ecma262/issues/289.
  var visited = [];

  Array.prototype.join = function join(separator) {
    // This implements Array.prototype.join from ES6 §22.1.3.12, with
    // the addition of cycle detection as discussed in
    // https://github.com/tc39/ecma262/issues/289.
    //
    // The only difference from the ES5 version of the spec is that
    // .length is normalised using the specification function
    // ToLength rather than ToUint32.
    //
    // Variable names reflect those in the spec.
    //
    // N.B. This function is defined in a closure!
    var isObj = (typeof this === 'object' || typeof this === 'function') &&
        this !== null;
    if (isObj) {
      if (visited.indexOf(this) !== -1) {
        return '';
      }
      visited.push(this);
    }
    try {
      // TODO(cpcallen): setPerms(callerPerms());
      var len = toLength(this.length);
      var sep = (separator === undefined) ? ',' : String(separator);
      if (!len) {
        return '';
      }
      var r = '';
      for (var k = 0; k < len; k++) {
        if (k > 0) {
          r += sep;
        }
        var element = this[k];
        if (element !== undefined && element !== null) {
          r += String(element);
        }
      }
      return r;
    } finally {
      if (isObj) {
        visited.pop();
      }
    }
  };
})();
Object.defineProperty(Array.prototype, 'join', {enumerable: false});

///////////////////////////////////////////////////////////////////////////////
// Number polyfills
///////////////////////////////////////////////////////////////////////////////

Object.defineProperty(Number, 'EPSILON',
    {configurable: false,
     enumerable: false,
     writable: false,
     value: Math.pow(2, -52)});

Object.defineProperty(Number, 'MAX_SAFE_INTEGER',
    {configurable: false,
     enumerable: false,
     writable: false,
     // Fortunately 2**53 is also safe as long as you don't increment it!:
     value: Math.pow(2, 53) - 1 });

Object.defineProperty(Number, 'MIN_SAFE_INTEGER',
    {configurable: false,
     enumerable: false,
     writable: false,
     value: -Number.MAX_SAFE_INTEGER});
