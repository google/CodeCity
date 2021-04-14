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
 * @fileoverview Serialization/deserialization tests for JavaScript interpreter.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

const net = require('net');
const util = require('util');

const Interpreter = require('../interpreter');
const {getInterpreter} = require('./interpreter_common');
const Serializer = require('../serialize');
const {T} = require('./testing');

///////////////////////////////////////////////////////////////////////////////
// Test helper functions.
///////////////////////////////////////////////////////////////////////////////

/**
 * Serialize an interpreter to JSON, then create and return a new
 * interpreter by deserializing that JSON.
 * @param {!Interpreter} intrp The interpreter to be serialized.
 * @return {?Interpreter} the freshly deserialized interpreter, or
 *     null if an error occurred.
 */
function roundTrip(intrp) {
  intrp.pause();  // Save timer info.
  const json = JSON.stringify(Serializer.serialize(intrp), null, '  ');

  const intrp2 = new Interpreter;
  Serializer.deserialize(JSON.parse(json), intrp2);
  // Deserialized interpreter was stopped, but we want to be able to
  // step/run it, so wake it up to PAUSED.
  intrp2.pause();
  return intrp2;
}

/**
 * Run a (possibly multiple) roundtrip test:
 * - Create an interpreter instance.
 * - Create a thread to eval src1, and run it to completion.
 * - Create a thread to eval src2
 * - Step through src2, periodically serializing and unserializing.
 * - Do a final round-trip serialization, if none done yet.
 * - Create a thread to eval src3, and run it to completion.
 * - Verify value of final expression evaluated is === expected.
 * @param {!T} t The test runner object.
 * @param {string} name The name of the test.
 * @param {string} src1 The code to be evaled before any serialization.
 * @param {string} src2 The code to be evaled while periodically serializing.
 * @param {string} src3 The code to be evaled after final serialization.
 * @param {number|string|boolean|null|undefined} expected The expected
 *     completion value.
 * @param {!TestOptions=} options Custom test options.
 */
function runTest(t, name, src1, src2, src3, expected, options) {
  options = options || {};
  let intrp = getInterpreter(options.options, options.standardInit);
  if (options.onCreate) {
    options.onCreate(intrp);
  }

  let thread;
  try {
    if (src1) {
      thread = intrp.createThreadForSrc(src1).thread;
      intrp.run();
    }
  } catch (e) {
    t.crash(name + 'Pre', e);
    return;
  }

  try {
    if (src2) {
      thread = intrp.createThreadForSrc(src2).thread;
    }
    let trips = 0;
    if (options.steps === undefined) {
      intrp.run();
    } else {
      let s = 0;
      while(intrp.step()) {
        if ((++s % options.steps) === 0) {
          intrp = roundTrip(intrp);
          trips++;
        }
      }
    }
    if (trips === 0) {
      intrp = roundTrip(intrp);
      trips++;
    }
  } catch (e) {
    t.crash(name, e);
    return;
  }

  try {
    intrp.run();
    if (src3) {
      thread = intrp.createThreadForSrc(src3).thread;
      intrp.run();
    }
  } catch (e) {
    t.crash(name + 'Post', e);
    return;
  }

  const r = intrp.pseudoToNative(thread.value);
  const allSrc = util.format(
      '%s\n/* begin roundtrips */\n%s\n/* end roundtrips */\n%s',
      src1, src2, src3);
  t.expect(name, r, expected, allSrc);
};

