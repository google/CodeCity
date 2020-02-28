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
 * implementation up to ECMAScript 5.1 (or close to it).
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
     ['toString', 'pop', 'push', 'shift', 'unshift', 'reverse', 'splice',
      'slice', 'concat', 'indexOf', 'lastIndexOf']],
    [String, 'String',
     ['fromCharCode'],
     ['trim', 'toLowerCase', 'toUpperCase', 'toLocaleLowerCase',
      'toLocaleUpperCase', 'charAt', 'charCodeAt', 'substring', 'slice',
      'substr', 'indexOf', 'lastIndexOf', 'concat', 'localeCompare', 'split',
      'match', 'search', 'replace', 'toString', 'valueOf']],
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
// Object polyfills
///////////////////////////////////////////////////////////////////////////////

// Add a polyfill to handle create's second argument.
Object.create = function create(proto, props) {
  var obj = (new 'Object.create')(proto);
  props && Object.defineProperties(obj, props);
  return obj;
};
Object.defineProperty(Object, 'create', {enumerable: false});

Object.defineProperties = function defineProperties(obj, props) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw new TypeError('Object.defineProperties called on type ' + typeof obj +
                        ', not type object or function');
  }
  var keys = Object.keys(props);
  for (var i = 0; i < keys.length; i++) {
    Object.defineProperty(obj, keys[i], props[keys[i]]);
  }
  return obj;
};
Object.defineProperty(Object, 'defineProperties', {enumerable: false});

Object.isFrozen = function isFrozen(obj) {
  // TODO: replace this with builtin version.
  // Per ES5.1, §15.2.3.12
  if (obj === null || !(typeof obj === 'object' || typeof obj === 'function')) {
    throw new TypeError('Primitive is already immutable');
  }
  var keys = Object.getOwnPropertyNames(obj);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var pd = Object.getOwnPropertyDescriptor(obj, key);
    // Assume no accessor properties.
    if (pd.configurable || pd.writable) return false;
  }
  if (Object.isExtensible) return false;
  return true;
};
Object.defineProperty(Object, 'isFrozen', {enumerable: false});

Object.isSealed = function isSealed(obj) {
  // TODO: replace this with builtin version.
  // Per ES5.1, §15.2.3.12
  if (obj === null || !(typeof obj === 'object' || typeof obj === 'function')) {
    throw new TypeError('Primitive is already immutable');
  }
  var keys = Object.getOwnPropertyNames(obj);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var pd = Object.getOwnPropertyDescriptor(obj, key);
    if (pd.configurable) return false;
  }
  if (Object.isExtensible) return false;
  return true;
};
Object.defineProperty(Object, 'isSealed', {enumerable: false});

Object.freeze = function freeze(obj) {
  // TODO: replace this with builtin version.
  // Per ES5.1, §15.2.3.9
  if (obj === null || !(typeof obj === 'object' || typeof obj === 'function')) {
    throw new TypeError('Primitive is already immutable');
  }
  var keys = Object.getOwnPropertyNames(obj);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    // Assume no accessor properties.
    Object.defineProperty(obj, key, {writable: false, configurable: false});
  }
  Object.preventExtensions(obj);
};
Object.defineProperty(Object, 'freeze', {enumerable: false});

Object.seal = function seal(obj) {
  // TODO: replace this with builtin version.
  // Per ES5.1, §15.2.3.8
  if (obj === null || !(typeof obj === 'object' || typeof obj === 'function')) {
    throw new TypeError('Primitive is already immutable');
  }
  var keys = Object.getOwnPropertyNames(obj);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    // Assume no accessor properties.
    Object.defineProperty(obj, key, {configurable: false});
  }
  Object.preventExtensions(obj);
};
Object.defineProperty(Object, 'seal', {enumerable: false});

///////////////////////////////////////////////////////////////////////////////
// Array.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

Array.prototype.every = function every(callback/*, thisArg*/) {
  // Polyfill copied from:
  // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/ever
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.every called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback +
        ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var thisArg = arguments[1];
  for (var k = 0; k < len; k++) {
    if (k in o && !callback.call(thisArg, o[k], k, o)) return false;
  }
  return true;
};
Object.defineProperty(Array.prototype, 'every', {enumerable: false});

Array.prototype.filter = function filter(callback/*, thisArg*/) {
  // Polyfill copied from:
  // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.filter called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback +
        ', not type function');
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
};
Object.defineProperty(Array.prototype, 'filter', {enumerable: false});

Array.prototype.forEach = function forEach(callback/*, thisArg*/) {
  // Polyfill copied from:
  // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.forEach called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback +
        ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var thisArg = arguments[1];
  for (var k = 0; k < len; k++) {
    if (k in o) callback.call(thisArg, o[k], k, o);
  }
};
Object.defineProperty(Array.prototype, 'forEach', {enumerable: false});

