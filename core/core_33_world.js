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
$.user.eval = function(cmd) {
  // Format:  ;1+1    -or-    eval 1+1
  var src = (cmd.cmdstr[0] === ';') ? cmd.cmdstr.substring(1) : cmd.argstr;
  src = $.utils.code.rewriteForEval(src, /* forceExpression= */ false);
  // Do eval with this === this and vars me === this and here === this.location.
  var evalFunc = this.eval.doEval_.bind(this, this, this.location);
  var out = $.utils.code.eval(src, evalFunc);
  suspend();
  cmd.user.narrate('⇒ ' + out);
};
$.user.eval.prototype.constructor = function(cmd) {
  // Format:  ;1+1    -or-    eval 1+1
  var src = (cmd.cmdstr[0] === ';') ? cmd.cmdstr.substring(1) : cmd.argstr;
  src = $.utils.code.rewriteForEval(src, /* forceExpression= */ false);
  var out;
  try {
    // Can't
    out = this.eval.doEval_(src, this, this.location);
    try {
      // Attempt to print a source-legal representation.
      out = $.utils.code.toSource(out);
    } catch (e) {
      try {
        // Maybe it's something JSON can deal with (like an array).
        out = JSON.stringify(out);
      } catch (e) {
        try {
          // Maybe it's a recursive data structure.
          out = String(out);
        } catch (e) {
          // Maybe it's Object.create(null).
          out = '[Unprintable value]';
        }
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      out = String(e.name);
      if (e.message) {
        out += ': ' + String(e.message);
      }
      if (e.stack) {
        out += '\n' + e.stack;
      }
    } else {
      out = 'Unhandled exception: ' + String(e);
    }
  }
  user.narrate('⇒ ' + out);
};
$.user.eval.prototype.constructor.prototype = $.user.eval.prototype;
Object.defineProperty($.user.eval.prototype.constructor, 'name', {value: 'eval'});
$.user.eval.prototype.constructor.verb = 'eval|;.*';
$.user.eval.prototype.constructor.dobj = 'any';
$.user.eval.prototype.constructor.prep = 'any';
$.user.eval.prototype.constructor.iobj = 'any';
$.user.eval.prototype.constructor.doEval_ = function($$$src, me, here) {
  // Execute eval in a scope with no variables.
  // The '$$$src' parameter is awkwardly-named so as not to collide with user
  // evaled code.  The 'me' and 'here' parameters are exposed to the user.
  return eval($$$src);
};
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
$.user.eval.doEval_.prototype = $.user.eval.prototype.constructor.doEval_.prototype;
$.user.eval.doEval_.prototype.constructor = $.user.eval.doEval_;
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
Object.setOwnerOf($.user.create, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.user.join, Object.getOwnerOf($.Jssp.OutputBuffer));
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
$.user.willAccept.prototype = $.physical.willAccept.prototype;
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
Object.setOwnerOf($.user.moveTo, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.user.moveTo.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
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
$.user.getNullSvgText.prototype.constructor = function nullVoidSvgText() {
};
$.user.getNullSvgText.prototype.constructor.prototype = $.user.getNullSvgText.prototype;
$.user.getCommands = function(who) {
  var commands = $.physical.getCommands.apply(this, arguments);
  if (who.location !== this.location) {
    commands.push('join ' + this.name);
  }
  return commands;
};
$.user.getCommands.prototype = $.physical.getCommands.prototype;
$.user.getDescription = function getDescription() {
  var desc = $.physical.getDescription.apply(this, arguments);
	return desc + (desc ? '  ' : '') +
      this.name + (this.connection && this.connection.connected ? ' is awake.' : ' is sleeping.');
};
Object.setOwnerOf($.user.getDescription, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.user.getDescription.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.user.who = function(cmd) {
  $.console.look({user: cmd.user});
};
delete $.user.who.name;
$.user.who.prototype.constructor = function(cmd) {
  $.console.look({user: cmd.user});
};
delete $.user.who.prototype.constructor.name;
$.user.who.prototype.constructor.prototype = $.user.who.prototype;
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
Object.setOwnerOf($.user.onInput, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.user.grep, Object.getOwnerOf($.Jssp.OutputBuffer));
$.user.grep.verb = 'grep';
$.user.grep.dobj = 'any';
$.user.grep.prep = 'for/about';
$.user.grep.iobj = 'any';
$.user.grep.search = function search(user, prefix, searchString, selector, seen) {
  var value = selector.toValue();
  if (!$.utils.isObject(value)) {
    if (String(value).includes(searchString))	{
      user.narrate(selector.toString() + ' === ' + $.utils.code.toSource(value));
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
  if (typeof value === 'function' && Function.prototype.toString.call(value).includes(searchString)) {
    user.narrate(selector.toString() + ' mentions ' + searchString);
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
Object.setOwnerOf($.user.grep.search, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.user.destroyVerb, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.user.homeVerb, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.user.teleportTo, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.user.teleportTo.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.user.go, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.user.go.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.user.onConnect, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.user.onConnect.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.user.onDisconnect, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.user.onDisconnect.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.user.description = 'A new user who has not yet set his/her description.';
$.user.destroy = function destroy() {
  $.physical.destroy.call(this);

  // Make sure next login gets a fresh guest.
  suspend();
  $.userDatabase.validate();
};
Object.setOwnerOf($.user.destroy, Object.getOwnerOf($.Jssp.OutputBuffer));
$.user.destroy.prototype = $.physical.destroy.prototype;
Object.setOwnerOf($.user.destroy.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.user.inventory = function inventory(cmd) {
  this.look(cmd);
};
Object.setOwnerOf($.user.inventory, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.user.inventory.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.user.inventory.verb = 'inv(?:entory)?';
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
Object.setOwnerOf($.user.willMoveTo, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.user.willMoveTo.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.user.editInline = function editInline(cmd) {
  var obj = cmd.iobj;
  var objName = cmd.iobjstr;
  var prop = cmd.dobjstr;

  if (!$.utils.isObject(obj) || !prop) {
    cmd.user.narrate('Usage: edit <property> on <object>');
    return;
  }
  var url = $.www.editor.edit(obj, objName, prop);
  var memo = {
    type: 'iframe',
    url: url,
    alt: 'Edit ' + prop + ' on ' + objName
  };
  cmd.user.readMemo(memo);
};
Object.setOwnerOf($.user.editInline, Object.getOwnerOf($.Jssp.OutputBuffer));
$.user.editInline.verb = 'edit';
$.user.editInline.dobj = 'any';
$.user.editInline.prep = 'on top of/on/onto/upon';
$.user.editInline.iobj = 'any';

$.room = (new 'Object.create')($.physical);
$.room.name = 'Room prototype';
$.room.svgText = '<line x1="-1000" y1="90" x2="1000" y2="90" />';
$.room.sendScene = function(who, requested) {
  var memo = {
    type: 'scene',
    requested: requested,
    user: who,
    where: this,
    description: this.getDescription(),
    svgText: this.getSvgText(),
    contents: []
  };
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var object = contents[i];
    memo.contents.push({
      type: $.user.isPrototypeOf(object) ? 'user' : 'thing',
      what: object,
      svgText: object.getSvgText(),
      cmds: object.getCommands(who)
    });
  }
  who.readMemo(memo);
};
delete $.room.sendScene.name;
Object.setOwnerOf($.room.sendScene, Object.getOwnerOf($.Jssp.prototype.compile));
$.room.look = function look(cmd) {
  this.sendScene(cmd.user, true);
};
Object.setOwnerOf($.room.look, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.room.say, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.room.think, Object.getOwnerOf($.Jssp.prototype.compile));
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
$.room.narrate.prototype.constructor = function(text, obj) {
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing !== user && thing.narrate) {
      thing.narrate(text, obj);
    }
  }
};
$.room.narrate.prototype.constructor.prototype = $.room.narrate.prototype;
Object.defineProperty($.room.narrate.prototype.constructor, 'name', {value: 'narrate'});
$.room.willAccept = function(what, src) {
  // Returns true iff this is willing to accept what arriving from src.
  //
  // This function (or its overrides) MUST NOT have any kind of
  // observable side-effect (making noise, causing some other action,
  // etc.).
  return $.thing.isPrototypeOf(what) || $.user.isPrototypeOf(what);
};
delete $.room.willAccept.name;
$.room.willAccept.prototype = $.physical.willAccept.prototype;
$.room.onEnter = function onEnter(what, src) {
  // TODO: caller check: should only be called by $.physical.moveTo.
  $.physical.validate.call(this);
  this.updateScene(false);

  if ($.user.isPrototypeOf(what)) {
    this.sendScene(what, true);
  }
};
Object.setOwnerOf($.room.onEnter, Object.getOwnerOf($.Jssp.prototype.compile));
$.room.onExit = function onExit(what, dest) {
  // TODO: caller check: should only be called by $.physical.moveTo.
  suspend(0);  // Wait for what to actually leave.
  $.physical.validate.call(this);
  this.updateScene(false);
};
Object.setOwnerOf($.room.onExit, Object.getOwnerOf($.Jssp.prototype.compile));
$.room.lookHere = function lookHere(cmd) {
  return this.look(cmd);
};
$.room.lookHere.prototype.constructor = function(cmd) {
  return this.look(cmd);
};
$.room.lookHere.prototype.constructor.prototype = $.room.lookHere.prototype;
Object.defineProperty($.room.lookHere.prototype.constructor, 'name', {value: 'lookhere'});
$.room.lookHere.prototype.constructor.verb = 'l(ook)?';
$.room.lookHere.prototype.constructor.dobj = 'none';
$.room.lookHere.prototype.constructor.prep = 'none';
$.room.lookHere.prototype.constructor.iobj = 'none';
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
Object.setOwnerOf($.room.sendMemo, Object.getOwnerOf($.Jssp.prototype.compile));
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
Object.setOwnerOf($.room.emote, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.room.emote.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.room.updateScene, Object.getOwnerOf($.Jssp.prototype.compile));
Object.setOwnerOf($.room.updateScene.prototype, Object.getOwnerOf($.Jssp.prototype.compile));
$.room.getDescription = function getDescription() {
  return this.description;
};
Object.setOwnerOf($.room.getDescription, Object.getOwnerOf($.Jssp.prototype.compile));
$.room.getDescription.prototype = $.physical.getDescription.prototype;
$.room.getDescription.prototype.constructor = $.room.getDescription;

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
Object.setOwnerOf($.thing.get, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.thing.drop, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.thing.give, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.thing.give.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.thing.give.verb = 'give';
$.thing.give.dobj = 'this';
$.thing.give.prep = 'at/to';
$.thing.give.iobj = 'any';
$.thing.getCommands = function getCommands(who) {
  var commands = $.physical.getCommands.call(this, who);
  if (this.location === who) {
    commands.push('drop ' + String(this));
  } else if (this.location === who.location) {
    commands.push('get ' + String(this));
  }
  return commands;
};
Object.setOwnerOf($.thing.getCommands, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.thing.getCommands.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.thing.willMoveTo, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.thing.willMoveTo.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));

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
Object.setOwnerOf($.container.getFrom, Object.getOwnerOf($.Jssp.prototype.compile));
$.container.getFrom.verb = 'get|take';
$.container.getFrom.dobj = 'any';
$.container.getFrom.prep = 'out of/from inside/from';
$.container.getFrom.iobj = 'this';
$.container.name = 'Container prototype';
$.container.svgTextOpen = '<path class="fillWhite" d="m10,90l5,-5l10,0l0,10l-5,5"/>\n<line x1="15" x2="15" y1="95" y2="85"/>\n<rect class="fillWhite" height="10" width="10" x="10" y="90"/>\n<line x1="20" x2="25" y1="90" y2="85"/>\n<path class="fillWhite" d="m10,90l5,-5l-8,-8l-5,5l8,8z"/>';
$.container.svgTextClosed = '<path class="fillWhite" d="m10,90l5,-5l10,0l0,10l-5,5"/>\n<line x1="20" x2="25" y1="90" y2="85"/>\n<rect class="fillWhite" height="10" width="10" x="10" y="90"/>';
$.container.getSvgText = function getSvgText() {
  return this.isOpen ? this.svgTextOpen : this.svgTextClosed;
};
Object.setOwnerOf($.container.getSvgText, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.container.getSvgText.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.container.open, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.container.open.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.container.setOpen, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.container.setOpen.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.container.getCommands = function getCommands(who) {
  var commands = $.thing.getCommands.call(this, who);
  if (this.isOpen) {
    commands.push('close ' + String(this));
  } else {
    commands.push('open ' + String(this));
  }
  return commands;
};
Object.setOwnerOf($.container.getCommands, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.container.getCommands.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.container.putIn, Object.getOwnerOf($.Jssp.OutputBuffer));
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
Object.setOwnerOf($.container.willAccept, Object.getOwnerOf($.Jssp.OutputBuffer));
$.container.willAccept.prototype = $.physical.willAccept.prototype;
$.container.location = null;
$.container.contents_ = null;
$.container.contentsVisibleWhenOpen = true;
$.container.contentsVisibleWhenClosed = false;
// CLOSURE: type: function, vars: source, jssp
// CLOSURE: type: funexp, vars: Jssp
$.container.lookJssp = function jssp(request, response) {
  // DO NOT EDIT THIS CODE.  AUTOMATICALLY GENERATED BY JSSP.
  // To edit contents of generated page, edit this.source.
  return jssp.render(this, request, response);  // See $.Jssp for explanation.
};
Object.setPrototypeOf($.container.lookJssp, $.Jssp.prototype);
Object.setOwnerOf($.container.lookJssp, Object.getOwnerOf($.Jssp.prototype.compile));
Object.setOwnerOf($.container.lookJssp.prototype, Object.getOwnerOf($.Jssp.prototype.compile));
$.container.lookJssp.source = "<table style=\"height: 100%; width: 100%;\">\n  <tr>\n    <td style=\"padding: 1ex; width: 30%;\">\n      <svg width=\"100%\" height=\"100%\" viewBox=\"0 0 0 0\">\n        <%= this.getSvgText() %>\n      </svg>\n    </td>\n    <td>\n    <h1><%= $.utils.html.escape(this.name) + $.utils.commandMenu(this.getCommands(request.user)) %></h1>\n    <p><%= $.utils.html.preserveWhitespace(this.getDescription()) %></p>\n    <p>It is <%= this.isOpen ? 'open' : 'closed' %>.</p>\n<%\nif (this.isOpen ? this.contentsVisibleWhenOpen : this.contentsVisibleWhenClosed) {\n  var contents = this.getContents();\n  if (contents.length) {\n    var contentsHtml = [];\n    for (var i = 0; i < contents.length; i++) {\n      var commands = [\n        'look ' + contents[i].name + ' in ' + this.name,\n        'get ' + contents[i].name + ' from ' + this.name\n      ];\n      contentsHtml[i] = $.utils.html.escape(contents[i].name) +\n          $.utils.commandMenu(commands);\n    }\n    response.write('<p>Contents: ' + contentsHtml.join(', ') + '</p>');\n  }\n}\nif (this.location) {\n  response.write('<p>Location: ' + $.utils.html.escape(this.location.name) +\n      $.utils.commandMenu(this.location.getCommands(request.user)) + '</p>');\n}\n%>\n    </td>\n  </tr>\n</table>";
$.container.lookJssp.hash_ = 'fa0a4420dc0559e0e432e5c4030fd2c2v1.0.0';
$.container.lookJssp.compiled_ = function(request, response) {
// DO NOT EDIT THIS CODE: AUTOMATICALLY GENERATED BY JSSP.
response.write("<table style=\"height: 100%; width: 100%;\">\n  <tr>\n    <td style=\"padding: 1ex; width: 30%;\">\n      <svg width=\"100%\" height=\"100%\" viewBox=\"0 0 0 0\">\n        ");
response.write(this.getSvgText());
response.write("\n      </svg>\n    </td>\n    <td>\n    <h1>");
response.write($.utils.html.escape(this.name) + $.utils.commandMenu(this.getCommands(request.user)));
response.write("</h1>\n    <p>");
response.write($.utils.html.preserveWhitespace(this.getDescription()));
response.write("</p>\n    <p>It is ");
response.write(this.isOpen ? 'open' : 'closed');
response.write(".</p>\n");

if (this.isOpen ? this.contentsVisibleWhenOpen : this.contentsVisibleWhenClosed) {
  var contents = this.getContents();
  if (contents.length) {
    var contentsHtml = [];
    for (var i = 0; i < contents.length; i++) {
      var commands = [
        'look ' + contents[i].name + ' in ' + this.name,
        'get ' + contents[i].name + ' from ' + this.name
      ];
      contentsHtml[i] = $.utils.html.escape(contents[i].name) +
          $.utils.commandMenu(commands);
    }
    response.write('<p>Contents: ' + contentsHtml.join(', ') + '</p>');
  }
}
if (this.location) {
  response.write('<p>Location: ' + $.utils.html.escape(this.location.name) +
      $.utils.commandMenu(this.location.getCommands(request.user)) + '</p>');
}

response.write("\n    </td>\n  </tr>\n</table>");
};
Object.setOwnerOf($.container.lookJssp.compiled_, Object.getOwnerOf($.Jssp.prototype.compile));
Object.setOwnerOf($.container.lookJssp.compiled_.prototype, Object.getOwnerOf($.Jssp.prototype.compile));
Object.defineProperty($.container.lookJssp.compiled_, 'name', {value: '$.container.lookJssp.compiled_'});
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
Object.setOwnerOf($.container.lookIn, Object.getOwnerOf($.Jssp.prototype.compile));
Object.setOwnerOf($.container.lookIn.prototype, Object.getOwnerOf($.Jssp.prototype.compile));
$.container.lookIn.verb = 'l(ook)?';
$.container.lookIn.dobj = 'any';
$.container.lookIn.prep = 'in/inside/into';
$.container.lookIn.iobj = 'this';
$.container.toFloor = false;

$.physicals['User prototype'] = $.user;

$.physicals['Room prototype'] = $.room;

$.physicals['Thing prototype'] = $.thing;

$.physicals['Container prototype'] = $.container;

