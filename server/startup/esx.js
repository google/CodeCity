/**
 * @license
 * Copyright 2017 Google LLC
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
 * @fileoverview Initialisation code to set up CodeCity JavaScript
 *     extensions.
 * @author cpcallen@google.com (Christopher Allen)
 */

// Global objects.
var Thread = new 'Thread';
var PermissionError = new 'PermissionError';

(function() {
  // Hack to work around restriction that the 'new hack' only works on
  // literal strings.  Note name must not contain any double quotes or
  // backslashes, because we have no easy way to escape them yet!
  var builtin = function(name) {
    return eval('new "' + name + '"');
  };

  var classes = ['PermissionError', 'Thread'];
  // Prototypes of global constructors.
  for (var i = 0; i < classes.length; i++) {
    var constructor = builtin(classes[i]);
    Object.defineProperty(constructor, 'prototype', {
                          configurable: false,
                          enumerable: false,
                          writable: false,
                          value: builtin(classes[i] + '.prototype')
                          });
    Object.defineProperty(constructor.prototype, 'constructor', {
                          configurable: true,
                          enumerable: false,
                          writable: true,
                          value: constructor
                          });
  }

  // Configure Error subclasses.
  var errors = ['PermissionError'];
  for (var i = 0; i < errors.length; i++) {
    var constructor = builtin(errors[i]);
    Object.defineProperty(constructor.prototype, 'name', {
                          configurable: true,
                          enumerable: false,
                          writable: true,
                          value: errors[i]
                          });
  }

  // Struct is a list of tuples:
  //     [Object, 'Object', [static methods], [instance methods]]

  var struct = [
    [Object, 'Object', ['getOwnerOf', 'setOwnerOf'], []],
    [Thread, 'Thread',
     ['current', 'kill', 'suspend', 'callers'],
     ['getTimeLimit', 'setTimeLimit']],
  ];
  for (var i = 0; i < struct.length; i++) {
    var obj = struct[i][0];
    var objName = struct[i][1];
    var staticMethods = struct[i][2];
    var instanceMethods = struct[i][3];
    for (var j = 0; j < staticMethods.length; j++) {
      var member = staticMethods[j];
      Object.defineProperty(obj, member,
          {configurable: true,
           enumerable: false,
           writable: true,
           value: builtin(objName + '.' + member)});
    }
    for (var j = 0; j < instanceMethods.length; j++) {
      var member = instanceMethods[j];
      Object.defineProperty(obj.prototype, member,
          {configurable: true,
           enumerable: false,
           writable: true,
           value: builtin(objName + '.prototype.' + member)});
    }
  }
})();

///////////////////////////////////////////////////////////////////////////////
// Array.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

(function() {
  function toInteger(value) {
    var number = Number(value);
    if (isNaN(number)) {
      return 0;
    } else if (number === 0 || !isFinite(number)) {
      return number;
    }
    return Math.trunc(number);
  }

  function toLength(value) {
    var len = toInteger(value);
    if (len <= 0) return 0;
    return Math.min(len, Number.MAX_SAFE_INTEGER);  // Handles len === Infinity.
  };

  // For cycle detection in array to string and error conversion; see
  // spec bug github.com/tc39/ecma262/issues/289.
  var visitedByThread = new WeakMap;

  Array.prototype.join = function join(separator) {
    // This implements Array.prototype.join from ES6 §22.1.3.12,
    // with the addition of cycle detection as discussed in
    // https://github.com/tc39/ecma262/issues/289.
    //
    // The only difference from the ES6 version is that the cycle
    // detection mechanism is thread-aware, so multiple parallel
    // invocations of .join will not interfere with each other.
    //
    // Variable names reflect those in the spec.
    //
    // N.B. This function is defined in a closure!
    var isObj = (typeof this === 'object' || typeof this === 'function') &&
        this !== null;
    if (isObj) {
      if (visitedByThread.has(Thread.current())) {
        var visited = visitedByThread.get(Thread.current());
      } else {
        visited = [];
        visitedByThread.set(Thread.current(), visited);
      }
      if (visited.includes(this)) {
        return '';
      }
      visited.push(this);
    }
    try {
      // TODO(cpcallen): setPerms(callerPerms());
      var len = toLength(this.length);
      var sep = (separator === undefined) ? ',' : String(separator);
      if (!len) {
        return '';
      }
      var r = '';
      for (var k = 0; k < len; k++) {
        if (k > 0) r += sep;
        var element = this[k];
        if (element !== undefined && element !== null) {
          r += String(element);
        }
      }
      return r;
    } finally {
      if (isObj) visited.pop();
      if (!visited.length) {
        visitedByThread.delete(Thread.current());
      }
    }
  };
})();
Object.defineProperty(Array.prototype, 'join', {enumerable: false});

///////////////////////////////////////////////////////////////////////////////
// Threads API; parts are roughly conformant with HTML Living
// Standard, plus our local extensions.
//
var suspend = new 'Thread.suspend';

var setTimeout = function setTimeout(func, delay) {
  /* setTimeout(func, delay[, ...args]) -> thread
   *
   * Arguments:
   *   func <Function>: A function to call when the timer elapses.
   *   delay <number>: Time to wait (in ms) before calling the callback.
   *   ...args <any>: Optional arguments to pass to func.
   *
   * Returns:
   *   <Thread>, which may be passed to clearTimeout() to cancel.
   */
  // TODO(cpcallen:perms): setPerms(callerPerms());
  var args = Array.prototype.slice.call(arguments, 2);
  args = [undefined, func, delay, undefined].concat(args);
  return new (Thread.bind.apply(Thread, args));
  // The parens around Thread.bind.apply(...) are mandatory: we want to
  // "new" the function returned by bind, not apply (which is not a
  // constructor).
  return new (Thread.bind.apply(Thread, args))();
};

var clearTimeout = function clearTimeout(thread) {
  /* clearTimeout(thread)
   *
   * Arguments:
   *   thread <Thread>: The Thread object whose execution to be cancelled.
   *
   * Note that attempts to cancel the current thread (or any non-Thread
   * value) is silently ignored.
   */
  // TODO(cpcallen:perms): setPerms(callerPerms());
  if (!(thread instanceof Thread) || thread === Thread.current()) {
    return;
  }
  Thread.kill(thread);
};
