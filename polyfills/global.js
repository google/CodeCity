
var isNaN = function(testValue) {
  return testValue !== testValue;
};

var isFinite = function(testValue) {
  return (testValue === testValue) &&  // NaN
      testValue != Infinity && testValue != -Infinity;
};

var parseFloat = function(str) {
  if (typeof str == 'number') {
    return str;  // NOP
  } else if (typeof str != 'string') {
    str += '';
  }
  var cursor = 0;
  // Trim off left-side whitespace.
  var white = ' \f\n\r\t\v\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004' +
      '\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000' +
      '\ufeff\uFEFF\xA0';
  while (cursor < str.length && white.indexOf(str[cursor]) != -1) {
    cursor++;
  }
  // Is there a sign?
  var negative = str[cursor] == '-';
  if (negative || str[cursor] == '+') {
    cursor++;
  }
  // Infinity?
  if (str[cursor] == 'I') {
    // Committed to either Infinity or NaN.
    if (str[++cursor] == 'n' && str[++cursor] == 'f' && str[++cursor] == 'i' &&
        str[++cursor] == 'n' && str[++cursor] == 'i' && str[++cursor] == 't' &&
        str[++cursor] == 'y') {
      return negative ? -Infinity : Infinity;
    }
    return NaN;
  }
  var state = 0;
  // 0: Reading integer.
  // 1: Reading decimal.
  // 2: Reading exponent sign.
  // 3: Reading exponent.
  var ok = false;
  var number = 0;
  var decimal_divider = 1;
  var exp_integer = 0;
  var exp_negative = false;
  while (cursor < str.length) {
    var letter = str[cursor];
    if (state == 0) {
      if (letter >= '0' && letter <= '9') {
        number = number * 10 + (letter - 0);
        ok = true;
      } else if (letter == '.') {
        state = 1;
      } else if (ok && (letter == 'e' || letter == 'E')) {
        state = 2;
      } else {
        break;
      }
    } else if (state == 1) {
      if (letter >= '0' && letter <= '9') {
        decimal_divider *= 10;
        number += letter / decimal_divider;
        ok = true;
      } else if (ok && (letter == 'e' || letter == 'E')) {
        state = 2;
      } else {
        break;
      }
    } else if (state == 2) {
      if (letter == '+') {
      } else if (letter == '-') {
        exp_negative = true;
      } else if (letter >= '0' && letter <= '9') {
        exp_integer = letter - 0;
      } else {
        break;
      }
      state = 3;
    } else if (state == 3) {
      if (letter >= '0' && letter <= '9') {
        exp_integer = exp_integer * 10 + (letter - 0);
      } else {
        break;
      }
    }
    cursor++;
  }
  if (!ok) {
    return NaN;
  }
  if (negative) {
    number *= -1;
  }
  if (state >= 2) {
    var zeros = Math.pow(10, exp_integer);
    if (exp_negative) {
      number /= zeros;
    } else {
      number *= zeros;
    }
  }
  return number;
};

// Create an anonymous function to hide DIGIT_TABLE.
var parseInt;
(function () {
  var DIGIT_TABLE = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
    '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,

    'a': 10, 'b': 11, 'c': 12, 'd': 13, 'e': 14, 'f': 15, 'g': 16,
    'h': 17, 'i': 18, 'j': 19, 'k': 20, 'l': 21, 'm': 22, 'n': 23,
    'o': 24, 'p': 25, 'q': 26, 'r': 27, 's': 28, 't': 29, 'u': 30,
    'v': 31, 'w': 32, 'x': 33, 'y': 34, 'z': 35,

    'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15, 'G': 16,
    'H': 17, 'I': 18, 'J': 19, 'K': 20, 'L': 21, 'M': 22, 'N': 23,
    'O': 24, 'P': 25, 'Q': 26, 'R': 27, 'S': 28, 'T': 29, 'U': 30,
    'V': 31, 'W': 32, 'X': 33, 'Y': 34, 'Z': 35
  };

  parseInt = function(str, radix) {
    if (radix !== undefined) {
      radix |= 0;
      if (radix < 2 || radix > 36) {
        return NaN;
      }
    }
    str += '';
    var cursor = 0;
    // Trim off left-side whitespace.
    var white = ' \f\n\r\t\v\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004' +
        '\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000' +
        '\ufeff\uFEFF\xA0';
    while (cursor < str.length && white.indexOf(str[cursor]) != -1) {
      cursor++;
    }
    // Is there a sign?
    var negative = str[cursor] == '-';
    if (negative || str[cursor] == '+') {
      cursor++;
    }
    var hex = str[cursor] == '0' &&
        (str[cursor + 1] == 'x' || str[cursor + 1] == 'X');
    if (!radix) {
      radix = hex ? 16 : 10;
    }
    if (radix == 16 && hex) {
      cursor += 2;
    }
    var integer = 0;
    var ok = false;
    while (cursor < str.length) {
      var value = DIGIT_TABLE[str[cursor]];
      if (value === undefined || value >= radix) {
        break;
      }
      integer = integer * radix + value;
      ok = true;
      cursor++;
    }
    if (negative) {
      number *= -1;
    }
    return ok ? integer : NaN;
  };
})();
