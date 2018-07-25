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
 * @constructor
 * @param {string|!Array<Selector.Part>} selector
 */
var Selector = function(selector) {
  var /** !Array<Selector.Part> */ parts;
  if (Array.isArray(selector)) {
    // Validate parts list.
    if (selector.length < 1) throw RangeError('Zero-length parts list??');
    for (var i = 0; i < selector.length; i++) {
      if (typeof selector[i] !== 'string') {
        throw TypeError('Invalid part in selector parts array');
      }
    }
    parts = selector;
  } else if (typeof selector === 'string') {
    // Parse selector text.
    parts = selector.split('.');
  } else {
    throw TypeError('Not a selector or parts array');
  }
  /** @const @type {!Array<Selector.Part>} */
  this.parts = parts;
};

/**
 * Return the selector as an evaluable expression yeilding the
 * selected value.
 * @return {string} The selector as a string.
 */
Selector.prototype.toExpr = function() {
  return this.parts.join('.');
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
  return this.parts.join('.') + ' = ' + valueExpr;
};

/**
 * Return the selector string corresponding to this selector.
 * @return {string} The selector as a string.
 */
Selector.prototype.toString = function() {
  return this.parts.join('.');
};

/** @typedef {string} */
Selector.Part;

module.exports = Selector;
