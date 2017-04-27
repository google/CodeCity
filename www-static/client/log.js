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
 * Allowed protocols for iframe links.
 * Probably best not to allow 'javascript:' URIs due to security reasons.
 */
CCC.Log.protocolRegex =
    /^(https?|ftp|gopher|data|irc|telnet|news|wais|file|nntp|mailto):/;

/**
 * Record of the user's name.  Used for displaying 2nd person vs 3rd person
 * messages.  E.g.:  You say, "Hello."  -vs-  Max says, "Hello."
 * @type {string=}
 */
CCC.Log.userName = undefined;

/**
 * Initialization code called on startup.
 */
CCC.Log.init = function() {
  CCC.Log.scrollDiv = document.getElementById('scrollDiv');
  CCC.Log.parser = new DOMParser();
  CCC.Log.serializer = new XMLSerializer();

  window.addEventListener('resize', CCC.Log.scrollToBottom, false);

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
      for (var i = 0, child; child = dom.childNodes[i]; i++) {
        CCC.Log.addXml(child);
      }
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
  var rendered = CCC.Log.renderXml(dom);
  var code = CCC.Log.serializer.serializeToString(dom);
  var pre = document.createElement('pre');
  pre.textContent = code;
  if (typeof prettyPrint == 'function') {
    pre.className = 'prettyprint lang-xml';
    var div = document.createElement('div');
    div.appendChild(pre);
    prettyPrint(null, div);
  }

  if (rendered) {
    if (typeof rendered == 'string') {
      var div = CCC.Log.textToHtml(rendered);
    } else {
      var div = rendered;
    }
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
  var pre = zippy.parentNode.lastChild;
  if (zippy.className.indexOf(' open') == -1) {
    zippy.className += ' open';
    pre.style.display = 'block';
    if (!zippy.parentNode.nextSibling) {
      // Opening a zippy at the bottom of the page.  Scroll down.
      CCC.Log.scrollToBottom();
    }
  } else {
    zippy.className = zippy.className.replace(' open', '');
    pre.style.display = 'none';
  }
};

/**
 * Attempt to render the XML as a plain text version.
 * @param {!Element} node XML tree.
 * @return {string|!Element} Text representation or div.
 */
CCC.Log.renderXml = function(node) {
  switch (node.tagName) {
    case 'iframe':
      // <iframe src="https://neil.fraser.name/">Neil Fraser</iframe>
      var src = node.getAttribute('src');
      var m = src.match(CCC.Log.protocolRegex);
      if (!m) {
        return '';  // Invalid src attribute.
      }
      var text = node.textContent || src;
      var link = document.createElement('a');
      link.href = src;
      link.target = '_blank';
      link.appendChild(document.createTextNode(text));
      var div = document.createElement('div');
      div.appendChild(link);
      return div;
    case 'htmltext':
      // <htmltext>&lt;p&gt;Hello world.&lt;/p&gt;</htmltext>
      var dom = CCC.Log.parser.parseFromString(node.textContent, 'text/html');
      if (dom.body) {
        var div = document.createElement('div');
        CCC.Log.renderHtmltext(div, dom.body);
        return div;
      }
      return '';  // Illegal HTML.
    case 'scene':
      // <scene user="Max" location="The Hangout">
      //   <description>The lights are dim and blah blah blah...</description>
      //   <svgtext>...</svgtext>
      //   <object name="a clock">
      //     <svgtext>...</svgtext>
      //   </object>
      //   <user name="Max">
      //     <svgtext>...</svgtext>
      //   </user>
      // </scene>
      var user = node.getAttribute('user');
      if (user) {
        // Record the user name if present.
        CCC.Log.userName = user;
      }
      var description = '';
      var objects = [];
      var users = [];
      for (var i = 0, child; child = node.childNodes[i]; i++) {
        switch (child.tagName) {
          case 'description':
            description = child.textContent;
            break;
          case 'object':
            objects.push(child.getAttribute('name'));
            break;
          case 'user':
            users.push(child.getAttribute('name'));
            break;
        }
      }
      var text = '';
      var roomName = node.getAttribute('location');
      if (roomName) {
        text += roomName + '\n';
      }
      if (description) {
        text += description + '\n';
      }
      if (objects.length == 1) {
        text += CCC.getMsg('roomObjectMsg', objects[0]);
      } else if (objects.length > 1) {
        text += CCC.getMsg('roomObjectsMsg', CCC.Log.naturalList(objects));
      }
      if (users.length == 1) {
        text += CCC.getMsg('roomUserMsg', users[0]);
      } else if (users.length > 1) {
        text += CCC.getMsg('roomUsersMsg', CCC.Log.naturalList(users));
      }
      return text;
    case 'say':
      // <say user="Max" room="The Hangout">Hello world.</say>
      var user = node.getAttribute('user');
      if (CCC.Log.userName === user) {
        var text = CCC.getMsg('saySelfMsg', node.textContent);
      } else {
        var text = CCC.getMsg('sayMsg', user, node.textContent);
      }
      return text;
  }
  // Unknown XML.
  return '';
};

/**
 * Create a mostly text-based representation of the provided DOM.
 * @param {!Element} div Div element to append content to.
 * @param {!Node} node DOM to walk.
 */
CCC.Log.renderHtmltext = function(div, node) {
  if (node.nodeType == 1) {
    // Element.
    if (node.tagName == 'svg') {  // SVG tagName must be lowercase.
      return;  // No text content of this tag should be rendered.
    }
    if (node.tagName == 'MENUITEM') {  // MENUITEM tagName must be uppercase.
      var cmdText = node.innerText;
      var a = document.createElement('a');
      a.className = 'command';
      a.appendChild(document.createTextNode(cmdText));
      a.addEventListener('click', function() {
        parent.postMessage({'commands': [cmdText]}, location.origin);
      });
      div.appendChild(a);
      return;
    }
    for (var i = 0, child; child = node.childNodes[i]; i++) {
      CCC.Log.renderHtmltext(div, node.childNodes[i]);
    }
  } else if (node.nodeType == 3) {
    // Text node.
    div.appendChild(document.createTextNode(node.data));
  }
};

/**
 * Make a natural language list.  Don't use Oxford comma due to lack of plurals.
 * ['apple', 'banana', 'cherry'] -> 'apple, banana and cherry'
 * @param {!Array.<string>} list List of strings.
 * @return {string} Natural language list.
 */
CCC.Log.naturalList = function(list) {
  var text = list.slice(0, -1).join(', ');
  var last = list[list.length - 1];
  if (text) {
    text += ' ' + CCC.getMsg('andMsg') + ' ' + last;
  } else {
    text = last;
  }
  return text;
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
  CCC.Log.scrollToBottom();
};

/**
 * Scroll the log to the bottom.
 */
CCC.Log.scrollToBottom = function() {
  CCC.Log.scrollDiv.scrollTop = CCC.Log.scrollDiv.scrollHeight;
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

window.addEventListener('message', CCC.Log.receiveMessage, false);
window.addEventListener('load', CCC.Log.init, false);
