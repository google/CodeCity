/**
 * @license
 * Code City: Database Core
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
 * @fileoverview The initial database core.
 * 
 * It's designed to be read into the server (see CodeCity/server) at
 * initial startup time.  It should not be needed after that (the
 * server should save all internal state to a checkpoint file, and
 * subsequent server starts will restore that state), but it is
 * intended to written in such a way that it should be possible to
 * re-run it to update an existing core with newer versions of the
 * core objects / functions.  Doing so is at your own risk however!
 * 
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict'; // For testing with node.js

// Global scope declarations:
var $ = Object.create(Object.prototype);

(function() {
  // Core build options:
  var forceAll = false; // Overwrite existing?

  /**
   * Log a message to the console.
   * @param {string} msg Message to show.
   */
  function log(msg) {
    // FIXME: this implementation for testing in Node only.
    console.log(msg);
  }
    
  /**
   * Verify that obj has a property obj[key], with specified
   * enumerability, whose value is an object with prototype proto.
   * Existing values / prototype will not be overwritten unless force
   * or forceAll is true, but an error will be reported instead.
   * @param {Object} obj The object to which to add a property.
   * @param {string} key The property key to add.
   * @param {Object} proto The desired prototype for obj[key].
   * @param {bool=} enumerable The property should be enumerable.
   * @param {bool=} force Overwrite existing?
   */
  function make(obj, key, proto, enumerable, force) {
    var desc = Object.getOwnPropertyDescriptor(obj, key);
    if (desc === undefined) {
      desc = {value: Object.create(proto), enumerable,
              writable: true, configurable: true};
    } else if (force === undefined ? forceAll : force) {
      if (typeof obj !== 'object' && typeof obj !== 'function' ||
          obj === null) {
        desc.value = Object.create(proto);
      }
      Object.setPrototypeOf(desc.value, proto);
      desc.enumerable = enumerable;
    } else {
      if (typeof obj !== 'object' && typeof obj !== 'function' ||
          obj === null) {
        log(obj + '.' + key + ' is not an object.');
        return; // Abort: can't (usefully) set prototype of primitive
      }
      if (Object.getPrototypeOf(desc.value) !== proto) {
        log(obj + '.' + key + ' has prototype ' +
            Object.getPrototypeOf(desc.value));
      }
      if (desc.enumerable !== enumerable) {
        log(obj + '.' + key + ' enumerability is ' + desc.enumerable);
      }
    }
    Object.defineProperty(obj, key, desc);
  }

  /**
   * Set a obj[key] to value (and make it enumerable iff enumerble is
   * true) but don't modify an existing property unless force or
   * global forceAll is true (force will override forceAll if given).
   * @param {Object} obj The object to which to add a property.
   * @param {string} key The property key to add.
   * @param {*} value The value to add as obj[key].
   * @param {bool=} enumerable The property should be enumerable.
   * @param {bool=} force Overwrite existing.
   */
  function set(obj, key, value, enumerable, force) {
    var desc = Object.getOwnPropertyDescriptor(obj, key);
    if (desc === undefined || (force === undefined ? forceAll : force)) {
      desc = {value, enumerable, writable: true, configurable: true};
    } else {
      if (desc.value !== value) {
        log(obj + '.' + key + ' === ' + value + ' (expected: ' + value + ').');
      }
      if (desc.enumerable !== enumerable) {
        log(obj + '.' + key + ' enumerability is ' + desc.enumerable);
      }
    }
    Object.defineProperty(obj, key, desc);
  }

  /*******************************************************************
   * $.object
   */
  set($, 'object', Object.prototype, true);
  
  /*******************************************************************
   * $.physical
   */
  make($, 'physical', $.object, true);

  set($.physical, 'name', 'Physical object prototype', true);
  set($.physical, 'location', null, true);
  set($.physical, 'contents_', undefined, true); // later vetted into existance

  set($.physical, 'contents', function() {
    // Return the contents of this object.  This is for VR purposes,
    // and descendents of $.physical can override it to 'hide' certain
    // objects from their contents.
    $.physical_vet(this);
    return this.contents_;
  });
       
  set($.physical, 'moveto', function(dest) {
    // Move this physical object to dest
    //
    // This is based loosely on moo.ca's #3:moveto and #102:bf_move
    // Vet obj, src and dest (also does type check):
    $.physical_vet(this);
    var src = this.location;
    src === null || $.physical_vet(src);
    dest === null || $.physical_vet(dest);

    // FIXME: permission checks go here.
    // Do moveable and accept checks:
    if (!this.moveable(dest)) {
      var destName = (dest === null ? 'null' : dest.name);
      throw Error(this.name + ' declined to move to ' + destName);
    }
    if (dest !== null && !dest.accept(this)) {
      throw Error(dest.name + ' refused ' + this.name);
    }

    // Check proposed containment hierarchy for cycles.  We do this
    // after the movable and accept checks because we don't want those
    // checks in case they muck arounnd with the containment
    // hierarchy.
    for(var loc = dest; loc !== null; loc = loc.location) {
      if (loc === this) {
        throw Error("Can't put " + this.name + " inside itself.");
      }
    }

    // Do move:
    var i;
    if ($.physical.isPrototypeOf(src)) {
      while ((i = src.contents_.indexOf(this)) >= 0) {
        src.contents_.splice(i, 1);
      }
    }
    this.location = dest;
    dest === null || dest.contents_.push(this);

    // FIXME: call exitfunc
    // FIXME: call enterfunc
  });
  
  set($.physical, 'moveable', function(obj) {
    // Returns true iff this is willing to accept obj into its contents.
    return false;
  });

  set($.physical, 'accept', function(obj) {
    // Returns true iff this is willing to accept obj into its
    // contents.  This function should only be called by
    // $.physical.moveto(), and might cause some action to occur as a
    // result.  Other callers interested in testing to see if a move will
    // be accepted should call .acceptable() instead.
    return this.acceptable(obj);
  });

  set($.physical, 'acceptable', function(obj) {
    // Returns true iff this is willing to accept obj into its
    // contents.  By default .accept() delegates this decision to this
    // function.  This function (and any overrides) MUST NOT cause any
    // observable action to occur.
    return false;
  });

  set($.physical, 'contains', function(obj) {
    // Returns true iff obj is located in this.
    $.physical_vet(this);
    $.physical_vet(obj);
    for (var loc = obj.location; loc !== null; loc = loc.location) {
      if (loc === this) {
        return true;
      }
      $.physical_vet(loc);
    }
    return false;
  });
  
  // FIXME: should be a non-overridable method on $.physical:
  set($, 'physical_vet', function(obj) {
    // Verify the integrity of a $.physical object.
    if (typeof obj !== 'object' || !$.physical.isPrototypeOf(obj)) {
      throw TypeError('Not a $.physical object');
    }
    // They can only be located in another $.physical object - and
    // that object must obj in its contents:
    if (!$.physical.isPrototypeOf(obj.location) ||
        obj.contents_.indexOf(obj) === -1) {
      obj.location === null;
    }
    // obj.contents_ must be an array unique to obj (not inherited):
    if (!obj.hasOwnProperty('contents_') || !Array.isArray(obj.contents_) ||
        !obj.contents_.for === obj) {
      // FIXME: attributes?
      obj.contents_ = [];
      Object.defineProperty(obj.contents_, 'for', { value: obj });
    }
    // obj.contents_ must not contain any duplicates, non-$.physical
    // objects, objects not located in obj:
    for (var i = 0; i < obj.contents_.length; i++) {
      if (obj.contents_.lastIndexOf(obj.contents_[i]) !== i ||
          !$.physical.isPrototypeOf(obj.contents_[i]) ||
          obj.contents_[i].location !== obj) {
        obj.contents_.splice(i, 1);
      }
    }
    // FIXME: check for circular containment?
  });

})();

if (typeof module !== 'undefined') { // Node.js
  module.exports = $;
}
