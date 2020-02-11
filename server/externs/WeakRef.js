/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Closure Compiler externs for the new tc39 WeakRef and
 *     FinalizationGroup API https://github.com/tc39/proposal-weakrefs
 * @author cpcallen@google.com (Christopher Allen)
 * @externs
 */

/**
 * @constructor
 * @param {T} target
 * @template T
 */
// TODO(cpcallen): Make T bounded to {!Object} once closure-compiler
// supports bounded generic types.
var WeakRef = function(target) {};

/**
 * @return {T}
 */
WeakRef.prototype.deref = function() {};

/**
 * @constructor
 * @param {function(!Iterator<HOLDINGS>)} cleanupCallback
 * @template TARGET, HOLDINGS, TOKEN
 */
// TODO(cpcallen): Make TARGET and TOKEN bounded to {!Object} once
// closure-compiler supports bounded generic types.
var FinalizationGroup = function(cleanupCallback) {};

/**
 * @param {TARGET} target
 * @param {HOLDINGS} holdings
 * @param {?TOKEN} unregisterToken
 * @return {void}
 */
FinalizationGroup.prototype.register =
    function(target, holdings, unregisterToken) {};

/**
 * @param {?TOKEN} unregisterToken
 * @return {void}
 */
FinalizationGroup.prototype.unregister = function(unregisterToken) {};

/**
 * @param {function(!Iterator<HOLDINGS>)} cleanupCallback
 * @return {void}
 */
FinalizationGroup.prototype.cleanupSome = function(cleanupCallback) {};
