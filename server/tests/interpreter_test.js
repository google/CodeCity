/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Tests for JavaScript interpreter.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const http = require('http');
const net = require('net');
const util = require('util');

const Interpreter = require('../interpreter');
const {getInterpreter} = require('./interpreter_common');
const Parser = require('../parser').Parser;
const {T} = require('./testing');
const testcases = require('./testcases');

///////////////////////////////////////////////////////////////////////////////
// Test helper functions.
///////////////////////////////////////////////////////////////////////////////

// Prepare static interpreter instance for runSimpleTest.
const interpreter = getInterpreter();
interpreter.global.createMutableBinding('src');

/**
 * Run a simple test of the interpreter.  A single, shared Interpreter
 * instance is used by all tests executed by this function, but eval
 * is used to evaluate src in its own scope.  The supplied src must
 * not modify objects accessible via the global scope!
 * @param {!T} t The test runner object.
 * @param {string} name The name of the test.
 * @param {string} src The code to be evaled.
 * @param {number|string|boolean|null|undefined} expected The expected
 *     completion value.
 */
function runSimpleTest(t, name, src, expected) {
  let thread;
  try {
    interpreter.setValueToScope(interpreter.global, 'src', src);
    thread = interpreter.createThreadForSrc('eval(src);').thread;
    interpreter.run();
  } catch (e) {
    t.crash(name, util.format('%s\n%s', src, e.stack));
    return;
  }
  const r = interpreter.pseudoToNative(thread.value);
  t.expect(name, r, expected, src);
}

/**
 * Run a test of the interpreter using an independent Interpreter
 * instance, which may be created with non-default options and/or
 * without the standard startup files, and during which various
 * callbacks will be executed; see TestOptions for details.
 * (Simulated) time will be automatically fast-forwarded as required
 * to wake sleeping threads.
 * @param {!T} t The test runner object.
 * @param {string} name The name of the test.
 * @param {string} src The code to be evaled.
 * @param {number|string|boolean|null|undefined} expected The expected
 *     completion value.
 * @param {!TestOptions=} options Custom test options.
 */
function runTest(t, name, src, expected, options) {
  options = options || {};
  const intrp = getInterpreter(options.options, options.standardInit);
  if (options.onCreate) {
    options.onCreate(intrp);
  }

  let thread;
  try {
    thread = intrp.createThreadForSrc(src).thread;
    if (options.onCreateThread) {
      options.onCreateThread(intrp, thread);
    }
    let runResult;
    while ((runResult = intrp.run())) {
      if (runResult > 0) {  // Sleeping thread(s).
        // Fast forward to wake-up time.  Cast to defeat @private check.
        /** @type {?} */(intrp).previousTime_ += runResult;
      } else {  // Blocked thread(s).
        if (options.onBlocked) {
          options.onBlocked(intrp);
        }
      }
    }
  } catch (e) {
    t.crash(name, util.format('%s\n%s', src, e.stack));
    return;
  }
  const r = intrp.pseudoToNative(thread.value);
  t.expect(name, r, expected, src);
}

/**
 * Run a (truly) asynchronous test of the interpreter.  A new
 * Interpreter instance is created for each test.  Special functions
 * resolve() and reject() are inserted in the global scope; they will
 * end the test.  If resolve() is called the test will end normally
 * and the argument supplied will be compared with the expected value;
 * if reject() is called the test will instead be treated as a
 * failure.
 * @param {!T} t The test runner object.
 * @param {string} name The name of the test.
 * @param {string} src The code to be evaled.
 * @param {number|string|boolean|null|undefined} expected The expected
 *     completion value.
 * @param {!TestOptions=} options Custom test options.  Note that
 *     'onBlocked' is ignored because the interpreter is .start()ed
 *     instead of .run() being called directly.
 */
async function runAsyncTest(t, name, src, expected, options) {
  options = options || {};
  const intrp = getInterpreter(options.options, options.standardInit);
  if (options.onCreate) {
    options.onCreate(intrp);
  }

  // Create promise to signal completion of test from within
  // interpreter.  Awaiting p will block until resolve or reject is
  // called.
  let resolve, reject, result;
  const p = new Promise(function(res, rej) {resolve = res; reject = rej;});
  intrp.global.createMutableBinding(
      'resolve', intrp.createNativeFunction('resolve', resolve, false));
  intrp.global.createMutableBinding(
      'reject', intrp.createNativeFunction('reject', reject, false));

  try {
    const thread = intrp.createThreadForSrc(src).thread;
    if (options.onCreateThread) {
      options.onCreateThread(intrp, thread);
    }
    intrp.start();
    result = await p;
  } catch (e) {
    t.fail(name, util.format('%s\n%s', src, e));
    return;
  } finally {
    intrp.stop();
  }
  const r = intrp.pseudoToNative(result);
  t.expect(name, r, expected, src);
}

/**
 * Options for runTest and runAsyncTest.
 * @record
 */
const TestOptions = function() {};

/**
 * Interpreter constructor options.
 * @type {!Interpreter.Options|undefined}
 */
TestOptions.prototype.options;

/**
 * Load the standard startup files?  (Default: true.)
 * @type {boolean|undefined}
 */
TestOptions.prototype.standardInit;

/**
 * Callback to be called after creating new interpreter instance (and
 * running standard starup files, if not suppressed with standardInit:
 * false) but before creating a thread for src.  Can be used to insert
 * extra bindings into the global scope (e.g., to create additional
 * builtins).
 *
 * The first argument is the interpreter instance to be configured.
 *
 * @type {function(!Interpreter)|undefined}
 */
