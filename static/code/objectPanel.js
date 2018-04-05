/**
 * @license
 * Code City: Code Object Panel.
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
 * @fileoverview Integrated Development Environment for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

Code.ObjectPanel = {};

/**
 * List of parts (passed in by the URL hash).
 * @type {?Array<!Object>}
 */
Code.ObjectPanel.parts = null;

/**
 * DOM node containing the list of properties.
 * @type {?Element}
 */
Code.ObjectPanel.results = null;

/**
 * Structured data from Code City.
 * @type {?Object}
 */
Code.ObjectPanel.data = null;

/**
 * Page has loaded, initialize the panel.  Called by Code City with data.
 */
Code.ObjectPanel.init = function() {
  // Clear the '...'
  results = document.getElementById('objectResults');
  results.innerHTML = '';
  results.className = '';
  var data = Code.ObjectPanel.data;
  if (!data) {
    // Server error.  Should not happen.
    var title = document.getElementById('objectTitle');
    title.className = 'objectFailTitle';
    var fail = document.getElementById('objectFail');
    fail.style.display = 'block';
    return;
  }
  if (data.roots) {
    // Print all root objects.
    for (var i = 0; i < data.roots.length; i++) {
      var part = {type: 'id', value: data.roots[i].name};
      Code.ObjectPanel.addLink(part, data.roots[i].type, false);
    }
  }
  if (data.properties) {
    Code.ObjectPanel.filterShadowed(data.properties);
    // Print all properties of this object.
    for (var i = 0; i < data.properties.length; i++) {
      var propList = data.properties[i];
      for (var j = 0; j < propList.length; j++) {
        var part = {type: 'id', value: propList[j].name};
        Code.ObjectPanel.addLink(part, propList[j].type, i && !j);
      }
    }
    var part = {type: '^'};
    Code.ObjectPanel.addLink(part, 'object', true);
  }

  // Highlight current item, and monitor for changes.
  Code.ObjectPanel.highlight();
  window.addEventListener('message', Code.ObjectPanel.highlight, false);
};

/**
 * Create the DOM elements to add one property link to the list.
 * @param {!Object} part Single selector part.
 * @param {string} type Type of the property value.
 * @param {boolean} section Flag indicating a new section.
 */
Code.ObjectPanel.addLink = function(part, type, section) {
  var newParts = Code.ObjectPanel.parts.concat(part);
  var selector = Code.Common.partsToSelector(newParts);
  var a = document.createElement('a');
  a.href = '/code?' + encodeURI(selector);
  a.target = '_blank';
  a.setAttribute('data-link', JSON.stringify(part));
  a.addEventListener('click', Code.ObjectPanel.click);
  var typeSymbol = Code.ObjectPanel.TYPES[type];
  if (typeSymbol) {
    var span = document.createElement('span');
    span.className = 'objectType';
    span.appendChild(document.createTextNode(typeSymbol));
    span.title = type;
    a.appendChild(span);
  }
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(Code.Common.partsToSelector([part])));
  if (section) {
    div.className = 'section';
  }
  a.appendChild(div);
  results.appendChild(a);
};

/**
 * Symbols to print next to properties.
 */
Code.ObjectPanel.TYPES = {
  'object': '{}',
  'symbol': '☆',
  'function': '𝑓'
};

/**
 * When a property is clicked, trigger an update.
 * @param {!Event} e Click event.
 */
Code.ObjectPanel.click = function(e) {
  var part = JSON.parse(e.currentTarget.getAttribute('data-link'));
  var newParts = Code.ObjectPanel.parts.concat(part);
  var selector = Code.Common.partsToSelector(newParts);
  // Store the new selector in sessionStorage for all frames to see.
  sessionStorage.setItem(Code.Common.SELECTOR, selector);
  // Alert the top "/code" frameset that there's been a selector change.
  window.parent.parent.postMessage('ping', '*');
  // Don't navigate to this link.
  e.preventDefault();
};

/**
 * Currently selected property, or null if none.
 * @type {?Element}
 */
Code.ObjectPanel.highlighted = null;

/**
 * Highlight the currently selected property (if any).
 * The current selection is based on a value in sessionStorage.
 */
Code.ObjectPanel.highlight = function() {
  var selector = sessionStorage.getItem(Code.Common.SELECTOR);
  var parts = Code.Common.selectorToParts(selector);
  var part = parts ? parts[Code.ObjectPanel.parts.length] : null;
  var jsonPart = JSON.stringify(part);
  var newHighlighted = null;
  for (var i = 0, link; (link = results.childNodes[i]); i++) {
    if (link.getAttribute('data-link') === jsonPart) {
      newHighlighted = link;
    }
  }
  if (newHighlighted !== Code.ObjectPanel.highlighted) {
    if (Code.ObjectPanel.highlighted) {
      Code.ObjectPanel.highlighted.className = '';
    }
    if (newHighlighted) {
      newHighlighted.className = 'highlighted';
      if (newHighlighted.scrollIntoView) {
        newHighlighted.scrollIntoView({block: 'nearest', inline: 'nearest'});
      }
    }
    Code.ObjectPanel.highlighted = newHighlighted;
  }
};

/**
 * Remove any properties that are shadowed by objects higher on the inheritance
 * chain.  Also sort the properties alphabetically.
 * @param {Array<!Array<!Object>>} data Property names from Code City.
 */
Code.ObjectPanel.filterShadowed = function(data) {
  if (!data || data.length < 2) {
    return;
  }
  var seen = Object.create(null);
  for (var i = 0; i < data.length; i++) {
    var datum = data[i];
    var cursorInsert = 0;
    var cursorRead = 0;
    while (cursorRead < datum.length) {
      var prop = datum[cursorRead++];
      if (!seen[prop.name]) {
        seen[prop.name] = true;
        datum[cursorInsert++] = prop;
      }
    }
    datum.length = cursorInsert;
    data[i].sort(Code.ObjectPanel.caseInsensitiveComp);
  }
};

/**
 * Comparison function to sort named objects A-Z without regard to case.
 * @param {string} a One string.
 * @param {string} b Another string.
 * @return {number} -1/0/1 comparator value.
 */
Code.ObjectPanel.caseInsensitiveComp = function(a, b) {
  a = a.name.toLowerCase();
  b = b.name.toLowerCase();
  return (a < b) ? -1 : ((a > b) ? 1 : 0);
};

(function() {
  // Load the data from Code City.
  var hash = location.hash.substring(1);
  var script = document.createElement('script');
  script.src = '/code/objectPanel?parts=' + hash;
  document.head.appendChild(script);

  // Fill in the object name.
  Code.ObjectPanel.parts = JSON.parse(decodeURI(hash));
  var div = document.getElementById('objectTitle');
  var lastPart = Code.ObjectPanel.parts[Code.ObjectPanel.parts.length - 1];
  var name;
  if (!lastPart) {
    name = 'Globals';
  } else if (Code.ObjectPanel.parts.length === 1) {
    // Render as 'foo' or '[42]' or '["???"]' or '^'.
    name = Code.Common.partsToSelector([lastPart]);
  } else {
    // Render as '.foo' or '[42]' or '["???"]' or '^'.
    var mockParts = [{type: 'id', value: 'X'}, lastPart];
    name = Code.Common.partsToSelector(mockParts).substring(1);
  }
  div.innerHTML = '';
  div.appendChild(document.createTextNode(name));
})();

window.addEventListener('load', Code.ObjectPanel.init);
