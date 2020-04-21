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
 * implementation up to JavaScript 5.1 (or close to it).
 * @author fraser@google.com (Neil Fraser)
 */

// Global functions.
var parseInt = new 'parseInt';
var parseFloat = new 'parseFloat';
var isNaN = new 'isNaN';
var isFinite = new 'isFinite';


// Global objects.
var Object = new 'Object';
var Function = new 'Function';
var Array = new 'Array';
var String = new 'String';
var Boolean = new 'Boolean';
var Number = new 'Number';
var Date = new 'Date';
var RegExp = new 'RegExp';
var Error = new 'Error';
var EvalError = new 'EvalError';
var RangeError = new 'RangeError';
var ReferenceError = new 'ReferenceError';
var SyntaxError = new 'SyntaxError';
var TypeError = new 'TypeError';
var URIError = new 'URIError';
var Math = {};
var JSON = {};

// Bootstrap the defineProperty function in two steps.
Object.defineProperty = new 'Object.defineProperty';
Object.defineProperty(Object, 'defineProperty', {enumerable: false});

(function() {
  // Hack to work around restriction that the 'new hack' only works on
  // literal strings.  Note name must not contain any double quotes or
  // backslashes, because we have no easy way to escape them yet!
  var builtin = function(name) {
    return eval('new "' + name + '"');
  };

  var classes = ['Object', 'Function', 'Array', 'String', 'Boolean', 'Number',
                 'Date', 'RegExp', 'Error', 'EvalError', 'RangeError',
                 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError'];
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
  // Configure Error and its subclasses.
  var errors = ['Error', 'EvalError', 'RangeError', 'ReferenceError',
                'SyntaxError', 'TypeError', 'URIError'];
  for (var i = 0; i < errors.length; i++) {
    var constructor = builtin(errors[i]);
    Object.defineProperty(constructor.prototype, 'name', {
                          configurable: true,
                          enumerable: false,
                          writable: true,
                          value: errors[i]
                          });
  }
  Object.defineProperty(Error.prototype, 'message', {
                        configurable: true,
                        enumerable: false,
                        writable: true,
                        value: ''
                        });

  // Struct is a list of tuples:
  //     [Object, 'Object', [static methods], [instance methods]]

  var struct = [
    [Object, 'Object',
     ['create', 'getOwnPropertyNames', 'keys', 'getOwnPropertyDescriptor',
      'getPrototypeOf', 'isExtensible', 'preventExtensions'],
     ['toString', 'toLocaleString', 'valueOf', 'hasOwnProperty',
      'propertyIsEnumerable', 'isPrototypeOf']],
    [Function, 'Function',
     [],
     ['apply', 'bind', 'call', 'toString']],
    [Array, 'Array',
     ['isArray'],
     ['toString', 'pop', 'push', 'shift', 'unshift', 'reverse', 'splice',
      'slice', 'concat', 'indexOf', 'lastIndexOf']],
    [String, 'String',
     ['fromCharCode'],
     ['trim', 'toLowerCase', 'toUpperCase', 'toLocaleLowerCase',
      'toLocaleUpperCase', 'charAt', 'charCodeAt', 'substring', 'slice',
      'substr', 'indexOf', 'lastIndexOf', 'concat', 'localeCompare', 'replace',
      'split', 'match', 'search', 'replace', 'toString', 'valueOf']],
    [Boolean, 'Boolean',
     [],
     ['toString', 'valueOf']],
    [Number, 'Number',
     [],
     ['toExponential', 'toFixed', 'toLocaleString', 'toPrecision', 'toString',
      'valueOf']],
    [Date, 'Date',
     ['now', 'parse', 'UTC'],
     ['toString', 'getDate', 'getDay', 'getFullYear', 'getHours',
      'getMilliseconds', 'getMinutes', 'getMonth', 'getSeconds', 'getTime',
      'getTimezoneOffset', 'getUTCDate', 'getUTCDay', 'getUTCFullYear',
      'getUTCHours', 'getUTCMilliseconds', 'getUTCMinutes', 'getUTCMonth',
      'getUTCSeconds', 'getYear', 'setDate', 'setFullYear', 'setHours',
      'setMilliseconds', 'setMinutes', 'setMonth', 'setSeconds', 'setTime',
      'setUTCDate', 'setUTCFullYear', 'setUTCHours', 'setUTCMilliseconds',
      'setUTCMinutes', 'setUTCMonth', 'setUTCSeconds', 'setYear',
      'toDateString', 'toISOString', 'toJSON', 'toGMTString', 'toTimeString',
      'toUTCString', 'toLocaleDateString', 'toLocaleString',
      'toLocaleTimeString']],
    [RegExp, 'RegExp',
     [],
     ['toString', 'test', 'exec']],
    [Error, 'Error',
     [],
     ['toString']],
    [Math, 'Math',
     ['abs', 'acos', 'asin', 'atan', 'atan2', 'ceil', 'cos', 'exp', 'floor',
      'log', 'max', 'min', 'pow', 'random', 'round', 'sin', 'sqrt', 'tan'],
     []],
    [JSON, 'JSON',
     ['parse', 'stringify'],
     []]
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

Object.defineProperty(Number, 'MAX_VALUE', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: 1.7976931348623157e+308
                      });
Object.defineProperty(Number, 'MIN_VALUE', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: 5e-324
                      });
Object.defineProperty(Number, 'NaN', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: NaN
                      });
Object.defineProperty(Number, 'NEGATIVE_INFINITY', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: -Infinity
                      });
Object.defineProperty(Number, 'POSITIVE_INFINITY', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: Infinity
                      });

Object.defineProperty(Math, 'E', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: 2.718281828459045
                      });
Object.defineProperty(Math, 'LN2', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: 0.6931471805599453
                      });
Object.defineProperty(Math, 'LN10', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: 2.302585092994046
                      });
Object.defineProperty(Math, 'LOG2E', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: 1.4426950408889634
                      });
Object.defineProperty(Math, 'LOG10E', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: 0.4342944819032518
                      });
Object.defineProperty(Math, 'PI', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: 3.141592653589793
                      });
Object.defineProperty(Math, 'SQRT1_2', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: 0.7071067811865476
                      });
Object.defineProperty(Math, 'SQRT2', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: 1.4142135623730951
                      });

Object.defineProperty(RegExp.prototype, 'global', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: undefined
                      });
Object.defineProperty(RegExp.prototype, 'ignoreCase', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: undefined
                      });
Object.defineProperty(RegExp.prototype, 'multiline', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: undefined
                      });
Object.defineProperty(RegExp.prototype, 'source', {
                      configurable: false,
                      enumerable: false,
                      writable: false,
                      value: '(?:)'
                      });

///////////////////////////////////////////////////////////////////////////////
// Array.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

(function() {
  // For cycle detection in array to string and error conversion; see
  // spec bug github.com/tc39/ecma262/issues/289.
  var visited = [];

  Object.defineProperty(Array.prototype, 'join', {value: function(separator) {
    // This implements Array.prototype.join from ES5 §15.4.4.5, with
    // the addition of cycle detection as discussed in
    // https://github.com/tc39/ecma262/issues/289.
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
      var len = this.length >>> 0;
      var sep = (separator === undefined) ? ',' : String(separator);
      if (!len) {
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
  }, configurable: true, writable: true});
})();

///////////////////////////////////////////////////////////////////////////////
// String.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

// String.prototype.length is always 0.
Object.defineProperty(String.prototype, 'length', {value: 0});
