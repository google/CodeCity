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
 * @fileoverview Code to start up a JavaScript environment.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var autoexec = `

// Polyfill copied from:
// developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_objects/Function/bind
Object.defineProperty(Function.prototype, 'bind',
    {configurable: true, writable: true, value:
  function(oThis) {
    if (typeof this !== 'function') {
      throw new TypeError('What is trying to be bound is not callable');
    }
    var aArgs   = Array.prototype.slice.call(arguments, 1),
        fToBind = this,
        fNOP    = function() {},
        fBound  = function() {
          return fToBind.apply(this instanceof fNOP
                 ? this
                 : oThis,
                 aArgs.concat(Array.prototype.slice.call(arguments)));
        };
    if (this.prototype) {
      fNOP.prototype = this.prototype;
    }
    fBound.prototype = new fNOP();
    return fBound;
  }
});

// Add a polyfill to handle create's second argument.
(function() {
  var create_ = Object.create;
  Object.create = function(proto, props) {
    var obj = create_(proto);
    props && Object.defineProperties(obj, props);
    return obj;
  };
})();

Object.defineProperty(Object, 'defineProperties',
    {configurable: true, writable: true, value:
  function(obj, props) {
    if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
      throw new TypeError('Object.defineProperties called on non-object');
    }
    var keys = Object.keys(props);
    for (var i = 0; i < keys.length; i++) {
      Object.defineProperty(obj, keys[i], props[keys[i]]);
    }
    return obj;
  }
});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/every
Object.defineProperty(Array.prototype, 'every',
    {configurable: true, writable: true, value:
  function(callbackfn, thisArg) {
    if (this == null || typeof callbackfn !== 'function') throw new TypeError;
    var T, k;
    var O = Object(this);
    var len = O.length >>> 0;
    if (arguments.length > 1) T = thisArg;
    k = 0;
    while (k < len) {
      if (k in O && !callbackfn.call(T, O[k], k, O)) return false;
      k++;
    }
    return true;
  }
});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
Object.defineProperty(Array.prototype, 'filter',
    {configurable: true, writable: true, value:
  function(fun/*, thisArg*/) {
    if (this === void 0 || this === null || typeof fun !== 'function') {
      throw new TypeError;
    }
    var t = Object(this);
    var len = t.length >>> 0;
    var res = [];
    var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
    for (var i = 0; i < len; i++) {
      if (i in t) {
        var val = t[i];
        if (fun.call(thisArg, val, i, t)) res.push(val);
      }
    }
    return res;
  }
});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
Object.defineProperty(Array.prototype, 'forEach',
    {configurable: true, writable: true, value:
  function(callback, thisArg) {
    if (this == null || typeof callback !== 'function') throw new TypeError;
    var T, k;
    var O = Object(this);
    var len = O.length >>> 0;
    if (arguments.length > 1) T = thisArg;
    k = 0;
    while (k < len) {
      if (k in O) callback.call(T, O[k], k, O);
      k++;
    }
  }
});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/map
Object.defineProperty(Array.prototype, 'map',
    {configurable: true, writable: true, value:
  function(callback, thisArg) {
    if (this == null || typeof callback !== 'function') new TypeError;
    var T, A, k;
    var O = Object(this);
    var len = O.length >>> 0;
    if (arguments.length > 1) T = thisArg;
    A = new Array(len);
    k = 0;
    while (k < len) {
      if (k in O) A[k] = callback.call(T, O[k], k, O);
      k++;
    }
    return A;
  }
});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
Object.defineProperty(Array.prototype, 'reduce',
    {configurable: true, writable: true, value:
  function(callback /*, initialValue*/) {
    if (this == null || typeof callback !== 'function') throw new TypeError;
    var t = Object(this), len = t.length >>> 0, k = 0, value;
    if (arguments.length == 2) {
      value = arguments[1];
    } else {
      while (k < len && !(k in t)) k++;
      if (k >= len) {
        throw new TypeError('Reduce of empty array with no initial value');
      }
      value = t[k++];
    }
    for (; k < len; k++) {
      if (k in t) value = callback(value, t[k], k, t);
    }
    return value;
  }
});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/ReduceRight
Object.defineProperty(Array.prototype, 'reduceRight',
    {configurable: true, writable: true, value:
  function(callback /*, initialValue*/) {
    if (null === this || 'undefined' === typeof this ||
        'function' !== typeof callback) throw new TypeError;
    var t = Object(this), len = t.length >>> 0, k = len - 1, value;
    if (arguments.length >= 2) {
      value = arguments[1];
    } else {
      while (k >= 0 && !(k in t)) k--;
      if (k < 0) {
        throw new TypeError('Reduce of empty array with no initial value');
      }
      value = t[k--];
    }
    for (; k >= 0; k--) {
      if (k in t) value = callback(value, t[k], k, t);
    }
    return value;
  }
});

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/some
Object.defineProperty(Array.prototype, 'some',
    {configurable: true, writable: true, value:
  function(fun/*, thisArg*/) {
    if (this == null || typeof fun !== 'function') throw new TypeError;
    var t = Object(this);
    var len = t.length >>> 0;
    var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
    for (var i = 0; i < len; i++) {
      if (i in t && fun.call(thisArg, t[i], i, t)) {
        return true;
      }
    }
    return false;
  }
});

Object.defineProperty(Array.prototype, 'sort',
    {configurable: true, writable: true, value:
  function(opt_comp) {
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
      if (changes <= 1) break;
    }
    return this;
  }
});

Object.defineProperty(Array.prototype, 'toLocaleString',
    {configurable: true, writable: true, value:
  function() {
    var out = [];
    for (var i = 0; i < this.length; i++) {
      out[i] = (this[i] === null || this[i] === undefined) ?
          '' : this[i].toLocaleString();
    }
    return out.join(',');
  }
});

// Add a polyfill to handle replace's second argument being a function.
(function() {
  var replace_ = String.prototype.replace;
  String.prototype.replace = function(substr, newSubstr) {
    if (typeof newSubstr !== 'function') {
      // string.replace(string|regexp, string.
      return replace_.call(this, substr, newSubstr);
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
  };
})();

// Must eval to undefined so subsequent evals will give undefined if
// they have no completion value.
undefined;
`;

if (typeof module !== 'undefined') { // Node.js
  module.exports = autoexec;
}
