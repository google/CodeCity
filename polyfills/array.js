
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
    if (fromIndex !== undefined) {
      n = Number(fromIndex);
      if (!n) {
        n = 0;
      } else if (n && isFinite(n)) {
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
