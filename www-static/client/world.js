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
 * @fileoverview World frame of Code City's client.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

CCC.World = {};


/**
 * Maximum number of messages saved in history.
 */
CCC.World.maxHistorySize = 10000;

/**
 * Messages in the history panels.
 */
CCC.World.historyMessages = [];

/**
 * Messages in the panorama panel.
 */
CCC.World.panoramaMessages = [];

/**
 * Height of history panels.
 * @constant
 */
CCC.World.panelHeight = 256;

/**
 * Width of planned history panels.
 */
CCC.World.panelWidths = [];

/**
 * Width of panel borders (must match CSS).
 * @constant
 */
CCC.World.panelBorder = 2;

/**
 * Div containing a partial row of history panels (null if new row needed).
 * @type Element
 */
CCC.World.historyRow = null;

/**
 * Data from the last room seen (background, users, contents).
 * @type Object
 */
CCC.World.latestRoom = null;

/**
 * PID of rate-limiter for resize events.
 */
CCC.World.resizePid = 0;

/**
 * The last recorded screen width.  Used to determine if a resize event resulted
 * in a change of width.
 */
CCC.World.lastWidth = NaN;

/**
 * SVG scratchpad for rendering potential history panels.
 * @type {Element}
 */
CCC.World.scratchHistory = null;

/**
 * SVG scratchpad for rendering potential panorama panels.
 * @type {Element}
 */
CCC.World.scratchPanorama = null;

/**
 * Width of a scrollbar.  Computed once at startup.
 */
CCC.World.scrollBarWidth = NaN;

/**
 * Record of the current scene.
 * @type {Element}
 */
CCC.World.scene = null;

/**
 * Initialization code called on startup.
 */
CCC.World.init = function() {
  CCC.Common.init();
  CCC.World.scrollDiv = document.getElementById('scrollDiv');
  CCC.World.panoramaDiv = document.getElementById('panoramaDiv');
  CCC.World.scrollBarWidth = CCC.World.getScrollBarWidth();
  CCC.World.scene = document.createElement('scene');  // Blank scene.
  delete CCC.World.getScrollBarWidth;  // Free memory.

  window.addEventListener('resize', CCC.World.resizeSoon, false);
};

/**
 * Receive messages from our parent frame.
 * @param {!Event} e Incoming message event.
 */
CCC.World.receiveMessage = function(e) {
  var data = CCC.Common.verifyMessage(e);
  if (!data) {
    return;
  }
  var mode = data['mode'];
  var text = data['text'];
  if (mode == 'clear') {
    document.getElementById('iframeStorage').innerHTML = '';
    CCC.World.historyMessages.length = 0;
    CCC.World.panoramaMessages.length = 0;
    CCC.World.removeNode(CCC.World.scratchHistory);
    CCC.World.removeNode(CCC.World.scratchPanorama);
    var scene = CCC.World.scene;  // Save the scene.
    CCC.World.renderHistory();
    CCC.World.scene = scene;  // Restore the scene.
  } else if (mode == 'blur') {
      CCC.Common.closeMenu();
  } else if (mode == 'message') {
    var dom = CCC.Common.parser.parseFromString(text, 'text/xml');
    if (dom.getElementsByTagName('parsererror').length) {
      // Not valid XML, treat as string literal.
      dom = document.implementation.createDocument(null, 'text');
      dom.firstChild.appendChild(document.createTextNode(text));
    }
    CCC.World.preprocessXml(dom);
    for (var i = 0, msg; msg = dom.childNodes[i]; i++) {
      CCC.World.renderMessage(msg);
    }
  }
};

/**
 * Parse the XML and deal with any chunks that need one-time processing.
 * @param {!Element} dom XML tree.
 */
CCC.World.preprocessXml = function(dom) {
  // Find all stringified SVG nodes and replace them with actual SVG nodes.
  var svgTextNodes = dom.getElementsByTagName('svgtext');
  for (var i = svgTextNodes.length - 1; i >= 0; i--) {
    var svgTextNode = svgTextNodes[i];
    var svgNode = CCC.World.stringToSvg(svgTextNode.textContent);
    if (svgNode) {
      var container = document.createElement('svgdom');
      container.appendChild(svgNode);
      svgTextNode.parentNode.replaceChild(container, svgTextNode);
    } else {  // Syntax error in SVG.
      svgTextNode.parentNode.removeChild(svgTextNode);
    }
  }

  // Find all stringified HTML nodes and replace them with actual HTML nodes.
  var htmlTextNodes = dom.getElementsByTagName('htmltext');
  for (var i = htmlTextNodes.length - 1; i >= 0; i--) {
    var htmlTextNode = htmlTextNodes[i];
    var htmlNode = CCC.World.stringToHtml(htmlTextNode.textContent);
    if (htmlNode) {
      var container = document.createElement('htmldom');
      container.appendChild(htmlNode);
      htmlTextNode.parentNode.replaceChild(container, htmlTextNode);
    } else {  // Syntax error in HTML.
      htmlTextNode.parentNode.removeChild(htmlTextNode);
    }
  }

  // Find top-level nodes that need processing.
  for (var i = 0, msg; msg = dom.childNodes[i]; i++) {
    if (msg.tagName == 'iframe') {
      // <iframe src="https://neil.fraser.name/">Neil Fraser</iframe>
      // It's an iframe, create the DOM element.
      msg.iframe = CCC.World.createIframe(msg);
    }
  }
};

/**
 * Render a message to the panorama panel, optionally triggering a history push.
 * @param {string|!Element} msg Message to render.
 */
CCC.World.renderMessage = function(msg) {
  if (!CCC.World.panelWidths.length) {
    CCC.World.panelWidths = CCC.World.rowWidths();
  }

  var backupScratchHistory = CCC.World.scratchHistory;
  if (CCC.World.prerenderHistory(msg) && CCC.World.prerenderPanorama(msg)) {
    // Rendering successful in both panorama and pending history panel.
    CCC.World.panoramaMessages.push(msg);
    CCC.World.publishPanorama();
    CCC.World.removeNode(backupScratchHistory);
  } else {
    // Failure to render.  Revert to previous state.
    CCC.World.removeNode(CCC.World.scratchHistory);
    CCC.World.removeNode(CCC.World.scratchPanorama);
    CCC.World.scratchHistory = backupScratchHistory;
    // Publish one panel to the history.
    CCC.World.publishHistory();
    // Try again.
    CCC.World.renderMessage(msg);
  }
};

/**
 * Experimentally render a new message onto the most recent history frame.
 * @param {!Element} msg Message to render.
 * @return {boolean} True if the message fit.  False if overflow.
 */
