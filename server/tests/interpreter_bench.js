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

const util = require('util');

const Interpreter = require('../interpreter');
const getInterpreter = require('./interpreter_common').getInterpreter;
const testcases = require('./testcases');

/**
 * Run a benchmark of the interpreter.
 * @param {!B} b The benchmark runner object.
 * @param {string} name The name of the test.
 * @param {string} setup Source to be evaled to set up benchmark environment.
 * @param {string} timed Source to be evaled and timed.
 */
function runBench(b, name, setup, timed) {
  for (let i = 0; i < 4; i++) {
    const interpreter = getInterpreter();

    const err = undefined;
    try {
      interpreter.createThreadForSrc(setup);
      interpreter.run();
      interpreter.createThreadForSrc(timed);
      b.start(name, i);
      interpreter.run();
      b.end(name, i);
    } catch (err) {
      b.crash(name, util.format('%s\n%s\n%s', setup, timed, err.stack));
    }
  }
};

/**
 * Run the fibbonacci10k benchmark.
 * @param {!B} b The test runner object.
 */
exports.benchFibbonacci10k = function(b) {
  const name = 'fibonacci10k';
  const setup = `
    var fibonacci = function(n, output) {
      var a = 1, b = 1, sum;
      for (var i = 0; i < n; i++) {
        output.push(a);
        sum = a + b;
        a = b;
        b = sum;
      }
    }`;
  const timed = `
    for(var i = 0; i < 10000; i++) {
      var result = [];
      fibonacci(78, result);
    }
    result;
  `;
  runBench(b, name, setup, timed);
};

/**
 * Run some benchmarks of Array.prototype.sort.
 * @param {!B} b The test runner object.
 */
exports.benchSort = function(b) {
  for (const len of [10, 100, 1000, 10000]) {
    const name = 'sort ' + len;
    const setup = `
      var arr = [];
      for (var i = 0; i < ${len}; i++) {
        arr.push(Math.floor(Math.random() * ${len}));
      }`;
    const timed = `
      arr.sort(function(a, b) {return a - b;});
    `;
    runBench(b, name, setup, timed);
  }
};
