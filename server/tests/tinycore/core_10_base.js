/**
 * @license
 * Copyright 2017 Google LLC
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
 * @fileoverview Demonstration database for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

var $ = function() {
  throw new Error('not implemented');
};

// System object: $.system
$.system = {};
$.system.connectionListen = new 'CC.connectionListen';
$.system.connectionUnlisten = new 'CC.connectionUnlisten';
$.system.connectionWrite = new 'CC.connectionWrite';
$.system.connectionClose = new 'CC.connectionClose';
$.system.xhr = new 'CC.xhr';

// Utility object: $.utils
$.utils = {};


$.connection = {};

$.connection.onConnect = function() {
  this.user = null;
  this.buffer = '';
};

$.connection.onReceive = function(text) {
  this.buffer += text.replace(/\r/g, '');
  var lf;
  while ((lf = this.buffer.indexOf('\n')) !== -1) {
    var line = this.buffer.substring(0, lf);
    this.buffer = this.buffer.substring(lf + 1);
    this.onReceiveLine(line);
  }
};

$.connection.onReceiveLine = function(text) {
  // Override this on child classes.
};

$.connection.onEnd = function() {
  // Override this on child classes.
};

$.connection.write = function(text) {
  $.system.connectionWrite(this, text);
};

$.connection.close = function() {
  $.system.connectionClose(this);
};

$.servers = {};
