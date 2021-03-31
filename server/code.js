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
 * @fileoverview Utilities for manipulating JavaScript code.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

/**
 * A collection of useful regular expressions.
 * @const
 */
var regexps = {};

/**
 * Matches (globally) escape sequences found in string and regexp
 * literals, like '\n' or '\x20' or '\u1234'.
 * @const
 */
regexps.escapes = /\\(?:["'\\\/0bfnrtv]|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2})/g;

/**
 * Matches a single-quoted string literal, like "'this one'" and
 * "'it\\'s'".
 * @const
 */
regexps.singleQuotedString =
    new RegExp("'(?:[^'\\\\\\r\\n\\u2028\\u2029]|" +
               regexps.escapes.source + ")*'", 'g');

/**
 * Matches a double-quoted string literal, like '"this one"' and
 * '"it\'s"'.
 * @const
 */
regexps.doubleQuotedString =
    new RegExp('"(?:[^"\\\\\\r\\n\\u2028\\u2029]|' +
               regexps.escapes.source + ')*"', 'g');

/**
 * Matches a string literal, like "'this one' and '"that one"' as well
 * as "the 'string literal' substring of this longer string" too.
 * @const
 */
regexps.string = new RegExp('(?:' + regexps.singleQuotedString.source + '|' +
    regexps.doubleQuotedString.source + ')', 'g');

/**
 * Matches exaclty a string literal, like "'this one'" but notably not
 * " 'this one' " (because it contains other characters not part of
 * the literal).
 * @const
 */
regexps.stringExact = new RegExp('^' + regexps.string.source + '$');

/**
 * RegExp matching a valid JavaScript identifier.  Note that this is
 * fairly conservative, because ANY Unicode letter can appear in an
 * identifier - but the full regexp is absurdly complicated.
 * @const
 */
regexps.identifier = /[A-Za-z_$][A-Za-z0-9_$]*/g;

/**
 * RegExp matching exactly a valid JavaScript identifier.  See note
 * for .identifier, above.
 * @const
 */
regexps.identifierExact = new RegExp('^' + regexps.identifier.source + '$');

/**
 * Convert a string representation of a string literal to a string.
 * Basically does eval(s), but safely and only if s is a string literal.
 * @param {string} s A string consisting of exactly a string literal.
 * @return {string} The string value of the literal s.
 */
var parseString = function(s) {
  if (!regexps.stringExact.test(s)) {
    throw new TypeError(quote(s) + ' is not a string literal');
  };
  return s.slice(1, -1).replace(regexps.escapes, function(esc) {
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

/**
 * Convert a string into a string literal.  We use single or double
 * quotes depending on which occurs less frequently in the string to
 * be escaped (prefering single quotes if it's a tie).  Strictly
 * speaking we only need to escape backslash, \r, \n, \u2028 (line
 * separator), \u2029 (paragraph separator) and whichever quote
 * character we're using, but for output readability we escape all the
 * control characters.
 *
 * TODO(cpcallen): Consider using optimised algorithm from Node.js's
 *     util.format (see strEscape function in
 *     https://github.com/nodejs/node/blob/master/lib/util.js).
 * @param {string} str The string to convert.
 * @return {string} The value s as a eval-able string literal.
 */
var quote = function(str) {
  if (count(str, "'") > count(str, '"')) {  // More 's.  Use "s.
    return '"' + str.replace(quote.doubleRE, quote.replace) + '"';
  } else {  // Equal or more "s.  Use 's.
    return "'" + str.replace(quote.singleRE, quote.replace) + "'";
  }
};

/**
 * Regexp for characters to be escaped in a single-quoted string.
 */
quote.singleRE = /[\x00-\x1f\\\u2028\u2029']/g;

/**
 * Regexp for characters to be escaped in a single-quoted string.
 */
quote.doubleRE = /[\x00-\x1f\\\u2028\u2029"]/g;

/**
 * Replacer function (for either case)
 * @param {string} c Single UTF-16 code unit ("character") string to
 *     be replaced.
 * @return {string} Multi-character string containing escaped
 *     representation of c.
 */
quote.replace = function(c) {
  return quote.replacements[c];
};

/**
 * Map of replacements for quote function.
 */
quote.replacements = {
  '\x00': '\\0',   '\x01': '\\x01', '\x02': '\\x02', '\x03': '\\x03',
  '\x04': '\\x04', '\x05': '\\x05', '\x06': '\\x06', '\x07': '\\x07',
  '\x08': '\\b',   '\x09': '\\t',   '\x0a': '\\n',   '\x0b': '\\v',
  '\x0c': '\\f',   '\x0d': '\\r',   '\x0e': '\\x0e', '\x0f': '\\x0f',
  '"': '\\"', "'": "\\'", '\\': '\\\\',
  '\u2028': '\\u2028', '\u2029': '\\u2029',
};

/**
 * Count non-overlapping occurrences of searchString in str.
 *
 * There are many possible implementations; using .split works pretty
 * well but this is slightly faster at time of writing.  See
 * https://jsperf.com/count-the-number-of-characters-in-a-string for
 * latest performance measurements.
 * @param {string} str The string to be searched.
 * @param {string} searchString The string to count occurrences of.
 * @return {number} The number of occurrences of searchString in str.
 */
var count = function(str, searchString) {
  var index = 0;
  for(var count = 0; ; count++) {
    index = str.indexOf(searchString, index);
    if (index === -1) return count;
    index += searchString.length;
  }
};

exports.quote = quote;
exports.regexps = regexps;
exports.parseString = parseString;

// For unit testing only!
exports.testOnly = {
  count: count,
}
