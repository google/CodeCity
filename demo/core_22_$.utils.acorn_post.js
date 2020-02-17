/**
 * @license
 * Copyright 2017 Google LLC
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
 * @fileoverview Code to clean up after setting up $.utils.acorn
 * @author cpcallen@google.com (Christopher Allen)
 */

// TODO: remove exports and module from global scope when this becomes
// possible.
var exports = undefined;
var module = undefined;

$.utils.acorn.defaultOptions.ecmaVersion = 5;