CCC.World.prerenderHistory = function(msg) {
  // For now every message needs its own frame.
  if (CCC.World.panoramaMessages.length) {
    return false;
  }
  var svg = CCC.World.createHiddenSvg(CCC.World.panelWidths[0],
                                      CCC.World.panelHeight);
  if (msg.tagName == 'iframe') {
    // Create relaunch button if iframe is closed.
    svg.style.backgroundColor = '#696969';
    var g = CCC.Common.createSvgElement('g',
        {'class': 'iframeRelaunch', 'transform': 'translate(0, 50)'}, svg);
    // Add relaunch button.
    var rect = document.createElementNS(CCC.Common.NS, 'rect');
    var text = document.createElementNS(CCC.Common.NS, 'text');
    text.appendChild(document.createTextNode(
        CCC.World.getMsg('relaunchIframeMsg')));
    g.appendChild(rect);
    g.appendChild(text);
    g.addEventListener('click', function() {
      msg.iframe = CCC.World.createIframe(msg);
      var div = svg.parentNode;
      CCC.World.positionIframe(msg.iframe, div);
      div.firstChild.style.visibility = 'hidden';  // SVG.
      div.lastChild.style.display = 'inline';  // Close button.
    }, false);
    // Size the rectangle to match the text size.
    var bBox = text.getBBox();
    var r = Math.min(bBox.height, bBox.width) / 2;
    rect.setAttribute('height', bBox.height);
    rect.setAttribute('width', bBox.width + 2 * r);
    rect.setAttribute('x', bBox.x - r);
    rect.setAttribute('y', bBox.y);
    rect.setAttribute('rx', r);
    rect.setAttribute('ry', r);
    CCC.World.scratchHistory = svg;
    return true;
  }

  if (msg.tagName == 'htmldom') {
    var div = CCC.World.createHiddenDiv();
    CCC.World.cloneAndAppend(div, msg.firstChild);
    // Strip all command links and menus.
    var menus = div.querySelectorAll('svg.menuIcon');
    for (var i = 0, menu; menu = menus[i]; i++) {
      menu.parentNode.removeChild(menu);
    }
    var commands = div.querySelectorAll('a.command');
    for (var i = 0, command; command = commands[i]; i++) {
      command.className = '';
    }
    CCC.World.scratchHistory = div;
    return true;
  }

  if (msg.tagName == 'scene') {
    // <scene user="Max" room="The Hangout">
    //   <description>The lights are dim and blah blah blah...</description>
    //   <svgdom>...</svgdom>
    //   <object name="a clock">
    //     <svgdom>...</svgdom>
    //     <cmds><cmd>look clock</cmd></cmds>
    //   </object>
    //   <user name="Max">
    //     <svgdom>...</svgdom>
    //     <cmds><cmd>look Max</cmd></cmds>
    //   </user>
    // </scene>
    if (msg.getAttribute('user')) {
      // This is the user's current location.  Save this environment data.
      CCC.World.scene = msg;
    }
  }

  // Add scene background.
  var svgdom = CCC.World.scene.querySelector('scene>svgdom');
  if (svgdom) {
    CCC.World.cloneAndAppend(svg, svgdom.firstChild);
  }
  var text = document.createElementNS(CCC.Common.NS, 'text');
  text.appendChild(document.createTextNode(msg));
  text.setAttribute('x', 10);
  text.setAttribute('y', 50);
  svg.appendChild(text);
  CCC.World.scratchHistory = svg;
  return true;
};

/**
 * Experimentally render a new message onto the panorama frame.
 * @param {!Element} node Message to render.
 * @return {boolean} True if the message fit.  False if overflow.
 */
CCC.World.prerenderPanorama = function(node) {
  // For now every message needs its own frame.
  if (CCC.World.panoramaMessages.length) {
    return false;
  }
  var svg = CCC.World.createHiddenSvg(CCC.World.panoramaDiv.offsetWidth,
                                      CCC.World.panoramaDiv.offsetHeight);
  if (node.tagName == 'iframe') {
    CCC.World.scratchPanorama = svg;
    return true;
  }
  if (node.tagName == 'htmldom') {
    var div = CCC.World.createHiddenDiv();
    CCC.World.cloneAndAppend(div, node.firstChild);
    CCC.World.scratchPanorama = div;
    return true;
  }

  // Add scene background.
  var svgdom = CCC.World.scene.querySelector('scene>svgdom');
  if (svgdom) {
    var g = CCC.Common.createSvgElement('g',
        {'class': 'sceneBackground'}, svg);
    CCC.World.cloneAndAppend(g, svgdom.firstChild);
  }
  // Obtain an ordered list of contents.
  var contentsArray =
      CCC.World.scene.querySelectorAll('scene>user,scene>object');
  var userTotal = CCC.World.scene.querySelectorAll('scene>user').length;
  CCC.World.sceneUserLocations = Object.create(null);
  CCC.World.sceneObjectLocations = Object.create(null);
  // Draw each item.
  var icons = [];
  var userCount = 0;
  for (var i = 0, thing; thing = contentsArray[i]; i++) {
    var cursorX = (i + 1) / (contentsArray.length + 1) * svg.scaledWidth_ -
        svg.scaledWidth_ / 2;
    var bBox = null;
    var isUser = thing.tagName == 'user';
    var svgDom = thing.querySelector('*>svgdom');
    if (svgDom && svgDom.firstChild) {
      var name = thing.getAttribute('name');
      var g = CCC.Common.createSvgElement('g', {'class': thing.tagName}, svg);
      var title = CCC.Common.createSvgElement('title', {}, g);
      title.appendChild(document.createTextNode(name));
      g.setAttribute('filter', 'url(#' + svg.whiteShadowId_ + ')');
      CCC.World.cloneAndAppend(g, svgDom.firstChild);
      // Users should face the majority of other users.
      // If user is alone, should face majority of objects.
      if (isUser && (userTotal == 1 ?
          (i > 0 && i >= Math.floor(contentsArray.length / 2)) :
          (userCount > 0 && userCount >= Math.floor(userTotal / 2)))) {
        // Wrap mirrored users in an extra group.
        var g2 = CCC.Common.createSvgElement('g', {}, svg);
        g.setAttribute('transform', 'scale(-1,1)');
        g2.appendChild(g);
        g = g2;
      }
      // Move the sprite into position.
      bBox = g.getBBox();
      var dx = cursorX - bBox.x - (bBox.width / 2);
      g.setAttribute('transform', 'translate(' + dx + ', 0)');
      g.setAttribute('filter', 'url(#' + svg.whiteShadowId_ + ')');
      // Record location of each user for positioning of speech bubbles.
      var radius = Math.min(bBox.height, bBox.width) / 2;
      var location = {
        headX: cursorX,
        headY: bBox.y + radius,
        headR: radius
      };
      if (isUser) {
        CCC.World.sceneUserLocations[name] = location;
      } else {
        CCC.World.sceneObjectLocations[name] = location;
      }
    }
    var cmds = thing.querySelector('*>cmds');
    if (cmds) {
      var iconSize = 6;
      var x = cursorX - iconSize / 2;
      var y = isUser ? 40 : 60;
      if (bBox) {
        // Align menu icon with top-right corner of user's sprite.
        x = Math.min(cursorX + bBox.width / 2,
                     svg.scaledWidth_ / 2 - iconSize);
        y = Math.max(0, bBox.y);
      }
      var icon = CCC.Common.newMenuIcon(cmds);
      icon.setAttribute('width', iconSize);
      icon.setAttribute('height', iconSize);
      icon.setAttribute('viewBox', '0 0 10 10');
      icon.setAttribute('x', x);
      icon.setAttribute('y', y);
      icons.push(icon);
    }
    if (isUser) {
      userCount++;
    }
  }
  // Menu icons should be added after all the sprites so that they aren't
  // occluded by user content.
  for (var i = 0, icon; icon = icons[i]; i++) {
    svg.appendChild(icon);
  }

  if (node.tagName == 'say' || node.tagName == 'think' ||
      node.tagName == 'text') {
    CCC.World.createBubble(node, svg);
  }
  CCC.World.scratchPanorama = svg;
  return true;
};

/**
 * Write text in a bubble.
 * @param {!Element} node Message to render.
 * @param {!SVGElement} svg SVG Element to place the text and bubble.
 */
