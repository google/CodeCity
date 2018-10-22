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
 * @extends {Array<!Selector.Part>}
 * @param {string|!Array<!Selector.Part>|!Selector} s A Selector, Parts
 *     array or selector string.
 */
var Selector = function(s) {
  var /** !Array<!Selector.Part> */ parts;
  if (Array.isArray(s)) {
    parts = [];
    // Validate & copy parts list.
    if (typeof s.length < 1) throw new RangeError('Zero-length parts list??');
    if (s.length < 1) throw new RangeError('Zero-length parts list??');
    if (typeof s[0] !== 'string' || !identifierRE.test(s[0])) {
      throw new TypeError('Parts array must begin with an identifier');
    }
    parts[0] = s[0];
    for (var i = 1; i < s.length; i++) {
      if (typeof s[i] !== 'string' && !(s[i] instanceof SpecialPart)) {
        throw new TypeError('Invalid part in parts array');
      }
      parts[i] = s[i];
    }
  } else if (typeof s === 'string') {
    // Parse selector text.
    parts = parse(s);
  } else {
    throw new TypeError('Not a selector or parts array');
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
 * Returns true iff the selector represents an object property
 * binding.
 * @return {boolean} Is selector for a property?
 */
Selector.prototype.isProp = function() {
  return this.length > 1 && typeof this[this.length - 1] === 'string';
};

/**
 * Returns true iff the selector represents an object prototype
 * binding.
 * @return {boolean} Is selector for prototype?
 */
Selector.prototype.isProto = function() {
  return this.length > 1 && this[this.length - 1] === Selector.PROTOTYPE;
};

/**
 * Return the selector as an evaluable expression yeilding the
 * selected value.
 * @return {string} The selector as a string.
 */
Selector.prototype.toExpr = function() {
  return this.toString(function(part, out) {
    if (part === Selector.PROTOTYPE) {
      out.unshift('Object.getPrototypeOf(');
      out.push(')');
    } else {
      throw new TypeError('Invalid part in parts array');
    }
  });
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
  var lastPart = this[this.length - 1];
  if (!(lastPart instanceof SpecialPart)) {
    return this.toExpr() + ' = ' + valueExpr;
  } else if (lastPart === Selector.PROTOTYPE) {
    var objExpr = new Selector(this.slice(0, -1)).toExpr();
    return 'Object.setPrototypeOf(' + objExpr + ', ' + valueExpr + ')';
  } else {
    throw new TypeError('Invalid part in parts array');
  }
};

/**
 * Return the selector string corresponding to this selector.
 * @param {function(!SpecialPart, !Array<string>)=} specialHandler
 *     Optional function to handle stringifying SpecialParts.
 * @return {string} The selector as a string.
 */
Selector.prototype.toString = function(specialHandler) {
  var /** !Array<string> */ out = [this[0]];
  for (var i = 1; i < this.length; i++) {
    var part = this[i];
    if (part instanceof SpecialPart) {
      if (specialHandler) {
        specialHandler(part, out);
      } else if (part === Selector.PROTOTYPE) {
        out.push('^');
      } else {
        throw new TypeError('Invalid SpecialPart');
      }
    } else if (identifierRE.test(part)) {
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
 * A Selector fundamentally an array of Parts, and Parts are either
 * strings (representing variable or property names) or SpecialParts
 * (representing everything else, like ^ for prottype.
 * @typedef {string|!SpecialPart}
 */
Selector.Part;

/**
 * Type for all "special" selector parts (ones which do not represent
 * named variables / properties).
 * @constructor
 */
var SpecialPart = function(type) {
  this.type = type;
};

/**
 * Special singleton Part for refering to an object's prototype.
 */
Selector.PROTOTYPE = new SpecialPart('^');

/**
 * Parse a selector into an array of Parts.
 * @return !Array
 */
var parse = function(selector) {
  var tokens = tokenize(selector);
  var parts = [];
  /** @enum {number} */
  var State = {START: 0, GOOD: 1, DOT: 2, BRACKET: 3, SUBSCRIPT: 4};
  var state = State.START;
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (token.type === 'whitespace') continue;
    switch (state) {
      case State.START:
        if (token.type !== 'id') {
          throw new SyntaxError('Selector must start with an identifier');
        }
        parts.push(token.raw);
        state = State.GOOD;
        break;

      case State.GOOD:
        if (token.type === '.') {
          state = State.DOT;
        } else if (token.type === '[') {
          state = State.BRACKET;
        } else if (token.type === '^') {
          // state remains unchanged.
          parts.push(Selector.PROTOTYPE);
        } else {
          throw new SyntaxError(
              'Invalid token ' + code.quote(token.raw)  + ' in selector');
        }
        break;

      case State.DOT:
        if (token.type !== 'id') {
          throw new SyntaxError(
              '"." must be followed by identifier in selector');
        }
        parts.push(token.raw);
        state = State.GOOD;
        break;

      case State.BRACKET:
        if (token.type === 'number') {
          parts.push(String(token.raw));
        } else if (token.type === 'str') {
          parts.push(String(token.value));
        } else {
          throw new SyntaxError('"[" must be followed by numeric or string ' +
              'literal in selector');
        }
        state = State.SUBSCRIPT;
        break;

      case State.SUBSCRIPT:
        if (token.type !== ']') {
          throw new SyntaxError(
              'Invalid token ' + code.quote(token.raw)  + ' after subscript');
        }
        state = State.GOOD;
        break;

      default:
        throw new Error('Invalid State in parse??');
    }
  }
  if (state !== State.GOOD) {
    throw new SyntaxError('Incomplete selector ' + selector);
  }
  return parts;
};

/** @typedef {{type: string,
 *             raw: string,
 *             valid: boolean,
 *             index: number,
 *             value: (string|number|undefined)}}
 */
var Token;

/**
 * Tokenizes a selector string.  Throws a SyntaxError if any text is
 * found which does not form a valid token.
 * @param {string} selector A selector string.
 * @return {!Array<!Token>} An array of tokens.
 */
var tokenize = function(selector) {
  var REs = {
    whitespace: /\s+/y,
    '.': /\./y,
    id: /[A-Za-z_$][A-Za-z0-9_$]*/y,  // See also identifierRE below.
    number: /\d+/y,
    '[': /\[/y,
    ']': /\]/y,
    '^': /\^/y,
    str: new RegExp(code.regexps.string, 'y'),
  };
  
  var tokens = [];
  NEXT_TOKEN: for (var index = 0; index < selector.length; ) {
    for (var tokenType in REs) {
      if (!REs.hasOwnProperty(tokenType)) continue;
      var re = REs[tokenType];
      re.lastIndex = index;
      var m = re.exec(selector);
      if (!m) continue;  // No match.  Try next regexp.
      tokens.push({
        type: tokenType,
        raw: m[0],
        valid: true,
        index: index,
      });
      index = re.lastIndex;
      continue NEXT_TOKEN;
    }
    // No token matched.
    throw new SyntaxError('invalid selector ' + selector);
  }

  // Postprocess token list to get values.
  for(var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (token.type === 'number') {
      token.value = Number(token.raw);
    } else if (token.type === 'str') {
      token.value = code.parseString(token.raw);
    }
  }
  return tokens;
};

/**
 * RegExp matching valid JavaScript identifiers.
 * @const @type{!RegExp}
 */
var identifierRE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

module.exports = Selector;
