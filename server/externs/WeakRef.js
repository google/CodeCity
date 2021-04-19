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
 * @fileoverview Closure Compiler externs for the new tc39 WeakRef and
 *     FinalizationGroup API https://github.com/tc39/proposal-weakrefs
 * @author cpcallen@google.com (Christopher Allen)
 * @externs
 */

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
