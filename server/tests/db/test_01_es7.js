/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
