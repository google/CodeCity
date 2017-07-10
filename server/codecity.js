/**
 * @license
 * Code City: Server
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
 * @fileoverview A virtual world of collaborative coding.
 * @author fraser@google.com (Neil Fraser)
 */

// Start with: node codecity.js <DB directory>
'use strict';

const fs = require('fs');
const path = require('path');
const Interpreter = require('./');
const Serializer = require('./serialize.js');

var databaseDirectory;
var interpreter;

function startup() {
  // process.argv is a list containing: ['node', 'codecity.js', 'databaseDir']
  databaseDirectory = process.argv[2];

  // Check that the directory was specified and exists.
  try {
    var files = fs.readdirSync(databaseDirectory);
  } catch (e) {
    console.log('Database not found.\nUsage: node ' + process.argv[1] +
                ' <DB directory>');
    process.exit(1);
  }

  // Find the most recent database file.
  files.sort();
  for (var i = files.length - 1; i >= 0; i--) {
    if (files[i].match(/^\d\d\d\d-\d\d-\d\dT\d\d-\d\d-\d\d(\.\d)?\d?\d?Z?\.city$/)) {
      break;
    }
  }
  if (i === -1) {
    console.log('Unable to find database file in ' + databaseDirectory);
    process.exit(1);
  }

  // Load the database from disk.
  var filename = path.join(databaseDirectory, files[i]);
  try {
    var contents = fs.readFileSync(filename, 'utf8');
  } catch (e) {
    console.log('Unable to open database file: ' + filename +
                '\nCheck permissions.');
    process.exit(1);
  }

  // Convert from text to JSON.
  try {
    contents = JSON.parse(contents);
  } catch (e) {
    console.log('Syntax error in parsing JSON: ' + filename);
    process.exit(1);
  }

  // Load the interpreter.
  interpreter = new Interpreter();
  Serializer.deserialize(contents, interpreter);
  console.log('Database loaded: ' + filename);
  // TODO: Run the interpreter.

  // Checkpoint at regular intervals.
  // TODO: Let the interval be configurable from the database.
  setInterval(checkpoint, 60 * 1000);
}

function checkpoint(callback) {
  console.log('Checkpoint started.');
  var json = Serializer.serialize(interpreter);
  // JSON.stringify(json) would work, but adding linebreaks so that every
  // object is on its own line makes the output more readable.
  var text = [];
  for (var i = 0; i < json.length; i++) {
    text.push(JSON.stringify(json[i]));
  }
  text = '[' + text.join(',\n') + ']';

  var filename = (new Date()).toISOString().replace(/:/g, '-') + '.city';
  filename = path.join(databaseDirectory, filename);
  fs.writeFile(filename, text, function (e) {
    // TODO: Expose success/failure to the database.
    if (e) {
      console.log('Checkpoint failed: ' + filename);
      console.log(e);
    } else {
      console.log('Checkpoint successful: ' + filename);
    }
    callback && callback(e);
  });
}

startup();

// Call checkpoint on server shutdown signal.
process.on('SIGTERM', function() {
  checkpoint(function(e) {
    process.exit(e ? 1 : 0);
  });
});
