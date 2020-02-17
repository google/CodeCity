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
 * @fileoverview Test the ES7 functions of the server.
 * @author fraser@google.com (Neil Fraser)
 */

///////////////////////////////////////////////////////////////////////////////
// Array and Array.prototype

tests.ArrayPrototypeIncludes = function() {
  console.assert([1, 2, 3, 2, 1].includes(2), 'Array.prototype.includes');
  console.assert(![1, 2, 3, 2, 1].includes(4),
      'Array.prototype.includes not found');
  console.assert([1, 2, 3, 2, 1].includes(2, 2),
      'Array.prototype.includes(..., +)');
  console.assert([1, 2, 3, 2, 1].includes(1, -3),
      'Array.prototype.includes(..., -)');
  console.assert(['x', NaN, 'y'].includes(NaN),
      'Array.prototype.includes NaN');

  var o = {0: 1, 1: 2, 2: 3, 3: 2, 4: 1, length: 5};
  console.assert(Array.prototype.includes.call(o, 2),
      'Array.prototype.includes.call(array-like, ...)');
};
