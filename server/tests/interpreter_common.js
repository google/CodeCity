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
