/**
 * @license
 * Code City: Startup code.
 *
 * Copyright 2017 Google Inc.
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
 * @fileoverview Polyfills to bring the server's partial JavaScript
 * implementation to include some features of JavaScript 7.
 * @author fraser@google.com (Neil Fraser)
 */


///////////////////////////////////////////////////////////////////////////////
// Array.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

// Polyfill copied from:
// developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/includes
Object.defineProperty(Array.prototype, 'includes', {value: function(searchElement, fromIndex) {
  if (this === null || this === undefined) {
    throw new TypeError('Array.prototype.includes called on ' + this);
  }
  var o = Object(this);
  var len = o.length >>> 0;
  if (len === 0) {
    return false;
  }
  var n = fromIndex | 0;
  var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
  function sameValueZero(x, y) {
    return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
  }
  while (k < len) {
    if (sameValueZero(o[k], searchElement)) {
      return true;
    }
    k++;
  }
  return false;
}, configurable: true, writable: true});
