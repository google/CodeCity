/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
  // <link rel="stylesheet" type="text/css" href="connect/prettify.css">
  // <script type="text/javascript" src="connect/prettify.js"></script>
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = STATIC_URL + 'connect/prettify.css';
  document.head.appendChild(link);
  var script = document.createElement('script');
  script.src = STATIC_URL + 'connect/prettify.js';
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
  if (mode === CCC.Common.MessageTypes.CLEAR) {
    // Clear all lines, except for the 'Reconnect?' line (if it exists).
    var div;
    while ((div = CCC.Log.scrollDiv.firstChild) &&
           div.className !== 'disconnectDiv') {
      CCC.Log.scrollDiv.removeChild(div);
    }
    // Clear the date/time on the 'Reconnect?' line (if it exists).
    if (div) {
      var dates = div.getElementsByClassName('date');
      if (dates[0]) {
        dates[0].textContent = '...';
      }
    }
  } else if (mode === CCC.Common.MessageTypes.BLUR) {
    CCC.Common.closeMenu();
  } else if (mode === CCC.Common.MessageTypes.COMMAND) {
    var text = data['text'];
    var div = CCC.Log.textToHtml(text);
    div.className = 'commandDiv';
    CCC.Log.appendRow(div);
  } else if (mode === CCC.Common.MessageTypes.CONNECTION) {
    CCC.Common.setConnected(data['state']);
  } else if (mode === CCC.Common.MessageTypes.CONNECT_MSG) {
    // Notify the user of the connection.
    var div = CCC.Log.connectDiv(true, data['text']);
    CCC.Log.appendRow(div);
  } else if (mode === CCC.Common.MessageTypes.DISCONNECT_MSG) {
    // Notify the user of the disconnection.
    var div = CCC.Log.connectDiv(false, data['text']);
    CCC.Log.appendRow(div);
  } else if (mode === CCC.Common.MessageTypes.MEMO) {
    var text = data['text'];
    try {
      var json = JSON.parse(text);
    } catch (e) {
      // Not valid JSON, treat as string literal.
      var div = CCC.Log.textToHtml(text);
      CCC.Log.appendRow(div);
      return;
    }
    CCC.Log.addJson(json);
  }
};

/**
 * Create a div notifying the user of connection or disconnection.
 * @param {boolean} isConnected New connection state.
 * @param {string} date Date/time of connection/disconnection.
 * @return {!Element} HTML div element.
 */
