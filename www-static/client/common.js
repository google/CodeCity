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
 * @fileoverview Functions common across frames of Code City's client.
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
 * Initialization code called on startup.
 */
CCC.Common.init = function() {
  CCC.Common.parser = new DOMParser();
  CCC.Common.serializer = new XMLSerializer();
  document.body.addEventListener('click', CCC.Common.closeMenu, true);

  // Report back to the parent frame that we're fully loaded and ready to go.
  parent.postMessage('init', location.origin);
};

/**
 * Verify that a received message is from our parent frame.
 * @param {!Event} e Incoming message event.
 */
CCC.Common.verifyMessage = function(e) {
  var origin = e.origin || e.originalEvent.origin;
  if (origin != location.origin) {
    console.error('Message received by frame from unknown origin: ' +
                  origin);
    return null;
  }
  return e.data;
};

/**
 * Gets the message with the given key from the document.
 * @param {string} key The key of the document element.
 * @param {...string} var_args Optional substitutions for %1, %2, ...
 * @return {string} The textContent of the specified element.
 */
CCC.Common.getMsg = function(key, var_args) {
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

/**
 * Create a command menu icon.
 * @param {!Element} node Root DOM element describing the menu commands.
 * @return {SVGSVGElement} Root element of icon.
 */
CCC.Common.newMenuIcon = function(node) {
  var cmdNodes = node.querySelectorAll('CMD');
  if (!cmdNodes.length) {
    return null;
  }
  var cmds = [];
  for (var i = 0, cmdNode; cmdNode = cmdNodes[i]; i++) {
    cmds.push(cmdNode.innerText);
  }
  var svg = document.createElementNS(CCC.Common.NS, 'svg');
  svg.setAttribute('class', 'menuIcon');
  svg.setAttribute('data-cmds', JSON.stringify(cmds));
  var path = document.createElementNS(CCC.Common.NS, 'path');
  path.setAttribute('d', 'm 1,2 4,4 4,-4 z');
  svg.appendChild(path);
  return svg;
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
  for (var i = 0; i < cmds.length; i++) {
    var menuItem = document.createElement('div');
    menuItem.className = 'menuitem';
    menuItem.appendChild(document.createTextNode(cmds[i]));
    menuItem.addEventListener('click', CCC.Common.commandFunction, false);
    menu.appendChild(menuItem);
  }
  var scrollDiv = document.getElementById('scrollDiv');
  var pageHeight = scrollDiv.scrollHeight;
  var pageWidth = scrollDiv.scrollWidth;
  scrollDiv.appendChild(menu);
  var iconRect = this.getBoundingClientRect();
  // Calculate preferred location of below and right of icon.
  var top = iconRect.top + scrollDiv.scrollTop + iconRect.height;
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
  }
  parent.focus();
};

/**
 * When clicked, execute the printed command.
 * @this {!Element} Clicked element.
 */
CCC.Common.commandFunction = function() {
  parent.postMessage({'commands': [this.innerText]}, location.origin);
  parent.focus();
};
