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

$.userDatabase = (new 'Object.create')(null);

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
  }
  var user = this.user = $.userDatabase[m[1]] || ($.userDatabase[m[1]] = $.servers.telnet.createUser());
  if (user.connection) {
    try {
      user.connection.close();
    } catch (e) {
      // Ignore; maybe connection already closed (e.g., due to crash/reboot).
    }
    $.system.log('Rebinding connection to ' + this.user.name);
  } else {
    $.system.log('Binding connection to ' + this.user.name);
  }
  user.connection = this;
  Object.setOwnerOf(Thread.current(), user);
  setPerms(this.user);
  new Thread(user.onConnect, 0, user);
};
Object.setOwnerOf($.servers.telnet.connection.onReceiveLine, Object.getOwnerOf($.Jssp.OutputBuffer));
$.servers.telnet.connection.onEnd = function onEnd() {
  var user = this.user;
  // Mark connection as closed.
  $.connection.onEnd.apply(this, arguments);
  // Remove this and any other closed / debound connections from array of open connections.
  $.servers.telnet.connected = $.servers.telnet.connected.filter(function(c) {
    return c.connected && (!c.user || c.user.connection === c);
  });
  if (user) {
    // Unbind connection from user.
    this.user = null;
    if (user.connection === this) {
      user.connection = null;
      $.system.log('Unbinding connection from ' + user.name);
    }
    setPerms(user);
    new Thread(user.onDisconnect, 0, user);
  }
};
Object.setOwnerOf($.servers.telnet.connection.onEnd, Object.getOwnerOf($.Jssp.OutputBuffer));
$.servers.telnet.connection.onConnect = function() {
  // super call.
  $.connection.onConnect.apply(this, arguments);
  // Record connection time.
  this.startTime = new Date();
  // Add this connection to list of active telnet connections.
  $.servers.telnet.connected.push(this);

};
delete $.servers.telnet.connection.onConnect.name;
Object.setOwnerOf($.servers.telnet.connection.onConnect, Object.getOwnerOf($.Jssp.OutputBuffer));
$.servers.telnet.connection.onConnect.prototype = $.connection.onConnect.prototype;
$.servers.telnet.createUser = function createUser() {
  var guest = Object.create($.user);
  guest.setName('Guest', /*tryAlternative:*/ true);
  /*
  (function() {
    setPerms(guest);
		var home = Object.create($.room);
	  home.setName(guest.name + "'s room", true);
	  home.description = 'A quiet place for ' + guest.name + ' to work.';
	  guest.home = home;
	  guest.moveTo(home);
  })();
  */
  return guest;
};
Object.setOwnerOf($.servers.telnet.createUser, Object.getOwnerOf($.Jssp.OutputBuffer));

$.servers.telnet.connected = [];

