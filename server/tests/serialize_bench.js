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
 * @fileoverview Benchmarks for JavaScript interpreter.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

const Interpreter = require('../interpreter');
const {getInterpreter, startupFiles} = require('./interpreter_common');
const Serializer = require('../serialize');

/**
 * Run a benchmark of the interpreter being serialized/deserialized.
 * @param {!B} b The benchmark runner object.
 * @param {string} name The name of the test.
 * @param {string} src The code to be evaled before roundtripping.
 * @param {function(!Interpreter)=} initFunc Optional function to be
 *     called after creating new interpreter instance but before
 *     running src.  Can be used to insert extra native functions into
 *     the interpreter.  initFunc is called with the interpreter
 *     instance to be configured as its parameter.
 */
function runSerializationBench(b, name, src, initFunc) {
  for (let i = 0; i < 4; i++) {
    const intrp1 = new Interpreter();
    const intrp2 = new Interpreter();
    if (initFunc) {
      initFunc(intrp1);
      initFunc(intrp2);
    }
    const err = undefined;
    try {
      intrp1.createThreadForSrc(src);
      intrp1.run();
      intrp1.stop();
      b.start(name, i);
      let json = Serializer.serialize(intrp1);
      b.end(name + ' serialize', i);
      let str = JSON.stringify(json);
      let len = str.length;
      b.end(name + ' stringify (' + Math.ceil(len / 1024) + 'kiB)', i);
      json = JSON.parse(str);
      b.end(name + ' parse', i);
      Serializer.deserialize(json, intrp2);
      b.end(name + ' deserialize', i);
    } catch (err) {
      b.crash(name, util.format('%s\n%s', src, err.stack));
    }
  }
};

/**
 * Run a benchmark of the interpreter being serialized/deserialized.
 * @param {!B} b The benchmark runner object.
 * @param {string} name The name of the test.
 * @param {string} src The code to be evaled before roundtripping.
 * @param {function(!Interpreter)=} initFunc Optional function to be
 *     called after creating new interpreter instance but before
 *     running src.  Can be used to insert extra native functions into
 *     the interpreter.  initFunc is called with the interpreter
 *     instance to be configured as its parameter.
 */
function runDeserializationBench(b, name, src, initFunc) {
  for (var i = 0; i < 4; i++) {
    const intrp1 = new Interpreter();
    const intrp2 = new Interpreter();
    if (initFunc) {
      initFunc(intrp1);
      initFunc(intrp2);
    }
    const err = undefined;
    try {
      intrp1.createThreadForSrc(src);
      intrp1.run();
      intrp1.stop();
      b.start(name, i);
      const json = Serializer.serialize(intrp1);
      var len = JSON.stringify(json).length;
      Serializer.deserialize(json, intrp2);
      b.end(name + ' (' + Math.ceil(len / 1024) + 'kiB)', i);
    } catch (err) {
      b.crash(name, util.format('%s\n%s', src, err.stack));
    }
  }
};

/**
 * Run a benchmark of the interpreter after being
 * serialized/deserialized.
 * @param {!B} b The benchmark runner object.
 * @param {string} name The name of the test.
 * @param {string} src The code to be evaled.
 */
function runInterpreterBench(b, name, src) {
  for (let i = 0; i < 4; i++) {
    const intrp1 = getInterpreter();
    const intrp2 = new Interpreter();
    try {
      intrp1.createThreadForSrc(src);
      intrp1.stop();
      const json = Serializer.serialize(intrp1);
      Serializer.deserialize(json, intrp2);
      // Deserialized interpreter was stopped, but we want to be able to
      // step/run it, so wake it up to PAUSED.
      intrp2.pause();
      b.start(name, i);
      intrp2.run();
      b.end(name, i);
    } catch (err) {
      b.crash(name, util.format('%s\n%s', src, err.stack));
    } finally {
      intrp2.stop();
    }
  }
};

/**
 * Run benchmarks roundtripping the interpreter.
 * @param {!B} b The test runner object.
 */
exports.benchRoundtrip = function(b) {
  let name = 'Roundtrip demo';
  const demoDir = path.join(__dirname, '../../core');
  const filenames = fs.readdirSync(demoDir);
  filenames.sort();
  let src = '';
  for (const filename of filenames) {
    if (!(filename.match(/.js$/))) continue;
    src += fs.readFileSync(String(path.join(demoDir, filename)));
  }
  const fakeBuiltins = function(intrp) {
    // Hack to install stubs for builtins found in codecity.js.
    const builtins = [
      'CC.log', 'CC.checkpoint', 'CC.shutdown', 'CC.hash',
      'CC.acorn.parse', 'CC.acorn.parseExpressionAt',
    ];
    for (const bi of builtins) {
      new intrp.NativeFunction({id: bi, length: 0,});
    }
  };
  runSerializationBench(b, name, src, fakeBuiltins);
};

/**
 * Run the fibbonacci10k benchmark.
 * @param {!B} b The test runner object.
 */
exports.benchResurrectedFibbonacci10k = function(b) {
  let name = 'ressurrectedFibonacci10k';
  let src = `
    var fibonacci = function(n, output) {
      var a = 1, b = 1, sum;
      for (var i = 0; i < n; i++) {
        output.push(a);
        sum = a + b;
        a = b;
        b = sum;
      }
    }
    for(var i = 0; i < 10000; i++) {
      var result = [];
      fibonacci(78, result);
    }
    result;
  `;
  runInterpreterBench(b, name, src);
};
