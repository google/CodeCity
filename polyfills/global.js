
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
    str = '' + str;
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
