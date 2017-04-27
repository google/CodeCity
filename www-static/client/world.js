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
 * Width of panel borders (must match CSS).
 * @constant
 */
CCC.World.panelBorder = 2;

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
 * Record of the current scene.
 * @type {Element}
 */
CCC.World.scene = null;

/**
 * Initialization code called on startup.
 */
CCC.World.init = function() {
  CCC.World.scrollDiv = document.getElementById('scrollDiv');
  CCC.World.panoramaDiv = document.getElementById('panoramaDiv');
  CCC.World.parser = new DOMParser();
  CCC.World.scrollBarWidth = CCC.World.getScrollBarWidth();
  delete CCC.World.getScrollBarWidth;  // Free memory.

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
    var scene = CCC.World.scene;  // Save the scene.
    CCC.World.renderHistory();
    CCC.World.scene = scene;  // Restore the scene.
  } else if (mode == 'message') {
    var dom = CCC.World.parser.parseFromString(text, 'text/xml');
    if (dom.getElementsByTagName('parsererror').length) {
      // Not valid XML, treat as string literal.
      CCC.World.renderMessage(text);
    } else {
      CCC.World.preprocessXml(dom);
      for (var i = 0, msg; msg = dom.childNodes[i]; i++) {
        CCC.World.renderMessage(msg);
      }
    }
  }
};

/**
 * Parse the XML and deal with any chunks that need one-time processing.
 * Record the latest scene data to CCC.World.scene.
 * @param {!Element} dom XML tree.
 */
