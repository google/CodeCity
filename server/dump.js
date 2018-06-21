/**
 * @license
 * Code City: serialisation to eval-able JS
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
 * @fileoverview Saving the state of the interpreter as eval-able JS.
 * @author cpcallen@google.com (Christohper Allen)
 */
'use strict';

const Interpreter = require('./interpreter.js');

/**
 * Break a selector into an array of parts.
 * @param {string} selector The selector
 * @return {!Array<string>} The parts
 */
var toParts = function(selector) {
  return selector.split('.');
};

/**
 * @typedef {{filename: string,
 *            contents: (!Array<string|ContentEntry>|undefined),
 *            rest: (boolean|undefined)}}
 */
var ConfigEntry;

/**
 * The type of the values of contents: entries of the config spec.
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
 * Do is one of 'prune', 'defer', 'decl', 'set', 'recurse' (default:
 * 'recurse'), specifying what should be done for the specified path.
 * The choices are:
 *
 * - 'prune' will skip the named binding entirely (unless it or an
 *    extension of it is explicitly mentioned in a later config
 *    directive); if the data accessible via the named binding is not
 *    accessible via any other (non-pruned) path from the global scope
 *    it will consequently not be included in the dump.  This option is
 *    intended to cause data loss, so be careful!
 *
 * - 'defer' will skip the named binding for now, but it will be
 *   included in the file with rest: true.
 *
 * - 'decl' will ensure that the specified path exists, but will leave
 *   the value undefined.  If the path is a property, it will not
 *   (yet) be made non-configurable.
 *
 * - 'set' will do what 'decl' does and then ensure that the specified
 *   path is set to its final value (if primitive) or an object of the
 *   correct class (if non-primitive).  It will also ensure the final
 *   property attributes (enumerable, writable and/or configurable)
 *   are set.  If a new object is created to be the value of the
 *   specified path it will not (yet) have its properties or internal
 *   set/map data set (but immutable internal data, such as function
 *   code, must be set at this time).
 *
 * - 'recurse' will do what 'set' does and then additionally do the
 *   same, recursively, to properties and set/map data of the object
 *   which is the value of the specified path.
 * @type {string}
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

/**
 * @constructor
 */
var ConfigNode = function() {
  /** @type {number|undefined} */
  this.firstFileNo = undefined;
  /** @type {!Object<string, !ConfigNode>} */
  this.kids = Object.create(null);
};

/**
 * @param {string} name
 * @return {ConfigNode}
 */
ConfigNode.prototype.kidFor = function(name) {
  if (!this.kids[name]) {
    this.kids[name] = new ConfigNode;
  }
  return this.kids[name];
};

/**
 * @constructor
 * @param {!Array<ConfigEntry>} spec
 */
var Config = function(spec) {
  /** @type {!Array<ConfigEntry>} */
  this.spec = spec;
  /** @type {number|undefined} */
  this.defaultFileNo = undefined;
  /** @type {!ConfigNode} */
  this.tree = new ConfigNode;

  for (var fileNo = 0; fileNo < spec.length; fileNo++) {
    var entry = spec[fileNo];
    if (entry.contents) {
      for (var i = 0; i < entry.contents.length; i++) {
        var content = entry.contents[i];
        if (typeof content === 'string') {
          content = {path: content, do: 'recurse'};
        }
        var parts = toParts(content.path);
        var /** ?ConfigNode */ cn = this.tree;
        for (var j = 0; j < parts.length; j++) {
          cn = cn.kidFor(parts[j]);
        }
        // Now cn is final ConfigNode for path (often a leaf).
        cn.firstFileNo = fileNo;
      }
    }
    if (spec[fileNo].rest) {
      if (this.defaultFileNo !== undefined) {
        throw Error('Only one rest entry permitted');
      }
      this.defaultFileNo = fileNo;
    }
  }
};

var dump = function(intrp, spec) {
  var config = new Config(spec);

};

exports.dump = dump;
