/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
 * @type {Element}
 */
CCC.World.historyRow = null;

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
 * @type {Object}
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
  CCC.World.scene = {};  // Blank scene.
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
  if (mode === CCC.Common.MessageTypes.CLEAR) {
    // Clear all content, except for the 'Reconnect?' panel (if it exists).
    document.getElementById('iframeStorage').innerHTML = '';
    CCC.World.historyMessages.length = 0;
    var firstPanoramaMessage = CCC.World.panoramaMessages[0];
    if (firstPanoramaMessage && firstPanoramaMessage.type === 'connected' &&
        !firstPanoramaMessage.isConnected) {
      // Clear the date/time on the 'Reconnect?' panel (if it exists).
      firstPanoramaMessage.time = '...';
    } else {
      CCC.World.panoramaMessages.length = 0;
    }
    CCC.World.removeNode(CCC.World.scratchHistory);
    CCC.World.removeNode(CCC.World.scratchPanorama);
    var scene = CCC.World.scene;  // Save the scene.
    CCC.World.renderHistory();
    CCC.World.scene = scene;  // Restore the scene.
  } else if (mode === CCC.Common.MessageTypes.BLUR) {
      CCC.Common.closeMenu();
  } else if (mode === CCC.Common.MessageTypes.CONNECTION) {
    CCC.Common.setConnected(data['state']);
  } else if (mode === CCC.Common.MessageTypes.CONNECT_MSG) {
    // Notify the user of the connection.
    CCC.World.renderMessage({type: 'connected',
                             isConnected: true,
                             time: data['text']});
  } else if (mode === CCC.Common.MessageTypes.DISCONNECT_MSG) {
    // Notify the user of the disconnection.
    CCC.World.renderMessage({type: 'connected',
                             isConnected: false,
                             time: data['text']});
  } else if (mode === CCC.Common.MessageTypes.MEMO) {
    try {
      var msg = JSON.parse(text);
    } catch (e) {
      // Not valid JSON, treat as string literal.
      msg = {type: 'narrate', text: text};
    }
    CCC.World.preprocessMessage(msg);
    CCC.World.renderMessage(msg);
  }
};

/**
 * Parse the message and deal with any chunks that need one-time processing.
 * @param {*} msg JSON structure, or component thereof.
 */
