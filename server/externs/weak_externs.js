/**
 * @license
 * Code City: Closure Compiler externs for node.js
 *
 * Copyright 2018 Google Inc.
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
 * @fileoverview Closure Compiler externs for the weak npm module.
 * @author cpcallen@google.com (Christopher Allen)
 * @externs
 */

// Closure Compiler can find and understand the weak npm, but the code
// in weak.js uses some names that are provided by C++ code which of
// course isn't understood.  Define them here.

/** @type {!Function} */
var addCallback;

/** @type {!Function} */
var callbacks;

/** @type {!Function} */
var removeCallback;

/** @type {!Function} */
var removeCallbacks;
