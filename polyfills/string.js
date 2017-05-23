
Object.defineProperty(String.prototype, 'concat', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(var_args) {
    if (this === null || this === undefined) {
      throw TypeError('"this" is null or undefined');
    }
    var str = String(this);
    for (var i = 0; i < arguments.length; i++) {
      str += String(arguments[i]);
    }
    return str;
  }
});

Object.defineProperty(String.prototype, 'indexOf', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(searchValue, fromIndex) {
    // TODO: Switch to KMP algorithm for more performance.
    if (this === null || this === undefined) {
      throw TypeError('"this" is null or undefined');
    }
    var str = String(this);
    searchValue = String(searchValue);
    fromIndex = Math.max(0, fromIndex | 0);
    if (!searchValue) {
      return (fromIndex < str.length) ? fromIndex : str.length;
    }
    letter: for (var i = fromIndex; i < str.length; i++) {
      for (var j = 0; j < searchValue.length; j++) {
        if (str[i + j] != searchValue[j]) {
          continue letter;
        }
      }
      return i;
    }
    return -1;
  }
});

Object.defineProperty(String.prototype, 'charAt', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(index) {
    if (this === null || this === undefined) {
      throw TypeError('"this" is null or undefined');
    }
    return String(this)[index | 0] || '';
  }
});

Object.defineProperty(String.prototype, 'substring', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(indexStart, indexEnd) {
    if (this === null || this === undefined) {
      throw TypeError('"this" is null or undefined');
    }
    var str = String(this);
    indexStart |= 0;
    if (indexEnd === undefined) {
      indexEnd = str.length;
    } else {
      indexEnd |= 0;
      if (indexStart > indexEnd) {
        var temp = indexEnd;
        indexEnd = indexStart;
        indexStart = temp;
      }
      indexEnd = Math.min(str.length, indexEnd);
    }
    indexStart = Math.max(0, indexStart);
    // Shortcut if substring is whole string.
    if (!indexStart && indexEnd == str.length) {
      return str;
    }
    var outStr = '';
    for (var i = indexStart; i < indexEnd; i++) {
      outStr += str[i];
    }
    return outStr;
  }
});

Object.defineProperty(String.prototype, 'toUpperCase', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function() {
    // TODO: Support Unicode characters.
    if (this === null || this === undefined) {
      throw TypeError('"this" is null or undefined');
    }
    var str = String(this);
    var lower = 'abcdefghijklmnopqrstuvwxyz';
    var upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var outStr = '';
    for (var i = 0; i < str.length; i++) {
      var x = lower.indexOf(str[i]);
      if (x == -1) {
        outStr += str[i];
      } else {
        outStr += upper[x];
      }
    }
    return outStr;
  }
});

Object.defineProperty(String.prototype, 'toLowerCase', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function() {
    // TODO: Support Unicode characters.
    if (this === null || this === undefined) {
      throw TypeError('"this" is null or undefined');
    }
    var str = String(this);
    var lower = 'abcdefghijklmnopqrstuvwxyz';
    var upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var outStr = '';
    for (var i = 0; i < str.length; i++) {
      var x = upper.indexOf(str[i]);
      if (x == -1) {
        outStr += str[i];
      } else {
        outStr += lower[x];
      }
    }
    return outStr;
  }
});

Object.defineProperty(String.prototype, 'trim', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function() {
    // TODO: Switch to regular expression for more performance.
    // return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    if (this === null || this === undefined) {
      throw TypeError('"this" is null or undefined');
    }
    var white = ' \f\n\r\t\v\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004' +
        '\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000' +
        '\ufeff\uFEFF\xA0';
    var str = String(this);
    for (var start = 0; start < str.length; start++) {
      if (white.indexOf(str[start]) == -1) {
        break;
      }
    }
    for (var end = str.length - 1; end > start; end--) {
      if (white.indexOf(str[end]) == -1) {
        break;
      }
    }
    return str.substring(start, end + 1);
  }
});