TestOptions.prototype.onCreate;

/**
 * Callback to be called after creating a new Interpreter.Thread, but
 * before running it.
 *
 * The first argument is the interpreter instance.
 * The second argument is the thread just created.
 *
 * @type {function(!Interpreter, !Interpreter.Thread)|undefined}
 */
TestOptions.prototype.onCreateThread;

/**
 * Callback to be called if .run() returns a negative value,
 * indicating there are blocked threads.  Can be used to fake
 * completion of asynchronous events.
 *
 * The first argument is the interpreter instance to be configured.
 *
 * @type {function(!Interpreter)|undefined}
 */
TestOptions.prototype.onBlocked;

///////////////////////////////////////////////////////////////////////////////
// Tests: static analysis functions
///////////////////////////////////////////////////////////////////////////////

exports.testGetBoundNames = function(t) {
  const name = 'getBoundNames';
  const {getBoundNames} = Interpreter.testOnly;

  const src = `
      var a, b;
      for (var c in {}) {}
      function f(x) {
        var y, z;
      };
      (function g() { var v; })();
  `;
  const ast = Parser.parse(src);
  const boundNames = getBoundNames(ast);
  const keys = Object.getOwnPropertyNames(boundNames);
  t.expect(`${name}() keys`, keys.join(),
           'a,b,c,f', src);
  for (let i = 0; i < 3; i++) {
    t.expect(`${name}()[${i}]`, boundNames[keys[i]], undefined, src);
  }
  t.expect(`${name}()[3]`, boundNames['f'], ast['body'][2], src);
};

exports.testHasArgumentsOrEval = function(t) {
  const name = 'hasArgumentsOrEval';
  const {hasArgumentsOrEval} = Interpreter.testOnly;

  const cases = [
    // [src, expected]; will only look at first statement src.
    ['Arguments;', false],
    ['arguments;', true],
    ['arguments[0];', true],
    ['foo[arguments];', true],
    ['bar(arguments);', true],
    ['{var x; function myArgs() {return arguments;}}', false],
    ['{function f() {} arguments;}', true],

    ['Eval;', false],
    ['eval;', true],
    ['eval();', true],
    ['Function.prototype.call(eval);', true],
    ['{var x; function myEval(arg) {eval(arg);}}', false],
    ['{function f() {} eval();}', true],
  ];
  for (const [src, expected] of cases) {
    try {
      const ast = Parser.parse(src);
      const firstStatement = ast['body'][0];
      t.expect(`${name} ${src}`, hasArgumentsOrEval(firstStatement),
               expected, src);
    } catch (e) {
      t.crash(name, util.format('%s\n%s', src, e.stack));
    }
  }
};

///////////////////////////////////////////////////////////////////////////////
// Tests: run tests from testcases.js.
///////////////////////////////////////////////////////////////////////////////

/**
 * Run the simple tests in testcases.js
 * @param {!T} t The test runner object.
 */
exports.testTestcases = function(t) {
  for (const tc of testcases) {
    if (!('expected' in tc)) {
      t.skip(tc.name);
      continue;
    }
    if (tc.destructive) {
      const testOptions = tc.options ? {options: tc.options} : {};
      runTest(t, tc.name || tc.src, tc.src, tc.expected, testOptions);
    } else {
      const oldOptions = interpreter.options;
      if (tc.options) interpreter.options = tc.options;
      runSimpleTest(t, tc.name || tc.src, tc.src, tc.expected);
      if (tc.options) interpreter.options = oldOptions;
    }
  }
};

///////////////////////////////////////////////////////////////////////////////
// Tests: interpreter internals
///////////////////////////////////////////////////////////////////////////////

/**
 * Run some tests of switch statement with fallthrough.
 * @param {!T} t The test runner object.
 */
exports.testSwitchStatementFallthrough = function(t) {
  const code = `
      var x = '';
      switch (i) {
        case 1:
          x += '1';
          // fall through
        case 2:
          x += '2';
          // fall through
        default:
          x += 'D';
          // fall through
        case 3:
          x += '3';
          // fall through
        case 4:
          x += '4';
          // fall through
      }
      x;`;
  const expected = ['D34', '12D34', '2D34', '34', '4'];
  for (let i = 0; i < expected.length; i++) {
    const src = 'var i = ' + i + ';\n' + code;
    runSimpleTest(t, 'switch fallthrough ' + i, src, expected[i]);
  }
};

/**
 * Run some tests of switch statement completion values.
 * @param {!T} t The test runner object.
 */
