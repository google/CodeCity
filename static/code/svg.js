/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview SVG Editor using SvgCanvas from SVG-Edit.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

import Canvas from './SVG-Edit/svgcanvas.js';

var svgEditor = {};
// Export namespace variable to window (would normally happen automatically,
// but this file is being loaded as a module).
// Used to for the parent frame to communicate with us.
window.svgEditor = svgEditor;

svgEditor.init = function() {
  var container = document.getElementById('editorContainer');
  var config = {
    initFill: {color: 'FFFFFF', opacity: 1},
    initStroke: {color: '000000', opacity: 1, width: 1},
    text: {stroke_width: 0, font_size: 24, font_family: 'serif'},
    initOpacity: 1,
    imgPath: 'SVG-Edit/images/',
    baseUnit: 'px',
  };

  svgEditor.canvas = new Canvas(container, config);

  // Check to see if the parent window left us an initial source to render.
  var source = window.initialSource;
  if (source !== undefined) {
    svgEditor.setString(source);
    delete window.initialSource;
  }
  svgEditor.resize();

  // Update the toolbox whenever a button is clicked.
  // Don't wait for up to a quarter second until the next scheduled call.
  // Also force a heavier update to catch changes such as open-close path.
  var update = svgEditor.updateToolbox.bind(svgEditor, true);
  for (var button of document.querySelectorAll('#toolbox button')) {
    button.addEventListener('click', update, false);
  }

  document.addEventListener('keydown', svgEditor.keypress);
  document.addEventListener('contextmenu', svgEditor.openMenu, false);
  document.addEventListener('mousedown', svgEditor.mousedown, false);
  document.getElementById('menu').addEventListener('click', svgEditor.menuClick);
  // Don't undo beyond initialization.
  svgEditor.canvas.undoMgr.resetUndoStack();
};

/**
 * Resize and reposition the SVG canvas when the window has changed shape.
 * Zoom so that a 100 unit tall image fills the screen.
 */
svgEditor.resize = function() {
  var top = 0;
  var left = 80;
  var height = window.innerHeight;
  var width = window.innerWidth - left;
  var container = document.getElementById('editorContainer');
  container.style.top = top + 'px';
  container.style.left = left + 'px';

  // Code City sprites are 100 units tall.
  var FIXED_HEIGHT = 100;
  var zoom = height / FIXED_HEIGHT;
  svgEditor.canvas.setZoom(zoom);
  svgEditor.canvas.setResolution(width / height * FIXED_HEIGHT, FIXED_HEIGHT);
  svgEditor.canvas.updateCanvas(width, height);
  // Recenter the origin to be the middle of the screen.
  svgEditor.canvas.getRootElem().setAttribute('viewBox',
      (-width / 2) + ' 0 ' + width + ' ' + height);
};

/**
 * Handle mouse down actions.
 */
svgEditor.mousedown = function(e) {
  // Control-clicking on Mac OS X is treated as a right-click.
  // WebKit on Mac OS X fails to change button to 2 (but Gecko does).
  if (e.ctrlKey || e.button === 2) {
    svgEditor.openMenu(e);
  } else if (!document.getElementById('menu').contains(e.target)) {
    svgEditor.closeMenu();
  }
};

/**
 * Handle keyboard commands.
 */
svgEditor.keypress = function(e) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    svgEditor.delete();
    e.preventDefault();
  } else if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') {
      if (e.shiftKey) {
        svgEditor.redo();
      } else {
        svgEditor.undo();
      }
      e.preventDefault();
    } else if (e.key === 'x') {
      svgEditor.cut();
      e.preventDefault();
    } else if (e.key === 'c') {
      svgEditor.copy();
      e.preventDefault();
    } else if (e.key === 'v') {
      svgEditor.paste();
      e.preventDefault();
    }
  }
};

/**
 * Redo one action.
 */
svgEditor.redo = function() {
  var undoMgr = svgEditor.canvas.undoMgr;
  if (undoMgr.getRedoStackSize() > 0) {
    undoMgr.redo();
  }
};

/**
 * Undo one action.
 */
svgEditor.undo = function() {
  var undoMgr = svgEditor.canvas.undoMgr;
  if (undoMgr.getUndoStackSize() > 0) {
    undoMgr.undo();
  }
};

/**
 * Cut selected element(s).
 */
svgEditor.cut = function() {
  svgEditor.copy();
  svgEditor.canvas.deleteSelectedElements();
};

/**
 * Copy selected element(s).
 */
svgEditor.copy = function() {
  svgEditor.canvas.copySelectedElements();
};

/**
 * Delete selected element(s).
 */
svgEditor.delete = function() {
  svgEditor.canvas.deleteSelectedElements();
};

/**
 * Paste clipboard to middle of editor.
 */
svgEditor.paste = function() {
  var svgCanvas = svgEditor.canvas;
  var workarea = document.getElementById('editorContainer');
  var zoom = svgCanvas.getZoom();
  var y = (workarea.scrollTop + workarea.offsetHeight / 2) / zoom - svgCanvas.contentH;
  svgCanvas.pasteElements('point', 0, -y);
};

