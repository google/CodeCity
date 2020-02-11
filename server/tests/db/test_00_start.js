/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Mock up a basic console.
 * @author fraser@google.com (Neil Fraser)
 */

var console = {};
console.log = $.system.log;
console.assert = function(value, message) {
  if (value) {
    console.goodCount++;
  } else {
    $.system.log('FAIL:\t%s', message);
    console.badCount++;
  }
};

// Counters for unit test results.
console.goodCount = 0;
console.badCount = 0;

var tests = {};
