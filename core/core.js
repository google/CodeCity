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
 * intended that it should be possible to re-run it to update an
 * existing core with newer versions of the core objects / functions.
 * Doing so is at your own risk, however!
 * 
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict'; // For testing with node.js

// Global scope declarations:
var $ = function() {
  // FIXME: JQuery-style matching?
};

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
   * $.object - Object.prototype
   */
  set($, 'object', Object.prototype, true);
  
  /*******************************************************************
   * $.array - Array.prototype
   */
  set($, 'array', Array.prototype, true);

  /*******************************************************************
   * $.vet - library of vetting functions + general vetting function.
   */
  make($, 'vet', $.object, function(obj) {
    /* $.vet(obj) - validate obj.
     * 
     * Verifies the internal state of obj.
     * 
     * $.vet is also a library of type-specific vetting functions -
     * e.g., $.vet.physical(p), which verifies that p is a $.physical
     * object and has valid internal state.
     */
    // FIXME: select and apply relevant $.vet.whatever functions
  });

  set($.vet, 'arrayFor', function(obj, key) {
    /* $.vet.arrayFor(obj, key)
     *
     * Verify that obj[key] is an array unique to obj (not inherited
     * from a prototype).
     */
    if (!obj.hasOwnProperty(key) || !Array.isArray(obj[key]) ||
        obj[key].forObj !== obj || obj[key].forKey !== key) {
      // FIXME: attributes?
      obj[key] = [];
      Object.defineProperties(obj[key], {forObj: {value: obj},
                                         forKey: {value: key}});
    }
  });

  // Type-specific vetting functions defined with types below.
  
  /*******************************************************************
   * $.owner - object which can own other objects
   */
  // FIXME: this will probably need to be some kind of system object.
  make($, 'owner', Object.prototype, true);
  
  /*******************************************************************
   * $.user - owner representing an individual user
   */
  make($, 'user', $.owner, true);

  set($.user, 'userid', undefined, true);

  // FIXME: having VR stuff, like an avatar, should be optional.
  set($.user, 'avatar', undefined, true);

  set($.vet, 'user', function(obj) {
    /* $.vet.user(obj) - validate an $.user object.
     * 
     * Verifies that obj is a $.user object and has valid internal
     * state.
     */
    if (typeof obj !== 'object' || !$.user.isPrototypeOf(obj)) {
      throw TypeError('Not an $.user object');
    }
    // .avatar must be an $.character or undefined.
    if (typeof obj.avatar !== 'object' ||
        !$.character.isPrototypeOf(obj.avatar)) {
      obj.avatar = undefined;
    }
  });

  /*******************************************************************
   * $.physical - all kinds of physical stuff: people, places, things.
   */
  make($, 'physical', $.object, true);

  set($.physical, 'name', 'Physical object prototype', true);
  set($.physical, 'location', null, true);
  set($.physical, 'contents_', undefined, true); // later vetted into existance

  set($.physical, 'contents', function() {
    // Return the contents of this object.  This is for VR purposes,
    // and descendents of $.physical can override it to 'hide' certain
    // objects from their contents.
    $.vet.physical(this);
    return this.contents_;
  });
       
  set($.physical, 'moveto', function(dest) {
    /* .moveto(dest) - move this physical object to dest.
     *
     * If this.moveable(dest) and dest.accept(this) both return true
     * then move this to dest and then call .exitfunc(this) on
     * original this.location and .enterfunc(this) on new
     * this.location.
     * 
     * This is based loosely on moo.ca's #3:moveto and #102:bf_move.
     */
    // Vet obj, src and dest (also does type check):
    $.vet.physical(this);
    var src = this.location;
    src === null || $.vet.physical(src);
    dest === null || $.vet.physical(dest);
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
    // *after* the movable and accept checks to prevent them from
    // mucking around with the containment hierarchy between this
    // check and the actual move.
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
  
  set($.physical, 'moveable', function(whither) {
    // Returns true iff this is willing to move to whither.
    return false;
  });

  set($.physical, 'accept', function(obj) {
    /* .accept(obj) => boolean
     * 
     * Returns true iff this is willing to accept obj into its
     * contents.  This function should only be called by
     * $.physical.moveto() immediately before performing a move, and
     * this might cause some kind of observable side-effect (prompting
     * a user for a password, making some noise, etc.)  Other code
     * wanted to test if a move might succeed should call
     * .acceptable(), which must not have any side-effects.
     */
    // By default just delegate decision to .acceptable():
    return this.acceptable(obj);
  });

  set($.physical, 'acceptable', function(obj) {
    /* .acceptable(obj) => boolean
     * 
     * Returns true iff this is willing to accept obj into its
     * contents.  This function (and any overrides) MUST NOT have any
     * observable side-effects.
     */
    return false;
  });

  set($.physical, 'contains', function(obj) {
    // Returns true iff obj is located in this.
    $.vet.physical(this);
    $.vet.physical(obj);
    for (var loc = obj.location; loc !== null; loc = loc.location) {
      if (loc === this) {
        return true;
      }
      $.vet.physical(loc);
    }
    return false;
  });
  
  set($.vet, 'physical', function(obj) {
    /* $.vet.physical(obj) - validate a $.physical object.
     * 
     * Verifies that obj is a $.physical object and has valid internal
     * state.
     */
    if (typeof obj !== 'object' || !$.physical.isPrototypeOf(obj)) {
      throw TypeError('Not a $.physical object');
    }
    // They can only be located in another $.physical object (or null)
    // and that object must obj in its contents:
    var loc = obj.location;
    if (!$.physical.isPrototypeOf(loc) ||
        ($.vet.arrayFor(loc, 'contents_'), // comma operator
         obj.location.contents_.indexOf(obj) === -1)) {
      obj.location = null;
    }
    // obj.contents_ must be an array unique to obj (not inherited):
    $.vet.arrayFor(obj, 'contents_');
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

  /*******************************************************************
   * $.scene - places you can be.
   */
  make($, 'scene', $.physical, true);

  set($.scene, 'exits_', undefined, true);

  set($.scene, 'acceptable', function(obj) {
    /* .acceptable(obj) => boolean
     * 
     * Returns true iff this is willing to accept obj into its
     * contents.  This function (and any overrides) MUST NOT have any
     * observable side-effects.
     */
    return true;
  });

  set($.vet, 'scene', function(obj) {
    /* $.vet.scene(obj) - validate a $.scene object.
     * 
     * Verifies that obj is a $.scene object and has valid internal
     * state.
     */
    if (typeof obj !== 'object' || !$.scene.isPrototypeOf(obj)) {
      throw TypeError('Not a $.scene object');
    }
    // obj.exits_ must be an array unique to obj (not inherited):
    $.vet.arrayFor(obj, 'exits_');
  });

  /*******************************************************************
   * $.thing - stuff you might find in a $.scene (including people)
   */
  make($, 'thing', $.physical, true);

  set($.thing, 'moveable', function(whither) {
    // Returns true iff this is willing to move to whither.
    return true;
  });

  /*******************************************************************
   * $.character - a character (user avatar or NPC)
   */
  make($, 'character', $.thing, true);

})();

if (typeof module !== 'undefined') { // Node.js
  module.exports = $;
}