/**
 * Inject SVG to the editor.
 * @param {string} xmlString SVG rendered as text.
 */
svgEditor.setString = function(xmlString) {
  // SvgCanvas needs contents wrapped in a throw-away SVG node.
  if (xmlString) {
    var svgString = '<svg xmlns="http://www.w3.org/2000/svg">' +
        xmlString + '</svg>';
    svgEditor.canvas.setSvgString(svgString);
  } else {
    svgEditor.canvas.clear();
  }
  svgEditor.resize();

  // Preserve the original input, alongside its round-tripped output.
  svgEditor.inputString = xmlString;
  svgEditor.outputString = svgEditor.getString();
};

svgEditor.inputString = undefined;
svgEditor.outputString = undefined;

/**
 * Extract the SVG from the editor.
 * @return {string} SVG rendered as text.
 */
svgEditor.getString = function() {
  var rootSvg = svgEditor.canvas.getContentElem();
  // The user's image is the wrapped in the first group.
  var contentSvg = rootSvg.querySelector('svg g').cloneNode(true);
  // Remove the layer title.
  var title = contentSvg.querySelector('g>title');
  title.parentNode.removeChild(title);
  // Walk the tree removing unused properties.
  var tw = document.createTreeWalker(contentSvg, NodeFilter.SHOW_ELEMENT);
  do {
    var node = tw.currentNode;
    node.removeAttribute('id');
    node.removeAttribute('fill');
    node.removeAttribute('stroke');
  } while (tw.nextNode());

  var source = svgEditor.canvas.svgToString(contentSvg, -1);
  // Remove the wrapping <g>.
  source = source.replace(/^\s*<g[^>]*>\s*/i, '');
  source = source.replace(/\s*<\/g>\s*$/i, '');

  // If the output is the same as the original input's round-tripped value,
  // then return the original input.
  // Otherwise changes may be claimed when none were made by the user.
  if (source === svgEditor.outputString) {
    return svgEditor.inputString;
  }
  return source;
};

/**
 * Update the toolbox visualization in response to the editor state.
 * This function is called four times a second, and when a button is clicked.
 * @param {boolean=} force If true, force a redraw.
 */
svgEditor.updateToolbox = function(force) {
  // Highlight the current mode button.
  var mode = svgEditor.canvas.getMode();
  if (force ||
      (mode !== 'resize' && mode !== 'rotate' &&
      mode !== svgEditor.updateToolbox.oldMode_)) {
    var stylePathEdit = document.getElementById('mode-pathedit').style;
    var styleSelect = document.getElementById('mode-select').style;
    var styleNodeActions = document.getElementById('node-actions').style;
    if (mode === 'pathedit') {
      styleSelect.display = 'none';
      stylePathEdit.display = 'block';
      styleNodeActions.display = 'block';
      // Show or hide the appropriate open/close path button.
      var styleCloseAction = document.getElementById('close-action').style;
      var styleOpenAction = document.getElementById('open-action').style;
      if (svgEditor.canvas.pathActions.closed_subpath) {
        styleCloseAction.display = 'none';
        styleOpenAction.display = 'block';
      } else {
        styleOpenAction.display = 'none';
        styleCloseAction.display = 'block';
      }
    } else {
      stylePathEdit.display = 'none';
      styleSelect.display = 'block';
      styleNodeActions.display = 'none';
    }
    var button = document.getElementById('mode-' +
                                         svgEditor.updateToolbox.oldMode_);
    if (button) {
      button.classList.remove('selected');
    }
    svgEditor.updateToolbox.oldMode_ = mode;
    button = document.getElementById('mode-' + mode);
    if (button) {
      button.classList.add('selected');
    }
  }

  // Show or hide action buttons that apply to one or more selected elements.
  var selected = svgEditor.canvas.getSelectedElems();
  if (selected.length !== svgEditor.updateToolbox.oldSelectedCount_) {
    var actions = document.getElementById('selected-actions');
    var singleActions = document.getElementById('selected-single-actions');
    actions.style.display = selected.length > 0 ? 'block' : 'none';
    singleActions.style.display = selected.length === 1 ? 'block' : 'none';
    svgEditor.updateToolbox.oldSelectedCount_ = selected.length;
    document.getElementById('menuCut').classList
        .toggle('menuItemDisabled', selected.length === 0);
    document.getElementById('menuCopy').classList
        .toggle('menuItemDisabled', selected.length === 0);
    document.getElementById('menuDelete').classList
        .toggle('menuItemDisabled', selected.length === 0);
  }
  if (selected.length === 1) {
    var element = selected[0];
    document.getElementById('convertpath-action').style.display =
        element.tagName === 'path' ? 'none' : 'block';

    var fillStroke = svgEditor.getFillStroke(element);
    var fill = fillStroke[0];
    var stroke = fillStroke[1];

    var fillRect = document.getElementById('fillRect');
    var fillNoneStyle = document.getElementById('fillNone').style;
    if (fill === 'fillNone') {
      fillNoneStyle.display = 'inline';
      fillRect.setAttribute('class', 'fillWhite');
    } else {
      fillNoneStyle.display = 'none';
      fillRect.setAttribute('class', fill);
    }

    var strokeRect = document.getElementById('strokeRect');
    if (stroke === 'strokeNone') {
      strokeRect.setAttribute('stroke-width', '1');
      strokeRect.setAttribute('stroke', '#d40000');
      strokeRect.setAttribute('class', '');
    } else {
      strokeRect.setAttribute('stroke-width', '4');
      strokeRect.setAttribute('stroke', '');
      strokeRect.setAttribute('class', stroke);
    }
  }
};

