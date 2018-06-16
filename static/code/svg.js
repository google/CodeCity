/**
 * @license
 * Code City: SVG Editor.
 *
 * Copyright 2018 Google Inc.
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
  if (source) {
    svgEditor.setString(source);
    window.initialSource = undefined;
  }
  svgEditor.resize();

  // Update the toolbox whenever a button is clicked.
  var buttons = document.querySelectorAll('#toolbox button');
  var update = svgEditor.updateToolbox.bind(svgEditor, true);
  for (var i = 0, button; (button = buttons[i]); i++) {
    button.addEventListener('click', update, false);
  }
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
};

/**
 * Inject SVG to the editor.
 * @param {string} xmlString SVG rendered as text.
 */
svgEditor.setString = function(xmlString) {
  svgEditor.canvas.setSvgString(xmlString);
  svgEditor.resize();
};

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
  return source;
};

/**
 * Update the toolbox visualization in response to the editor state.
 * This function polls the editor state four times a second.
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
  }
  if (selected.length === 1) {
    var element = selected[0];
    document.getElementById('convertpath-action').style.display =
        element.tagName == 'path' ? 'none' : 'block';

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
svgEditor.updateToolbox.oldSelectedCount_ = 0;

/**
 * Find the fill and stroke for an element.
 * @param {!Element} element Element with style.
 * @return {!Array<string>} Array with normalized fill and stroke strings.
 */
svgEditor.getFillStroke = function(element) {
  if (!element) throw TypeError('Element not provided');
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

window.addEventListener('load', svgEditor.init);
window.addEventListener('resize', svgEditor.resize);
setInterval(svgEditor.updateToolbox, 250);
