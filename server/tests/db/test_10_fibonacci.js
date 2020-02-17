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
 * @fileoverview Run a performance stress test.
 * @author fraser@google.com (Neil Fraser)
 */

// Define function as global so that it can be run again
// after checkpoint and restart.
function test_fibonacci10k() {
  for (var run = 1; run <= 3; run++) {
    var start = Date.now();
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
    var ms = Date.now() - start;
    $.system.log('Run #%d fibonacci10k: %d ms', run, ms);
  }
}

$.system.log('Benchmarking fibonacci10k...');
test_fibonacci10k();
