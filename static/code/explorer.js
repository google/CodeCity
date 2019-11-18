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

Code.Explorer = {};

/**
 * Width in pixels of each monospaced character in the input.
 * Used to line up the autocomplete menu.
 * TODO: If the menu starts getting out of alignment, measure the text instead.
 */
Code.Explorer.SIZE_OF_INPUT_CHARS = 8.8;

/**
 * Offset in pixels of start of first character in the input.
 * Used to line up the autocomplete menu.
 * TODO: If the menu starts getting out of alignment, measure the text instead.
 */
Code.Explorer.LEFT_OF_INPUT_CHARS = 6;

/**
 * Value of the input field last time it was processed.
 * @type {?string}
 */
Code.Explorer.oldInputValue = null;

/**
 * JSON-encoded list of complete object selector parts.
 * @type {string}
 */
Code.Explorer.partsJSON = 'null';

/**
 * Final token which may not be complete and isn't included in the parts list.
 * E.g. '$.foo.bar' the 'bar' might become 'bart' or 'barf'.
 * @type {?Object}
 */
Code.Explorer.lastNameToken = null;

/**
 * PID of task polling for changes to the input field.
 */
Code.Explorer.inputPollPid = 0;

/**
 * Is it ok to normalize the input?  False if the user is typing.
 */
Code.Explorer.inputUpdatable = true;

/**
 * The last set of autocompletion options from Code City.
 * This is an array of arrays of strings.  The first array contains the
 * properties on the object, the second array contains the properties on the
 * object's prototype, and so on.
 * @type {!Array<!Array<string>>}
 */
Code.Explorer.autocompleteData = [];

/**
 * Got a ping from someone.  Something might have changed and need updating.
 */
Code.Explorer.receiveMessage = function() {
  var selector = sessionStorage.getItem(Code.Common.SELECTOR);
  // Propagate the ping down the tree of frames.
  var parts = Code.Common.selectorToParts(selector);
  if (parts) {
    if (Code.Explorer.inputUpdatable) {
      // Valid parts, set the input to be canonical version.
      Code.Explorer.setInput(parts);
    }
    Code.Explorer.loadPanels(parts);
  } else {
    // Invalid parts, set the input to the raw string.
    // Can be caused by going to: /code?$.foo...bar
    var input = document.getElementById('input');
    input.value = selector;
    Code.Explorer.inputChange();
    input.focus();
  }
};

/**
 * Handle any changes to the input field.
 */
Code.Explorer.inputChange = function() {
  var input = document.getElementById('input');
  if (Code.Explorer.oldInputValue === input.value) {
    return;  // No change.
  }
  Code.Explorer.oldInputValue = input.value;
  var parsed = Code.Explorer.parseInput(input.value);
  if (Code.Explorer.lastNameToken === null && parsed.lastNameToken) {
    // Look for cases where a deletion has resulted in a valid parts list.
    // E.g. $.foo.bar. -> $.foo.bar
    // Without this check, 'bar' would be considered a lastNameToken fragment.
    var partsCopy = parsed.parts.slice();
    partsCopy.push(
        {type: parsed.lastNameToken.type, value: parsed.lastNameToken.value});
    var oldParts = JSON.parse(Code.Explorer.partsJSON);
    if (oldParts) {
      oldParts.length = partsCopy.length;
    }
    if (JSON.stringify(partsCopy) === JSON.stringify(oldParts)) {
      // Rewrite the parsed input to be complete.
      parsed = {
        lastNameToken: null,
        lastToken: null,
        parts: partsCopy,
        valid: true
      };
      // Force the autocomplete menu to hide.
      Code.Explorer.partsJSON = 'null';
    }
  }
  Code.Explorer.lastNameToken = parsed.lastNameToken;
  var partsJSON = JSON.stringify(parsed.parts);
  if (Code.Explorer.partsJSON === partsJSON) {
    Code.Explorer.updateAutocompleteMenu(parsed.lastToken);
  } else {
    Code.Explorer.hideAutocompleteMenu();
    Code.Explorer.setParts(parsed.parts, false);
  }
  if (parsed.valid) {
    input.classList.remove('invalid');
  } else {
    input.classList.add('invalid');
  }
};

/**
 * Parse the input value.
 * @param {string} inputValue Selector string from input field.
 * @return {!Object} Object with four fields:
 *     parts: Array of selector parts.
 *     lastNameToken: Last token that was an id, str, or num.
 *     lastToken: Last token.  Null if no tokens.
 *     valid: True if all tokens are valid (or could become valid).
 */
