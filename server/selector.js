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

var code = require('./code');

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
  var /** !Array<string> */ out = [this[0]];
  for (var i = 1; i < this.length; i++) {
    var part = this[i];
    if (identifierRE.test(part)) {
      out.push('.', part);
    } else if (String(Number(part)) === part) {
      // String represents a number with same string representation.
      out.push('[', part, ']');
    } else {
      out.push('[', code.quote(part), ']');
    }
  }
 return out.join('');
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
  // TODO(cpcallen): rewrite when support for __proto__  / owner is added.
  return this.toExpr() + ' = ' + valueExpr;
};

/**
 * Return the selector string corresponding to this selector.
 * @return {string} The selector as a string.
 */
Selector.prototype.toString = function() {
  // TODO(cpcallen): rewrite when support for __proto__  / owner is added.
  return this.toExpr();
};

/** @typedef {string} */
Selector.Part;

/**
 * RegExp matching valid JavaScript identifiers.
 * TODO(cpcallen): Make this correspond to ES spec.
 * @const @type{!RegExp}
 */
var identifierRE = /^[A-Za-z_]\w*$/;

module.exports = Selector;