CCC.Log.connectDiv = function(isConnected, date) {
  var div = document.createElement('div');
  div.className = (isConnected ? 'connectDiv' : 'disconnectDiv');
  var span = document.createElement('span');
  span.className = 'date';
  span.appendChild(document.createTextNode(date));
  div.appendChild(span);

  div.appendChild(CCC.Log.getTemplate(isConnected ?
      'connectedTemplate' : 'disconnectedTemplate'));
  if (!isConnected) {
    var link = document.createElement('a');
    link.className = 'reconnect';
    link.appendChild(CCC.Log.getTemplate('reconnectTemplate'));
    div.appendChild(link);
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
  text = CCC.Common.escapeSpaces(text);
  var lines = text.split('\n');
  var div = document.createElement('div');
  for (var i = 0; i < lines.length; i++) {
    if (i !== 0) {
      div.appendChild(document.createElement('br'));
    }
    div.appendChild(document.createTextNode(lines[i]));
  }
  return div;
};

/**
 * Add one row of JSON to the log.
 * @param {!Object} json JSON structure.
 */
CCC.Log.addJson = function(json) {
  var rendered = CCC.Log.renderJson(json);
  if (rendered === null) {
    return;  // Unrequested scene.
  }
  var pre = document.createElement('pre');
  pre.textContent = JSON.stringify(json, null, 2);
  if (typeof prettyPrint === 'function') {
    pre.className = 'prettyprint lang-js';
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
 * Attempt to render the JSON as a plain text version.
 * @param {!Object} json JSON object.
 * @return {Element} Div of text, or null if not to be visualized,
 *   or undefined if unknown/corrupt format.
 */
CCC.Log.renderJson = function(json) {
  switch (json.type) {
    case 'iframe':
      // {type: "iframe", url: "https://example.com/foo", alt: "Alt text"}
      var src = json.url;
      var m = src.match(CCC.Log.protocolRegex);
      if (!m) {
        return undefined;  // Invalid src attribute.
      }
      var div = document.createElement('div');
      var text = json.alt || src;
      div.appendChild(document.createTextNode(text));
      div.appendChild(CCC.Log.openIcon(src));
      return div;
    case 'html':
      // {type: "html", htmlText: "<div>Arbitrary HTML</div>"}
      var dom = CCC.Common.parser.parseFromString(json.htmlText, 'text/html');
      if (dom.body) {
        var div = document.createElement('div');
        CCC.Log.renderHtmltext(div, dom.body);
        CCC.Common.autoHyperlink(div);
        return div;
      }
      return undefined;  // Illegal HTML.
    case 'scene':
      //{
      //  type: "scene",
      //  requested: true,
      //  user: "Max",
      //  where: "Hangout",
      //  description: "The lights are dim and blah blah blah...",
      //  svgText: "...",
      //  contents: [
      //    {
      //      type: "user",
      //      what: "Max",
      //      svgText: "...",
      //      cmds: ["look Max", "kick Max"]
      //    },
      //    {
      //      type: "thing",
      //      what: "clock",
      //      svgText: "...",
      //      cmds: ["look clock"]
      //    }
      //  ]
      //}
      if (!json.requested) {
        return null;  // Do not display this scene update in the log.
      }
      if (json.user) {
        // Record the user name if present.
        CCC.Log.userName = json.user;
      }
      var objects = [];
      var users = [];
      if (json.contents) {
        for (var content of json.contents) {
          if (content.type === 'user' && CCC.Log.userName === content.what) {
            continue;  // Don't show the current user.
          }
          var df = document.createDocumentFragment();
          df.appendChild(document.createTextNode(content.what));
          if (content.cmds) {
            var icon = CCC.Common.newMenuIcon(content.cmds);
            if (icon) {
              icon.addEventListener('click', CCC.Common.openMenu);
              df.appendChild(icon);
            }
          }
          (content.type === 'user' ? users : objects).push(df);
        }
      }
      var div = document.createElement('div');
      if (json.where) {
        var titleDiv = document.createElement('div');
        titleDiv.className = 'sceneTitle';
        titleDiv.appendChild(document.createTextNode(json.where));
        div.appendChild(titleDiv);
      }
      if (json.description) {
        var descriptionDiv = CCC.Log.textToHtml(json.description);
        CCC.Common.autoHyperlink(descriptionDiv);
        div.appendChild(descriptionDiv);
      }
      if (objects.length) {
        var objectsDiv = document.createElement('div');
        if (objects.length === 1) {
          objectsDiv.appendChild(CCC.Log.getTemplate(
              'roomObjectTemplate', objects[0]));
        } else if (objects.length > 1) {
          objectsDiv.appendChild(CCC.Log.getTemplate(
              'roomObjectsTemplate', CCC.Log.naturalList(objects)));
        }
        div.appendChild(objectsDiv);
      }
      if (users.length) {
        var usersDiv = document.createElement('div');
        if (users.length === 1) {
          usersDiv.appendChild(CCC.Log.getTemplate(
              'roomUserTemplate', users[0]));
        } else if (users.length > 1) {
          usersDiv.appendChild(CCC.Log.getTemplate(
              'roomUsersTemplate', CCC.Log.naturalList(users)));
        }
        div.appendChild(usersDiv);
      }
      return div;
    case 'say':
      // {type: "say", text: "Welcome"}
      // {type: "say", source: "Max", where: "Hangout", text: "Hello world."}
      // {type: "say", source: "Cat", where: "Hangout", text: "Meow."}
      // Fall through.
    case 'think':
      // {type: "think", text: "Don't be evil."}
      // {type: "think", source: "Max", where: "Hangout", text: "I'm hungry."}
      // {type: "think", source: "Cat", where: "Hangout", text: "I'm evil."}
      var text = CCC.Common.escapeSpaces(json.text);
      if (json.type === 'think') {
        var type = 'think';
      } else {
        var lastLetter = text.trim().slice(-1);
        var type = (lastLetter === '?') ? 'ask' :
            ((lastLetter === '!') ? 'exclaim' : 'say');
      }
      if (json.source && CCC.Log.userName === json.source) {
        var fragment = CCC.Log.getTemplate(type + 'SelfTemplate', text);
      } else {
        var who = json.source || CCC.Log.getTemplate('unknownTemplate');
        var fragment = CCC.Log.getTemplate(type + 'Template', who, text);
      }
      CCC.Common.autoHyperlink(fragment);
      var div = document.createElement('div');
      div.appendChild(fragment);
      return div;
    case 'narrate':
      // {type: "narrate", text: "Command not recognized."}
      // {type: "narrate", where: "Hangout", text: "Hangout is dark."}
      // {type: "narrate", source: "Max", where: "Hangout", text: "Max smiles."}
      // {type: "narrate", source: "Cat", where: "Hangout", text: "Cat meows."}
      var div = document.createElement('div');
      var text = json.text;
      if (json.source) {
        text = json.source + ': ' + text;
      }
      div.appendChild(document.createTextNode(text));
      CCC.Common.autoHyperlink(div);
      return div;
    case 'link':
      // {type: "link", href: "https://example.com/"}
      var div = document.createElement('div');
      var a = document.createElement('a');
      a.href = json.href;
      a.target = '_blank';
      a.appendChild(document.createTextNode(json.href));
      div.appendChild(a);
      // Note: this opens the link in a new tab regardless of whether the user
      // is in world or log view.
      var success = window.open(json.href);
      if (!success) {
        alert('Your browser has blocked the opening of the page you requested.\n' +
              'Please allow pop-ups on this domain. ✓️');
      }
      return div;
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
  link.rel = 'noopener noreferrer';
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
  if (node.nodeType === Node.ELEMENT_NODE) {
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
    for (var child of node.childNodes) {
      CCC.Log.renderHtmltext(div, child);
    }
    if (CCC.Log.renderHtmltext.BLOCK_NAMES.has(node.tagName)) {
      // Add a <br> tag, but not if there's already one.
      var lastTag = div.lastChild;
      while (lastTag && lastTag.nodeType !== Node.ELEMENT_NODE) {
        if (lastTag.nodeType === Node.TEXT_NODE && lastTag.nodeValue.trim()) {
          // Found text that's not whitespace.  Bail.
          lastTag = null;
        } else {
          // Nothing printable found so far, keep walking up looking for a <br>.
          lastTag = lastTag.previousSibling;
        }
      }
      if (div.hasChildNodes() && (!lastTag || lastTag.tagName !== 'BR')) {
        div.appendChild(document.createElement('br'));
      }
    }
  } else if (node.nodeType === Node.TEXT_NODE) {
    // Text node.
    div.appendChild(document.createTextNode(node.data));
  }
};

/**
 * List of elements that are blocks, rather than inline.
 */
CCC.Log.renderHtmltext.BLOCK_NAMES = new Set([
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
]);

/**
 * Gets the template with the given key from the document.
 * @param {string} key The key of the document element.
 * @param {...string|DocumentFragment} var_args Optional substitutions for %1...
 * @return {!DocumentFragment} A document fragment containing the text.
 */
CCC.Log.getTemplate = function(key, var_args) {
  var element = document.getElementById(key);
  if (!element) {
    throw new Error('Unknown template ' + key);
  }
  var text = element.textContent;
  var parts = text.split(/(%\d)/);
  var df = document.createDocumentFragment();
  // Inject any substitutions.
  for (var part of parts) {
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
  df.appendChild(CCC.Log.getTemplate('andTemplate'));
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

if (!window.TEST) {
  window.addEventListener('message', CCC.Log.receiveMessage, false);
  window.addEventListener('load', CCC.Log.init, false);
}