Code.Explorer.parseInput = function(inputValue) {
  var tokens = Code.Common.tokenizeSelector(inputValue);
  var parts = [];
  var token = null;
  var lastNameToken = null;
  var valid = true;
  for (token of tokens) {
    if (token.type === 'id' || token.type === 'str' || token.type === 'num') {
      lastNameToken = token;
    }
    if (!token.valid) {
      valid = false;
      break;
    }
    if ('.[]^'.indexOf(token.type) !== -1) {
      if (lastNameToken) {
        parts.push({type: 'id', value: lastNameToken.value});
        lastNameToken = null;
      }
      if (token.type === '^') {
        parts.push({type: '^'});
      }
    }
  }
  return {
    parts: parts,
    lastNameToken: lastNameToken,
    lastToken: token,
    valid: valid
  };
};

/**
 * Cache of autocomplete responses from the last minute.
 */
Code.Explorer.autocompleteCache = Object.create(null);

/**
 * Time to live for cached values in milliseconds.
 */
Code.Explorer.autocompleteCacheMs = 60 * 1000;

/**
 * Send a request to Code City's autocomplete service.
 * @param {string} partsJSON Stringified array of parts to send to Code City.
 */
Code.Explorer.sendAutocomplete = function(partsJSON) {
  var xhr = Code.Explorer.autocompleteRequest_;
  xhr.abort();
  var cache = Code.Explorer.autocompleteCache[partsJSON];
  if (cache && cache.date + Code.Explorer.autocompleteCacheMs > Date.now()) {
    // Cache hit.
    Code.Explorer.processAutocomplete(cache.data);
  } else {
    // Cache miss.
    Code.Explorer.autocompleteData = [];
    xhr.open('GET', '/code/autocomplete?parts=' +
        encodeURIComponent(partsJSON), true);
    xhr.onreadystatechange = Code.Explorer.receiveAutocomplete;
    xhr.send();
    xhr.partsJSON = partsJSON;
  }
};

Code.Explorer.autocompleteRequest_ = new XMLHttpRequest();

/**
 * Got a response from Code City's autocomplete service.
 */
Code.Explorer.receiveAutocomplete = function() {
  var xhr = Code.Explorer.autocompleteRequest_;
  if (xhr.readyState !== 4) {
    return;  // Not ready yet.
  }
  if (xhr.status !== 200) {
    console.warn('Autocomplete returned status ' + xhr.status);
    return;
  }
  var data = JSON.parse(xhr.responseText);
  Code.Explorer.filterShadowed(data);

  Code.Explorer.autocompleteCache[xhr.partsJSON] =
      {date: Date.now(), data: data};
  Code.Explorer.processAutocomplete(data);
};

/**
 * Autocomplete data obtained (either by network or cache).  Use it.
 * @param {!Array<!Array<string>>} data Property names from Code City.
 */
Code.Explorer.processAutocomplete = function(data) {
  Code.Explorer.autocompleteData = data;
  // If the input value is unchanged, display the autocompletion menu.
  var input = document.getElementById('input');
  if (Code.Explorer.oldInputValue === input.value) {
    var parsed = Code.Explorer.parseInput(input.value);
    Code.Explorer.updateAutocompleteMenu(parsed.lastToken);
  }
};

/**
 * Given a partial prefix, filter the autocompletion menu and display
 * all matching options.
 * @param {?Object} token Last token in the parts list.
 */
Code.Explorer.updateAutocompleteMenu = function(token) {
  var prefix = '';
  var index = token ? token.index : 0;
  if (token) {
    if (token.type === 'id' || token.type === 'str') {
      prefix = token.value.toLowerCase();
    }
    if ((token.type === 'num') && !isNaN(token.value)) {
      prefix = String(token.value);
    }
    if (token.type === '.' || token.type === '[') {
      index += token.raw.length;
    }
  }
  var options = [];
  if (!token || token.type === '.' || token.type === 'id' ||
      token.type === '[' || token.type === 'str' || token.type === 'num') {
    // Flatten the options and filter.
    for (var optionGroup of Code.Explorer.autocompleteData) {
      for (var option of optionGroup) {
        if (option.substring(0, prefix.length).toLowerCase() === prefix) {
            options.push(option);
        }
      }
    }
  }
  if (!options.length ||
      (options.length === 1 && options[0].length === prefix.length)) {
    // Length equality above is needed since prefix is lowercased.
    Code.Explorer.hideAutocompleteMenu();
  } else {
    Code.Explorer.showAutocompleteMenu(options, index);
  }
};

