/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Integrated Development Environment for Code City.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var Code = {};
Code.Common = {};

// Keys for the sessionStorage.
Code.Common.SELECTOR = 'code selector';

// Set containing all supported {xyz} names.
Code.Common.KEYWORD_TYPES =
    new Set(['{proto}', '{owner}', '{children}', '{owned}', '{keys}', '{values}']);

/**
 * Tokenize a string such as '$.foo["bar"]' into tokens:
 *   {type: "id",  raw: "$",     valid: true, index: 0, value: "$"}
 *   {type: ".",   raw: ".",     valid: true, index: 1}
 *   {type: "id",  raw: "foo",   valid: true, index: 2, value: "foo"}
 *   {type: "[",   raw: "[",     valid: true, index: 5}
 *   {type: "str", raw: ""bar"", valid: true, index: 6, value: "bar"}
 *   {type: "]",   raw: "]",     valid: true, index: 11}
 * Other tokens include:
 *   {type: "num",     raw: "42",         valid: true, index: 2, value: 42}
 *   {type: "keyword", raw: "{proto}",    valid: true, index: 5, value: '{proto}'}
 *   {type: "keyword", raw: "{owner}",    valid: true, index: 5, value: '{owner}'}
 *   {type: "keyword", raw: "{children}", valid: true, index: 5, value: '{children}'}
 *   {type: "keyword", raw: "{owned}",    valid: true, index: 5, value: '{owned}'}
 *   {type: "keyword", raw: "{keys}",     valid: true, index: 5, value: '{keys}'}
 *   {type: "keyword", raw: "{values}",   valid: true, index: 5, value: '{values}'}
 * If the string is permanently invalid, the last token is:
 *   {type: "?",   raw: "",      valid: false}
 * A temporary token is used internally during parsing:
 *   {type: "unparsed", raw: "[42].foo", index: 8}
 * @param {string} text Selector string.
 * @return {!Array<!Object>} Array of tokens.
 */
