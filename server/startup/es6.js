/**
 * @license
 * Code City: Startup code.
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
 * @fileoverview Polyfills to bring the server's partial JavaScript
 * implementation beyond JavaScript 5.1.
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
    [Number, 'Number', ['isFinite', 'isNaN', 'isSafeInteger'], []],
    [Math, 'Math', ['sign', 'trunc'], []],
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
// Array.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/find
Object.defineProperty(Array.prototype, 'find', {value: function(callback/*, thisArg*/) {
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.find called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback + ', not type function');
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
}, configurable: true, writable: true});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
Object.defineProperty(Array.prototype, 'findIndex', {value: function(callback/*, thisArg*/) {
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.findIndex called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback + ', not type function');
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
}, configurable: true, writable: true});

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

  Object.defineProperty(Array.prototype, 'join', {
    configurable: true, writable: true,
    value: function(separator) {
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
    }
  });
})();

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
     // Fortunately 2**53 is also safe as long as you dont' increment it!:
     value: Math.pow(2, 53) - 1 });
