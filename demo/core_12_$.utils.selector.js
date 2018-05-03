/**
 * @license
 * Code City: Selector Utilities.
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
 * @fileoverview Selector utilities for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

$.utils.selector = {}

$.utils.selector.toValue = function(str) {
  /* Parse the string to extract a reference.
   * This is the actual implementation of the $() function.
   */
  // TODO: Support notations starting with @roomname and ~username.
  var m = str.match(/^\s*(\$|me|~|here|@)(.*)\s*$/);
  if (!m) {
    return undefined;
  }
  var root = m[1];
  var suffix = m[2];
  if (root === '$') {
    root = $;
  } else if (root === '~' || root === 'me') {
    root = user;
  } else if (root === '@' || root === 'here') {
    root = user.location;
  } else {
    throw Error("Can't happen.  Regex is too liberal.");
  }
  if (!suffix) {
    return root;
  }
  // This regex has two main groups:
  // 1) match .foo
  // 2) match [42] or ['bar'] or ["baz"]
  if (suffix.search(/^((\s*\.\s*[A-Za-z$_][A-Za-z0-9$_]*\s*)|(\s*\[\s*(\d+|'([^'\\]*(\\.[^'\\]*)*)'|"([^"\\]*(\\.[^"\\]*)*)")\s*\]\s*))+$/) === 0) {
    // TODO: Handle permissions for -r properties.
    return eval('(root)' + suffix);
  }
  return undefined;
};

$.utils.selector.getGlobal = function() {
  // Return a pseudo global object.
  // TODO: Cache this object.
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
  global.RangeError = RangeError;
  global.ReferenceError = ReferenceError;
  global.RegExp = RegExp;
  global.setTimeout = setTimeout;
  global.String = String;
  global.suspend = suspend;
  global.SyntaxError = SyntaxError;
  global.TypeError = TypeError;
  global.unescape = unescape;
  global.URIError = URIError;
  return global;
};

$.utils.selector.partsToValue = function(parts) {
  // Given an array of parts, return the described object.
  // E.g. [{type: 'id', value: '$'}, {type: '^'}, {type: 'id', value: 'foo'}] ->
  //   Object.getPrototypeOf($).foo
  var obj = $.utils.selector.getGlobal();
  for (var i = 0, part; (part = parts[i]); i++) {
    if (part.type === '^') {
      obj = Object.getPrototypeOf(obj);
    } else if (part.type === 'id') {
      obj = obj[part.value];
    } else {
      throw 'Invalid part.';
    }
  }
  return obj;
};

$.utils.selector.partsToSelector = function(parts) {
  // Join a list of parts into a path selector.
  // E.g. [{type: 'id', value: '$'}, {type: '^'}, {type: 'id', value: 'foo'}] ->
  //   '$^.foo'
  // Try to keep this code in sync with /static/code/common.js
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
    } else if (part.type === '^') {
      text += '^';
    }
  }
  return text;
};

$.utils.selector.selectorToReference = function(selector) {
  // Turn a selector string into a valid code reference.
  // E.g. "$.foo" -> "$.foo"
  // E.g. "$^.foo" -> "$('$^.foo')"
  // Try to keep this code in sync with /static/code/common.js
  var noStrings = selector.replace(/(["'])(?:[^\1\\]|\\.)*?\1/g, '');
  if (/[\^]/.test(noStrings)) {
    return "$('" + selector + "')";
  }
  return selector;
};
