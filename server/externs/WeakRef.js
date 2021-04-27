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
 * @fileoverview Closure Compiler externs for the new ES2020 WeakRef and
 *     FinalizationRegistry API https://tc39.es/ecma262/#sec-managing-memory
 * @author cpcallen@google.com (Christopher Allen)
 * @externs
 */

// Closure Compiler (as of google-closue-compiler@20210406.0.0) now
// knows about WeakRef, but it doesn't yet know about FinalizationRegistry.

/**
 * @constructor
 * @struct
 * @param {function(HELDVALUE)} cleanupCallback
 * @template TARGET, HELDVALUE, TOKEN
 * @nosideeffects
 */
// TODO(cpcallen): Make TARGET and TOKEN bounded to {!Object} once
// closure-compiler supports bounded generic types.
var FinalizationRegistry = function(cleanupCallback) {};

/**
 * @param {TARGET} target
 * @param {HELDVALUE} heldValue
 * @param {TOKEN=} unregisterToken
 * @return {void}
 */
FinalizationRegistry.prototype.register =
    function(target, heldValue, unregisterToken) {};

/**
 * @param {TOKEN} unregisterToken
 * @return {void}
 */
FinalizationRegistry.prototype.unregister = function(unregisterToken) {};