CCC.World.createBubble = function(node, svg) {
  // <say>Welcome</say>
  // <say user="Max" room="The Hangout">Hello world.</say>
  // <say object="Cat" room="The Hangout">Meow.</say>
  // <think>Don't be evil.</think>
  // <think user="Max" room="The Hangout">I'm hungry.</think>
  // <think object="Cat" room="The Hangout">I'm evil.</think>
  // <text>Command not recognized.</text>
  // <text user="Max" room="The Hangout">Max sneezes.</text>
  // <text object="Cat" room="The Hangout">The cat meows.</text>
  var user = node.getAttribute('user');
  var object = node.getAttribute('object');
  var text = node.textContent || '';
  var width = node.tagName == 'text' ? 150 : 100;
  var textGroup = CCC.World.createTextArea(svg, text, width, 30);
  textGroup.setAttribute('class', node.tagName);
  var bubbleGroup = CCC.Common.createSvgElement('g',
      {'class': 'bubble'}, svg);
  var titleName = user || object;
  if (titleName) {
    var title = CCC.Common.createSvgElement('title', {}, bubbleGroup);
    title.appendChild(document.createTextNode(titleName));
    var title = CCC.Common.createSvgElement('title', {}, textGroup);
    title.appendChild(document.createTextNode(titleName));
  }
  svg.appendChild(textGroup);
  var textBBox = textGroup.getBBox();
  var anchor;
  try {
    anchor =
        CCC.World.scene.getAttribute('room') == node.getAttribute('room') &&
        (CCC.World.sceneUserLocations[user] ||
         CCC.World.sceneObjectLocations[object]);
  } catch (e) {
    // Not a match.  Simpler to try/catch than to check every step.
  }
  // Align the text above the user.
  var cursorX = anchor ? anchor.headX : 0;
  // Don't overflow the right edge.
  cursorX = Math.min(cursorX, svg.scaledWidth_ / 2 - textBBox.width / 2 - 1);
  // Don't overflow the left edge.
  cursorX = Math.max(cursorX, textBBox.width / 2 - svg.scaledWidth_ / 2 + 1);
  cursorX -= textBBox.x + textBBox.width / 2;
  textGroup.setAttribute('transform', 'translate(' + cursorX + ', 2)');
  CCC.World.drawBubble(node.tagName, bubbleGroup, textGroup, anchor);
};

/**
 * Draw a bubble around some content.
 * @param {!string} type Type of bubble: 'say' or 'text'.
 * @param {!SVGElement} bubbleGroup Empty group to render the bubble in.
 * @param {!SVGElement} contentGroup Group to surround.
 * @param {Object} opt_anchor Optional anchor location for arrow tip.
 */
CCC.World.drawBubble = function(type, bubbleGroup, contentGroup, opt_anchor) {
  // Find coordinates of the contents.
  var contentBBox = contentGroup.getBBox();
  // getBBox doesn't look at contentGroup's transform="translate(...)".
  var transform = contentGroup.getAttribute('transform');
  var r = transform && transform.match(
      /translate\(\s*([-+\d.e]+)([ ,]\s*([-+\d.e]+)\s*\))?/);
  if (r) {
    contentBBox.x += parseFloat(r[1]);
    if (r[3]) {
      contentBBox.y += parseFloat(r[3]);
    }
  }
  // Draw a solid black bubble, then the arrow (with border), then a slightly
  // smaller solid white bubble, resulting in a clean border.
  if (type == 'think') {
    var strokeWidth = 0.7;  // Matches with CSS.
    var radiusXAverage = 4;  // Target size of cloud puffs.
    var radiusYAverage = 3;  // Target size of cloud puffs.
    var radiusVariation = 0.5;  // Cloud puffs can be + or - this amount.
    var inflateRadius = 1;  // Expand the radii a bit to make less jagged.
    // Pick a radius that's within the standard variation.
    var randomRadius = function(r) {
      return r + (Math.random() - 0.5) * radiusVariation * 2;
    };
    // Create a horizontal or vertical line of puff descriptors.
    var puffLine = function(x, y, dx, dy) {
      var d = Math.max(dx, dy);
      var radiusAverage = d == dx ? radiusXAverage : radiusYAverage;
      var line = new Array(Math.round(d / radiusAverage / 2));
      radiusAverage = d / line.length / 2;
      for (var i = 0; i < line.length - 1; i += 2) {
        line[i] = randomRadius(radiusAverage);
        line[i + 1] = radiusAverage * 2 - line[i];
      }
      if (line[line.length - 1] === undefined) {
        // There was an odd number of puffs.  Add the remaining orphan.
        line[line.length - 1] = radiusAverage;
      }
      CCC.World.shuffle(line);
      var cursor = (d == dx) ? x : y;
      for (var i = 0; i < line.length; i++) {
        var r = line[i];
        var puff;
        if (d == dx) {
          puff = {
            rx: r,
            ry: randomRadius(radiusYAverage),
            cx: cursor + r,
            cy: y
          };
          cursor += puff.rx * 2;
        } else {
          puff = {
            rx: randomRadius(radiusXAverage),
            ry: r,
            cx: x,
            cy: cursor + r
          };
          cursor += puff.ry * 2;
        }
        line[i] = puff;
      }
      return line;
    };

    var puffs = [];
    // Top edge.
    puffs = puffs.concat(puffLine(inflateRadius, inflateRadius,
        contentBBox.width - 2 * inflateRadius, 0));
    // Right edge.
    puffs = puffs.concat(puffLine(contentBBox.width - inflateRadius,
        inflateRadius, 0, contentBBox.height - 2 * inflateRadius));
    // Bottom edge.
    puffs = puffs.concat(puffLine(inflateRadius, contentBBox.height -
        inflateRadius, contentBBox.width - 2 * inflateRadius, 0));
    // Left edge.
    puffs = puffs.concat(puffLine(inflateRadius, inflateRadius, 0,
        contentBBox.height - 2 * inflateRadius));
    if (!puffs.length) {
      // Empty thought bubble.  Add one puff.
      puffs[0] = {rx: radiusXAverage, ry: radiusYAverage, cx: 0, cy: 0};
    }
    if (contentBBox.height > 2 * inflateRadius &&
        contentBBox.width > 2 * inflateRadius) {
      CCC.Common.createSvgElement('rect',
          {'class': 'bubbleBG',
           'x': inflateRadius - strokeWidth, 'y': inflateRadius - strokeWidth,
           'height': contentBBox.height + 2 * strokeWidth - 2 * inflateRadius,
           'width': contentBBox.width + 2 * strokeWidth - 2 * inflateRadius},
           bubbleGroup);
    }
    for (var i = 0; i < puffs.length; i++) {
      var puff = puffs[i];
      CCC.Common.createSvgElement('ellipse',
          {'class': 'bubbleBG',
           'cx': puff.cx, 'cy': puff.cy,
           'rx': puff.rx + inflateRadius + strokeWidth,
           'ry': puff.ry + inflateRadius + strokeWidth},
           bubbleGroup);
    }
    if (opt_anchor) {
      bubbleGroup.appendChild(
          CCC.World.drawThoughtArrow_(contentBBox, opt_anchor));
    }
    if (contentBBox.height > 2 * inflateRadius &&
        contentBBox.width > 2 * inflateRadius) {
      CCC.Common.createSvgElement('rect',
          {'class': 'bubbleFG',
           'x': inflateRadius, 'y': inflateRadius,
           'height': contentBBox.height - 2 * inflateRadius,
           'width': contentBBox.width - 2 * inflateRadius},
           bubbleGroup);
    }
    for (var i = 0; i < puffs.length; i++) {
      var puff = puffs[i];
      CCC.Common.createSvgElement('ellipse',
          {'class': 'bubbleFG',
           'cx': puff.cx, 'cy': puff.cy,
           'rx': puff.rx + inflateRadius, 'ry': puff.ry + inflateRadius},
           bubbleGroup);
    }
  } else {
    if (type == 'say') {
      var strokeWidth = 0.7;  // Matches with CSS.
      var marginV = 2;
      var marginH = 6;
      var radius = 15;
    } else {
      var strokeWidth = 0.4;
      var marginV = 1;
      var marginH = 2;
      var radius = 0.5;
    }
    CCC.Common.createSvgElement('rect',
        {'class': 'bubbleBG',
         'x': -marginH - strokeWidth, 'y': -marginV - strokeWidth,
         'rx': radius + strokeWidth, 'ry': radius + strokeWidth,
         'height': contentBBox.height + 2 * (marginV + strokeWidth),
         'width': contentBBox.width + 2 * (marginH + strokeWidth)},
         bubbleGroup);
    if (opt_anchor) {
      bubbleGroup.appendChild(CCC.World.drawArrow_(contentBBox, opt_anchor));
    }
    CCC.Common.createSvgElement('rect',
        {'class': 'bubbleFG',
         'x': -marginH, 'y': -marginV,
         'rx': radius, 'ry': radius,
         'height': contentBBox.height + 2 * marginV,
         'width': contentBBox.width + 2 * marginH},
         bubbleGroup);
  }
  bubbleGroup.setAttribute('transform', 'translate(' + contentBBox.x +
      ', ' + contentBBox.y + ')');
};