Code.Common.tokenizeSelector = function(text) {
  // Trim left whitespace.
  var trimText = text.replace(/^[\s\xa0]+/, '');
  if (!trimText) {
    return [];
  }
  var whitespaceLength = text.length - trimText.length;
  text = trimText;

  // Split the text into an array of tokens.
  // First step is to create two types of tokens: 'str' and 'unparsed'.
  var state = null;
  // null - non-string state
  // 'sqStr' - single quote string
  // 'dqStr' - double quote string
  // 'sqSlash' - backslash in single quote string
  // 'dqSlash' - backslash in double quote string
  var tokens = [];
  var buffer = [];
  for (var i = 0; i < text.length; i++) {
    var char = text[i];
    var index = whitespaceLength + i;
    if (state === null) {
      if (char === "'") {
        Code.Common.pushUnparsed_(buffer, index, tokens);
        state = 'sqStr';
      } else if (char === '"') {
        Code.Common.pushUnparsed_(buffer, index, tokens);
        state = 'dqStr';
      } else {
        buffer.push(char);
      }
    } else if (state === 'sqStr') {
      if (char === "'") {
        Code.Common.pushString_("'", buffer, index, tokens);
        state = null;
      } else {
        buffer.push(char);
        if (char === '\\') {
          state = 'sqSlash';
        }
      }
    } else if (state === 'dqStr') {
      if (char === '"') {
        Code.Common.pushString_('"', buffer, index, tokens);
        state = null;
      } else {
        buffer.push(char);
        if (char === '\\') {
          state = 'dqSlash';
        }
      }
    } else if (state === 'sqSlash') {
      buffer.push(char);
      state = 'sqStr';
    } else if (state === 'dqSlash') {
      buffer.push(char);
      state = 'dqStr';
    }
  }
  if (state !== null) {
    // Convert state into quote type.
    var quotes = (state === 'sqStr' || state === 'sqSlash') ? "'" : '"';
    Code.Common.pushString_(quotes, buffer, index + 1, tokens);
  } else if (buffer.length) {
    Code.Common.pushUnparsed_(buffer, index + 1, tokens);
  }

  // Second step is to parse each 'unparsed' token and split out '[', and ']'
  // tokens.
  for (var i = tokens.length - 1; i >= 0; i--) {
    var token = tokens[i];
    if (token.type === 'unparsed') {
      var index = token.index + token.raw.length;
      // Split string on brackets.
      var split = token.raw.split(/(\s*[\[\]]\s*)/);
      for (var j = split.length - 1; j >= 0; j--) {
        var raw = split[j];
        index -= raw.length;
        var rawTrim = raw.trim();
        if (raw === '') {
          split.splice(j, 1);  // Delete the empty string.
          continue;
        } else if (rawTrim === '[' || rawTrim === ']') {
          split[j] = {type: rawTrim, valid: true};
        } else {
          split[j] = {type: 'unparsed'};
        }
        split[j].raw = raw;
        split[j].index = index;
      }
      // Replace token with split array.
      split.unshift(i, 1);
      Array.prototype.splice.apply(tokens, split);
    }
  }

  // Third step is to parse each 'unparsed' token and split out '{xxx}' tokens.
  for (var i = tokens.length - 1; i >= 0; i--) {
    var token = tokens[i];
    if (token.type === 'unparsed') {
      var index = token.index + token.raw.length;
      var split = token.raw.split(/(\s*{\s*\w*\s*(?:}\s*|$))/);
      for (var j = split.length - 1; j >= 0; j--) {
        var raw = split[j];
        index -= raw.length;
        var rawTrim = raw.trim();
        if (raw === '') {
          split.splice(j, 1);  // Delete the empty string.
          continue;
        }
        var m = rawTrim.match(/{\s*(\w*)\s*(}|$)/);
        if (m) {
          var keywordToken = {type: 'keyword', value: '{' + m[1] + m[2]};
          keywordToken.complete =
              Code.Common.KEYWORD_TYPES.has(keywordToken.value);
          if (keywordToken.complete) {
            keywordToken.valid = true;
          } else {
            keywordToken.valid = false;
            for (var validKeyword of Code.Common.KEYWORD_TYPES) {
              if (validKeyword.startsWith(keywordToken.value)) {
                keywordToken.valid = true;
                break;
              }
            }
          }
          split[j] = keywordToken;
        } else {
          split[j] = {type: 'unparsed'};
        }
        split[j].raw = raw;
        split[j].index = index;
      }
      // Replace token with split array.
      split.unshift(i, 1);
      Array.prototype.splice.apply(tokens, split);
    }
  }

  // Fourth step is to parse each 'unparsed' token as a number, if it is
  // preceded by a '[' token.  If the result is NaN (e.g. in the case it is an
  // unquoted identifier) mark the token as invalid.
  for (var i = 1; i < tokens.length; i++) {
    var token = tokens[i];
    if (tokens[i - 1].type === '[' && token.type === 'unparsed') {
      token.type = 'num';
      token.value = NaN;
      token.valid = false;
      // Does not support E-notation or NaN.
      if (/^\s*[-+]?(\d*\.?\d*|Infinity)\s*$/.test(token.raw)) {
        token.value = Number(token.raw);
        token.valid = !isNaN(token.value);
        token.value = String(token.value);
      }
    }
  }

  // Fifth step is to split remaining 'unparsed' tokens into 'id' and '.'
  // tokens.  The '.' tokens could not be split out before numbers were parsed,
  // since numbers have decimal points.
  var unicodeRegex = /\\u([0-9A-F]{4})/ig;
  function decodeUnicode(m, p1) {
    return String.fromCodePoint(parseInt(p1, 16));
  }
  for (var i = tokens.length - 1; i >= 0; i--) {
    var token = tokens[i];
    if (token.type !== 'unparsed') {
      continue;
    }
    var index = token.index + token.raw.length;
    // Split string on periods.
    var split = token.raw.split(/(\s*\.\s*)/);
    for (var j = split.length - 1; j >= 0; j--) {
      var raw = split[j];
      index -= raw.length;
      if (raw === '') {
        split.splice(j, 1);  // Delete the empty string.
        continue;
      } else if (raw.trim() === '.') {
        split[j] = {
          type: '.',
          valid: true
        };
      } else {
        // Parse Unicode escapes in identifiers.
        var valid = true;
        var value = split[j];
        while (true) {
          var test = value.replace(unicodeRegex, '');
          if (!test.includes('\\')) {
            break;
          }
          // Invalid escape found.  Trim off last char and try again.
          value = value.substring(0, value.length - 1);
          valid = false;
        }
        // Decode Unicode.
        value = value.replace(unicodeRegex, decodeUnicode);
        split[j] = {type: 'id', value: value, valid: valid};
      }
      split[j].raw = raw;
      split[j].index = index;
    }
    // Replace token with split array.
    split.unshift(i, 1);
    Array.prototype.splice.apply(tokens, split);
  }

  // Finally, validate order of tokens.  Only check for permanent errors.
  // E.g. '$..foo' can never be legal.
  // E.g. '$["foo' isn't legal now, but could become legal after more typing.
  var state = 0;
  // 0 - Start or after '.'.  Expecting 'id'.
  // 1 - After 'id' or ']' or 'keyword'.
  //     Expecting '.' or '[' or 'keyword'.
  // 2 - After '['.  Expecting 'str' or 'num'.
  // 3 - After 'str' or 'num'.  Expecting ']'.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (state === 0) {
      if (token.type === 'id') {
        state = 1;
      } else {
        break;
      }
    } else if (state === 1) {
      if (token.type === '.') {
        state = 0;
      } else if (token.type === 'keyword') {
        state = 1;
      } else if (token.type === '[') {
        state = 2;
      } else {
        break;
      }
    } else if (state === 2) {
      if (token.type === 'str' || token.type === 'num') {
        state = 3;
      } else {
        break;
      }
    } else if (state === 3) {
      if (token.type === ']') {
        state = 1;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  // Remove any illegal tokens.
  if (i < tokens.length) {
    tokens = tokens.slice(0, i);
    // Add fail token to prevent autocompletion.
    tokens.push({type: '?', raw: '', valid: false});
  }
  return tokens;
};

/**
 * Push a 'str' token type onto the list of tokens.
 * Handles invalid strings, e.g. 'abc \u---- xyz'
 * @param {string} quotes Quote type (' vs ").
 * @param {!Array<string>} buffer Array of chars that make the string.
 * @param {number} index Char index of start of this token in original input.
 * @param {!Array<!Object>} tokens List of tokens.
 * @private
 */
Code.Common.pushString_ = function(quotes, buffer, index, tokens) {
  var token = {
    type: 'str',
    raw: quotes + buffer.join('') + quotes,
    valid: true
  };
  token.index = index - (token.raw.length - 1);
  do {
    var raw = quotes + buffer.join('') + quotes;
    // Attempt to parse a string.
    try {
      var str = eval(raw);
      break;
    } catch (e) {
      // Invalid escape found.  Trim off last char and try again.
      buffer.pop();
      token.valid = false;
    }
  } while (true);
  buffer.length = 0;
  token.value = str;
  tokens.push(token);
};

/**
 * Push an 'unparsed' token type onto the list of tokens.
 * @param {!Array<string>} buffer Array of chars that make the value.
 * @param {number} index Character index of this token in original input.
 * @param {!Array<!Object>} tokens List of tokens.
 * @private
 */
Code.Common.pushUnparsed_ = function(buffer, index, tokens) {
  var raw = buffer.join('');
  buffer.length = 0;
  if (raw) {
    var token = {
      type: 'unparsed',
      raw: raw,
      index: index - raw.length
    };
    tokens.push(token);
  }
};

/**
 * Split a path selector into a list of parts.
 * E.g. '${proto}.foo' ->
 *   [{type: 'id', value: '$'}, {type: 'keyword', value: '{proto}'}, {type: 'id', value: 'foo'}]
 * @param {string} text Selector string.
 * @return {?Array<!Object>} Array of parts or null if invalid.
 */
Code.Common.selectorToParts = function(text) {
  // TODO: Try caching the results for performance.
  var tokens = Code.Common.tokenizeSelector(text);
  var parts = [];
  for (var token of tokens) {
    if (!token.valid) {
      return null;
    }
    if (['id', 'str', 'num'].includes(token.type)) {
      parts.push({type: 'id', value: token.value});
    } else if (token.type === 'keyword') {
      parts.push({type: token.type, value: token.value});
    }
  }
  return parts;
};

/**
 * Join a list of parts into a path selector.
 * E.g. [{type: 'id', value: '$'}, {type: 'keyword', value: '{proto}'}, {type: 'id', value: 'foo'}] ->
 *   '${proto}.foo'
 * @param {!Array<!Object>} parts Array of parts.
 * @return {string} Selector string.
 */
Code.Common.partsToSelector = function(parts) {
  var text = '';
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part.type === 'id') {
      var value = part.value;
      if (/^[A-Z_$][0-9A-Z_$]*$/i.test(value)) {
        if (i !== 0) {
          text += '.';
        }
        text += value;
      } else {
        text += '[';
        if (/^-?\d{1,15}$/.test(value)) {
          text += value;
        } else {
          text += JSON.stringify(value);
        }
        text += ']';
      }
    } else if (part.type === 'keyword') {
      text += part.value;
    }
  }
  return text;
};

