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
 * Create a command menu icon.
 * @param {!Element} node Root DOM element describing the menu commands.
 * @return {SVGSVGElement} Root element of icon.
 */
CCC.Common.newMenuIcon = function(node) {
  var cmdNodes = node.querySelectorAll('cmd');
  if (!cmdNodes.length) {
    return null;
  }
  var cmds = [];
  for (var i = 0, cmdNode; cmdNode = cmdNodes[i]; i++) {
    cmds.push(CCC.Common.innerText(cmdNode));
  }
  var svg = CCC.Common.createSvgElement('svg',
      {'class': 'menuIcon', 'data-cmds': JSON.stringify(cmds)});
  CCC.Common.createSvgElement('path', {'d': 'm 1,2 4,4 4,-4 z'}, svg);
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
  if (node.nodeType == 3) {
    text = node.data;
  } else if (node.nodeType == 1) {
    for (var i = 0; i < node.childNodes.length; i++) {
      text += CCC.Common.innerText(node.childNodes[i]);
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

/**
 * Helper method for creating SVG elements.
 * @param {string} name Element's tag name.
 * @param {!Object} attrs Dictionary of attribute names and values.
 * @param {Element} opt_parent Optional parent on which to append the element.
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
