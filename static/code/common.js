/**
 * @license
 * Code City: Common Code.
 *
 * Copyright 2018 Google Inc.
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
 * @fileoverview Integrated Development Environment for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

var Code = {};
Code.Common = {};

// Keys for the sessionStorage.
Code.Common.SELECTOR = 'code selector';

/**
 * Tokenize a string such as '$.foo["bar"]'
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

  function pushString(state, buffer, index) {
    // Convert state into quote type.
    var quotes;
    switch (state) {
      case 1:
      case 3:
        quotes = "'";
        break;
      case 2:
      case 4:
        quotes = '"';
        break;
      default:
        throw 'Unknown state';
    }
    var token = {
      type: '"',
      raw: quotes + buffer.join('') + quotes,
      valid: true
    };
    token.index = whitespaceLength + index - (token.raw.length - 1);
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
  }
  function pushUnparsed(buffer, index) {
    var raw = buffer.join('');
    buffer.length = 0;
    if (raw) {
      var token = {
        type: 'unparsed',
        raw: raw,
        index: whitespaceLength + index - raw.length
      };
      tokens.push(token);
    }
  }

  // Split out strings.
  var state = 0;
  // 0 - non-string state
  // 1 - single quote string
  // 2 - double quote string
  // 3 - backslash in single quote string
  // 4 - backslash in double quote string
  var tokens = [];
  var buffer = [];
  for (var i = 0; i < text.length; i++) {
    var char = text[i];
    if (state === 0) {
      if (char === "'") {
        pushUnparsed(buffer, i);
        state = 1;
      } else if (char === '"') {
        pushUnparsed(buffer, i);
        state = 2;
      } else {
        buffer.push(char);
      }
    } else if (state === 1) {
      if (char === "'") {
        pushString(state, buffer, i);
        state = 0;
      } else {
        buffer.push(char);
        if (char === '\\') {
          state = 3;
        }
      }
    } else if (state === 2) {
      if (char === '"') {
        pushString(state, buffer, i);
        state = 0;
      } else {
        buffer.push(char);
        if (char === '\\') {
          state = 4;
        }
      }
    } else if (state === 3) {
      buffer.push(char);
      state = 1;
    } else if (state === 4) {
      buffer.push(char);
      state = 2;
    }
  }
  if (state !== 0) {
    pushString(state, buffer, i);
  } else if (buffer.length) {
    pushUnparsed(buffer, i);
  }

  // Split out brackets: [ ]
  for (var i = tokens.length - 1; i >= 0; i--) {
    var token = tokens[i];
    if (token.type === 'unparsed') {
      var index = token.index + token.raw.length;
      // Split string on brackets.
      var split = token.raw.split(/(\s*(?:\[|\])\s*)/);
      for (var j = split.length - 1; j >= 0; j--) {
        var raw = split[j];
        index -= raw.length;
        if (raw === '') {
          split.splice(j, 1);  // Delete the empty string.
          continue;
        } else if (raw.trim() === '[') {
          split[j] = {
            type: '[',
            valid: true
          };
        } else if (raw.trim() === ']') {
          split[j] = {
            type: ']',
            valid: true
          };
        } else {
          split[j] = {
            type: 'unparsed'
          };
        }
        split[j].raw = raw;
        split[j].index = index;
      }
      // Replace token with split array.
      split.unshift(i, 1);
      Array.prototype.splice.apply(tokens, split);
    }
  }

  // Parse numbers.
  for (var i = 1; i < tokens.length; i++) {
    var token = tokens[i];
    if (tokens[i - 1].type === '[' && token.type === 'unparsed') {
      token.type = '#';
      token.value = NaN;
      token.valid = false;
      // Does not support E-notation or NaN.
      if (/^\s*[-+]?(\d*\.?\d*|Infinity)\s*$/.test(token.raw)) {
        token.value = Number(token.raw);
        token.valid = !isNaN(token.value);
      }
    }
  }

  // Split member expressions and parse identifiers.
  var unicodeRegex = /\\u([0-9A-F]{4})/ig;
  function decodeUnicode(m, p1) {
    return String.fromCodePoint(parseInt(p1, 16));
  }
  for (var i = tokens.length - 1; i >= 0; i--) {
    var token = tokens[i];
    if (token.type === 'unparsed') {
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
            if (test.indexOf('\\') === -1) {
              break;
            }
            // Invalid escape found.  Trim off last char and try again.
            value = value.substring(0, value.length - 1);
            valid = false;
          }
          // Decode Unicode.
          value = value.replace(unicodeRegex, decodeUnicode);
          split[j] = {
            type: 'id',
            value: value,
            valid: valid
          };
        }
        split[j].raw = raw;
        split[j].index = index;
      }
      // Replace token with split array.
      split.unshift(i, 1);
      Array.prototype.splice.apply(tokens, split);
    }
  }

  // Validate order of tokens.
  var state = 0;
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
      } else if (token.type === '[') {
        state = 2;
      } else {
        break;
      }
    } else if (state === 2) {
      if (token.type === '"' || token.type === '#') {
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
 * Split a path selector into a list of parts.
 * e.g. '$.foo.bar' -> ['$', 'foo', 'bar']
 * @param {string} text Selector string.
 * @return {Array<string>} Array of parts or null if invalid.
 */
Code.Common.selectorToParts = function(text) {
  // TODO: Try caching the results for performance.
  var tokens = Code.Common.tokenizeSelector(text);
  var parts = [];
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (!token.valid) {
      return null;
    }
    if (token.type === 'id' || token.type === '"' || token.type === '#') {
      parts.push(token.value);
    }
  }
  return parts;
};

/**
 * Join a list of parts into a path selector.
 * e.g. ['$', 'foo', 'bar'] -> '$.foo.bar'
 * @param {!Array<string>} parts Array of parts.
 * @return {string} Selector string.
 */
Code.Common.partsToSelector = function(parts) {
  var text = '';
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (/^[A-Z_$][0-9A-Z_$]*$/i.test(part)) {
      if (i !== 0) {
        text += '.';
      }
      text += part;
    } else {
      text += '[';
      if (/^-?\d{1,15}$/.test(part)) {
        text += part;
      } else {
        text += JSON.stringify(part);
      }
      text += ']';
    }
  }
  return text;
};