/**
 * Remove any properties that are shadowed by objects higher on the inheritance
 * chain.  Also sort the properties alphabetically.
 * @param {!Array<!Array<string>>} data Property names from Code City.
 */
Code.Explorer.filterShadowed = function(data) {
  if (data.length < 2) {
    return;
  }
  var seen = Object.create(null);
  for (var datum of data) {
    var cursorInsert = 0;
    var cursorRead = 0;
    while (cursorRead < datum.length) {
      var prop = datum[cursorRead++];
      if (!seen[prop]) {
        seen[prop] = true;
        datum[cursorInsert++] = prop;
      }
    }
    datum.length = cursorInsert;
    datum.sort(Code.Explorer.caseInsensitiveComp);
  }
};

/**
 * Comparison function to sort strings A-Z without regard to case.
 * @param {string} a One string.
 * @param {string} b Another string.
 * @return {number} -1/0/1 comparator value.
 */
Code.Explorer.caseInsensitiveComp = function(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  return (a < b) ? -1 : ((a > b) ? 1 : 0);
};

/**
 * Hide any autocompletions if the cursor isn't at the end.
 * @return {boolean} True if cursor is not at the end.
 */
Code.Explorer.autocompleteCursorMonitor = function() {
  var input = document.getElementById('input');
  if (typeof input.selectionStart === 'number' &&
      input.selectionStart !== input.value.length) {
    Code.Explorer.hideAutocompleteMenu();
    return true;
  }
  return false;
};

/**
 * Display the autocomplete menu, populated with the provided options.
 * @param {!Array<string>} options Array of options.
 * @param {number} index Left offset (in characters) to position menu.
 */
Code.Explorer.showAutocompleteMenu = function(options, index) {
  if (Code.Explorer.autocompleteCursorMonitor()) {
    return;
  }
  var scrollDiv = document.getElementById('autocompleteMenuScroll');
  scrollDiv.innerHTML = '';
  for (var option of options) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(option));
    div.addEventListener('mouseover', Code.Explorer.autocompleteMouseOver);
    div.addEventListener('mouseout', Code.Explorer.autocompleteMouseOut);
    div.setAttribute('data-option', option);
    scrollDiv.appendChild(div);
  }
  var menuDiv = document.getElementById('autocompleteMenu');
  menuDiv.style.display = 'block';
  menuDiv.scrollTop = 0;
  var left = Math.round(index * Code.Explorer.SIZE_OF_INPUT_CHARS -
                        Code.Explorer.LEFT_OF_INPUT_CHARS);
  var maxLeft = window.innerWidth - menuDiv.offsetWidth;
  menuDiv.style.left = Math.min(left, maxLeft) + 'px';
  var maxHeight = window.innerHeight - menuDiv.offsetTop - 12;
  menuDiv.style.maxHeight = maxHeight + 'px';
};

/**
 * Stop displaying the autocomplete menu.
 */
Code.Explorer.hideAutocompleteMenu = function() {
  document.getElementById('autocompleteMenu').style.display = 'none';
  Code.Explorer.autocompleteSelect(null);
};

/**
 * Date/time of last keyboard navigation.
 * Don't allow mouse movements to change the autocompletion selection
 * Right after a keyboard navigation.  Otherwise an arrow keypress could cause
 * a scroll which could cause an apparent mouse move, which could cause an
 * unwanted selection change.
 */
Code.Explorer.keyNavigationTime = 0;

/**
 * Highlight one autocomplete option.
 * @param {!Event} e Mouse over event.
 */
Code.Explorer.autocompleteMouseOver = function(e) {
  if (Date.now() - Code.Explorer.keyNavigationTime > 250) {
    Code.Explorer.autocompleteSelect(e.target);
  }
};

/**
 * Remove highlighting from autocomplete option.
 * @param {!Event} e Mouse out event.
 */
Code.Explorer.autocompleteMouseOut = function() {
  if (Date.now() - Code.Explorer.keyNavigationTime > 250) {
    Code.Explorer.autocompleteSelect(null);
  }
};

/**
 * Highlight one option.  Unhighlight all other options.
 * @param {?Element} div Option to highlight or null for none.
 */
Code.Explorer.autocompleteSelect = function(div) {
  // There should only be zero or one option selected, but deselect them
  // all in case there was a UI bug.
  var selections =
      document.querySelectorAll('#autocompleteMenuScroll>.selected');
  for (var selected of selections) {
    selected.className = '';
  }
  if (div) {
    div.className = 'selected';
  }
};

/**
 * An autocompletion option has been clicked by the user.
 * @param {!Event} e Click event.
 */
