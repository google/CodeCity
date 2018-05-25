/**
 * @license
 * Code City: Testing code.
 *
 * Copyright 2018 Google Inc.
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
 * @fileoverview Test language extensions related to errors.
 * @author cpcallen@google.com (Christopher Allen)
 */

tests.errorStack = function() {
  // Use eval to make parsing .stack easier.
  var e = eval('new Error;');
  var lines = e.stack.split('\n');
  console.assert(lines[0].match(/at "new Error;" 1:1/), 'new Error has .stack');

  try {
    (function buggy() {1 instanceof 2;})();
    console.assert(false, "thrown Error wasn't thrown??");
  } catch (e) {
    lines = e.stack.split('\n');
    console.assert(
        lines[0].match(/at buggy 1:1/), 'thrown Error has .stack');
  }
};
