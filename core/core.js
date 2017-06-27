'use strict'; // For testing with node.js

// Global scope declarations:
var $ = Object.create(Object.prototype);

(function() {
  // Core build options:

  // Overwrite existing?:
  var force = false;

  /**
   * Add a property to a core object - but only overwrite existing
   * properties if force is true.
   * @param {Object} obj The object to which to add a property.
   * @param {string} key The property key to add.
   * @param {*} value The property key to add.
   */
  function make(obj, key, value) {
    if (force || typeof obj[key] === 'undefined') {
      obj[key] = value;
    }
  }

  /*******************************************************************
   * $.object
   */
  make($, 'object', Object.prototype);

  /*******************************************************************
   * $.physical
   */
  make($, 'physical', Object.create($.object, {
    name: {value: 'Physical object prototype',
	   writable: true, enumerable: true, configurable: true},
    location: {value: null,
	       writable: true, enumerable: true, configurable: true},
    contents_: {value: undefined, // wil be vetted into existance
		writable: true, enumerable: true, configurable: true},
  }));

  make($.physical, 'contents', function() {
    // Return the contents of this object.  This is for VR purposes,
    // and descendents of $.physical can override it to 'hide' certain
    // objects from their contents.
    $.physical_vet(this);
    return this.contents_;
  });
       
  make($.physical, 'moveto', function(dest) {
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
      var destname = (dest === null ? 'null' : dest.name);
      throw Error(this.name + ' declined to move to ' + destname);
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
  
  make($.physical, 'moveable', function(obj) {
    // Returns true iff this is willing to accept obj into its contents.
    return false;
  });

  make($.physical, 'accept', function(obj) {
    // Returns true iff this is willing to accept obj into its
    // contents.  This function should only be called by
    // $.physical.moveto(), and might cause some action to occur as a
    // result.  Other callers interested in testing to see if a move will
    // be accepted should call .acceptable() instead.
    return this.acceptable(obj);
  });

  make($.physical, 'acceptable', function(obj) {
    // Returns true iff this is willing to accept obj into its
    // contents.  By default .accept() delegates this decision to this
    // function.  This function (and any overrides) MUST NOT cause any
    // observable action to occur.
    return false;
  });

  make($.physical, 'contains', function(obj) {
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
  make($, 'physical_vet', function(obj) {
    // Verify the integrity of a $.physical object.
    if (!$.physical.isPrototypeOf(obj)) {
      throw TypeError('Not a $.physical object');
    }
    // They can only be located in another $.physical object - and
    // that object must obj in its contents:
    if (!$.physical.isPrototypeOf(obj.location) ||
	obj.contents_.indexOf(obj) == -1) {
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
