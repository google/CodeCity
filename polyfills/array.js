
Object.defineProperty(Array.prototype, 'pop', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function() {
    if (!this) {
      throw TypeError('"this" is null or undefined');
    }
    var o = Object(this);
    var length = o.length >>> 0;
    if (!length || length < 0) {
      o.length = 0;
      return undefined;
    }
    length--;
    var x = o[length];
    delete o[length];  // Needed for non-arrays.
    o.length = length;
    return x;
  }
});

Object.defineProperty(Array.prototype, 'push', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function() {
    if (!this) {
      throw TypeError('"this" is null or undefined');
    }
    var o = Object(this);
    var length = o.length >>> 0;
    for (var i = 0; i < arguments.length; i++) {
      o[length] = arguments[i];
      length++;
    }
    o.length = length;
    return length;
  }
});

Object.defineProperty(Array.prototype, 'shift', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function() {
    if (!this) {
      throw TypeError('"this" is null or undefined');
    }
    var o = Object(this);
    var length = o.length >>> 0;
    if (!length || length < 0) {
      o.length = 0;
      return undefined;
    }
    var value = o[0];
    for (var i = 0; i < length - 1; i++) {
      o[i] = o[i + 1];
    }
    delete o[i];  // Needed for non-arrays.
    o.length = length - 1;
    return value;
  }
});

Object.defineProperty(Array.prototype, 'unshift', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function() {
    if (!this) {
      throw TypeError('"this" is null or undefined');
    }
    var o = Object(this);
    var length = o.length >>> 0;
    if (!length || length < 0) {
      length = 0;
    }
    for (var i = length - 1; i >= 0; i--) {
      o[i + arguments.length] = o[i];
    }
    for (var i = 0; i < arguments.length; i++) {
      o[i] = arguments[i];
    }
    return o.length = length + arguments.length;
  }
});

Object.defineProperty(Array.prototype, 'reverse', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function() {
    if (!this) {
      throw TypeError('"this" is null or undefined');
    }
    var o = Object(this);
    var length = o.length >>> 0;
    if (!length || length < 2) {
      return o;  // Not an array, or too short to reverse.
    }
    for (var i = 0; i < length / 2 - 0.5; i++) {
      var x = o[i];
      o[i] = o[length - i - 1];
      o[length - i - 1] = x;
    }
    return o;
  }
});

Object.defineProperty(Array.prototype, 'indexOf', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(searchElement, fromIndex) {
    if (!this) {
      throw TypeError('"this" is null or undefined');
    }
    var o = Object(this);
    var length = o.length >>> 0;
    var n = fromIndex | 0;
    if (!length || n >= length) {
      return -1;
    }
    var i = Math.max(n >= 0 ? n : length - Math.abs(n), 0);
    while (i < length) {
      if (i in o && o[i] === searchElement) {
        return i;
      }
      i++;
    }
    return -1;
  }
});

Object.defineProperty(Array.prototype, 'lastIndexOf', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(searchElement, fromIndex) {
    if (!this) {
      throw TypeError('"this" is null or undefined');
    }
    var o = Object(this);
    var length = o.length >>> 0;
    if (!length) {
      return -1;
    }
    var n = length - 1;
    if (arguments.length > 1) {
      n = fromIndex | 0;
      if (n) {
        n = (n > 0 || -1) * Math.floor(Math.abs(n));
      }
    }
    var i = n >= 0 ? Math.min(n, length - 1) : length - Math.abs(n);
    while (i >= 0) {
      if (i in o && o[i] === searchElement) {
        return i;
      }
      i--;
    }
    return -1;
  }
});

Object.defineProperty(Array.prototype, 'slice', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(start, end) {
    if (!this) {
      throw TypeError('"this" is null or undefined');
    }
    var o = Object(this);
    var length = o.length >>> 0;
    // Handle negative value for "start"
    start = start | 0;
    start = (start >= 0) ? start : Math.max(0, length + start);
    // Handle negative value for "end"
    if (typeof end != 'undefined') {
      end = end | 0;
      if (end < 0) {
        end = length + end;
      } else {
        end = Math.min(end, length);
      }
    } else {
      end = length;
    }
    var size = end - start;
    var cloned = [];
    for (var i = 0; i < size; i++) {
      cloned[i] = o[start + i];
    }
    return cloned;
  }
});