exports.testSwitchStatementBreaks = function(t) {
  const code = `
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
  const expected = [30, 20, 20, 30, 40];
  for (let i = 0; i < expected.length; i++) {
    const src = 'var i = ' + i + ';\n' + code;
    runSimpleTest(t, 'switch completion ' + i, src, expected[i]);
  }
};

/**
 * Run some tests of evaluation of binary expressions, as defined in
 * §11.5--11.11 of the ES5.1 spec.
 * @param {!T} t The test runner object.
 */
exports.testBinaryOp = function(t) {
  const cases = [
    // Addition / concatenation:
    ["1 + 1", 2],
    ["'1' + 1", '11'],
    ["1 + '1'", '11'],

    // Subtraction:
    ["'1' - 1", 0],

    // Multiplication:
    ["'5' * '5'", 25],

    ["-5 * 0", -0],
    ["-5 * -0", 0],

    ["1 * NaN", NaN],
    ["Infinity * NaN", NaN],
    ["-Infinity * NaN", NaN],

    ["Infinity * Infinity", Infinity],
    ["Infinity * -Infinity", -Infinity],
    ["-Infinity * -Infinity", Infinity],
    ["-Infinity * Infinity", -Infinity],
    // FIXME: add overflow/underflow cases

    // Division:
    ["35 / '7'", 5],

    ["1 / 1", 1],
    ["1 / -1", -1],
    ["-1 / -1", 1],
    ["-1 / 1", -1],

    ["1 / NaN", NaN],
    ["NaN / NaN", NaN],
    ["NaN / 1", NaN],

    ["Infinity / Infinity", NaN],
    ["Infinity / -Infinity", NaN],
    ["-Infinity / -Infinity", NaN],
    ["-Infinity / Infinity", NaN],

    ["Infinity / 0", Infinity],
    ["Infinity / -0", -Infinity],
    ["-Infinity / -0", Infinity],
    ["-Infinity / 0", -Infinity],

    ["Infinity / 1", Infinity],
    ["Infinity / -1", -Infinity],
    ["-Infinity / -1", Infinity],
    ["-Infinity / 1", -Infinity],

    ["1 / Infinity", 0],
    ["1 / -Infinity", -0],
    ["-1 / -Infinity", 0],
    ["-1 / Infinity", -0],

    ["0 / 0", NaN],
    ["0 / -0", NaN],
    ["-0 / -0", NaN],
    ["-0 / 0", NaN],

    ["1 / 0", Infinity],
    ["1 / -0", -Infinity],
    ["-1 / -0", Infinity],
    ["-1 / 0", -Infinity],
    // FIXME: add overflow/underflow cases

    // Remainder:
    ["20 % 5.5", 3.5],
    ["20 % -5.5", 3.5],
    ["-20 % -5.5", -3.5],
    ["-20 % 5.5", -3.5],

    ["1 % NaN", NaN],
    ["NaN % NaN", NaN],
    ["NaN % 1", NaN],

    ["Infinity % 1", NaN],
    ["-Infinity % 1", NaN],
    ["1 % 0", NaN],
    ["1 % -0", NaN],
    ["Infinity % 0", NaN],
    ["Infinity % -0", NaN],
    ["-Infinity % -0", NaN],
    ["-Infinity % 0", NaN],

    ["0 % 1", 0],
    ["-0 % 1", -0],
    // FIXME: add overflow/underflow cases

    // Left shift:
    ["10 << 2", 40],
    ["10 << 28", -1610612736],
    ["10 << 33", 20],
    ["10 << 34", 40],

    // Signed right shift:
    ["10 >> 4", 0],
    ["10 >> 33", 5],
    ["10 >> 34", 2],
    ["-11 >> 1", -6],
    ["-11 >> 2", -3],

    // Signed right shift:
    ["10 >>> 4", 0],
    ["10 >>> 33", 5],
    ["10 >>> 34", 2],
    ["-11 >>> 0", 0xfffffff5],
    ["-11 >>> 1", 0x7ffffffa],
    ["-11 >>> 2", 0x3ffffffd],
    ["4294967338 >>> 0", 42],

    // Bitwise:
    ["0x3 | 0x5", 0x7],
    ["0x3 ^ 0x5", 0x6],
    ["0x3 & 0x5", 0x1],

    ["NaN | 0", 0],
    ["-0 | 0", 0],
    ["Infinity | 0", 0],
    ["-Infinity | 0", 0],

    // Comparisons:
    //
    // (This is mainly about making sure that the binary operators are
    // hooked up to the abstract relational comparison algorithm
    // correctly; that algorithm is tested separately to make sure
    // details of comparisons are correct.)
    ["1 < 2", true],
    ["2 < 2", false],
    ["3 < 2", false],

    ["1 <= 2", true],
    ["2 <= 2", true],
    ["3 <= 2", false],

    ["1 > 2", false],
    ["2 > 2", false],
    ["3 > 2", true],

    ["1 >= 2", false],
    ["2 >= 2", true],
    ["3 >= 2", true],

    // (Ditto for abastract equality comparison algorithm.)
    ["1 == 1", true],
    ["2 == 1", false],
    ["2 == 2", true],
    ["1 == 2", false],

    ["1 == '1'", true],

    ["1 != 1", false],
    ["2 != 1", true],
    ["2 != 2", false],
    ["1 != 2", true],

    ["1 != '1'", false],

    // (Ditto for abastract strict equality comparison algorithm.)
    ["1 === 1", true],
    ["2 === 1", false],
    ["2 === 2", true],
    ["1 === 2", false],

    ["1 === '1'", false],

    ["1 !== 1", false],
    ["2 !== 1", true],
    ["2 !== 2", false],
    ["1 !== 2", true],

    ["1 !== '1'", true],
  ];
  for (const tc of cases) {
    const src = tc[0] + ';';
    runSimpleTest(t, 'BinaryExpression: ' + tc[0], src, tc[1]);
  }
};

/**
 * Run some tests of the Abstract Relational Comparison Algorithm, as
 * defined in §11.8.5 of the ES5.1 spec and as embodied by the '<'
 * operator.
 * @param {!T} t The test runner object.
 */
exports.testArca = function(t) {
  const cases = [
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
  for (const tc of cases) {
    const src = `
        (function(a,b){
          return ((a < b) || (a >= b)) ? (a < b) : undefined;
        })(${tc[0]});`;
    runSimpleTest(t, 'ARCA: ' + tc[0], src, tc[1]);
  }
};

/**
 * Run some tests of the Abstract Equality Comparison Algorithm and
 * the Abstract Strict Equality Comparison Algorithm, as defined in
 * §11.9.3 and §11.9.6 respectiveyl of the ES5.1 spec and as embodied
 * by the '==' and '===' operators.
 * @param {!T} t The test runner object.
 */
exports.testAeca = function(t) {
  const cases = [
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
  for (const tc of cases) {
    let src = `(function(a,b) {return a == b})(${tc[0]});`;
    runSimpleTest(t, 'AECA: ' + tc[0], src, tc[1]);
    src = `(function(a,b) {return a === b})(${tc[0]});`;
    runSimpleTest(t, 'ASECA: ' + tc[0], src, tc[2]);
  }
};

/**
 * Run a test of asynchronous functions:
 * @param {!T} t The test runner object.
 * @suppress {visibility}
 */
exports.testAsync = function(t) {
  // Function to install an async NativeFunction on new Interpreter
  // instances.  The function, when called, will save its
  // resolve/reject callbacks and first arg in test-local variables.
  let resolve, reject, arg;
  function createAsync(intrp) {
    intrp.global.createMutableBinding('async', new intrp.NativeFunction({
      name: 'async', length: 0,
      call: function(intrp, thread, state, thisVal, args) {
        arg = args[0];
        const rr = intrp.getResolveReject(thread, state);
        resolve = rr.resolve;
        reject = rr.reject;
        return Interpreter.FunctionResult.Block;
      }
    }));
  };

  // Test ordinary return.
  let name = 'testAsyncResolve';
  let src = `
      'before';
      async();
      'between';
      async('af') + 'ter';
  `;
  runTest(t, name, src, 'after', {
    standardInit: false,  // Save time.
    onCreate: createAsync,
    onBlocked: (intrp) => {resolve(arg);},
  });

  // Test throwing an exception.
  name ='testAsyncReject';
  src = `
      try {
        'before';
        async();
        'after';
      } catch (e) {
        e;
      }
  `;
  runTest(t, name, src, 'except', {
    standardInit: false,  // Save time.
    onCreate: createAsync,
    onBlocked: (intrp) => {reject('except');},
  });

  // Extra check to verify async function can't resolve/reject more
  // than once without an asertion failure.
  name = 'testAsyncSafetyCheck';
  let ok;
  src = `
     async();  // Returns ok === undefined then sets ok to 'ok'.
     async();  // Returns ok === 'ok' then uselessly sets ok a second time.
  `;
  runTest(t, name, src, 'ok', {
    standardInit: false,  // Save time.
    onCreate: createAsync,
    onBlocked: (intrp) => {
      resolve(ok);
      // Call reject; this is expected to blow up.
      try {
        reject('foo');
      } catch (e) {
        ok = 'ok';
      }
    },
  });

  // A test of unwind_, to make sure it unwinds and kills the correct
  // thread when an async function throws.
  name = 'testAsyncRejectUnwind';
  const intrp = getInterpreter({noLog: ['unhandled']});
  createAsync(intrp);  // Install async function.
  // Create cannon-fodder thread that will usually be ready to run.
  const bgThread = intrp.createThreadForSrc(`
      // Repeatedly suspend; every 10th time suspend for a long time.
      for (var i = 1; true; i++) {
        suspend((i % 10) ? 0 : 1000);
      }
  `).thread;
  // Create thread to call async function.
  const asyncThread = intrp.createThreadForSrc('async();').thread;
  intrp.run();
  // asyncThread has run once and blocked; bgThread has run ten times
  // and is now sleeping for 1s.

  // Create Error err to throw.  It should have no stack to start with.
  const err = new intrp.Error(intrp.ROOT, intrp.ERROR, 'sample error');
  t.assert(name + ': Error has no .stack initially',
      !err.has('stack', intrp.ROOT));

  // Throw err.
  intrp.thread_ = bgThread;  // Try to trick reject into killing wrong thread.
  reject(err);  // Throw unhandled Error in asyncThread.

  // Verify correct thread was unwound and killed.
  t.assert(name + ': unwound thread stack empty',
      asyncThread.stateStack_.length === 0);
  t.expect(name + ': unwound thread status',
      asyncThread.status, Interpreter.Thread.Status.ZOMBIE);
  t.assert(name + ': background thread stack non-empty',
      bgThread.stateStack_.length > 0);
  t.expect(name + ': background thread status',
      bgThread.status, Interpreter.Thread.Status.SLEEPING);

  // Verify err has aquired a stack.
  t.assert(name + ': Error has .stack after being thrown',
      err.has('stack', intrp.ROOT));
  const stack = err.get('stack', intrp.ROOT);
  t.assert(name + ': Error .stack mentions function that threw',
      stack.match(/in async/));
  t.assert(name + ': Error .stack mentions call site',
      stack.match(/at "async\(\);" 1:1/));
};

/**
 * Run tests of the Thread constructor and the suspend(), setTimeout()
 * and clearTimeout() functions.
 * @param {!T} t The test runner object.
 */
exports.testThreading = function(t) {
  let src = `
      'before';
      suspend();
      'after';
  `;
  runTest(t, 'suspend()', src, 'after');

  // Check that Threads have ids.
  src = `
      var t1 = new Thread(function() {});
      var t2 = new Thread(function() {});
      typeof t1.id === 'number' && typeof t2.id === 'number' && t1.id !== t2.id;
  `;
  runSimpleTest(t, '(new Thread).id', src, true);

  src = `
      var s = '';
      new Thread(function() {s += this;}, 500, 2);
      new Thread(function(x) {s += x;}, 1500, undefined, [4]);
      new Thread(function() {s += '1';})
      suspend(1000);
      s += '3';
      suspend(1000);
      s += '5';
      s;
  `;
  runTest(t, 'new Thread', src, '12345');

  src = `
      var current;
      var thread = new Thread(function() {current = Thread.current();});
      suspend();
      current === thread;
  `;
  runTest(t, 'Thread.current()', src, true);

  src = `
      var result;
      new Thread(function() {
        result = 'OK';
        Thread.kill(Thread.current());
        result = 'The reports of my death are greatly exaggerated.';
      });
      suspend();
      result;
  `;
  runTest(t, 'Thread.kill', src, 'OK');

  src = `
      'before';
      suspend(10000);
      'after';
  `;
  runTest(t, 'suspend(1000)', src, 'after');

  src = `
      var s = '';
      setTimeout(function(x) {s += '2';}, 500);
      setTimeout(function(x) {s += '4';}, 1500);
      s += '1';
      suspend(1000);
      s += '3';
      suspend(1000);
      s += '5';
      s;
  `;
  runTest(t, 'setTimeout', src, '12345');

  src = `
      // Should have no effect:
      clearTimeout('foo');
      clearTimeout(Thread.current());

      var s = '';
      var tid = setTimeout(function(a, b) {
          s += a;
          suspend();
          s += b;
      }, 0, '2', '4');
      s += 1;
      suspend();
      s += '3';
      clearTimeout(tid);
      suspend();
      s += '5';
      s;
  `;
  runTest(t, 'clearTimeout', src, '1235');
};

/**
 * Run tests of the Thread time-limit mechanism.
 * @param {!T} t The test runner object.
 */
exports.testTimeLimit = function(t) {
  // Some constants used by several tests in this section.  It should
  // be the case that a for loop executing the specified number of
  // iterations will take longer than the specified time limit, even
  // if the body of the loop is empty.
  //
  // Ideally these should be very small values to ensure the tests
  // run quickly, but in practice random delays (OS-level time
  // slicing, GC and JIT delays, etc.) make make tests very flaky if
  // these values are too small.
  const iterations = 10000;
  const timeLimit = 5;  // in ms.

  // First check that a sufficiently slow loop will get timed out.
  // (This also verifies the requirements on the iterations and
  // timeLimit constants mentioned above.)
  let name = 'Thread hits timeLimit';
  let src = `
      try {
        for (var i = 0; i < ${iterations}; i++) {
        }
        "Thread didn't time out";  // Maybe increase iterations?
      } catch (e) {
        e.name + ': ' + e.message;  // Can't call String(e): we're out of time!
      }
  `;
  runTest(t, name, src, 'RangeError: Thread ran too long', {
    onCreateThread: (intrp, thread) => {thread.timeLimit = timeLimit;},
  });

  // Now check that calling suspend() regularly will save the thread
  // from timing out.
  name = 'Thread can use suspend to avoid timeLimit';
  src = `
      try {
        for (var i = 0; i < ${iterations}; i++) {
          suspend();
        }
        "Thread didn't time out";
      } catch (e) {
        e.name + ': ' + e.message;  // Can't call String(e): we're out of time!
      }
  `;
  runTest(t, name, src, "Thread didn't time out", {
    onCreateThread: (intrp, thread) => {thread.timeLimit = timeLimit;},
  });

  // Test we can't call anything after timing out.
  name = "Thread can't call after timeout";
  src = `
      try {
        try {
          for (var i = 0; i < ${iterations}; i++) {
          }
          "Thread didn't time out";  // Maybe increase iterations?
        } catch (e) {
          String(e);
          'Still able to call';
        }
      } catch (e) {
        e.name + ': ' + e.message;  // Can't call String(e): we're out of time!
      }
  `;
  runTest(t, name, src, 'RangeError: Thread ran too long', {
    onCreateThread: (intrp, thread) => {thread.timeLimit = timeLimit;},
  });

  // Test we can't call anything after timing out.
  name = "Thread can call suspend after timeout";
  src = `
      try {
        try {
          for (var i = 0; i < ${iterations}; i++) {
          }
          "Thread didn't time out";  // Maybe increase iterations?
        } catch (e) {
          suspend();
          'Still able to call suspend';
        }
      } catch (e) {
        e.name + ': ' + e.message;  // Can't call String(e): we're out of time!
      }
  `;
  runTest(t, name, src, 'Still able to call suspend', {
    onCreateThread: (intrp, thread) => {thread.timeLimit = timeLimit;},
  });

  // Test timeLimit is inherited by child Threads.
  name = 'Threads inherit timeLimit from parent Thread';
  src = `
      var r;
      setTimeout(function() {
        try {
          for (var i = 0; i < ${iterations}; i++) {
          }
          r = "Thread didn't time out";  // Maybe increase iterations?
        } catch (e) {
          r = e.name + ': ' + e.message;  // Can't call String(e).
        }
      });
      suspend(1000000);  // Fortunately simulated time passes really quickly.
      r;
  `;
  runTest(t, name, src, 'RangeError: Thread ran too long', {
    onCreateThread: (intrp, thread) => {thread.timeLimit = timeLimit;},
  });
};

/**
 * Run a test of the .start() and .pause() methods on Interpreter
 * instances.  This is an async test because we use real (albeit
 * small) timeouts to make sure everything works as it ought to.
 * @param {!T} t The test runner object.
 */
exports.testStartStop = async function(t) {
  function snooze(ms) {
    return new Promise(function(resolve, reject) {setTimeout(resolve, ms);});
  }
  const intrp = getInterpreter();
  let name = 'testStart';
  let src = `
      var x = 0;
      while (true) {
        suspend(10);
        x++;
      };
  `;
  try {
    // Garbage collection occuring during test can case flakiness.
    gc();
    intrp.start();
    // .start() will create a zero-delay timeout to check for sleeping
    // tasks to awaken.  Snooze briefly to allow it to run, after
    // which there should be no outstanding timeouts.  This will
    // ensure that we verify .createThreadForSrc() frobs .start() to get
    // things going again.
    await snooze(0);
    intrp.createThreadForSrc(src);
    await snooze(29);
    intrp.pause();
  } catch (e) {
    t.crash(name, util.format('%s\n%s', src, e.stack));
    return;
  } finally {
    intrp.stop();
  }
  let r = intrp.getValueFromScope(intrp.global, 'x');
  const expected = 2;
  t.expect(name, r, 2, src + '\n(after 29ms)');

  // Check that .pause() actually paused execution.
  name = 'testPause';
  await snooze(10);
  r = intrp.getValueFromScope(intrp.global, 'x');
  t.expect(name, r, expected, src + '\n(after 39ms)');
};

///////////////////////////////////////////////////////////////////////////////
// Tests: builtins
///////////////////////////////////////////////////////////////////////////////

/**
 * Run some tests of the various constructors and their associated
 * literals and prototype objects.
 * @param {!T} t The test runner object.
 */
exports.testClasses = function(t) {
  const classes = {
    Object: {
      prototypeProto: 'null',
      literal: '{}'
    },
    Function: {
      prototypeType: 'function',
      literal: 'function(){}'
    },
    Array: {
      literal: '[]'
    },
    RegExp: {
      prototypeClass: 'Object', // Was 'RegExp' in ES5.1.
      literal: '/foo/'
    },
    Date: {
      prototypeClass: 'Object', // Was 'RegExp' in ES5.1.
      functionNotConstructor: true  // Date() doesn't construct.
    },
    Error: {},
    EvalError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    RangeError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    ReferenceError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    SyntaxError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    TypeError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    URIError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    PermissionError: {
      prototypeProto: 'Error.prototype',
      class: 'Error'
    },
    Boolean: {
      literal: 'false',
      literalType: 'boolean',
      noInstance: true,
    },
    Number: {
      literal: '42',
      literalType: 'number',
      noInstance: true,
    },
    String: {
      literal: '"hello"',
      literalType: 'string',
      noInstance: true,
    },
    WeakMap: {
      prototypeClass: 'Object',
      functionNotConstructor: true  // WeakMap() can't be called without new.
    },
  };
  for (const c in classes) {
    const tc = classes[c];
    // Check constructor is a function:
    let name = c + 'IsFunction';
    let src = 'typeof ' + c + ';';
    runSimpleTest(t, name, src, 'function');
    // Check constructor's proto is Function.prototype
    name = c + 'ProtoIsFunctionPrototype';
    src = 'Object.getPrototypeOf(' + c + ') === Function.prototype;';
    runSimpleTest(t, name, src, true);
    // Check prototype is of correct type:
    const prototypeType = (tc.prototypeType || 'object');
    name = c + 'PrototypeIs' + prototypeType;
    src = 'typeof ' + c + '.prototype;';
    runSimpleTest(t, name, src, prototypeType);
    // Check prototype has correct class:
    const prototypeClass = (tc.prototypeClass || tc.class || c);
    name = c + 'PrototypeClassIs' + prototypeClass;
    src = 'Object.prototype.toString.apply(' + c + '.prototype);';
    runSimpleTest(t, name, src, '[object ' + prototypeClass + ']');
    // Check prototype has correct proto:
    const prototypeProto = (tc.prototypeProto || 'Object.prototype');
    name = c + 'PrototypeProtoIs' + prototypeProto;
    src = 'Object.getPrototypeOf(' + c + '.prototype) === ' +
        prototypeProto + ';';
    runSimpleTest(t, name, src, true);
    // Check prototype's .constructor is constructor:
    name = c + 'PrototypeConstructorIs' + c;
    src = c + '.prototype.constructor === ' + c + ';';
    runSimpleTest(t, name, src, true);

    const cls = tc.class || c;
    if (!tc.noInstance) {
      // Check instance's type:
      name = c + 'InstanceIs' + prototypeType;
      src = 'typeof (new ' + c + ');';
      runSimpleTest(t, name, src, prototypeType);
      // Check instance's proto:
      name = c + 'InstancePrototypeIs' + c + 'Prototype';
      src = 'Object.getPrototypeOf(new ' + c + ') === ' + c + '.prototype;';
      runSimpleTest(t, name, src, true);
      // Check instance's class:
      name = c + 'InstanceClassIs' + cls;
      src = 'Object.prototype.toString.apply(new ' + c + ');';
      runSimpleTest(t, name, src, '[object ' + cls + ']');
      // Check instance is instanceof its contructor:
      name = c + 'InstanceIsInstanceof' + c;
      src = '(new ' + c + ') instanceof ' + c + ';';
      runSimpleTest(t, name, src, true);
      if (!tc.functionNotConstructor) {
        // Recheck instances when constructor called as function:
        // Recheck instance's type:
        name = c + 'ReturnIs' + prototypeType;
        src = 'typeof ' + c + '();';
        runSimpleTest(t, name, src, prototypeType);
        // Recheck instance's proto:
        name = c + 'ReturnPrototypeIs' + c + 'Prototype';
        src = 'Object.getPrototypeOf(' + c + '()) === ' + c + '.prototype;';
        runSimpleTest(t, name, src, true);
        // Recheck instance's class:
        name = c + 'ReturnClassIs' + cls;
        src = 'Object.prototype.toString.apply(' + c + '());';
        runSimpleTest(t, name, src, '[object ' + cls + ']');
        // Recheck instance is instanceof its contructor:
        name = c + 'ReturnIsInstanceof' + c;
        src = c + '() instanceof ' + c + ';';
        runSimpleTest(t, name, src, true);
      }
    }
    if (tc.literal) {
      // Check literal's type:
      const literalType = (tc.literalType || prototypeType);
      name = c + 'LiteralIs' + literalType;
      src = 'typeof (' + tc.literal + ');';
      runSimpleTest(t, name, src, literalType);
      // Check literal's proto:
      name = c + 'LiteralPrototypeIs' + c + 'Prototype';
      src = 'Object.getPrototypeOf(' + tc.literal + ') === ' + c +
          '.prototype;';
      runSimpleTest(t, name, src, true);
      // Check literal's class:
      name = c + 'LiteralClassIs' + cls;
      src = 'Object.prototype.toString.apply(' + tc.literal + ');';
      runSimpleTest(t, name, src, '[object ' + cls + ']');
      // Primitives can never be instances.
      if (literalType === 'object' || literalType === 'function') {
        // Check literal is instanceof its contructor.
        name = c + 'LiteralIsInstanceof' + c;
        src = '(' + tc.literal + ') instanceof ' + c + ';';
        runSimpleTest(t, name, src, true);
      }
    }
  }
};

/**
 * Run a test of multiple simultaneous calls to Array.prototype.join.
 * @param {!T} t The test runner object.
 */
exports.testArrayPrototypeJoinParallelism = function(t) {
  let src = `
      // Make String() do a suspend(), to tend to cause multiple
      // simultaneous .join() calls become badly interleved with each
      // other.
      String = function(value) {
        suspend();
        return (new 'String')(value);  // Call original.
      };

      var arr = [1, [2, [3, [4, 5]]]];
      // Set up another Array.prototype.join traversing a subset of
      // the same objects to screw with us.
      new Thread(function() {arr[1].join();});
      // Try to do the join anyway.
      arr.join()
  `;
  runTest(t, 'Array.prototype.join parallel', src, '1,2,3,4,5');
};

/**
 * Run some tests of Number.toString(radix) with various different
 * radix arguments.
 * @param {!T} t The test runner object.
 */
exports.testNumberToString = function(t) {
  const cases = [
    ['(42).toString()', '42'],
    ['(42).toString(16)', '2a'],
    //['(-42.4).toString(5)', '-132.2'], Node incorrectly reports '-132.144444'.
    ['(42).toString("2")', '101010'],
    ['(-3.14).toString()', '-3.14'],
    ['(999999999999999999999999999).toString()', '1e+27'],
    ['(NaN).toString()', 'NaN'],
    ['(Infinity).toString()', 'Infinity'],
    ['(-Infinity).toString()', '-Infinity'],
  ];
  for (const tc of cases) {
    const src = tc[0] + ';';
    runSimpleTest(t, 'testNumberToString: ' + tc[0], src, tc[1]);
  }
};

/**
 * Run tests of the server side of the networking subsystem
 * (connectionListen et al.)
 * @param {!T} t The test runner object.
 */
exports.testServing = async function(t) {
  // Run a test of connectionListen() and connectionUnlisten(), and
  // of the server receiving data using the .receive and .end methods
  // on a connection object.
  let name = 'testServerInbound';
  let src = `
      var data = '', conn = {};
      conn.onReceive = function(d) {
        data += d;
      };
      conn.onEnd = function() {
        CC.connectionClose(this);
        CC.connectionUnlisten(8888);
        resolve(data);
      };
      CC.connectionListen(8888, conn);
      send();
   `;
  function createSend(intrp) {
    intrp.global.createMutableBinding('send', intrp.createNativeFunction(
        'send', function() {
          // Send some data to server.
          const client = net.createConnection({port: 8888}, function() {
            client.write('foo');
            client.write('bar');
            client.end();
          });
        }));
  };
  await runAsyncTest(t, name, src, 'foobar', {
    options: {noLog: ['net']},
    onCreate: createSend
  });

  // Run a test of the connectionListen(), connectionUnlisten(),
  // connectionWrite() and connectionClose functions.
  name = 'testServerOutbound';
  src = `
      var conn = {};
      conn.onConnect = function() {
        CC.connectionWrite(this, 'foo');
        CC.connectionWrite(this, 'bar');
        CC.connectionClose(this);
      };
      CC.connectionListen(8888, conn);
      resolve(receive());
      CC.connectionUnlisten(8888);
   `;
  function createReceive(intrp) {
    intrp.global.createMutableBinding('receive', new intrp.NativeFunction({
      name: 'receive', length: 0,
      call: function(intrp, thread, state, thisVal, args) {
        let reply = '';
        const rr = intrp.getResolveReject(thread, state);
        // Receive some data from the server.
        const client = net.createConnection({port: 8888}, function() {
          client.on('data', function(data) {
            reply += data;
          });
          client.on('end', function() {
            rr.resolve(reply);
          });
          client.on('error', function() {
            rr.reject();
          });
        });
        return Interpreter.FunctionResult.Block;
      }
    }));
  };
  await runAsyncTest(t, name, src, 'foobar', {
    options: {noLog: ['net']},
    onCreate: createReceive,
  });

  // Check to make sure that connectionListen() throws if attempting
  // to bind to an invalid port or rebind a port already in use.
  name = 'testConnectionListenThrows';
  const server = new net.Server();
  server.listen(8887);
  src = `
      // Some invalid ports:
      // * 8887 is in use by the above net.Server.
      // * 8888 will be in-use by via previous connectionListen.
      // * Others are not integers or are out-of-range.
      var ports = ['foo', {}, -1, 80.8, 8887, 8888, 65536];
      try {
        CC.connectionListen(8888, {});
        for (var i = 0; i < ports.length; i++) {
          try {
            CC.connectionListen(ports[i], {});
            resolve('Unexpected success listening on port ' + ports[i]);
          } catch (e) {
            if (!(e instanceof Error)) {
              resolve('threw non-Error value ' + String(e));
            }
          }
        }
      } finally {
        CC.connectionUnlisten(8888);
      }
      resolve('OK');
   `;
  await runAsyncTest(t, name, src, 'OK', {options: {noLog: ['net']}});
  server.close();

  // Check to make sure that connectionUnlisten() throws if attempting
  // to unbind an invalid or not / no longer bound port.
  name = 'testConnectionUnlistenThrows';
  src = `
      var ports = ['foo', {}, -1, 22, 80.8, 4567, 8888, 65536];
      CC.connectionListen(8888, {});
      CC.connectionUnlisten(8888, {});
      for (var i = 0; i < ports.length; i++) {
        try {
          CC.connectionUnlisten(ports[i], {});
          resolve('Unexpected success unlistening on port ' + ports[i]);
        } catch (e) {
          if (!(e instanceof Error)) {
            resolve('threw non-Error value ' + String(e));
          }
        }
      }
      resolve('OK');
   `;
  await runAsyncTest(t, name, src, 'OK', {options: {noLog: ['net']}});

  // Check to make sure that connectionWrite() throws if attempting to
  // write anything not a string or to anything not a connected
  // object.
  name = 'testConnectionWriteThrows';
  src = `
      var conn = {toString: function() {return 'an open connection';}};
      conn.onConnect = function() {
        var cases = [
          {obj: undefined, data: 'fine'},
          {obj: null, data: 'fine'},
          {obj: 42, data: 'fine'},
          {obj: true, data: 'fine'},
          {obj: 'a string', data: 'fine'},
          {obj: {/* not connected */}, data: 'fine'},
          {obj: this, data: undefined},
          {obj: this, data: null},
          {obj: this, data: 42},
          {obj: this, data: true},
          {obj: this, data: {}},
        ];
        for (var tc, i = 0; (tc = cases[i]); i++) {
          try {
            CC.connectionWrite(tc.obj, tc.data);
            resolve('Unexpected success writing ' + tc.data +
                    ' to ' + String(tc.obj));
          } catch (e) {
            if (!(e instanceof TypeError)) {
              resolve('threw non-TypeError value ' + String(e));
            }
          }
        }
        CC.connectionClose(this);
        resolve('OK');
      };
      CC.connectionListen(8888, conn);
      try {
        receive();
      } finally {
        CC.connectionUnlisten(8888);
      }
   `;
  await runAsyncTest(t, name, src, 'OK', {
    options: {noLog: ['net']},
    onCreate: createReceive,
  });

  // Run a test to make sure listening sockets survive the interpreter
  // being paused and restarted.
  name = 'testServerPauseStart';
  src = `
      var data = '', conn = {};
      conn.onReceive = function(d) {
        data += d;
      };
      conn.onEnd = function() {
        CC.connectionClose(this);
        CC.connectionUnlisten(8888);
        resolve(data);
      };
      CC.connectionListen(8888, conn);
      pause();
      send();
   `;
  function createPauseAndSend(intrp) {
    intrp.global.createMutableBinding('pause', intrp.createNativeFunction(
        'pause', function() {
          intrp.pause();
          intrp.start();
        }));
    createSend(intrp);
  };
  await runAsyncTest(t, name, src, 'foobar', {
    options: {noLog: ['net']},
    onCreate: createPauseAndSend
  });

  // Run a test to make sure listening sockets are re-listened after
  // the interpreter is stopped and restarted.
  name = 'testServerStopStart';
  src = `
      var data = '', conn = {};
      conn.onReceive = function(d) {
        data += d;
      };
      conn.onEnd = function() {
        CC.connectionClose(this);
        CC.connectionUnlisten(8888);
        resolve(data);
      };
      CC.connectionListen(8888, conn);
      stop();
      send();
   `;
  function createStopAndSend(intrp) {
    intrp.global.createMutableBinding('stop', intrp.createNativeFunction(
        'stop', function() {
          intrp.stop();
          intrp.start();
        }));
    createSend(intrp);
  };
  await runAsyncTest(t, name, src, 'foobar', {
    options: {noLog: ['net']},
    onCreate: createStopAndSend
  });
};

/**
 * Run tests of the client side of the networking subsystem (xhr).
 * @param {!T} t The test runner object.
 */
exports.testClient = async function(t) {
  // Run test of the xhr() function using HTTP.
  let name = 'testXhrHttp';
  const httpTestServer = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('OK HTTP: ' + req.url);
  }).listen(9980);
  let src = `
      try {
        resolve(CC.xhr('http://localhost:9980/foo'));
      } catch (e) {
        reject(e);
      }
  `;
  await runAsyncTest(t, name, src, 'OK HTTP: /foo',
                     {options: {noLog: ['net']}});
  httpTestServer.close();

  // Run test of the xhr() function using HTTPS.
  // TODO(cpcallen): Don't depend on external webserver.
  name = 'testXhr';
  src = `
      try {
        resolve(CC.xhr('https://neil.fraser.name/software/JS-Interpreter/' +
            'demos/async.txt'));
      } catch (e) {
        reject(e);
      }
  `;
  await runAsyncTest(t, name, src, 'It worked!\n', {options: {noLog: ['net']}});
};
