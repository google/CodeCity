/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
