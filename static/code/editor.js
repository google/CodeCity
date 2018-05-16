/**
 * @license
 * Code City: Code Editor.
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

Code.Editor = {};

/**
 * JSON-encoded list of complete object selector parts.
 * @type {?string}
 */
Code.Editor.partsJSON = null;

/**
 * Currently selected editor.
 * @type {?Code.GenericEditor}
 */
Code.Editor.currentEditor = null;

/**
 * Got a ping from someone.  Something might have changed and need updating.
 */
Code.Editor.receiveMessage = function() {
  if (document.getElementById('editorConfirm').style.display === 'block') {
    return;  // Ignore messages if the modal save dialog is up.
  }
  var selector = sessionStorage.getItem(Code.Common.SELECTOR);
  var parts = Code.Common.selectorToParts(selector);
  if (!parts || !parts.length) {
    return;  // Invalid parts, ignore.
  }
  if (JSON.stringify(parts) === Code.Editor.partsJSON) {
    return;  // No change.
  }
  if (Code.Editor.partsJSON === null) {
    Code.Editor.load();  // Initial load of content.
  } else if (!Code.Editor.currentEditor ||
             Code.Editor.currentEditor.isSaved()) {
    Code.Editor.reload();  // Reload to load different content.
  } else {
    Code.Editor.showSave();  // User needs to save/discard/cancel.
  }
};

/**
 * Page has loaded, initialize the editor.
 */
Code.Editor.init = function() {
  // Initialize button handlers.
  document.getElementById('editorConfirmDiscard').addEventListener('click',
      Code.Editor.reload);
  document.getElementById('editorConfirmCancel').addEventListener('click',
      Code.Editor.hideSave);
  document.getElementById('editorConfirmSave').addEventListener('click',
      Code.Editor.save);
  document.getElementById('editorSave').addEventListener('click',
      Code.Editor.save);

  // Create the tabs.
  var tabRow = document.getElementById('editorTabs');
  var containerRow = document.getElementById('editorContainers');
  for (var i = 0, editor; (editor = Code.Editor.editors[i]); i++) {
    var span = document.createElement('span');
    span.appendChild(document.createTextNode(editor.name));
    span.setAttribute('role', 'button');
    span.setAttribute('tabindex', i);
    span.addEventListener('click', Code.Editor.tabClick);
    tabRow.appendChild(span);
    var div = document.createElement('div');
    containerRow.appendChild(div);
    // Cross-link span/div to editor.
    span.editor = editor;
    div.editor = editor;
    editor.tabElement = span;
    editor.containerElement = div;
  }

  Code.Editor.receiveMessage();
};

/**
 * Load content into the editors.
 */
Code.Editor.load = function() {
  var selector = sessionStorage.getItem(Code.Common.SELECTOR);
  var parts = Code.Common.selectorToParts(selector);
  if (!parts) {
    return;  // Invalid parts, ignore.
  }
  Code.Editor.partsJSON = JSON.stringify(parts);
  // Request data from Code City server.
  Code.Editor.key = undefined;
  Code.Editor.sendXhr();

  // Set the header.
  var header = document.getElementById('editorHeader');
  header.innerHTML = '';
  // TODO: Fix assignments to selectors with ^ in the path.
  // $('$.foo^') should be Object.setPrototypeOf($.foo, ...)
  // Remove the last part.
  var lastPart = parts.pop();
  var selector = Code.Common.partsToSelector(parts);
  var reference = Code.Common.selectorToReference(selector);
  // Put the last part back on.
  // Render as '.foo' or '[42]' or '["???"]' or '^'.
  if (lastPart.type === 'id') {
    var mockParts = [{type: 'id', value: 'X'}, lastPart];
    reference += Code.Common.partsToSelector(mockParts).substring(1) + ' = ';
  } else if (lastPart.type === '^') {
    reference = 'Object.setPrototypeOf(' + reference + ', ...) ';
  } else {
    // Unknown part type.
    throw lastPart;
  }

  header.appendChild(document.createTextNode(reference));
};

/**
 * Save the current editor content.
 */
Code.Editor.save = function() {
  Code.Editor.sendXhr();
};

/**
 * Force a reload of this editor.  Used to switch to edit something else.
 */
Code.Editor.reload = function() {
  Code.Editor.hideSave();
  Code.Editor.beforeUnload.disabled = true;
  location.reload();
};

/**
 * Issue a warning if the user has unsaved changes and is attempting to leave
 * the code editor (e.g. typing a new URL).  This is not triggered due to
 * in-editor navigation.
 * @param {!Event} e A beforeunload event.
 */
