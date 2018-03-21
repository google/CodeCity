/**
 * @license
 * Code City: Code Explorer.
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

Code.Explorer = {};

// Common DOM elements.
var input;
var menuDiv;
var scrollDiv;

/**
 * Width in pixels of each monospaced character in the input.
 * Used to line up the autocomplete menu.
 */
Code.Explorer.SIZE_OF_INPUT_CHARS = 10.8;

var oldInputValue;
var oldInputPartsJSON;
var oldInputPartsLast;
var inputPollPid = 0;

/**
 * Raw string of selector.
 * E.g. '$.foo["bar"]'
 */
Code.Explorer.selector = '';

/**
 * Got a ping from someone.  Something might have changed and need updating.
 */
Code.Explorer.receiveMessage = function() {
  // Check to see if the stored values have changed.
  var selector = sessionStorage.getItem(Code.Common.SELECTOR);
  if (selector === Code.Explorer.selector) {
    return;
  }
  // Propagate the ping down the tree of frames.
  Code.Explorer.selector = selector;
  if (oldInputValue !== selector) {
    var parts = Code.Common.selectorToParts(selector);
    setInput(parts);
  }
};

// Handle any changes to the input field.
function inputChange() {
  if (oldInputValue === input.value) {
    return;
  }
  oldInputValue = input.value;
  var tokens = Code.Common.tokenizeSelector(input.value);
  var parts = [];
  var lastToken = null;
  var lastName = null;
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    lastToken = token;
    if (token.type === 'id' || token.type === '"' || token.type === '#') {
      lastName = token;
    }
    if (!token.valid) {
      break;
    }
    if ((token.type === '.' || token.type === '[' || token.type === ']') &&
        lastName) {
      parts.push(lastName.value);
      lastName = null;
    }
  }
  oldInputPartsLast = lastName;
  var partsJSON = JSON.stringify(parts);
  if (oldInputPartsJSON === partsJSON) {
    updateAutocompleteMenu(lastToken);
  } else {
    oldInputPartsJSON = partsJSON;
    sendAutocomplete(partsJSON);
    hideAutocompleteMenu();
    Code.Explorer.loadPanels(parts);
  }
}

