'use strict';

var Interpreter = require('../');
var autoexec = require('../autoexec');
var testcases = require('./testcases');

/**
 * Run a test of the interpreter.
 * @param {string} name The name of the test.
 * @param {string} src The code to be evaled.
 * @param {number|string|boolean|null|undefined} expected The
 *     expected completion value.
 * @return {boolean} True iff the test passed.
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
};

/**
 * Run some tests of switch statement with fallthrough.
 */
exports.testSwitchStatementFallthrough = function() {
  var code = `
      var x = 0;
      switch (i) {
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
exports.testSwitchStatementBreaks = function() {
  var code = `
      foo: {
        switch (i) {
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
};

/**
 * Run some tests of the Abstract Relational Comparison Algorithm, as
 * defined in §11.8.5 of the ES5.1 spec and as embodied by the '<'
 * operator.
 */
exports.testArca = function() {
  var cases = [
    ['0, NaN', undefined],
    ['NaN, NaN', undefined],
    ['NaN, 0', undefined],
    
    ['1, 1', false],
    ['0, -0', false],
    ['-0, 0', false],
    
    ['Infinity, Number.MAX_VALUE', false],
    ['Number.MAX_VALUE, Infinity', true],
    ['-Infinity, -Number.MAX_VALUE', true],
    ['-Number.MAX_VALUE, -Infinity', false],
    
    ['1, 2', true],
    ['2, 1', false],
    
    // String comparisons:
    ['"", ""', false],
    ['"", " "', true],
    ['" ", ""', false],
    ['" ", " "', false],
    ['"foo", "foobar"', true],
    ['"foo", "bar"', false],
    ['"foobar", "foo"', false],
    ['"10", "9"', true],
    ['"10", 9', false],
    
    // \ufb00 vs. \U0001f019: this test fails if we do simple
    // lexicographic comparison of UTF-8 or UTF-32.  The latter
    // character is a larger code point and sorts later in UTF8,
    // but in UTF16 it gets replaced by two surrogates, both of
    // which are smaller than \uf000.
    ['"ﬀ", "🀙"', false],
    
    // Mixed:
    ['11, "2"', false],  // Numeric
    ['2, "11"', true],   // Numeric
    ['"11", "2"', true], // String
  ];
  for (var i in cases) {
    var tc = cases[i]
    var src = `
        (function(a,b){
          return ((a < b) || (a >= b)) ? (a < b) : undefined;
        })(${tc[0]});`;
    runTest('ARCA: ' + tc[0], src, tc[1]);
  }
};

/**
 * Run some tests of the Abstract Equality Comparison Algorithm and
 * the Abstract Strict Equality Comparison Algorithm, as defined in
 * §11.9.3 and §11.9.6 respectiveyl of the ES5.1 spec and as embodied
 * by the '==' and '===' operators.
 */
exports.testAeca = function() {
  var cases = [
    ['false, false', true, true],  // Numeric
    ['false, true', false, false], // Numeric
    ['true, true', true, true],    // Numeric
    ['true, false', false, false], // Numeric

    // Numeric comparisons:
    ['0, NaN', false, false],
    ['NaN, NaN', false, false],
    ['NaN, 0', false, false],

    ['1, 1', true, true],
    ['0, -0', true, true],
    ['-0, 0', true, true],

    ['Infinity, Number.MAX_VALUE', false, false],
    ['Number.MAX_VALUE, Infinity', false, false],
    ['Infinity, -Number.MAX_VALUE', false, false],
    ['-Number.MAX_VALUE, -Infinity', false, false],

    ['1, 2', false, false],
    ['2, 1', false, false],

    // String comparisons:
    ['"", ""', true, true],
    ['"", " "', false, false],
    ['" ", ""', false, false],
    ['" ", " "', true, true],
    ['"foo", "foobar"', false, false],
    ['"foo", "bar"', false, false],
    ['"foobar", "foo"', false, false],
    ['"10", "9"', false, false],

    // Null / undefined:
    ['undefined, undefined', true, true],
    ['undefined, null', true, false],
    ['null, null', true, true],
    ['null, undefined', true, false],

    // Objects:
    ['Object.prototype, Object.prototype', true, true],
    ['{}, {}', false, false],

    // Mixed:
    ['"10", 10', true, false],   // Numeric
    ['10, "10"', true, false],   // Numeric
    ['"10", 9', false, false],   // Numeric
    ['"10", "9"', false, false], // String
    ['"10", "10"', true, true],  // String

    ['false, 0', true, false],  // Numeric
    ['false, 1', false, false], // Numeric
    ['true, 1', true, false],   // Numeric
    ['true, 0', false, false],  // Numeric
    ['0, false', true, false],  // Numeric
    ['1, false', false, false], // Numeric
    ['1, true', true, false],   // Numeric
    ['0, true', false, false],  // Numeric

    ['null, false', false, false],
    ['null, 0', false, false],
    ['null, ""', false, false],
    ['false, null', false, false],
    ['0, null', false, false],
    ['"", null', false, false],

    ['{}, false', false, false],
    ['{}, 0', false, false],
    ['{}, ""', false, false],
    ['{}, null', false, false],
    ['{}, undefined', false, false],
  ];
  for (var i in cases) {
    var tc = cases[i]
    var src = `(function(a,b){ return a == b })(${tc[0]});`;
    runTest('AECA: ' + tc[0], src, tc[1]);
    src = `(function(a,b){ return a === b })(${tc[0]});`;
    runTest('ASECA: ' + tc[0], src, tc[2]);
  }
};
