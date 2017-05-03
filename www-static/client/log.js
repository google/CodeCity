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
  if (mode == 'clear') {
    CCC.Log.scrollDiv.innerHTML = '';
  } else if (mode == 'blur') {
      CCC.Common.closeMenu();
  } else if (mode == 'command') {
    var div = CCC.Log.textToHtml(text);
    div.className = 'commandDiv';
    CCC.Log.appendRow(div);
  } else {
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
  var code = CCC.Common.serializer.serializeToString(dom);
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
      var dom = CCC.Common.parser.parseFromString(node.textContent, 'text/html');
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
      //     <cmds><cmd>look clock</cmd></cmds>
      //   </object>
      //   <user name="Max">
      //     <svgtext>...</svgtext>
      //     <cmds><cmd>look Max</cmd></cmds>
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
          case 'user':
            var df = document.createDocumentFragment();
            df.appendChild(document.createTextNode(
                child.getAttribute('name')));
            var cmds = child.querySelector('user>cmds,object>cmds');
            if (cmds) {
              var icon = CCC.Common.newMenuIcon(cmds);
              if (icon) {
                icon.addEventListener('click', CCC.Common.openMenu);
                df.appendChild(icon);
              }
            }
            (child.tagName == 'user' ? users : objects).push(df);
            break;
        }
      }
      var div = document.createElement('div');
      var roomName = node.getAttribute('location');
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
      if (objects.length == 1) {
        div.appendChild(CCC.Log.getMsg('roomObjectMsg', objects[0]));
      } else if (objects.length > 1) {
        div.appendChild(
            CCC.Log.getMsg('roomObjectsMsg', CCC.Log.naturalList(objects)));
      }
      if (users.length == 1) {
        div.appendChild(CCC.Log.getMsg('roomUserMsg', users[0]));
      } else if (users.length > 1) {
        div.appendChild(
            CCC.Log.getMsg('roomUsersMsg', CCC.Log.naturalList(users)));
      }
      return div;
    case 'say':
      // <say user="Max" room="The Hangout">Hello world.</say>
      var user = node.getAttribute('user');
      if (CCC.Log.userName === user) {
        var text = CCC.Log.getMsg('saySelfMsg', node.textContent);
      } else {
        var text = CCC.Log.getMsg('sayMsg', user, node.textContent);
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
    if (node.tagName == 'svg') {  // XML tagNames are lowercase.
      return;  // No text content of this tag should be rendered.
    }
    if (node.tagName == 'CMDS') {  // HTML tagNames are uppercase.
      var icon = CCC.Common.newMenuIcon(node);
      if (icon) {
        icon.addEventListener('click', CCC.Common.openMenu);
        div.appendChild(icon);
      }
      return;
    }
    if (node.tagName == 'CMD') {  // HTML tagNames are uppercase.
      var cmdText = node.innerText;
      var a = document.createElement('a');
      a.className = 'command';
      a.appendChild(document.createTextNode(cmdText));
      a.addEventListener('click', CCC.Common.commandFunction, false);
      div.appendChild(a);
      return;
    }
    for (var i = 0, child; child = node.childNodes[i]; i++) {
      CCC.Log.renderHtmltext(div, node.childNodes[i]);
    }
    if (CCC.Log.renderHtmltext.BLOCK_NAMES.indexOf(node.tagName) != -1) {
      div.appendChild(document.createElement('br'));
    }
  } else if (node.nodeType == 3) {
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
      df.appendChild(arguments[m[1]]);
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
  if (list.length == 1) {
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
