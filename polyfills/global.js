
var isNaN = function(testValue) {
  return !(testValue < 1 || testValue >= 1);
};

var isFinite = function(testValue) {
  return (testValue < 1 || testValue >= 1) &&  // NaN
      testValue != Infinity && testValue != -Infinity;
};