/**
 * Run a (truly) asynchronous roundtrip test of the interpreter.
 * A new Interpreter instance is created for each test.  Special functions
 * resolve() and reject() are inserted in the global scope; they will
 * end each section of the test.  The caller can additionally supply a
 * callback to be run before starting the interpreter.
 *
 * Full procedure:
 * - Create and initialize an interpreter instance.
 * - Call options.onCreate, if supplied, on first interpreter instance.
 * - Start the interpreter and run src1 (if supplied).
 * - Await a call to resolve() or reject(); abort the test if the latter occurs.
 * - Stop the interpreter.
 * - Serialize interpreter to JSON.
 * - Create second interpreter instance.  Don't initialize it.
 * - Call options.onCreate, if supplied, on second interpreter instance.
 * - Deserialize JSON into second interpreter instance.
 * - Start the second interpreter and allow it to run to completion.
 * - Run src2 (if supplied).
 * - Await a call to resolve() or reject().
 * - If resolve was called, verify the result is as expected.
 * @param {!T} t The test runner object.
 * @param {string} name The name of the test.
 * @param {string} src1 The code to be evaled before serialization.
 * @param {string} src2 The code to be evaled after serialization.
 * @param {number|string|boolean|null|undefined} expected The expected
 *     completion value.
 * @param {!TestOptions=} options Custom test options.
 */
async function runAsyncTest(t, name, src1, src2, expected, options) {
  options = options || {};
  const intrp1 = getInterpreter(options.options, options.standardInit);
  if (options.onCreate) {
    options.onCreate(intrp1);
  }

  let thread;
  // Create promise to signal completion of test from within
  // interpreter.  Awaiting p will block until resolve or reject is
  // called.
  let resolve, reject, result;
  let p = new Promise(function(res, rej) { resolve = res; reject = rej; });
  intrp1.global.createMutableBinding(
      'resolve', intrp1.createNativeFunction('resolve', resolve, false));
  intrp1.global.createMutableBinding(
      'reject', intrp1.createNativeFunction('reject', reject, false));

  try {
    intrp1.start();
    if (src1) {
      intrp1.createThreadForSrc(src1);
    }
    await p;
    intrp1.pause();
  } catch (e) {
    t.crash(name + 'Pre', e);
    return;
  }

  // Serialize.
  let json;
  try {
    json = JSON.stringify(Serializer.serialize(intrp1), null, '  ');
  } catch (e) {
    t.crash(name + 'Serialize', e);
    return;
  }

  intrp1.stop();

  // Restore into new interpreter.
  const intrp2 = getInterpreter(options.options, options.standardInit);
  if (options.onCreate) {
    options.onCreate(intrp2);
  }

  // New promise.
  p = new Promise(function(res, rej) { resolve = res; reject = rej; });
  intrp2.global.createMutableBinding(
      'resolve', intrp2.createNativeFunction('resolve', resolve, false));
  intrp2.global.createMutableBinding(
      'reject', intrp2.createNativeFunction('reject', reject, false));

  try {
    Serializer.deserialize(JSON.parse(json), intrp2);
  } catch (e) {
    t.crash(name + 'Deserialize', e);
    return;
  }

  try {
    intrp2.start();
    if (src2) {
      intrp2.createThreadForSrc(src2);
    }
    result = await p;
  } catch (e) {
    t.crash(name + 'Post', e);
    return;
  } finally {
    intrp2.stop();
  }

  const r = intrp2.pseudoToNative(result);
  const allSrc = util.format('%s\n/* roundtrip */\n%s', src1, src2);
  t.expect(name, r, expected, allSrc);
};

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
 * Load the standard startup files at startup?  (Default: true.)
 * Setting to false speeds up tests with many roundtrips that do not
 * need builtins.
 * @type {boolean|undefined}
 */
TestOptions.prototype.standardInit;

/**
 * Callback to be called after creating new interpreter instance (and
 * running standard starup files, if not suppressed with standardInit:
 * false) but before creating a thread for srcN.  Can be used to
 * insert extra bindings into the global scope (e.g., to create
 * additional builtins).
 *
 * The first argument is the interpreter instance to be configured.
 *
 * @type {function(!Interpreter)|undefined}
 */
TestOptions.prototype.onCreate;

/**
 * How many steps to run between serializations (run src1 to
 * completion if unspecified).
 * @type {number|undefined}
 */
TestOptions.prototype.steps;

///////////////////////////////////////////////////////////////////////////////
// Tests: serialisation
///////////////////////////////////////////////////////////////////////////////

