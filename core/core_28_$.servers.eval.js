/**
 * @license
 * Copyright 2020 Google LLC
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
 * @fileoverview Eval server for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.servers.eval = {};
$.servers.eval.connection = (new 'Object.create')($.connection);
$.servers.eval.connection.onReceiveLine = function(text) {
  if (this !== $.servers.eval.connected) {
    this.close();
    return;
  }
  this.write('⇒ ' + $.utils.code.eval(text) + '\n');
  this.write('eval> ');
};
$.servers.eval.connection.onReceiveLine.prototype = $.connection.onReceiveLine.prototype;
$.servers.eval.connection.onConnect = function onConnect() {
  $.connection.onConnect.apply(this, arguments);
  if ($.servers.eval.connected) {
    $.servers.eval.connected.close();
  }
  $.servers.eval.connected = this;
  this.write('eval> ');
};
Object.setOwnerOf($.servers.eval.connection.onConnect, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.servers.eval.connection.onConnect.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.servers.eval.connection.close = function() {
  this.write('This session has been terminated.\n');
  return $.connection.close.apply(this, arguments);
};
$.servers.eval.connection.close.prototype = $.connection.close.prototype;
$.servers.eval.connection.onEnd = function() {
  $.servers.eval.connected = null;
  return $.connection.onEnd.apply(this, arguments);
};
delete $.servers.eval.connection.onEnd.name;
$.servers.eval.connection.onEnd.prototype = $.connection.onEnd.prototype;
$.servers.eval.connected = null;

