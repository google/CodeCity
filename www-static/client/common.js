/**
 * @license
 * Code City Client
 *
 * Copyright 2017 Google Inc.
 * https://codecity.world/
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
 * @fileoverview Functions common across frames of Code City's client.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

CCC.Common = {};


/**
 * Initialization code called on startup.
 */
CCC.Common.init = function() {
  CCC.Common.parser = new DOMParser();
  CCC.Common.serializer = new XMLSerializer();

  // Report back to the parent frame that we're fully loaded and ready to go.
  parent.postMessage('init', location.origin);
};

/**
 * Verify that a received message is from our parent frame.
 * @param {!Event} e Incoming message event.
 */
CCC.Common.verifyMessage = function(e) {
  var origin = e.origin || e.originalEvent.origin;
  if (origin != location.origin) {
    console.error('Message received by frame from unknown origin: ' +
                  origin);
    return null;
  }
  return e.data;
};

/**
 * Gets the message with the given key from the document.
 * @param {string} key The key of the document element.
 * @param {...string} var_args Optional substitutions for %1, %2, ...
 * @return {string} The textContent of the specified element.
 */
CCC.Common.getMsg = function(key, var_args) {
  var element = document.getElementById(key);
  if (!element) {
    throw 'Unknown message ' + key;
  }
  var text = element.textContent;
  // Convert newline sequences.
  text = text.replace(/\\n/g, '\n');
  // Inject any substitutions.
  for (var i = 1; i < arguments.length; i++) {
    text = text.replace('%' + i, arguments[i]);
  }
  return text;
};
