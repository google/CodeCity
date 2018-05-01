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
  var classes = ['WeakMap'];
  // Prototypes of global constructors.
  for (var i = 0; i < classes.length; i++) {
    var constructor = new classes[i];
    Object.defineProperty(constructor, 'prototype', {
                          configurable: false,
                          enumerable: false,
                          writable: false,
                          value: new (classes[i] + '.prototype')
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
           value: new (objName + '.' + member)});
    }
    for (var j = 0; j < instanceMethods.length; j++) {
      var member = instanceMethods[j];
      Object.defineProperty(obj.prototype, member,
          {configurable: true,
           enumerable: false,
           writable: true,
           value: new (objName + '.prototype.' + member)});
    }
  }
})();

///////////////////////////////////////////////////////////////////////////////
// Array.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

(function() {
  function toInteger(value) {
    var number = Number(value);
    if (isNaN(number)) {
      return 0;
    } else if (number === 0 || number === Infinity || number === -Infinity) {
      return number;
    }
    return Math.trunc(number);
  }

  function toLength(value) {
    var len = toInteger(value);
    if (len <= 0) return 0;
    return Math.min(len, Number.MAX_SAFE_INTEGER);  // Handles len === Infinity.
  };

  // For cycle detection in array to string and error conversion; see
  // spec bug github.com/tc39/ecma262/issues/289.
  // BUG(cpcallen): This should be per-thread.
  var visited = [];

  Object.defineProperty(Array.prototype, 'join', {
    configurable: true, writable: true,
    value: function(separator) {
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
        if (len === 0) {
          return '';
        }
        var r = '';
        for (var k = 0; k < len; k++) {
          if (k > 0) r += sep;
          var element = this[k];
          if (element !== undefined && element !== null) {
            r += String(element);
          }
        }
        return r;
      } finally {
        if (isObj) visited.pop();
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