// Send a request to Code City's autocomplete service.
function sendAutocomplete(partsJSON) {
  var xhr = sendAutocomplete.httpRequest;
  xhr.abort();
  xhr.open('POST', '/code/autocomplete', true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.onreadystatechange = receiveAutocomplete;
  xhr.send('parts=' + encodeURIComponent(partsJSON));
  console.log('Sending to CC: ' + partsJSON);
}
sendAutocomplete.httpRequest = new XMLHttpRequest();

// Got a response from Code City's autocomplete service.
function receiveAutocomplete() {
  var xhr = sendAutocomplete.httpRequest;
  if (xhr.readyState !== 4) {
    return;  // Not ready yet.
  }
  if (xhr.status !== 200) {
    console.warn('Autocomplete returned status ' + xhr.status);
    return;
  }
  var data = JSON.parse(xhr.responseText);
  filterShadowed(data);
  autocompleteData = data || [];
  // Trigger the input to show autocompletion.
  oldInputValue = undefined;
  inputChange();
}

function updateAutocompleteMenu(token) {
  var prefix = '';
  var index = token ? token.index : 0;
  if (token) {
    if (token.type === 'id' || token.type === '"') {
      prefix = token.value.toLowerCase();
    }
    if ((token.type === '#') && !isNaN(token.value)) {
      prefix = String(token.value);
    }
    if (token.type === '.' || token.type === '[') {
      index += token.raw.length;
    }
  }
  var options = [];
  if (!token || token.type === '.' || token.type === 'id' ||
      token.type === '[' || token.type === '"' || token.type === '#') {
    // Flatten the options and filter.
    for (var i = 0; i < autocompleteData.length; i++) {
      for (var j = 0; j < autocompleteData[i].length; j++) {
        var option = autocompleteData[i][j];
        if (option.substring(0, prefix.length).toLowerCase() === prefix) {
            options.push(option);
        }
      }
    }
  }
  if ((options.length === 1 && options[0] === prefix) || !options.length) {
    hideAutocompleteMenu();
  } else {
    showAutocompleteMenu(options, index);
  }
}

// The last set of autocompletion options from Code City.
// This is an array of arrays of strings.  The first array contains the
// properties on the object, the second array contains the properties on the
// object's prototype, and so on.
var autocompleteData = [];

// Remove any properties that are shadowed by objects higher on the inheritance
// chain.  Also sort the properties alphabetically.
function filterShadowed(data) {
  if (!data || data.length < 2) {
    return;
  }
  var properties = Object.create(null);
  for (var i = 0; i < data.length; i++) {
    for (var j = data[i].length - 1; j >= 0; j--) {
      var prop = data[i][j];
      if (properties[prop]) {
        data[i].splice(j, 1);
      } else {
        properties[prop] = true;
      }
    }
    data[i].sort(caseInsensitiveComp);
  }
}

// Comparison function to sort strings A-Z without regard to case.
function caseInsensitiveComp(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  return (a < b) ? -1 : ((a > b) ? 1 : 0);
}

// Don't show any autocompletions if the cursor isn't at the end.
function autocompleteCursorMonitor() {
  if (typeof input.selectionStart === 'number' &&
      input.selectionStart !== input.value.length) {
    hideAutocompleteMenu();
    return true;
  }
  return false;
}

function showAutocompleteMenu(options, index) {
  if (autocompleteCursorMonitor()) {
    return;
  }
  scrollDiv.innerHTML = '';
  for (var i = 0; i < options.length; i++) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(options[i]));
    div.addEventListener('mouseover', autocompleteMouseOver);
    div.addEventListener('mouseout', autocompleteMouseOut);
    div.setAttribute('data-option', options[i]);
    scrollDiv.appendChild(div);
  }
  menuDiv.style.display = 'block';
  menuDiv.scrollTop = 0;
  var left = Math.round(index * Code.Explorer.SIZE_OF_INPUT_CHARS);
  var maxLeft = window.innerWidth - menuDiv.offsetWidth;
  menuDiv.style.left = Math.min(left, maxLeft) + 'px';
}

function hideAutocompleteMenu() {
  menuDiv.style.display = 'none';
  autocompleteSelect(null);
}

// Don't allow mouse movements to change the autocompletion selection
// Right after a keyboard navigation.  Otherwise an arrow keypress could cause
// a scroll which could cause an apparent mouse move, which could cause an
// unwanted selection change.
var keyNavigationTime = 0;

// Highlight one option.
function autocompleteMouseOver(e) {
  if (Date.now() - keyNavigationTime > 250) {
    autocompleteSelect(e.target);
  }
}

// Remove highlighting.
function autocompleteMouseOut() {
  if (Date.now() - keyNavigationTime > 250) {
    autocompleteSelect(null);
  }
}

// Highlight one option.
function autocompleteSelect(div) {
  var cursors = scrollDiv.querySelectorAll('.cursor');
  for (var i = 0, cursor; (cursor = cursors[i]); i++) {
    cursor.className = '';
  }
  if (div) {
    div.className = 'cursor';
  }
}

// An autocompletion option has been clicked by the user.
function autocompleteClick(e) {
  var option = e.target.getAttribute('data-option');
  var parts = JSON.parse(oldInputPartsJSON);
  parts.push(option);
  Code.Explorer.setParts(parts);
}

Code.Explorer.setParts = function(parts) {
  var selector = Code.Common.partsToSelector(parts);
  sessionStorage.setItem(Code.Common.SELECTOR, selector);
  window.parent.postMessage('ping', '*');
};

// Set the input to be the specified path (e.g. ['$', 'user', 'location']).
function setInput(parts) {
  hideAutocompleteMenu();
  var value = Code.Common.partsToSelector(parts);
  input.value = value;
  input.focus();
  oldInputValue = value;  // Don't autocomplete this value.
  oldInputPartsJSON = JSON.stringify(parts);
  oldInputPartsLast = null;
  Code.Explorer.loadPanels(parts);
}