CCC.World.preprocessMessage = function(msg) {
  if (Array.isArray(msg)) {
    for (var singleMsg of msg) {
      CCC.World.preprocessMessage(singleMsg);
    }
    return;
  }
  if (typeof msg === 'object' && msg !== null) {
    for (var prop in msg) {
      CCC.World.preprocessMessage(msg[prop]);
    }

    // Text too large for a bubble should be in an HTML frame.
    if ((msg.type === 'say' || msg.type === 'think' || msg.type === 'narrate') &&
        msg.text.length > 800) {
      // TODO: Render say/think text in log form:  Bob says, "Blah blah..."
      var text = msg.text;
      // Transform this memo into an HTML frame.
      for (prop in msg) {
        delete msg[prop];
      }
      msg.type = 'html';
      text = CCC.Common.escapeSpaces(text.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'));
      msg.htmlText = text;
    }

    // Find all stringified SVG props and replace them with actual SVG props.
    if ('svgText' in msg) {
      var svgDom = CCC.World.stringToSvg(msg.svgText);
      if (svgDom) {
        msg.svgDom = svgDom;
      }
      delete msg.svgText;
    }

    // Find all stringified HTML props and replace them with actual HTML props.
    if ('htmlText' in msg) {
      var htmlDom = CCC.World.stringToHtml(msg.htmlText);
      if (htmlDom) {
        msg.htmlDom = htmlDom;
      }
      delete msg.htmlText;
    }

    // Find all iframes and create DOM elements for them.
    if (msg.type === 'iframe') {
      // {type: "iframe", url: "https://example.com/foo", alt: "Alt text"}
      msg.iframeId = CCC.World.createIframe(msg.url);
    }

    // Move the current user to the start of the room contents list.
    if (msg.type === 'scene' && msg.user && msg.contents) {
      for (var i = 1, content; (content = msg.contents[i]); i++) {
        if (content.type === 'user' && content.what === msg.user) {
          msg.contents.unshift(msg.contents.splice(i, 1)[0]);
        }
      }
    }
  }
};

/**
 * Render a message to the panorama panel, optionally triggering a history push.
 * @param {!Object} memo JSON structure.
 */
CCC.World.renderMessage = function(memo) {
  if (memo.type === 'link') {
    // {type: "link", href: "https://example.com/"}
    // Link is opened by log.  No visualization in world.
    return;
  }
  if (isNaN(CCC.World.lastWidth)) {
    // Race condition, message has arrived before world is ready to render.
    // Just add to the panorama queue, it will be rendered later.
    CCC.World.panoramaMessages.push(memo);
    return;
  }

  if (memo.type === 'scene' && memo.user) {
    // This is the user's current location.  Save this environment data.
    CCC.World.scene = memo;
  }
  // Unrequested scenes should only show if either there is no immediately
  // following message (within half a second), or the following message is
  // something other than say/think/narrate.
  if (memo.type === 'scene' && !memo.requested) {
    memo.requested = true;
    CCC.World.renderMessage.pendingSceneMsg_ = memo;
    clearTimeout(CCC.World.renderMessage.pendingScenePid_);
    CCC.World.renderMessage.pendingScenePid_ = setTimeout(function() {
        // No following message arrived.  Render scene change.
        CCC.World.renderMessage(memo);
      }, 500);
    return;
  }
  if (memo.type === 'say' || memo.type === 'think' || memo.type === 'narrate' ||
      memo.type === 'scene') {
    // Throw away any pending scene change since say/think/narrate will show
    // the updated scene.
    CCC.World.renderMessage.pendingSceneMsg_ = null;
    clearTimeout(CCC.World.renderMessage.pendingScenePid_);
  }
  if (CCC.World.renderMessage.pendingSceneMsg_) {
    // Show any pending scene before the current message.
    CCC.World.renderMessage(CCC.World.renderMessage.pendingSceneMsg_);
    CCC.World.renderMessage.pendingSceneMsg_ = null;
    clearTimeout(CCC.World.renderMessage.pendingScenePid_);
  }

  if (!CCC.World.panelWidths.length) {
    CCC.World.panelWidths = CCC.World.rowWidths();
  }

  var backupScratchHistory =
      CCC.World.scratchHistory && CCC.World.scratchHistory.cloneNode(true);
  if (CCC.World.prerenderHistory(memo) && CCC.World.prerenderPanorama(memo)) {
    // Rendering successful in both panorama and pending history panel.
    CCC.World.panoramaMessages.push(memo);
    CCC.World.publishPanorama();
  } else {
    // Failure to render.  Publish the previous history, and start fresh.
    CCC.World.removeNode(CCC.World.scratchHistory);
    CCC.World.removeNode(CCC.World.scratchPanorama);
    CCC.World.scratchHistory = null;
    CCC.World.scratchPanorama = null;
    // Publish one panel to the history.
    CCC.World.publishHistory(backupScratchHistory);
    // Move all panorama messages into history.
    Array.prototype.push.apply(CCC.World.historyMessages,
                               CCC.World.panoramaMessages);
    CCC.World.panoramaMessages.length = 0;
    // Try again.
    CCC.World.renderMessage(memo);
  }
};

CCC.World.renderMessage.pendingSceneMsg_ = null;
CCC.World.renderMessage.pendingScenePid_ = 0;

/**
 * Experimentally render a new message onto the most recent history frame.
 * @param {!Object} memo JSON structure.
 * @return {boolean} True if the message fit.  False if overflow.
 */
CCC.World.prerenderHistory = function(memo) {
  if (memo.type === 'iframe') {
    if (CCC.World.scratchHistory) {
      return false;  // Every iframe needs to be in its own panel.
    }
    // Create relaunch button if iframe is closed.
    var svg = CCC.World.createHiddenSvg(CCC.World.panelWidths[0],
                                        CCC.World.panelHeight);
    svg.style.backgroundColor = '#696969';
    svg.setAttribute('data-iframe-id', memo.iframeId);
    var g = CCC.Common.createSvgElement('g',
        {'class': 'iframeRelaunch',
         'transform': 'translate(0, 50)',
         'data-iframe-src': memo.url}, svg);
    // Add relaunch button.
    var rect = document.createElementNS(CCC.Common.NS, 'rect');
    var text = document.createElementNS(CCC.Common.NS, 'text');
    text.appendChild(document.createTextNode(
        CCC.World.getTemplate('relaunchIframeTemplate')));
    g.appendChild(rect);
    g.appendChild(text);
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

  if (memo.type === 'html') {
    if (CCC.World.scratchHistory) {
      return false;  // Every htmlframe needs to be in its own panel.
    }
    var div = CCC.World.createHiddenDiv();
    CCC.World.cloneAndAppend(div, memo.htmlDom);
    CCC.World.scratchHistory = div;
    return true;
  }

  if (memo.type === 'connected') {
    if (CCC.World.scratchHistory) {
      return false;  // Every connect/disconnect needs to be in its own panel.
    }
    var div = CCC.World.createHiddenDiv();
    div.appendChild(CCC.World.connectPanel(memo));
    CCC.World.scratchHistory = div;
    return true;
  }

  if (memo.type === 'scene') {
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
    // Each scene message needs its own frame.
    if (CCC.World.scratchHistory) {
      return false;
    }
    memo = CCC.World.sceneDescription(memo);
  }

  // If bubbles can be merged, attempt to do so.
  var merge = CCC.World.mergeBubbles(CCC.World.scratchHistory, memo);
  if (merge !== undefined) {
    return merge;
  }

  // For now every message needs its own frame.
  if (CCC.World.scratchHistory) {
    return false;
  }
  var svg = CCC.World.scratchHistory;
  if (!svg) {
    svg = CCC.World.createHiddenSvg(CCC.World.panelWidths[0],
                                    CCC.World.panelHeight);
    CCC.World.drawScene(svg);
  }
  if (memo.type === 'say' || memo.type === 'think' || memo.type === 'narrate') {
    CCC.World.createBubble(memo, svg);
  }

  CCC.World.scratchHistory = svg;
  return true;
};

/**
 * Experimentally render a new message onto the panorama frame.
 * @param {!Object} memo JSON structure.
 * @return {boolean} True if the message fit.  False if overflow.
 */
CCC.World.prerenderPanorama = function(memo) {
  if (memo.type === 'iframe') {
    if (CCC.World.scratchPanorama) {
      return false;  // Every iframe needs to be in its own panel.
    }
    var svg = CCC.World.createHiddenSvg(CCC.World.panoramaDiv.offsetWidth,
                                        CCC.World.panoramaDiv.offsetHeight);
    svg.setAttribute('data-iframe-id', memo.iframeId);
    CCC.World.scratchPanorama = svg;
    return true;
  }

  if (memo.type === 'html') {
    if (CCC.World.scratchPanorama) {
      return false;  // Every htmlframe needs to be in its own panel.
    }
    var div = CCC.World.createHiddenDiv();
    CCC.World.cloneAndAppend(div, memo.htmlDom);
    CCC.World.scratchPanorama = div;
    return true;
  }

  if (memo.type === 'connected') {
    if (CCC.World.scratchPanorama) {
      return false;  // Every connect/disconnect needs to be in its own panel.
    }
    var div = CCC.World.createHiddenDiv();
    div.appendChild(CCC.World.connectPanel(memo));
    CCC.World.scratchPanorama = div;
    return true;
  }

  if (memo.type === 'scene') {
    memo = CCC.World.sceneDescription(memo);
  }

  // If bubbles can be merged, attempt to do so.
  var merge = CCC.World.mergeBubbles(CCC.World.scratchPanorama, memo);
  if (merge !== undefined) {
    return merge;
  }

  // For now every message needs its own frame.
  if (CCC.World.scratchPanorama) {
    return false;
  }
  var svg = CCC.World.scratchPanorama;
  if (!svg) {
    var svg = CCC.World.createHiddenSvg(CCC.World.panoramaDiv.offsetWidth,
                                        CCC.World.panoramaDiv.offsetHeight);
    CCC.World.drawScene(svg);
  }
  if (memo.type === 'say' || memo.type === 'think' || memo.type === 'narrate') {
    CCC.World.createBubble(memo, svg);
  }

  CCC.World.scratchPanorama = svg;
  return true;
};

/**
 * Create a panel for a connection/disconnection event.
 * @param {!Object} memo Object containing connection/disconnection mode and
 *   date/time of event.
 * @return {!DocumentFragment} Document fragment containing rendered panel.
 */
CCC.World.connectPanel = function(memo) {
  var isConnected = memo.isConnected;
  var df = document.createDocumentFragment();
  var div = document.createElement('div');
  div.className = isConnected ? 'connectDiv' : 'disconnectDiv';
  var text = CCC.World.getTemplate(
      isConnected ? 'connectedTemplate' : 'disconnectedTemplate');
  div.appendChild(document.createTextNode(text));
  df.appendChild(div);

  var img = document.createElement('img');
  img.className = 'connectionIcon';
  img.src = STATIC_URL + 'connect/connectionIcons.svg' +
      (isConnected ? '#connect' : '#reload');
  df.appendChild(img);

  div = document.createElement('div');
  div.className = 'systemTime';
  div.appendChild(document.createTextNode(memo.time));
  df.appendChild(div);

  return df;
};

/**
 *
 * @param {!SVGElement} svg SVG element in which to draw the background.
 * @param {!Object} memo JSON structure.
 * @return {?boolean} True if merged, false if overflow, undefined if no match.
 */
CCC.World.mergeBubbles = function(svg, memo) {
  var previousMessage =
      CCC.World.panoramaMessages[CCC.World.panoramaMessages.length - 1];
  if (!svg || !previousMessage || previousMessage.type !== memo.type ||
      previousMessage.source !== memo.source ||
      previousMessage.where !== memo.where) {
    return undefined;  // Current message not a match with previous message.
  }
  // Remove previous bubble.
  svg.removeChild(svg.lastBubbleText_);
  svg.removeChild(svg.lastBubbleGroup_);
  // Try to add a merged bubble.
  var mergedNode = {};
  for (var prop in memo) {
    mergedNode[prop] = memo[prop];
  }
  mergedNode.text = svg.lastPlainText_ + '\n' + memo.text;
  CCC.World.createBubble(mergedNode, svg);

  // If the merged bubble is too big, reject the merge.
  var bBox = CCC.World.getBBoxWithTransform(svg.lastBubbleText_);
  var bottom = bBox.y + bBox.height - 2;  // -2 for the border.
  var anchor = CCC.World.getAnchor(memo, svg);
  var limitY = anchor ? 100 - anchor.headY - anchor.headR : 100;
  return bottom < limitY;
};

/**
 * Forge a text message with the room name and description.
 * @param {!Object} memo JSON structure.
 * @return {Object} Text message to render, or empty object if no message.
 */
CCC.World.sceneDescription = function(memo) {
  var title = memo.where;
  if (typeof title !== 'string') {
    return {};
  }
  // Render title with HTML collapsing space rules.
  title = title.replace(/\s+/g, ' ');
  var text = [title];
  var description = memo.description;
  if (description) {
    text.push(description);
  }
  text = text.join('\n');
  return {type: 'narrate', text: text, where: title};
};

/**
 * Draw the currently recorded scene background into the provided SVG.
 * @param {!SVGElement} svg SVG element in which to draw the background.
 */
CCC.World.drawSceneBackground = function(svg) {
  var svgDom = CCC.World.scene.svgDom;
  if (svgDom) {
    var g = CCC.Common.createSvgElement('g',
        {'class': 'sceneBackground'}, svg);
    CCC.World.cloneAndAppend(g, svgDom);
  }
};


/**
 * Draw the users and objects in the currently recorded scene.
 * @param {!SVGElement} svg SVG element in which to draw the users and objects.
 */
CCC.World.drawScene = function(svg) {
  CCC.World.drawSceneBackground(svg);
  // Obtain an ordered list of contents.
  var contentsArray = CCC.World.scene.contents;
  if (contentsArray) {
    var userTotal = 0;
      for (var i = 0; i < contentsArray.length; i++) {
        userTotal += contentsArray[i].type === 'user';
      }
    svg.sceneUserLocations = Object.create(null);
    svg.sceneObjectLocations = Object.create(null);
    // Draw each item.
    var icons = [];
    var userCount = 0;
    for (var i = 0, thing; (thing = contentsArray[i]); i++) {
      var cursorX = (i + 1) / (contentsArray.length + 1) * svg.scaledWidth_ -
          svg.scaledWidth_ / 2;
      var bBox = null;
      var isUser = thing.type === 'user';
      var svgDom = thing.svgDom;
      if (svgDom && svgDom.firstChild) {
        var name = thing.what;
        var g = CCC.Common.createSvgElement('g', {'class': thing.type}, svg);
        var title = CCC.Common.createSvgElement('title', {}, g);
        title.appendChild(document.createTextNode(name));
        // TODO: Reenable whiteShadow.
        // whiteShadow disabled due to clipping bugs.
        //g.setAttribute('filter', 'url(#' + svg.whiteShadowId_ + ')');
        CCC.World.cloneAndAppend(g, svgDom);
        // Users should face the majority of other users.
        // If user is alone, should face majority of objects.
        if (isUser && (userTotal === 1 ?
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
        // Record location of each user for positioning of speech bubbles.
        var radius = Math.min(bBox.height, bBox.width) / 2;
        var location = {
          headX: cursorX,
          headY: bBox.y + radius,
          headR: radius
        };
        if (isUser) {
          svg.sceneUserLocations[name] = location;
        } else {
          svg.sceneObjectLocations[name] = location;
        }
      }
      var cmds = thing.cmds;
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
    for (var icon of icons) {
      svg.appendChild(icon);
    }
  }
};

/**
 * Write text in a bubble.
 * @param {!Object} memo JSON structure.
 * @param {!SVGElement} svg SVG Element to place the text and bubble.
 */
CCC.World.createBubble = function(memo, svg) {
  // {type: "say", text: "Welcome"}
  // {type: "say", source: "Max", where: "Hangout", text: "Hello world."}
  // {type: "say", source: "Cat", where: "Hangout", text: "Meow."}
  // {type: "think", text: "Don't be evil."}
  // {type: "think", source: "Max", where: "Hangout", text: "I'm hungry."}
  // {type: "think", source: "Cat", where: "Hangout", text: "I'm evil."}
  // {type: "narrate", text: "Command not recognized."}
  // {type: "narrate", where: "Hangout", text: "Hangout is dark."}
  // {type: "narrate", source: "Max", where: "Hangout", text: "Max smiles."}
  // {type: "narrate", source: "Cat", where: "Hangout", text: "Cat meows."}
  var source = memo.source;
  var where = memo.where;
  var text = memo.text || '';
  var width = memo.type === 'narrate' ? 150 : 100;
  width = Math.min(svg.scaledWidth_, width);
  var textGroup = CCC.World.createTextArea(svg, text, width, 30);
  textGroup.setAttribute('class', memo.type);
  var bubbleGroup = CCC.Common.createSvgElement('g', {'class': 'bubble'}, svg);
  if (source) {
    var title = CCC.Common.createSvgElement('title', {}, bubbleGroup);
    title.appendChild(document.createTextNode(source));
    var title = CCC.Common.createSvgElement('title', {}, textGroup);
    title.appendChild(document.createTextNode(source));
  }
  svg.appendChild(textGroup);
  var textBBox = textGroup.getBBox();

  var anchor = CCC.World.getAnchor(memo, svg);
  if (!anchor && where && where === CCC.World.scene.where) {
    // This text box is coming from the room, not a user or object.
    // A bit of a hack: place anchor under box.
    anchor = {headX: 1 - svg.scaledWidth_ / 2, headY: 2, headR: 0};
  }

  // Align the text above the user.
  var cursorX = anchor ? anchor.headX : 0;
  // Don't overflow the right edge.
  cursorX = Math.min(cursorX, svg.scaledWidth_ / 2 - textBBox.width / 2 - 1);
  // Don't overflow the left edge.
  cursorX = Math.max(cursorX, textBBox.width / 2 - svg.scaledWidth_ / 2 + 1);
  cursorX -= textBBox.x + textBBox.width / 2;
  textGroup.setAttribute('transform', 'translate(' + cursorX + ', 2)');
  CCC.World.drawBubble(memo.type, bubbleGroup, textGroup, anchor);
  // Record the appended DOM elements so that they may be removed if more
  // text needs to be appended.
  svg.lastBubbleGroup_ = bubbleGroup;
  svg.lastBubbleText_ = textGroup;
  svg.lastPlainText_ = text;
};

/**
 * Find the location of the actor who is initiating a bubble.
 * @param {!Object} memo JSON structure.
 * @param {!SVGElement} svg SVG Element to place the text and bubble.
 * @return {Object} Provides headX, headY, and headR properties.
 */
CCC.World.getAnchor = function(memo, svg) {
  var anchor = null;
  try {
    if ((memo.where && memo.where === CCC.World.scene.where) || memo.source) {
      anchor = svg.sceneUserLocations[memo.source] ||
               svg.sceneObjectLocations[memo.source];
    }
  } catch (e) {
    // No anchor.  Simpler to try/catch than to check every step.
  }
  return anchor;
};

/**
 * Return the object's bounding box, compensating for any transform-translate.
 * @param {!Element} element Element to measure.
 * @return {!Object} Height, width, x and y.
 */
CCC.World.getBBoxWithTransform = function(element) {
  var bBox = element.getBBox();
  // getBBox doesn't look at element's transform="translate(...)".
  var transform = element.getAttribute('transform');
  var r = transform && transform.match(
      /translate\(\s*([-+\d.e]+)([ ,]\s*([-+\d.e]+)\s*\))?/);
  if (r) {
    bBox.x += parseFloat(r[1]);
    if (r[3]) {
      bBox.y += parseFloat(r[3]);
    }
  }
  return bBox;
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
  var contentBBox = CCC.World.getBBoxWithTransform(contentGroup);
  // Draw a solid black bubble, then the arrow (with border), then a slightly
  // smaller solid white bubble, resulting in a clean border.
  if (type === 'think') {
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
      var radiusAverage = (d === dx) ? radiusXAverage : radiusYAverage;
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
      var cursor = (d === dx) ? x : y;
      for (var i = 0; i < line.length; i++) {
        var r = line[i];
        var puff;
        if (d === dx) {
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
    for (var puff of puffs) {
      CCC.Common.createSvgElement('ellipse',
          {'class': 'bubbleBG',
           'cx': puff.cx, 'cy': puff.cy,
           'rx': puff.rx + inflateRadius + strokeWidth,
           'ry': puff.ry + inflateRadius + strokeWidth},
           bubbleGroup);
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
    for (var puff of puffs) {
      CCC.Common.createSvgElement('ellipse',
          {'class': 'bubbleFG',
           'cx': puff.cx, 'cy': puff.cy,
           'rx': puff.rx + inflateRadius, 'ry': puff.ry + inflateRadius},
           bubbleGroup);
    }
    if (opt_anchor) {
      bubbleGroup.appendChild(
          CCC.World.drawArrow_(contentBBox, opt_anchor, true));
    }
  } else {
    if (type === 'say') {
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
      bubbleGroup.appendChild(
          CCC.World.drawArrow_(contentBBox, opt_anchor, false));
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
 * @param {boolean} thought True if a thought bubble, false for solid arrow.
 * @return {!Element} Path for arrow.
 * @private
 */
CCC.World.drawArrow_ = function(contentBBox, anchor, thought) {
  // Find the relative coordinates of the center of the bubble.
  var relBubbleX = contentBBox.width / 2;
  var relBubbleY = contentBBox.height / 2;
  // Find the relative coordinates of the center of the anchor.
  var relAnchorX = anchor.headX - contentBBox.x;
  var relAnchorY = anchor.headY - contentBBox.y;
  if (relBubbleX === relAnchorX && relBubbleY === relAnchorY) {
    // Null case.  Bubble is directly on top of the anchor.
    // Short circuit this rather than wade through divide by zeros.
    return CCC.Common.createSvgElement('g', {}, null);
  }
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

  // Distortion to curve the arrow.
  var swirlAngle = angle + Math.random() - 0.5;
  if (swirlAngle > Math.PI * 2) {
    swirlAngle -= Math.PI * 2;
  }
  var swirlRise = Math.sin(swirlAngle) * hypotenuse / CCC.World.ARROW_BEND;
  var swirlRun = Math.cos(swirlAngle) * hypotenuse / CCC.World.ARROW_BEND;

  if (thought) {
    var group = CCC.Common.createSvgElement('g', {class: 'fillWhite'}, null);
    // The commented out code below is a guide path to verify the placement of
    // the thought bubbles which make up the arrow.
    //var d = 'M' + relBubbleX + ',' + relBubbleY +
    //    ' Q' + (relBubbleX + swirlRun) + ',' + (relBubbleY + swirlRise) +
    //    ' ' + relAnchorX + ',' + relAnchorY;
    //CCC.Common.createSvgElement('path', {'d': d}, group);
    /**
     * Given two x/y points, find the point at the specified distance between.
     * @param {number} x1 Horizontal position of first point.
     * @param {number} y1 Vertical position of first point.
     * @param {number} x2 Horizontal position of second point.
     * @param {number} y2 Vertical position of second point.
     * @param {number} t Interpolation distance (0.0 - 1.0).
     * @return {!Object} Contains x and y properties.
     */
    var interpolate = function(x1, y1, x2, y2, t) {
      var x = t * (x2 - x1) + x1;
      var y = t * (y2 - y1) + y1;
      return {x: x, y: y};
    };
    // Pythagorean theorem for approximate length of arrow
    // (doesn't count the added length caused by the bend).
    var length = Math.sqrt(Math.pow(relBubbleX - relAnchorX, 2) +
                           Math.pow(relBubbleY - relAnchorY, 2));
    var t = 0;
    while (t < 1) {
      // Add a little bubble on the arrow's path.
      // Compute point on a quadratic curve.
      var q1 = interpolate(relBubbleX, relBubbleY,
                           relBubbleX + swirlRun, relBubbleY + swirlRise, t);
      var q2 = interpolate(relBubbleX + swirlRun, relBubbleY + swirlRise,
                           relAnchorX, relAnchorY, t);
      var p = interpolate(q1.x, q1.y, q2.x, q2.y, t);
      // The bubble's radius gets smaller as one gets closer to the anchor.
      var ry = (1 - t) * 2 + 1;
      if (p.y > contentBBox.height + ry) {
        CCC.Common.createSvgElement('ellipse',
            {'rx': ry * 1.5, 'ry': ry, 'cx': p.x, 'cy': p.y}, group);
        // Place next bubble three radii away from this bubble.
        t += 3 * ry / length;
      } else {
        // Skip this bubble, since it is over the main thought bubble.
        t += 0.1;
      }
    }
    return group;
  } else {
    // Coordinates for the base of the arrow.
    var baseX1 = relBubbleX + thickness * rightRun;
    var baseY1 = relBubbleY + thickness * rightRise;
    var baseX2 = relBubbleX - thickness * rightRun;
    var baseY2 = relBubbleY - thickness * rightRise;

    var steps = ['M' + baseX1 + ',' + baseY1];
    steps.push('C' + (baseX1 + swirlRun) + ',' + (baseY1 + swirlRise) +
               ' ' + relAnchorX + ',' + relAnchorY +
               ' ' + relAnchorX + ',' + relAnchorY);
    steps.push('C' + relAnchorX + ',' + relAnchorY +
               ' ' + (baseX2 + swirlRun) + ',' + (baseY2 + swirlRise) +
               ' ' + baseX2 + ',' + baseY2);
    steps.push('z');
    return CCC.Common.createSvgElement('path',
            {'class': 'bubbleArrow', 'd': steps.join(' ')}, null);
  }
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
 * @param {!Element} historyElement Rendered history panel.
 */
CCC.World.publishHistory = function(historyElement) {
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
  panelDiv.appendChild(historyElement);
  CCC.World.stripActions(panelDiv);
  var iframeId = historyElement.getAttribute('data-iframe-id');
  if (iframeId) {
    var iframe = document.getElementById(iframeId);
    CCC.World.positionIframe(iframe, panelDiv);
    // Add <img height=21 width=21 src="close.png" title="Close iframe">
    var closeImg = new Image(21, 21);
    closeImg.className = 'iframeClose';
    closeImg.src = STATIC_URL + 'connect/close.png';
    closeImg.title = CCC.World.getTemplate('closeIframeTemplate');
    closeImg.addEventListener('click', function() {
      closeImg.style.display = 'none';
      panelDiv.firstChild.style.visibility = 'visible';  // SVG.
      CCC.World.removeNode(iframe);
    }, false);
    // Add event handler on <g class="iframeRelaunch"> element.
    var group = panelDiv.querySelector('g.iframeRelaunch');
    group.addEventListener('click', function() {
      var iframeSrc = group.getAttribute('data-iframe-src');
      iframeId = CCC.World.createIframe(iframeSrc);
      iframe = document.getElementById(iframeId);
      var div = historyElement.parentNode;
      CCC.World.positionIframe(iframe, div);
      div.firstChild.style.visibility = 'hidden';  // SVG.
      div.lastChild.style.display = 'inline';  // Close button.
    }, false);
    panelDiv.appendChild(closeImg);
  } else {
    CCC.World.svgZoom(historyElement);
    // The occasional (non-iframe) panel should lack a border.
    var connectDiv = historyElement.firstChild &&
        historyElement.firstChild.className === 'connectDiv';
    if (!connectDiv && (Math.random() < 1 / 16)) {
      panelDiv.style.borderColor = '#fff';
    }
    // While being built, the SVG was hidden.
    // Make it visible, unless there is an iframe displayed on top of it.
    historyElement.style.visibility = 'visible';
  }
  CCC.World.scrollDiv.scrollTop = CCC.World.scrollDiv.scrollHeight;

  if (!CCC.World.panelWidths.length) {
    CCC.World.historyRow = null;  // Next row.
  }
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
  var content = CCC.World.scratchPanorama.cloneNode(true);
  CCC.World.panoramaDiv.appendChild(content);
  var iframeId = content.getAttribute('data-iframe-id');
  if (iframeId) {
    var iframe = document.getElementById(iframeId);
    CCC.World.positionIframe(iframe, CCC.World.panoramaDiv);
  } else {
    content.style.visibility = 'visible';
    CCC.World.svgZoom(content);
    // Add event handlers on all <a class="command"> links.
    var commands = content.querySelectorAll('a.command');
    for (var command of commands) {
      command.addEventListener('click', CCC.Common.commandFunction, false);
    }
    // Add event handlers on all <svg class="menuIcon"> menus.
    var menus = content.querySelectorAll('svg.menuIcon');
    for (var menu of menus) {
      menu.addEventListener('click', CCC.Common.openMenu, false);
    }
    // Add an event handler to a reload icon.
    var icon = content.querySelector('.connectionIcon[src$="#reload"]');
    if (icon) {
      icon.addEventListener('click',
          parent.location.reload.bind(parent.location));
      icon.title = CCC.World.getTemplate('reconnectTemplate');
    }
  }
};

/**
 * Find all SVG images with viewBox="0 0 0 0" attribute and resize them to fit.
 * @param {!Element} container DOM node for panel.
 */
CCC.World.svgZoom = function(container) {
  var svgNodes = container.getElementsByTagName('svg');
  for (var svg of svgNodes) {
    var viewBox = svg.getAttribute('viewBox');
    if (viewBox && viewBox.match(/^\s*0\s+0\s+0\s+0\s*$/)) {
      //var outerSize = svg.getBoundingClientRect();
      var bBox = svg.getBBox();
      var height = bBox.height + 1; // Add half the stroke width to each side.
      var width = bBox.width + 1;
      var x = bBox.x - 0.5;
      var y = bBox.y - 0.5;
      svg.setAttribute('viewBox', x + ' ' + y + ' ' + width + ' ' + height);
    }
  }
};

/**
 * Absolutely position an iframe so that it fits exactly inside a comic panel.
 * @param {!Element} iframe DOM node for iframe.
 * @param {!Element} container DOM node for panel.
 */
CCC.World.positionIframe = function(iframe, container) {
  var borderWidth = 2;
  iframe.style.width = (container.offsetWidth - borderWidth * 2) + 'px';
  iframe.style.height = (container.offsetHeight - borderWidth * 2) + 'px';
  var x = 0;
  var y = 0;
  do {
    x += container.offsetLeft;
    y += container.offsetTop;
  } while ((container = container.offsetParent) &&
           (container !== CCC.World.scrollDiv));
  iframe.style.top = (y + borderWidth) + 'px';
  iframe.style.left = (x + borderWidth) + 'px';
};

/**
 * Strip all command links and menus.  History panels should not be interactive.
 * @param {!Element} div History panel div.
 */
CCC.World.stripActions = function(div) {
  var menus = div.querySelectorAll('svg.menuIcon');
  for (var menu of menus) {
    menu.parentNode.removeChild(menu);
  }
  var commands = div.querySelectorAll('a.command');
  for (var command of commands) {
    command.className = 'disabled';
  }
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
  <filter id="whiteShadow25501663536281627" filterUnits="userSpaceOnUse">
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
  var filter = CCC.Common.createSvgElement('filter',
      {'id': id, 'filterUnits': 'userSpaceOnUse'}, svg);
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
 * @param {string} src URL of target.
 * @return {string} The iframe's UUID.
 */
CCC.World.createIframe = function(src) {
  var iframe = document.createElement('iframe');
  iframe.id = 'iframe' +  (Math.random() + '').substring(2);
  iframe.sandbox = 'allow-forms allow-scripts allow-same-origin';
  iframe.src = src;
  document.getElementById('iframeStorage').appendChild(iframe);
  return iframe.id;
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
  if (width === CCC.World.lastWidth) {
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
  CCC.World.scene = {};
  // Create new history.
  var msgs = CCC.World.historyMessages.concat(CCC.World.panoramaMessages);
  CCC.World.historyMessages.length = 0;
  CCC.World.panoramaMessages.length = 0;
  for (var msg of msgs) {
    CCC.World.renderMessage(msg);
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
  var body = CCC.World.xmlToHtml(dom.body);
  CCC.Common.autoHyperlink(body);
  return body;
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
    case Node.ELEMENT_NODE:
      if (dom.tagName === 'svg') {  // XML tagNames are lowercase.
        // Switch to SVG rendering mode.
        return CCC.World.xmlToSvg(dom);
      }
      if (dom.tagName === 'CMDS') {  // HTML tagNames are uppercase.
        return CCC.Common.newMenuIcon(dom);
      }
      if (dom.tagName === 'CMD') {  // HTML tagNames are uppercase.
        var cmdText = dom.innerText;
        var a = document.createElement('a');
        a.className = 'command';
        a.appendChild(document.createTextNode(cmdText));
        return a;
      }
      if (CCC.World.xmlToHtml.ELEMENT_NAMES &&
          !CCC.World.xmlToHtml.ELEMENT_NAMES.has(dom.tagName)) {
        console.log('HTML element not in whitelist: <' + dom.tagName + '>');
        return null;
      }
      var element = document.createElement(dom.tagName);
      for (var attr of dom.attributes) {
        if (CCC.World.xmlToHtml.ATTRIBUTE_NAMES &&
            !CCC.World.xmlToHtml.ATTRIBUTE_NAMES.has(attr.name)) {
          console.log('HTML attribute not in whitelist: ' +
              '<' + dom.tagName + ' ' + attr.name + '="' + attr.value + '">');
        } else {
          element.setAttribute(attr.name, attr.value);
          // Remove all styles not in the whitelist.
          if (attr.name === 'style') {
            for (var name in element.style) {
              if (element.style.hasOwnProperty(name) &&
                  isNaN(parseFloat(name)) && // Don't delete indexed props.
                  element.style[name] && element.style[name] !== 'initial' &&
                  CCC.World.xmlToHtml.STYLE_NAMES &&
                  !CCC.World.xmlToHtml.STYLE_NAMES.has(name)) {
                console.log('Style attribute not in whitelist: ' +
                    name + ': ' + element.style[name]);
                element.style[name] = '';
              }
            }
          }
        }
      }
      for (var childDom of dom.childNodes) {
        var childNode = CCC.World.xmlToHtml(childDom);
        if (childNode) {
          element.appendChild(childNode);
        }
      }
      return element;
    case Node.TEXT_NODE:
      return document.createTextNode(dom.data);
    case Node.COMMENT_NODE:
      return null;
  }
  console.log('Unknown HTML node type: ' + dom);
  return null;
};

/**
 * Whitelist of all allowed HTML element names.
 * 'svg' element is handled separately.
 * Set to null to disable filtering.
 */
CCC.World.xmlToHtml.ELEMENT_NAMES = new Set([
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
]);

/**
 * Whitelist of all allowed HTML property names.
 * This architecture assumes that there are no banned properties
 * on one element type which are allowed on another.
 * Set to null to disable filtering.
 */
CCC.World.xmlToHtml.ATTRIBUTE_NAMES = new Set([
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
]);

/**
 * Whitelist of all allowed style property names.
 * Set to null to disable filtering.
 */
CCC.World.xmlToHtml.STYLE_NAMES = new Set([
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
]);

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
    case Node.ELEMENT_NODE:
      if (CCC.World.xmlToSvg.ELEMENT_NAMES &&
          !CCC.World.xmlToSvg.ELEMENT_NAMES.has(dom.tagName)) {
        console.log('SVG element not in whitelist: <' + dom.tagName + '>');
        return null;
      }
      var svg = document.createElementNS(CCC.Common.NS, dom.tagName);
      for (var attr of dom.attributes) {
        if (CCC.World.xmlToSvg.ATTRIBUTE_NAMES &&
            !CCC.World.xmlToSvg.ATTRIBUTE_NAMES.has(attr.name)) {
          console.log('SVG attribute not in whitelist: ' +
              '<' + dom.tagName + ' ' + attr.name + '="' + attr.value + '">');
        } else {
          // Remove all styles not in the whitelist.
          if (attr.name === 'class') {
            var classes = attr.value.split(/\s+/g);
            for (var i = classes.length - 1; i >= 0; i--) {
              if (CCC.World.xmlToSvg.CLASS_NAMES &&
                  !CCC.World.xmlToSvg.CLASS_NAMES.has(classes[i])) {
                console.log('Class name not in whitelist: ' + classes[i]);
                classes.splice(i, 1);
              }
            }
            attr.value = classes.join(' ');
          }
          svg.setAttribute(attr.name, attr.value);
        }
      }
      for (var childDom of dom.childNodes) {
        var childSvg = CCC.World.xmlToSvg(childDom);
        if (childSvg) {
          svg.appendChild(childSvg);
        }
      }
      return svg;
    case Node.TEXT_NODE:
      return document.createTextNode(dom.data);
    case Node.COMMENT_NODE:
      return null;
  }
  console.log('Unknown XML node type: ' + dom);
  return null;
};

/**
 * Whitelist of all allowed SVG element names.
 * Try to keep this list in sync with Code.svgEditor.ELEMENT_NAMES.
 * Set to null to disable filtering.
 */
CCC.World.xmlToSvg.ELEMENT_NAMES = new Set([
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
]);

/**
 * Whitelist of all allowed SVG property names.
 * This architecture assumes that there are no banned properties
 * on one element type which are allowed on another.
 * Set to null to disable filtering.
 */
CCC.World.xmlToSvg.ATTRIBUTE_NAMES = new Set([
  'class',
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
  'viewBox',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
  'width',
]);

/**
 * Whitelist of all allowed class names.
 * Set to null to disable filtering.
 */
CCC.World.xmlToSvg.CLASS_NAMES = new Set([
  'fillNone',
  'fillWhite',
  'fillBlack',
  'fillGrey', 'fillGray',
  'strokeNone',
  'strokeWhite',
  'strokeBlack',
  'strokeGrey', 'strokeGray',
]);

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
 * Gets the template with the given key from the document.
 * @param {string} key The key of the document element.
 * @return {string} The textContent of the specified element.
 */
CCC.World.getTemplate = function(key) {
  var element = document.getElementById(key);
  if (!element) {
    throw new Error('Unknown template ' + key);
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
  if (w1 === w2) {
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
  text = CCC.World.wrap(svg, text, width, height);
  text = CCC.Common.escapeSpaces(text);
  var lines = text.split('\n');
  var textNode = document.createElementNS(CCC.Common.NS, 'text');
  textNode.setAttribute('alignment-baseline', 'hanging');
  if (lines.length) {
    var dy = CCC.World.measureText(svg, 'Wg').height;
    for (var line of lines) {
      if (line === '\r' || line === '\n') {
        line = '\u200B';  // Zero-width space.
      }
      var tspan = document.createElementNS(CCC.Common.NS, 'tspan');
      tspan.appendChild(document.createTextNode(line));
      tspan.setAttribute('x', 0);
      tspan.setAttribute('dy', dy);
      textNode.appendChild(tspan);
    }
  }
  var g = document.createElementNS(CCC.Common.NS, 'g');
  CCC.Common.autoHyperlink(textNode);
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
  if (text.length > 1024) {
    // This algorithm doesn't scale to large texts.
    // Large texts shouldn't be in speech bubbles anyway.
    return text;
  }
  var minWidth = width;
  var maxWidth = svg.scaledWidth_ - 10;
  var measuredWidth, measuredHeight;
  var dy = CCC.World.measureText(svg, 'Wg').height;
  function wrapForWidth(width) {
    measuredWidth = 0;
    measuredHeight = 0;
    var paragraphs = text.split('\n');
    for (var i = 0; i < paragraphs.length; i++) {
      paragraphs[i] = CCC.World.wrapLine_(svg, paragraphs[i], width);
      var lines = paragraphs[i].split('\n');
      for (var line of lines) {
        var size = CCC.World.measureText(svg, line);
        measuredWidth = Math.max(measuredWidth, size.width);
        measuredHeight += dy;
      }
    }
    return paragraphs.join('\n');
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
  for (var word of words) {
    limit = Math.max(CCC.World.measureText(svg, word).width, limit);
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
    if ('.?!'.includes(lastLetter)) {
      score += 6;
    } else if (',;)]}'.includes(lastLetter)) {
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
    if (wordBreaks[i] === wordBreaks[i + 1]) {
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

if (!window.TEST) {
  window.addEventListener('message', CCC.World.receiveMessage, false);
  window.addEventListener('load', CCC.World.init, false);

  // Temporary disabling of SVG filters.  June 2020
  CCC.World.xmlToSvg.ELEMENT_NAMES = null;
  CCC.World.xmlToSvg.ATTRIBUTE_NAMES = null;
  CCC.World.xmlToSvg.CLASS_NAMES = null;
}
