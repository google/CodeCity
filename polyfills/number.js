// TODO: Add tests from https://github.com/tc39/test262/tree/master/test/built-ins/Number

var Number2 = {};

Object.defineProperty(Number2, 'MAX_VALUE', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: 1.7976931348623157e+308
});
Object.defineProperty(Number2, 'MIN_VALUE', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: 5e-324
});
Object.defineProperty(Number2, 'NaN', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: NaN
});
Object.defineProperty(Number2, 'NEGATIVE_INFINITY', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: -Infinity
});
Object.defineProperty(Number2, 'POSITIVE_INFINITY', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Infinity
});

Object.defineProperty(Number.prototype, 'toExponential', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(fractionDigits) {
    var num = this;
    if (typeof num != 'number') {
      if (num == Number.prototype) {
        num = 0;
      } else if (num instanceof Number) {
        num -= 0;
      } else {
        throw TypeError('this is not a number');
      }
    }
    if (!isFinite(num)) {
      return '' + num;  // NaN and Infinities.
    }
    if (fractionDigits !== undefined) {
      fractionDigits |= 0;
      if (fractionDigits < 0 || fractionDigits > 20) {
        throw RangeError('toExponential() argument must be between 0 and 20');
      }
    }
    var str = '' + num;
    var integer, decimal, exponent;
    var eIndex = str.indexOf('e');
    if (eIndex != -1) {
      // Exponential notation.
      var dotIndex = str.indexOf('.');
      integer = str.substring(0, dotIndex == -1 ? eIndex : dotIndex);
      decimal = str.substring((dotIndex == -1 ? eIndex : dotIndex) + 1, eIndex);
      exponent = str.substring(eIndex + 1);
    } else {
      // Decimal notation.
      integer = str[0] == '-' ? str.substring(0, 2) : str[0];
      decimal = str.substring(integer.length);
      var dotIndex = decimal.indexOf('.');
      if (dotIndex == -1) {
        exponent = decimal.length;
      } else {
        exponent = dotIndex;
        decimal =
            decimal.substring(0, dotIndex) + decimal.substring(dotIndex + 1);
        if (integer == 0) {  // String to number comparison.
          // 0.0000123
          for (var i = 0; i < decimal.length && decimal[i] == '0'; i++) {}
          exponent -= i + 1;
          var sign = integer.length == 1 ? '' : '-';
          integer = sign + decimal[i];
          decimal = decimal.substring(i + 1);
        }
      }
      exponent = (exponent < 0 ? '' : '+') + exponent;
    }
    if (fractionDigits !== undefined) {
      if (!fractionDigits) {
        // No decimals.
        var zeros = Math.pow(10, decimal.length);
        decimal = Math.round(decimal / zeros);
        if (decimal) {
          // Carry over to the integer.
          integer[0] == '-' ? integer-- : integer++;
        }
        decimal = '';
      } else if (decimal.length > fractionDigits) {
        // Decimal too long.  Round off.
        var zeros = Math.pow(10, decimal.length - fractionDigits);
        decimal = Math.round(decimal / zeros) + '';
      }
      // Decimals not long enough.  Add zeros.
      while (decimal.length < fractionDigits) {
        decimal += '0';
      }
    }
    return integer + (decimal ? '.' + decimal : '') + 'e' + exponent;
  }
});

Object.defineProperty(Number.prototype, 'toFixed', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(digits) {
    var num = this;
    if (typeof num != 'number') {
      if (num == Number.prototype) {
        num = 0;
      } else if (num instanceof Number) {
        num -= 0;
      } else {
        throw TypeError('this is not a number');
      }
    }
    if (isNaN(num)) {
      return 'NaN';
    }
    if (isFinite(digits)) {
      digits |= 0;  // Truncate the number of digits to an int.
    }
    if (digits < 0 || digits > 20) {
      throw RangeError('toFixed() argument must be between 0 and 20');
    }
    var str = '' + num;
    if (!isFinite(num) || str.indexOf('e+') != -1) {
      return str;  // Unable to manipulate number.
    }
    if (!digits) {
      return '' + Math.round(num);  // No decimals.
    }
    var integer = num | 0;
    var decimal = num - integer;
    if (decimal < 0) {
      decimal = -decimal;
    }
    var zeros = Math.pow(10, digits);
    decimal = Math.round(decimal * zeros) / zeros;
    if (decimal >= 1) {
      // Carry over to the integer.
      decimal--;
      integer < 0 ? integer-- : integer++;
    }
    var str = integer + '.';
    // Shift each decimal digit off one by one.
    for (var i = 0; i < digits; i++) {
      decimal *= 10;
      integer = decimal | 0;
      str += integer;
      decimal -= integer;
    }
    return str;
  }
});

Object.defineProperty(Number.prototype, 'toPrecision', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(precision) {
    var num = this;
    if (typeof num != 'number') {
      if (num == Number.prototype) {
        num = 0;
      } else if (num instanceof Number) {
        num -= 0;
      } else {
        throw TypeError('this is not a number');
      }
    }
    if (!isFinite(num) || precision === undefined) {
      return '' + num;  // NaN and Infinities.
    }
    precision |= 0;
    if (precision < 1 || precision > 100) {
      throw RangeError('toPrecision() argument must be between 1 and 21');
    }
    var log = Math.log10(num);
    if (log >= precision) {
      // Forced to switch to exponential notation.
      return num.toExponential(precision - 1);
    }
    var digits = precision - log;
    // Bug: toFixed can change the length of the number due to rounding,
    // resulting in an incorrect precision.
    // E.g. (9.9999).toPrecision(4) should be '10.00' but is '10.000'.
    // The solution is to stop using toFixed.
    return num.toFixed(digits);
  }
});

Object.defineProperty(Number.prototype, 'toString', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(radix) {
    var num = this;
    if (typeof num != 'number') {
      if (num == Number.prototype) {
        num = 0;
      } else if (num instanceof Number) {
        num -= 0;
      } else {
        throw TypeError('this is not a number');
      }
    }
    if (radix === undefined) {
      radix = 10;
    } else {
      radix |= 0;
    }
    if (isNaN(radix) || radix < 2 || radix > 36) {
      throw RangeError('radix argument must be between 2 and 36');
    }
    if (!isFinite(num) || radix == 10) {
      return '' + num;  // Built-in functionality can handle base 10 conversion.
    }
    var negative = num < 0;
    if (negative) {
      num *= -1;
    }
    var digits = '0123456789abcdefghijklmnopqrstuvwxyz';
    var str = negative ? '-' : '';
    // Compute the number of digits (left of the decimal) that the number will
    // have in its new radix.  E.g. 12345 (10) -> 5
    var place = (Math.log(num) / Math.log(radix)) | 0;
    while (place >= 0) {
      var power = Math.pow(radix, place);
      var remainder = num % power;
      var digit = ((num - remainder) / power) | 0;
      str += digits[digit];
      num = remainder;
      place--;
    }
    if (num > 0) {
      // If the number has a decimal remainder, compute the first 20 digits.
      // Use a buffer to prevent display of trailing zeros.
      var strBuffer = '.';
      while (num > 0 && place >= -20) {
        var power = Math.pow(radix, place);
        var remainder = num % power;
        var digit = ((num - remainder) / power) | 0;
        strBuffer += digits[digit];
        if (digit) {
          str += strBuffer;
          strBuffer = '';
        }
        num = remainder;
        place--;
      }
    }
    return str;
  }
});
