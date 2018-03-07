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

// Common DOM elements.
var input;
var menuDiv;
var scrollDiv;

// Width in pixels of each monospaced character in the input.
// Used to line up the autocomplete menu.
var SIZE_OF_INPUT_CHARS = 10.8;

var oldInputValue;
var oldInputPartsJSON;
var inputPollPid = 0;

function tokenizeSelector(text) {
  // Trim left whitespace.
  text = text.replace(/^[\s\xa0]+/, '');
  if (!text) {
    return [];
  }

  function pushString(state, buffer) {
    // Convert state into quote type.
    var quotes;
    switch (state) {
      case 1:
      case 3:
        quotes = "'";
        break;
      case 2:
      case 4:
        quotes = '"';
        break;
      default:
        throw 'Unknown state';
    }
    var token = {
      type: '"',
      raw: quotes + buffer.join('') + quotes,
      valid: true,
    };
    do {
      var raw = quotes + buffer.join('') + quotes;
      // Attempt to parse a string.
      try {
        var str = eval(raw);
        break;
      } catch (e) {
        // Invalid escape found.  Trim off last char and try again.
        buffer.pop();
        token.valid = false;
      }
    } while (true);
    buffer.length = 0;
    token.value = str;
    tokens.push(token);
  }

  // Split out strings.
  var state = 0;
  // 0 - non-string state
  // 1 - single quote string
  // 2 - double quote string
  // 3 - backslash in single quote string
  // 4 - backslash in double quote string
  var tokens = [];
  var buffer = [];
  for (var i = 0; i < text.length; i++) {
    var char = text[i];
    if (state === 0) {
      if (char === "'") {
        tokens.push(buffer.join(''));
        buffer.length = 0;
        state = 1;
      } else if (char === '"') {
        tokens.push(buffer.join(''));
        buffer.length = 0;
        state = 2;
      } else {
        buffer.push(char);
      }
    } else if (state === 1) {
      if (char === "'") {
        pushString(state, buffer);
        state = 0;
      } else {
        buffer.push(char);
        if (char === '\\') {
          state = 3;
        }
      }
    } else if (state === 2) {
      if (char === '"') {
        pushString(state, buffer);
        state = 0;
      } else {
        buffer.push(char);
        if (char === '\\') {
          state = 4;
        }
      }
    } else if (state === 3) {
      buffer.push(char);
      state = 1;
    } else if (state === 4) {
      buffer.push(char);
      state = 2;
    }
  }
  if (state !== 0) {
    pushString(state, buffer);
  } else if (buffer.length) {
    tokens.push(buffer.join(''));
  }

  // Split out brackets: [ ]
  for (var i = tokens.length - 1; i >= 0; i--) {
    var token = tokens[i];
    if (typeof token === 'string') {
      // Eliminate surrounding whitespace.
      token = token.replace(/\s*(\[|\])\s*/g, '$1');
      // Split string on brackets.
      var split = token.split(/(\[|\])/);
      for (var j = split.length; j >= 0; j--) {
        if (split[j] === '') {
          split.splice(j, 1);
        } else if (split[j] === '[') {
          split[j] = {
            type: '[',
            raw: '[',
            valid: true
          };
        } else if (split[j] === ']') {
          split[j] = {
            type: ']',
            raw: ']',
            valid: true
          };
        }
      }
      // Replace token with split array.
      split.unshift(i, 1);
      Array.prototype.splice.apply(tokens, split);
    }
  }

  // Parse numbers.
  for (var i = 1; i < tokens.length; i++) {
    var token = tokens[i];
    if (tokens[i - 1].type === '[' && typeof token === 'string') {
      tokens[i] = {
        type: '#',
        raw: token,
        value: NaN,
        valid: false
      };
      // Does not support E-notation or NaN.
      if (/^\s*[-+]?(\d*\.?\d*|Infinity)\s*$/.test(token)) {
        tokens[i].value = Number(token);
        tokens[i].valid = !isNaN(tokens[i].value);
      }
    }
  }

  // Split member expressions and parse identifiers.
  var unicodeRegex = /\\u([0-9A-F]{4})/ig;
  function decodeUnicode(m, p1) {
    return String.fromCodePoint(parseInt(p1, 16));
  }
  for (var i = tokens.length - 1; i >= 0; i--) {
    var token = tokens[i];
    if (typeof token === 'string') {
      // Eliminate surrounding whitespace.
      token = token.replace(/\s*\.\s*/g, '.');
      // Split string on periods.
      var split = token.split(/(\.)/);
      for (var j = split.length - 1; j >= 0; j--) {
        if (split[j] === '') {
          split.splice(j, 1);
        } else if (split[j] === '.') {
          split[j] = {
            type: '.',
            raw: '.',
            valid: true
          };
        } else {
          // Parse Unicode escapes in identifiers.
          var valid = true;
          var value = split[j];
          while (true) {
            var test = value.replace(unicodeRegex, '');
            if (test.indexOf('\\') === -1) {
              break;
            }
            // Invalid escape found.  Trim off last char and try again.
            value = value.substring(0, value.length - 1);
            valid = false;
          }
          // Decode Unicode.
          value = value.replace(unicodeRegex, decodeUnicode);
          split[j] = {
            type: 'id',
            value: value,
            raw: split[j],
            valid: valid
          };
        }
      }
      // Replace token with split array.
      split.unshift(i, 1);
      Array.prototype.splice.apply(tokens, split);
    }
  }

  // Validate order of tokens.
  var state = 0;
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (state === 0) {
      if (token.type === 'id') {
        state = 1;
      } else {
        break;
      }
    } else if (state === 1) {
      if (token.type === '.') {
        state = 0;
      } else if (token.type === '[') {
        state = 2;
      } else {
        break;
      }
    } else if (state === 2) {
      if (token.type === '"' || token.type === '#') {
        state = 3;
      } else {
        break;
      }
    } else if (state === 3) {
      if (token.type === ']') {
        state = 1;
      } else {
        break;
      }
    }
  }
  // Remove any illegal tokens.
  if (i < tokens.length) {
    tokens = tokens.slice(0, i);
    // Add fail token to prevent autocompletion.
    tokens.push({type: '?', valid: false});
  }
  return tokens;
}

