/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Run the unit tests.
 * @author fraser@google.com (Neil Fraser)
 */

$.system.log('Starting tests');

for (var name in tests) {
  var oldBad = console.badCount;
  try {
    tests[name]();
  } catch (e) {
    console.assert(false, 'CRASH: ' + name + '\n' + e);
  }
  if (oldBad < console.badCount) {
    $.system.log(String(tests[name]));
  }
}

$.system.log('');
$.system.log('Completed tests');
$.system.log('Pass: %d', console.goodCount);
$.system.log('Fail: %d', console.badCount);