// Start polling for changes.
function inputFocus() {
  clearInterval(inputPollPid);
  inputPollPid = setInterval(inputChange, 10);
  oldInputValue = undefined;
}

// Stop polling for changes.
function inputBlur() {
  if (inputBlur.disable) {
    inputBlur.disable = false;
    return;
  }
  clearInterval(inputPollPid);
  hideAutocompleteMenu();
}
inputBlur.disable = false;

// When clicking on the autocomplete menu, disable the blur
// (which would otherwise close the menu).
function autocompleteMouseDown() {
  inputBlur.disable = true;
}

// Intercept some control keys to control the autocomplete menu.
function inputKey(e) {
  var key = {
    tab: 9,
    enter: 13,
    esc: 27,
    up: 38,
    down: 40
  };
  if (e.keyCode === key.esc) {
    hideAutocompleteMenu();
  }
  autocompleteCursorMonitor();
  var cursor = scrollDiv.querySelector('.cursor');
  var hasMenu = menuDiv.style.display !== 'none';
  if (e.keyCode === key.enter) {
    if (cursor) {
      var fakeEvent = {target: cursor};
      autocompleteClick(fakeEvent);
      e.preventDefault();
    } else {
      var parts = JSON.parse(oldInputPartsJSON);
      if (oldInputPartsLast && oldInputPartsLast.valid) {
        parts.push(oldInputPartsLast.value);
      }
      Code.Explorer.setParts(parts);
    }
  }
  if (e.keyCode === key.tab) {
    if (hasMenu) {
      var option = scrollDiv.firstChild;
      var prefix = option.getAttribute('data-option');
      var optionCount = 0;
      do {
        optionCount++;
        prefix = Code.Explorer.getPrefix(prefix,
            option.getAttribute('data-option'));
        option = option.nextSibling;
      } while (option);
      if (optionCount === 1) {
        // There was only one option.  Choose it.
        var parts = JSON.parse(oldInputPartsJSON);
        parts.push(prefix);
        Code.Explorer.setParts(parts);
      } else if (oldInputPartsLast) {
        if (oldInputPartsLast.type === 'id') {
          // Append the common prefix to the input.
          input.value = input.value.substring(0, oldInputPartsLast.index) +
              prefix;
        }
        // TODO: Tab-completion of partial strings and numbers.
      }
    }
    e.preventDefault();
  }
  if (hasMenu && (e.keyCode === key.up || e.keyCode === key.down)) {
    keyNavigationTime = Date.now();
    var newCursor;
    if (e.keyCode === key.up) {
      if (!cursor) {
        newCursor = scrollDiv.lastChild;
      } else if (cursor.previousSibling) {
        newCursor = cursor.previousSibling;
      }
    } else if (e.keyCode === key.down) {
      if (!cursor) {
        newCursor = scrollDiv.firstChild;
      } else if (cursor.nextSibling) {
        newCursor = cursor.nextSibling;
      }
    }
    if (newCursor) {
      autocompleteSelect(newCursor);
      if (newCursor.scrollIntoView) {
        newCursor.scrollIntoView({block: 'nearest', inline: 'nearest'});
      }
    }
    e.preventDefault();
  }
}

/**
 * Compute and return the common prefix of two (relatively short) strings.
 * @param {string} str1 One string.
 * @param {string} str1 Another string.
 * @return {string} Common prefix.
 */
Code.Explorer.getPrefix = function(str1, str2) {
  var len = Math.min(str1.length, str2.length);
  for (var i = 0; i < len; i++) {
    if (str1[i] !== str2[i]) {
      break;
    }
  }
  return str1.substring(0, i);
};

// If the cursor moves away from the end as a result of the mouse,
// close the autocomplete menu.
function inputMouseDown() {
  setTimeout(autocompleteCursorMonitor, 1);
}

// Number of object panels.
var panelCount = 0;
// Size of temporary spacer margin for smooth scrolling after deletion.
var panelSpacerMargin = 0;

