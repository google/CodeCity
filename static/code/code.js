/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Integrated Development Environment for Code City.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

/**
 * If not otherwise specified, what should /code point at?
 */
Code.DEFAULT = '$';

/**
 * Raw string of selector.
 * E.g. '$.foo["bar"]'
 */
Code.selector = location.search ?
    decodeURIComponent(location.search.substring(1)) : Code.DEFAULT;

/**
 * Got a ping from someone.  Check sessionStorage to see if selector has
 * changed and, if so, propagate ping to subframes.
 * @param {?Event} event Message event, or null if called from popState.
 */
Code.receiveMessage = function(event) {
  // Check to see if the stored values have changed.
  var selector = sessionStorage.getItem(Code.Common.SELECTOR);
  if (selector === Code.selector) {
    return;
  }
  Code.selector = selector;
  if (event) {
    // Change the URL if this is NOT the result of a forwards/back navigation.
    var query = encodeURIComponent(selector);
    query = query.replace(/%24/g, '$');  // No need to encode $.
    history.pushState(selector, selector, '?' + query);
  }
  // Propagate the ping down the tree of frames.
  try {
    document.getElementById('explorer').contentWindow.postMessage('ping', '*');
  } catch (e) {
    // Maybe explorer frame hasn't loaded yet.
  }
  try {
    document.getElementById('editor').contentWindow.postMessage('ping', '*');
  } catch (e) {
    // Maybe editor frame hasn't loaded yet.
  }
  Code.setTitle();
};

/**
 * User has navigated forwards or backwards.
 * @param {!Event} event History change event.
 */
Code.popState = function(event) {
  var selector = event.state || Code.DEFAULT;
  sessionStorage.setItem(Code.Common.SELECTOR, selector);
  // Attempt to pull the focus away from the explorer's input field.
  // This will allow it to update the displayed selector.
  try {
    document.getElementById('explorer').contentDocument
        .getElementById('input').blur();
  } catch (e) {
    console.log('Unable to blur input: ' + e);
  }
  Code.receiveMessage(null);
};

/**
 * Set the code editor's title.
 */
Code.setTitle = function() {
  var title = Code.selector;
  if (title.length > 36) {
    // Max title length in Chrome is 36 before truncation.
    title = '…' + title.substr(-35);
  }
  document.title = title;
};

if (!window.TEST) {
  Code.setTitle();
  sessionStorage.setItem(Code.Common.SELECTOR, Code.selector);
  window.addEventListener('message', Code.receiveMessage, false);
  window.addEventListener('popstate', Code.popState, false);
}

////////////////////////////////////////////
// Add bridge for SVG editor's clipboard.  This copy allows the clipboard to
// sync across all /code tabs even if the SVG editor isn't currently loaded.
// Copied from /code/SVG-Edit/svgcanvas.js

const CLIPBOARD_ID = 'svgedit_clipboard';

/**
* Flash the clipboard data momentarily on localStorage so all tabs can see.
* @returns {void}
*/
function flashStorage () {
  const data = sessionStorage.getItem(CLIPBOARD_ID);
  localStorage.setItem(CLIPBOARD_ID, data);
  setTimeout(function () {
    localStorage.removeItem(CLIPBOARD_ID);
  }, 1);
}

/**
* Transfers sessionStorage from one tab to another.
* @param {!Event} ev Storage event.
* @returns {void}
*/
function storageChange(ev) {
  if (!ev.newValue) return; // This is a call from removeItem.
  if (ev.key === CLIPBOARD_ID + '_startup') {
    // Another tab asked for our sessionStorage.
    localStorage.removeItem(CLIPBOARD_ID + '_startup');
    flashStorage();
  } else if (ev.key === CLIPBOARD_ID) {
    // Another tab sent data.
    sessionStorage.setItem(CLIPBOARD_ID, ev.newValue);
  }
}

// Listen for changes to localStorage.
window.addEventListener('storage', storageChange, false);
// Ask other tabs for sessionStorage (this is ONLY to trigger event).
localStorage.setItem(CLIPBOARD_ID + '_startup', Math.random());

// End of bridge for SVG editor's clipboard.
////////////////////////////////////////////
