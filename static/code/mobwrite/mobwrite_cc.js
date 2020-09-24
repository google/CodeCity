/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Realtime collaboration for Code City.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

/**
 * Constructor of sharing object representing the code editor.
 * @constructor
 */
Code.MobwriteShare = function() {
  // Call our prototype's constructor.
  mobwrite.shareObj.call(this, Code.MobwriteShare.id);
};

/**
 * Handler to accept the code editor as an element that can be shared.
 * @param {string} type Type of object to share
 *     ('Code' is currently the only option).
 * @return {Object?} A sharing object or null.
 */
Code.MobwriteShare.shareHandler = function(type) {
  if (type === 'Code') {
    return new Code.MobwriteShare();
  }
  return null;
};

/**
 * Initialization that happens once DMP, MobWrite, and this file are all loaded.
 * Called by Code.Editor.waitMobWrite_
 */
Code.MobwriteShare.init = function() {
  // Fetch the sharing ID from the parent frame's URL, or invent a new one.
  var hash = parent && parent.location && parent.location.hash;
  if (hash) {
    hash = hash.substring(1);
  }
  Code.MobwriteShare.id = hash || mobwrite.uniqueId();

  // The sharing object's parent is a shareObj.
  Code.MobwriteShare.prototype = new mobwrite.shareObj();

  /**
   * Retrieve the user's content.
   * @return {string} Plaintext content.
   */
  Code.MobwriteShare.prototype.getClientText = function() {
    var value = '';
    if (Code.Editor.currentEditor) {
      value = Code.Editor.currentEditor.getSource() || '';
    }
    // Numeric data should use overwrite mode.
    this.mergeChanges = !value.match(/^\s*-?[\d.]+\s*$/);
    return value;
  };

  /**
   * Set the user's content.
   * @param {string} text New content.
   */
  Code.MobwriteShare.prototype.setClientText = function(text) {
    Code.Editor.setSourceToAllEditors(text, false);
  };

  // Register this shareHandler with MobWrite.
  mobwrite.shareHandlers.push(Code.MobwriteShare.shareHandler);
  // Default max is 10 seconds.  Decrease to 5.
  mobwrite.maxSyncInterval = 5000;
};
