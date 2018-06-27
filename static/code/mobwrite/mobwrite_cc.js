/**
 * @license
 * Code City: MobWrite interface for CC Code Editor.
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
 * @fileoverview Realtime collaboration for Code City.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

/**
 * Constructor of sharing object representing the code editor.
 * @constructor
 */
Code.mobwriteShare = function() {
  // Call our prototype's constructor.
  mobwrite.shareObj.call(this, Code.mobwriteShare.id);
};

/**
 * Handler to accept the code editor as an element that can be shared.
 * @param {string} type Type of object to share
 *     ('Code' is currently the only option).
 * @return {Object?} A sharing object or null.
 */
Code.mobwriteShare.shareHandler = function(type) {
  if (type === 'Code') {
    return new Code.mobwriteShare();
  }
  return null;
};

/**
 * Initialization that happens once DMP, MobWrite, and this file are all loaded.
 * Called by Code.Editor.waitMobWrite_
 */
Code.mobwriteShare.init = function() {
  // Fetch the sharing ID from the parent frame's URL, or invent a new one.
  var hash = parent && parent.location && parent.location.hash;
  if (hash) {
    hash = hash.substring(1);
  }
  Code.mobwriteShare.id = hash || mobwrite.uniqueId();

  // The sharing object's parent is a shareObj.
  Code.mobwriteShare.prototype = new mobwrite.shareObj();

  /**
   * Retrieve the user's content.
   * @return {string} Plaintext content.
   */
  Code.mobwriteShare.prototype.getClientText = function() {
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
  Code.mobwriteShare.prototype.setClientText = function(text) {
    Code.Editor.setSourceToAllEditors(text, false);
  };

  // Register this shareHandler with MobWrite.
  mobwrite.shareHandlers.push(Code.mobwriteShare.shareHandler);
  // Point MobWrite at the daemon on Code City.
  mobwrite.syncGateway = '/mobwrite';
};
