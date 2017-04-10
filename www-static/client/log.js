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
 * @fileoverview Log frame of Code City's client.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var CCC = {};
CCC.Log = {};

/**
 * Maximum number of lines saved in history.
 */
CCC.Log.maxHistorySize = 10000;

/**
 * Initialization code called on startup.
 */
CCC.Log.init = function() {
  CCC.Log.scrollDiv = document.getElementById('scrollDiv');
  CCC.Log.parser = new DOMParser();
  CCC.Log.serializer = new XMLSerializer();

  window.addEventListener('resize', CCC.Log.resize, false);

  // Report back to the parent frame that we're fully loaded and ready to go.
  parent.postMessage('initLog', location.origin);
  // Lazy-load prettify library.
  setTimeout(CCC.Log.importPrettify, 1);
};

/**
 * Load the Prettify CSS and JavaScript.
 */
CCC.Log.importPrettify = function() {
  //<link rel="stylesheet" type="text/css" href="common/prettify.css">
  //<script type="text/javascript" src="common/prettify.js"></script>
  var link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('type', 'text/css');
  link.setAttribute('href', 'prettify.css');
  document.head.appendChild(link);
  var script = document.createElement('script');
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('src', 'prettify.js');
  document.head.appendChild(script);
};

/**
 * Receive messages from our parent frame.
 * @param {!Event} e Incoming message event.
 */
CCC.Log.receiveMessage = function(e) {
  var origin = e.origin || e.originalEvent.origin;
  if (origin != location.origin) {
    console.error('Message received by log frame from unknown origin: ' +
                  origin);
    return;
  }
  var mode = e.data['mode'];
  var text = e.data['text'];
  if (mode == 'clear') {
    CCC.Log.scrollDiv.innerHTML = '';
  } else if (mode == 'command') {
    var div = CCC.Log.textToHtml(text);
    div.className = 'commandDiv';
    CCC.Log.appendRow(div);
  } else {
    var dom = CCC.Log.parser.parseFromString(text, 'text/xml');
    if (dom.getElementsByTagName('parsererror').length) {
      // Not valid XML, treat as string literal.
      var div = CCC.Log.textToHtml(text);
      CCC.Log.appendRow(div);
    } else {
      CCC.Log.addXml(dom);
    }
  }
};

/**
 * Convert plain text to HTML.  Preserve spaces and line breaks.
 * @param {string} text Line of text.
 * @return {!Element} HTML div element.
 */
CCC.Log.textToHtml = function(text) {
  text = text.replace(/  /g, '\u00A0 ');
  text = text.replace(/  /g, '\u00A0 ');
  text = text.replace(/^ /gm, '\u00A0');
  var lines = text.split('\n');
  var div = document.createElement('div');
  div.className = 'textDiv';
  for (var i = 0; i < lines.length; i++) {
    if (i != 0) {
      div.appendChild(document.createElement('br'));
    }
    div.appendChild(document.createTextNode(lines[i]));
  }
  return div;
};

/**
 * Add one row of XML to the log.
 * @param {!Object} dom XML tree.
 */
CCC.Log.addXml = function(dom) {
  var text = CCC.Log.renderXml(dom);
  var code = CCC.Log.serializer.serializeToString(dom);
  var pre = document.createElement('pre');
  pre.textContent = code;
  if (typeof prettyPrint == 'function') {
    pre.className = 'prettyprint lang-xml';
    var div = document.createElement('div');
    div.appendChild(pre);
    prettyPrint(null, div);
  }

  if (text) {
    var div = CCC.Log.textToHtml(text);
    div.className = 'zippyDiv';
    var span = document.createElement('span');
    span.className = 'zippySpan';
    span.addEventListener('click', CCC.Log.toggleZippy);
    div.insertBefore(span, div.firstChild);
    pre.style.display = 'none';
    div.appendChild(pre);
    CCC.Log.appendRow(div);
  } else {
    CCC.Log.appendRow(pre);
  }
};

CCC.Log.toggleZippy = function(e) {
  var zippy = e.target;
  var pre = e.target.parentNode.lastChild;
  if (zippy.className.indexOf(' open') == -1) {
    zippy.className += ' open';
    pre.style.display = 'block';
  } else {
    zippy.className = zippy.className.replace(' open', '');
    pre.style.display = 'none';
  }
};

/**
 * Attempt to render the XML as a plain text version.
 * @param {!Object} dom XML tree.
 * @return {string} Text representation.
 */
CCC.Log.renderXml = function(dom) {
  var node = dom.firstChild;
  if (!node) {
    return '';  // Invalid.
  }
  if (node.tagName == 'say') {
    // <say user="Max" room="The Hangout">Hello world.</say>
    var user = node.getAttribute('user');
    var text = user + ' says, "' + node.textContent + '"';
    return text;
  }
  // Unknown XML.
  return '';
};

/**
 * Add one row to the log.  Scroll page to the bottom.
 * @param {!Element} element HTML element to add.
 */
CCC.Log.appendRow = function(element) {
  var div = CCC.Log.scrollDiv;
  div.appendChild(element);
  if (div.childNodes.length > CCC.Log.maxHistorySize) {
    div.removeChild(document.body.firstChild);
  }
  div.scrollTop = div.scrollHeight;
};

/**
 * When resizing, keep the log scrolled to the bottom.
 */
CCC.Log.resize = function() {
  CCC.Log.scrollDiv.scrollTop = CCC.Log.scrollDiv.scrollHeight;
};

window.addEventListener('message', CCC.Log.receiveMessage, false);
window.addEventListener('load', CCC.Log.init, false);