(function() {
  // For cycle detection in array to string and error conversion; see
  // spec bug github.com/tc39/ecma262/issues/289.
  var visited = [];

  Array.prototype.join = function join(separator) {
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
  };
})();
Object.defineProperty(Array.prototype, 'join', {enumerable: false});

Array.prototype.map = function map(callback/*, thisArg*/) {
  // Polyfill copied from:
  // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/map
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.map called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback +
        ', not type function');
  }
  var o = Object(this);
  var len = o.length >>> 0;
  var A = new Array(len);
  var thisArg = arguments[1];
  for (var k = 0; k < len; k++) {
    if (k in o) A[k] = callback.call(thisArg, o[k], k, o);
  }
  return A;
};
Object.defineProperty(Array.prototype, 'map', {enumerable: false});

Array.prototype.reduce = function reduce(callback /*, initialValue*/) {
  // Polyfill copied from:
  // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.reduce called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback +
        ', not type function');
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
};
Object.defineProperty(Array.prototype, 'reduce', {enumerable: false});

Array.prototype.reduceRight = function reduceRight(callback /*, initialValue*/) {
  // Polyfill copied from:
  // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/ReduceRight
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.reduceRight called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback +
        ', not type function');
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
};
Object.defineProperty(Array.prototype, 'reduceRight', {enumerable: false});

Array.prototype.some = function some(callback/*, thisArg*/) {
  // Polyfill copied from:
  // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/some
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.some called on ' + this);
  } else if (typeof callback !== 'function') {
    throw new TypeError('callback is type ' + typeof callback +
        ', not type function');
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
};
Object.defineProperty(Array.prototype, 'some', {enumerable: false});

Array.prototype.sort = function sort(comparefn) {
  // Polylfill adapted from:
  // https://github.com/v8/v8/blob/8e43b9c01d60ddb5e58ec8de9d34616ea1bb905f/src/js/array.js
  // TODO(cpcallen): as of ES2020, Array.prototype.sort must be stable.
  var obj = this;
  // Let obj = ToObject(this)
  if (typeof(obj) !== 'object' && typeof(obj) !== 'function' || obj === null) {
    throw new TypeError("Can't convert " + obj + ' to Object');
  }
  // Let len = ToLength(obj.length)
  var len = Number(obj.length);
  if (isNaN(len) || len < 0) len = 0;
  if (len !== 0 && isFinite(len)) len = Math.trunc(len);
  len = Math.min(len, Number.MAX_SAFE_INTEGER);
  // Make sure comparefn is usable.
  if (comparefn === undefined) {
    comparefn = function (x, y) {
      x = String(x);
      y = String(y);
      if (x === y) return 0;
      else return x < y ? -1 : 1;
    };
  } else if(typeof(comparefn) !== 'function') {
    throw new TypeError(
        'The comparison function must be either a function or undefined');
  }

  if (len < 2) return obj;

  // The ES spec says that the sort order is implementation-defined if
  // the array (or array-like) being sorted is sparse and prototype
  // properties can be seen through the holes.
  //
  // Previously V8 (for compatibility with JSC) also sorted properties
  // inherited from the prototype chain on non-Array objects.  It did
  // this by copying them to this object and sorting only own
  // properties.  Newer versions of V8 don't seem to do this any more,
  // so for simplicity we sort only own properties.
  //
  // We do this by first moving all non-undefined properties to the
  // front of the array and move the undefineds after that.  This
  // moves holes to the end.
  //
  // TODO(cpcallen): this is slow.  Do it (as V8 did, before moving to
  // a torque-based implementation) using a native function.
  var undefCount = 0;
  for (var i = 0, j = 0; j < len; j++) {
    if (Object.prototype.hasOwnProperty.call(obj, j)) {
      if (obj[j] === undefined) {
        undefCount++;
      } else {
        obj[i++] = obj[j];
      }
    }
  }
  var definedCount = i;
  for (; undefCount; undefCount--) {
    obj[i++] = undefined;
  }
  for (; i < len; i++) {
    delete obj[i];
  }
      
  Array.prototype.sort.quicksort_(obj, 0, definedCount, comparefn);
  return obj;
};
Object.defineProperty(Array.prototype, 'sort', {enumerable: false});

