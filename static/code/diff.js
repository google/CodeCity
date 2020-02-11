/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Diff Editor.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var diffEditor = {};

/**
 * Diff Match Patch object.
 */
diffEditor.dmp = new diff_match_patch();

/**
 * Current source.
 */
diffEditor.source = '';

/**
 * Check to see if the parent window left us an initial source to render.
 */
diffEditor.init = function() {
  var newSource = window.initialSource;
  var oldSource = window.originalSource;
  if (newSource && oldSource) {
    diffEditor.setString(newSource, oldSource);
    delete window.initialSource;
    delete window.originalSource;
  }
};

/**
 * Set the strings for a new diff.
 * @param {string} newString Current source.
 * @param {string} oldString Source as of last save.
 */
diffEditor.setString = function(newString, oldString) {
  this.source = newString;
  var diff = this.dmp.diff_main(oldString, newString);
  this.dmp.diff_cleanupSemantic(diff);
  diffEditor.render(diff, document.body);
};

/**
 * Return the current source.
 * @return {string} Source.
 */
diffEditor.getString = function() {
  return this.source;
};

/**
 * Convert a diff array into a pretty HTML report and inject it on the page.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 * @param {!Element} container HTML element into which to render the diff.
 */
diffEditor.render = function(diffs, container) {
  container.innerHTML = '';
  for (var i = 0; i < diffs.length; i++) {
    var op = diffs[i][0];    // Operation (insert, delete, equal)
    var text = diffs[i][1];  // Text of change.
    var el = document.createElement(diffEditor.tagMap[op]);
    el.appendChild(document.createTextNode(text));
    container.appendChild(el);
  }
};

/**
 * Mapping from diff operation to relevant tag.
 */
diffEditor.tagMap = {};
diffEditor.tagMap[DIFF_INSERT] = 'ins';
diffEditor.tagMap[DIFF_DELETE] = 'del';
diffEditor.tagMap[DIFF_EQUAL] = 'span';

window.addEventListener('load', diffEditor.init);
