'use strict';

/**
 * Class that records test results; much like Go's testing.T type.
 * @constructor
 */
function T() {
  this.results = {'OK': 0, 'FAIL': 0};
}

/**
 * Report a test result.
 * @param{string} status the test result status (e.g., 'OK', 'FAIL', 'SKIP')
 * @param{string} name
 * @param{number=} opt_message
 */
T.prototype.result = function (status, name, opt_message) {
  console.log('%s\t%s', status, name);
  if (opt_message) {
    console.log(opt_message)
  }
  this.results[status] = this.results[status] + 1 || 1;
}

/**
 * Report a test pass.
 * @param{string} name
 * @param{number=} opt_message
 */
T.prototype.pass = function(name, opt_message) {
  this.result('OK', name, opt_message);
}

/**
 * Report a test failure.
 * @param{string} name
 * @param{number=} opt_message
 */
T.prototype.fail = function(name, opt_message) {
  this.result('FAIL', name, opt_message);
}

/**
 * Report a test failure due to crash.
 * @param{string} name
 * @param{number=} opt_message
 */
T.prototype.crash = function(name, opt_message) {
  this.result('CRASH', name, opt_message);
}

/**
 * Report a test skip.
 * @param{string} name
 * @param{number=} opt_message
 */
T.prototype.skip = function(name, opt_message) {
  this.result('SKIP', name, opt_message);
}

/**
 * Run tests.
 */
function runTests() {
  var tests = require('./interpreter_test.js');

  var t = new T;
  for (var k in tests) {
    if (k.match(/^test/) && typeof tests[k] === 'function') {
      tests[k](t);
    }
  }

  console.log('\nTotals:');
  for (var status in t.results) {
    console.log('%s\t%d tests', status, t.results[status]);
  }
}

runTests();
