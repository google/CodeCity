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
$.utils.code.toSource = function toSource(value, opt_seen) {
  // Given an arbitrary value, produce a source code representation.
  // Primitive values are straightforward: "42", "'abc'", "false", etc.
  // Functions, RegExps, Dates, Arrays, and errors are returned as their
  // definitions.
  // Other objects and symbols are returned as selector expression.
  // Throws if a code representation can't be made.
  var type = typeof value;
  if (value === undefined || value === null ||
      type === 'number' || type === 'boolean') {
    if (Object.is(value, -0)) {
      return '-0';
    }
    return String(value);
  } else if (type === 'string') {
    return JSON.stringify(value);
  } else if (type === 'function') {
    return Function.prototype.toString.call(value);
  } else if (type === 'object') {
    // TODO: Replace opt_seen with Set, once available.
    if (opt_seen) {
      if (opt_seen.includes(value)) {
        throw new RangeError('[Recursive data structure]');
      }
      opt_seen.push(value);
    } else {
      opt_seen = [value];
    }
    var proto = Object.getPrototypeOf(value);
    if (proto === RegExp.prototype) {
      return String(value);
    } else if (proto === Date.prototype) {
      return 'new Date(\'' + value.toJSON() + '\')';
    } else if (proto === Object.prototype) {
      var props = Object.getOwnPropertyNames(value);
      var data = [];
      for (var i = 0; i < props.length; i++) {
        var propName = props[i];
        var propValue = value[propName];
        try {
          var propSource = (typeof propValue === 'function') ?
              ('function ' + propValue.name + '() { ... }') :
              $.utils.code.toSource(propValue, opt_seen);
          data[i] = JSON.stringify(propName) + ': ' + propSource;
        } catch (e) {
          // Recursive data structure.  Bail.
          data = null;
          break;
        }
      }
      if (data) {
        var selectorString = '';
/*
        var selector = $.Selector.for(value);
        if (selector) {
          selectorString = ' // ' + selector.toString();
        }
*/
        if (!data.length) {
          return '{}' + selectorString;
        }
        return '{' + selectorString + '\n' + $.utils.string.prefixLines(data.join(',\n'), '  ') + '\n}';
      }
    } else if (proto === Array.prototype && Array.isArray(value) &&
               value.length <= 100) {
      var props = Object.getOwnPropertyNames(value);
      var data = [];
      for (var i = 0; i < value.length; i++) {
        if (props.includes(String(i))) {
          var propValue = value[i]
          try {
            data[i] = (typeof propValue === 'function') ?
                ('function ' + propValue.name + '() { ... }') :
                $.utils.code.toSource(propValue, opt_seen);
          } catch (e) {
            // Recursive data structure.  Bail.
            data = null;
            break;
          }
        } else {
          data[i] = '';
        }
      }
      if (data) {
        if (!data.length) {
          return '[]';
        }
        return '[\n' + $.utils.string.prefixLines(data.join(',\n'), '  ') + '\n]';
      }
    } else if (value instanceof Error) {
      var constructor;
      if (proto === Error.prototype) {
        constructor = 'Error';
      } else if (proto === EvalError.prototype) {
        constructor = 'EvalError';
      } else if (proto === RangeError.prototype) {
        constructor = 'RangeError';
      } else if (proto === ReferenceError.prototype) {
        constructor = 'ReferenceError';
      } else if (proto === SyntaxError.prototype) {
        constructor = 'SyntaxError';
      } else if (proto === TypeError.prototype) {
        constructor = 'TypeError';
      } else if (proto === URIError.prototype) {
        constructor = 'URIError';
      } else if (proto === PermissionError.prototype) {
        constructor = 'PermissionError';
      }
      var msg;
      if (value.message === undefined) {
        msg = '';
      } else {
        try {
          msg = $.utils.code.toSource(value.message, opt_seen);
        } catch (e) {
          // Leave msg undefined.
        }
      }
      if (constructor && msg !== undefined) {
        return constructor + '(' + msg + ')';
      }
    }
  }
  if (type === 'object' || type === 'symbol') {
    var selector = $.Selector.for(value);
    if (selector) {
      var string = selector.toString();
      var expr = selector.toExpr();
      if (string === expr) return expr;
      return '// ' + string + '\n' + expr;
    }
    throw new ReferenceError('[' + type + ' with no known selector]');
  }
  // Can't happen.
  throw new TypeError('[' + type + ']');
};
Object.setOwnerOf($.utils.code.toSource, $.physicals.Neil);
$.utils.code.toSource.processingError = false;
$.utils.code.toSourceSafe = function toSourceSafe(value) {
  // Same as $.utils.code.toSource, but don't throw any selector errors.
  try {
    return $.utils.code.toSource(value);
  } catch (e) {
    if (e instanceof ReferenceError) {
      return e.message;
    }
    throw e;
  }
};
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
$.utils.code.eval = function(src, evalFunc) {
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
  return $.utils.code.toSource(out);
};
delete $.utils.code.eval.name;
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

