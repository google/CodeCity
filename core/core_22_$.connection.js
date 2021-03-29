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
Object.setOwnerOf($.connection.onConnect, $.physicals.Maximilian);
Object.setOwnerOf($.connection.onConnect.prototype, $.physicals.Maximilian);
$.connection.onReceive = function onReceive(text) {
  this.buffer += text.replace(/\r/g, '');
  var lf;
  while ((lf = this.buffer.indexOf('\n')) !== -1) {
    var line = this.buffer.substring(0, lf);
    this.buffer = this.buffer.substring(lf + 1);
    this.onReceiveLine(line);
  }
};
Object.setOwnerOf($.connection.onReceive, $.physicals.Maximilian);
$.connection.onReceiveLine = function onReceiveLine(text) {
  // Override this on child classes.
};
Object.setOwnerOf($.connection.onReceiveLine, $.physicals.Maximilian);
$.connection.onEnd = function onEnd() {
  this.connected = false;
  this.disconnectTime = Date.now();
  this.close();
};
Object.setOwnerOf($.connection.onEnd, $.physicals.Maximilian);
$.connection.write = function write(text) {
  $.system.connectionWrite(this, text);
};
Object.setOwnerOf($.connection.write, $.physicals.Maximilian);
$.connection.close = function close() {
  $.system.connectionClose(this);
};
Object.setOwnerOf($.connection.close, $.physicals.Maximilian);
$.connection.onError = function onError(error) {
  // TODO: add check for error that occurs when relistening
  // fails when restarting server from checkpoint.
  if (error.message === 'write after end' ||
      error.message === 'This socket has been ended by the other party') {
    this.connected = false;
  }
};
Object.setOwnerOf($.connection.onError, $.physicals.Maximilian);

