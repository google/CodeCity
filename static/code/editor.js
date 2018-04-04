/**
 * @license
 * Code City: Code Editor.
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
 * @fileoverview Integrated Development Environment for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

Code.Editor = {};

/**
 * Got a ping from someone.  Something might have changed and need updating.
 */
Code.Editor.receiveMessage = function() {
  var selector = sessionStorage.getItem(Code.Common.SELECTOR);
};

/**
 * Page has loaded, initialize the editor.
 */
Code.Editor.init = function() {
  Code.Editor.receiveMessage();
};

window.addEventListener('load', Code.Editor.init);
window.addEventListener('message', Code.Editor.receiveMessage, false);