Object.defineProperty(Array.prototype, 'splice', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(start, deleteCount, var_args) {
    if (!this) {
      throw TypeError('"this" is null or undefined');
    }
    var o = Object(this);
    var length = o.length >>> 0;
    start = start | 0;
    if (start < 0) {
      start = Math.max(length + start, 0);
    } else {
      start = Math.min(start, length);
    }
    if (arguments.length < 1) {
      deleteCount = length - start;
    } else {
      deleteCount = deleteCount | 0;
      deleteCount = Math.max(0, Math.min(deleteCount, length - start));
    }
    var removed = [];
    // Remove specified elements.
    for (var i = start; i < start + deleteCount; i++) {
      removed[removed.length++] = o[i];
      o[i] = o[i + deleteCount];
    }
    // Move other element to fill the gap.
    for (var i = start + deleteCount; i < length - deleteCount; i++) {
      o[i] = o[i + deleteCount];
    }
    // Delete superfluous properties.
    for (var i = length - deleteCount; i < length; i++) {
      delete o[i];
    }
    length -= deleteCount;
    // Insert specified items.
    for (var i = length - 1; i >= start; i--) {
      o[i + arguments.length - 2] = o[i];
    }
    length += arguments.length - 2;
    for (var i = 2; i < arguments.length; i++) {
      o[start + i - 2] = arguments[i];
    }
    o.length = length;
    return removed;
  }
});

Object.defineProperty(Array.prototype, 'concat', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(var_args) {
    if (!this) {
      throw TypeError('"this" is null or undefined');
    }
    var cloned = [];
    for (var i = 0; i < this.length; i++) {
      cloned[i] = this[i];
    }
    for (var j = 0; j < arguments.length; j++) {
      var list = arguments[j];
      for (var i = 0; i < list.length; i++) {
        cloned[cloned.length] = list[i];
      }
    }
    return cloned;
  }
});

Object.defineProperty(Array.prototype, 'join', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(opt_separator) {
    if (!this) {
      throw TypeError('"this" is null or undefined');
    }
    var separator = typeof opt_separator == 'undefined' ?
        ',' : String(opt_separator);
    var str = '';
    for (var i = 0; i < this.length; i++) {
      if (i && separator) {
        str += separator;
      }
      str += this[i];
    }
    return str;
  }
});

Object.defineProperty(Array.prototype, 'every', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(callbackfn, thisArg) {
    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/every
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

Object.defineProperty(Array.prototype, 'filter', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(fun, var_args) {
    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
    if (this === void 0 || this === null || typeof fun !== 'function') throw new TypeError;
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

Object.defineProperty(Array.prototype, 'forEach', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(callback, thisArg) {
    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
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

Object.defineProperty(Array.prototype, 'map', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(callback, thisArg) {
    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/map
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

Object.defineProperty(Array.prototype, 'reduce', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(callback /*, initialValue*/) {
    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
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

Object.defineProperty(Array.prototype, 'reduceRight', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(callback /*, initialValue*/) {
    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/ReduceRight
    if (null === this || 'undefined' === typeof this || 'function' !== typeof callback) throw new TypeError;
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

Object.defineProperty(Array.prototype, 'some', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(fun/*, thisArg*/) {
    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/some
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

Object.defineProperty(Array.prototype, 'sort', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(opt_comp) {
    for (var i = 0; i < this.length; i++) {
      var changes = 0;
      for (var j = 0; j < this.length - i - 1; j++) {
        if (opt_comp ?
            opt_comp(this[j], this[j + 1]) > 0 : this[j] > this[j + 1]) {
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

Object.defineProperty(Array.prototype, 'toLocaleString', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function() {
    var out = [];
    for (var i = 0; i < this.length; i++) {
      out[i] = (this[i] === null || this[i] === undefined) ? '' : this[i].toLocaleString();
    }
    return out.join(',');
  }
});