/**
 * Draw the arrow between the bubble and the origin.
 * @param {!Object} contentBBox Dimensions of the bubble's contents.
 * @param {!Object} anchor Anchor location for arrow tip.
 * @return {!Element} Path for arrow.
 * @private
 */
CCC.World.drawArrow_ = function(contentBBox, anchor) {
  var steps = [];
  // Find the relative coordinates of the center of the bubble.
  var relBubbleX = contentBBox.width / 2;
  var relBubbleY = contentBBox.height / 2;
  // Find the relative coordinates of the center of the anchor.
  var relAnchorX = anchor.headX - contentBBox.x;
  var relAnchorY = anchor.headY - contentBBox.y;
  if (relBubbleX == relAnchorX && relBubbleY == relAnchorY) {
    // Null case.  Bubble is directly on top of the anchor.
    // Short circuit this rather than wade through divide by zeros.
    steps.push('M ' + relBubbleX + ',' + relBubbleY);
  } else {
    // Compute the angle of the arrow's line.
    var rise = relAnchorY - relBubbleY;
    var run = relAnchorX - relBubbleX;
    var hypotenuse = Math.sqrt(rise * rise + run * run);
    var angle = Math.acos(run / hypotenuse);
    if (rise < 0) {
      angle = 2 * Math.PI - angle;
    }
    // Compute a line perpendicular to the arrow.
    var rightAngle = angle + Math.PI / 2;
    if (rightAngle > Math.PI * 2) {
      rightAngle -= Math.PI * 2;
    }
    var rightRise = Math.sin(rightAngle);
    var rightRun = Math.cos(rightAngle);

    // Calculate the thickness of the base of the arrow.
    var thickness = (contentBBox.width + contentBBox.height) /
                    CCC.World.ARROW_THICKNESS;
    thickness = Math.min(thickness, contentBBox.width, contentBBox.height) / 4;

    // Back the tip of the arrow off of the anchor.
    var backoffRatio = 1 - (anchor.headR + 5) / hypotenuse;
    relAnchorX = relBubbleX + backoffRatio * run;
    relAnchorY = relBubbleY + backoffRatio * rise;

    // Coordinates for the base of the arrow.
    var baseX1 = relBubbleX + thickness * rightRun;
    var baseY1 = relBubbleY + thickness * rightRise;
    var baseX2 = relBubbleX - thickness * rightRun;
    var baseY2 = relBubbleY - thickness * rightRise;

    // Distortion to curve the arrow.
    var swirlAngle = angle + Math.random() - 0.5;
    if (swirlAngle > Math.PI * 2) {
      swirlAngle -= Math.PI * 2;
    }
    var swirlRise = Math.sin(swirlAngle) *
        hypotenuse / CCC.World.ARROW_BEND;
    var swirlRun = Math.cos(swirlAngle) *
        hypotenuse / CCC.World.ARROW_BEND;

    steps.push('M' + baseX1 + ',' + baseY1);
    steps.push('C' + (baseX1 + swirlRun) + ',' + (baseY1 + swirlRise) +
               ' ' + relAnchorX + ',' + relAnchorY +
               ' ' + relAnchorX + ',' + relAnchorY);
    steps.push('C' + relAnchorX + ',' + relAnchorY +
               ' ' + (baseX2 + swirlRun) + ',' + (baseY2 + swirlRise) +
               ' ' + baseX2 + ',' + baseY2);
  }
  steps.push('z');
  return CCC.Common.createSvgElement('path',
          {'class': 'bubbleArrow', 'd': steps.join(' ')}, null);
};
/**
 * Draw an arrow composed of thought bubbles between the bubble and the origin.
 * @param {!Object} contentBBox Dimensions of the bubble's contents.
 * @param {!Object} anchor Anchor location for arrow tip.
 * @return {!Element} Path for arrow.
 * @private
 */
CCC.World.drawThoughtArrow_ = function(contentBBox, anchor) {
  var group = CCC.Common.createSvgElement('g', {}, null);
  // TODO
  return group;
};

/**
 * Determines the thickness of the base of the arrow in relation to the size
 * of the bubble.  Higher numbers result in thinner arrows.
 */
CCC.World.ARROW_THICKNESS = 5;

/**
 * The sharpness of the arrow's bend.  Higher numbers result in smoother arrows.
 */
CCC.World.ARROW_BEND = 4;

/**
 * Publish the previously experimentally rendered history frame to the user.
 */
CCC.World.publishHistory = function() {
  if (!CCC.World.historyRow) {
    var rowDiv = document.createElement('div');
    rowDiv.className = 'historyRow';
    CCC.World.scrollDiv.insertBefore(rowDiv, CCC.World.panoramaDiv);
    CCC.World.historyRow = rowDiv;
  }
  var width = CCC.World.panelWidths.shift();
  var panelDiv = document.createElement('div');
  panelDiv.className = 'historyPanel';
  panelDiv.style.height = CCC.World.panelHeight + 'px';
  panelDiv.style.width = width + 'px';
  CCC.World.historyRow.appendChild(panelDiv);
  panelDiv.appendChild(CCC.World.scratchHistory);
  var isIframeVisible = false;
  var msgs = CCC.World.panoramaMessages;
  if (msgs.length == 1) {
    var msg = msgs[0];
    if (msg.iframe) {
      isIframeVisible = true;
      CCC.World.positionIframe(msg.iframe, panelDiv);
      var closeImg = new Image(21, 21);
      closeImg.className = 'iframeClose';
      closeImg.src = 'close.png';
      closeImg.title = CCC.World.getMsg('closeIframeMsg');
      closeImg.addEventListener('click', function() {
        closeImg.style.display = 'none';
        panelDiv.firstChild.style.visibility = 'visible';  // SVG.
        CCC.World.removeNode(msg.iframe);
        msg.iframe = null;
      }, false);
      panelDiv.appendChild(closeImg);
    }
  } else if (Math.random() < 1 / 16) {
    // The occasional (non-iframe) panel should lack a border.
    panelDiv.style.borderColor = '#fff';
  }
  // While being built, the SVG was hidden.
  // Make it visible, unless there is an iframe displayed on top of it.
  if (!isIframeVisible) {
    CCC.World.scratchHistory.style.visibility = 'visible';
  }
  CCC.World.scratchHistory = null;
  CCC.World.scrollDiv.scrollTop = CCC.World.scrollDiv.scrollHeight;

  if (!CCC.World.panelWidths.length) {
    CCC.World.historyRow = null;  // Next row.
  }
  // Move all panorama messages into history.
  Array.prototype.push.apply(CCC.World.historyMessages,
                             CCC.World.panoramaMessages);
  CCC.World.panoramaMessages.length = 0;
};

