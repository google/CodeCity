/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Functions common across log/world frames of Code City's client.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var CCC = {};
CCC.Common = {};


/**
 * Namespace for SVG elements.
 * @constant
 */
CCC.Common.NS = 'http://www.w3.org/2000/svg';

/**
 * Is the client currently connected to the server?
 */
CCC.Common.isConnected = false;

/**
 * Enum for message types to the log/world frames.
 * Should be identical to CCC.MessageTypes
 * @enum {string}
 */
CCC.Common.MessageTypes = {
  // Messages that may be paused:
  COMMAND: 'command',  // User-generated command echoed.
  MEMO: 'memo',  // Block of text from Code City.
  CONNECT_MSG: 'connect msg',  // User-visible connection message.
  DISCONNECT_MSG: 'disconnect msg',  // User-visible disconnection message.
  // Messages that may be sent while paused:
  CONNECTION: 'connection',  // Signal change of connection state.
  CLEAR: 'clear',  // Signal tho clear history.
  BLUR: 'blur'  // Signal to close pop-up menus.
};

/**
 * Initialization code called on startup.
 */
CCC.Common.init = function() {
  CCC.Common.parser = new DOMParser();
  CCC.Common.serializer = new XMLSerializer();
  document.body.addEventListener('click', CCC.Common.closeMenu, true);
  document.body.addEventListener('keydown', CCC.Common.keyDown, true);
  document.body.addEventListener('keypress', CCC.Common.keyPress, true);

  // Report back to the parent frame that we're fully loaded and ready to go.
  parent.postMessage('init', location.origin);
};

/**
 * Verify that a received message is from our parent frame.
 * @param {!Event} e Incoming message event.
 * @return {*} Value from message.
 */
CCC.Common.verifyMessage = function(e) {
  var origin = e.origin || e.originalEvent.origin;
  if (origin !== location.origin) {
    throw new Error('Message received by frame from unknown origin: ' + origin);
  }
  return e.data;
};

/**
 * Change the connection status between being connected or disconnected.
 * @param {boolean} newConnected New status.
 */
CCC.Common.setConnected = function(newConnected) {
  if (newConnected === CCC.Common.isConnected) {
    return;  // No change.
  }
  CCC.Common.isConnected = newConnected;
  // Add/remove a classname on body, so that links and menus can change style.
  if (CCC.Common.isConnected) {
    document.body.classList.remove('disconnected');
  } else {
    document.body.classList.add('disconnected');
  }
};


/**
 * Create a command menu icon.  Attach the menu commands to the icon.
 * @param {!Array<string>|!Element} cmds Array of menu commands,
 *     or root DOM element describing the menu commands.
 * @return {SVGSVGElement} Root element of icon.
 */
CCC.Common.newMenuIcon = function(cmds) {
  if (cmds.querySelectorAll) {
    // HTML frames provide commands as XML.
    // Convert the command DOM into an array.
    // <cmds><cmd>look Bob</cmd></cmds> -> ['look Bob']
    var nodes = cmds.querySelectorAll('cmd');
    cmds = [];
    for (var i = 0; i < nodes.length; i++) {
      cmds[i] = CCC.Common.innerText(nodes[i]);
    }
  }
  if (!cmds.length) {
    return null;
  }
  var svg = CCC.Common.createSvgElement('svg',
      {'class': 'menuIcon', 'data-cmds': JSON.stringify(cmds)});
  CCC.Common.createSvgElement('path', {'d': 'm 0.5,2.5 5,5 5,-5 z'}, svg);
  return svg;
};

/**
 * Concatenate all the text element in a DOM tree.
 * <foo>123<bar>456</bar>789</foo> -> '123456789'
 * @param {!Element} node Root DOM element.
 * @return {string} Plain text.
 */
