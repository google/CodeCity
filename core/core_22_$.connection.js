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
 * @fileoverview Connection object for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.connection = {};
$.connection.onConnect = function onConnect() {
  this.connectTime = Date.now();
  this.user = null;
  this.buffer = '';
  this.connected = true;
};
Object.setOwnerOf($.connection.onConnect, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.connection.onConnect.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.connection.onReceive = function onReceive(text) {
  this.buffer += text.replace(/\r/g, '');
  var lf;
  while ((lf = this.buffer.indexOf('\n')) !== -1) {
    var line = this.buffer.substring(0, lf);
    this.buffer = this.buffer.substring(lf + 1);
    this.onReceiveLine(line);
  }
};
Object.setOwnerOf($.connection.onReceive, Object.getOwnerOf($.Jssp.OutputBuffer));
$.connection.onReceiveLine = function onReceiveLine(text) {
  // Override this on child classes.
};
Object.setOwnerOf($.connection.onReceiveLine, Object.getOwnerOf($.Jssp.OutputBuffer));
$.connection.onEnd = function onEnd() {
  this.connected = false;
  this.disconnectTime = Date.now();
};
Object.setOwnerOf($.connection.onEnd, Object.getOwnerOf($.Jssp.OutputBuffer));
$.connection.write = function write(text) {
  $.system.connectionWrite(this, text);
};
Object.setOwnerOf($.connection.write, Object.getOwnerOf($.Jssp.OutputBuffer));
$.connection.close = function close() {
  $.system.connectionClose(this);
};
Object.setOwnerOf($.connection.close, Object.getOwnerOf($.Jssp.OutputBuffer));
$.connection.onError = function onError(error) {
  // TODO(cpcallen): add check for error that occurs when relistening
  // fails at server startup from checkpoint.
  if (error.message === 'write after end' ||
      error.message === 'This socket has been ended by the other party') {
    this.connected = false;
  }
};
Object.setOwnerOf($.connection.onError, Object.getOwnerOf($.Jssp.OutputBuffer));

