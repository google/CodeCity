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
 * @fileoverview Telnet server for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.servers.telnet = {};
$.servers.telnet.connection = (new 'Object.create')($.connection);
$.servers.telnet.connection.onReceiveLine = function onReceiveLine(text) {
  if (this.user) {  // Logged in?
    // Set 'user' for this thread, and permissions for call
    Object.setOwnerOf(Thread.current(), this.user);
    setPerms(this.user);
    this.user.onInput(text);
    return;
  }
  // Remainder of function handles login.
  // TODO(fraser): Make sure that no security issues exist due to
  // called code suspending or timing out unexpectedly.
  var m = text.match(/identify as ([0-9a-f]+)/);
  if (!m) {
    this.write('{type: "narrate", text: "Unknown command: ' +
               $.utils.html.preserveWhitespace(text) + '"}');
    return;
  }
  var id = m[1];
  var user = $.userDatabase.get(id) || $.servers.login.createUser(id);
  this.user = user;
  var rebind = false;
  if (user.connection) {
    rebind = true;
    try {
      user.connection.close();
    } catch (e) {
      // Ignore; maybe connection already closed (e.g., due to crash/reboot).
    }
    $.system.log('Rebinding connection to ' + user.name);
  } else {
    $.system.log('Binding connection to ' + user.name);
  }
  user.connection = this;
  Object.setOwnerOf(Thread.current(), user);
  setPerms(this.user);
  new Thread(user.onConnect, 0, user, rebind);
};
Object.setOwnerOf($.servers.telnet.connection.onReceiveLine, $.physicals.Maximilian);
$.servers.telnet.connection.onEnd = function onEnd() {
  var user = this.user;
  // Mark connection as closed.
  $.connection.onEnd.call(this);
  if (user) {
    // Unbind connection from user.
    this.user = null;
    if (user.connection === this) {
      user.connection = null;
      $.system.log('Unbinding connection from ' + user.name);
      (function () {
        setPerms(user);
        new Thread(user.onDisconnect, 0, user);
      })();
    }
  }
  // Remove this and any other closed / debound connections from array of open connections.
  $.servers.telnet.validate();
};
Object.setOwnerOf($.servers.telnet.connection.onEnd, $.physicals.Maximilian);
$.servers.telnet.connection.onConnect = function onConnect() {
  // super call.  Records .connectTime (as number of ms since epoch).
  $.connection.onConnect.apply(this, arguments);
  // Add this connection to list of active telnet connections.
  $.servers.telnet.connected.push(this);
  setTimeout((function onConnect_timeout() {
    if (!this.user) this.close();
  }).bind(this), $.servers.telnet.LOGIN_TIMEOUT_MS);
};
Object.setOwnerOf($.servers.telnet.connection.onConnect, $.physicals.Maximilian);
Object.setOwnerOf($.servers.telnet.connection.onConnect.prototype, $.physicals.Maximilian);
$.servers.telnet.validate = function validate() {
  // Examine supposedly-open connections and close and/or remove
  // closed / timed-out / debound ones from the .connected arary.
  var limit = Date.now() - this.LOGIN_TIMEOUT_MS;
  this.connected = this.connected.filter(function(c) {
    // Close any connections that haven't logged in promptly.
    if (!c.user && c.connectTime < limit) {
      try {
        // Call .close().  Note that that this won't result in the
        // object's .connected property being set to false
        // immediately, but only after an async callback to
        // connection.onEnd() - which will result in another call
        // to $.servers.telnet.validate().
        c.close();
      } catch (e) {
        // Connection was already closed.  Mark it as such.
        c.connected = false;
      }
    }
    return c.connected && (!c.user || c.user.connection === c);
  });
};
Object.setOwnerOf($.servers.telnet.validate, $.physicals.Maximilian);
Object.setOwnerOf($.servers.telnet.validate.prototype, $.physicals.Maximilian);
$.servers.telnet.LOGIN_TIMEOUT_MS = 20000;

$.servers.telnet.connected = [];