CCC.World.preprocessXml = function(dom) {
  // Find all stringified SVG nodes and replace them with actual SVG nodes.
  var svgTextNodes = dom.getElementsByTagName('svgtext');
  for (var i = svgTextNodes.length - 1; i >= 0; i--) {
    var svgTextNode = svgTextNodes[i];
    var svgNode = CCC.World.stringToSvg(svgTextNode.textContent);
    if (svgNode) {
      var container = document.createElement('svgdom');
      container.appendChild(svgNode);
      svgTextNode.parentNode.replaceChild(container, svgTextNode);
    } else {  // Syntax error in SVG.
      svgTextNode.parentNode.removeChild(svgTextNode);
    }
  }

  // Find all stringified HTML nodes and replace them with actual HTML nodes.
  var htmlTextNodes = dom.getElementsByTagName('htmltext');
  for (var i = htmlTextNodes.length - 1; i >= 0; i--) {
    var htmlTextNode = htmlTextNodes[i];
    var htmlNode = CCC.World.stringToHtml(htmlTextNode.textContent);
    if (htmlNode) {
      var container = document.createElement('htmldom');
      container.appendChild(htmlNode);
      htmlTextNode.parentNode.replaceChild(container, htmlTextNode);
    } else {  // Syntax error in HTML.
      htmlTextNode.parentNode.removeChild(htmlTextNode);
    }
  }

  // Find top-level nodes that need processing.
  for (var i = 0, msg; msg = dom.childNodes[i]; i++) {
    if (msg.tagName == 'iframe') {
      // <iframe src="https://neil.fraser.name/">Neil Fraser</iframe>
      // It's an iframe, create the DOM element.
      msg.iframe = CCC.World.createIframe(msg);
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
    CCC.World.panoramaMessages.push(msg);
    CCC.World.publishPanorama();
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
  var svg =
      CCC.World.createHiddenSvg(CCC.World.panelWidths[0], CCC.World.panelHeight);
  if (msg.tagName == 'iframe') {
    // Create relaunch button if iframe is closed.
    svg.style.backgroundColor = '#696969';
    var g = document.createElementNS(CCC.World.NS, 'g');
    g.setAttribute('class', 'iframeRelaunch');
    g.setAttribute('transform', 'translate(0, 50)');
    // Add relaunch button.
    var rect = document.createElementNS(CCC.World.NS, 'rect');
    var text = document.createElementNS(CCC.World.NS, 'text');
    text.appendChild(document.createTextNode(CCC.getMsg('relaunchIframeMsg')));
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
    // Size the rectangle to match the text size.
    var bBox = text.getBBox();
    var r = Math.min(bBox.height, bBox.width) / 2;
    rect.setAttribute('height', bBox.height);
    rect.setAttribute('width', bBox.width + 2 * r);
    rect.setAttribute('x', bBox.x - r);
    rect.setAttribute('y', bBox.y);
    rect.setAttribute('rx', r);
    rect.setAttribute('ry', r);
    CCC.World.scratchHistory = svg;
    return true;
  }

  if (msg.tagName == 'htmldom') {
    var div = CCC.World.createHiddenDiv();
    CCC.World.cloneAndAppend(div, msg.firstChild);
    CCC.World.scratchHistory = div;
    return true;
  }

  if (msg.tagName == 'scene') {
    // <scene user="Max" location="The Hangout">
    //   <description>The lights are dim and blah blah blah...</description>
    //   <svgdom>...</svgdom>
    //   <object name="a clock">
    //     <svgdom>...</svgdom>
    //   </object>
    //   <user name="Max">
    //     <svgdom>...</svgdom>
    //   </user>
    // </scene>
    if (msg.getAttribute('user')) {
      // This is the user's current location.  Save this environment data.
      CCC.World.scene = msg;
    }
  }

  // Add scene background.
  if (CCC.World.scene) {
    var svgdom = CCC.World.scene.querySelector('scene>svgdom');
    if (svgdom) {
      CCC.World.cloneAndAppend(svg, svgdom.firstChild);
    }
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
  var svg = CCC.World.createHiddenSvg(CCC.World.panoramaDiv.offsetWidth,
                                      CCC.World.panoramaDiv.offsetHeight);
  if (msg.tagName == 'iframe') {
    CCC.World.scratchPanorama = svg;
    return true;
  }
  if (msg.tagName == 'htmldom') {
    var div = CCC.World.createHiddenDiv();
    CCC.World.cloneAndAppend(div, msg.firstChild);
    CCC.World.scratchPanorama = div;
    return true;
  }

  // Add scene background.
  if (CCC.World.scene) {
    var svgdom = CCC.World.scene.querySelector('scene>svgdom');
    if (svgdom) {
      CCC.World.cloneAndAppend(svg, svgdom.firstChild);
    }
  }
  if (typeof msg == 'string') {  // Flat text.
    var textgroup = CCC.World.createTextArea(svg, 150, 100, msg);
    textgroup.setAttribute('transform', 'translate(-75, 0)');
    svg.appendChild(textgroup);
  }
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
  var msgs = CCC.World.panoramaMessages;
  if (msgs.length == 1) {
    var msg = msgs[0];
    if (msg.iframe) {
      isIframeVisible = true;
      CCC.World.positionIframe(msg.iframe, panelDiv);
      var closeImg = new Image(21, 21);
      closeImg.className = 'iframeClose';
      closeImg.src = 'close.png';
      closeImg.title = CCC.getMsg('closeIframeMsg');
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
  var msgs = CCC.World.panoramaMessages;
  if (msgs.length == 1) {
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
 * @param {number} width Width of panel in pixels.
 * @param {number} height Height of panel in pixels.
 * @return {!SVGElement} SVG element.
 */
CCC.World.createHiddenSvg = function(width, height) {
  var svg = document.createElementNS(CCC.World.NS, 'svg');
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.style.visibility = 'hidden';
  document.body.appendChild(svg);
  // Compute the scaled height and width and save on private properties.
  width -= CCC.World.panelBorder * 2;
  height -= CCC.World.panelBorder * 2;
  svg.scaledHeight_ = 100;
  svg.scaledWidth_ = width / height * svg.scaledHeight_;
  svg.setAttribute('viewBox',
      [-svg.scaledWidth_ / 2, 0, svg.scaledWidth_, svg.scaledHeight_].join(' '));
  return svg;
};

/**
 * Create a blank, hidden div.
 * @return {!Element} Div element.
 */
CCC.World.createHiddenDiv = function() {
  var div = document.createElement('div');
  div.className = 'htmlpanel';
  div.style.visibility = 'hidden';
  document.body.appendChild(div);
  return div;
};

/**
 * Instantiate an iframe based on a message.
 * @param {string|!Element} msg Message describing an iframe.
 * @return {!Object} The iframe's DOM.
 */
CCC.World.createIframe = function(msg) {
  var iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-forms allow-scripts';
  iframe.src = msg.getAttribute('src');
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
  CCC.World.scene = null;
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
  // Margin and border widths must match the CSS.
  var panelBloat = 2 * (5 + CCC.World.panelBorder);
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
 * Unserialize stringified HTML.  Wrap the HTML elements in a body.
 * @param {string} svgText '<p>Hello</p>'
 * @return {Element} <body><p>Hello</p></body>
 */
CCC.World.stringToHtml = function(htmlText) {
  var dom = CCC.World.parser.parseFromString(htmlText, 'text/html');
  if (!dom.body) {
    // Not valid XML.
    console.log('Syntax error in HTML: ' + htmlText);
    return null;
  }
  return CCC.World.xmlToHtml(dom.body);
};

/**
 * Convert an XML tree into an HTML tree.
 * Whitelist used for all elements and properties.
 * @param {!Element} dom XML tree.
 * @return {Element} HTML tree.
 */
CCC.World.xmlToHtml = function(dom) {
  if (!dom) {
    return null;
  }
  switch (dom.nodeType) {
    case 1:  // Element node.
      if (dom.tagName == 'svg') {
        // Switch to SVG rendering mode.
        return CCC.World.xmlToSvg(dom);
      }
      if (CCC.World.xmlToHtml.ELEMENT_NAMES.indexOf(dom.tagName) == -1) {
        console.log('HTML element not in whitelist: <' + dom.tagName + '>');
        return null;
      }
      var element = document.createElement(dom.tagName);
      for (var i = 0, attr; attr = dom.attributes[i]; i++) {
        if (CCC.World.xmlToHtml.ATTRIBUTE_NAMES.indexOf(attr.name) == -1) {
          console.log('HTML attribute not in whitelist: ' +
              '<' + dom.tagName + ' ' + attr.name + '="' + attr.value + '">');
        } else {
          element.setAttribute(attr.name, attr.value);
          // Remove all styles not in the whitelist.
          if (attr.name == 'style') {
            for (var name in element.style) {
              if (element.style.hasOwnProperty(name) &&
                  isNaN(parseFloat(name)) && // Don't delete indexed props.
                  element.style[name] && element.style[name] != 'initial' &&
                  CCC.World.xmlToHtml.STYLE_NAMES.indexOf(name) == -1) {
                console.log('Style attribute not in whitelist: ' +
                    name + ': ' + element.style[name]);
                element.style[name] = '';
              }
            }
          }
        }
      }
      for (var i = 0, childDom; childDom = dom.childNodes[i]; i++) {
        var childNode = CCC.World.xmlToHtml(childDom);
        if (childNode) {
          element.appendChild(childNode);
        }
      }
      return element;
    case 3:  // Text node.
      return document.createTextNode(dom.data);
    case 8:  // Comment node.
      return null;
  }
  console.log('Unknown HTML node type: ' + dom);
  return null;
};

/**
 * Whitelist of all allowed HTML element names.
 * 'svg' element is handled separately.
 */
CCC.World.xmlToHtml.ELEMENT_NAMES = [
  'ABBR',
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'B',
  'BDI',
  'BDO',
  'BODY',
  'BR',
  'CAPTION',
  'CITE',
  'CODE',
  'COL',
  'COLGROUP',
  'DATA',
  'DD',
  'DEL',
  'DFN',
  'DIV',
  'DL',
  'DT',
  'EM',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HEADER',
  'HGROUP',
  'HR',
  'I',
  'INS',
  'KBD',
  'LEGEND',
  'LI',
  'MAIN',
  'MARK',
  'NAV',
  'OL',
  'P',
  'PRE',
  'Q',
  'RP',
  'RT',
  'RTC',
  'RUBY',
  'S',
  'SAMP',
  'SECTION',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TIME',
  'TR',
  'U',
  'UL',
  'VAR',
  'WBR',
];

/**
 * Whitelist of all allowed HTML property names.
 * This architecture assumes that there are no banned properties
 * on one element type which are allowed on another.
 */
CCC.World.xmlToHtml.ATTRIBUTE_NAMES = [
  'cite',
  'colspan',
  'datetime',
  'dir',
  'headers',
  'nowrap',
  'reversed',
  'rowspan',
  'scope',
  'span',
  'start',
  'style',
  'title',
  'type',
  'value',
];

/**
 * Whitelist of all allowed style property names.
 */
CCC.World.xmlToHtml.STYLE_NAMES = [
  'border',
  'borderBottom',
  'borderBottomColor',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderBottomStyle',
  'borderBottomWidth',
  'borderCollapse',
  'borderColor',
  'borderLeft',
  'borderLeftColor',
  'borderLeftStyle',
  'borderLeftWidth',
  'borderRadius',
  'borderRight',
  'borderRightColor',
  'borderRightStyle',
  'borderRightWidth',
  'borderSpacing',
  'borderStyle',
  'borderTop',
  'borderTopColor',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderTopStyle',
  'borderTopWidth',
  'borderWidth',
  'clear',
  'direction',
  'display',
  'float',
  'fontWeight',
  'height',
  'hyphens',
  'padding',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'textAalign',
  'verticalAlign',
  'width',
];

/**
 * Unserialize stringified SVG.  Wrap the SVG elements in an SVG.
 * @param {string} svgText '<rect /><circle r="5" />'
 * @return {SVGSVGElement} <svg><rect /><circle r="5" /></svg>
 */
CCC.World.stringToSvg = function(svgText) {
  var dom = CCC.World.parser.parseFromString(
      '<svg>' + svgText + '</svg>', 'image/svg+xml');
  if (dom.getElementsByTagName('parsererror').length) {
    // Not valid XML.
    console.log('Syntax error in SVG: ' + svgText);
    return null;
  }
  return CCC.World.xmlToSvg(dom.firstChild);
};

/**
 * Convert an XML tree into an SVG tree.
 * Whitelist used for all elements and properties.
 * @param {!Element} dom XML tree.
 * @return {SVGElement} SVG tree.
 */
CCC.World.xmlToSvg = function(dom) {
  if (!dom) {
    return null;
  }
  switch (dom.nodeType) {
    case 1:  // Element node.
      if (CCC.World.xmlToSvg.ELEMENT_NAMES.indexOf(dom.tagName) == -1) {
        console.log('SVG element not in whitelist: <' + dom.tagName + '>');
        return null;
      }
      var svg = document.createElementNS(CCC.World.NS, dom.tagName);
      for (var i = 0, attr; attr = dom.attributes[i]; i++) {
        if (CCC.World.xmlToSvg.ATTRIBUTE_NAMES.indexOf(attr.name) == -1) {
          console.log('SVG attribute not in whitelist: ' +
              '<' + dom.tagName + ' ' + attr.name + '="' + attr.value + '">');
        } else {
          svg.setAttribute(attr.name, attr.value);
        }
      }
      for (var i = 0, childDom; childDom = dom.childNodes[i]; i++) {
        var childSvg = CCC.World.xmlToSvg(childDom);
        if (childSvg) {
          svg.appendChild(childSvg);
        }
      }
      return svg;
    case 3:  // Text node.
      return document.createTextNode(dom.data);
    case 8:  // Comment node.
      return null;
  }
  console.log('Unknown XML node type: ' + dom);
  return null;
};

/**
 * Whitelist of all allowed SVG element names.
 */
CCC.World.xmlToSvg.ELEMENT_NAMES = [
  'circle',
  'desc',
  'ellipse',
  'g',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
  'svg',
  'text',
  'title',
  'tspan',
];

/**
 * Whitelist of all allowed SVG property names.
 * This architecture assumes that there are no banned properties
 * on one element type which are allowed on another.
 */
CCC.World.xmlToSvg.ATTRIBUTE_NAMES = [
  'cx',
  'cy',
  'd',
  'dx',
  'dy',
  'height',
  'lengthAdjust',
  'points',
  'r',
  'rx',
  'ry',
  'text-anchor',
  'textLength',
  'transform',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
  'width',
];

/**
 * Clone a tree of elements, and append it as a new child onto a DOM.
 * @param {!Element} parent Parent DOM element.
 * @param {Element} container A disposable <body> or <svg> wrapper.
 */
CCC.World.cloneAndAppend = function(parent, container) {
  if (container) {
    var clonedContianer = container.cloneNode(true);
    while (clonedContianer.firstChild) {
      parent.appendChild(clonedContianer.firstChild);
    }
  }
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

/**
 * Gets the message with the given key from the document.
 * @param {string} key The key of the document element.
 * @param {...string} var_args Optional substitutions for %1, %2, ...
 * @return {string} The textContent of the specified element.
 */
CCC.getMsg = function(key, var_args) {
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

window.addEventListener('message', CCC.World.receiveMessage, false);
window.addEventListener('load', CCC.World.init, false);