/**
 * Turn a selector string into a valid code reference.
 * E.g. "$.foo" -> "$.foo"
 * E.g. "${proto}.foo" -> "$('${proto}.foo')"
 * Join a list of parts into a valid code reference.
 * @param {string} selector Selector string.
 * @return {string} Code reference.
 */
Code.Common.selectorToReference = function(selector) {
  var noStrings = selector.replace(/(["'])(?:[^\1\\]|\\.)*?\1/g, '');
  if (noStrings.includes('{')) {
    return "$('" + selector + "')";
  }
  return selector;
};

/**
 * Comparison function to sort strings A-Z without regard to case.
 * @param {string} a One string.
 * @param {string} b Another string.
 * @return {number} -1/0/1 comparator value.
 */
Code.Common.caseInsensitiveComp = function(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  var aNum = parseFloat(a);
  var bNum = parseFloat(b);
  if (!isNaN(aNum) && !isNaN(bNum) && aNum !== bNum) {
    // Numeric.
    return (aNum < bNum) ? -1 : 1;
  }
  // ASCIIbetical.
  return (a < b) ? -1 : ((a > b) ? 1 : 0);
};

// Set background colour to differentiate server vs local copy.
if (location.hostname === 'localhost') {
  window.addEventListener('load', function() {
    document.body.style.backgroundColor = '#ffe';
  });
}
