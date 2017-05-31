// TODO: Add tests from https://github.com/tc39/test262/tree/master/test/built-ins/Math

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

Object.defineProperty(Math, 'abs', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(x) {
    x -= 0;
    return x > 0 ? x : (x < 0 ? -x : (x === 0 ? 0 : NaN));
  }
});

Object.defineProperty(Math, 'ceil', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(x) {
    x -= 0;
    if (!isFinite(x)) {
      return x;  // +/- Infinity and NaN.
    }
    var trunc = x | 0;
    if (!trunc && (x < 0 || (!x && (1 / x == -Infinity)))) {
      trunc = -0;  // -0 is different than 0.
    }
    return (trunc < x && x > 0) ? trunc + 1 : trunc;
  }
});

Object.defineProperty(Math, 'exp', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(x) {
    return Math.pow(Math.E, x);
  }
});

Object.defineProperty(Math, 'floor', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(x) {
    x -= 0;
    if (!isFinite(x)) {
      return x;  // +/- Infinity and NaN.
    }
    var trunc = x | 0;
    if (trunc == x) {
      return x;  // -0 is different than 0.
    }
    return (trunc > x && x < 0) ? trunc - 1 : trunc;
  }
});

Object.defineProperty(Math, 'max', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(var_args) {
    var max = -Infinity;
    for (var i = 0; i < arguments.length; i++) {
      var n = arguments[i] - 0;
      if (isNaN(n)) {
        return NaN;
      }
      if (n > max) {
        max = n;
      } else if (!n && !max && (1 / n == Infinity)) {
        max = 0;  // 0 is bigger than -0.
      }
    }
    return max;
  }
});

Object.defineProperty(Math, 'min', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(var_args) {
    var min = Infinity;
    for (var i = 0; i < arguments.length; i++) {
      var n = arguments[i] - 0;
      if (isNaN(n)) {
        return NaN;
      }
      if (n < min) {
        min = n;
      } else if (!n && !min && (1 / n == -Infinity)) {
        min = -0;  // -0 is smaller than 0.
      }
    }
    return min;
  }
});

Object.defineProperty(Math, 'round', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(x) {
    x -= 0;
    if (!isFinite(x)) {
      return x;  // +/- Infinity and NaN.
    }
    if (x > 0) {  // Positive numbers round .5 numbers up.
      return (x + 0.5) | 0;
    }
    if (!x) {  // Preserve -0 vs 0.
      return x;
    }
    if (x >= -0.5) {  // Rounding up to 0 results in -0.
      return -0;
    }
    var trunc = (x - 0.5) | 0;
    if (trunc + 0.5 == x) {
      // Negative numbers round .5 numbers towards 0.
      trunc++;
    }
    return trunc;
  }
});
