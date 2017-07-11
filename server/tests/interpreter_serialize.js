/**
 * @license
 * Code City: Interpreter JS Tests
 *
 * Copyright 2017 Google Inc.
 * https://github.com/NeilFraser/CodeCity
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
 * @fileoverview Serialization/deserialization tests for JavaScript interpreter.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

const Interpreter = require('../interpreter');
const autoexec = require('../autoexec');
const Serializer = require('../serialize');
const util = require('util');

/**
 * Run a round trip serialization-deserialization.
 * @param {T} t The test runner object.
 */
exports.testRoundtrip = function(t) {
  var interpreter = new Interpreter();
  interpreter.appendCode(autoexec);
  interpreter.run();

  var err = undefined;
  var src = `
  var x = 1;
  for (var i = 0; i < 8; i++) {
    x *= 2;
  }
  x;
  `;
  try {
    interpreter.appendCode(src);
    for (var i = 0; i < 100; i++) {
      interpreter.step();
    }
    var json = Serializer.serialize(interpreter);
  } catch (e) {
    err = e;
  }

  if (err) {
    t.crash('Serialize', util.format('%s', err.stack));
  } else if (!json) {
    t.fail('Serialize', util.format('got: %s', src, String(json)));
  } else {
    t.pass('Serialize');
  }

  var interpreter = new Interpreter();

  err = undefined;
  try {
    Serializer.deserialize(json, interpreter);
    interpreter.run();
  } catch (e) {
    err = e;
  }

  if (err) {
    t.crash('Deserialize', util.format('%s', err.stack));
  } else if (interpreter.value != 256) {
    t.fail('Deserialize', util.format('got: %s  want: %s',
        String(interpreter.value), '256'));
  } else {
    t.pass('Deserialize');
  }
};
