// TODO: Add tests from https://github.com/tc39/test262/tree/master/test/built-ins/String

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
    if (fromIndex != Infinity) {
      fromIndex = Math.max(0, fromIndex | 0);
    }
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

Object.defineProperty(String.prototype, 'lastIndexOf', {
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
    if (fromIndex === undefined) {
      fromIndex = str.length;
    } else {
      fromIndex = Math.min(str.length, fromIndex | 0);
    }
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
    return (isFinite(index) && String(this)[index | 0]) || '';
  }
});

Object.defineProperty(String.prototype, 'replace', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(match, replace) {
    // TODO: Support regular expressions.
    if (this === null || this === undefined) {
      throw TypeError('"this" is null or undefined');
    }
    var str = String(this);
    match = String(match);
    var index = str.indexOf(match);
    if (index == -1) {
      return str;  // No match.
    }
    var prefix = str.substring(0, index);
    var suffix = str.substring(index + match.length);
    if (typeof replace == 'function') {
      replace = replace(match, prefix.length, str);
    } else {
      replace = String(replace);
    }
    return prefix + replace + suffix;
  }
});

Object.defineProperty(String.prototype, 'split', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(separator, limit) {
    // TODO: Support regular expressions.
    if (this === null || this === undefined) {
      throw TypeError('"this" is null or undefined');
    }
    var str = String(this);
    separator = String(separator);
    // Bug in JavaScript spec: If limit is Infinity, it becomes 0.
    limit = (limit === undefined) ? Infinity : (limit | 0);
    var list = [];
    if (separator) {
      var cursor = 0;
      while (limit > 0) {
        limit--;
        var index = str.indexOf(separator, cursor);
        if (index == -1) {
          break;
        }
        list.push(str.substring(cursor, index));
        cursor = index + separator.length;
      }
      if (limit) {
        list.push(str.substring(cursor));
      }
    } else {
      // Special case for splitting on ''.
      limit = Math.min(limit, str.length);
      for (var i = 0; i < limit; i++) {
        list[i] = str[i];
      }
    }
    return list;
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
    if (indexStart != Infinity) {
      indexStart |= 0;
    }
    if (indexEnd === undefined) {
      indexEnd = str.length;
    } else {
      if (indexEnd != Infinity) {
        indexEnd |= 0;
      }
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

Object.defineProperty(String.prototype, 'slice', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(indexStart, indexEnd) {
    if (this === null || this === undefined) {
      throw TypeError('"this" is null or undefined');
    }
    var str = String(this);
    if (indexStart != Infinity) {
      indexStart |= 0;
    }
    if (indexStart < 0) {  // Count from end if negative.
      indexStart = str.length + indexStart;
    }
    if (indexEnd === undefined) {
      indexEnd = str.length;
    } else {
      if (indexEnd != Infinity) {
        indexEnd |= 0;
      }
      if (indexEnd < 0) {  // Count from end if negative.
        indexEnd = str.length + indexEnd;
      }
    }
    if (indexStart >= indexEnd) {
      return '';
    }
    return str.substring(indexStart, indexEnd);
  }
});

Object.defineProperty(String.prototype, 'substr', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(indexStart, length) {
    if (this === null || this === undefined) {
      throw TypeError('"this" is null or undefined');
    }
    var str = String(this);
    if (indexStart != Infinity) {
      indexStart |= 0;
    }
    if (indexStart < 0) {  // Count from end if negative.
      indexStart = str.length + indexStart;
    }
    indexStart = Math.max(0, indexStart);
    if (length === undefined || length == Infinity) {
      var indexEnd = str.length;
    } else {
      var indexEnd = indexStart + (length | 0);
    }
    if (indexStart >= indexEnd) {
      return '';
    }
    return str.substring(indexStart, indexEnd);
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
