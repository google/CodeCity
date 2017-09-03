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
const Interpreter = require('./interpreter');
const Serializer = require('./serialize');

var CodeCity = {};
CodeCity.databaseDirectory = '';
CodeCity.interpreter = null;

/**
 * Start a running instance of Code City.  May be called on a command line.
 * @param {string=} opt_databaseDirectory Directory containing either a .city
 * database or startup files.  If not present, look for the directory
 * as a command line parameter.
 */
CodeCity.startup = function(opt_databaseDirectory) {
  // process.argv is a list containing: ['node', 'codecity.js', 'databaseDir']
  CodeCity.databaseDirectory = opt_databaseDirectory || process.argv[2];

  // Check that the directory was specified and exists.
  try {
    var files = fs.readdirSync(CodeCity.databaseDirectory);
  } catch (e) {
    console.error('Database directory not found.\nUsage: node %s <DB directory>',
                  process.argv[1]);
    if (CodeCity.databaseDirectory) {
      console.info(e);
    }
    process.exit(1);
  }

  // Find the most recent database file.
  files.sort();
  for (var i = files.length - 1; i >= 0; i--) {
    if (files[i].match(/^\d{4}-\d\d-\d\dT\d\d\.\d\d\.\d\d(\.\d{1,3})?Z?\.city$/)) {
      break;
    }
  }
  // Load the interpreter.
  CodeCity.interpreter = new Interpreter();
  CodeCity.initSystemFunctions();
  if (i === -1) {
    // Database not found, load one or more startup files instead.
    console.log('Unable to find database file in %s, looking for startup file(s) instead.',
                CodeCity.databaseDirectory);
    var fileCount = 0;
    for (var i = 0; i < files.length; i++) {
      if (files[i].match(/^(core|test).*\.js$/)) {
        var filename = path.join(CodeCity.databaseDirectory, files[i]);
        var contents = CodeCity.loadFile(filename);
        console.log('Loading startup file %s', filename);
        CodeCity.interpreter.createThread(contents);
        fileCount++;
      }
    }
    if (fileCount === 0) {
      console.error('Unable to find startup file(s) in %s',
                    CodeCity.databaseDirectory);
      process.exit(1);
    }
    console.log('Loaded %d startup file(s).', fileCount);
  } else {
    var filename = path.join(CodeCity.databaseDirectory, files[i]);
    var contents = CodeCity.loadFile(filename);

    // Convert from text to JSON.
    try {
      contents = JSON.parse(contents);
    } catch (e) {
      console.error('Syntax error in parsing JSON: %s', filename);
      console.info(e);
      process.exit(1);
    }

    Serializer.deserialize(contents, CodeCity.interpreter);
    console.log('Database loaded: %s', filename);
  }

  // Checkpoint at regular intervals.
  // TODO: Let the interval be configurable from the database.
  setInterval(CodeCity.checkpoint, 60 * 1000);

  console.log('Load complete.  Starting Code City.');
  CodeCity.interpreter.start();
};

/**
 * Open a file and read its contents.  Die if there's an error.
 * @param {string} filename
 * @return {string} File contents.
 */
CodeCity.loadFile = function(filename) {
  // Load the specified file from disk.
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch (e) {
    console.error('Unable to open file: %s\nCheck permissions.', filename);
    console.info(e);
    process.exit(1);
  }
};

/**
 * Save the database to disk.
 * @param {boolean} sync True if Code City intends to shutdown afterwards.
 * False if Code City is running this in the background.
 */
CodeCity.checkpoint = function(sync) {
  console.log('Checkpoint!');
  try {
    CodeCity.interpreter.pause();
    var json = Serializer.serialize(CodeCity.interpreter);
  } finally {
    sync || CodeCity.interpreter.start();
  }
  // JSON.stringify(json) would work, but adding linebreaks so that every
  // object is on its own line makes the output more readable.
  var text = [];
  for (var i = 0; i < json.length; i++) {
    text.push(JSON.stringify(json[i]));
  }
  text = '[' + text.join(',\n') + ']';

  var filename = (new Date()).toISOString().replace(/:/g, '.') + '.city';
  filename = path.join(CodeCity.databaseDirectory, filename);
  fs.writeFileSync(filename, text);
};

/**
 * Shutdown Code City.  Checkpoint the database before terminating.
 */
CodeCity.shutdown = function() {
  CodeCity.checkpoint(true);
  process.exit(0);
};

/**
 * Print one line to the log.  Allows for interpolated strings.
 * @param {...*} var_args Arbitrary arguments for console.log.
 */
CodeCity.log = function(var_args) {
  console.log.apply(console.log, arguments);
};

/**
 * Initialize user-callable system functions.
 * These are not part of any JavaScript standard.
 */
CodeCity.initSystemFunctions = function() {
  var intrp = CodeCity.interpreter;
  intrp.createNativeFunction('$.system.log', CodeCity.log, false);
  intrp.createNativeFunction('$.system.checkpoint', CodeCity.checkpoint, false);
  intrp.createNativeFunction('$.system.shutdown', CodeCity.shutdown, false);
};

// If this file is executed form a command line, startup Code City.
// Otherwise, if it is required as a library, do nothing.
if (require.main === module) {
  CodeCity.startup();
  // Call checkpoint on server shutdown signal.
  process.on('SIGTERM', function() {
    CodeCity.shutdown();
  });
  process.on('SIGINT', function() {
    CodeCity.shutdown();
  });
}

module.exports = CodeCity;
