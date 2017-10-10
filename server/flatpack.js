/**
 * @license
 * Flatpack: a tool for serializing arbitrary JS datastructures.
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
 * @fileoverview A tool for serializing arbitrary JS datastructures.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

/**
 * Return the type of an object, as determined by its @@toStringTag
 * (or, if it has none, by the Object.prototype.toString).
 * @param {Object} o Object whose type we are interested in.
 * @return {string}
 */
function toStringTag(o) {
  let tag = o[Symbol.toStringTag];
  if (typeof tag === 'string') {
    return tag;
  } else {
    return Object.prototype.toString.apply(o).slice(8,-1);
  }
}

/**
 * Determine the internal implementation type of an object.  This is
 * approximately the same as what the ES5.1 called an object's
 * "class", but extended to include primitives and all the new types
 * in ES6 and later.
 *
 * For primitive values v, classOf(v) === typeof v (always starting
 * with an initial lower-case letter).  For plain old JavaScript
 * objects (with no special behaviour or state), classOf(v) ===
 * 'Object'.  For all other values, this function should return a
 * string (starting with an initial capital letter) denoting the type.
 * This will typically be the same as the name of that type's
 * default @@toStringTag or (for types where that is 'Object') the
 * name of its constructor.  E.g., classOf([]) === 'Array'.
 *
 * @param {*} v Any arbitrary JavaScript value.
 * @return {string|undefined} The name of that value's type.
 */
function typeOf(v) {
  if (v === null) {
    return 'null';  // typeof null === 'object', so handle it specially.
  } else  if (typeof v !== 'object' && typeof v !== 'function') {
    return typeof v;  // Primitive types easily identified with typeof.
  }
  return toStringTag(v);
}

const byName_ = Symbol('byName_');
const byValue_ = Symbol('byValue_');

class Boundary {
  constructor() {
    this[byName_] = Object.create(null);
    this[byValue_] = new Map;
  }

  add(name, value) {
    if (name in this[byName_] || this[byValue_].has(value)) {
      throw Error("Can't redefine " + name + " in Boundary");
    }
    this[byName_][name] = value;
    this[byValue_].set(value, name);
  }

  hasName(name) {
    return (name in this[byName_]);
  }

  hasValue(value) {
    return this[byValue_].has(value);
  }
}

const boundary_ = Symbol('boundary_');
const obj2ref_ = Symbol('obj2ref_');

class Flatpack {
  constructor(boundary) {
    this[boundary_] = boundary || defaultBoundary;
    this[obj2ref_] = new WeakMap;
    this.items = [];
    console.log('***', this);
  }

  add(obj) {
    if (this[boundary_].hasValue(obj) || this[obj2ref_].has(obj)) {
      return;
    }
    const proto = Object.getPrototypeOf(obj);
    if (proto !== null) {
      this.add(proto);
    }
    console.log('add:', obj);
    this[obj2ref_].set(obj, this.items.length);
    this.items.push(obj);
    
  }
}

const defaultBoundary = new Boundary;
const defaultBoundaryItems = [
  'Object.prototype',
];

for (let name of defaultBoundaryItems) {
  defaultBoundary.add(name, eval(name));
}

module.exports = exports = Flatpack;
exports.typeOf = typeOf;
exports.Flatpack = Flatpack;
exports.Boundary = Boundary;
exports.defaultBoundary = defaultBoundary;