CCC.Common.innerText = function(node) {
  var text = '';
  if (node.nodeType === Node.TEXT_NODE) {
    text = node.data;
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    for (var child of node.childNodes) {
      text += CCC.Common.innerText(child);
    }
  }
  return text;
};

/**
 * Open the command menu for the clicked menu icon.
 * @param {!Event} e Click event.
 * @this {!SVGSVGElement} Root element of icon.
 */
CCC.Common.openMenu = function(e) {
  CCC.Common.closeMenu();  // Should be already closed, but let's make sure.
  var cmds = JSON.parse(this.getAttribute('data-cmds'));
  var menu = document.createElement('div');
  menu.id = 'menu';
  for (var cmd of cmds) {
    var menuItem = document.createElement('div');
    menuItem.className = 'menuitem';
    menuItem.appendChild(document.createTextNode(cmd));
    menuItem.addEventListener('click', CCC.Common.commandFunction, false);
    menu.appendChild(menuItem);
  }
  var scrollDiv = document.getElementById('scrollDiv');
  var pageHeight = scrollDiv.scrollHeight;
  var pageWidth = scrollDiv.scrollWidth;
  scrollDiv.appendChild(menu);
  var iconRect = this.getBoundingClientRect();
  // Calculate preferred location of below and right of icon.
  var top = iconRect.top + scrollDiv.scrollTop + iconRect.height -
      scrollDiv.offsetTop;
  var left = iconRect.left + scrollDiv.scrollLeft;
  // Flip up if below page.
  if (top + menu.offsetHeight > pageHeight) {
    top -= menu.offsetHeight + iconRect.height;
    // Don't go off the top of the page.
    top = Math.max(top, 0);
  }
  // Don't go off the right of the page.
  if (left + menu.offsetWidth > pageWidth) {
    left = pageWidth - menu.offsetWidth;
    // Don't go off the right of the page.
    left = Math.max(left, 0);
  }
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
};

/**
 * If there is a menu open, close it.
 */
CCC.Common.closeMenu = function() {
  var menu = document.getElementById('menu');
  if (menu) {
    menu.parentNode.removeChild(menu);
    CCC.Common.parentFocus();
  }
};

/**
 * When clicked, execute the printed command.
 * @this {!Element} Clicked element.
 */
CCC.Common.commandFunction = function() {
  var command = this.innerText;
  // Menu commands should never be multi-line.
  // This should never happen and be caught earlier.
  // But if it does, fail here rather than be a security hole.
  if (command.split(/[\r\n]/).length !== 1) {
    throw new Error('Multi-line command: ' + command);
  }
  if (CCC.Common.isConnected) {
    parent.postMessage({'commands': [command]}, location.origin);
  }
  CCC.Common.parentFocus();
};

/**
 * The user pressed a key with the focus in the world/log frame.
 * Move focus back to the parent frame and inject the keystroke into the
 * command area.
 * @param {!KeyboardEvent} e Keyboard down event.
 */
CCC.Common.keyDown = function(e) {
  if (e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') {
    // Don't steal focus if the user is pressing a modifier key in preparation
    // for a cut/copy operation.
    return;
  }
  if (e.ctrlKey || e.altKey || e.metaKey) {
    // Allow Chrome time to complete a copy before moving focus.
    setTimeout(CCC.Common.parentFocus, 0);
  } else {
    CCC.Common.parentFocus(e);
  }
};

/**
 * The user pressed a key with the focus in the world/log frame.
 * Move focus back to the parent frame and inject the keystroke into the
 * command area.
 * @param {!KeyboardEvent} e Keyboard press event.
 */
CCC.Common.keyPress = function(e) {
  // Allow Firefox time to complete a copy before moving focus.
  setTimeout(CCC.Common.parentFocus, 0);
};

/**
 * Move focus back to the parent frame.  If specified, inject the keystroke
 * into the command area.
 * @param {KeyboardEvent} e Optional keyboard event.
 */
