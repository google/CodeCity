/**
 * @license
 * Copyright 2018 Google LLC
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
'use strict';

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
Code.ObjectPanel.tableBody = null;

/**
 * Structured data from Code City.
 * @type {?Object}
 */
Code.ObjectPanel.data = null;

/**
 * Page has loaded, initialize the panel.  Called by Code City with data.
 */
Code.ObjectPanel.init = function() {
  Code.ObjectPanel.tableBody = document.getElementById('objectTableBody');
  // Clear the '...'
  Code.ObjectPanel.tableBody.innerHTML = '';
  var data = Code.ObjectPanel.data;
  if (!data) {
    // Server error.  Should not happen.
    var title = document.getElementById('objectTitle');
    title.className = 'objectFailTitle';
    var fail = document.getElementById('objectFail');
    fail.style.display = 'table-row';
    return;
  }
  if (data.roots) {
    // Print all root objects.
    for (var root of data.roots) {
      var part = {type: 'id', value: root.name};
      Code.ObjectPanel.addLink(part, root.type, false);
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

  // Position the type symbols, and monitor for layout changes.
  Code.ObjectPanel.positionTypes();
  window.addEventListener('scroll', Code.ObjectPanel.positionTypes, false);
  window.addEventListener('resize', Code.ObjectPanel.positionTypes, false);

  // Highlight current item, and monitor for path changes.
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
  a.href = '/code?' + encodeURIComponent(selector);
  a.target = '_blank';
  a.setAttribute('data-link', JSON.stringify(part));
  a.addEventListener('click', Code.ObjectPanel.click);
  var text = document.createTextNode(Code.Common.partsToSelector([part]));
  a.appendChild(text);
  var td = document.createElement('td');
  if (section) {
    td.className = 'section';
  }
  var typeSymbol = Code.ObjectPanel.TYPES[type];
  if (typeSymbol) {
    var div = document.createElement('div');
    div.className = 'objectType';
    div.appendChild(document.createTextNode(typeSymbol));
    div.title = type;
    td.appendChild(div);
  }
  td.appendChild(a);
  var tr = document.createElement('tr');
  tr.appendChild(td);
  Code.ObjectPanel.tableBody.appendChild(tr);
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
 * When scrollbar is moved or size changes reposition the floating types.
 */
Code.ObjectPanel.positionTypes = function() {
  var left = (document.body.clientWidth + window.scrollX - 18) + 'px';
  var types = document.getElementsByClassName('objectType');
  for (var t of types) {
    t.style.left = left;
  }
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
  for (var tr of Code.ObjectPanel.tableBody.childNodes) {
    var td = tr.firstChild;
    var link = td.firstChild;
    if (link.getAttribute('data-link') === jsonPart) {
      newHighlighted = td;
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
  for (var datum of data) {
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
    datum.sort(Code.ObjectPanel.caseInsensitiveComp);
  }
};

/**
 * Comparison function to sort named objects A-Z without regard to case.
 * @param {string} a One string.
 * @param {string} b Another string.
 * @return {number} -1/0/1 comparator value.
 */
Code.ObjectPanel.caseInsensitiveComp = function(a, b) {
  return a.name.toLowerCase().localeCompare(a.name.toLowerCase());
};

if (!window.TEST) {
  (function() {
    // Load the data from Code City.
    var hash = location.hash.substring(1);
    var script = document.createElement('script');
    script.src = '/code/objectPanel?parts=' + hash;
    document.head.appendChild(script);

    // Fill in the object name.
    Code.ObjectPanel.parts = JSON.parse(decodeURIComponent(hash));
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
}
