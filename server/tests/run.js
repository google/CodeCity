'use strict';

var tests = require('./interpreter_test.js');

var allOk = true;
for (var k in tests) {
  if (k.match(/^test/) && typeof tests[k] === 'function') {
    if (!tests[k]()) {
      allOk = false;
    }
  }
}

console.log('');
if (allOk) {
  console.log('PASSED\tall tests');
} else {
  console.log('FAILED\tsome tests');
}
