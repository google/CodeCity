/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Code to clean up after setting up $.utils.acorn
 * @author cpcallen@google.com (Christopher Allen)
 */

// TODO: remove exports and module from global scope when this becomes
// possible.
var exports = undefined;
var module = undefined;

$.utils.acorn.defaultOptions.ecmaVersion = 5;
