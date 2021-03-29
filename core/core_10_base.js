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
 * @fileoverview Database core for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

var perms = new 'perms';

var setPerms = new 'setPerms';

var $ = function $(selector) {
  return new $.Selector(selector).toValue(/*save:*/ true);
};

$.root = new 'CC.root';
$.root.name = 'root';
$.root.toString = function toString() {
  return 'root';
};

$.physicals = (new 'Object.create')(null);

$.physicals.Maximilian = {};

$.physicals.Neil = {};

$.system = {};
$.system.log = new 'CC.log';
$.system.checkpoint = new 'CC.checkpoint';
$.system.shutdown = new 'CC.shutdown';
$.system.connectionListen = new 'CC.connectionListen';
$.system.connectionUnlisten = new 'CC.connectionUnlisten';
$.system.connectionWrite = new 'CC.connectionWrite';
$.system.connectionClose = new 'CC.connectionClose';
$.system.xhr = new 'CC.xhr';
$.system.onStartup = function onStartup() {
  /* Do things needed at database start, when starting from a .js dump
   * rather than from a .city snapshot (which preserves threads,
   * listening sockets, etc.)
   */
  // Listen on various sockets.
  try {$.system.connectionListen(7776, $.servers.login.connection, 100);} catch(e) {}
  try {$.system.connectionListen(7777, $.servers.telnet.connection, 100);} catch(e) {}
  try {$.system.connectionListen(7780, $.servers.http.connection, 100);} catch(e) {}
  try {$.system.connectionListen(9999, $.servers.eval.connection);} catch(e) {}
  $.system.log('Startup: listeners started.');

  // Restart timers and clear auto-expring caches.
  $.clock.validate();
  $.db.tempId.cleanNow();
  suspend();
  $.system.log('Startup: timers restarted and caches cleared.');

  // Rebuild Selector reverse-lookup database, which is not presently
  // preserved in the dump as it is a WeakMap.
  $.Selector.db.populate();
  $.system.log('Startup: Selector reverse-lookup DB rebuilt.');
};
Object.setOwnerOf($.system.onStartup, $.physicals.Neil);
Object.setOwnerOf($.system.onStartup.prototype, $.physicals.Maximilian);

var user = function user() {
  /* The global user() is intended to be used to find the current
   * user object from deeply-nested functions (to which it is
   * impractical to thread cmd.user, for whatever reason).
   *
   * Previously user was a global variable set to the current user
   * object by $.servers.telnet.connection.onReceiveLine, but this
   * can cause problems when one command's execution suspends and
   * another user's command runs in mean time.
   *
   * It is preferable to avoid using this function; instead, use
   * cmd.user or this where possible.
   */
  $.system.log('Auditing user() usage:\n' + (new Error()).stack);
  return Object.getOwnerOf(Thread.current());
};

$.utils = {};

$.utils.validate = {};

$.servers = {};

