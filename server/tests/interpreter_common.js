/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Load polyfills for tests.
 * @author fraser@google.com (Neil Fraser)
 */

'use strict';

const fs = require('fs');
const Interpreter = require('../interpreter');

exports.startupFiles = {
  es5: fs.readFileSync('startup/es5.js', 'utf8'),
  es6: fs.readFileSync('startup/es6.js', 'utf8'),
  es7: fs.readFileSync('startup/es7.js', 'utf8'),
  esx: fs.readFileSync('startup/esx.js', 'utf8'),
  cc: fs.readFileSync('startup/cc.js', 'utf8'),
};

/**
 * Create an initialize an Interpreter instance.
 * @param {!Interpreter.Options=} options Interpreter constructor
 *     options.  (Default: see implementation.)
 * @param {boolean=} init Load the standard startup files?  (Default: true.)
 * @return {!Interpreter}
 */
exports.getInterpreter = function(options, init) {
  var intrp = new Interpreter(options);
  if (init || init === undefined) {
    for (const file of Object.values(exports.startupFiles)) {
      intrp.createThreadForSrc(file);
      intrp.run();
    }
  }
  return intrp;
}
