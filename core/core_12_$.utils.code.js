/**
 * @license
 * Copyright 2018 Google LLC
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
 * @fileoverview Code utilities for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.utils.code = {};
$.utils.code.rewriteForEval = function(src, forceExpression) {
  // Eval treats {} as an empty block (return value undefined).
  // Eval treats {'a': 1} as a syntax error.
  // Eval treats {a: 1} as block with a labeled statement (return value 1).
  // Detect these cases and enclose in parenthesis.
  // But don't mess with: {var x = 1; x + x;}
  // This is consistent with the console on Chrome and Node.
  // If 'forceExpression' is true, then throw a SyntaxError if the src is
  // more than one expression (e.g. '1; 2;').
  var ast = null;
  if (!forceExpression) {
    // Try to parse src as a program.
    try {
      ast = $.utils.code.parse(src);
    } catch (e) {
      // ast remains null.
    }
  }
  if (ast) {
    if (ast.type === 'Program' && ast.body.length === 1 &&
        ast.body[0].type === 'BlockStatement') {
      if (ast.body[0].body.length === 0) {
        // This is an empty object: {}
        return '({})';
      }
      if (ast.body[0].body.length === 1 &&
          ast.body[0].body[0].type === 'LabeledStatement' &&
          ast.body[0].body[0].body.type === 'ExpressionStatement') {
        // This is an unquoted object literal: {a: 1}
        // There might be a comment, so add a linebreak.
        return '(' + src + '\n)';
      }
    }
    return src;
  }
  // Try parsing src as an expression.
  // This may throw.
  ast = $.utils.code.parseExpressionAt(src, 0);
  var remainder = src.substring(ast.end).trim();
  if (remainder !== '') {
    // Remainder might legally include trailing comments or semicolons.
    // Remainder might illegally include more statements.
    var remainderAst = null;
    try {
      remainderAst = $.utils.code.parse(remainder);
    } catch (e) {
      // remainderAst remains null.
    }
    if (!remainderAst) {
      throw new SyntaxError('Syntax error beyond expression');
    }
    if (remainderAst.type !== 'Program') {
      throw new SyntaxError('Unexpected code beyond expression');  // Module?
    }
    // Trim off any unnecessary trailing semicolons.
    while (remainderAst.body[0] &&
           remainderAst.body[0].type === 'EmptyStatement') {
      remainderAst.body.shift();
    }
    if (remainderAst.body.length !== 0) {
      throw new SyntaxError('Only one expression expected');
    }
  }
  src = src.substring(0, ast.end);
  if (ast.type === 'ObjectExpression' || ast.type === 'FunctionExpression') {
    // {a: 1}  and function () {} both need to be wrapped in parens to avoid
    // being syntax errors.
    src = '(' + src + ')';
  }
  return src;
};
delete $.utils.code.rewriteForEval.name;
Object.setOwnerOf($.utils.code.rewriteForEval, $.physicals.Neil);
$.utils.code.rewriteForEval.unittest = function() {
  var cases = {
    // Input: [Expression, Statement(s)]
    '1 + 2': ['1 + 2', '1 + 2'],
    '2 + 3  // Comment': ['2 + 3', '2 + 3  // Comment'],
    '3 + 4;': ['3 + 4', '3 + 4;'],
    '4 + 5; 6 + 7': [SyntaxError, '4 + 5; 6 + 7'],
    '{}': ['({})', '({})'],
    '{}  // Comment': ['({})', '({})'],
    '{};': ['({})', '{};'],
    '{}; {}': [SyntaxError, '{}; {}'],
    '{"a": 1}': ['({"a": 1})', '({"a": 1})'],
    '{"a": 2}  // Comment': ['({"a": 2})', '({"a": 2})'],
    '{"a": 3};': ['({"a": 3})', '({"a": 3})'],
    '{"a": 4}; {"a": 4}': [SyntaxError, SyntaxError],
    '{b: 1}': ['({b: 1})', '({b: 1}\n)'],
    '{b: 2}  // Comment': ['({b: 2})', '({b: 2}  // Comment\n)'],
    '{b: 3};': ['({b: 3})', '{b: 3};'],
    '{b: 4}; {b: 4}': [SyntaxError, '{b: 4}; {b: 4}'],
    'function () {}': ['(function () {})', '(function () {})'],
    'function () {}  // Comment': ['(function () {})', '(function () {})'],
    'function () {};': ['(function () {})', '(function () {})'],
    'function () {}; function () {}': [SyntaxError, SyntaxError],
    '{} + []': ['{} + []', '{} + []']
  };
  var actual;
  for (var key in cases) {
    if (!cases.hasOwnProperty(key)) continue;
    // Test eval as an expression.
    try {
      actual = $.utils.code.rewriteForEval(key, true);
    } catch (e) {
      actual = SyntaxError;
    }
    if (actual !== cases[key][0]) {
      throw new Error('Eval Expression\n' +
                      'Expected: ' + cases[key][0] + ' Actual: ' + actual);
    }
    // Test eval as a statement.
    try {
      actual = $.utils.code.rewriteForEval(key, false);
    } catch (e) {
      actual = SyntaxError;
    }
    if (actual !== cases[key][1]) {
      throw new Error('Eval Statement\n' +
                      'Expected: ' + cases[key][1] + ' Actual: ' + actual);
    }
  }
};
$.utils.code.eval = function $_utils_code_eval(src, evalFunc) {
  // Eval src and attempt to print the resulting value readably.
  //
  // Evaluation is done by calling evalFunc (passing src) if supplied,
  // or by calling the eval built-in function (under a different name,
  // so it operates in the global scope).  Unhandled exceptions are
  // caught and converted to a string.
  //
  // Caller may wish to transform input with
  // $.utils.code.rewriteForEval before passing it to this function.
  evalFunc = evalFunc || eval;
  var out;
  try {
    out = evalFunc(src);
  } catch (e) {
    // Exception thrown.  Use built-in ToString via + to avoid calling
    // String, least it call a .toString method that itself throws.
    // TODO(cpcallen): find an alternative way of doing this safely
    // once the interpreter calls String for all string conversions.
    if (e instanceof Error) {
      out = 'Unhandled error: ' + e.name;
      if (e.message) out += ': ' + e.message;
      if (e.stack) out += '\n' + e.stack;
      return out;
    } else {
      return 'Unhandled exception: ' + e;
    }
  }
  // Suspend if needed.
  try {(function(){})();} catch (e) {suspend();}
  // Attempt to print a source-legal representation.
  return $.utils.code.expressionFor(out, {
    depth: 2,
    abbreviateMethods: true,
    proto: 'note',
    owner: 'ignore'
  });
};
Object.setOwnerOf($.utils.code.eval, $.physicals.Maximilian);
$.utils.code.regexps = {};
$.utils.code.regexps.README = '$.utils.code.regexps contains some RegExps useful for parsing or otherwise analysing code.\n\nSee ._generate() for how they are constructed and what they will match.\n';
$.utils.code.regexps._generate = function _generate() {
  /* Generate some RegExps that match various bits of JavaScript syntax.
   * The intention is that these regular expressions conform to the
   * lexical grammar given ES5.1 Appendix A.1
   * (https://262.ecma-international.org/5.1/#sec-A.1), in some cases
   * updated to include changes in the current version of the spec
   * (https://tc39.es/ecma262/#sec-lexical-grammar).
   *
   * TODO: add tests for generated RegExps.
   */

  // Globally matches escape sequences found in string and regexp
  // literals, like '\n' or '\x20' or '\u1234'.  (This is basically
  // the spec EscapeSequence but including the backslash prefix.)
  this.escapes = /\\(?:["'\\\/0bfnrtv]|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2})/g;

  // Globally matches a single-quoted string literal, like "'this one'"
  // and "'it\\'s'".
  this.singleQuotedString =
      new RegExp("'(?:[^'\\\\\\r\\n\\u2028\\u2029]|" +
                 this.escapes.source + ")*'", 'g');

  // Globally matches a double-quoted string literal, like '"this one"'
  // and '"it\'s"'.
  this.doubleQuotedString =
      new RegExp('"(?:[^"\\\\\\r\\n\\u2028\\u2029]|' +
                 this.escapes.source + ')*"', 'g');

  // Globally matches a StringLiteral, like "'this one' and '"that one"'
  // as well as "the 'string literal' substring of this longer string" too.
  this.string = new RegExp('(?:' + this.singleQuotedString.source + '|' +
      this.doubleQuotedString.source + ')', 'g');

  // Globally matches a valid JavaScript IdentifierName.  Note that
  // this is conservative, because ANY Unicode letter can appear
  // in an identifier - but the full regexp is absurdly complicated.
  this.identifierName = /[A-Za-z_$][A-Za-z0-9_$]*/g;

  // Matches a valid ES2020 ReservedWord.
  var reserved = /await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|function|if|import|in|instanceof|new|null|return|super|switch|this|throw|true|try|typeof|var|void|while|with|yield/;
  // Matches ES5.1 FutureReservedWords not included in reserved.
  var reservedES5 = /implements|interface|let|package|protected|public|static/;
  // Globally matches a valid JavaScript ReservedWord.
  this.reservedWord =
      new RegExp('(?:' + reserved.source + '|' + reservedES5.source + ')', 'g');

  ////////////////////////////////////////////////////////////////////
  // Exact forms of the above.  These do not get the global flag.
  var keys = ['identifierName', 'reservedWord', 'string'];
  for (var key, i = 0; (key = keys[i]); i++) {
    this[key + 'Exact'] = new RegExp('^' + this[key].source + '$');
  }

};
Object.setOwnerOf($.utils.code.regexps._generate.prototype, $.physicals.Maximilian);
$.utils.code.regexps.escapes = /\\(?:["'\\\/0bfnrtv]|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2})/g;
$.utils.code.regexps.singleQuotedString = /'(?:[^'\\\r\n\u2028\u2029]|\\(?:["'\\\/0bfnrtv]|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}))*'/g;
$.utils.code.regexps.doubleQuotedString = /"(?:[^"\\\r\n\u2028\u2029]|\\(?:["'\\\/0bfnrtv]|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}))*"/g;
$.utils.code.regexps.string = /(?:'(?:[^'\\\r\n\u2028\u2029]|\\(?:["'\\\/0bfnrtv]|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}))*'|"(?:[^"\\\r\n\u2028\u2029]|\\(?:["'\\\/0bfnrtv]|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}))*")/g;
$.utils.code.regexps.identifierName = /[A-Za-z_$][A-Za-z0-9_$]*/g;
$.utils.code.regexps.reservedWord = /(?:await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|function|if|import|in|instanceof|new|null|return|super|switch|this|throw|true|try|typeof|var|void|while|with|yield|implements|interface|let|package|protected|public|static)/g;
$.utils.code.regexps.identifierNameExact = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
$.utils.code.regexps.reservedWordExact = /^(?:await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|function|if|import|in|instanceof|new|null|return|super|switch|this|throw|true|try|typeof|var|void|while|with|yield|implements|interface|let|package|protected|public|static)$/;
$.utils.code.regexps.stringExact = /^(?:'(?:[^'\\\r\n\u2028\u2029]|\\(?:["'\\\/0bfnrtv]|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}))*'|"(?:[^"\\\r\n\u2028\u2029]|\\(?:["'\\\/0bfnrtv]|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}))*")$/;
$.utils.code.parseString = function parseString(s) {
  /* Convert a string representation of a string literal to a string.
	 * Basically does eval(s), but safely and only if s is a string
   * literal.
   */
  if (!this.regexps.stringExact.test(s)) {
    throw new TypeError(this.quote(s) + ' is not a string literal');
  }
  return s.slice(1, -1).replace(this.regexps.escapes, function(esc) {
    switch (esc[1]) {
      case "'":
      case '"':
      case '/':
      case '\\':
        return esc[1];
      case '0':
        return '\0';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case 'v':
        return '\v';
      case 'u':
      case 'x':
        return String.fromCharCode(parseInt(esc.slice(2), 16));
      default:
        // RegExp in call to replace has accepted something we
        // don't know how to decode.
        throw new Error('unknown escape sequence "' + esc + '"??');
    }
  });
};
Object.setOwnerOf($.utils.code.parseString, $.physicals.Maximilian);
$.utils.code.quote = function quote(str) {
  // Convert a string into a string literal.  We use single or double
  // quotes depending on which occurs less frequently in the string to
  // be escaped (prefering single quotes if it's a tie).  Strictly
  // speaking we only need to escape backslash, \r, \n, \u2028 (line
  // separator), \u2029 (paragraph separator) and whichever quote
  // character we're using, but for output readability we escape all the
  // control characters.
  //
  // TODO(cpcallen): Consider using optimised algorithm from Node.js's
  //     util.format (see strEscape function in
  //     https://github.com/nodejs/node/blob/master/lib/util.js).
  // @param {string} str The string to convert.
  // @return {string} The value s as a eval-able string literal.
  if (this.count(str, "'") > this.count(str, '"')) {  // More 's.  Use "s.
    return '"' + str.replace(this.quote.doubleRE, this.quote.replace) + '"';
  } else {  // Equal or more "s.  Use 's.
    return "'" + str.replace(this.quote.singleRE, this.quote.replace) + "'";
  }
};
$.utils.code.quote.singleRE = /[\x00-\x1f\\\u2028\u2029']/g;
$.utils.code.quote.doubleRE = /[\x00-\x1f\\\u2028\u2029"]/g;
$.utils.code.quote.replace = function replace(c) {
  // Replace special characters with their quoted replacements.
  // Intended to be used as the second argument to
  // String.prototype.replace.
  return $.utils.code.quote.replacements[c];
};
$.utils.code.quote.replacements = {};
$.utils.code.quote.replacements['\0'] = '\\0';
$.utils.code.quote.replacements['\x01'] = '\\x01';
$.utils.code.quote.replacements['\x02'] = '\\x02';
$.utils.code.quote.replacements['\x03'] = '\\x03';
$.utils.code.quote.replacements['\x04'] = '\\x04';
$.utils.code.quote.replacements['\x05'] = '\\x05';
$.utils.code.quote.replacements['\x06'] = '\\x06';
$.utils.code.quote.replacements['\x07'] = '\\x07';
$.utils.code.quote.replacements['\b'] = '\\b';
$.utils.code.quote.replacements['\t'] = '\\t';
$.utils.code.quote.replacements['\n'] = '\\n';
$.utils.code.quote.replacements['\v'] = '\\v';
$.utils.code.quote.replacements['\f'] = '\\f';
$.utils.code.quote.replacements['\r'] = '\\r';
$.utils.code.quote.replacements['\x0e'] = '\\x0e';
$.utils.code.quote.replacements['\x0f'] = '\\x0f';
$.utils.code.quote.replacements['"'] = '\\"';
$.utils.code.quote.replacements["'"] = "\\'";
$.utils.code.quote.replacements['\\'] = '\\\\';
$.utils.code.quote.replacements['\u2028'] = '\\u2028';
$.utils.code.quote.replacements['\u2029'] = '\\u2029';
$.utils.code.count = function count(str, searchString) {
  // Count non-overlapping occurrences of searchString in str.
  return str.split(searchString).length;
};
$.utils.code.isIdentifier = function isIdentifier(id) {
  /* Arguments:
   * - id: any - any JavaScript value.
   *
   * Returns: boolean - true iff id is a string representing valid
   *     Identifier, which is any bare word that can be used
   *     as a variable name (i.e., excluding reserved words).
   */
  return $.utils.code.isIdentifierName(id) &&
      !$.utils.code.regexps.reservedWordExact.test(id);
};
Object.setOwnerOf($.utils.code.isIdentifier, $.physicals.Maximilian);
$.utils.code.getGlobal = function getGlobal() {
  // Return a pseudo global object.
  var global = Object.create(null);
  global.$ = $;
  global.Array = Array;
  global.Boolean = Boolean;
  global.clearTimeout = clearTimeout;
  global.Date = Date;
  global.decodeURI = decodeURI;
  global.decodeURIComponent = decodeURIComponent;
  global.encodeURI = encodeURI;
  global.encodeURIComponent = encodeURIComponent;
  global.Error = Error;
  global.escape = escape;
  global.eval = eval;
  global.EvalError = EvalError;
  global.Function = Function;
  global.isFinite = isFinite;
  global.isNaN = isNaN;
  global.JSON = JSON;
  global.Math = Math;
  global.Number = Number;
  global.Object = Object;
  global.parseFloat = parseFloat;
  global.parseInt = parseInt;
  global.perms = perms;
  global.RangeError = RangeError;
  global.ReferenceError = ReferenceError;
  global.RegExp = RegExp;
  global.setPerms = setPerms;
  global.setTimeout = setTimeout;
  global.String = String;
  global.suspend = suspend;
  global.SyntaxError = SyntaxError;
  global.Thread = Thread;
  global.TypeError = TypeError;
  global.unescape = unescape;
  global.URIError = URIError;
  global.user = user;
  global.WeakMap = WeakMap;
  return global;
};
Object.setOwnerOf($.utils.code.getGlobal, $.physicals.Maximilian);
$.utils.code.parse = new 'CC.acorn.parse';
$.utils.code.parseExpressionAt = new 'CC.acorn.parseExpressionAt';
$.utils.code.isIdentifierName = function isIdentifierName(id) {
  /* Arguments:
   * - id: any - any JavaScript value.
   *
   * Returns: boolean - true iff id is a string representing valid
   *     IdentifierName, which is anything bare word that can appear
   *     after the '.' in a MemberExpresion.
   */
  return typeof id === 'string' &&
      $.utils.code.regexps.identifierNameExact.test(id);
};
Object.setOwnerOf($.utils.code.isIdentifierName, $.physicals.Maximilian);
Object.setOwnerOf($.utils.code.isIdentifierName.prototype, $.physicals.Maximilian);
$.utils.code.expressionFor = function expressionFor(value, options) {
  /* Given an arbitrary value, return a string containing a JavaScript
   * expression for it.
   *
   * The intention is that expressionFor(value) should return a string
   * such that eval(expressionFor(value)) will be (in order of preference):
   *
   * - Identical to value (as determined by Object.is), or
   * - An equivalent copy of value to a specified depth, or
   * - Be unparsable or contain comments explaining in what way the
   *   result of eval will differ from original value.
   *
   * Arguments:
   * - value: any - any JavaScript value.
   * - options?: Object - optional options object.  See implementation.
   *
   * Returns: string - an expression for value.
   *
   * TODO: there should be flags controlling what to do when it is not
   * possible to construct an expression that will eval to an exact copy
   * of value.  The options should include returning valid code containing
   * comments, returning unparsable code, or throwing an an error.
   */
  var opts = {
    depth: 10,  // How deeply shall we traverse the object tree?
    arrayLimit: 100,  // Max number of array elements to include.
    propertyLimit: 100,  // Max number of properties to include.
    abbreviateFunctions: false,  // Elide all function bodies?
    abbreviateMethods: false,  // Elide method function bodies?
    proto: 'set',  // 'set', 'note' or (any other value) ignore prototype.
    owner: 'note',  // 'set', 'note' or (any other value) ignore owner.
    lineLength: 80,  // Line length limit, for formatting purposes.
    indent: 2,  // Indent for nested expressions.
    seen_: [],  // TODO: use Set instead of Array.
  };
  // Like Object.assign(opts, options) but copies inherited properties too.
  for (var k in options) opts[k] = options[k];

  // Helper to handle failures where expressionFor cannot or does not yet
  // return an experssion that will eval to an identical copy of value.
  // Typical usage: return fail('reason for failure');
  function fail(message) {
    // TODO: have flag to make it:
    // throw new ReferenceError(message);
    return $.utils.code.blockComment(message);
  }

  // Helper for properties in array and object literals.
  function expressionForProperty(key) {
    var descriptor = Object.getOwnPropertyDescriptor(value, key);
    var propertyValue = descriptor.value;
    if (selector) {
      opts.selector = new $.Selector(selector.concat(key));
    }
    opts.abbreviateFunctions = opts.abbreviateMethods;
    return expressionFor(propertyValue, opts);
  }

  var type = typeof value;
  if (value === undefined || value === null ||
      type === 'number' || type === 'boolean') {
    if (Object.is(value, -0)) return '-0';
    return String(value);
  } else if (type === 'string') {
    return $.utils.code.quote(value);
  } else if (type !== 'function' && type !== 'object') {
    throw new TypeError("unknown type '" + type + "'");
  }

  // value is an object of some kind (including function).  Work out a selector.
  var selector = $.Selector.for(value);
  if (opts.selector) {
    var suggestedSelectorValue = opts.selector.toValue(/*save:*/true);
    if (!selector && suggestedSelectorValue === value) {
      selector = opts.selector;
    }
  }

  // Deal with already-seen objects (and nesting limit depth limit).
  if (opts.seen_.includes(value)) {
    return fail('cyclic or shared substructure' +
                (selector ? ': ' + selector.toString() : 'with no known selector'));
  } else if (opts.depth < 1) {
    if (!selector) return fail(type + ' with no known selector');
    return selector.toExpr();
  }
  // Prepare for recursive calls.
  opts.seen_.push(value);
  opts.depth--;
  opts.lineLength -= opts.indent;

  // Get the object's [[Class]] - Object, Array, Date, RegExp, Error, etc.
  // Since 'class' isn't a legal variable name, re-use 'type'.
  type = Object.prototype.toString.call(value).slice(8, -1);
  var proto = Object.getPrototypeOf(value);  // Actual prototype of value.
  var expectedProto;  // Expected prototype of object of same [[Class]] as value.
  var prefix = '', expr = '', suffix = '';  // Concatenate to get final expression.
  var entries;  // Array of initialisers for object or array literal.
  var notes = []; // Array of notes to postpend as comment.

  // Make a note about the object's selector unless it is the expected
  // one.  Decide this before recursive calls mess with opts.selector.
  var selectorNote = selector ? selector.toString() : '';
  if (opts.selector && selectorNote === opts.selector.toString()) {
    selectorNote = '';
  }

  if (type === 'Array') {
    if (!Array.isArray(value)) throw TypeError('non-array array??');
    expectedProto = Array.prototype;
    prefix = '[';
    suffix = ']';
    entries = [];
    for (var i = 0; i < value.length; i++) {
      suspend();
      if (i >= opts.arrayLimit) {
        entries[i] = $.utils.code.blockComment('and ' + (value.length - opts.arrayLimit) + ' more');
        break;
      } else if (!Object.hasOwnProperty.call(value, i)) {
        entries[i] = '';
        continue;
      }
      entries[i] = expressionForProperty(String(i));
    }
  } else if (type === 'Date') {
    expr = 'new Date(\'' + value.toJSON() + '\')';
    expectedProto = Date.prototype;
  } else if (type === 'Error') {
    expectedProto = proto;
    switch (proto) {
      case EvalError.prototype: prefix = 'EvalError'; break;
      case RangeError.prototype:  prefix = 'RangeError'; break;
      case ReferenceError.prototype: prefix = 'ReferenceError'; break;
      case SyntaxError.prototype: expr = 'SyntaxError'; break;
      case TypeError.prototype: expr = 'TypeError'; break;
      case URIError.prototype: expr = 'URIError'; break;
      case PermissionError.prototype: expr = 'PermissionError'; break;
      default:
        expr = 'Error';
        expectedProto = Error.prototype;
    }
    if (typeof value.message === 'string') {
      expr += '(' + $.utils.code.quote(value.message) + ')';
    } else {
      expr += '()';
    }
  } else if (type === 'Function') {
    expectedProto = Function.prototype;
    expr = Function.prototype.toString.call(value);
    if (opts.abbreviateFunctions) {
      expr = fail(expr.replace(/\{[^]*$/, '{ ... }'));
    }
  } else if (type === 'Object') {
    expectedProto = Object.prototype;
    prefix = '{';
    suffix = '}';
    entries = [];
    var keys = Object.getOwnPropertyNames(value);
    for (var i = 0; i < keys.length; i++) {
      suspend();
      if (i >= opts.propertyLimit) {
        entries[i] = '/* and ' + (keys.length - opts.propertyLimit) + ' more */';
        break;
      }
      var key = keys[i];
      // BUG(#469): property keys that are NumericLiterals (like 3.2e4
      // or 0xf00) can also appear unquoted!
      entries[i] =
        ($.utils.code.isIdentifierName(key) ? key : $.utils.code.quote(key)) +
        ': ' + expressionForProperty(key);
    }
  } else if (type === 'RegExp') {
    expr = RegExp.prototype.toString.call(value);
    expectedProto = RegExp.prototype;
  } else if (type === 'Thread') {
    if (selector) return selector.toExpr();
    expr = 'new Thread(' + fail('unable to reconstruct thread state') + ')';
    expectedProto = Thread.prototype;
  } else if (type === 'WeakMap') {
    expectedProto = WeakMap.prototype;
    expr = 'new WeakMap()';
  } else {
    throw new TypeError('unknown internal type ' + type);
  }

  // TODO: Prepend/append call to Object.defineProperties for remaining
  // properties & property attributes.

  // Pre/append prototype information if it is not as expected.
  if (proto !== expectedProto) {
    var protoString = expressionFor(proto, {depth: 0});
    if (opts.proto === 'set') {
      prefix = 'Object.setPrototypeOf(' + prefix;
      suffix += ', ' + protoString + ')';
    } else if (opts.proto === 'note') {
      notes.push('[[Proto]]: ' + protoString);
    }
  }

  // Prepend/append owner information.
  var ownerString = expressionFor(Object.getOwnerOf(value), {depth: 0});
  if (opts.owner === 'set') {
    // BUG: Object.setOwnerOf(obj, owner) does not return obj (yet).
    throw new Error("can't set owner in an expression yet");
    // prefix = 'Object.setOwnerOf(' + prefix;
    // suffix += ', ' + ownerString + ')';
  } else if (opts.owner === 'note') {
    notes.push('[[Owner]]: ' + ownerString);
  }

  // Prepend/append notes.
  if (selectorNote)  {
    prefix = $.utils.code.blockComment(selectorNote) + ' ' + prefix;
  }
  if (notes.length) {
    suffix += ' ' + $.utils.code.blockComment(notes.join(', '));
  }

  // Join entries choosing a suitable layout depending on available space.
  if (entries && entries.length) {
    // Try single-line output.
    // BUG: this omits required trailing comma when there are undefined
    // trailing aray elements (e.g., [1, 2, 3,,].
    expr = entries.join(', ');
    var result = prefix + expr + suffix;
    if (result.length <= opts.lineLength && !result.includes('\n')) {
      return result;
    }

    // Generate multi-line output.
    var padding = ' '.repeat(opts.indent);
    expr = '\n' + $.utils.string.prefixLines(entries.join(',\n'), padding) + ',\n';
  }

  return prefix + expr + suffix;
};
Object.setOwnerOf($.utils.code.expressionFor, $.physicals.Maximilian);
Object.setOwnerOf($.utils.code.expressionFor.prototype, $.physicals.Maximilian);
$.utils.code.blockComment = function blockComment(text) {
  /* Format text as a block comment.  Any occurences of the closing
   * block comment delimiter in text will have a space inerted in them.
   * If text is undefined, an empty string will be returned instead.
   *
   * Arguments:
   * - text: string | undefined - the contents of the comment.
   * Returns: string - the block comment.
   */
  return text ? '/* ' + text.replace(/\*\//g, '* /') + ' */' : '';
};
Object.setOwnerOf($.utils.code.blockComment, $.physicals.Maximilian);
Object.setOwnerOf($.utils.code.blockComment.prototype, $.physicals.Maximilian);

