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
 * @fileoverview Test the permissions system.
 * @author cpcallen@google.com (Christopher Allen)
 */


tests.perms = function() {
  console.assert(perms() === CC.root, 'perms() returns root');
};

tests.setPerms = function() {
  var bob = {};
  console.assert(perms() === CC.root, 'before setPerms()');
  (function() {
    setPerms(bob);
    console.assert(perms() === bob, 'after setPerms()');
    // Perms revert at end of scope.
  })();
  console.assert(perms() === CC.root, 'after scope end');
};

tests.getOwnerOf = function() {
  var bob = {};
  var roots = {};
  setPerms(bob);
  var bobs = {};
  console.assert(Object.getOwnerOf(Object) === CC.root, 'getOwenerOfObject');
  console.assert(Object.getOwnerOf(roots) === CC.root, 'getOwnerOfNew');
  console.assert(Object.getOwnerOf(bobs) === bob, 'getOwnerOfBobs');
};

tests.setOwnerOf = function() {
  var bob = {};
  var obj = {};
  console.assert(Object.setOwnerOf(obj, bob) === obj, 'setOwneerOf return');
  console.assert(Object.getOwnerOf(obj) === bob, 'setOwenerOf effect');
};
