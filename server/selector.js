/**
 * @license
 * Code City: Selectors
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
 * @fileoverview CSS-style selectors for JS objects.
 * @author cpcallen@google.com (Christohper Allen)
 */
'use strict';

/**
 * A Selector is just an array of Parts, which happens to have
 * Selector.prototype (with various useful convenience methods) in its
 * prototype chain.
 * @constructor
 * @extends {Array<Selector.Part>}
 * @param {string|!Array<Selector.Part>|!Selector} s A Selector, Parts
 *     array or selector string.
 */
var Selector = function(s) {
  var /** !Array<Selector.Part> */ parts;
  if (Array.isArray(s)) {
    parts = [];
    // Validate & copy parts list.
    if (typeof s.length < 1) throw RangeError('Zero-length parts list??');
    if (s.length < 1) throw RangeError('Zero-length parts list??');
    for (var i = 0; i < s.length; i++) {
      if (typeof s[i] !== 'string') {
        throw TypeError('Invalid part in parts array');
      }
      parts[i] = s[i];
    }
  } else if (typeof s === 'string') {
    // Parse selector text.
    parts = s.split('.');
  } else {
    throw TypeError('Not a selector or parts array');
  }
  Object.setPrototypeOf(parts, Selector.prototype);
  return parts;
};

Object.setPrototypeOf(Selector.prototype, Array.prototype);

/**
 * Returns true iff the selector represents a top-level variable
 * binding.
 * @return {boolean} Is selector for a variable?
 */
Selector.prototype.isVar = function() {
  return this.length === 1 && typeof this[0] === 'string';
};

/**
 * Return the selector as an evaluable expression yeilding the
 * selected value.
 * @return {string} The selector as a string.
 */
Selector.prototype.toExpr = function() {
  return this.join('.');
};

/**
 * Return an expression setting the selected value to the value of the
 * supplied expression.
 * @param {string} valueExpr A JS expression that evaluates to the new
 *     value to be assigned to the selected location.  It must not
 *     contain any non-parenthesized operators with lower precedence
 *     than '=' - specifically, the yield and comma operators.
 * @return {string} The selector as a string.
 */
Selector.prototype.toSetExpr = function(valueExpr) {
  return this.join('.') + ' = ' + valueExpr;
};

/**
 * Return the selector string corresponding to this selector.
 * @return {string} The selector as a string.
 */
Selector.prototype.toString = function() {
  return this.join('.');
};

/** @typedef {string} */
Selector.Part;

module.exports = Selector;
