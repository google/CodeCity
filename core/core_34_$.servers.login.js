/**
 * @license
 * Copyright 2021 Google LLC
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
 * @fileoverview Login service backend server for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.servers.login = {};
Object.setOwnerOf($.servers.login, $.physicals.Neil);
$.servers.login.connection = (new 'Object.create')($.connection);
$.servers.login.connection.onReceiveLine = function onReceiveLine(line) {
  line = line.trim();
  try {
    var loginData = JSON.parse(line);
    var cookie = $.servers.login.getCookie(loginData);
    this.write(cookie);
  } catch (err) {
    // Just log error.
    suspend();
    $.system.log('$.servers.login: ' + String(err));
  } finally {
    suspend();
    this.close();
  }
};
Object.setOwnerOf($.servers.login.connection.onReceiveLine, $.physicals.Maximilian);
Object.setOwnerOf($.servers.login.connection.onReceiveLine.prototype, $.physicals.Neil);
$.servers.login.getUser = function getUser(id) {
  /* Get the $.user for the given id, or create one if none exists.
   *
   * Arguments:
   * - id: string - the ID cookie for the given user.
   * Returns: a $.user
   */
  var user = $.userDatabase.get(id);
  if (user) return user;

  // Create new $.user.
  user = Object.create($.user);
  user.setName('Guest', /*tryAlternative:*/ true);
  $.userDatabase.set(id, user);
  /*
  (function() {
    setPerms(user);
		var home = Object.create($.room);
	  home.setName(user.name + "'s room", true);
	  home.description = 'A quiet place for ' + user.name + ' to work.';
	  user.home = home;
	  user.moveTo(home);
  })();
  */
  return user;
};
Object.setOwnerOf($.servers.login.getUser, $.physicals.Maximilian);
Object.setOwnerOf($.servers.login.getUser.prototype, $.physicals.Maximilian);
$.servers.login.getCookie = function getCookie(loginData) {
  /* Get the ID cookie for the given loginData.
   *
   * Arguments:
   * - loginData: !Object - the loginData object from loginServer.
   * Returns: string - the ID cookie to set.  Empty string denotes
   *     invalid login.
   */
  var id = loginData.id;
  if (typeof(id) !== 'string') {
    return '';
  } else if ($.userDatabase.get(id)) {  // User already exists.
    return id;
  } else {  // Create new user object.
    var name = loginData.given_name || loginData.name ||
        loginData.email && loginData.email.replace(/@.*$/, '');
    this.createUser(id, name);
    return id;
  }
};
Object.setOwnerOf($.servers.login.getCookie, $.physicals.Maximilian);
Object.setOwnerOf($.servers.login.getCookie.prototype, $.physicals.Maximilian);
$.servers.login.createUser = function createUser(id, name) {
  /* Get the $.user for the given id, or create one if none exists.
   *
   * Arguments:
   * - id: string - the ID cookie for the given user.
   * - name: string - the name for the new user.
   * Returns: Object - the new $.user object
   */
  if ($.userDatabase.get(id)) throw new TypeError('user already exists');

  // Create new $.user.
  var user = Object.create($.user);
  user.setName(name || 'Guest', /*tryAlternative:*/ true);
  $.userDatabase.set(id, user);
  /*
  (function() {
    setPerms(user);
		var home = Object.create($.room);
	  home.setName(user.name + "'s room", true);
	  home.description = 'A quiet place for ' + user.name + ' to work.';
	  user.home = home;
	  user.moveTo(home);
  })();
  */
  return user;
};
Object.setOwnerOf($.servers.login.createUser, $.physicals.Maximilian);
Object.setOwnerOf($.servers.login.createUser.prototype, $.physicals.Maximilian);

