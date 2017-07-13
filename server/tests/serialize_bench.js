/**
 * @license
 * Code City: Interpreter JS Tests
 *
 * Copyright 2017 Google Inc.
 * https://github.com/NeilFraser/CodeCity
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
const autoexec = require('../autoexec');
const Serializer = require('../serialize');

/**
 * Run a benchmark of the interpreter after being
 * serialized/deserialized.
 * @param {!B} b The benchmark runner object.
 * @param {string} name The name of the test.
 * @param {string} src The code to be evaled.
 */
function runInterpreterBench(b, name, src) {
  for (var i = 0; i < 4; i++) {
    var intrp1 = new Interpreter;
    intrp1.appendCode(autoexec);
    intrp1.run();

    var err = undefined;
    try {
      intrp1.appendCode(src);
      var json = Serializer.serialize(intrp1);
      var intrp2 = new Interpreter;
      Serializer.deserialize(json, intrp2);
      b.start(name, i);
      intrp2.run();
      b.end(name, i);
    } catch (err) {
      b.crash(name, util.format('%s\n%s', src, err.stack));
    }
  }
};

/**
 * Run the fibbonacci10k benchmark.
 * @param {B} b The test runner object.
 */
exports.benchResurrectedFibbonacci10k = function(b) {
  var name = 'ressurrectedFibonacci10k';
  var src = `
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