/**
 * Publish the previously experimentally rendered panorama frame to the user.
 */
CCC.World.publishPanorama = function() {
  // Destroy any existing content.
  while (CCC.World.panoramaDiv.firstChild) {
    CCC.World.panoramaDiv.removeChild(CCC.World.panoramaDiv.firstChild);
  }
  // Insert new content.
  var content = CCC.World.scratchPanorama;
  CCC.World.panoramaDiv.appendChild(content);
  var msgs = CCC.World.panoramaMessages;
  if (msgs.length == 1) {
    var iframe = msgs[0].iframe;
    if (iframe) {
      CCC.World.positionIframe(iframe, CCC.World.panoramaDiv);
      content = iframe;
    }
  }
  CCC.World.scratchPanorama.style.visibility = 'visible';
  CCC.World.scratchPanorama = null;
  // Add event handlers on all <a class="command"> links.
  var commands = content.querySelectorAll('a.command');
  for (var i = 0, command; command = commands[i]; i++) {
    command.addEventListener('click', CCC.Common.commandFunction, false);
  }
  // Add event handlers on all <svg class="menuIcon"> menus.
  var menus = content.querySelectorAll('svg.menuIcon');
  for (var i = 0, menu; menu = menus[i]; i++) {
    menu.addEventListener('click', CCC.Common.openMenu, false);
  }
};

/**
 * Absolutely position an iframe so that it fits exactly inside a comic panel.
 * @param {!Element} iframe DOM node for iframe.
 * @param {!Element} container DOM node for panel.
 */
CCC.World.positionIframe = function (iframe, container) {
  var borderWidth = 2;
  iframe.style.width = (container.offsetWidth - borderWidth * 2) + 'px';
  iframe.style.height = (container.offsetHeight - borderWidth * 2) + 'px';
  var x = 0;
  var y = 0;
  do {
    x += container.offsetLeft;
    y += container.offsetTop;
  } while ((container = container.offsetParent) &&
           (container != CCC.World.scrollDiv));
  iframe.style.top = (y + borderWidth) + 'px';
  iframe.style.left = (x + borderWidth) + 'px';
};

/**
 * Create a blank, hidden SVG.
 * @param {number} width Width of panel in pixels.
 * @param {number} height Height of panel in pixels.
 * @return {!SVGElement} SVG element.
 */
CCC.World.createHiddenSvg = function(width, height) {
  var svg = CCC.Common.createSvgElement('svg',
      {'xmlns:xlink': 'http://www.w3.org/1999/xlink'}, document.body);
  svg.style.visibility = 'hidden';
  // Compute the scaled height and width and save on private properties.
  width -= CCC.World.panelBorder * 2;
  height -= CCC.World.panelBorder * 2;
  svg.scaledHeight_ = 100;
  svg.scaledWidth_ = width / height * svg.scaledHeight_;
  svg.setAttribute('viewBox', [-svg.scaledWidth_ / 2, 0,
                               svg.scaledWidth_, svg.scaledHeight_].join(' '));
  /*
  <filter id="whiteShadow25501663536281627">
    <feFlood result="flood" flood-color="#fff" flood-opacity="1" />
    <feComposite in="flood" result="mask" in2="SourceGraphic" operator="in" />
    <feMorphology in="mask" result="dilated" operator="dilate" radius="4" />
    <feGaussianBlur in="dilated" result="blurred" stdDeviation="2" />
    <feMerge>
      <feMergeNode in="blurred" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
  */
  // Filters cannot be shared between SVGs, doing so can even crash browsers.
  // https://bugs.webkit.org/show_bug.cgi?id=149613
  var id = 'whiteShadow' + String(Math.random()).substring(2);
  svg.whiteShadowId_ = id;
  var filter = CCC.Common.createSvgElement('filter', {'id': id}, svg);
  CCC.Common.createSvgElement('feFlood',
      {'result': 'flood', 'flood-color': '#fff', 'flood-opacity': 1}, filter);
  CCC.Common.createSvgElement('feComposite',
      {'in': 'flood', 'result': 'mask', 'in2': 'SourceGraphic',
      'operator': 'in'}, filter);
  CCC.Common.createSvgElement('feMorphology',
      {'in': 'mask', 'result': 'dilated', 'operator': 'dilate', 'radius': 1},
      filter);
  CCC.Common.createSvgElement('feGaussianBlur',
      {'in': 'dilated', 'result': 'blurred', 'stdDeviation': 5}, filter);
  var feMerge = CCC.Common.createSvgElement('feMerge', {}, filter);
  CCC.Common.createSvgElement('feMergeNode', {'in': 'blurred'}, feMerge);
  CCC.Common.createSvgElement('feMergeNode', {'in': 'SourceGraphic'}, feMerge);
  return svg;
};

/**
 * Create a blank, hidden div.
 * @return {!Element} Div element.
 */
CCC.World.createHiddenDiv = function() {
  var div = document.createElement('div');
  div.className = 'htmlPanel';
  div.style.visibility = 'hidden';
  document.body.appendChild(div);
  return div;
};

/**
 * Instantiate an iframe based on a message.
 * @param {string|!Element} msg Message describing an iframe.
 * @return {!Object} The iframe's DOM.
 */
CCC.World.createIframe = function(msg) {
  var iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-forms allow-scripts';
  iframe.src = msg.getAttribute('src');
  document.getElementById('iframeStorage').appendChild(iframe);
  return iframe;
};


/**
 * Buffer temporally close resize events.
 * Called when the window changes size.
 */
CCC.World.resizeSoon = function() {
  // First resize should call function immediately,
  // subsequent ones should throttle resizing reflows.
  if (CCC.World.resizePid) {
    clearTimeout(CCC.World.resizePid);
    CCC.World.resizePid = setTimeout(CCC.World.resizeNow, 1000);
  } else {
    CCC.World.resizeNow();
    CCC.World.resizePid = -1;
  }
};

/**
 * Rerender the history and the panorama panels.
 * Called when the window changes size.
 */
CCC.World.resizeNow = function() {
  var width = CCC.World.scrollDiv.offsetWidth;
  if (width == CCC.World.lastWidth) {
    // Width hasn't changed.  Maybe just the height changed.  Snap to bottom.
    CCC.World.scrollDiv.scrollTop = CCC.World.scrollDiv.scrollHeight;
    return;
  }
  CCC.World.lastWidth = width;
  CCC.World.renderHistory();
};

/**
 * Rerender entire history.
 * Called when the window changes size.
 */
