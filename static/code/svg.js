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

var svgEditor = {};

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

  svgEditor.canvas = new $.SvgCanvas(container, config);
  svgEditor.resize();

  // Check to see if the parent window left us an initial source to render.
  var source = window.initialSource;
  if (source) {
    svgEditor.setString(source);
    window.initialSource = undefined;
  }
};

/**
 * Resize and reposition the SVG canvas when the window has changed shape.
 */
svgEditor.resize = function() {
  var top = 0;
  var left = 100;
  var height = window.innerHeight;
  var width = window.innerWidth - left;
  var container = document.getElementById('editorContainer');
  container.style.top = top + 'px';
  container.style.left = left + 'px';
  svgEditor.canvas.setResolution(width, height);
  svgEditor.canvas.updateCanvas(width, height);
};

/**
 * Inject SVG to the editor.
 * @param {string} xmlString SVG rendered as text.
 */
svgEditor.setString = function(xmlString) {
  svgEditor.canvas.setSvgString(xmlString);
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
  // Walk the tree removing IDs.
  var tw = document.createTreeWalker(contentSvg, NodeFilter.SHOW_ELEMENT);
  do {
    var node = tw.currentNode;
    node.removeAttribute('id');
  } while (tw.nextNode());

  var source = svgEditor.canvas.svgToString(contentSvg, -1);
  // Remove the wrapping <g>.
  source = source.replace(/^\s*<g[^>]*>\s*/i, '');
  source = source.replace(/\s*<\/g>\s*$/i, '');
  return source;
};

function fill(colour) {
  var selected = svgEditor.canvas.getSelectedElems();
  for (var i = 0, el; (el = selected[i]); i++) {
    el.setAttribute('fill', colour);
  }
}

window.addEventListener('load', svgEditor.init);
window.addEventListener('resize', svgEditor.resize);
