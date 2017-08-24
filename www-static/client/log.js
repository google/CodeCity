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
    /^((https?|ftp|gopher|data|irc|telnet|news|wais|file|nntp|mailto):|\/)/;

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
  CCC.Common.init();
  CCC.Log.scrollDiv = document.getElementById('scrollDiv');
  window.addEventListener('resize', CCC.Log.scrollToBottom, false);
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
  var data = CCC.Common.verifyMessage(e);
  if (!data) {
    return;
  }
  var mode = data['mode'];
  var text = data['text'];
  if (mode === 'clear') {
    CCC.Log.scrollDiv.innerHTML = '';
  } else if (mode === 'blur') {
      CCC.Common.closeMenu();
  } else if (mode === 'command') {
    var div = CCC.Log.textToHtml(text);
    div.className = 'commandDiv';
    CCC.Log.appendRow(div);
  } else if (mode === 'terminate') {
    CCC.Log.setConnected(false);
  } else {
    CCC.Log.setConnected(true);
    var dom = CCC.Common.parser.parseFromString(text, 'text/xml');
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
 * Change the connection status between being connected or disconnected.
 * @param {boolean} newConnected New status.
 */
CCC.Log.setConnected = function(newConnected) {
  if (newConnected === CCC.Common.isConnected) {
    return;  // No change.
  }
  CCC.Common.isConnected = newConnected;
  // Add/remove a classname on body, so that links and menus can change style.
  if (CCC.Common.isConnected) {
    document.body.classList.remove("disconnected");
  } else {
    document.body.classList.add("disconnected");
  }
  // Notify the user of the status change.
  var div = CCC.Log.connectDiv();
  CCC.Log.appendRow(div);
};

/**
 * Create a div notifying the user of connection or disconnection.
 * @return {!Element} HTML div element.
 */
CCC.Log.connectDiv = function() {
  var div = document.createElement('div');
  div.className =
      (CCC.Common.isConnected ? 'connectDiv' : 'disconnectDiv');
  var span = document.createElement('span');
  span.className = 'date';
  span.appendChild(document.createTextNode(CCC.Common.currentDateString()));
  div.appendChild(span);

  div.appendChild(CCC.Log.getMsg(CCC.Common.isConnected ?
                           'connectedMsg' : 'disconnectedMsg'));
  if (!CCC.Common.isConnected) {
    var link = document.createElement('a');
    link.className = 'reconnect';
    link.appendChild(CCC.Log.getMsg('reconnectMsg'));
    div.appendChild(link)
    link.addEventListener('click', parent.location.reload.bind(parent.location));
  }
  return div;
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
    if (i !== 0) {
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
  if (rendered === null) {
    return;  // Unrequested scene.
  }
  var code = CCC.Common.serializer.serializeToString(dom);
  var pre = document.createElement('pre');
  pre.textContent = code;
  if (typeof prettyPrint === 'function') {
    pre.className = 'prettyprint lang-xml';
    var div = document.createElement('div');
    div.appendChild(pre);
    prettyPrint(null, div);
  }

  if (rendered) {
    if (typeof rendered === 'string') {
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
  if (!zippy.className.includes(' open')) {
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
 * @return {Element} Div of text, or null if not to be visualized,
 *   or undefined if unknown/corrupt format.
 */
CCC.Log.renderXml = function(node) {
  switch (node.tagName) {
    case 'iframe':
      // <iframe src="https://neil.fraser.name/">Neil Fraser</iframe>
      var src = node.getAttribute('src');
      var m = src.match(CCC.Log.protocolRegex);
      if (!m) {
        return undefined;  // Invalid src attribute.
      }
      var div = document.createElement('div');
      var text = node.textContent || src;
      div.appendChild(document.createTextNode(text));
      div.appendChild(CCC.Log.openIcon(src));
      return div;
    case 'htmltext':
      // <htmltext>&lt;p&gt;Hello world.&lt;/p&gt;</htmltext>
      var dom = CCC.Common.parser.parseFromString(node.textContent, 'text/html');
      if (dom.body) {
        var div = document.createElement('div');
        CCC.Log.renderHtmltext(div, dom.body);
        return div;
      }
      return undefined;  // Illegal HTML.
    case 'scene':
      // <scene user="Max" room="The Hangout" requested="true">
      //   <description>The lights are dim and blah blah blah...</description>
      //   <svgtext>...</svgtext>
      //   <object name="a clock">
      //     <svgtext>...</svgtext>
      //     <cmds><cmd>look clock</cmd></cmds>
      //   </object>
      //   <user name="Max">
      //     <svgtext>...</svgtext>
      //     <cmds><cmd>look Max</cmd></cmds>
      //   </user>
      // </scene>
      var requested = node.getAttribute('requested');
      if (requested === 'false') {
        return null;  // Do not display this scene update in the log.
      }
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
          case 'user':
            var isUser = child.tagName === 'user';
            var name = child.getAttribute('name');
            if (isUser && CCC.Log.userName === name) {
              break;  // Don't show the current user.
            }
            var df = document.createDocumentFragment();
            df.appendChild(document.createTextNode(name));
            var cmds = child.querySelector('user>cmds,object>cmds');
            if (cmds) {
              var icon = CCC.Common.newMenuIcon(cmds);
              if (icon) {
                icon.addEventListener('click', CCC.Common.openMenu);
                df.appendChild(icon);
              }
            }
            (isUser ? users : objects).push(df);
            break;
        }
      }
      var div = document.createElement('div');
      var roomName = node.getAttribute('room');
      if (roomName) {
        var titleDiv = document.createElement('div');
        titleDiv.className = 'sceneTitle';
        titleDiv.appendChild(document.createTextNode(roomName));
        div.appendChild(titleDiv);
      }
      if (description) {
        var descriptionDiv = document.createElement('div');
        descriptionDiv.appendChild(document.createTextNode(description));
        div.appendChild(descriptionDiv);
      }
      if (objects.length) {
        var objectsDiv = document.createElement('div');
        if (objects.length === 1) {
          objectsDiv.appendChild(CCC.Log.getMsg('roomObjectMsg', objects[0]));
        } else if (objects.length > 1) {
          objectsDiv.appendChild(
              CCC.Log.getMsg('roomObjectsMsg', CCC.Log.naturalList(objects)));
        }
        div.appendChild(objectsDiv);
      }
      if (users.length) {
        var usersDiv = document.createElement('div');
        if (users.length === 1) {
          usersDiv.appendChild(CCC.Log.getMsg('roomUserMsg', users[0]));
        } else if (users.length > 1) {
          usersDiv.appendChild(
              CCC.Log.getMsg('roomUsersMsg', CCC.Log.naturalList(users)));
        }
        div.appendChild(usersDiv);
      }
      return div;
    case 'say':
      // <say>Welcome</say>
      // <say user="Max" room="The Hangout">Hello world.</say>
      // <say object="Cat" room="The Hangout">Meow.</say>
      // Fall through.
    case 'think':
      // <think>Don't be evil.</think>
      // <think user="Max" room="The Hangout">I'm hungry.</think>
      // <think object="Cat" room="The Hangout">I'm evil.</think>
      var user = node.getAttribute('user');
      var object = node.getAttribute('object');
      var msg = node.textContent;
      if (node.tagName === 'think') {
        var type = 'think';
      } else {
        var lastLetter = msg[msg.length - 1];
        var type = (lastLetter === '?') ? 'ask' :
            ((lastLetter === '!') ? 'exclaim' : 'say');
      }
      if (user && CCC.Log.userName === user) {
        var fragment = CCC.Log.getMsg(type + 'SelfMsg', msg);
      } else {
        var who = user || object || CCC.Log.getMsg('unknownMsg');
        var fragment = CCC.Log.getMsg(type + 'Msg', who, msg);
      }
      var div = document.createElement('div');
      div.appendChild(fragment);
      return div;
    case 'text':
      // <text>The dog bites Max</text>
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(node.textContent));
      return div;
    case 'move':

  }
  // Unknown XML.
  return undefined;
};

/**
 * Create an icon that links to a page in a new window.
 * @param {string} src URL of link to open.
 * @return {!Element} DOM element of newly-created link and icon.
 */
CCC.Log.openIcon = function(src) {
  // <a href="https://example.com" target="_blank">
  //   <svg class="openIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 3 24 24">
  //     <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1..."/>
  //   </svg>
  // </a>
  // Icon artwork sourced from https://icons.googleplex.com/
  var link = document.createElement('a');
  link.href = src;
  link.target = '_blank';
  var svg = CCC.Common.createSvgElement('svg',
      {'class': 'openIcon', 'viewBox': '0 3 24 24'}, link);
  CCC.Common.createSvgElement('path',
      {'d': 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z'}, svg);
  return link;
};

/**
 * Create a mostly text-based representation of the provided DOM.
 * @param {!Element} div Div element to append content to.
 * @param {!Node} node DOM to walk.
 */
CCC.Log.renderHtmltext = function(div, node) {
  if (node.nodeType === 1) {
    // Element.
    if (node.tagName === 'svg') {  // XML tagNames are lowercase.
      return;  // No text content of this tag should be rendered.
    }
    if (node.tagName === 'CMDS') {  // HTML tagNames are uppercase.
      var icon = CCC.Common.newMenuIcon(node);
      if (icon) {
        icon.addEventListener('click', CCC.Common.openMenu);
        div.appendChild(icon);
      }
      return;
    }
    if (node.tagName === 'CMD') {  // HTML tagNames are uppercase.
      var cmdText = node.innerText;
      var a = document.createElement('a');
      a.className = 'command';
      a.appendChild(document.createTextNode(cmdText));
      a.addEventListener('click', CCC.Common.commandFunction, false);
      div.appendChild(a);
      return;
    }
    for (var i = 0, child; (child = node.childNodes[i]); i++) {
      CCC.Log.renderHtmltext(div, node.childNodes[i]);
    }
    if (CCC.Log.renderHtmltext.BLOCK_NAMES.indexOf(node.tagName) !== -1) {
      if (div.lastChild && div.lastChild.tagName !== 'BR') {
        div.appendChild(document.createElement('br'));
      }
    }
  } else if (node.nodeType === 3) {
    // Text node.
    div.appendChild(document.createTextNode(node.data));
  }
};

/**
 * List of elements that are blocks, rather than inline.
 */
CCC.Log.renderHtmltext.BLOCK_NAMES = [
  'ADDRESS',
  'BLOCKQUOTE',
  'BR',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HR',
  'LI',
  'OL',
  'P',
  'PRE',
  'TABLE',
  'TR',
  'UL',
];

/**
 * Gets the message with the given key from the document.
 * @param {string} key The key of the document element.
 * @param {...string|DocumentFragment} var_args Optional substitutions for %1...
 * @return {!DocumentFragment} A document fragment containing the text.
 */
CCC.Log.getMsg = function(key, var_args) {
  var element = document.getElementById(key);
  if (!element) {
    throw 'Unknown message ' + key;
  }
  var text = element.textContent;
  var parts = text.split(/(%\d)/);
  var df = document.createDocumentFragment();
  // Inject any substitutions.
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    var m = part.match(/^%(\d)$/);
    if (m) {
      var inject = arguments[m[1]];
      if (typeof inject === 'string') {
        inject = document.createTextNode(inject);
      }
      df.appendChild(inject);
    } else if (part) {
      df.appendChild(document.createTextNode(part));
    }
  }
  return df;
};

/**
 * Make a natural language list.  Don't use Oxford comma due to lack of plurals.
 * ['apple', 'banana', 'cherry'] -> 'apple, banana and cherry'
 * @param {!Array.<!DocumentFragment>} list List of items to concatenate.
 * @return {!DocumentFragment} A document fragment containing the text.
 */
CCC.Log.naturalList = function(list) {
  if (list.length === 1) {
    return list[0];
  }
  var df = document.createDocumentFragment();
  for (var i = 0; i < list.length - 1; i++) {
    if (i) {
      df.appendChild(document.createTextNode(', '));
    }
    df.appendChild(list[i]);
  }
  df.appendChild(document.createTextNode(' '));
  df.appendChild(CCC.Log.getMsg('andMsg'));
  df.appendChild(document.createTextNode(' '));
  df.appendChild(list[list.length - 1]);
  return df;
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
  CCC.Log.scrollDiv.scrollLeft = 0;
};

window.addEventListener('message', CCC.Log.receiveMessage, false);
window.addEventListener('load', CCC.Log.init, false);