/**
 * Update the panels with the specified list of parts.
 * @param {!Array<string>} parts List of parts.
 */
Code.Explorer.loadPanels = function(parts) {
  // Store parts in a sessionStorage so that the panels can highlight
  // the current items.
  sessionStorage.setItem('code parts', JSON.stringify(parts));
  for (var i = 0; i <= parts.length; i++) {
    var component = JSON.stringify(parts.slice(0, i));
    var iframe = document.getElementById('objectPanel' + i);
    if (iframe) {
      if (iframe.getAttribute('data-component') === component) {
        // Highlight current item.
        iframe.contentWindow.postMessage('ping', '*');
        continue;
      } else {
        while (panelCount > i) {
          Code.Explorer.removePanel();
        }
      }
    }
    iframe = Code.Explorer.addPanel(component);
  }
  while (panelCount > i) {
    Code.Explorer.removePanel();
  }
};

/**
 * Add an object panel to the right.
 * @param {string} component Stringified parts list.
 */
Code.Explorer.addPanel = function(component) {
  panelsScroll = document.getElementById('panelsScroll');
  var iframe = document.createElement('iframe');
  iframe.id = 'objectPanel' + panelCount;
  iframe.src = '/static/code/objectPanel.html#' + encodeURI(component);
  iframe.setAttribute('data-component', component);
  var spacer = document.getElementById('panelSpacer');
  panelsScroll.insertBefore(iframe, spacer);
  panelCount++;
  panelSpacerMargin = Math.max(0, panelSpacerMargin - iframe.offsetWidth);
  Code.Explorer.scrollPanel();
};

/**
 * Remove the right-most panel.
 */
Code.Explorer.removePanel = function() {
  panelCount--;
  var iframe = document.getElementById('objectPanel' + panelCount);
  panelSpacerMargin += iframe.offsetWidth;
  iframe.parentNode.removeChild(iframe);
  Code.Explorer.scrollPanel();
};

/**
 * After addition, quickly scroll the panels all the way to see the right edge.
 * After deletion, reduce the spacer so that the panels scroll to the edge.
 */
Code.Explorer.scrollPanel = function() {
  var spacer = document.getElementById('panelSpacer');
  var speed = 20;
  clearTimeout(Code.Explorer.scrollPid_);
  if (panelSpacerMargin > 0) {
    // Reduce spacer.
    panelSpacerMargin = Math.max(0, panelSpacerMargin - speed);
    spacer.style.marginRight = panelSpacerMargin + 'px';
    if (panelSpacerMargin > 0) {
      Code.Explorer.scrollPid_ = setTimeout(Code.Explorer.scrollPanel, 10);
    }
  } else {
    spacer.style.marginRight = 0;
    // Scroll right.
    panels = document.getElementById('panels');
    var oldScroll = panels.scrollLeft;
    panels.scrollLeft += speed;
    if (panels.scrollLeft > oldScroll) {
      Code.Explorer.scrollPid_ = setTimeout(Code.Explorer.scrollPanel, 10);
    }
  }
};

/**
 * PID of currently executing scroll animation.
 * @private
 */
Code.Explorer.scrollPid_ = 0;

/**
 * Page has loaded, initialize the explorer.
 */
Code.Explorer.init = function() {
  input = document.getElementById('input');
  input.addEventListener('focus', inputFocus);
  input.addEventListener('blur', inputBlur);
  input.addEventListener('keydown', inputKey);
  input.addEventListener('mousedown', inputMouseDown);
  menuDiv = document.getElementById('autocompleteMenu');
  scrollDiv = document.getElementById('autocompleteMenuScroll');
  scrollDiv.addEventListener('mousedown', autocompleteMouseDown);
  scrollDiv.addEventListener('click', autocompleteClick);
  oldInputPartsJSON = null;  // Allow autocompletion of initial value.
  Code.Explorer.receiveMessage();
};

window.addEventListener('load', Code.Explorer.init);
window.addEventListener('message', Code.Explorer.receiveMessage, false);
