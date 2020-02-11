/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Test runner for server tests.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

// Force closure-compiler to compile server and testst/benchmarks (for
// syntax/type checking).  Server could be compiled separately but
// it's faster to have do both in one run.  Tests and benchmark files
// need to be enumerated explicitly because closure-compiler ignores
// require statements with arguments that are not a string literal.
const compileTargets = [
  require('../codecity'),
  require('./code_test'),
  require('./interpreter_test'),
  require('./interpreter_unit_test'),
  require('./interpreter_test'),
  require('./iterable_weakmap_test'),
  require('./iterable_weakset_test'),
  require('./registry_test'),
  require('./selector_test'),
  require('./serialize_test'),

  require('./interpreter_bench'),
  require('./serialize_bench'),
];

// Force compilation of tests/benchmarks (for synta

const fs = require('fs');
const {T, B} = require('./testing');

/**
 * Run benchmarks.
 * @param {!Array} files Filenames containing benchmarks to run.
 */
async function runBenchmarks(files) {
  for (var i = 0; i < files.length; i++) {
    var benchmarks = require(files[i]);
    var b = new B;
    if (!compileTargets.includes(benchmarks)) {
      b.result('WARN', files[i] + ' is not being checked by closure-compiler');
    }
    for (var k in benchmarks) {
      if (k.startsWith('bench') && typeof benchmarks[k] === 'function') {
        try {
          await benchmarks[k](b);
        } catch (e) {
          b.crash(k, e);
        }
      }
    }
  }
}

/**
 * Run tests.
 * @param {!Array} files Filenames containing tests to run.
 */
async function runTests(files) {
  var t = new T;

  for (var i = 0; i < files.length; i++) {
    var tests = require(files[i]);
    if (!compileTargets.includes(tests)) {
      t.result('WARN', files[i] + ' is not being checked by closure-compiler');
    }
    for (var k in tests) {
      if (k.startsWith('test') && typeof tests[k] === 'function') {
        try {
          await tests[k](t);
        } catch (e) {
          t.crash(k, e);
        }
      }
    }
  }

  // Print results summary.
  console.log('\n%s\n', String(t));
}

/**
 * Get list of test filenames matching a particular regexp.
 * @param {!RegExp} pattern RegExp to match.
 * @return {!Array} List of filenames.
 */
function getFiles(pattern) {
  var f = fs.readdirSync(__dirname);  // __dirname is location of this module.
  return f.filter(function (fn) { return pattern.test(fn); }).
      map(function (fn) { return './' + fn; });
}

///////////////////////////////////////////////////////////////////////////////
// Main program
//

(async function main() {
  await runTests(getFiles(/_test.js$/));
  await runBenchmarks(getFiles(/_bench.js$/));
})();
