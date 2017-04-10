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
 * @fileoverview World frame of Code City's client.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var CCC = {};
CCC.World = {};

/**
 * Maximum number of messages saved in history.
 */
CCC.World.maxHistorySize = 10000;

/**
 * Messages in the history panels.
 */
CCC.World.historyMessages = [];

/**
 * Messages in the current panel.
 */
CCC.World.currentMessages = [];

/**
 * Height of history panels.
 * @constant
 */
CCC.World.panelHeight = 256;

/**
 * PID of rate-limiter for resize events.
 */
CCC.World.resizePid = 0;

/**
 * Calculated width of history panels.  Used to set width of current panel.
 */
CCC.World.width = NaN;

/**
 * Initialization code called on startup.
 */
CCC.World.init = function() {
  CCC.World.historyDiv = document.getElementById('historyDiv');
  CCC.World.currentDiv = document.getElementById('currentDiv');
  CCC.World.parser = new DOMParser();

  window.addEventListener('resize', CCC.World.resizeSoon, false);

  // Report back to the parent frame that we're fully loaded and ready to go.
  parent.postMessage('initWorld', location.origin);
};

/**
 * Receive messages from our parent frame.
 * @param {!Event} e Incoming message event.
 */
CCC.World.receiveMessage = function(e) {
  var origin = e.origin || e.originalEvent.origin;
  if (origin != location.origin) {
    console.error('Message received by world frame from unknown origin: ' +
                  origin);
    return;
  }
  var mode = e.data['mode'];
  var text = e.data['text'];
  if (mode == 'clear') {
    // TODO: Clear history.
  } else if (mode == 'message') {
    var dom = CCC.World.parser.parseFromString(text, 'text/xml');
    if (dom.getElementsByTagName('parsererror').length) {
      // Not valid XML, treat as string literal.
      CCC.World.renderMessage(text);
    } else {
      CCC.World.renderMessage(dom);
    }
  }
};

/**
 * Render a message to the current frame, optionally triggering a history push.
 * @param {string|!Element} msg Message to render.
 */
CCC.World.renderMessage = function(msg) {
  if (CCC.World.prerenderHistory(msg) && CCC.World.prerenderCurrent(msg)) {
    CCC.World.publishCurrent();
  } else {
    CCC.World.rollbackHistory();
    CCC.World.publishHistory();
    CCC.World.newHistory();
    CCC.World.newCurrent();
    CCC.World.renderMessage(msg);
  }
};

/**
 * Experimentally render a new message onto the most recent history frame.
 * @param {string|!Element} msg Message to render.
 * @return {boolean} True if the message fit.  False if overflow.
 */
CCC.World.prerenderHistory = function(msg) {
  return true;
};

/**
 * Experimentally render a new message onto the current frame.
 * @param {string|!Element} msg Message to render.
 * @return {boolean} True if the message fit.  False if overflow.
 */
CCC.World.prerenderCurrent = function(msg) {
  return true;
};

/**
 * Publish the previously experimentally rendered history frame to the user.
 */
CCC.World.publishHistory = function() {
};

/**
 * Publish the previously experimentally rendered current frame to the user.
 */
CCC.World.publishCurrent = function() {
};

/**
 * Throw out the experimentally rendered history frame and restore from backup.
 */
CCC.World.rollbackHistory = function() {
};

/**
 * Create a blank history frame.
 */
CCC.World.newHistory = function() {
};

/**
 * Create a blank current frame.
 */
CCC.World.newCurrent = function() {
};

/**
 * Buffer temporally close resize events.
 * Called when the window changes size.
 */
CCC.World.resizeSoon = function() {
  // First resize should call function immediately,
  // subsequent ones should throttle resizing reflows.
  if (CCC.World.resizePid) {
    clearTimeout(CCC.World.resizePid);
    CCC.World.resizePid = setTimeout(CCC.World.resizeNow, 1000);
  } else {
    CCC.World.resizeNow();
    CCC.World.resizePid = -1;
  }
};

/**
 * Rerender the history and the current panels.
 * Called when the window changes size.
 */
CCC.World.resizeNow = function() {
  CCC.World.renderHistory();
  CCC.World.renderCurrent();
};

/**
 * Rerender current panel.
 * Called when the window changes size.
 */
CCC.World.renderCurrent = function() {
  var panelBloat = 2 * (5 + 2);  // Margin and border widths must match the CSS.
  CCC.World.currentDiv.style.width = (CCC.World.width - panelBloat) + 'px';
};

/**
 * Rerender entire history.
 * Called when the window changes size.
 */
CCC.World.renderHistory = function() {
  var panelBloat = 2 * (5 + 2);  // Margin and border widths must match the CSS.
  CCC.World.historyDiv.innerHTML = '';
  for (var y = 0; y < 3; y++) {
    var rowWidths = CCC.World.rowWidths();
    var rowDiv = document.createElement('div');
    rowDiv.className = 'historyRow';
    for (var x = 0; x < rowWidths.length; x++) {
      var panelDiv = document.createElement('div');
      panelDiv.className = 'historyPanel';
      panelDiv.style.height = (CCC.World.panelHeight) + 'px';
      panelDiv.style.width = (rowWidths[x] - panelBloat) + 'px';
      rowDiv.appendChild(panelDiv);
    }
    CCC.World.historyDiv.appendChild(rowDiv);
  }
};

/**
 * Given the current window width, assign the number and widths of panels on
 * one history row.
 * @return {!Array.<number>} Array of lengths.
 */
CCC.World.rowWidths = function() {
  var windowWidth = CCC.World.historyDiv.offsetWidth;
  var idealWidth = CCC.World.panelHeight * 5 / 4;  // Standard TV ratio.
  var panelCount = Math.round(windowWidth / idealWidth);
  var averageWidth = Math.floor(windowWidth / panelCount);
  averageWidth = Math.max(averageWidth, CCC.World.panelHeight);
  CCC.World.width = averageWidth * panelCount;
  var smallWidth = Math.round(averageWidth * 0.9);
  var largeWidth = averageWidth * 2 - smallWidth;
  // Build an array of lengths.  Add in matching pairs.
  var panels = [];
  for (var i = 0; i < Math.floor(panelCount / 2); i++) {
    if (Math.random() > 0.5) {
      panels.push(averageWidth, averageWidth);
    } else {
      panels.push(smallWidth, largeWidth);
    }
  }
  // Odd number of panels has one in the middle.
  if (panels.length < panelCount) {
    panels.push(averageWidth);
  }
  // Shuffle the array.
  for (var i = panels.length; i; i--) {
    var j = Math.floor(Math.random() * i);
    var temp = panels[i - 1];
    panels[i - 1] = panels[j];
    panels[j] = temp;
  }
  return panels;
};


window.addEventListener('message', CCC.World.receiveMessage, false);
window.addEventListener('load', CCC.World.init, false);
