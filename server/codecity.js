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
 * @fileoverview A virtual world of collaborative coding.
 * @author fraser@google.com (Neil Fraser)
 */

// Start with: node codecity.js <DB directory>
'use strict';

const acorn = require('acorn');
const crypto = require('crypto');
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
 * @param {string=} configFile Path and filename of configuration file.
 * If not present, look for the configuration file as a command line parameter.
 */
CodeCity.startup = function(configFile) {
  // process.argv is a list containing: ['node', 'codecity.js', 'db/google.cfg']
  configFile = configFile || process.argv[2];
  if (!configFile) {
    console.error('Configuration file not found.\n' +
        'Usage: node %s <config file>', process.argv[1]);
    process.exit(1);
  }
  var contents = CodeCity.loadFile(configFile);
  CodeCity.config = CodeCity.parseJson(contents);

  // Find the most recent database file.
  CodeCity.databaseDirectory = path.join(path.dirname(configFile),
      CodeCity.config.databaseDirectory || './');
  if (!fs.existsSync(CodeCity.databaseDirectory)) {
    console.error('Database directory not found: ' +
        CodeCity.databaseDirectory);
    process.exit(1);
  }
  // Find the most recent database file.
  var checkpoint = CodeCity.allCheckpoints()[0];
  // Load the interpreter.
  CodeCity.interpreter = new Interpreter({
    trimEval: true,
    trimProgram: true,
    methodNames: true,
    stackLimit: 10000,
  });
  CodeCity.initSystemFunctions();
  CodeCity.initLibraryFunctions();
  if (checkpoint) {
    var filename = path.join(CodeCity.databaseDirectory, checkpoint);
    contents = CodeCity.parseJson(CodeCity.loadFile(filename));

    Serializer.deserialize(contents, CodeCity.interpreter);
    console.log('Database loaded: %s', filename);
  } else {
    // Database not found, load one or more startup files instead.
    console.log('Unable to find database file in %s, looking for startup ' +
        'file(s) instead.', CodeCity.databaseDirectory);
    var fileCount = 0;
    var files = fs.readdirSync(CodeCity.databaseDirectory);
    for (var i = 0; i < files.length; i++) {
      if (files[i].match(/^(core|test).*\.js$/)) {
        filename = path.join(CodeCity.databaseDirectory, files[i]);
        contents = CodeCity.loadFile(filename);
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
  }

  // Checkpoint at regular intervals.
  // TODO: Let the interval be configurable from the database.
  var interval = CodeCity.config.checkpointInterval || 600;
  CodeCity.config.checkpointInterval = interval;
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
    console.error('Syntax error in parsing JSON');
    console.info(e);
    process.exit(1);
  }
};

/**
 * Return a list of all currently saved checkpoints, ordered from most
 * to least recent.
 * @return {!Array<string>} Array of filenames for checkpoints.
 */
CodeCity.allCheckpoints = function() {
  var files = fs.readdirSync(CodeCity.databaseDirectory);
  files = files.filter((file) => CodeCity.allCheckpoints.regexp_.test(file));
  files.sort().reverse();
  return files;
};

CodeCity.allCheckpoints.regexp_ =
    /^\d{4}-\d\d-\d\dT\d\d\.\d\d\.\d\d(\.\d{1,3})?Z?\.city$/;


/**
 * Delete as many checkpoints as needed until there's room to fit a new one.
 */
CodeCity.deleteCheckpointsIfNeeded = function() {
  var checkpoints = CodeCity.allCheckpoints();
  var minFiles = Math.max(0, CodeCity.config.checkpointMinFiles || 0);
  if (!checkpoints.length || checkpoints.length < minFiles) {
    return;  // Not enough checkpoints saved.
  }
  // Look up size of last checkpoint.
  var lastCheckpointSize =
      CodeCity.fileSize(checkpoints[checkpoints.length - 1]);
  var directorySize = checkpoints.reduce((sum, fileName) =>
      sum + CodeCity.fileSize(fileName), 0);
  // Budget for a possible 10% growth.
  var estimateNext = directorySize + lastCheckpointSize * 1.1;
  var maxSize = CodeCity.config.checkpointMaxDirectorySize * 1024 * 1024;
  if (typeof maxSize !== 'number') {
    maxSize = Infinity;
  }
  if (estimateNext < maxSize) {
    return;  // There's room.
  }
  // Choose and delete one file.
  var deleteFile = CodeCity.chooseCheckpointToDelete(checkpoints);
  var fullPath = path.join(CodeCity.databaseDirectory, deleteFile);
  console.log('Deleting checkpoint ' + fullPath);
  fs.unlinkSync(fullPath);
  // Do it again, until no delete is needed.
  CodeCity.deleteCheckpointsIfNeeded();
};

/**
 * Given a list of checkpoint filenames, choose one to delete.
 * See https://neil.fraser.name/software/backup/
 * @param {!Array<string>} checkpoints Array of checkpoint filenames.
 * @return {string} Filename of checkpoint to delete.
 */
CodeCity.chooseCheckpointToDelete = function(checkpoints) {
  // Convert all filenames (e.g. '2018-11-09T18.49.50.548Z.city')
  // into ISO-8601 format  (e.g. '2018-11-09T18:49:50.548Z'),
  // then parse as milliseconds.
  var checkpointTimes = checkpoints.map((name) =>
      Date.parse(name.slice(0, -5).replace('.', ':').replace('.', ':')));
  var currentTime = Date.now();
  var totalTime = currentTime - checkpointTimes[checkpointTimes.length - 1];
  var interval = CodeCity.config.checkpointInterval * 1000;
  // Planning to delete one checkpoint.
  var checkpointCount = checkpoints.length - 1;
  // Compute ideal times.
  var missing = Math.max(totalTime / interval - checkpointCount, 0);
  var decayRate = (missing + 1) ** (1 / checkpointCount);
  var idealTimes = new Array(checkpointTimes.length);
  for (var n = 0; n < checkpointTimes.length; n++) {
    idealTimes[n] = currentTime - (interval * (n + decayRate ** n - 1));
  }

  // Choose one backup for deletion.
  // Compute the cumulative error from the right side.  Store in array.
  var rightDiff = new Array(checkpointTimes.length);
  var accumulator = 0;
  for (var n = checkpointTimes.length - 1; n >= 1; n--) {
    accumulator += Math.abs(checkpointTimes[n] - idealTimes[n]);
    rightDiff[n] = accumulator;
  }
  // Compute the cumulative error from the left side (with backups shifted by
  // one position, as would happen after a deletion).
  // Use rightDiff array to compute total error for each possible deletion.
  accumulator = 0;
  var minDiff = Infinity;
  var minIndex = 0;
  for (var n = 1; n < checkpointTimes.length - 1; n++) {
    accumulator += Math.abs(checkpointTimes[n - 1] - idealTimes[n]);
    var diff = accumulator + rightDiff[n + 1];
    if (diff < minDiff) {
      // Smallest total error yet.  Save this candidate.
      minDiff = diff;
      minIndex = n;
    }
  }
  return checkpoints[minIndex];
};

/**
 * Find the size of a file in the current database directory.
 * @param {string} fileName Name of file.
 * @return {number} Number of bytes in file.
 */
CodeCity.fileSize = function(fileName) {
  var fullPath = path.join(CodeCity.databaseDirectory, fileName);
  return fs.statSync(fullPath).size;
};

/**
 * Save the database to disk.
 * @param {boolean} sync True if Code City intends to shutdown afterwards.
 * False if Code City is running this in the background.
 */
CodeCity.checkpoint = function(sync) {
  console.log('Checkpointing...');
  CodeCity.deleteCheckpointsIfNeeded();
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
    console.log('Checkpoint ' + filename + ' complete.');
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
  if (CodeCity.config.checkpointAtShutdown !== false) {
    CodeCity.checkpoint(true);
  }
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
 * BUG(#280): provide (new) NativeFunction wrappers.
 */
CodeCity.initSystemFunctions = function() {
  var intrp = CodeCity.interpreter;
  intrp.createNativeFunction('CC.log', CodeCity.log, false);
  intrp.createNativeFunction('CC.checkpoint', CodeCity.checkpoint, false);
  intrp.createNativeFunction('CC.shutdown', function(code) {
    CodeCity.shutdown(Number(code));
  }, false);
};

/**
 * Initialize user-callable library functions.
 * These are not part of any JavaScript standard.
 */
CodeCity.initLibraryFunctions = function() {
  var intrp = CodeCity.interpreter;

  new intrp.NativeFunction({
    id: 'CC.acorn.parse', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var code = args[0];
      var perms = state.scope.perms;
      if (typeof code !== 'string') {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'argument to parse must be a string');
      }
      try {
        var ast = acorn.parse(code, Interpreter.PARSE_OPTIONS);
      } catch (e) {
        throw intrp.errorNativeToPseudo(e, perms);
      }
      return intrp.nativeToPseudo(ast, perms);
    }
  });

  new intrp.NativeFunction({
    id: 'CC.acorn.parseExpressionAt', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var code = args[0];
      var offset = args[1];
      var perms = state.scope.perms;
      if (typeof code !== 'string') {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'first argument to parseExpressionAt must be a string');
      }
      if (typeof offset !== 'number') {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'second argument to parseExpressionAt must be a number');
      }
      try {
        var ast =
            acorn.parseExpressionAt(code, offset, Interpreter.PARSE_OPTIONS);
      } catch (e) {
        throw intrp.errorNativeToPseudo(e, perms);
      }
      return intrp.nativeToPseudo(ast, perms);
    }
  });

  new intrp.NativeFunction({
    id: 'CC.hash', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var hash = args[0];
      var data = args[1];
      var perms = state.scope.perms;
      var hashes = crypto.getHashes();
      if (!hashes.includes(hash)) {
        throw new intrp.Error(perms, intrp.RANGE_ERROR,
            'first argument to hash must be one of:\n' +
            hashes.map(function(h) {return "    '" + h + "'\n";}).join(''));
      }
      if (typeof data !== 'string') {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'second argument to hash must be a string');
      }
      try {
        return String(crypto.createHash(hash).update(data).digest('hex'));
      } catch (e) {
        throw intrp.errorNativeToPseudo(e, perms);
      }
    }
  });
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
