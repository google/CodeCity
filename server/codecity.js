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
CodeCity.config = null;

/**
 * Start a running instance of Code City.  May be called on a command line.
 * @param {string=} opt_configFile Path and filename of configuration file.
 * If not present, look for the configuration file as a command line parameter.
 */
CodeCity.startup = function(opt_configFile) {
  // process.argv is a list containing: ['node', 'codecity.js', 'db/google.cfg']
  const configFile = opt_configFile || process.argv[2];
  if (!configFile) {
    console.error('Database directory not found.\n' +
        'Usage: node %s <DB directory>', process.argv[1]);
    process.exit(1);
  }
  var contents = CodeCity.loadFile(configFile);
  CodeCity.config = CodeCity.parseJson(contents);

  // Find the most recent database file.
  CodeCity.databaseDirectory = path.dirname(configFile);
  var files = fs.readdirSync(CodeCity.databaseDirectory);
  files.sort();
  for (var i = files.length - 1; i >= 0; i--) {
    if (files[i].match(
        /^\d{4}-\d\d-\d\dT\d\d\.\d\d\.\d\d(\.\d{1,3})?Z?\.city$/)) {
      break;
    }
  }
  // Load the interpreter.
  CodeCity.interpreter = new Interpreter({
    trimEval: true,
    trimProgram: true,
    methodNames: true,
  });
  CodeCity.initSystemFunctions();
  if (i === -1) {
    // Database not found, load one or more startup files instead.
    console.log('Unable to find database file in %s, looking for startup ' +
        'file(s) instead.', CodeCity.databaseDirectory);
    var fileCount = 0;
    for (var i = 0; i < files.length; i++) {
      if (files[i].match(/^(core|test).*\.js$/)) {
        var filename = path.join(CodeCity.databaseDirectory, files[i]);
        var contents = CodeCity.loadFile(filename);
        console.log('Loading startup file %s', filename);
        CodeCity.interpreter.createThreadForSrc(contents);
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
    contents = CodeCity.parseJson(contents);

    Serializer.deserialize(contents, CodeCity.interpreter);
    console.log('Database loaded: %s', filename);
  }

  // Checkpoint at regular intervals.
  // TODO: Let the interval be configurable from the database.
  var interval = CodeCity.config.checkpointInterval || 600;
  if (interval > 0) {
    setInterval(CodeCity.checkpoint, interval * 1000);
  }

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
    return fs.readFileSync(filename, 'utf8').toString();
  } catch (e) {
    console.error('Unable to open file: %s', filename);
    console.info(e);
    process.exit(1);
  }
};

/**
 * Parse text as JSON value.  Die if there's an error.
 * @param {string} text
 * @return {*} JSON value.
 */
CodeCity.parseJson = function(text) {
  // Convert from text to JSON.
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Syntax error in parsing JSON: %s', filename);
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
  console.log('Checkpointing...');
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
  var tmpFilename = filename + '.partial';
  try {
    fs.writeFileSync(tmpFilename, text);
    fs.renameSync(tmpFilename, filename);
    console.log('Checkpoint complete.');
  } catch (e) {
    console.error('Checkpoint failed!  ' + e);
  } finally {
    // Attempt to remove partially-written checkpoint if it still exists.
    try {
      fs.unlinkSync(tmpFilename);
    } catch (e) {
    }
  }
};

/**
 * Shutdown Code City.  Checkpoint the database before terminating.
 * Optional parameter is exit code (if numeric) or signal to (re-)kill
 * process with (if string).  Re-killing after checkpointing allows
 * systemd to accurately determine cause of death.  Defaults to 0.
 * @param {string|number=} code Exit code or signal.
 */
CodeCity.shutdown = function(code) {
  CodeCity.checkpoint(true);
  if (typeof code === 'string') {
    process.kill(process.pid, code);
  } else {
    process.exit(code || 0);
  }
};

/**
 * Print one line to the log.  Allows for interpolated strings.
 * @param {...*} var_args Arbitrary arguments for console.log.
 */
CodeCity.log = function(var_args) {
  console.log.apply(console, arguments);
};

/**
 * Initialize user-callable system functions.
 * These are not part of any JavaScript standard.
 */
CodeCity.initSystemFunctions = function() {
  var intrp = CodeCity.interpreter;
  intrp.createNativeFunction('CC.log', CodeCity.log, false);
  intrp.createNativeFunction('CC.checkpoint', CodeCity.checkpoint, false);
  intrp.createNativeFunction('CC.shutdown', function(code) {
    CodeCity.shutdown(Number(code));
  }, false);
};

// If this file is executed form a command line, startup Code City.
// Otherwise, if it is required as a library, do nothing.
if (require.main === module) {
  CodeCity.startup();

  // SIGTERM and SIGINT shut down server.
  process.once('SIGTERM', CodeCity.shutdown.bind(null, 'SIGTERM'));
  process.once('SIGINT', CodeCity.shutdown.bind(null, 'SIGINT'));

  // SIGHUP forces checkpoint.
  process.on('SIGHUP', CodeCity.checkpoint.bind(null, false));
}

module.exports = CodeCity;
