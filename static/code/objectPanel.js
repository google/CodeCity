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
 * @type {?Array<string>}
 */
Code.ObjectPanel.parts = null;

/**
 * DOM node containing the list of properties.
 * @type {?Element}
 */
Code.ObjectPanel.results = null;

/**
 * Page has loaded, initialize the panel.  Called by Code City with data.
 * @param {!Object} data Structured data from Code City.
 */
Code.ObjectPanel.init = function(data) {
  // Clear the '...'
  results = document.getElementById('objectResults');
  results.innerHTML = '';
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
      Code.ObjectPanel.addLink(data.roots[i]);
    }
  }
  if (data.properties) {
    // Print all properties of this object.
    for (var i = 0; i < data.properties.length; i++) {
      var propList = data.properties[i];
      for (var j = 0; j < propList.length; j++) {
        Code.ObjectPanel.addLink(propList[j]);
      }
    }
  }

  // Highlight current item, and monitor for changes.
  Code.ObjectPanel.highlight();
  window.addEventListener('message', Code.ObjectPanel.highlight, false);
};

/**
 * Create the DOM to add one property link to the list.
 * @param {string} name Property name.
 */
Code.ObjectPanel.addLink = function(name) {
  var newParts = Code.ObjectPanel.parts.concat(name);
  var selector = Code.Common.partsToSelector(newParts);
  var div = document.createElement('div');
  var a = document.createElement('a');
  a.href = '/code?' + encodeURI(selector);
  a.target = '_blank';
  div.appendChild(document.createTextNode(name));
  a.appendChild(div);
  a.setAttribute('data-link', name);
  a.addEventListener('click', Code.ObjectPanel.click);
  results.appendChild(a);
};

Code.ObjectPanel.click = function(e) {
  var name = e.currentTarget.getAttribute('data-link');
  var newParts = Code.ObjectPanel.parts.concat(name);
  var selector = Code.Common.partsToSelector(newParts);
  sessionStorage.setItem(Code.Common.SELECTOR, selector);
  window.parent.parent.postMessage('ping', '*');
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
  var newHighlighted = null;
  for (var i = 0, link; (link = results.childNodes[i]); i++) {
    if (link.getAttribute('data-link') === part) {
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

(function() {
  // Load the data from Code City.
  var hash = location.hash.substring(1);
  var script = document.createElement('script');
  script.src = '/code/objectPanel?parts=' + hash;
  document.head.appendChild(script);

  // Fill in the object name.
  Code.ObjectPanel.parts = JSON.parse(decodeURI(hash));
  var div = document.getElementById('objectTitle');
  var name = Code.ObjectPanel.parts[Code.ObjectPanel.parts.length - 1];
  if (!name) {
    name = 'Globals';
  } else if (Code.ObjectPanel.parts.length > 1) {
    name = Code.Common.partsToSelector(['X', name]).substring(1);
  }
  div.innerHTML = '';
  div.appendChild(document.createTextNode(name));
})();