CCC.World.renderHistory = function() {
  // Destroy all existing history.
  var historyRows = document.getElementsByClassName('historyRow');
  while (historyRows[0]) {
    CCC.World.removeNode(historyRows[0]);
  }
  while (CCC.World.panoramaDiv.firstChild) {
    CCC.World.panoramaDiv.removeChild(CCC.World.panoramaDiv.firstChild);
  }
  CCC.World.panelWidths.length = 0;
  CCC.World.historyRow = null;
  CCC.World.scratchHistory = null;
  CCC.World.scratchPanorama = null;
  CCC.World.scene = document.createElement('scene');
  // Create new history.
  var messages = CCC.World.historyMessages.concat(CCC.World.panoramaMessages);
  CCC.World.historyMessages.length = 0;
  CCC.World.panoramaMessages.length = 0;
  for (var i = 0; i < messages.length; i++) {
    CCC.World.renderMessage(messages[i]);
  }
  CCC.World.scrollDiv.scrollTop = CCC.World.scrollDiv.scrollHeight;
};

/**
 * Given the current window width, assign the number and widths of panels on
 * one history row.
 * @return {!Array.<number>} Array of lengths.
 */
CCC.World.rowWidths = function() {
  // Margin and border widths must match the CSS.
  var panelBloat = 2 * (5 + CCC.World.panelBorder);
  var windowWidth = CCC.World.lastWidth - CCC.World.scrollBarWidth - 1;
  var idealWidth = CCC.World.panelHeight * 5 / 4;  // Standard TV ratio.
  var panelCount = Math.round(windowWidth / idealWidth);
  var averageWidth = Math.floor(windowWidth / panelCount);
  var smallWidth = Math.round(averageWidth * 0.9);
  var largeWidth = averageWidth * 2 - smallWidth;
  averageWidth -= panelBloat;
  smallWidth -= panelBloat;
  largeWidth -= panelBloat;
  // Build an array of lengths.  Add in matching pairs.
  var panels = [];
  for (var i = 0; i < Math.floor(panelCount / 2); i++) {
    if (Math.random() > 0.5) {
      panels.push(averageWidth, averageWidth);
    } else {
      panels.push(smallWidth, largeWidth);
    }
  }
  // Odd number of panels has one in the middle.
  if (panels.length < panelCount) {
    panels.push(averageWidth);
  }
  CCC.World.shuffle(panels);
  return panels;
};

/**
 * Shuffles the values in the specified array using the Fisher-Yates in-place
 * shuffle (also known as the Knuth Shuffle).
 * Copied from Google Closure's goog.array.shuffle
 * @param {!Array} arr The array to be shuffled.
 */
