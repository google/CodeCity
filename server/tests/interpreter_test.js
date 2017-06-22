'use strict';

var Interpreter = require('../');
var autoexec = require('../autoexec');
var testcases = require('./testcases');

/**
 * Run a test of the interpreter.
 *
 * @param {string} name The name of the test.
 * @param {string} src The code to be evaled.
 * @param {(number|string|boolean|null|undefined)} expected The
 *     expected completion value.
 * @return {bool} True iff the test passed.
 */
function runTest(name, src, expected) {
  var interpreter = new Interpreter();
  interpreter.appendCode(autoexec);
  interpreter.run();

  var err = undefined;
  try {
    interpreter.appendCode(src);
    interpreter.run();
  } catch (e) {
    err = e
  }
  var r = interpreter.pseudoToNative(interpreter.value);

  if (err) {
    console.error('FAIL\t%s\n%s', name, src);
    console.error(err);
    return false;
  } else if (r !== expected) {
    console.error('FAIL\t%s\n%s', name, src);
    console.error('got: %j  want: %j', r, expected);
    return false;
  }
  console.log('OK\t%s', name);
  return true;
}

/**
 * Print a 'test skipped' message.
 *
 * @param {string} name The name of the test.
 * @param {string} src The code to be evaled.
 * @param {(number|string|boolean|null|undefined)} expected The
 *     expected completion value.
 */
function skipTest(name) {
  console.log('SKIP\t%s', name);
}

/**
 * Run the simple tests in testcases.js
 *
 * @return True if all tests passed.
 */
exports.testSimple = function() {
  var allOk = true;
  for (var i = 0; i < testcases.length; i++) {
    var tc = testcases[i];
    if ('expected' in tc) {
      if (!runTest(tc.name, tc.src, tc.expected)) {
	allOk = false;
      }
    } else {
      skipTest(tc.name);
    }
  }
  return allOk;
}

/**
 * Run some tests of switch statement with fallthrough.
 */
exports.testSwitchStatementFallthrough = function () {
  var code = `
      var x = 0;
      switch(i) {
      case 1:
	x += 1;
	// fall through
      case 2:
	x += 2;
	// fall through
      default:
	x += 16;
	// fall through
      case 3:
	x += 4;
	// fall through
      case 4:
	x += 8;
	// fall through
      }
      x;`;
  var expected = [28, 31, 30, 12, 8];
  for (var i in expected) {
    var src = 'var i = ' + i + ';\n' + code;
    runTest('switch fallthrough ' + i, src, expected[i]);
  }
}

/**
 * Run some tests of switch statement completion values.
 */
exports.testSwitchStatementBreaks = function () {
  var code = `
      foo: {
        switch(i) {
        case 1:
          10;
          // fall through
        case 2:
          20;
          break;
        default:
          50;
          // fall through
        case 3:
          30;
          break foo;
        case 4:
          40;
        }
      }`;
  var expected = [30, 20, 20, 30, 40];
  for (var i in expected) {
    var src = 'var i = ' + i + ';\n' + code;
    runTest('switch completion ' + i, src, expected[i]);
  }
}
