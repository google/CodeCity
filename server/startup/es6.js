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
 * @fileoverview Polyfills to bring the server's partial JavaScript
 * implementation beyond JavaScript 5.1.
 * @author fraser@google.com (Neil Fraser)
 */

(function() {
  // Struct is a list of tuples:
  //     [Object, 'Object', [static methods], [instance methods]]

  var struct = [
    [Object, 'Object', ['is', 'setPrototypeOf'], []],
    [String, 'String', [], ['endsWith', 'includes', 'repeat', 'startsWith']],
    [Number, 'Number', ['isFinite', 'isNaN', 'isSafeInteger'], []],
    [Math, 'Math', ['sign', 'trunc'], []],
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



Object.defineProperty(Number, 'EPSILON',
    {configurable: false,
     enumerable: false,
     writable: false,
     value: Math.pow(2, -52)});
