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

/**
 * Show the save dialog.
 */
Code.Editor.showSave = function() {
  document.getElementById('editorConfirm').style.display = 'block';
  var mask = document.getElementById('editorConfirmMask');
  var box = document.getElementById('editorConfirmBox');
  mask.style.transitionDuration = '.4s';
  box.style.transitionDuration = '.4s';
  // Add a little bounce at the end of the animation.
  box.style.transitionTimingFunction = 'cubic-bezier(.6,1.36,.75,1)';
  setTimeout(function() {
    mask.style.opacity = 0.2;
    box.style.top = '-10px';
  }, 100);  // Firefox requires at least 10ms to process this timing function.
};

/**
 * Hide the save dialog.
 */
Code.Editor.hideSave = function() {
  var mask = document.getElementById('editorConfirmMask');
  var box = document.getElementById('editorConfirmBox');
  mask.style.transitionDuration = '.2s';
  box.style.transitionDuration = '.2s';
  box.style.transitionTimingFunction = 'ease-in';
  mask.style.opacity = 0;
  box.style.top = '-120px';
  setTimeout(function() {
    document.getElementById('editorConfirm').style.display = 'none';
  }, 250);
};

/**
 * Show the text in the butter bar for a period of time.
 * Clobber any existing display.
 * @param {string} text Text to display.
 * @param {number} time Number of milliseconds to display butter.
 */
Code.Editor.showButter = function(text, time) {
  clearTimeout(Code.Editor.showButter.pid_);
  var textDiv = document.getElementById('editorButterText');
  textDiv.innerHTML = '';
  textDiv.appendChild(document.createTextNode(text));
  document.getElementById('editorButter').style.display = 'block';
  Code.Editor.showButter.pid_ = setTimeout(Code.Editor.hideButter, time);
};

Code.Editor.showButter.pid_ = 0;

/**
 * Hide the butter bar.
 */
Code.Editor.hideButter = function() {
  document.getElementById('editorButter').style.display = 'none';
};

window.addEventListener('load', Code.Editor.init);
window.addEventListener('message', Code.Editor.receiveMessage, false);
