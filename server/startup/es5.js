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
 * implementation up to JavaScript 5.1 (or close to it).
 * @author fraser@google.com (Neil Fraser)
 */

// Global functions.
var parseInt = new 'parseInt';
var parseFloat = new 'parseFloat';
var isNaN = new 'isNaN';
var isFinite = new 'isFinite';
var escape = new 'escape';
var unescape = new 'unescape';
var decodeURI = new 'decodeURI';
var decodeURIComponent = new 'decodeURIComponent';
var encodeURI = new 'encodeURI';
var encodeURIComponent = new 'encodeURIComponent';
// As a special case, eval is not included in this list: it must be
// set in the global scope by the interpreter because binding eval in
// strict mode is illegal.


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
     ['getOwnPropertyNames', 'keys', 'getOwnPropertyDescriptor',
      'getPrototypeOf', 'isExtensible', 'preventExtensions'],
     ['toString', 'toLocaleString', 'valueOf', 'hasOwnProperty',
      'propertyIsEnumerable', 'isPrototypeOf']],
    [Function, 'Function',
     [],
     ['apply', 'bind', 'call', 'toString']],
    [Array, 'Array',
     ['isArray'],
     ['toString', 'pop', 'push', 'shift', 'unshift', 'reverse', 'splice', 'slice', 'concat', 'indexOf', 'lastIndexOf']],
    [String, 'String',
     ['fromCharCode'],
     ['trim', 'toLowerCase', 'toUpperCase', 'toLocaleLowerCase', 'toLocaleUpperCase', 'charAt', 'charCodeAt', 'substring', 'slice', 'substr', 'indexOf', 'lastIndexOf', 'concat', 'localeCompare', 'split', 'match', 'search', 'replace', 'toString', 'valueOf']],
    [Boolean, 'Boolean',
     [],
     ['toString', 'valueOf']],
    [Number, 'Number',
     [],
     ['toExponential', 'toFixed', 'toLocaleString', 'toPrecision', 'toString', 'valueOf']],
    [Date, 'Date',
     ['now', 'parse', 'UTC'],
     ['toString', 'getDate', 'getDay', 'getFullYear', 'getHours', 'getMilliseconds', 'getMinutes', 'getMonth', 'getSeconds', 'getTime', 'getTimezoneOffset', 'getUTCDate', 'getUTCDay', 'getUTCFullYear', 'getUTCHours', 'getUTCMilliseconds', 'getUTCMinutes', 'getUTCMonth', 'getUTCSeconds', 'getYear', 'setDate', 'setFullYear', 'setHours', 'setMilliseconds', 'setMinutes', 'setMonth', 'setSeconds', 'setTime', 'setUTCDate', 'setUTCFullYear', 'setUTCHours', 'setUTCMilliseconds', 'setUTCMinutes', 'setUTCMonth', 'setUTCSeconds', 'setYear', 'toDateString', 'toISOString', 'toJSON', 'toGMTString', 'toTimeString', 'toUTCString', 'toLocaleDateString', 'toLocaleString', 'toLocaleTimeString']],
    [RegExp, 'RegExp',
     [],
     ['toString', 'test', 'exec']],
    [Error, 'Error',
     [],
     ['toString']],
    [Math, 'Math',
     ['abs', 'acos', 'asin', 'atan', 'atan2', 'ceil', 'cos', 'exp', 'floor', 'log', 'max', 'min', 'pow', 'random', 'round', 'sin', 'sqrt', 'tan'],
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
// Object polyfills
///////////////////////////////////////////////////////////////////////////////

// Add a polyfill to handle create's second argument.
Object.defineProperty(Object, 'create', {value: function(proto, props) {
  var obj = (new 'Object.create')(proto);
  props && Object.defineProperties(obj, props);
  return obj;
}, configurable: true, writable: true});

Object.defineProperty(Object, 'defineProperties', {value: function(obj, props) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw new TypeError('Object.defineProperties called on type ' + typeof obj + ', not type object or function');
  }
  var keys = Object.keys(props);
  for (var i = 0; i < keys.length; i++) {
    Object.defineProperty(obj, keys[i], props[keys[i]]);
  }
  return obj;
}, configurable: true, writable: true});

