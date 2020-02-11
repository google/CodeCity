/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
    throw new Error("Can't happen.  Regex is too liberal.");
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
      throw new Error('Invalid part.');
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

$.utils.selector.setSelector = function(object, selector) {
  // Register a selector as mapping to the specified object.
  if (!object || (typeof object !== 'object' && typeof object !== 'function')) {
    return;
  }
  // SECURITY: Does not validate that the selector maps to the object.
  // Either add validation, or only allow trusted callers.
  // HACK: This implementation is temporary, replace with WeakMap ASAP.
  // Grossly inefficient and breaks garbage collection.
  var map = $.utils.selector.objectMap_;
  for (var i = 0; i < map.length; i++) {
    if (map[i][0] === object) {
      // Update existing selector.
      // TODO: Either choose the shortest/most stable one,
      // or store a list of the n best selectors.
      var oldSelector = map[i][1];
      if (selector.length < oldSelector.length) {
        map[i][1] = selector;
      }
      return;
    }
  }
  // Add new selector.
  map.push([object, selector]);
};

$.utils.selector.getSelector = function(object) {
  // Given an object, return a selector that defines that object.
  // Returns undefined if no selector is known.
  // HACK: This implementation is temporary, replace with WeakMap ASAP.
  // Grossly inefficient and breaks garbage collection.
  var map = $.utils.selector.objectMap_;
  for (var i = 0; i < map.length; i++) {
    if (map[i][0] === object) {
      return map[i][1];
    }
  }
  return undefined;
};

// HACK: This implementation is temporary, replace with WeakMap ASAP.
// Grossly inefficient and breaks garbage collection.
$.utils.selector.objectMap_ = [];
