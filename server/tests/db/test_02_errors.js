/**
 * @license
 * Copyright 2018 Google LLC
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
  console.assert(lines[0].trim() === 'at "new Error;" 1:1',
      'new Error has .stack');

  try {
    (function buggy() {1 instanceof 2;})();
    console.assert(false, "thrown Error wasn't thrown??");
  } catch (e) {
    lines = e.stack.split('\n');
    console.assert(lines[0].trim() === 'at buggy 1:19',
        'thrown Error has .stack');
  }

  // Bug #241.
  function foo() {
    switch (1) {
      case 1:
        return undefined.hasNoProperties;
    }
  }
  try {
    foo();
    console.assert(false, "Invalid MemberExpression didn't throw??");
  } catch (e) {
    lines = e.stack.split('\n');
    console.assert(lines[0].trim() === 'at foo 4:16',
        'Invalid MemberExpression escaped blame');
  }

  function bar() {
    return undefinedVariable;
  }
  try {
    bar();
    console.assert(false, "Invalid Identifier didn't throw??");
  } catch (e) {
    lines = e.stack.split('\n');
    console.assert(lines[0].trim() === 'at bar 2:12',
        'Invalid Identifier escaped blame');
  }
};
