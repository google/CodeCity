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
 * @author fraser@google.com (Neil Fraser)
 */

$.utils.code = {};


$.utils.code.toSource = function(value, opt_seen) {
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
      return 'Date(\'' + value.toJSON() + '\')';
    } else if (proto === Array.prototype && Array.isArray(value) &&
               value.length <= 100) {
      var props = Object.getOwnPropertyNames(value);
      var data = [];
      for (var i = 0; i < value.length; i++) {
        if (props.includes(String(i))) {
          try {
            data[i] = $.utils.code.toSource(value[i], opt_seen);
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
        return '[' + data.join(', ') + ']';
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
    // No Selectors in this tiny db, so just toString it.
    return Object.prototype.toString.call(value);
  }
  // Can't happen.
  throw new TypeError('[' + type + ']');
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
    try {
      // Attempt to print a source-legal representation.
      out = $.utils.code.toSource(out);
    } catch (e) {
      try {
        // Maybe it's something JSON can deal with (like an array).
        out = JSON.stringify(out);
      } catch (e) {
        try {
          // Maybe it's a recursive data structure.
          out = String(out);
        } catch (e) {
          // Maybe it's Object.create(null).
          out = '[Unprintable value]';
        }
      }
    }
  } catch (e) {
    // Exception thrown.  Use built-in ToString via + to avoid calling
    // String, least it call a .toString method that itself throws.
    // TODO(cpcallen): find an alternative way of doing this safely
    // once the interpreter calls String for all string conversions.
    if (e instanceof Error) {
      out = 'Unhandled error: ' + e.name;
      if (e.message) {
        out += ': ' + e.message;
      }
      if (e.stack) {
        out += '\n' + e.stack;
      }
    } else {
      out = 'Unhandled exception: ' + e;
    }
  }
  return out;
};