/**
 * Run a round trip serialization-deserialization.
 * @param {!T} t The test runner object.
 */
exports.testRoundtripSimple = function(t) {
  runTest(t, 'testRoundtripSimple', '', `
      var x = 1;
      for (var i = 0; i < 8; i++) {
        x *= 2;
      }
  `, 'x;', 256, {steps: 100});
};

/**
 * Run a round trip of serializing the Interpreter.SCOPE_REFERENCE
 * sentinel and an Interpreter.PropertyIterator.
 *
 * BUG(#193): running this test causes *subsequent* benchmarks to run
 *     about 15% slower for no obvious reason.  Investigate.
 * @param {!T} t The test runner object.
 */
exports.testRoundtripScopeRefAndPropIter = function(t) {
  runTest(t, 'testRoundtripScopeRefAndPropIter', `
      var r = 0, o = {a: 1, b: 2};
  `,`
      for (var k in o) {
        r += o[k];
      }
  `, 'r;', 3, {steps: 1, standardInit: false});
};

/**
 * Run a round trip of serializing WeakMaps.
 * @param {!T} t The test runner object.
 */
exports.testRoundtripWeakMap = function(t) {
  runTest(t, 'testRoundtripWeakMap', `
      var o1 = {};
      var wm = new WeakMap;
      var o2 = {};
      wm.set(o1, 105);
      wm.set(o2, 42);
      var empty = new WeakMap;
  `, '', `
      (empty instanceof WeakMap) && (wm instanceof WeakMap) &&
          wm.get(o1) - wm.get(o2);
  `, 105 - 42);
};

/**
 * Run more detailed tests of the state of the post-rountrip interpreter.
 * @param {!T} t The test runner object.
 */
exports.testRoundtripDetails = function(t) {
  runTest(t, 'testRoundtripPropertyAttributes', `
    var obj = {};
    for (var i = 0; i < 8; i++) {
      var desc = {value: i,
                  writable: !!(i & 0x1),
                  enumerable: !!(i & 0x2),
                  configurable: !!(i & 0x4)};
      Object.defineProperty(obj, i, desc);
    }
  `, '', `
    for (var i = 0; i < 8; i++) {
      desc = Object.getOwnPropertyDescriptor(obj, i);
      if (desc.value !== i ||
          desc.writable !== !!(i & 0x1) ||
          desc.enumerable !== !!(i & 0x2) ||
          desc.configurable !== !!(i & 0x4)) {
        throw new Error('Roundtrip failure for property ' + i);
      }
    }
    'All good';
  `, 'All good');

  runTest(t, 'testRoundtripObjectExtensibility', `
    var ext = {};
    var nonExt = {};
    Object.preventExtensions(nonExt);
  `, '', `
    Object.isExtensible(ext) && !Object.isExtensible(nonExt);
  `, true);

  // Test preservation of prototype identity, including protypes used
  // by various built-in functions.
  //
  // exprs is a large object literal which maps built-in constructors
  // to arrays of values which should all be that constructor's
  // .prototype object.
  const exprs = `{
        Object: [
          Object.prototype,
          new 'Object.prototype',
          Object.getPrototypeOf(new Object),
          Object.getPrototypeOf({}),
          Object.getPrototypeOf(Object.getOwnPropertyDescriptor(
            Object.prototype, 'constructor')),
        ],
        Function: [
          Function.prototype,
          new 'Function.prototype',
          Object.getPrototypeOf(new Function),
          Object.getPrototypeOf(function() {}),
          Object.getPrototypeOf(Function),
        ],
        Array: [
          Array.prototype,
          new 'Array.prototype',
          Object.getPrototypeOf(new Array),
          Object.getPrototypeOf([]),
          Object.getPrototypeOf([].slice(0,0)),
        ],
        Boolean: [
          Boolean.prototype,
          new 'Boolean.prototype',
          Object.getPrototypeOf(false),
        ],
        Number: [
          Number.prototype,
          new 'Number.prototype',
          Object.getPrototypeOf(0),
        ],
        String: [
          String.prototype,
          new 'String.prototype',
          Object.getPrototypeOf(''),
        ],
        RegExp: [
          RegExp.prototype,
          new 'RegExp.prototype',
          Object.getPrototypeOf(new RegExp),
          Object.getPrototypeOf(/foo/),
        ],${['Date', 'Error', 'EvalError', 'RangeError', 'SyntaxError',
             'TypeError', 'URIError', 'PermissionError'].map((c) => `
        ${c}: [
          ${c}.prototype,
          new '${c}.prototype',
          Object.getPrototypeOf(new ${c}),
        ],`).join('')}
      }`;
  runTest(t, 'testRoundtripBuiltinPrototypes', `
      var pre = ${exprs};
  `, '', `
      var post = ${exprs};
      try {
        // Check expressions all had same value intially.
        for (var key in pre) {
          if (!pre.hasOwnProperty(key)) continue;
          for (var i = 1; i < pre[key].length; i++) {
            if (pre[key][0] !== pre[key][i]) {
              throw 'pre["' + key + '"][0] !== pre["' +
                  key + '"][' + i + ']';
            }
          }
        }
        // Check expressions all had same value before and after.
        for (var key in pre) {
          if (!pre.hasOwnProperty(key)) continue;
          for (var i = 0; i < pre[key].length; i++) {
            if (pre[key][i] !== post[key][i]) {
              throw 'pre["' + key + '"][' + i + '] !== post["' +
                  key + '"][' + i + ']';
            }
          }
        }
        'OK';
      } catch (e) {
        e;
      }
  `, 'OK');

  runTest(t, 'testRoundtripArrayLengthRemainsMagical', `
    var arr = [0, 1, 2];
  `, '', `
    arr[3] = 3;
    arr.length;
  `, 4);

};