CCC.Common.parentFocus = function(e) {
  try {
    var ct = parent.document.getElementById('commandTextarea');
    ct.focus();
    // Chrome won't type the character in the textarea after a focus change.
    // For the easy case where the field is empty, just add the character.
    // TODO: Handle cases where the field is not empty.
    if (e && e.key.length === 1 && !ct.value.length) {
      ct.value = e.key;
      // Firefox will type the character a second time, prevent this.
      e.preventDefault();
    }
  } catch (e) {
    // Cross-frame is risky in some browsers.  Fallback method.
    parent.focus();
  }
};

/**
 * Helper method for creating SVG elements.
 * @param {string} name Element's tag name.
 * @param {!Object} attrs Dictionary of attribute names and values.
 * @param {!Element=} opt_parent Optional parent on which to append the element.
 * @return {!SVGElement} Newly created SVG element.
 */
CCC.Common.createSvgElement = function(name, attrs, opt_parent) {
  var el = document.createElementNS(CCC.Common.NS, name);
  for (var key in attrs) {
    el.setAttribute(key, attrs[key]);
  }
  if (opt_parent) {
    opt_parent.appendChild(el);
  }
  return el;
};

/**
 * Given plain text, encode spaces and tabs such that HTML won't crush it.
 * Does not handle line breaks in any way.
 * @param {string} text Plain text.
 * @return {string} HTML with any runs of spaces encoded.
 */
CCC.Common.escapeSpaces = function(text) {
  return text.replace(/\t/g, '\u00A0 \u00A0 \u00A0 \u00A0 ')
      .replace(/  /g, '\u00A0 ').replace(/  /g, '\u00A0 ')
      .replace(/^ /gm, '\u00A0');
};

/**
 * Detect URLs in the provided document fragment and replace with links.
 * @param {!Element} el A DOM element to scan and modify.
 */
CCC.Common.autoHyperlink = function(el) {
  var isSvg = el.namespaceURI === CCC.Common.NS;
  var children = el.childNodes;  // This is a live NodeList.
  for (var i = children.length - 1, child; (child = children[i]); i--) {
    if (child.nodeType !== Node.TEXT_NODE) {
      CCC.Common.autoHyperlink(child);
      continue;
    }
    var text = child.nodeValue;
    var parts = text.split(CCC.Common.autoHyperlink.urlRegex);
    if (parts.length <= 1) {  // No hyperlinks found.
      continue;
    }
    for (var j = 0; j < parts.length; j++) {
      var part = parts[j];
      var m = part.match(CCC.Common.autoHyperlink.urlRegex);
      // Look up the previous character (if it exists), to weed out: $.www.bar
      var prevChar = j ? parts[j - 1].substr(-1) : '';
      if (prevChar !== '.' && m && m[0] === part) {
        // This part is a URL.
        var n = part.match(/[.,!)\]?']+$/);
        if (n) {
          // Move any trailing punctuation out of URL.
          part = part.substring(0, part.length - n[0].length);
          parts[j + 1] = n[0] + (parts[j + 1] || '');
        }
        var href = part;
        if (!/^https?:\/\//.test(href)) {
          href = 'http://' + href;
        }
        var link = isSvg ? document.createElementNS(CCC.Common.NS, 'a') :
            document.createElement('a');
        link.setAttribute('href', href);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.appendChild(document.createTextNode(part));
        newNode = link;
      } else {
        // This part is plain text.
        var newNode = document.createTextNode(part);
      }
      el.insertBefore(newNode, child);
    }
    el.removeChild(child);
  }
};

CCC.Common.autoHyperlink.urlRegex =
    /(\b(?:https?:\/\/|www\.)[-\w.~:\/?#\[\]@!$&'()*+,;=%]+)/i;

// Set background colour to differentiate server vs local copy.
if (location.hostname === 'localhost') {
  window.addEventListener('load', function() {
    document.body.style.backgroundColor = '#ffe';
  });
}