Code.Editor.beforeUnload = function(e) {
  if (document.getElementById('editorConfirm').style.display === 'block') {
    // The user has already got a warning but is ignoring it.  Just leave.
    Code.Editor.hideSave();
    return;
  }
  if (!Code.Editor.beforeUnload.disabled && Code.Editor.currentEditor &&
      !Code.Editor.currentEditor.isSaved()) {
    e.returnValue = 'You have unsaved changes.';
    e.preventDefault();
  }
};

/**
 * Flag to allow navigation away from current page, despite unsaved changes.
 */
Code.Editor.beforeUnload.disabled = false;

/**
 * When a tab is clicked, highlight it and show its container.
 * @param {!Event|!Object} e Click event or object pretending to be an event.
 */
Code.Editor.tabClick = function(e) {
  if (Code.Editor.tabClick.disabled) {
    return;
  }
  // Unhighlight all tabs, hide all containers.
  var tabs = document.querySelectorAll('#editorTabs>.highlighted');
  for (var i = 0, tab; (tab = tabs[i]); i++) {
    tab.className = '';
  }
  var containers = document.querySelectorAll('#editorContainers>div');
  for (var i = 0, container; (container = containers[i]); i++) {
    container.style.display = 'none';
  }

  // If working on an unsaved draft, copy current data into all other editors.
  if (Code.Editor.currentEditor && !Code.Editor.currentEditor.isSaved()) {
    var src = Code.Editor.currentEditor.getSource();
    Code.Editor.setSourceToAllEditors(src);
  }

  // Highlight one tab, show one container.
  var tab = e.target;
  tab.className = 'highlighted';
  var editor = tab.editor;
  Code.Editor.currentEditor = editor;
  var container = editor.containerElement;
  if (!editor.created) {
    var source = editor.getSource();
    editor.createDom(container);
    editor.created = true;
    editor.setSource(source);
  }
  container.style.display = 'block';
  // If e is an event, then this click is the result of a user's direct action.
  // If not, then it's a fake event as a result of page load.
  var userAction = e instanceof Event;
  editor.focus(userAction);
};

/**
 * Don't allow clicking of tabs before data is received from Code City.
 */
Code.Editor.tabClick.disabled = true;

/**
 * Send a request to Code City's code editor service.
 */
Code.Editor.sendXhr = function() {
  var xhr = Code.Editor.codeRequest_;
  xhr.abort();
  xhr.open('POST', '/code/editor');
  xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  xhr.onreadystatechange = Code.Editor.receiveXhr;
  var src = Code.Editor.currentEditor ?
      Code.Editor.currentEditor.getSource() : '';
  var data =
      'key=' + encodeURIComponent(Code.Editor.key) +
      '&parts=' + encodeURIComponent(Code.Editor.partsJSON);
  if (src) {
    data += '&src=' + encodeURIComponent(src);
  }
  xhr.send(data);
};

/**
 * Reusable XHR object for server pings.
 */
Code.Editor.codeRequest_ = new XMLHttpRequest();

/**
 * Got a response from Code City's code editor service.
 */
Code.Editor.receiveXhr = function() {
  var xhr = Code.Editor.codeRequest_;
  if (xhr.readyState !== 4) {
    return;  // Not ready yet.
  }
  if (xhr.status !== 200) {
    console.warn('Editor XHR returned status ' + xhr.status);
    return;
  }
  var data = JSON.parse(xhr.responseText);
  if (data.hasOwnProperty('key')) {
    Code.Editor.key = data.key;
  }
  if (data.hasOwnProperty('src')) {
    Code.Editor.setSourceToAllEditors(data.src);
  }
  Code.Editor.ready && Code.Editor.ready();
};

/**
 * Data has been received, ready to allow the user to edit.
 */
Code.Editor.ready = function() {
  // Configure tabs.
  document.getElementById('editorTabs').className = 'enabled';
  Code.Editor.tabClick.disabled = false;

  // Switch tabs to show the highest confidence editor.
  var bestEditor = Code.Editor.mostConfidentEditor();
  if (bestEditor) {
    var fakeEvent = {target: bestEditor.tabElement};
    Code.Editor.tabClick(fakeEvent);
  }

  // Remove the loading animation.
  var header = document.getElementById('editorHeader');
  header.className = '';

  // Only run this code once.
  Code.Editor.ready = undefined;
};

/**
 * Find the editor with the highest confidence for the current text.
 * Confidence levels are recorded when text is set in each editor.
 * @return {Code.GenericEditor} Best editor, or null if none.
 */
Code.Editor.mostConfidentEditor = function() {
  var bestEditor = null;
  var bestConfidence = -Infinity;
  for (var i = 0, editor; (editor = Code.Editor.editors[i]); i++) {
    if (bestConfidence < editor.confidence) {
      bestConfidence = editor.confidence;
      bestEditor = editor;
    }
  }
  return bestEditor;
};

