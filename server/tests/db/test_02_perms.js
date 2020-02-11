/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
  Object.setOwnerOf(obj, bob);
  console.assert(Object.getOwnerOf(obj) === bob, 'setOwenerOf');
};