Code.Explorer.autocompleteClick = function(e) {
  var option = e.target.getAttribute('data-option');
  var parts = JSON.parse(Code.Explorer.partsJSON);
  parts.push({type: 'id', value: option});
  Code.Explorer.setParts(parts, true);
};

/**
 * Set the currently specified path.
 * Notify the parent frame.
 * @param {!Array<!Object>} parts List of parts.
 * @param {boolean} updateInput Normalize the input if true.
 */
Code.Explorer.setParts = function(parts, updateInput) {
  Code.Explorer.partsJSON = JSON.stringify(parts);
  Code.Explorer.inputUpdatable = updateInput;
  Code.Explorer.hideAutocompleteMenu();
  Code.Explorer.sendAutocomplete(Code.Explorer.partsJSON);
  var selector = Code.Common.partsToSelector(parts);
  sessionStorage.setItem(Code.Common.SELECTOR, selector);
  window.parent.postMessage('ping', '*');
};

/**
 * Set the input to be the specified path.
 * @param {!Array<!Object>} parts List of parts.
 */
Code.Explorer.setInput = function(parts) {
  Code.Explorer.hideAutocompleteMenu();
  var value = Code.Common.partsToSelector(parts);
  var input = document.getElementById('input');
  input.value = value;
  input.focus();
  Code.Explorer.oldInputValue = value;  // Don't autocomplete this value.
};

/**
 * Start polling for changes.
 */
Code.Explorer.inputFocus = function() {
  clearInterval(Code.Explorer.inputPollPid);
  Code.Explorer.inputPollPid = setInterval(Code.Explorer.inputChange, 10);
  Code.Explorer.inputUpdatable = false;
};

/**
 * Stop polling for changes and hide the autocomplete menu.
 */
Code.Explorer.inputBlur = function() {
  if (Code.Explorer.inputBlur.disable_) {
    Code.Explorer.inputBlur.disable_ = false;
    return;
  }
  clearInterval(Code.Explorer.inputPollPid);
  Code.Explorer.hideAutocompleteMenu();
  Code.Explorer.inputUpdatable = true;
};
Code.Explorer.inputBlur.disable_ = false;

/**
 * When clicking on the autocomplete menu, disable the blur
 * (which would otherwise close the menu).
 */
Code.Explorer.autocompleteMouseDown = function() {
  Code.Explorer.inputBlur.disable_ = true;
};

/**
 * Intercept some control keys to control the autocomplete menu.
 * @param {!Event} e Keypress event.
 */
Code.Explorer.inputKey = function(e) {
  var key = {
    tab: 9,
    enter: 13,
    esc: 27,
    up: 38,
    down: 40
  };
  if (e.keyCode === key.esc) {
    Code.Explorer.hideAutocompleteMenu();
  }
  Code.Explorer.autocompleteCursorMonitor();
  var scrollDiv = document.getElementById('autocompleteMenuScroll');
  var selected = scrollDiv.querySelector('.selected');
  var menuDiv = document.getElementById('autocompleteMenu');
  var hasMenu = menuDiv.style.display !== 'none';
  if (e.keyCode === key.enter) {
    var parts = JSON.parse(Code.Explorer.partsJSON);
    if (selected) {
      // Add the selected autocomplete option to the input.
      var option = selected.getAttribute('data-option');
      parts.push({type: 'id', value: option});
    } else if (Code.Explorer.lastNameToken && Code.Explorer.lastNameToken.valid) {
      // The currently typed input should be considered complete.
      // E.g. $.foo<enter> is not waiting to become $.foot
      parts.push({type: 'id', value: Code.Explorer.lastNameToken.value});
      Code.Explorer.lastNameToken = null;
    }
    Code.Explorer.setParts(parts, true);
    e.preventDefault();
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
        var parts = JSON.parse(Code.Explorer.partsJSON);
        parts.push({type: 'id', value: prefix});
        Code.Explorer.setParts(parts, true);
      } else if (Code.Explorer.lastNameToken) {
        if (Code.Explorer.lastNameToken.type === 'id') {
          // Append the common prefix to the input.
          var input = document.getElementById('input');
          input.value = input.value.substring(0,
              Code.Explorer.lastNameToken.index) + prefix;
        }
        // TODO: Tab-completion of partial strings and numbers.
      }
    }
    e.preventDefault();
  }
  if (hasMenu && (e.keyCode === key.up || e.keyCode === key.down)) {
    Code.Explorer.keyNavigationTime = Date.now();
    var newSelected;
    if (e.keyCode === key.up) {
      if (!selected) {
        newSelected = scrollDiv.lastChild;
      } else if (selected.previousSibling) {
        newSelected = selected.previousSibling;
      }
    } else if (e.keyCode === key.down) {
      if (!selected) {
        newSelected = scrollDiv.firstChild;
      } else if (selected.nextSibling) {
        newSelected = selected.nextSibling;
      }
    }
    if (newSelected) {
      Code.Explorer.autocompleteSelect(newSelected);
      if (newSelected.scrollIntoView) {
        newSelected.scrollIntoView({block: 'nearest', inline: 'nearest'});
      }
    }
    e.preventDefault();
  }
};

