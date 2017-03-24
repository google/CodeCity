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
 * @fileoverview Code City's client.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var CCC = {};
/**
 * Number of calls to countdown required before launching.
 * @private
 */
CCC.countdown_ = 2;

/**
 * After every iframe has reported ready, call the initialization.
 */
CCC.countdown = function() {
  CCC.countdown_--;
  if (CCC.countdown_ == 0) {
    CCC.init();
  }
};

/**
 * Initialization code called on startup.
 */
CCC.init = function() {
  CCC.comicFrame = document.getElementById('comicFrame');
  CCC.logFrame = document.getElementById('logFrame');
  CCC.displayCell = document.getElementById('displayCell');

  window.addEventListener('resize', CCC.resize, false);
  CCC.resize();

  var commandInput = document.getElementById('commandInput');
  commandInput.focus();
  var comicButton = document.getElementById('comicButton');
  comicButton.addEventListener('click', CCC.tab.bind(null, 'comic'), false);
  var logButton = document.getElementById('logButton');
  logButton.addEventListener('click', CCC.tab.bind(null, 'log'), false);
  CCC.tab('comic');
};

/**
 * Switch between comic and log views.
 * @param {string} mode Either 'comic' or 'log'.
 */
CCC.tab = function(mode) {
  if (mode == 'comic') {
    CCC.comicFrame.style.zIndex = 1;
    CCC.logFrame.style.zIndex = -1;
  } else {
    CCC.logFrame.style.zIndex = 1;
    CCC.comicFrame.style.zIndex = -1;
  }
};

/**
 * Reposition the iframes over the placeholder displayCell.
 * Called when the window changes size.
 */
CCC.resize = function() {
  // Compute the absolute coordinates and dimensions of displayCell.
  var element = CCC.displayCell;
  var x = 0;
  var y = 0;
  do {
    x += element.offsetLeft;
    y += element.offsetTop;
    element = element.offsetParent;
  } while (element);
  // Position both iframes over displayCell.
  CCC.comicFrame.style.left = x + 'px';
  CCC.comicFrame.style.top = y + 'px';
  CCC.comicFrame.style.width = CCC.displayCell.offsetWidth + 'px';
  CCC.comicFrame.style.height = CCC.displayCell.offsetHeight + 'px';
  CCC.logFrame.style.left = x + 'px';
  CCC.logFrame.style.top = y + 'px';
  CCC.logFrame.style.width = CCC.displayCell.offsetWidth + 'px';
  CCC.logFrame.style.height = CCC.displayCell.offsetHeight + 'px';
};

/**
 * Receive messages from our child frames.
 * @param {!Event} e Incoming message event.
 */
CCC.receiveMessage = function(e) {
  var origin = e.origin || e.originalEvent.origin;
  if (origin != location.origin) {
    console.error('Message received by client frame from unknown origin: ' +
                  origin);
    return;
  }
  if (e.data == 'initLog') {
    CCC.countdown();
  } else {
    console.log('Unknown message received by client frame: ' + e.data);
  }
}

window.addEventListener('message', CCC.receiveMessage, false);
window.addEventListener('load', CCC.countdown, false);