/**
 * Set the values of the editors to the initial value sent from Code City.
 * @param {string} src Plain text contents.
 */
Code.Editor.setSourceToAllEditors = function(src) {
  for (var i = 0, editor; (editor = Code.Editor.editors[i]); i++) {
    editor.setSource(src);
  }
};

/**
 * Show the save dialog.
 */
Code.Editor.showSave = function() {
  document.getElementById('editorConfirm').style.display = 'block';
  var mask = document.getElementById('editorConfirmMask');
  var box = document.getElementById('editorConfirmBox');
  mask.style.transitionDuration = '.4s';
  box.style.transitionDuration = '.4s';
  // Add a little bounce at the end of the animation.
  box.style.transitionTimingFunction = 'cubic-bezier(.6,1.36,.75,1)';
  setTimeout(function() {
    mask.style.opacity = 0.2;
    box.style.top = '-10px';
  }, 100);  // Firefox requires at least 10ms to process this timing function.
  // Desaturate save button.  Don't visually conflict with the 'save' button
  // in save dialog.
  document.getElementById('editorSave').className = 'jfk-button';
};

/**
 * Hide the save dialog.
 */
Code.Editor.hideSave = function() {
  var mask = document.getElementById('editorConfirmMask');
  var box = document.getElementById('editorConfirmBox');
  mask.style.transitionDuration = '.2s';
  box.style.transitionDuration = '.2s';
  box.style.transitionTimingFunction = 'ease-in';
  mask.style.opacity = 0;
  box.style.top = '-120px';
  setTimeout(function() {
    document.getElementById('editorConfirm').style.display = 'none';
  }, 250);
  // Resaturate the save button.
  document.getElementById('editorSave').className =
      'jfk-button jfk-button-submit';
};

/**
 * Show the text in the butter bar for a period of time.
 * Clobber any existing display.
 * @param {string} text Text to display.
 * @param {number} time Number of milliseconds to display butter.
 */
Code.Editor.showButter = function(text, time) {
  clearTimeout(Code.Editor.showButter.pid_);
  var textDiv = document.getElementById('editorButterText');
  textDiv.innerHTML = '';
  textDiv.appendChild(document.createTextNode(text));
  document.getElementById('editorButter').style.display = 'block';
  Code.Editor.showButter.pid_ = setTimeout(Code.Editor.hideButter, time);
};

Code.Editor.showButter.pid_ = 0;

/**
 * Hide the butter bar.
 */
Code.Editor.hideButter = function() {
  document.getElementById('editorButter').style.display = 'none';
};

window.addEventListener('load', Code.Editor.init);
window.addEventListener('message', Code.Editor.receiveMessage, false);
window.addEventListener('beforeunload', Code.Editor.beforeUnload);


Code.Editor.editors = [];

/**
 * Base class for editors.
 * @param {string} name User-facing name of editor (used in tab).
 * @constructor
 */
Code.GenericEditor = function(name) {
  /**
   * Human-readable name of editor.
   * @type {string}
   */
  this.name = name;
  // Register this editor.
  Code.Editor.editors.push(this);
};

/**
 * A float from 0 (bad) to 1 (perfect) indicating the editor's fitness to
 * edit the given content.
 */
Code.GenericEditor.prototype.confidence = 0;

/**
 * Has the DOM for this editor been created yet?
 */
Code.GenericEditor.prototype.created = false;

/**
 * Stored text from before the editor is created.
 * @private
 */
Code.GenericEditor.prequelSource_ = '';

/**
 * Span that forms the tab button.
 * @type {?Element}
 */
Code.GenericEditor.prototype.tabElement = null;

/**
 * Div that forms the editor's container.
 * @type {?Element}
 */
Code.GenericEditor.prototype.containerElement = null;

/**
 * Plain text representation of this editor's contents as of load or last save.
 * @type {?string}
 */
Code.GenericEditor.prototype.lastSavedSource = null;

/**
 * Create the DOM for this editor.
 * @param {!Element} container DOM should be appended to this containing div.
 */
Code.GenericEditor.prototype.createDom = function(container) {
  var text = 'TODO: Implement createDom for ' + this.name + ' editor.';
  container.appendChild(document.createTextNode(text));
};

/**
 * Get the contents of the editor.
 * @return {string} Plain text contents.
 */
Code.GenericEditor.prototype.getSource = function() {
  throw ReferenceError('getSource not implemented on editor');
};

/**
 * Set the contents of the editor.
 * @param {string} source Plain text contents.
 */
Code.GenericEditor.prototype.setSource = function(source) {
  throw ReferenceError('setSource not implemented on editor');
};