/**
 * Compute and return the common prefix of two (relatively short) strings.
 * @param {string} str1 One string.
 * @param {string} str2 Another string.
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

/**
 * If a mouse-click caused the cursor to move away from the end,
 * close the autocomplete menu.
 */
Code.Explorer.inputMouseDown = function() {
  setTimeout(Code.Explorer.autocompleteCursorMonitor, 1);
};

/**
 * Number of object panels.
 */
Code.Explorer.panelCount = 0;

/**
 * Size of temporary spacer margin for smooth scrolling after deletion.
 */
Code.Explorer.panelSpacerMargin = 0;

/**
 * Update the panels with the specified list of parts.
 * @param {!Array<!Object>} parts List of parts.
 */
Code.Explorer.loadPanels = function(parts) {
  for (var i = 0; i <= parts.length; i++) {
    var component = JSON.stringify(parts.slice(0, i));
    var iframe = document.getElementById('objectPanel' + i);
    if (iframe) {
      if (iframe.getAttribute('data-component') === component) {
        // Highlight current item.
        iframe.contentWindow.postMessage('ping', '*');
        continue;
      } else {
        while (Code.Explorer.panelCount > i) {
          Code.Explorer.removePanel();
        }
      }
    }
    iframe = Code.Explorer.addPanel(component);
  }
  while (Code.Explorer.panelCount > i) {
    Code.Explorer.removePanel();
  }
};

/**
 * Add an object panel to the right.
 * @param {string} component Stringified parts list.
 */
Code.Explorer.addPanel = function(component) {
  var panelsScroll = document.getElementById('panelsScroll');
  var iframe = document.createElement('iframe');
  iframe.id = 'objectPanel' + Code.Explorer.panelCount;
  iframe.src = '/static/code/objectPanel.html#' + encodeURIComponent(component);
  iframe.setAttribute('data-component', component);
  var spacer = document.getElementById('panelSpacer');
  panelsScroll.insertBefore(iframe, spacer);
  Code.Explorer.panelCount++;
  Code.Explorer.panelSpacerMargin =
      Math.max(0, Code.Explorer.panelSpacerMargin - iframe.offsetWidth);
  Code.Explorer.scrollPanel();
};

/**
 * Remove the right-most panel.
 */
Code.Explorer.removePanel = function() {
  Code.Explorer.panelCount--;
  var iframe = document.getElementById('objectPanel' +
      Code.Explorer.panelCount);
  Code.Explorer.panelSpacerMargin += iframe.offsetWidth;
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
  if (Code.Explorer.panelSpacerMargin > 0) {
    // Reduce spacer.
    Code.Explorer.panelSpacerMargin =
        Math.max(0, Code.Explorer.panelSpacerMargin - speed);
    spacer.style.marginRight = Code.Explorer.panelSpacerMargin + 'px';
    if (Code.Explorer.panelSpacerMargin > 0) {
      Code.Explorer.scrollPid_ = setTimeout(Code.Explorer.scrollPanel, 10);
    }
  } else {
    spacer.style.marginRight = 0;
    // Scroll right.
    var panels = document.getElementById('panels');
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
  var input = document.getElementById('input');
  input.addEventListener('focus', Code.Explorer.inputFocus);
  input.addEventListener('blur', Code.Explorer.inputBlur);
  input.addEventListener('keydown', Code.Explorer.inputKey);
  input.addEventListener('mousedown', Code.Explorer.inputMouseDown);
  var scrollDiv = document.getElementById('autocompleteMenuScroll');
  scrollDiv.addEventListener('mousedown', Code.Explorer.autocompleteMouseDown);
  scrollDiv.addEventListener('click', Code.Explorer.autocompleteClick);
  Code.Explorer.receiveMessage();
};

if (!window.TEST) {
  window.addEventListener('load', Code.Explorer.init);
  window.addEventListener('message', Code.Explorer.receiveMessage, false);
}
