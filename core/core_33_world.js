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
 * @fileoverview Generic physical object types for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.user = (new 'Object.create')($.physical);
$.user.name = 'User prototype';
$.user.connection = null;
$.user.svgText = '<circle cx="50" cy="50" r="10" class="fillWhite"/><line x1="50" y1="60" x2="50" y2="80" /><line x1="40" y1="70" x2="60" y2="70" /><line x1="50" y1="80" x2="40" y2="100" /><line x1="50" y1="80" x2="60" y2="100" />';
$.user.eval = function $_user_eval(cmd) {
  // Format:  ;1+1    -or-    eval 1+1
  var src = (cmd.cmdstr[0] === ';') ? cmd.cmdstr.substring(1) : cmd.argstr;
  src = $.utils.code.rewriteForEval(src, /* forceExpression= */ false);
  // Do eval with this === this and vars me === this and here === this.location.
  var evalFunc = $_user_eval.doEval_.bind(this, this, this.location);
  var out = $.utils.code.eval(src, evalFunc);
  suspend();
  cmd.user.narrate('⇒ ' + out);
};
Object.setOwnerOf($.user.eval, $.physicals.Maximilian);
$.user.eval.verb = 'eval|;.*';
$.user.eval.dobj = 'any';
$.user.eval.prep = 'any';
$.user.eval.iobj = 'any';
$.user.eval.doEval_ = function doEval_(me, here, $$$src) {
  // Execute eval in a scope with no variables.
  // The '$$$src' parameter is awkwardly-named so as not to collide with user
  // evaled code.  The 'me' and 'here' parameters are exposed to the user.
  return eval($$$src);
};
$.user.narrate = function narrate(text, obj) {
  var memo = {type: 'narrate', text: String(text)};
  if (obj && obj.location) {
    memo.source = obj;
    memo.where = obj.location;
  }
  this.readMemo(memo);
};
$.user.create = function(cmd) {
  if ($.physical !== cmd.dobj && !$.physical.isPrototypeOf(cmd.dobj)) {
    cmd.user.narrate('Unknown prototype object.\n' + $.user.create.usage);
    return;
  } else if (!cmd.iobjstr) {
    cmd.user.narrate('Name must be specified.\n' + $.user.create.usage);
    return;
  }
  var obj = Object.create(cmd.dobj);
  Object.setOwnerOf(obj, cmd.user);
  obj.setName(cmd.iobjstr, /*tryAlternative:*/ true);
  cmd.user.narrate(String(obj) + ' created.');
  try {
    obj.moveTo(cmd.user);
  } catch (e) {
    cmd.user.narrate(e.message);
    var selector = $.Selector.for(obj);
    if (selector) {
      cmd.user.narrate('It can be accessed as ' + String(selector));
    }
  }
};
delete $.user.create.name;
Object.setOwnerOf($.user.create, $.physicals.Maximilian);
$.user.create.usage = 'Usage: create <prototype> as <name>';
$.user.create.verb = 'create';
$.user.create.dobj = 'any';
$.user.create.prep = 'as';
$.user.create.iobj = 'any';
$.user.join = function join(cmd) {
  var name = cmd.dobjstr;
  var re = new RegExp('^' + name, 'i');
  var who = null;
  for (var key in $.physicals) {
    var obj = $.physicals[key];
    if (!$.user.isPrototypeOf(obj)) continue;
    if (String(obj).match(re)) {
      who = obj;
      break;
    }
  }
  if (!who) {
    cmd.user.narrate('Can\'t find a user named "' + name + '".');
    return;
  }
  cmd.user.narrate('You join ' + String(who) + '.');
  this.teleportTo(who.location);
};
Object.setOwnerOf($.user.join, $.physicals.Maximilian);
$.user.join.verb = 'join';
$.user.join.dobj = 'any';
$.user.join.prep = 'none';
$.user.join.iobj = 'none';
$.user.quit = function(cmd) {
  if (this.connection) {
    this.connection.close();
  }
};
$.user.quit.verb = 'quit';
$.user.quit.dobj = 'none';
$.user.quit.prep = 'none';
$.user.quit.iobj = 'none';
$.user.willAccept = function(what, src) {
  // Returns true iff this is willing to accept what arriving from src.
  //
  // This function (or its overrides) MUST NOT have any kind of
  // observable side-effect (making noise, causing some other action,
  // etc.).
  return $.thing.isPrototypeOf(what);
};
delete $.user.willAccept.name;
Object.setOwnerOf($.user.willAccept, $.physicals.Maximilian);
Object.setOwnerOf($.user.willAccept.prototype, $.physicals.Maximilian);
$.user.moveTo = function moveTo(dest, opt_neighbour) {
  var r = $.physical.moveTo.call(this, dest, opt_neighbour);
  if (this.location === null) {
    // Show null scene.
	  var memo = {
  	  type: 'scene',
    	requested: true,
	    user: this,
  	  where: 'The null void',
    	description: "You have somehow ended up nowhere at all.\n(Type 'home' to go home.)",
	    svgText: this.getNullSvgText(),
  	  contents: []
	  };
	  this.readMemo(memo);
  }
	return r;
};
Object.setOwnerOf($.user.moveTo, $.physicals.Maximilian);
Object.setOwnerOf($.user.moveTo.prototype, $.physicals.Maximilian);
$.user.getNullSvgText = function getNullSvgText() {
  // Return an SVG text for the null void (i.e., what
  // a user sees if they're .location is null).

  // Draw a double spiral on a black background.
  // TODO(cpcallen): make spiral curved, rather than angular.
  var out = [];
  out.push('<rect class="fillBlack strokeNone" height="100" width="2000" x="-1000" y="0"/>\n');
  for (var i = 0; i < 2; i++) {
    var vx = 0;
    var vy = Math.pow(-1, i);
  	out.push('<path class="strokeWhite" d="M ', 100 * vx, ',', 50 - 50 * vy, ' ');
    for (var j = 0; j < 20; j++) {
      var d = Math.pow(0.5, j/2);
      out.push(' ', 100 * d * vx, ',', 50 - 50 * d * vy, ' ');
      var tmp = vx;
      vx = -vy;
      vy = tmp;
  	}
	  out.push('"/>\n');
  }
  return out.join('');
};
Object.defineProperty($.user.getNullSvgText, 'name', {value: 'nullVoidSvgText'});
$.user.getCommands = function(who) {
  var commands = $.physical.getCommands.apply(this, arguments);
  if (who.location !== this.location) {
    commands.push('join ' + this.name);
  }
  return commands;
};
Object.setOwnerOf($.user.getCommands.prototype, $.physicals.Maximilian);
$.user.who = function(cmd) {
  $.console.look({user: cmd.user});
};
delete $.user.who.name;
$.user.who.verb = 'w(ho)?';
$.user.who.dobj = 'none';
$.user.who.prep = 'none';
$.user.who.iobj = 'none';
$.user.onInput = function onInput(command) {
  // Process one line of input from the user.
  // TODO(cpcallen): add security checks!
  try {
    $.utils.command.execute(command.trim(), this);
  } catch (e) {
    suspend();
    this.narrate(String(e));
    if (e instanceof Error) this.narrate(e.stack);
  }
};
Object.setOwnerOf($.user.onInput, $.physicals.Maximilian);
$.user.grep = function grep(cmd) {
  try {
    var selector = new $.Selector(cmd.dobjstr);
  } catch (e) {
    throw 'Invalid selector ' + cmd.dobjstr;
  }
  if (!cmd.iobjstr) throw 'What do you want to search for?';
  this.grep.search(cmd.user, selector.toString(), cmd.iobjstr, selector, new WeakMap());
  cmd.user.narrate('Grep complete.');
};
Object.setOwnerOf($.user.grep, $.physicals.Maximilian);
$.user.grep.verb = 'grep';
$.user.grep.dobj = 'any';
$.user.grep.prep = 'for/about';
$.user.grep.iobj = 'any';
$.user.grep.search = function search(user, prefix, searchString, selector, seen) {
  var value = selector.toValue();
  if (!$.utils.isObject(value)) {  // value is a primitive.
    if (String(value).includes(searchString))	{
      var formatted = $.utils.code.toSource(value);
      if (typeof value === 'string' && formatted.length > 60) {
        // Print only extracts of long string values.
        formatted = formatted.slice(1, -1);  // Remove quotation marks.
        var re = new RegExp('.{0,20}' +
                            $.utils.regexp.escape(searchString) +
                            '.{0,20}', 'g');
        var m;
        while ((m = re.exec(formatted))) {
          user.narrate(selector.toString() + ' includes' + ' ...' + m[0] + '...');
        }
      } else {
        user.narrate(selector.toString() + ' === ' + formatted);
      }
    }
    return;
  }
  // Prune search when we wander into objects with canonical Selectors
  // not starting with prefix.  Otherwise, use canonical Selector.
  var canonical = $.Selector.for(value);
  if (canonical) {
    if (canonical.toString().indexOf(prefix) !== 0) return;
    selector = canonical;
  }
  // Have we seen it before?
	if (seen.has(value)) return;
  seen.set(value, true);
  // Is it a function containing the search string?
  if (typeof value === 'function') {
    var text = Function.prototype.toString.call(value);
    if (text.includes(searchString)) {
      user.narrate(selector.toString() + ' mentions ' + searchString + ':');
      var lines = text.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchString)) {
          user.narrate('    line ' + (i + 1) + ': ' + lines[i]);
        }
      }
    }
  }
	// Check key names
  var keys = Object.getOwnPropertyNames(value);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var subSelector = new $.Selector(selector.concat(key));
    if (key.includes(searchString)) {
      user.narrate(subSelector.toString() + ' exists.');
    }
    if (key === 'cache_') {
      user.narrate('Skipping ' + subSelector.toString());
      continue;
    }
    while (true) {
      try {
        search(user, prefix, searchString, subSelector, seen);
        break;
      } catch (e) {
        suspend();
        if (!(e instanceof RangeError) || e.message !== 'Thread ran too long') throw e;
      }
    }
  }
};
Object.setOwnerOf($.user.grep.search, $.physicals.Maximilian);
$.user.readMemo = function readMemo(memo) {
  // See $.physical.readMemo for documentation.
  $.physical.readMemo.call(this, memo);
  if (!this.connection) return;
  memo = $.utils.replacePhysicalsWithName(memo);
  var json = JSON.stringify(memo) + '\n';
  try {
    this.connection.write(json);
  } catch(e) {
    if (e.message === 'object is not connected') {
      this.connection = null;
    } else {
      throw e;
    }
  }
};
$.user.destroyVerb = function destroyVerb(cmd) {
  // DO NOT MAKE SUPER CALL!
  if (cmd.user === this) {
    throw 'You can reach the National Suicide Prevention Lifeline at 1-800-273-8255.';
  }
  throw 'You are not allowed to destroy other users.';
};
Object.setOwnerOf($.user.destroyVerb, $.physicals.Maximilian);
$.user.destroyVerb.usage = 'Usage: destroy <object>';
$.user.destroyVerb.verb = 'destroy';
$.user.destroyVerb.dobj = 'this';
$.user.destroyVerb.prep = 'none';
$.user.destroyVerb.iobj = 'none';
$.user.homeVerb = function homeVerb(cmd) {
  var home = cmd.user.home || $.startRoom;
	if (cmd.user.location === home) {
    cmd.user.narrate('You are already at home.');
    return;
  }
  cmd.user.narrate('You go home.');
  cmd.user.teleportTo(home);
};
Object.setOwnerOf($.user.homeVerb, $.physicals.Maximilian);
$.user.homeVerb.verb = 'home';
$.user.homeVerb.dobj = 'none';
$.user.homeVerb.prep = 'none';
$.user.homeVerb.iobj = 'none';
$.user.teleportTo = function teleportTo(dest, opt_neighbour) {
  if (this.location === dest) {
    this.narrate("You're already in " + String(dest) + ".")
    return;
  }
  $.physical.teleportTo.call(this, dest, opt_neighbour);
};
Object.setOwnerOf($.user.teleportTo, $.physicals.Maximilian);
Object.setOwnerOf($.user.teleportTo.prototype, $.physicals.Maximilian);
$.user.go = function go(cmd) {
  var dest = null;
  if ($.room.isPrototypeOf(cmd.iobj)) {
    dest = cmd.iobj;
  } else if (!cmd.iobjstr) {
    throw 'Usage: go to <name of room>';
  } else {
    var re = new RegExp(cmd.iobjstr, 'i');
    // TODO: find best match, not just first match?
    for (var name in $.physicals) {
      if (name.match(re) && $.room.isPrototypeOf($.physicals[name])) {
        dest = $.physicals[name];
        break;
      }
    }
  }
  if (dest) {
    this.teleportTo(dest);
  } else {
    throw 'There is no room named ' + cmd.iobjstr + '.';
  }
};
Object.setOwnerOf($.user.go, $.physicals.Maximilian);
Object.setOwnerOf($.user.go.prototype, $.physicals.Maximilian);
$.user.go.verb = 'go';
$.user.go.dobj = 'none';
$.user.go.prep = 'at/to';
$.user.go.iobj = 'any';
$.user.onConnect = function onConnect(reconnect) {
  /* Called from $.servers.telnet.connection.onReceiveLine once a new
   * connection is logged in to this user.  Argument will be true if
   * user was already connected (and this is just a reconnection).
   */
  if ($.room.isPrototypeOf(this.location)) {
    this.location.narrate(
      String(this) + (reconnect ? ' startles awake.' : ' wakes up.'),
      this);
    this.onInput('look');
  } else {
    this.teleportTo(this.home || $.startRoom);
  }
  if (this.name.match(/^Guest/)) {
    this.narrate(
      'Welcome to Code City.\n' +
      "If you're planning to hang around, why not give your self a\n" +
      'name by typing "rename me to <new name>" in the box below.');
  }
};
Object.setOwnerOf($.user.onConnect, $.physicals.Maximilian);
Object.setOwnerOf($.user.onConnect.prototype, $.physicals.Maximilian);
$.user.onDisconnect = function onDisconnect() {
  /* Called from $.servers.telnet.connection.onEnd once connection
   * has dropped.
   */
  // Have they made an effort to not look like a guest?
  if (this.hasOwnProperty('description') ||
      this.hasOwnProperty('home') ||
      !this.name.match(/^Guest(?: #\d+)?/) ||
      Object.getOwnPropertyNames(this).length > 5) {
    // Not a guest.
    if (this.location) {
      this.location.narrate(String(this) + ' nods off to sleep.', this);
    }
  } else {
    // Pretty guest-y.
    if (this.location) {
      this.location.narrate(String(this) + ' suddenly vanishes without a trace!');
    }
    this.destroy();
  }
};
Object.setOwnerOf($.user.onDisconnect, $.physicals.Maximilian);
Object.setOwnerOf($.user.onDisconnect.prototype, $.physicals.Maximilian);
$.user.description = 'A new user who has not yet set his/her description.';
$.user.destroy = function destroy() {
  $.physical.destroy.call(this);

  // Make sure next login gets a fresh guest.
  suspend();
  $.userDatabase.validate();
};
Object.setOwnerOf($.user.destroy, $.physicals.Maximilian);
Object.setOwnerOf($.user.destroy.prototype, $.physicals.Maximilian);
$.user.inventory = function inventory(cmd) {
  this.look(cmd);
};
Object.setOwnerOf($.user.inventory, $.physicals.Neil);
Object.setOwnerOf($.user.inventory.prototype, $.physicals.Maximilian);
$.user.inventory.verb = 'inv(entory)?';
$.user.inventory.dobj = 'none';
$.user.inventory.prep = 'none';
$.user.inventory.iobj = 'none';
$.user.willMoveTo = function willMoveTo(dest) {
  /* Returns true iff this is willing to move to dest.
   *
   * This function (or its overrides) MUST NOT have any kind of
   * observable side-effect (making noise, causing some other action,
   * etc.)
   */
  // Users should in general always be in a room.
  return $.room.isPrototypeOf(dest);
};
Object.setOwnerOf($.user.willMoveTo, $.physicals.Maximilian);
Object.setOwnerOf($.user.willMoveTo.prototype, $.physicals.Maximilian);
$.user.inlineEdit = function inlineEdit(cmd) {
  var obj = cmd.iobj;
  var objName = cmd.iobjstr;
  var prop = cmd.dobjstr;

  if (!$.utils.isObject(obj) || !prop) {
    cmd.user.narrate('Usage: edit <property> on <object>');
    return;
  }
  var url = $.hosts.code['/inlineEdit'].edit(obj, objName, prop);
  var memo = {
    type: 'iframe',
    url: url,
    alt: 'Edit ' + prop + ' on ' + objName
  };
  cmd.user.readMemo(memo);
};
Object.setOwnerOf($.user.inlineEdit, $.physicals.Maximilian);
$.user.inlineEdit.verb = 'edit';
$.user.inlineEdit.dobj = 'any';
$.user.inlineEdit.prep = 'on top of/on/onto/upon';
$.user.inlineEdit.iobj = 'any';
$.user.describe = function describe(cmd) {
  if (typeof this.description === 'function') {
    cmd.user.narrate("Can't set description since it is a function.");
    return;
  }
  this.description = cmd.iobjstr;
  cmd.user.narrate($.utils.string.capitalize(String(this)) + '\'s description set to "' + this.description + '".');
};
Object.setOwnerOf($.user.describe, $.physicals.Neil);
Object.setOwnerOf($.user.describe.prototype, $.physicals.Neil);
$.user.describe.verb = 'describe';
$.user.describe.dobj = 'this';
$.user.describe.prep = 'as';
$.user.describe.iobj = 'any';
$.user.lookJssp = "<table style=\"height: 100%; width: 100%;\">\n  <tr>\n    <td style=\"padding: 1ex; width: 30%;\">\n      <svg width=\"100%\" height=\"100%\" viewBox=\"0 0 0 0\">\n        <%= $.utils.object.getValue(this, 'svgText') %>\n      </svg>\n    </td>\n    <td>\n    <h1><%= $.utils.html.escape(String(this)) + $.utils.commandMenu(this.getCommands(request.user)) %></h1>\n    <p><%= $.utils.html.preserveWhitespace($.utils.object.getValue(this, 'description')) %><br>\n      <%= String(this) + (this.connection && this.connection.connected ? ' is awake.' : ' is sleeping.') %></p>\n<%\nvar contents = this.getContents();\nif (contents.length) {\n  var contentsHtml = [];\n  for (var i = 0; i < contents.length; i++) {\n    contentsHtml[i] = $.utils.html.escape(contents[i].name) +\n        $.utils.commandMenu(contents[i].getCommands(request.user));\n  }\n  response.write('<p>Contents: ' + contentsHtml.join(', ') + '</p>');\n}\nif (this.location) {\n  response.write('<p>Location: ' + $.utils.html.escape(this.location.name) +\n      $.utils.commandMenu(this.location.getCommands(request.user)) + '</p>');\n}\n%>\n    </td>\n  </tr>\n</table>";

$.room = (new 'Object.create')($.physical);
$.room.name = 'Room prototype';
$.room.svgText = '<line x1="-1000" y1="90" x2="1000" y2="90" />';
$.room.sendScene = function sendScene(who, requested) {
  var memo = {
    type: 'scene',
    requested: requested,
    user: who,
    where: this,
    description: $.utils.object.getValue(this, 'description'),
    svgText: $.utils.object.getValue(this, 'svgText'),
    contents: []
  };
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var object = contents[i];
    memo.contents.push({
      type: $.user.isPrototypeOf(object) ? 'user' : 'thing',
      what: object,
      svgText: $.utils.object.getValue(object, 'svgText'),
      cmds: object.getCommands(who)
    });
  }
  who.readMemo(memo);
};
Object.setOwnerOf($.room.sendScene, $.physicals.Neil);
$.room.look = function look(cmd) {
  this.sendScene(cmd.user, true);
};
Object.setOwnerOf($.room.look, $.physicals.Maximilian);
$.room.look.verb = 'l(ook)?';
$.room.look.dobj = 'this';
$.room.look.prep = 'none';
$.room.look.iobj = 'none';
$.room.say = function say(cmd) {
  // Format:  "Hello.    -or-    say Hello.
  var text = (cmd.cmdstr[0] === '"') ? cmd.cmdstr.substring(1) : cmd.argstr;
  var lastLetter = text.trim().slice(-1);
  var type = (lastLetter === '?') ? 1 :
            ((lastLetter === '!') ? 2 : 0);
  var verb = [['say', 'says'], ['ask', 'asks'], ['exclaim', 'exclaims']][type];
  var altMe = 'You ' + verb[0] + ', "' + text + '"';
  var altOthers = cmd.user + ' ' + verb[1] + ', "' + text + '"';
  var memo = {
    type: 'say',
    source: cmd.user,
    where: this,
    text: text,
    alt: altMe
  };
  cmd.user.readMemo(memo);
  memo.alt = altOthers;
  this.sendMemo(memo, cmd.user);
};
Object.setOwnerOf($.room.say, $.physicals.Maximilian);
$.room.say.verb = 'say?|".*';
$.room.say.dobj = 'any';
$.room.say.prep = 'any';
$.room.say.iobj = 'any';
$.room.think = function think(cmd) {
  var text = cmd.argstr;
  var altMe = 'You think, "' + text + '"';
  var altOthers = cmd.user + ' thinks, "' + text + '"';
  var memo = {
    type: "think",
    source: cmd.user,
    where: this,
    text: text,
    alt: altMe
  };
  cmd.user.readMemo(memo);
  memo.alt = altOthers;
  this.sendMemo(memo, cmd.user);
};
Object.setOwnerOf($.room.think, $.physicals.Neil);
$.room.think.verb = 'think|.oO';
$.room.think.dobj = 'any';
$.room.think.prep = 'any';
$.room.think.iobj = 'any';
$.room.narrate = function narrate(text, except, obj) {
  /* Send narration text to the contents of the room.
   * 
   * text is the contents of the narration.
	 *
   * except is an individual $.physical object, or an array of such,
   *        which should not receive the narration.
   *
   * obj, if specified, will cause the narration to have a speech-
   *      -bubble style arrow pointing at the specified object,
   *      provided that object is in the room.
   */
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing !== except &&
        !(except && except.includes && except.includes(thing)) &&
        thing.narrate) {
      thing.narrate(text, obj);
    }
  }
};
$.room.willAccept = function(what, src) {
  // Returns true iff this is willing to accept what arriving from src.
  //
  // This function (or its overrides) MUST NOT have any kind of
  // observable side-effect (making noise, causing some other action,
  // etc.).
  return $.thing.isPrototypeOf(what) || $.user.isPrototypeOf(what);
};
delete $.room.willAccept.name;
$.room.onEnter = function onEnter(what, src) {
  // TODO: caller check: should only be called by $.physical.moveTo.
  $.physical.validate.call(this);
  this.updateScene(false);

  if ($.user.isPrototypeOf(what)) {
    this.sendScene(what, true);
  }
};
Object.setOwnerOf($.room.onEnter, $.physicals.Neil);
$.room.onExit = function onExit(what, dest) {
  // TODO: caller check: should only be called by $.physical.moveTo.
  suspend(0);  // Wait for what to actually leave.
  $.physical.validate.call(this);
  this.updateScene(false);
};
Object.setOwnerOf($.room.onExit, $.physicals.Neil);
$.room.lookHere = function lookHere(cmd) {
  return this.look(cmd);
};
$.room.lookHere.verb = 'l(ook)?';
$.room.lookHere.dobj = 'none';
$.room.lookHere.prep = 'none';
$.room.lookHere.iobj = 'none';
$.room.location = null;
$.room.contents_ = [];
$.room.contents_.forObj = $.room;
Object.defineProperty($.room.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.room.contents_.forKey = 'contents_';
Object.defineProperty($.room.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.room.sendMemo = function sendMemo(memo, except) {
  /* Send a memo to most or all objects in this room.
   * - memo: the memo to be sent.
	 * - except: an individual $.physical object, or an array of such,
   *           which should not receive the memo.
   */
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing === except || except && except.includes && except.includes(thing)) {
      continue;
    }
    thing.readMemo(memo);
  }
};
Object.setOwnerOf($.room.sendMemo, $.physicals.Neil);
$.room.emote = function emote(cmd) {
  // Format:  :blinks..    -or-    ::'s ears twitch.
  var m, action;
  if (cmd.verbstr === 'emote') {
    action = String(cmd.user) + ' ' + cmd.argstr;
  } else if ((m =  /^:(:?)([^:]+)$/.exec(cmd.cmdstr))) {
    var space = (m[1] === '') ? ' ' : '';
    var text = m[2].trim();
    action = String(cmd.user) + space + text;
  } else {
    cmd.user.narrate('Try ":blinks." or "::\'s ears twitch."');
    return
  }
  cmd.user.location.narrate(action);
};
Object.setOwnerOf($.room.emote, $.physicals.Maximilian);
Object.setOwnerOf($.room.emote.prototype, $.physicals.Maximilian);
$.room.emote.verb = '::?[^:]+';
$.room.emote.dobj = 'any';
$.room.emote.prep = 'any';
$.room.emote.iobj = 'any';
$.room.updateScene = function updateScene(force) {
  var contents = this.getContents();
  for (var i = 0, who; (who = contents[i]); i++) {
    if ($.user.isPrototypeOf(who)) {
      this.sendScene(who, force);
    }
  }
};
Object.setOwnerOf($.room.updateScene, $.physicals.Neil);
Object.setOwnerOf($.room.updateScene.prototype, $.physicals.Neil);