CCC.World.shuffle = function(arr) {
 for (var i = arr.length - 1; i > 0; i--) {
    // Choose a random array index in [0, i] (inclusive with i).
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
};

/**
 * Unserialize stringified HTML.  Wrap the HTML elements in a body.
 * @param {string} svgText '<p>Hello</p>'
 * @return {Element} <body><p>Hello</p></body>
 */
CCC.World.stringToHtml = function(htmlText) {
  var dom = CCC.Common.parser.parseFromString(htmlText, 'text/html');
  if (!dom.body) {
    // Not valid XML.
    console.log('Syntax error in HTML: ' + htmlText);
    return null;
  }
  return CCC.World.xmlToHtml(dom.body);
};

/**
 * Convert an XML tree into an HTML tree.
 * Whitelist used for all elements and properties.
 * @param {!Element} dom XML tree.
 * @return {Element} HTML tree.
 */
CCC.World.xmlToHtml = function(dom) {
  if (!dom) {
    return null;
  }
  switch (dom.nodeType) {
    case 1:  // Element node.
      if (dom.tagName == 'svg') {  // XML tagNames are lowercase.
        // Switch to SVG rendering mode.
        return CCC.World.xmlToSvg(dom);
      }
      if (dom.tagName == 'CMDS') {  // HTML tagNames are uppercase.
        return CCC.Common.newMenuIcon(dom);
      }
      if (dom.tagName == 'CMD') {  // HTML tagNames are uppercase.
        var cmdText = dom.innerText;
        var a = document.createElement('a');
        a.className = 'command';
        a.appendChild(document.createTextNode(cmdText));
        return a;
      }
      if (CCC.World.xmlToHtml.ELEMENT_NAMES.indexOf(dom.tagName) == -1) {
        console.log('HTML element not in whitelist: <' + dom.tagName + '>');
        return null;
      }
      var element = document.createElement(dom.tagName);
      for (var i = 0, attr; attr = dom.attributes[i]; i++) {
        if (CCC.World.xmlToHtml.ATTRIBUTE_NAMES.indexOf(attr.name) == -1) {
          console.log('HTML attribute not in whitelist: ' +
              '<' + dom.tagName + ' ' + attr.name + '="' + attr.value + '">');
        } else {
          element.setAttribute(attr.name, attr.value);
          // Remove all styles not in the whitelist.
          if (attr.name == 'style') {
            for (var name in element.style) {
              if (element.style.hasOwnProperty(name) &&
                  isNaN(parseFloat(name)) && // Don't delete indexed props.
                  element.style[name] && element.style[name] != 'initial' &&
                  CCC.World.xmlToHtml.STYLE_NAMES.indexOf(name) == -1) {
                console.log('Style attribute not in whitelist: ' +
                    name + ': ' + element.style[name]);
                element.style[name] = '';
              }
            }
          }
        }
      }
      for (var i = 0, childDom; childDom = dom.childNodes[i]; i++) {
        var childNode = CCC.World.xmlToHtml(childDom);
        if (childNode) {
          element.appendChild(childNode);
        }
      }
      return element;
    case 3:  // Text node.
      return document.createTextNode(dom.data);
    case 8:  // Comment node.
      return null;
  }
  console.log('Unknown HTML node type: ' + dom);
  return null;
};

/**
 * Whitelist of all allowed HTML element names.
 * 'svg' element is handled separately.
 */
CCC.World.xmlToHtml.ELEMENT_NAMES = [
  'ABBR',
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'B',
  'BDI',
  'BDO',
  'BLOCKQUOTE',
  'BODY',
  'BR',
  'CAPTION',
  'CITE',
  'CODE',
  'COL',
  'COLGROUP',
  'DATA',
  'DD',
  'DEL',
  'DFN',
  'DIV',
  'DL',
  'DT',
  'EM',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HEADER',
  'HGROUP',
  'HR',
  'I',
  'INS',
  'KBD',
  'LEGEND',
  'LI',
  'MAIN',
  'MARK',
  'NAV',
  'OL',
  'P',
  'PRE',
  'Q',
  'RP',
  'RT',
  'RTC',
  'RUBY',
  'S',
  'SAMP',
  'SECTION',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TIME',
  'TR',
  'U',
  'UL',
  'VAR',
  'WBR',
];

/**
 * Whitelist of all allowed HTML property names.
 * This architecture assumes that there are no banned properties
 * on one element type which are allowed on another.
 */
CCC.World.xmlToHtml.ATTRIBUTE_NAMES = [
  'cite',
  'colspan',
  'datetime',
  'dir',
  'headers',
  'nowrap',
  'reversed',
  'rowspan',
  'scope',
  'span',
  'start',
  'style',
  'title',
  'type',
  'value',
];

/**
 * Whitelist of all allowed style property names.
 */
CCC.World.xmlToHtml.STYLE_NAMES = [
  'border',
  'borderBottom',
  'borderBottomColor',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderBottomStyle',
  'borderBottomWidth',
  'borderCollapse',
  'borderColor',
  'borderLeft',
  'borderLeftColor',
  'borderLeftStyle',
  'borderLeftWidth',
  'borderRadius',
  'borderRight',
  'borderRightColor',
  'borderRightStyle',
  'borderRightWidth',
  'borderSpacing',
  'borderStyle',
  'borderTop',
  'borderTopColor',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderTopStyle',
  'borderTopWidth',
  'borderWidth',
  'clear',
  'direction',
  'display',
  'float',
  'fontWeight',
  'height',
  'hyphens',
  'padding',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'textAlign',
  'verticalAlign',
  'width',
];

/**
 * Unserialize stringified SVG.  Wrap the SVG elements in an SVG.
 * @param {string} svgText '<rect /><circle r="5" />'
 * @return {SVGSVGElement} <svg><rect /><circle r="5" /></svg>
 */
CCC.World.stringToSvg = function(svgText) {
  var dom = CCC.Common.parser.parseFromString(
      '<svg>' + svgText + '</svg>', 'image/svg+xml');
  if (dom.getElementsByTagName('parsererror').length) {
    // Not valid XML.
    console.log('Syntax error in SVG: ' + svgText);
    return null;
  }
  return CCC.World.xmlToSvg(dom.firstChild);
};

/**
 * Convert an XML tree into an SVG tree.
 * Whitelist used for all elements and properties.
 * @param {!Element} dom XML tree.
 * @return {SVGElement} SVG tree.
 */
CCC.World.xmlToSvg = function(dom) {
  if (!dom) {
    return null;
  }
  switch (dom.nodeType) {
    case 1:  // Element node.
      if (CCC.World.xmlToSvg.ELEMENT_NAMES.indexOf(dom.tagName) == -1) {
        console.log('SVG element not in whitelist: <' + dom.tagName + '>');
        return null;
      }
      var svg = document.createElementNS(CCC.Common.NS, dom.tagName);
      for (var i = 0, attr; attr = dom.attributes[i]; i++) {
        if (CCC.World.xmlToSvg.ATTRIBUTE_NAMES.indexOf(attr.name) == -1) {
          console.log('SVG attribute not in whitelist: ' +
              '<' + dom.tagName + ' ' + attr.name + '="' + attr.value + '">');
        } else {
          svg.setAttribute(attr.name, attr.value);
        }
      }
      for (var i = 0, childDom; childDom = dom.childNodes[i]; i++) {
        var childSvg = CCC.World.xmlToSvg(childDom);
        if (childSvg) {
          svg.appendChild(childSvg);
        }
      }
      return svg;
    case 3:  // Text node.
      return document.createTextNode(dom.data);
    case 8:  // Comment node.
      return null;
  }
  console.log('Unknown XML node type: ' + dom);
  return null;
};

/**
 * Whitelist of all allowed SVG element names.
 */
CCC.World.xmlToSvg.ELEMENT_NAMES = [
  'circle',
  'desc',
  'ellipse',
  'g',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
  'svg',
  'text',
  'title',
  'tspan',
];

/**
 * Whitelist of all allowed SVG property names.
 * This architecture assumes that there are no banned properties
 * on one element type which are allowed on another.
 */
CCC.World.xmlToSvg.ATTRIBUTE_NAMES = [
  'cx',
  'cy',
  'd',
  'dx',
  'dy',
  'height',
  'lengthAdjust',
  'points',
  'r',
  'rx',
  'ry',
  'text-anchor',
  'textLength',
  'transform',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
  'width',
];

/**
 * Clone a tree of elements, and append it as a new child onto a DOM.
 * @param {!Element} parent Parent DOM element.
 * @param {Element} container A disposable <body> or <svg> wrapper.
 */
CCC.World.cloneAndAppend = function(parent, container) {
  if (container) {
    var clonedContianer = container.cloneNode(true);
    while (clonedContianer.firstChild) {
      parent.appendChild(clonedContianer.firstChild);
    }
  }
};

/**
 * Remove a node from the DOM.
 * @param {Node} node Node to remove, ok if null.
 */
CCC.World.removeNode = function(node) {
  if (node) {
    node.parentNode.removeChild(node);
  }
};

/**
 * Gets the message with the given key from the document.
 * @param {string} key The key of the document element.
 * @return {string} The textContent of the specified element.
 */
CCC.World.getMsg = function(key) {
  var element = document.getElementById(key);
  if (!element) {
    throw 'Unknown message ' + key;
  }
  return element.textContent;
};

/**
 * Determine the width of scrollbars on this platform.
 * Code copied from https://stackoverflow.com/questions/8079187/
 * @return {number} Width in pixels.
 */
CCC.World.getScrollBarWidth = function() {
  var inner = document.createElement('p');
  inner.style.width = '100%';
  inner.style.height = '200px';

  var outer = document.createElement('div');
  outer.style.position = 'absolute';
  outer.style.top = 0;
  outer.style.left = 0;
  outer.style.visibility = 'hidden';
  outer.style.width = '200px';
  outer.style.height = '150px';
  outer.style.overflow = 'hidden';
  outer.appendChild(inner);

  document.body.appendChild(outer);
  var w1 = inner.offsetWidth;
  outer.style.overflow = 'scroll';
  var w2 = inner.offsetWidth;
  if (w1 == w2) {
    w2 = outer.clientWidth;
  }
  document.body.removeChild(outer);

  return w1 - w2;
};

/**
 * Create a block of text on SVG constrained to a given size.
 * @param {!SVGSVGElement} svg SVG element to use.
 * @param {string} text Text to create.
 * @param {number} width Maximum width.
 * @param {number} height Maximum height.
 * @return {!SVGElement} SVG group containing text.
 */
CCC.World.createTextArea = function(svg, text, width, height) {
  text = text.replace(/  /g, '\u00A0 ');
  text = text.replace(/  /g, '\u00A0 ');
  text = text.replace(/^ /gm, '\u00A0');
  text = CCC.World.wrap(svg, text, width, height);
  var lines = text.split('\n');
  var textNode = document.createElementNS(CCC.Common.NS, 'text');
  textNode.setAttribute('alignment-baseline', 'hanging');
  if (lines.length) {
    var dy = CCC.World.measureText(svg, 'Wg').height;
    for (var i = 0; i < lines.length; i++) {
      var line = (lines[i] == '\r' || lines[i] == '\n') ? '\u200B' : lines[i];
      var tspan = document.createElementNS(CCC.Common.NS, 'tspan');
      tspan.appendChild(document.createTextNode(line));
      tspan.setAttribute('x', 0);
      tspan.setAttribute('dy', dy);
      textNode.appendChild(tspan);
    }
  }
  var g = document.createElementNS(CCC.Common.NS, 'g');
  g.appendChild(textNode);
  return g;
};

/**
 * Wrap text to the specified width.
 * @param {!SVGSVGElement} svg SVG element to use.
 * @param {string} text Text to wrap.
 * @param {number} width Maximum width.
 * @param {number} height Maximum height.
 * @return {string} Wrapped text.
 */
CCC.World.wrap = function(svg, text, width, height) {
  var minWidth = width;
  var maxWidth = svg.scaledWidth_ - 10;
  var measuredWidth, measuredHeight;
  function wrapForWidth(width) {
    measuredWidth = 0;
    measuredHeight = 0;
    var paragraphs = text.split('\n');
    var dy = CCC.World.measureText(svg, 'Wg').height;
    for (var i = 0; i < paragraphs.length; i++) {
      paragraphs[i] = CCC.World.wrapLine_(svg, paragraphs[i], width);
      var lines = paragraphs[i].split('\n');
      for (var j = 0; j < lines.length; j++) {
        var size = CCC.World.measureText(svg, lines[j]);
        measuredWidth = Math.max(measuredWidth, size.width);
        measuredHeight += dy;
      }
    }
    return  paragraphs.join('\n');
  }
  var wrappedText = wrapForWidth(width);
  if (measuredHeight > height) {
    // If overflowing on height, increase the width using a binary search.
    // Do not exceed the full width of the SVG.
    do {
      if (measuredHeight > height) {
        minWidth = width;
        width = Math.round((maxWidth - width) / 2 + width);
      } else {
        maxWidth = width;
        width = Math.round((width - minWidth) / 2 + minWidth);
      }
      wrappedText = wrapForWidth(width);
    } while (maxWidth - minWidth > 10);
    if (measuredHeight > height) {
      wrappedText = wrapForWidth(maxWidth);
    }
  }
  return wrappedText;
};

/**
 * Wrap single line of text to the specified width.
 * @param {!SVGSVGElement} svg SVG element to use.
 * @param {string} text Text to wrap.
 * @param {number} limit Width to wrap each line.
 * @return {string} Wrapped text.
 * @private
 */
CCC.World.wrapLine_ = function(svg, text, limit) {
  if (CCC.World.measureText(svg, text).width <= limit) {
    // Short text, no need to wrap.
    return text;
  }
  // Split the text into words.
  var words = text.split(/\b(?=\w)/);
  // Set limit to be the length of the largest word.
  for (var i = 0; i < words.length; i++) {
    limit = Math.max(CCC.World.measureText(svg, words[i]).width, limit);
  }
  limit = Math.min(svg.scaledWidth_ - 5, limit);  // But not wider than panel.

  var lastScore;
  var score = -Infinity;
  var lastText;
  var lineCount = 1;
  do {
    lastScore = score;
    lastText = text;
    // Create a list of booleans representing if a space (false) or
    // a break (true) appears after each word.
    var wordBreaks = [];
    // Seed the list with evenly spaced linebreaks.
    var steps = words.length / lineCount;
    var insertedBreaks = 1;
    for (var i = 0; i < words.length - 1; i++) {
      if (insertedBreaks < (i + 1.5) / steps) {
        insertedBreaks++;
        wordBreaks[i] = true;
      } else {
        wordBreaks[i] = false;
      }
    }
    wordBreaks = CCC.World.wrapMutate_(svg, words, wordBreaks, limit);
    score = CCC.World.wrapScore_(svg, words, wordBreaks, limit);
    text = CCC.World.wrapToText_(words, wordBreaks);
    lineCount++;
  } while (score > lastScore);
  return lastText;
};

/**
 * Compute a score for how good the wrapping is.
 * @param {!SVGSVGElement} svg SVG element to use.
 * @param {!Array.<string>} words Array of each word.
 * @param {!Array.<boolean>} wordBreaks Array of line breaks.
 * @param {number} limit Width to wrap each line.
 * @return {number} Larger the better.
 * @private
 */
CCC.World.wrapScore_ = function(svg, words, wordBreaks, limit) {
  // If this function becomes a performance liability, add caching.
  // Compute the length of each line.
  var lines = [[]];
  for (var i = 0; i < words.length; i++) {
    lines[lines.length - 1].push(words[i]);
    if (wordBreaks[i] === true) {
      lines.push([]);
    }
  }
  var lineLengths = [];
  for (var i = 0; i < lines.length; i++) {
    lines[i] = lines[i].join('');
    lineLengths.push(CCC.World.measureText(svg, lines[i]).width);
  }

  var score = 0;
  for (var i = 0; i < lineLengths.length; i++) {
    // Optimize for width.
    if (lineLengths[i] > limit) {
      // -1000 points per unit over limit.
      score -= (lineLengths[i] - limit) * 1000;
    } else {
      // -1 point per unit under limit (scaled to the power of 1.5).
      score -= Math.pow(Math.abs(limit - lineLengths[i]) * 1, 1.5);
    }
    // Optimize for structure.
    // Add score to line endings after punctuation.
    var lastLetter = lines[i].trim().slice(-1);
    if ('.?!'.indexOf(lastLetter) != -1) {
      score += 6;
    } else if (',;)]}'.indexOf(lastLetter) != -1) {
      score += 3;
    }
  }
  // All else being equal, the last line should not be longer than the
  // previous line.  For example, this looks wrong:
  // aaa bbb
  // ccc ddd eee
  if (lineLengths.length > 1 && lineLengths[lineLengths.length - 1] <=
      lineLengths[lineLengths.length - 2]) {
    score += 5;
  }
  // Likewise, the first line should not be longer than the next line.
  // An ideal bubble with centered text has the first and last lines shorter.
  if (lineLengths.length > 2 && lineLengths[0] <= lineLengths[1]) {
    score += 5;
  }
  return score;
};

/**
 * Mutate the array of line break locations until an optimal solution is found.
 * No line breaks are added or deleted, they are simply moved around.
 * @param {!SVGSVGElement} svg SVG element to use.
 * @param {!Array.<string>} words Array of each word.
 * @param {!Array.<boolean>} wordBreaks Array of line breaks.
 * @param {number} limit Width to wrap each line.
 * @return {!Array.<boolean>} New array of optimal line breaks.
 * @private
 */
CCC.World.wrapMutate_ = function(svg, words, wordBreaks, limit) {
  var bestScore = CCC.World.wrapScore_(svg, words, wordBreaks, limit);
  var bestBreaks;
  // Try shifting every line break forward or backward.
  for (var i = 0; i < wordBreaks.length - 1; i++) {
    if (wordBreaks[i] == wordBreaks[i + 1]) {
      continue;
    }
    var mutatedWordBreaks = [].concat(wordBreaks);
    mutatedWordBreaks[i] = !mutatedWordBreaks[i];
    mutatedWordBreaks[i + 1] = !mutatedWordBreaks[i + 1];
    var mutatedScore =
        CCC.World.wrapScore_(svg, words, mutatedWordBreaks, limit);
    if (mutatedScore > bestScore) {
      bestScore = mutatedScore;
      bestBreaks = mutatedWordBreaks;
    }
  }
  if (bestBreaks) {
    // Found an improvement.  See if it may be improved further.
    return CCC.World.wrapMutate_(svg, words, bestBreaks, limit);
  }
  // No improvements found.  Done.
  return wordBreaks;
};

/**
 * Reassemble the array of words into text, with the specified line breaks.
 * @param {!Array.<string>} words Array of each word.
 * @param {!Array.<boolean>} wordBreaks Array of line breaks.
 * @return {string} Plain text.
 * @private
 */
CCC.World.wrapToText_ = function(words, wordBreaks) {
  var text = [];
  for (var i = 0; i < words.length; i++) {
    text.push(words[i]);
    if (wordBreaks[i]) {
      text.push('\n');
    }
  }
  return text.join('');
};

/**
 * Measure one line of text to obtain its height and width.
 * @param {!SVGSVGElement} svg SVG element to use.
 * @param {string} text Text to measure.
 * @return {!SVGRect} Height and width of text.
 */
CCC.World.measureText = function(svg, text) {
  if (!svg.measureTextCache_) {
    svg.measureTextCache_ = Object.create(null);
  } else if (svg.measureTextCache_[text]) {
    return svg.measureTextCache_[text];
  }
  var textarea = document.createElementNS(CCC.Common.NS, 'text');
  textarea.appendChild(document.createTextNode(text));
  svg.appendChild(textarea);
  var bBox = textarea.getBBox();
  svg.removeChild(textarea);
  svg.measureTextCache_[text] = bBox;
  return bBox;
};

/**
 * Cache of text widths for performance boost.
 */
CCC.World.measureText.cache_ = Object.create(null);

window.addEventListener('message', CCC.World.receiveMessage, false);
window.addEventListener('load', CCC.World.init, false);