/**
 * Run tests of post-roundtrip interpreter timers & networking state.
 * @param {!T} t The test runner object.
 */
exports.testRoundtripAsync = async function(t) {
  // Run a test of timer preservation during serialization/deserialization.
  var name = 'testRestoreTimers';
  var src1 = `
      var x = '';
      setTimeout(function() { x += '1'; }, 0);
      setTimeout(function() { resolve(); }, 10);
      setTimeout(function() { x += '3'; }, 20);
      setTimeout(function() { x += '4'; }, 40);
  `;
  var src2 = `
      x += '2';
      setTimeout(function() { resolve(x); }, 11);
  `;
  await runAsyncTest(t, name, src1, src2, '123');

  // Run a test of the server re-listening to sockets after being
  // deserialized.
  name = 'testPostRestoreNetworkInbound';
  src1 = `
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
      resolve();
   `;
  src2 = `
      send();
   `;
  const installSend = function(intrp) {
    intrp.global.createMutableBinding('send', intrp.createNativeFunction(
        'send', function() {
          // Send some data to server.
          var client = net.createConnection({ port: 8888 }, function() {
            client.write('foo');
            client.write('bar');
            client.end();
          });
        }));
  };
  await runAsyncTest(t, name, src1, src2, 'foobar', {
    options: {noLog: ['net']},
    onCreate: installSend,
  });

  // Run a test to verify that the connection object's .error method
  // is called with a suitable Error object if the previously-listened
  // port is in use when the interpreter is restarted.
  name = 'testFailedRelistenFiresError';
  src1 = `
      var connection = {onError: function(err) {resolve(err.name);}};
      CC.connectionListen(8888, connection);
      resolve();  // Start serialisation roundtrip.
   `;
  src2 = `
      suspend();  // Allow pending onError thread to run.
      resolve('No error thrown');
  `;
  let /** number */ count = 0;
  let /** ?net.Server */ server = null;
  const blockPort = function(intrp) {
    if (count++) {  // Do only when creating post-roundtrip Interpreter.
      server = new net.Server();
      server.listen(8888);
    }
  };
  await runAsyncTest(t, name, src1, src2, 'Error', {
    options: {noLog: ['net']},
    onCreate: blockPort,
  });
  server.close();
};