// Helper functions.
Array.prototype.sort.insertionSort_ = function insertionSort_(
    a, from, to, comparefn) {
  // For short (length <= 10) arrays, insertion sort is used for efficiency.
  for (var i = from + 1; i < to; i++) {
    var element = a[i];
    for (var j = i - 1; j >= from; j--) {
      var tmp = a[j];
      var order = comparefn(tmp, element);
      if (order > 0) {
        a[j + 1] = tmp;
      } else {
        break;
      }
    }
    a[j + 1] = element;
  }
};
Object.defineProperty(Array.prototype.sort, 'insertionSort_',
                      {enumerable: false});

Array.prototype.sort.getThirdIndex_ = function getThirdIndex_(
    a, from, to, comparefn) {
  var t_array = [];
  // Use both 'from' and 'to' to determine the pivot candidates.
  var increment = 200 + ((to - from) & 15);
  var j = 0;
  from += 1;
  to -= 1;
  for (var i = from; i < to; i += increment) {
    t_array[j] = [i, a[i]];
    j++;
  }
  t_array.sort(function(a, b) {
    return comparefn(a[1], b[1]);
  });
  var third_index = t_array[t_array.length >> 1][0];
  return third_index;
};
Object.defineProperty(Array.prototype.sort, 'getThirdIndex_',
                      {enumerable: false});

Array.prototype.sort.quicksort_ = function quicksort_(a, from, to, comparefn) {
  /* In-place QuickSort algorithm.
   */
  var third_index = 0;
  while (true) {
    // Insertion sort is faster for short arrays.
    if (to - from <= 10) {
      Array.prototype.sort.insertionSort_(a, from, to, comparefn);
      return;
    }
    if (to - from > 1000) {
      third_index = Array.prototype.sort.getThirdIndex_(a, from, to, comparefn);
    } else {
      third_index = from + ((to - from) >> 1);
    }
    // Find a pivot as the median of first, last and middle element.
    var v0 = a[from];
    var v1 = a[to - 1];
    var v2 = a[third_index];
    var c01 = comparefn(v0, v1);
    if (c01 > 0) {
      // v1 < v0, so swap them.
      var tmp = v0;
      v0 = v1;
      v1 = tmp;
    } // v0 <= v1.
    var c02 = comparefn(v0, v2);
    if (c02 >= 0) {
      // v2 <= v0 <= v1.
      var tmp = v0;
      v0 = v2;
      v2 = v1;
      v1 = tmp;
    } else {
      // v0 <= v1 && v0 < v2
      var c12 = comparefn(v1, v2);
      if (c12 > 0) {
        // v0 <= v2 < v1
        var tmp = v1;
        v1 = v2;
        v2 = tmp;
      }
    }
    // v0 <= v1 <= v2
    a[from] = v0;
    a[to - 1] = v2;
    var pivot = v1;
    var low_end = from + 1;   // Upper bound of elements lower than pivot.
    var high_start = to - 1;  // Lower bound of elements greater than pivot.
    a[third_index] = a[low_end];
    a[low_end] = pivot;

    // From low_end to i are elements equal to pivot.
    // From i to high_start are elements that haven't been compared yet.
    partition: for (var i = low_end + 1; i < high_start; i++) {
      var element = a[i];
      var order = comparefn(element, pivot);
      if (order < 0) {
        a[i] = a[low_end];
        a[low_end] = element;
        low_end++;
      } else if (order > 0) {
        do {
          high_start--;
          if (high_start == i) break partition;
          var top_elem = a[high_start];
          order = comparefn(top_elem, pivot);
        } while (order > 0);
        a[i] = a[high_start];
        a[high_start] = element;
        if (order < 0) {
          element = a[i];
          a[i] = a[low_end];
          a[low_end] = element;
          low_end++;
        }
      }
    }
    if (to - high_start < low_end - from) {
      quicksort_(a, high_start, to, comparefn);
      to = low_end;
    } else {
      quicksort_(a, from, low_end, comparefn);
      from = high_start;
    }
  }
};
Object.defineProperty(Array.prototype.sort, 'quicksort_', {enumerable: false});

Array.prototype.toLocaleString = function toLocaleString() {
  var out = [];
  for (var i = 0; i < this.length; i++) {
    out[i] = (this[i] === null || this[i] === undefined) ?
        '' : this[i].toLocaleString();
  }
  return out.join(',');
};
Object.defineProperty(Array.prototype, 'toLocaleString', {enumerable: false});

///////////////////////////////////////////////////////////////////////////////
// String.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

// String.prototype.length is always 0.
Object.defineProperty(String.prototype, 'length', {value: 0});

String.prototype.replace = function replace(substr, newSubstr) {
  // Polyfill to handle String.prototype.replace's second argument being
  // a function.
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
      var inject = newSubstr.apply(undefined, m);
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
};
Object.defineProperty(String.prototype, 'replace', {enumerable: false});
