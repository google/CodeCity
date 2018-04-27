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
var PermissionError = new 'PermissionError';

(function() {
  var classes = ['PermissionError'];
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
})();

// Threads API; parts are roughly conformant with HTML Living
// Standard, plus our local extensions.
var suspend = new 'suspend';
var setTimeout = new 'setTimeout';
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