$.thing = (new 'Object.create')($.physical);
$.thing.name = 'Thing prototype';
$.thing.svgText = '<path d="M10,90 l5,-5 h10 v10 l-5,5" class="fillWhite"/><line x1="20" y1="90" x2="25" y2="85"/><rect height="10" width="10" y="90" x="10" class="fillWhite"/>';
$.thing.get = function get(cmd) {
  if (this.location !== cmd.user.location) {
    cmd.user.narrate("You can't reach " + this.name + ".");
    return;
  }
  try {
    this.moveTo(cmd.user);
  } catch (e) {
    throw (e instanceof Error) ? e.message : e;
  }
  cmd.user.narrate('You pick up ' + this.name + '.');
  if (cmd.user.location) {
    cmd.user.location.narrate(cmd.user.name + ' picks up ' + this.name + '.', cmd.user);
  }
};
Object.setOwnerOf($.thing.get, $.physicals.Maximilian);
$.thing.get.verb = 'get|take';
$.thing.get.dobj = 'this';
$.thing.get.prep = 'none';
$.thing.get.iobj = 'none';
$.thing.drop = function drop(cmd) {
  if (this.location !== cmd.user) {
    cmd.user.narrate("You can't drop something you're not holding.");
    return;
  }
  try {
    this.moveTo(cmd.user.location);
  } catch (e) {
    throw (e instanceof Error) ? e.message : e;
  }
  cmd.user.narrate('You drop ' + this.name + '.');
  if (cmd.user.location) {
    cmd.user.location.narrate(cmd.user.name + ' drops ' + this.name + '.', cmd.user);
  }
};
Object.setOwnerOf($.thing.drop, $.physicals.Maximilian);
$.thing.drop.verb = 'drop|throw';
$.thing.drop.dobj = 'this';
$.thing.drop.prep = 'none';
$.thing.drop.iobj = 'none';
$.thing.give = function give(cmd) {
  if (this.location !== cmd.user && this.location !== cmd.user.location) {
    cmd.user.narrate("You can't reach " + String(this) + ".");
    return;
  }
  try {
    this.moveTo(cmd.iobj);
  } catch (e) {
    throw (e instanceof Error) ? e.message : e;
  }
  cmd.user.narrate('You give ' + String(this) + ' to ' + String(cmd.iobj) + '.');
  cmd.iobj.narrate(String(cmd.user) + ' gives ' + String(this) + ' to you.');
  if (cmd.user.location) {
    cmd.user.location.narrate(
        String(cmd.user) + ' gives ' + String(this) + ' to ' + String(cmd.iobj) + '.',
        [cmd.user, cmd.iobj]);
  }
};
Object.setOwnerOf($.thing.give, $.physicals.Maximilian);
Object.setOwnerOf($.thing.give.prototype, $.physicals.Maximilian);
$.thing.give.verb = 'give';
$.thing.give.dobj = 'this';
$.thing.give.prep = 'at/to';
$.thing.give.iobj = 'any';
$.thing.getCommands = function getCommands(who) {
  var commands = $.physical.getCommands.call(this, who);
  if (this.location === who) {
    commands.push('drop ' + this.name);
  } else if (this.location === who.location) {
    commands.push('get ' + this.name);
  }
  return commands;
};
Object.setOwnerOf($.thing.getCommands, $.physicals.Neil);
Object.setOwnerOf($.thing.getCommands.prototype, $.physicals.Maximilian);
$.thing.movable = true;
$.thing.location = null;
$.thing.contents_ = [];
$.thing.contents_.forObj = $.thing;
Object.defineProperty($.thing.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.thing.contents_.forKey = 'contents_';
Object.defineProperty($.thing.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.thing.willMoveTo = function willMoveTo(dest) {
  /* Returns true iff this is willing to move to dest.
   *
   * This function (or its overrides) MUST NOT have any kind of
   * observable side-effect (making noise, causing some other action,
   * etc.)
   */
  return Boolean(this.movable);
};
Object.setOwnerOf($.thing.willMoveTo, $.physicals.Maximilian);
Object.setOwnerOf($.thing.willMoveTo.prototype, $.physicals.Maximilian);

$.container = (new 'Object.create')($.thing);
$.container.getFrom = function getFrom(cmd) {
  var thing = cmd.dobj;
  if ($.utils.command.matchFailed(thing)) {
    thing = $.utils.command.match(cmd.dobjstr, this);
  }
  if ($.utils.command.matchFailed(thing, cmd.dobjstr, cmd.user)) return;
  if (!this.isOpen) {
    cmd.user.narrate($.utils.string.capitalize(String(this)) + ' is closed.');
    return;
  }
  if (this.location !== cmd.user.location && this.location !== cmd.user) {
    cmd.user.narrate($.utils.string.capitalize(String(this)) + ' is not here.');
    return;
  }
  if (thing.location !== this) {
    cmd.user.narrate($.utils.string.capitalize(String(thing)) + ' is not in ' + String(this) + '.');
    return;
  }
  try {
    thing.moveTo(this.toFloor ? this.location : cmd.user);
  } catch (e) {
    cmd.user.narrate(e.message);
    return;
  }
  cmd.user.narrate('You take ' + String(thing) + ' from ' + String(this) + '.');
  if (cmd.user.location) {
    cmd.user.location.narrate(String(cmd.user) + ' takes ' + String(thing) + ' from ' + String(this) + '.', cmd.user);
  }
};
Object.setOwnerOf($.container.getFrom, $.physicals.Neil);
$.container.getFrom.verb = 'get|take';
$.container.getFrom.dobj = 'any';
$.container.getFrom.prep = 'out of/from inside/from';
$.container.getFrom.iobj = 'this';
$.container.name = 'Container prototype';
$.container.svgTextOpen = '<path class="fillWhite" d="m10,90l5,-5l10,0l0,10l-5,5"/>\n<line x1="15" x2="15" y1="95" y2="85"/>\n<rect class="fillWhite" height="10" width="10" x="10" y="90"/>\n<line x1="20" x2="25" y1="90" y2="85"/>\n<path class="fillWhite" d="m10,90l5,-5l-8,-8l-5,5l8,8z"/>';
$.container.svgTextClosed = '<path class="fillWhite" d="m10,90l5,-5l10,0l0,10l-5,5"/>\n<line x1="20" x2="25" y1="90" y2="85"/>\n<rect class="fillWhite" height="10" width="10" x="10" y="90"/>';
$.container.isOpen = true;
$.container.open = function open(cmd) {
  if (this.isOpen) {
    cmd.user.narrate($.utils.string.capitalize(String(cmd.dobj)) + ' is already open.');
    return;
  }
  if (this.location !== cmd.user.location && this.location !== cmd.user) {
    cmd.user.narrate($.utils.string.capitalize(String(cmd.dobj)) + ' is not here.');
    return;
  }
  if (!this.setOpen(true)) {
    cmd.user.narrate('You can\'t open ' + String(cmd.dobj));
    return;
  }
  if (cmd.user.location) {
    cmd.user.location.narrate(cmd.user.name + ' opens ' + String(cmd.dobj) + '.', cmd.user);
  }
  cmd.user.narrate('You open ' + String(cmd.dobj) + '.');
  this.look(cmd);
};
Object.setOwnerOf($.container.open, $.physicals.Maximilian);
Object.setOwnerOf($.container.open.prototype, $.physicals.Maximilian);
$.container.open.verb = 'open';
$.container.open.dobj = 'this';
$.container.open.prep = 'none';
$.container.open.iobj = 'none';
$.container.close = function close(cmd) {
  if (!this.isOpen) {
    cmd.user.narrate($.utils.string.capitalize(String(cmd.dobj)) + ' is already closed.');
    return;
  }
  if (this.location !== cmd.user.location && this.location !== cmd.user) {
    cmd.user.narrate($.utils.string.capitalize(String(cmd.dobj)) + ' is not here.');
    return;
  }
  if (!this.setOpen(false)) {
    cmd.user.narrate('You can\'t close ' + String(cmd.dobj));
    return;
  }
  if (cmd.user.location) {
    cmd.user.location.narrate(cmd.user.name + ' closes ' + String(cmd.dobj) + '.', cmd.user);
    cmd.user.location.sendScene(cmd.user, false);
  } else {
    this.look();
  }
  cmd.user.narrate('You close ' + String(cmd.dobj) + '.');
};
$.container.close.verb = 'close';
$.container.close.dobj = 'this';
$.container.close.prep = 'none';
$.container.close.iobj = 'none';
$.container.setOpen = function setOpen(newState) {
  this.isOpen = Boolean(newState);
  if ($.room.isPrototypeOf(this.location)) {
    this.location.updateScene(false);
  }
  return true;
};
Object.setOwnerOf($.container.setOpen, $.physicals.Maximilian);
Object.setOwnerOf($.container.setOpen.prototype, $.physicals.Maximilian);
$.container.getCommands = function getCommands(who) {
  var commands = $.thing.getCommands.call(this, who);
  if (this.isOpen) {
    commands.push('close ' + String(this));
  } else {
    commands.push('open ' + String(this));
  }
  return commands;
};
Object.setOwnerOf($.container.getCommands, $.physicals.Maximilian);
Object.setOwnerOf($.container.getCommands.prototype, $.physicals.Maximilian);
$.container.putIn = function putIn(cmd) {
  if ($.utils.command.matchFailed(cmd.dobj, cmd.dobjstr, cmd.user)) return;
  var thing = cmd.dobj;
  if (!this.isOpen) {
    cmd.user.narrate($.utils.string.capitalize(String(this)) + ' is closed.');
    return;
  }
  if (this.location !== cmd.user.location && this.location !== cmd.user) {
    cmd.user.narrate($.utils.string.capitalize(String(this)) + ' is not here.');
    return;
  }
  if (thing.location !== cmd.user.location && thing.location !== cmd.user) {
    cmd.user.narrate('You do not have ' + String(thing) + '.');
    return;
  }
  try {
    thing.moveTo(this);
  } catch (e) {
    cmd.user.narrate(e.message);
    return;
  }
  cmd.user.narrate('You put ' + String(thing) + ' in ' + String(this) + '.');
  if (cmd.user.location) {
    cmd.user.location.narrate(String(cmd.user) + ' puts ' + String(thing) + ' in ' + String(this) + '.', cmd.user);
  }
};
Object.setOwnerOf($.container.putIn, $.physicals.Maximilian);
$.container.putIn.verb = 'put';
$.container.putIn.dobj = 'any';
$.container.putIn.prep = 'in/inside/into';
$.container.putIn.iobj = 'this';
$.container.willAccept = function willAccept(what, src) {
  /* Returns true iff this is willing to accept what arriving from src.
   *
   * This function (or its overrides) MUST NOT have any kind of
   * observable side-effect (making noise, causing some other action,
   * etc.)
   */
  return this.isOpen && $.thing.isPrototypeOf(what);
};
Object.setOwnerOf($.container.willAccept, $.physicals.Maximilian);
Object.setOwnerOf($.container.willAccept.prototype, $.physicals.Maximilian);
$.container.location = null;
$.container.contents_ = [];
$.container.contents_.forObj = $.container;
Object.defineProperty($.container.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.container.contents_.forKey = 'contents_';
Object.defineProperty($.container.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.container.contentsVisibleWhenOpen = true;
$.container.contentsVisibleWhenClosed = false;
$.container.lookJssp = "<table style=\"height: 100%; width: 100%;\">\n  <tr>\n    <td style=\"padding: 1ex; width: 30%;\">\n      <svg width=\"100%\" height=\"100%\" viewBox=\"0 0 0 0\">\n        <%= $.utils.object.getValue(this, 'svgText') %>\n      </svg>\n    </td>\n    <td>\n    <h1><%= $.utils.html.escape(String(this)) + $.utils.commandMenu(this.getCommands(request.user)) %></h1>\n    <p><%= $.utils.html.preserveWhitespace($.utils.object.getValue(this, 'description')) %></p>\n    <p>It is <%= this.isOpen ? 'open' : 'closed' %>.</p>\n<%\nif (this.isOpen ? this.contentsVisibleWhenOpen : this.contentsVisibleWhenClosed) {\n  var contents = this.getContents();\n  if (contents.length) {\n    var contentsHtml = [];\n    for (var i = 0; i < contents.length; i++) {\n      var commands = [\n        'look ' + contents[i].name + ' in ' + this.name,\n        'get ' + contents[i].name + ' from ' + this.name\n      ];\n      contentsHtml[i] = $.utils.html.escape(contents[i].name) +\n          $.utils.commandMenu(commands);\n    }\n    response.write('<p>Contents: ' + contentsHtml.join(', ') + '</p>');\n  }\n}\nif (this.location) {\n  response.write('<p>Location: ' + $.utils.html.escape(this.location.name) +\n      $.utils.commandMenu(this.location.getCommands(request.user)) + '</p>');\n}\n%>\n    </td>\n  </tr>\n</table>";
$.container.lookIn = function lookIn(cmd) {
  var thing = cmd.dobj
  if ($.utils.command.matchFailed(thing)) {
    thing = $.utils.command.match(cmd.dobjstr, this);
  }
  if ($.utils.command.matchFailed(thing, cmd.dobjstr, cmd.user)) return;
  if (this.location !== cmd.user.location && this.location !== cmd.user) {
    cmd.user.narrate($.utils.string.capitalize(String(this)) + ' is not here.');
    return;
  }
  if (thing.location !== this) {
    cmd.user.narrate($.utils.string.capitalize(String(thing)) + ' is not in ' + String(this) + '.');
    return;
  }
  if (this.isOpen) {
    if (!this.contentsVisibleWhenOpen) {
      cmd.user.narrate('You can\'t see inside ' + String(this) + '.');
      return;
    }
  } else {
    if (!this.contentsVisibleWhenClosed) {
      cmd.user.narrate($.utils.string.capitalize(String(this)) + ' is closed.');
      return;
    }
  }
  var html = thing.lookJssp.toString(thing, {user: cmd.user});
  cmd.user.readMemo({type: "html", htmlText: html});
};
Object.setOwnerOf($.container.lookIn, $.physicals.Neil);
Object.setOwnerOf($.container.lookIn.prototype, $.physicals.Neil);
$.container.lookIn.verb = 'l(ook)?';
$.container.lookIn.dobj = 'any';
$.container.lookIn.prep = 'in/inside/into';
$.container.lookIn.iobj = 'this';
$.container.toFloor = false;
$.container.svgText = function svgText() {
  return this.isOpen ? this.svgTextOpen : this.svgTextClosed;
};
Object.setOwnerOf($.container.svgText, $.physicals.Neil);
Object.setOwnerOf($.container.svgText.prototype, $.physicals.Maximilian);

$.physicals['User prototype'] = $.user;

$.physicals['Room prototype'] = $.room;

$.physicals['Thing prototype'] = $.thing;

$.physicals['Container prototype'] = $.container;

