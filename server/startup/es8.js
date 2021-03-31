/**
 * @license
 * Copyright 2021 Google LLC
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
 * implementation to include some features of ECMAScript 2017 (ES8).
 * @author cpcallen@google.com (Christopher Allen)
 */

///////////////////////////////////////////////////////////////////////////////
// Object constructor polyfills
///////////////////////////////////////////////////////////////////////////////

Object.getOwnPropertyDescriptors = function getOwnPropertyDescriptors(obj) {
  var ownKeys = Object.getOwnPropertyNames(obj);
  var descriptors = {};
  for (var i = 0; i < ownKeys.length; i++) {
    var key = ownKeys[i];
    var descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (descriptor !== undefined) {
      descriptors[key] = descriptor;
    }
  }
  return descriptors;
};
Object.defineProperty(Object, 'getOwnPropertyDescriptors', {enumerable: false});
