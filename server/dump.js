/**
 * @license
 *
 * Copyright 2018 Google Inc.
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
 * @fileoverview Infrastructure to save the state of an Interpreter as
 *     eval-able JS.  Mainly a wrapper around Dumper, handling
 *     the application of a dupmp configuration.
 * @author cpcallen@google.com (Christohper Allen)
 */
'use strict';

var code = require('./code');
var Interpreter = require('./interpreter');
var Selector = require('./selector');
var {Dumper, Do} = require('./dumper');

/**
 * Dump an Interpreter using a given dump specification.
 * @param {!Interpreter} intrp The interpreter to dump.
 * @param {!Array<SpecEntry>} spec The dump specification.
 */
var dump = function(intrp, spec) {
  var dumper = new Dumper(new Interpreter(), intrp);

  for (var entry, i = 0; entry = spec[i]; i++) {
    if (!entry.contents) continue;
    for (var item, j = 0; item = entry.contents[j]; j++) {
      if (typeof item === 'string') {
        entry.contents[j] = item = {path: item, do: Do.RECURSE};
      }
      var selector = new Selector(item.path);
      dumper.markBinding(selector, Do.SKIP);
    }
  }

  for (var entry, i = 0; entry = spec[i]; i++) {
    dumper.write('////////////////////////////////////////');
    dumper.write('///////////////////////////////////////\n\n');
    dumper.write('// ' + entry.filename + '\n');

    if (entry.contents) {
      for (var item, j = 0; item = entry.contents[j]; j++) {
        selector = new Selector(item.path);
        try {
          dumper.dumpBinding(selector, item.do);
          dumper.write('\n');
        } catch (e) {
          dumper.write('// ', String(e), '\n');
          dumper.write(e.stack.split('\n')
              .map(function (s) {return '//     ' + s + '\n';}));
        }
      }
    } else if (entry.rest) {
      var globalScopeDumper = dumper.getScopeDumper(intrp.global);
      globalScopeDumper.dump(dumper);
    }
  }
};

///////////////////////////////////////////////////////////////////////////////
// Data types used to specify a dump configuration.

/**
 * A processed-and-ready-to-use configuration entry for a single
 * output file.
 * @typedef {{filename: string,
 *            contents: !Array<!ContentEntry>,
 *            rest: boolean}}
 */
var ConfigEntry;

/**
 * A configuration entry as supplied by the caller, possibly omitting
 * or abridging certain information.
 * @typedef {{filename: string,
 *            contents: (!Array<string|!ContentEntry>|undefined),
 *            rest: (boolean|undefined)}}
 */
var SpecEntry;

/**
 * The type of the values of .contents entries of a ConfigEntry.
 * @record
 */
var ContentEntry = function() {};

/**
 * Path is a string like "eval", "Object.prototype" or
 * "$.util.command" identifying the variable or property binding this
 * entry applies to.
 * @type {string}
 */
ContentEntry.prototype.path;

/**
 * Do is what to to do with the specified path.
 * @type {!Do}
 */
ContentEntry.prototype.do;

/**
 * Reorder is a boolean (default: false) specifying whether it is
 * acceptable to allow property or set/map entry entries to be created
 * (by the output JS) in a different order than they apear in the
 * interpreter instance being serialised.  If false, output may
 * contain placeholder entries like:
 *
 *     var obj = {};
 *     obj.foo = undefined;  // placeholder
 *     obj.bar = function() { ... };
 *
 * to allow obj.foo to be defined later while still
 * preserving property order.
 * @type {boolean|undefined}
 */
ContentEntry.prototype.reorder;

///////////////////////////////////////////////////////////////////////////////
// Exports.

exports.dump = dump;
exports.Do = Do;
