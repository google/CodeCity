
var Math2 = {};

Object.defineProperty(Math2, 'E', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: 2.718281828459045
});
Object.defineProperty(Math2, 'LN2', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: 0.6931471805599453
});
Object.defineProperty(Math2, 'LN10', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: 2.302585092994046
});
Object.defineProperty(Math2, 'LOG2E', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: 1.4426950408889634
});
Object.defineProperty(Math2, 'LOG10E', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: 0.4342944819032518
});
Object.defineProperty(Math2, 'PI', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: 3.141592653589793
});
Object.defineProperty(Math2, 'SQRT1_2', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: 0.7071067811865476
});
Object.defineProperty(Math2, 'SQRT2', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: 1.4142135623730951
});

Object.defineProperty(Math2, 'abs', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(x) {
    x = Number(x);
    return x > 0 ? x : (x < 0 ? -x : (x === 0 ? 0 : NaN));
  }
});

Object.defineProperty(Math2, 'ceil', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(x) {
    x = Number(x);
    var trunc = parseInt(x);
    if (!trunc && (x < 0 || (!x && (1 / x == -Infinity)))) {
      trunc = -0;  // -0 is different than 0.
    }
    return (trunc < x && x > 0) ? trunc + 1 : trunc;
  }
});

Object.defineProperty(Math2, 'exp', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(x) {
    return Math.pow(Math.E, x);
  }
});

Object.defineProperty(Math2, 'floor', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(x) {
    x = Number(x);
    var trunc = parseInt(x);
    if (trunc == x) {
      return x;  // -0 is different than 0.
    }
    return (trunc > x && x < 0) ? trunc - 1 : trunc;
  }
});

Object.defineProperty(Math2, 'max', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(var_args) {
    var max = -Infinity;
    for (var i = 0; i < arguments.length; i++) {
      var n = Number(arguments[i]);
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

Object.defineProperty(Math2, 'min', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(var_args) {
    var min = Infinity;
    for (var i = 0; i < arguments.length; i++) {
      var n = Number(arguments[i]);
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

Object.defineProperty(Math2, 'round', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(x) {
    x = Number(x);
    if (isNaN(x)) {
      return NaN;
    }
    if (x > 0) {  // Positive numbers round .5 numbers up.
      return parseInt(x + 0.5);
    }
    if (!x) {  // Preserve -0 vs 0.
      return x;
    }
    if (x >= -0.5) {  // Rounding up to 0 results in -0.
      return -0;
    }
    var trunc = parseInt(x - 0.5);
    if (trunc + 0.5 == x) {
      // Negative numbers round .5 numbers towards 0.
      trunc++;
    }
    return trunc;
  }
});