/**
 * Is the user's work in this editor saved?
 * @return {boolean} True if work is saved.
 */
Code.GenericEditor.prototype.isSaved = function() {
  return this.getSource() === this.lastSavedSource;
};

/**
 * Notification that this editor has just been displayed.
 * @param {boolean} userAction True if user clicked on a tab.
 */
Code.GenericEditor.prototype.focus = function(userAction) {
};


////////////////////////////////////////////////////////////////////////////////
Code.valueEditor = new Code.GenericEditor('Value');

// The value editor can handle any content, but express a low confidence in
// order to defer to more specialized editors.
Code.valueEditor.confidence = 0.1;

/**
 * Code Mirror editor.  Does not exist until tab is selected.
 * @type {Object}
 * @private
 */
Code.valueEditor.editor_ = null;

/**
 * Create the DOM for this editor.
 * @param {!Element} container DOM should be appended to this containing div.
 */
Code.valueEditor.createDom = function(container) {
  container.innerHTML = `
<style>
#valueEditor {
  position: absolute;
  top: 60px;
  bottom: 20px;
  left: 10px;
  right: 20px
}
</style>
  `;
  container.id = 'valueEditor';
  var options = {
    tabSize: 2,
    undoDepth: 1024,
    lineNumbers: true,
    matchBrackets: true
  };
  this.editor_ = CodeMirror(container, options);
  this.editor_.setSize('100%', '100%');
};

/**
 * Get the contents of the editor.
 * @return {string} Plain text contents.
 */
Code.valueEditor.getSource = function() {
  return this.created ? this.editor_.getValue() : this.prequelSource_;
};

/**
 * Set the contents of the editor.
 * @param {string} source Plain text contents.
 */
Code.valueEditor.setSource = function(source) {
  if (this.created) {
    this.editor_.setValue(source);
  } else {
    this.prequelSource_ = source;
  }
  this.lastSavedSource = Code.valueEditor.getSource();
};

/**
 * Notification that this editor has just been displayed.
 * @param {boolean} userAction True if user clicked on a tab.
 */
Code.valueEditor.focus = function(userAction) {
  this.editor_.refresh();
  if (userAction) {
    this.editor_.focus();
  }
};

////////////////////////////////////////////////////////////////////////////////
//Code.functionEditor = new Code.GenericEditor('Function');

////////////////////////////////////////////////////////////////////////////////
//Code.jsspEditor = new Code.GenericEditor('JSSP');

////////////////////////////////////////////////////////////////////////////////
//Code.svgEditor = new Code.GenericEditor('SVG');

////////////////////////////////////////////////////////////////////////////////
Code.stringEditor = new Code.GenericEditor('String');

/**
 * Create the DOM for this editor.
 * @param {!Element} container DOM should be appended to this containing div.
 */
Code.stringEditor.createDom = function(container) {
  container.innerHTML = `
<style>
.editorBigQuotes {
  font-family: serif;
  font-size: 48pt;
  position: absolute;
}
</style>
<div style="position: absolute; top: 60px; bottom: 20px; left: 45px; right: 50px">
  <textarea style="height: 100%; width: 100%; resize: none;"></textarea>
</div>
<div class="editorBigQuotes" style="left: 10px; top: 57px">“</div>
<div class="editorBigQuotes" style="right: 10px; bottom: 0">”</div>
  `;
  this.textarea_ = container.querySelector('textarea');
};

/**
 * Get the contents of the editor.
 * @return {string} Plain text contents.
 */
Code.stringEditor.getSource = function() {
  return this.created ?
      JSON.stringify(this.textarea_.value) :
      this.prequelSource_;
};

/**
 * Set the contents of the editor.
 * @param {string} text Plain text contents.
 */
Code.stringEditor.setSource = function(source) {
  var str;
  try {
    str = JSON.parse(source);
  } catch (e) {}
  if (typeof str !== 'string') {
    str = '';
    this.confidence = 0;
  } else {
    this.confidence = 0.9;
  }
  if (this.created) {
    this.textarea_.value = str;
  } else {
    this.prequelSource_ = source;
  }
  this.lastSavedSource = Code.stringEditor.getSource();
};

/**
 * Notification that this editor has just been displayed.
 * @param {boolean} userAction True if user clicked on a tab.
 */
Code.stringEditor.focus = function(userAction) {
  if (userAction) {
    this.textarea_.focus();
  }
};

////////////////////////////////////////////////////////////////////////////////
//Code.regExpEditor = new Code.GenericEditor('RegExp');

////////////////////////////////////////////////////////////////////////////////
//Code.dateEditor = new Code.GenericEditor('Date');