svgEditor.updateToolbox.oldMode_ = '';
svgEditor.updateToolbox.oldSelectedCount_ = NaN;

/**
 * Find the fill and stroke for an element.
 * @param {!Element} element Element with style.
 * @return {!Array<string>} Array with normalized fill and stroke strings.
 */
svgEditor.getFillStroke = function(element) {
  if (!element) throw new TypeError('Element not provided');
  var classes = element.getAttribute('class') || '';
  classes = classes.replace(/Gray/g, 'Grey');
  var fill = classes.match(/\b(fill(None|White|Black|Grey))\b/);
  fill = fill ? fill[1] : 'fillNone';
  var stroke = classes.match(/\b(stroke(None|White|Black|Grey))\b/);
  stroke = stroke ? stroke[1] : 'strokeBlack';
  return [fill, stroke];
};

/**
 * Rotate the fill in the currently selected object between allowed options.
 */
svgEditor.changeFill = function() {
  var element = svgEditor.canvas.getSelectedElems()[0];
  var fill = svgEditor.getFillStroke(element)[0];
  var fillOptions = ['fillNone', 'fillBlack', 'fillGrey', 'fillWhite'];
  var fillIndex = Math.max(fillOptions.indexOf(fill), 0);
  fillIndex++;
  fillIndex %= fillOptions.length;
  var classes = element.getAttribute('class') || '';
  classes = classes.replace(/\bfill\w+\b/g, '');
  classes += ' ' + fillOptions[fillIndex];
  classes = classes.replace(/\s+/g, ' ').trim();
  element.setAttribute('class', classes);
};

/**
 * Rotate the stroke in the currently selected object between allowed options.
 */
svgEditor.changeStroke = function() {
  var element = svgEditor.canvas.getSelectedElems()[0];
  var stroke = svgEditor.getFillStroke(element)[1];
  var strokeOptions = ['strokeBlack', 'strokeGrey', 'strokeWhite', 'strokeNone'];
  var strokeIndex = Math.max(strokeOptions.indexOf(stroke), 0);
  strokeIndex++;
  strokeIndex %= strokeOptions.length;
  var classes = element.getAttribute('class') || '';
  classes = classes.replace(/\bstroke\w+\b/g, '');
  classes += ' ' + strokeOptions[strokeIndex];
  classes = classes.replace(/\s+/g, ' ').trim();
  element.setAttribute('class', classes);
};

/**
 * Open the context menu command menu at the mouse location.
 * @param {!Event} e Mouse event.
 */
svgEditor.openMenu = function(e) {
  svgEditor.closeMenu();
  var menu = document.getElementById('menu');
  var pageHeight = window.innerHeight;
  var pageWidth = window.innerWidth;
  var top = e.y;
  var left = e.x;
  menu.style.display = 'block';
  // Don't go off the bottom of the page (hug the bottom).
  if (top + menu.offsetHeight > pageHeight) {
    top = Math.max(pageHeight - menu.offsetHeight, 0);
  }
  // Don't go off the right of the page (flip menu).
  if (left + menu.offsetWidth > pageWidth) {
    left = Math.max(left - menu.offsetWidth, 0);
  }
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
  // Don't open the system context menu.
  e.preventDefault();
};

/**
 * If there is a menu open, close it.
 */
svgEditor.closeMenu = function() {
  document.getElementById('menu').style.display = 'none';
};

/**
 * Handle mouse clicking on a context menu option.
 * @param {!Event} e Mouse event.
 */
svgEditor.menuClick = function(e) {
  if (!e.target.classList.contains('menuItemDisabled')) {
    switch (e.target.id) {
      case 'menuCut':
        svgEditor.cut();
        break;
      case 'menuCopy':
        svgEditor.copy();
        break;
      case 'menuPaste':
        svgEditor.paste();
        break;
      case 'menuDelete':
        svgEditor.delete();
        break;
    }
  }
  svgEditor.closeMenu();
};

window.addEventListener('load', svgEditor.init);
window.addEventListener('resize', svgEditor.resize);
window.addEventListener('mousedown', window.focus);
setInterval(svgEditor.updateToolbox, 250);