// Handle any changes to the input field.
function inputChange() {
  if (oldInputValue === input.value) {
    return;
  }
  oldInputValue = input.value;
  var tokens = tokenizeSelector(input.value);
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
  var partsJSON = JSON.stringify(parts);
  if (oldInputPartsJSON === partsJSON) {
    updateAutocompleteMenu(lastToken);
  } else {
    oldInputPartsJSON = partsJSON;
    sendAutocomplete(partsJSON);
    hideAutocompleteMenu();
    loadPanels(parts);
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
  if (token &&
      (token.type === 'id' || token.type === '"' || token.type === '#')) {
    prefix = token.value.toLowerCase();
  }
  var options = [];
  // Flatten the options and filter.
  for (var i = 0; i < autocompleteData.length; i++) {
    for (var j = 0; j < autocompleteData[i].length; j++) {
      var option = autocompleteData[i][j];
      if (option.substring(0, prefix.length).toLowerCase() === prefix) {
        if (!token || token.type === '.' || token.type === 'id' ||
            token.type === '[' || token.type === '"' || token.type === '#') {
          options.push(option);
        }
      }
    }
  }
  if (options.length === 1 && options[0] === prefix) {
    hideAutocompleteMenu();
  } else {
    if (options.length) {
      showAutocompleteMenu(options);
    } else {
      hideAutocompleteMenu();
    }
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

function showAutocompleteMenu(options) {
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
  var left = Math.round((input.selectionStart || 0) * SIZE_OF_INPUT_CHARS);
  var maxLeft = window.innerWidth - menuDiv.offsetWidth;
  menuDiv.style.left = Math.min(left, maxLeft) + 'px';
}

function hideAutocompleteMenu() {
  menuDiv.style.display = 'none';
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
  setInput(parts);
}

// Set the input to be the specified path (e.g. ['$', 'user', 'location']).
function setInput(parts) {
  hideAutocompleteMenu();
  var value = '';
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (/^[A-Z_$][0-9A-Z_$]*$/i.test(part)) {
      if (i !== 0) {
        value += '.';
      }
      value += part;
    } else {
      value += '[';
      if (/^-?\d{1,15}$/.test(part)) {
        value += part;
      } else {
        value += JSON.stringify(part);
      }
      value += ']';
    }

  }
  input.value = value;
  oldInputValue = value;  // Don't autocomplete this value.
  input.focus();
  loadPanels(parts);
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
  if (menuDiv.style.display === 'none') {
    return;
  }
  var key = {
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
  if (cursor && e.keyCode === key.enter) {
    var fakeEvent = {target: cursor};
    autocompleteClick(fakeEvent);
    e.preventDefault();
  }
  if (e.keyCode === key.up || e.keyCode === key.down) {
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

// If the cursor moves away from the end as a result of the mouse,
// close the autocomplete menu.
function inputMouseDown() {
  setTimeout(autocompleteCursorMonitor, 1);
}

// Number of object panels.
var panelCount = 0;
// Size of temporary spacer margin for smooth scrolling after deletion.
var panelSpacerMargin = 0;

// Add an object panel to the right.
function addPanel(component) {
  panelsScroll = document.getElementById('panelsScroll');
  var iframe = document.createElement('iframe');
  iframe.id = 'objectPanel' + panelCount;
  iframe.src = '/code/objectPanel?parts=' + encodeURIComponent(component);
  iframe.setAttribute('data-component', component);
  var spacer = document.getElementById('panelSpacer');
  panelsScroll.insertBefore(iframe, spacer);
  panelCount++;
  panelSpacerMargin = Math.max(0, panelSpacerMargin - iframe.offsetWidth);
  scrollPanel();
}

// After addition, quickly scroll the panels all the way to see the right edge.
// After deletion, reduce the spacer so that the panels scroll to the edge.
function scrollPanel() {
  var speed = 20;
  clearTimeout(scrollPanel.pid_);
  if (panelSpacerMargin > 0) {
    // Reduce spacer.
    var spacer = document.getElementById('panelSpacer');
    panelSpacerMargin = Math.max(0, panelSpacerMargin - speed);
    spacer.style.marginRight = panelSpacerMargin + 'px';
    if (panelSpacerMargin > 0) {
      scrollPanel.pid_ = setTimeout(scrollPanel, 10);
    }
  } else {
    // Scroll right.
    panels = document.getElementById('panels');
    var oldScroll = panels.scrollLeft;
    panels.scrollLeft += speed;
    if (panels.scrollLeft > oldScroll) {
      scrollPanel.pid_ = setTimeout(scrollPanel, 10);
    }
  }
}

// Remove the right-most panel.
function removePanel() {
  panelCount--;
  var iframe = document.getElementById('objectPanel' + panelCount);
  panelSpacerMargin += iframe.offsetWidth;
  iframe.parentNode.removeChild(iframe);
  scrollPanel();
}

function loadPanels(parts) {
  for (var i = 0; i <= parts.length; i++) {
    var component = JSON.stringify(parts.slice(0, i));
    var iframe = document.getElementById('objectPanel' + i);
    if (iframe) {
      if (iframe.getAttribute('data-component') === component) {
        continue;
      } else {
        while (panelCount >= i) {
          removePanel();
        }
      }
    }
    addPanel(component);
  }
  while (panelCount > i) {
    removePanel();
  }
}

// Page has loaded, initialize the explorer.
function init() {
  input = document.getElementById('input');
  input.addEventListener('focus', inputFocus);
  input.addEventListener('blur', inputBlur);
  input.addEventListener('keydown', inputKey);
  input.addEventListener('mousedown', inputMouseDown);
  menuDiv = document.getElementById('autocompleteMenu');
  scrollDiv = document.getElementById('autocompleteMenuScroll');
  scrollDiv.addEventListener('mousedown', autocompleteMouseDown);
  scrollDiv.addEventListener('click', autocompleteClick);
  setInput(['$']);
}

window.addEventListener('load', init);
