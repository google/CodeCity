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
 * Wraps a function that, when applied to an arbitray JS value, throws
 * a TypeError if the value is not of a particular type.  The
 * resulting wrapper returns true if the value was of the particular
 * type and false otherwise.
 * @param {Function(): ?} fn Function to wrap.
 * @param {Array=} args Arguments for apply (optional).
 * @return {Function(*): boolean}
 */
function apply(fn, args) {
  return function(v) {
    try {
      fn.apply(v, args);
      return true;
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;
      return false;
    }
  };
}

/**
 * Table of functions returning true iff argument is of the specified type.
 * @type {Object<string, Function(Object): boolean>}
 */
const tests = {
  Array: Array.isArray,
  Boolean: apply(Boolean.prototype.valueOf),
  Date: apply(Date.prototype.getDate),
  Map: apply(Map.prototype.entries),
  Number: apply(Number.prototype.valueOf),
  RegExp: apply(Object.getOwnPropertyDescriptor(
      RegExp.prototype, 'source').get),
  Set: apply(Set.prototype.entries),
  String: apply(String.prototype.valueOf),
  Symbol: (v) => (typeof v.valueOf()) === 'symbol',
  WeakMap: apply(WeakMap.prototype.has, [undefined]),
  WeakSet: apply(WeakSet.prototype.has, [undefined]),
  
  
  // These correctly identify type, but are destructive, so can't be
  // used for this purpose:
  // 'Array Iterator': [].entries().next,
  // 'Map Iterator': (new Map).entries().next,
  // 'Set Iterator': (new Set).entries().next,
  // 'String Iterator': ''.entries().next,
  
  // No way to test for these at all (at least in presence of
  // non-configurable @@toStringTag) according to spec:
  // ArrayIterator
  // Error
  // Generator
  // ListIterator
  // Map Iterator
  // NativeError
  // Set Iterator
  // StringIterator

  // Undecided:
  // ArrayBuffer
  // DataView

  // Int8Array
  // Uint8Array
  // Uint8ClampedArray
  // Int16Array
  // Uint16Array
  // Int32Array
  // Uint32Array
  // Float32Array
  // Float64Array

  // Promise
  // Object
  // Proxy

  // Function
  // GeneratorFunction
};

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
exports.typeOf = typeOf;
