/**
 * @license
 * Copyright 2020 Google LLC
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
 * @fileoverview Parser for Code City interpreter.
 * @author cpcallen@google.com (Christopher Allen)
 */

var acorn = require('acorn');

///////////////////////////////////////////////////////////////////////////////
// Externs for Acorn.
///////////////////////////////////////////////////////////////////////////////
// These are supplied here because Closure Compiler doesn't appear to
// provide any good way to specify externs for a Node module, and the
// mechanisms used to provide separate externs for Node's built-in
// modules don't work with NPMs.
//
// Trivial 'initialisers' are provided for acorn.Node and acorn.Parser
// to satisfy the compiler's requirement that constructors be
// initialised at declaration.

/**
 * @constructor
 * @param {!acorn.Parser} parser
 * @param {?} pos
 * @param {?} loc
 */
acorn.Node = acorn.Node;

/**
 * @constructor
 * @param {!Object} options Parse options.
 * @param {string} input The text to be parsed.
 * @param {number=} startPos Character offset to start parsing at.
 */
acorn.Parser = acorn.Parser;

/**
 * @return {!Node}
 */
acorn.Parser.prototype.startNode;

/**
 * @param {?} pos
 * @param {?} loc
 * @return {!Node}
 */
acorn.Parser.prototype.startNodeAt;

/**
 * @param {string} input
 * @param {!Object=} options
 */
acorn.Parser.parse;

/**
 * @param {string} input
 * @param {number} pos
 * @param {!Object=} options
 */
acorn.Parser.parseExpressionAt;

///////////////////////////////////////////////////////////////////////////////
// Custom Parser subclass for Code City.
///////////////////////////////////////////////////////////////////////////////

/** @const {!Object} Default options for Parser. */
var PARSE_OPTIONS = {ecmaVersion: 5, strict: true};

/**
 * A subclass of acorn.Node, which has a constructor that can be
 * called without arguments (and in particular without the Parser
 * argument).
 *
 * This is mainly to facilitate deserialisation, but is also used
 * directly to create a fake (but but correctly typed) AST node for
 * 'eval'.
 *
 * @constructor
 * @extends {acorn.Node}
 * @param {!acorn.Parser=} parser
 * @param {?=} pos
 * @param {?=} loc
 */
var Node = function(parser, pos, loc) {
  acorn.Node.call(this, parser || {options: PARSE_OPTIONS}, pos, loc);
};
Object.setPrototypeOf(Node, acorn.Node);
Object.setPrototypeOf(Node.prototype, acorn.Node.prototype);

/**
 * A subclass of acorn.Parser that:
 *
 * - Supports a strict option which, if true, forces strict mode.
 * - Defaults to using Interpreter.PARSE_OPTIONS if no options are
 *   supplied.
 * - Uses the overridden Node constructor above to create nodes.
 *
 * See https://github.com/acornjs/acorn/tree/master/acorn#interface
 * for details on how to use it, valid option values, etc.
 *
 * @constructor
 * @extends {acorn.Parser}
 * @param {!Object|undefined} options Parse options.  Defaults to
 *     Interpreter.PARSE_OPTIONS
 * @param {string} input The text to be parsed.
 * @param {number=} startPos Character offset to start parsing at.
 */
var Parser = function(options, input, startPos) {
  if (!options) options = PARSE_OPTIONS;
  acorn.Parser.call(this, options, input, startPos);
  if (options.strict) this.strict = true;
};
Object.setPrototypeOf(Parser, acorn.Parser);
Object.setPrototypeOf(Parser.prototype, acorn.Parser.prototype);

/** @override */
Parser.prototype.startNode = function() {
  return new Node(this, this.start, this.startLoc);
};

/** @overide */
Parser.prototype.startNodeAt = function(pos, loc) {
  return new Node(this, pos, loc);
};

// Redeclare static methods because Closure Compiler isn't too smart
// about static method inheritance in ES5.
/** @override */ Parser.parse;
/** @override */ Parser.parseExpressionAt;


///////////////////////////////////////////////////////////////////////////////
// Exports
///////////////////////////////////////////////////////////////////////////////

exports.Parser = Parser;
exports.PARSE_OPTIONS = PARSE_OPTIONS;
exports.Node = Node;
