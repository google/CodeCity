// Mock up a basic console.
var console = {};
console.assert = function(value, message) {
  if (value) {
    console.goodCount++;
  } else {
    $.system.log('');
    $.system.log('Fail!');
    $.system.log(message);
    console.badCount++;
  }
};

// Counters for unit test results.
console.goodCount = 0;
console.badCount = 0;

var tests = {};
