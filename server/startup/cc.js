/**
 * @license
 * Code City: Startup code.
 *
 * Copyright 2017 Google Inc.
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
 * @fileoverview Initialisation code to set up CC-specific extensions.
 * @author cpcallen@google.com (Christopher Allen)
 */

// Global objects.
var Thread = new 'Thread';
var PermissionError = new 'PermissionError';

(function() {
  var classes = ['PermissionError', 'Thread'];
  // Prototypes of global constructors.
  for (var i = 0; i < classes.length; i++) {
    var constructor = new classes[i];
    Object.defineProperty(constructor, 'prototype', {
                          configurable: false,
                          enumerable: false,
                          writable: false,
                          value: new (classes[i] + '.prototype')
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
    var constructor = new errors[i];
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
    [Thread, 'Thread', [], []],
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
           value: new (objName + '.' + member)});
    }
    for (var j = 0; j < instanceMethods.length; j++) {
      var member = instanceMethods[j];
      Object.defineProperty(obj.prototype, member,
          {configurable: true,
           enumerable: false,
           writable: true,
           value: new (objName + '.prototype.' + member)});
    }
  }
})();

// Threads API; parts are roughly conformant with HTML Living
// Standard, plus our local extensions.
var suspend = new 'suspend';

var setTimeout = function(func, delay) {
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
  var args = arguments.slice(2);
  return new Thread(func, undefined, args, delay);
};

var clearTimeout = new 'clearTimeout';

// Namespace for CodeCity-specific extensions:
var CC = {};

// Permissions API.
CC.root = new 'CC.root';
var perms = new 'perms';
var setPerms = new 'setPerms';

// Networking functions.
CC.connectionListen = new 'CC.connectionListen';
CC.connectionUnlisten = new 'CC.connectionUnlisten';
CC.connectionWrite = new 'CC.connectionWrite';
CC.connectionClose = new 'CC.connectionClose';
