/**
 * @license
 * Code City: Code Utilities.
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
 * @fileoverview Code utilities for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

$.utils.code = {};


$.utils.code.valueToSource = function(value) {
  // Given an arbitrary value, produce a source code representation.
  // Primitive values are straightforward: "42", "'abc'", "false", etc.
  // Functions, RegExps, Dates, and errors are returned as their definitions.
  // Other objects are returned as selector expression.
  if (Object.is(value, -0)) {
    return '-0';
  }
  var type = typeof value;
  if (value === undefined || value === null ||
      type === 'number' || type === 'boolean') {
    return String(value);
  }
  if (type === 'string') {
    return JSON.stringify(value);
  }
  if (type === 'function') {
    // TODO(cpcallen): This should call toSource, once we have such a function.
    return String(value);
  }
  var proto = Object.getPrototypeOf(value);
  if (proto === RegExp.prototype) {
    return String(value);
  }
  if (proto === Date.prototype) {
    return 'Date(\'' + value.toJSON() + '\')';
  }
  if ((value instanceof Error) && !(value.message instanceof Error)) {
    var msg;
    if (value.message === undefined) {
      msg = '';
    } else {
      try {
        msg = $.utils.code.valueToSource(value.message);
      } catch (e) {
        // Leave msg undefined.
      }
    }
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
    }
    if (msg !== undefined && constructor) {
      return constructor + '(' + msg + ')';
    }
  }
  if (type === 'object' || type === 'symbol') {
    var selector = $.utils.selector.getSelector(value);
    if (selector) {
      return selector;
    }
    throw ReferenceError('[' + type + ' with no known selector]');
  }
  // Can't happen.
  throw TypeError('[' + type + ']');
};

$.utils.code.valueToSourceSafe = function(value) {
  // Same as $.utils.code.valueToSource, but don't throw any selector errors.
  try {
    return $.utils.code.valueToSource(value);
  } catch (e) {
    if (e instanceof ReferenceError) {
      return e.message;
    }
    throw e;
  }
};