///////////////////////////////////////////////////////////////////////////////
// Array.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/every
Object.defineProperty(Array.prototype, 'every', {value: function(callback/*, thisArg*/) {
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.every called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback + ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var thisArg = arguments[1];
  for (var k = 0; k < len; k++) {
    if (k in o && !callback.call(thisArg, o[k], k, o)) return false;
  }
  return true;
}, configurable: true, writable: true});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
Object.defineProperty(Array.prototype, 'filter', {value: function(callback/*, thisArg*/) {
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.filter called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback + ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var res = [];
  var thisArg = arguments[1];
  for (var i = 0; i < len; i++) {
    if (i in o) {
      var val = o[i];
      if (callback.call(thisArg, val, i, o)) res.push(val);
    }
  }
  return res;
}, configurable: true, writable: true});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
Object.defineProperty(Array.prototype, 'forEach', {value: function(callback/*, thisArg*/) {
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.forEach called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback + ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var thisArg = arguments[1];
  for (var k = 0; k < len; k++) {
    if (k in o) callback.call(thisArg, o[k], k, o);
  }
}, configurable: true, writable: true});

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

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/map
Object.defineProperty(Array.prototype, 'map', {value: function(callback/*, thisArg*/) {
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.map called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback + ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var A = new Array(len);
  var thisArg = arguments[1];
  for (var k = 0; k < len; k++) {
    if (k in o) A[k] = callback.call(thisArg, o[k], k, o);
  }
  return A;
}, configurable: true, writable: true});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
Object.defineProperty(Array.prototype, 'reduce', {value: function(callback /*, initialValue*/) {
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.reduce called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback + ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var k = 0;
  var value;
  if (arguments.length > 1) {
    value = arguments[1];
  } else {
    while (k < len && !(k in o)) k++;
    if (k >= len) {
      throw new TypeError('Reduce of empty array with no initial value');
    }
    value = o[k++];
  }
  for (; k < len; k++) {
    if (k in o) value = callback(value, o[k], k, o);
  }
  return value;
}, configurable: true, writable: true});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/ReduceRight
Object.defineProperty(Array.prototype, 'reduceRight', {value: function(callback /*, initialValue*/) {
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.reduceRight called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback + ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var k = len - 1;
  var value;
  if (arguments.length > 1) {
    value = arguments[1];
  } else {
    while (k >= 0 && !(k in o)) k--;
    if (k < 0) {
      throw new TypeError('Reduce of empty array with no initial value');
    }
    value = o[k--];
  }
  for (; k >= 0; k--) {
    if (k in o) value = callback(value, o[k], k, o);
  }
  return value;
}, configurable: true, writable: true});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/some
Object.defineProperty(Array.prototype, 'some', {value: function(callback/*, thisArg*/) {
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.some called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback + ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var thisArg = arguments[1];
  for (var i = 0; i < len; i++) {
    if (i in o && callback.call(thisArg, o[i], i, o)) {
      return true;
    }
  }
  return false;
}, configurable: true, writable: true});

Object.defineProperty(Array.prototype, 'sort', {value: function(opt_comp) {
  for (var i = 0; i < this.length; i++) {
    var changes = 0;
    for (var j = 0; j < this.length - i - 1; j++) {
      if (opt_comp ? + opt_comp(this[j], this[j + 1]) > 0 :
                     this[j] > this[j + 1]) {
        var swap = this[j];
        this[j] = this[j + 1];
        this[j + 1] = swap;
        changes++;
      }
    }
    if (!changes) break;
  }
  return this;
}, configurable: true, writable: true});

Object.defineProperty(Array.prototype, 'toLocaleString', {value: function() {
  var out = [];
  for (var i = 0; i < this.length; i++) {
    out[i] = (this[i] === null || this[i] === undefined) ?
        '' : this[i].toLocaleString();
  }
  return out.join(',');
}, configurable: true, writable: true});

///////////////////////////////////////////////////////////////////////////////
// String.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

// String.prototype.length is always 0.
Object.defineProperty(String.prototype, 'length', {value: 0});

// Polyfill to handle String.prototype.replace's second argument being
// a function.
Object.defineProperty(String.prototype, 'replace', {value: function(substr, newSubstr) {
  if (typeof newSubstr !== 'function') {
    // string.replace(string|regexp, string)
    return (new 'String.prototype.replace').call(this, substr, newSubstr);
  }
  var str = this;
  if (substr instanceof RegExp) {  // string.replace(regexp, function)
    var subs = [];
    var m = substr.exec(str);
    while (m) {
      m.push(m.index, str);
      var inject = newSubstr.apply(null, m);
      subs.push([m.index, m[0].length, inject]);
      m = substr.global ? substr.exec(str) : null;
    }
    for (var i = subs.length - 1; i >= 0; i--) {
      str = str.substring(0, subs[i][0]) + subs[i][2] +
          str.substring(subs[i][0] + subs[i][1]);
    }
  } else {                         // string.replace(string, function)
    var i = str.indexOf(substr);
    if (i !== -1) {
      var inject = newSubstr(str.substr(i, substr.length), i, str);
      str = str.substring(0, i) + inject +
          str.substring(i + substr.length);
    }
  }
  return str;
}, configurable: true, writable: true});
