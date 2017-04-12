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
 * Messages in the panorama panel.
 */
CCC.World.panoramaMessages = [];

/**
 * Height of history panels.
 * @constant
 */
CCC.World.panelHeight = 256;

/**
 * Width of planned history panels.
 */
CCC.World.panelWidths = [];

/**
 * Div containing a partial row of history panels (null if new row needed).
 * @type Element
 */
CCC.World.historyRow = null;

/**
 * Data from the last room seen (background, users, contents).
 * @type Object
 */
CCC.World.latestRoom = null;

/**
 * PID of rate-limiter for resize events.
 */
CCC.World.resizePid = 0;

/**
 * The last recorded screen width.  Used to determine if a resize event resulted
 * in a change of width.
 */
CCC.World.lastWidth = NaN;

/**
 * Namespace for SVG elements.
 * @constant
 */
CCC.World.NS = 'http://www.w3.org/2000/svg';

/**
 * Scratchpad for rendering potential history panels.  SVG or iframe.
 * @type {Element}
 */
CCC.World.scratchHistory = null;

/**
 * Scratchpad for rendering potential panorama panels.  SVG or iframe.
 * @type {Element}
 */
CCC.World.scratchPanorama = null;

/**
 * Initialization code called on startup.
 */
CCC.World.init = function() {
  CCC.World.scrollDiv = document.getElementById('scrollDiv');
  CCC.World.panoramaDiv = document.getElementById('panoramaDiv');
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
    CCC.World.historyMessages.length = 0;
    CCC.World.panoramaMessages.length = 0;
    CCC.World.renderHistory();
  } else if (mode == 'message') {
    if (text.indexOf('I don\'t understand that.') != -1) {
      // <say user="Max" room="The Hangout">Hello world.</say>
      text = '<iframe src="http://purple.com"></iframe>';
    }
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
 * Render a message to the panorama panel, optionally triggering a history push.
 * @param {string|!Element} msg Message to render.
 */
CCC.World.renderMessage = function(msg) {
  if (!CCC.World.panelWidths.length) {
    CCC.World.panelWidths = CCC.World.rowWidths();
  }

  if (msg.firstChild && msg.firstChild.tagName == 'iframe') {
    // It's an iframe, create the DOM element that will be associated with this
    // message for the rest of its life.
    msg.iframe = document.createElement('iframe');
    msg.iframe.sandbox = 'allow-forms allow-scripts';
    msg.iframe.src = msg.firstChild.getAttribute('src');
    msg.removeChild(msg.firstChild);  // Throw away redundant information.
  }
  var backupScratchHistory = CCC.World.scratchHistory;
  if (CCC.World.prerenderHistory(msg) && CCC.World.prerenderPanorama(msg)) {
    CCC.World.publishPanorama();
    CCC.World.panoramaMessages.push(msg);
  } else {
    // Failure to render.  Revert to previous state.
    CCC.World.scratchHistory = backupScratchHistory;
    // Publish one panel to the history.
    CCC.World.publishHistory();
    // Try again.
    CCC.World.renderMessage(msg);
  }
};

/**
 * Experimentally render a new message onto the most recent history frame.
 * @param {string|!Element} msg Message to render.
 * @return {boolean} True if the message fit.  False if overflow.
 */
CCC.World.prerenderHistory = function(msg) {
  // For now every message needs its own frame.
  if (CCC.World.panoramaMessages.length) {
    return false;
  }
  if (msg.iframe) {
    CCC.World.scratchHistory = msg.iframe;
    return true;
  }
  var svg = CCC.World.createSvg();
  var text = document.createElementNS(CCC.World.NS, 'text');
  text.appendChild(document.createTextNode(msg));
  text.setAttribute('x', 10);
  text.setAttribute('y', 50);
  svg.appendChild(text);
  CCC.World.scratchHistory = svg;
  return true;
};

/**
 * Experimentally render a new message onto the panorama frame.
 * @param {string|!Element} msg Message to render.
 * @return {boolean} True if the message fit.  False if overflow.
 */
CCC.World.prerenderPanorama = function(msg) {
  // For now every message needs its own frame.
  if (CCC.World.panoramaMessages.length) {
    return false;
  }
  if (msg.iframe) {
    CCC.World.scratchPanorama = msg.iframe;
    return true;
  }
  var svg = CCC.World.createSvg();
  var text = document.createElementNS(CCC.World.NS, 'text');
  text.appendChild(document.createTextNode(msg));
  text.setAttribute('x', 20);
  text.setAttribute('y', 70);
  svg.appendChild(text);
  CCC.World.scratchPanorama = svg;
  return true;
};

/**
 * Publish the previously experimentally rendered history frame to the user.
 */
CCC.World.publishHistory = function() {
  if (!CCC.World.historyRow) {
    var rowDiv = document.createElement('div');
    rowDiv.className = 'historyRow';
    CCC.World.scrollDiv.insertBefore(rowDiv, CCC.World.panoramaDiv);
    CCC.World.historyRow = rowDiv;
  }
  var width = CCC.World.panelWidths.shift();
  var panelDiv = document.createElement('div');
  panelDiv.className = 'historyPanel';
  if (Math.random() < 1 / 16) {
    // The occasional panel should lack a border for artistic reasons.
    panelDiv.style.borderColor = '#fff';
  }
  panelDiv.style.height = CCC.World.panelHeight + 'px';
  panelDiv.style.width = width + 'px';
  panelDiv.appendChild(CCC.World.scratchHistory);
  CCC.World.scratchHistory.style.visibility = 'visible';
  CCC.World.scratchHistory = null;
  CCC.World.historyRow.appendChild(panelDiv);
  CCC.World.scrollDiv.scrollTop = CCC.World.scrollDiv.scrollHeight;

  if (!CCC.World.panelWidths.length) {
    CCC.World.historyRow = null;  // Next row.
  }
  // Move all panorama messages into history.
  Array.prototype.push.apply(CCC.World.historyMessages,
                             CCC.World.panoramaMessages);
  CCC.World.panoramaMessages.length = 0;
};

/**
 * Publish the previously experimentally rendered panorama frame to the user.
 */
CCC.World.publishPanorama = function() {
  while (CCC.World.panoramaDiv.firstChild) {
    CCC.World.panoramaDiv.removeChild(CCC.World.panoramaDiv.firstChild);
  }
  CCC.World.panoramaDiv.appendChild(CCC.World.scratchPanorama);
  CCC.World.scratchPanorama.style.visibility = 'visible';
  CCC.World.scratchPanorama = null;
};

/**
 * Create a blank, hidden SVG.
 * @return {!Element} SVG element.
 */
CCC.World.createSvg = function() {
  var svg = document.createElementNS(CCC.World.NS, 'svg');
  svg.style.visibility = 'hidden';
  document.body.appendChild(svg);
  return svg;
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
 * Rerender the history and the panorama panels.
 * Called when the window changes size.
 */
CCC.World.resizeNow = function() {
  var width = CCC.World.scrollDiv.offsetWidth;
  if (width == CCC.World.lastWidth) {
    // Width hasn't changed.  Maybe just the height changed.  Snap to bottom.
    CCC.World.scrollDiv.scrollTop = CCC.World.scrollDiv.scrollHeight;
    return;
  }
  CCC.World.lastWidth = width;
  CCC.World.renderHistory();
};

/**
 * Rerender entire history.
 * Called when the window changes size.
 */
CCC.World.renderHistory = function() {
  // Destroy all existing history.
  var historyRows = document.getElementsByClassName('historyRow');
  while (historyRows[0]) {
    historyRows[0].parentNode.removeChild(historyRows[0]);
  }
  while (CCC.World.panoramaDiv.firstChild) {
    CCC.World.panoramaDiv.removeChild(CCC.World.panoramaDiv.firstChild);
  }
  CCC.World.panelWidths.length = 0;
  CCC.World.historyRow = null;
  CCC.World.scratchHistory = null;
  CCC.World.scratchPanorama = null;
  // Create new history.
  var messages = CCC.World.historyMessages.concat(CCC.World.panoramaMessages);
  CCC.World.historyMessages.length = 0;
  CCC.World.panoramaMessages.length = 0;
  for (var i = 0; i < messages.length; i++) {
    CCC.World.renderMessage(messages[i]);
  }
  CCC.World.scrollDiv.scrollTop = CCC.World.scrollDiv.scrollHeight;
};

/**
 * Given the current window width, assign the number and widths of panels on
 * one history row.
 * @return {!Array.<number>} Array of lengths.
 */
CCC.World.rowWidths = function() {
  var panelBloat = 2 * (5 + 2);  // Margin and border widths must match the CSS.
  var windowWidth = CCC.World.lastWidth - panelBloat - 1;
  var idealWidth = CCC.World.panelHeight * 5 / 4;  // Standard TV ratio.
  var panelCount = Math.round(windowWidth / idealWidth);
  var averageWidth = Math.floor(windowWidth / panelCount);
  averageWidth = Math.max(averageWidth, CCC.World.panelHeight);
  var smallWidth = Math.round(averageWidth * 0.9);
  var largeWidth = averageWidth * 2 - smallWidth;
  averageWidth -= panelBloat;
  smallWidth -= panelBloat;
  largeWidth -= panelBloat;
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
