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
 * SVG scratchpad for rendering potential history panels.
 * @type {Element}
 */
CCC.World.scratchHistory = null;

/**
 * SVG scratchpad for rendering potential panorama panels.
 * @type {Element}
 */
CCC.World.scratchPanorama = null;

/**
 * Width of a scrollbar.  Computed once at startup.
 */
CCC.World.scrollBarWidth = NaN;

/**
 * Initialization code called on startup.
 */
CCC.World.init = function() {
  CCC.World.scrollDiv = document.getElementById('scrollDiv');
  CCC.World.panoramaDiv = document.getElementById('panoramaDiv');
  CCC.World.parser = new DOMParser();
  CCC.World.scrollBarWidth = CCC.World.getScrollBarWidth();

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
    document.getElementById('iframeStorage').innerHTML = '';
    CCC.World.historyMessages.length = 0;
    CCC.World.panoramaMessages.length = 0;
    CCC.World.removeNode(CCC.World.scratchHistory);
    CCC.World.removeNode(CCC.World.scratchPanorama);
    CCC.World.renderHistory();
  } else if (mode == 'message') {
    var dom = CCC.World.parser.parseFromString(text, 'text/xml');
    if (dom.getElementsByTagName('parsererror').length) {
      // Not valid XML, treat as string literal.
      CCC.World.renderMessage(text);
    } else {
      if (dom.firstChild && dom.firstChild.tagName == 'iframe') {
        // It's an iframe, create the DOM element.
        dom.iframe = CCC.World.createIframe(dom);
      }
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

  var backupScratchHistory = CCC.World.scratchHistory;
  if (CCC.World.prerenderHistory(msg) && CCC.World.prerenderPanorama(msg)) {
    // Rendering successful in both panorama and pending history panel.
    CCC.World.publishPanorama();
    CCC.World.panoramaMessages.push(msg);
    CCC.World.removeNode(backupScratchHistory);
  } else {
    // Failure to render.  Revert to previous state.
    CCC.World.removeNode(CCC.World.scratchHistory);
    CCC.World.removeNode(CCC.World.scratchPanorama);
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
  var svg = CCC.World.createSvg();
  svg.msgs = [msg];
  if (msg.iframe !== undefined) {
    // Create relaunch button if iframe is closed.
    var midWidth = CCC.World.panelWidths[0] / 2;
    var midHeight = CCC.World.panelHeight / 2;
    svg.style.backgroundColor = '#696969';
    var g = document.createElementNS(CCC.World.NS, 'g');
    g.setAttribute('class', 'iframeRelaunch');
    g.setAttribute('transform',
                   'translate(' + midWidth + ', ' + midHeight + ')');
    var rect = document.createElementNS(CCC.World.NS, 'rect');
    rect.setAttribute('height', '2em');
    rect.setAttribute('width', '200');
    rect.setAttribute('x', '-100');
    rect.setAttribute('y', '-1.4em');
    rect.setAttribute('rx', 15);
    rect.setAttribute('ry', 15);
    var text = document.createElementNS(CCC.World.NS, 'text');
    text.appendChild(document.createTextNode(
        CCC.World.getMsg('relaunchIframeMsg')));
    g.appendChild(rect);
    g.appendChild(text);
    g.addEventListener('click', function() {
      msg.iframe = CCC.World.createIframe(msg);
      var div = svg.parentNode;
      CCC.World.positionIframe(msg.iframe, div);
      div.firstChild.style.visibility = 'hidden';  // SVG.
      div.lastChild.style.display = 'inline';  // Close button.
    }, false);
    svg.appendChild(g);
    CCC.World.scratchHistory = svg;
    return true;
  }
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
  var svg = CCC.World.createSvg();
  svg.msgs = [msg];
  if (msg.iframe !== undefined) {
    CCC.World.scratchPanorama = svg;
    return true;
  }
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
  panelDiv.style.height = CCC.World.panelHeight + 'px';
  panelDiv.style.width = width + 'px';
  CCC.World.historyRow.appendChild(panelDiv);
  panelDiv.appendChild(CCC.World.scratchHistory);
  var isIframeVisible = false;
  var msgs = CCC.World.scratchHistory.msgs;
  if (msgs.length == 1 && msgs[0].iframe !== undefined) {
    var msg = msgs[0];
    if (msg.iframe) {
      isIframeVisible = true;
      CCC.World.positionIframe(msg.iframe, panelDiv);
      var closeImg = new Image(21, 21);
      closeImg.className = 'iframeClose';
      closeImg.src = 'close.png';
      closeImg.title = CCC.World.getMsg('closeIframeMsg');
      closeImg.addEventListener('click', function() {
        closeImg.style.display = 'none';
        panelDiv.firstChild.style.visibility = 'visible';  // SVG.
        CCC.World.removeNode(msg.iframe);
        msg.iframe = null;
      }, false);
      panelDiv.appendChild(closeImg);
    }
  } else if (Math.random() < 1 / 16) {
    // The occasional (non-iframe) panel should lack a border.
    panelDiv.style.borderColor = '#fff';
  }
  // While being built, the SVG was hidden.
  // Make it visible, unless there is an iframe displayed on top of it.
  if (!isIframeVisible) {
    CCC.World.scratchHistory.style.visibility = 'visible';
  }
  CCC.World.scratchHistory = null;
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
  // Destroy any existing content.
  while (CCC.World.panoramaDiv.firstChild) {
    CCC.World.panoramaDiv.removeChild(CCC.World.panoramaDiv.firstChild);
  }
  // Insert new content.
  CCC.World.panoramaDiv.appendChild(CCC.World.scratchPanorama);
  var msgs = CCC.World.scratchPanorama.msgs;
  if (msgs.length == 1 && msgs[0].iframe !== undefined) {
    var iframe = msgs[0].iframe;
    if (iframe) {
      CCC.World.positionIframe(iframe, CCC.World.panoramaDiv);
    }
  }
  CCC.World.scratchPanorama.style.visibility = 'visible';
  CCC.World.scratchPanorama = null;
};

/**
 * Absolutely position an iframe so that it fits exactly inside a comic panel.
 * @param {!Element} iframe DOM node for iframe.
 * @param {!Element} container DOM node for panel.
 */
CCC.World.positionIframe = function (iframe, container) {
  var borderWidth = 2;
  iframe.style.width = (container.offsetWidth - borderWidth * 2) + 'px';
  iframe.style.height = (container.offsetHeight - borderWidth * 2) + 'px';
  var x = 0;
  var y = 0;
  do {
    x += container.offsetLeft;
    y += container.offsetTop;
  } while ((container = container.offsetParent) &&
           (container != CCC.World.scrollDiv));
  iframe.style.top = (y + borderWidth) + 'px';
  iframe.style.left = (x + borderWidth) + 'px';
};

/**
 * Create a blank, hidden SVG.
 * @return {!Element} SVG element.
 */
CCC.World.createSvg = function() {
  var svg = document.createElementNS(CCC.World.NS, 'svg');
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.style.visibility = 'hidden';
  document.body.appendChild(svg);
  return svg;
};

/**
 * Instantiate an iframe based on a message.
 * @param {string|!Element} msg Message describing an iframe.
 * @return {!Object} The iframe's DOM.
 */
CCC.World.createIframe = function(msg) {
  var iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-forms allow-scripts';
  iframe.src = msg.firstChild.getAttribute('src');
  document.getElementById('iframeStorage').appendChild(iframe);
  return iframe;
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
    CCC.World.removeNode(historyRows[0]);
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
  var windowWidth = CCC.World.lastWidth - CCC.World.scrollBarWidth - 1;
  var idealWidth = CCC.World.panelHeight * 5 / 4;  // Standard TV ratio.
  var panelCount = Math.round(windowWidth / idealWidth);
  var averageWidth = Math.floor(windowWidth / panelCount);
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

/**
 * Gets the message with the given key from the document.
 * @param {string} key The key of the document element.
 * @return {string} The textContent of the specified element.
 */
CCC.World.getMsg = function(key) {
  var element = document.getElementById(key);
  if (!element) {
    throw 'Unknown message ' + key;
  }
  var text = element.textContent;
  // Convert newline sequences.
  text = text.replace(/\\n/g, '\n');
  return text;
};

/**
 * Remove a node from the DOM.
 * @param {Node} node Node to remove, ok if null.
 */
CCC.World.removeNode = function(node) {
  if (node) {
    node.parentNode.removeChild(node);
  }
};

/**
 * Determine the width of scrollbars on this platform.
 * Code copied from https://stackoverflow.com/questions/8079187/
 * @return {number} Width in pixels.
 */
CCC.World.getScrollBarWidth = function() {
  var inner = document.createElement('p');
  inner.style.width = '100%';
  inner.style.height = '200px';

  var outer = document.createElement('div');
  outer.style.position = 'absolute';
  outer.style.top = 0;
  outer.style.left = 0;
  outer.style.visibility = 'hidden';
  outer.style.width = '200px';
  outer.style.height = '150px';
  outer.style.overflow = 'hidden';
  outer.appendChild(inner);

  document.body.appendChild(outer);
  var w1 = inner.offsetWidth;
  outer.style.overflow = 'scroll';
  var w2 = inner.offsetWidth;
  if (w1 == w2) {
    w2 = outer.clientWidth;
  }
  document.body.removeChild(outer);

  return w1 - w2;
};

window.addEventListener('message', CCC.World.receiveMessage, false);
window.addEventListener('load', CCC.World.init, false);
