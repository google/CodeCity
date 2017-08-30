/**
 * @license
 * Code City: Demonstration database.
 *
 * Copyright 2017 Google Inc.
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

var user = null;
var $ = function() {
  return $.utils.$.apply($.utils, arguments);
};

// System object: $.system
$.system = {};
$.system.log = new '$.system.log';
$.system.checkpoint = new '$.system.checkpoint';
$.system.shutdown = new '$.system.shutdown';
$.system.connectionWrite = new 'connectionWrite';
$.system.connectionClose = new 'connectionClose';

// Utility object: $.utils
$.utils = {};

$.utils.isObject = function(v) {
  /* Returns true iff v is an object (of any class, including Array
   * and Function. */
  return (typeof v === 'object' && v !== null) || typeof v === 'function';
};

$.utils.htmlEscape = function(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                     .replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

$.utils.commandMenu = function(commands) {
  var cmdXml = '';
  if (commands.length) {
    cmdXml += '<cmds>';
    for (var i = 0; i < commands.length; i++) {
      cmdXml += '<cmd>' + commands[i] + '</cmd>';
    }
    cmdXml += '</cmds>';
  }
  return cmdXml;
};

$.utils.jsonStringifyPhysicals = function(value) {
  if (Array.isArray(value)) {
    var text = '';
    for (var i = 0; i < value.length; i++) {
      if (text.length) {
        text += ', ';
      }
      text += $.utils.jsonStringifyPhysicals(value[i]);
    }
    return '[' + text + ']';
  }
  if ($.physical.isPrototypeOf(value)) {
    return JSON.stringify(value.name);
  }
  if (typeof value === 'object' && value !== null) {
    var text = '';
    for (var prop in value) {
      if (text.length) {
        text += ', ';
      }
      text += '"' + prop + '": ' + $.utils.jsonStringifyPhysicals(value[prop]);
    }
    return '{' + text + '}';
  }
  return JSON.stringify(value);
};

// Physical object prototype: $.physical
$.physical = {};
$.physical.name = 'Physical object prototype';
$.physical.description = '';
$.physical.svgText = '';
$.physical.location = null;
$.physical.contents_ = null;

$.physical.getSvgText = function() {
  return this.svgText;
};

$.physical.getDescription = function() {
  return this.description;
};

$.physical.getContents = function() {
  return this.contents_ ? this.contents_.concat() : [];
};

$.physical.addContents = function(thing) {
  var contents = this.getContents();
  contents.indexOf(thing) === -1 && contents.push(thing);
  this.contents_ = contents;
};

$.physical.removeContents = function(thing) {
  var contents = this.getContents();
  var index = contents.indexOf(thing);
  if (index !== -1) {
    contents.splice(index, 1);
  }
  this.contents_ = contents;
};

$.physical.moveTo = function(dest) {
  var src = this.location;
  src && src.removeContents && src.removeContents(this);
  this.location = dest;
  dest && dest.addContents && dest.addContents(this);
  $.physical.moveTo.updateScene_(src);
  if (dest !== src) {
    $.physical.moveTo.updateScene_(dest);
  }
};

$.physical.moveTo.updateScene_ = function(room) {
  if ($.room.isPrototypeOf(room)) {
    var contents = room.getContents();
    for (var i = 0; i < contents.length; i++) {
      var who = contents[i];
      if ($.user.isPrototypeOf(who)) {
        room.sendScene(who, false);
      }
    }
  }
};

$.physical.look = function(cmd) {
  var html = '<table style="height: 100%; width: 100%;"><tr><td style="padding: 1ex; width: 30%;">';
  html += '<svg width="100%" height="100%" viewBox="0 0 0 0">' + this.getSvgText() + '</svg>';
  html += '</td><td>';
  html += '<h1>' + this.name + $.utils.commandMenu(this.getCommands(user)) + '</h1>';
  html += '<p>' + this.getDescription() + '</p>';
  var contents = this.getContents();
  if (contents.length) {
    var contentsHtml = [];
    for (var i = 0; i < contents.length; i++) {
      contentsHtml[i] = contents[i].name +
          $.utils.commandMenu(contents[i].getCommands(user));
    }
    html += '<p>Contents: ' + contentsHtml.join(', ') + '</p>';
  }
  if (this.location) {
    html += '<p>Location: ' + this.location.name +
        $.utils.commandMenu(this.location.getCommands(user)) + '</p>';
  }
  html += '</td></tr></table>';
  user.writeJson({type: "html", htmlText: html});
};
$.physical.look.verb = 'l(ook)?';
$.physical.look.dobj = 'this';
$.physical.look.prep = 'none';
$.physical.look.iobj = 'none';

$.physical.getCommands = function(who) {
  return ['look ' + this.name];
};


// Thing prototype: $.thing
$.thing = Object.create($.physical);
$.thing.name = 'Thing prototype';
$.thing.svgText = '<path d="M10,90 l5,-5 h10 v10 l-5,5" class="fillWhite"/><line x1="20" y1="90" x2="25" y2="85"/><rect height="10" width="10" y="90" x="10" class="fillWhite"/>';

$.thing.get = function(cmd) {
  this.moveTo(user);
  user.narrate('You pick up ' + this.name + '.');
  if (user.location) {
    user.location.narrate(user.name + ' picks up ' + this.name + '.');
  }
};
$.thing.get.verb = 'get|take';
$.thing.get.dobj = 'this';
$.thing.get.prep = 'none';
$.thing.get.iobj = 'none';

$.thing.drop = function(cmd) {
  this.moveTo(user.location);
  user.narrate('You drop ' + this.name + '.');
  if (user.location) {
    user.location.narrate(user.name + ' drops ' + this.name + '.');
  }
};
$.thing.drop.verb = 'drop|throw';
$.thing.drop.dobj = 'this';
$.thing.drop.prep = 'none';
$.thing.drop.iobj = 'none';

$.thing.give = function(cmd) {
  this.moveTo(cmd.iobj);
  user.narrate('You give ' + this.name + ' to ' + cmd.iobj.name + '.');
  if (user.location) {
    user.location.narrate(user.name + ' gives ' + this.name + ' to ' +
        cmd.iobj.name + '.');
  }
};
$.thing.give.verb = 'give';
$.thing.give.dobj = 'this';
$.thing.give.prep = 'at/to';
$.thing.give.iobj = 'any';

$.thing.getCommands = function(who) {
  var commands = $.physical.getCommands.apply(this);
  if (this.location === who) {
    commands.push('drop ' + this.name);
  } else if (this.location === who.location) {
    commands.push('get ' + this.name);
  }
  return commands;
};

// Room prototype: $.room
$.room = Object.create($.physical);
$.room.name = 'Room prototype';
$.room.svgText = '<line x1="-1000" y1="90" x2="1000" y2="90" />';

$.room.sendScene = function(who, requested) {
  var json = {
    type: "scene",
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
    json.contents.push({
      type: $.user.isPrototypeOf(object) ? 'user' : 'thing',
      what: object,
      svgText: object.getSvgText(),
      cmds: object.getCommands(who)
    });
  }
  who.writeJson(json);
};

$.room.look = function(cmd) {
  this.sendScene(user, true);
};
$.room.look.verb = 'l(ook)?';
$.room.look.dobj = 'this';
$.room.look.prep = 'none';
$.room.look.iobj = 'none';

$.room.lookhere = function(cmd) {
  return this.look(cmd);
}
$.room.lookhere.verb = 'l(ook)?';
$.room.lookhere.dobj = 'none';
$.room.lookhere.prep = 'none';
$.room.lookhere.iobj = 'none';

$.room.narrate = function(text, obj) {
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing !== user && thing.narrate) {
      thing.narrate(text, obj);
    }
  }
};

$.room.narrateAll = function(text, obj) {
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing.narrate) {
      thing.narrate(text, obj);
    }
  }
};

$.room.writeJson = function(json) {
  if (this.onTell) {
    setTimeout(this.onTell.bind(this, json), 0);
  }
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing !== user && thing.writeJson) {
      thing.writeJson(json);
    }
  }
};

$.room.writeJsonAll = function(json) {
  if (this.onTell) {
    setTimeout(this.onTell.bind(this, json), 0);
  }
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing.writeJson) {
      thing.writeJson(json);
    }
  }
};


// User prototype: $.user
$.user = Object.create($.physical);
$.user.name = 'User prototype';
$.user.connection = null;
$.user.svgText = '<circle cx="50" cy="50" r="10" /><line x1="50" y1="60" x2="50" y2="80"/><line x1="40" y1="70" x2="60" y2="70"/><line x1="50" y1="80" x2="40" y2="100"/><line x1="50" y1="80" x2="60" y2="100"/>';

$.user.say = function(cmd) {
  if (user.location) {
    // Format:  "Hello.    -or-    say Hello.
    var text = (cmd.cmdstr[0] === '"') ? cmd.cmdstr.substring(1) : cmd.argstr;
    var json = {
      type: "say",
      source: user,
      where: user.location,
      text: text
    };
    user.location.writeJsonAll(json);
  }
};
$.user.say.verb = 'say|".*';
$.user.say.dobj = 'any';
$.user.say.prep = 'any';
$.user.say.iobj = 'any';

$.user.think = function(cmd) {
  if (user.location) {
    var json = {
      type: "think",
      source: user,
      where: user.location,
      text: cmd.argstr
    };
    user.location.writeJsonAll(json);
  }
};
$.user.think.verb = 'think|\.oO';
$.user.think.dobj = 'any';
$.user.think.prep = 'any';
$.user.think.iobj = 'any';

$.user.eval = function($$$cmd) {
  // Format:  ;1+1    -or-    eval 1+1
  // To reduce the likelihood of clashes with identifiers in the evaled
  // code, this function has only a single, awkwardly-named parameter
  // and has no local variables of its own.  Conversely, however, we
  // create a few local variables with short, convenient names as
  // aliases for commonly-used values.
  $$$cmd =
      ($$$cmd.cmdstr[0] === ';') ? $$$cmd.cmdstr.substring(1) : $$$cmd.argstr;
  try {
    var me = this;
    var here = this.location;
    $$$cmd = eval($$$cmd);
  } catch (e) {
    if (e instanceof Error) {
      $$$cmd = String(e.name);
      if (e.message) {
        $$$cmd += ': ' + String(e.message);
      }
      if (e.stack) {
        $$$cmd += '\n' + e.stack;
      }
    } else {
      $$$cmd = 'Unhandled exception: ' + String(e);
    }
  }
  user.narrate($$$cmd);
};
$.user.eval.verb = 'eval|;.*';
$.user.eval.dobj = 'any';
$.user.eval.prep = 'any';
$.user.eval.iobj = 'any';

$.user.edit = function(cmd) {
  var json = {
    type: "iframe",
    url: $.editor.edit(cmd.iobj, cmd.iobjstr, cmd.dobjstr),
    alt: 'Edit ' + cmd.dobjstr + ' on ' + cmd.iobjstr
  };
  user.writeJson(json);
};
$.user.edit.verb = 'edit';
$.user.edit.dobj = 'any';
$.user.edit.prep = 'on top of/on/onto/upon';
$.user.edit.iobj = 'any';

$.user.narrate = function(text, obj) {
  var json = {type: 'narrate', text: text};
  if (obj && obj.location) {
    json.source = obj;
    json.where = obj.location;
  }
  this.writeJson(json);
};

$.user.writeJson = function(json) {
  if (this.onTell) {
    setTimeout(this.onTell.bind(this, json), 0);
  }
  if (!this.connection) {
    return;
  }
  this.connection.write($.utils.jsonStringifyPhysicals(json));
};

$.user.create = function(cmd) {
  if ($.physical !== cmd.dobj && !$.physical.isPrototypeOf(cmd.dobj)) {
    this.narrate('Unknown prototype object.\n' + $.user.create.usage);
    return;
  } else if (!cmd.iobjstr) {
    this.narrate('Name must be specified.\n' + $.user.create.usage);
    return;
  }
  var obj = Object.create(cmd.dobj);
  obj.name = cmd.iobjstr;
  obj.moveTo(this);
  this.narrate(obj.name + ' created.');
};
$.user.create.usage = 'Usage: create <prototype> as <name>';
$.user.create.verb = 'create';
$.user.create.dobj = 'any';
$.user.create.prep = 'as';
$.user.create.iobj = 'any';

$.user.destroy = function(cmd) {
  if (!$.physical.isPrototypeOf(cmd.dobj)) {
    this.narrate('Unknown object.\n' + $.user.destroy.usage);
    return;
  }
  var obj = cmd.dobj;
  obj.moveTo(null);
  this.narrate(obj.name + ' destroyed.');
  // Delete as much data as possible.
  var props = Object.getOwnPropertyNames(obj);
  for (var i = 0; i < props.length; i++) {
    delete obj[props[i]];
  }
};
$.user.destroy.usage = 'Usage: destroy <object>';
$.user.destroy.verb = 'destroy';
$.user.destroy.dobj = 'any';
$.user.destroy.prep = 'none';
$.user.destroy.iobj = 'none';

$.user.quit = function(cmd) {
  if (this.connection) {
    this.connection.close();
  }
};
$.user.quit.verb = 'quit';
$.user.quit.dobj = 'none';
$.user.quit.prep = 'none';
$.user.quit.iobj = 'none';


// Command parser.
$.execute = function(command) {
  if (!$.utils.command.execute(command, user)) {
    user.narrate('Command not understood.');
  }
};


// Database of users so that connections can bind to a user.
$.userDatabase = Object.create(null);


$.connection = {};

$.connection.onConnect = function() {
  this.user = null;
  this.buffer = '';
};

$.connection.onReceive = function(text) {
  this.buffer += text.replace(/\r/g, '');
  var lf;
  while ((lf = this.buffer.indexOf('\n')) !== -1) {
    try {
      this.onReceiveLine(this.buffer.substring(0, lf));
    } finally {
      this.buffer = this.buffer.substring(lf + 1);
    }
  }
};

$.connection.onReceiveLine = function(text) {
  if (this.user) {
    user = this.user;
    $.execute(text);
    return;
  }
  // Remainder of function handles login.
  var m = text.match(/identify as ([0-9a-f]+)/);
  if (!m) {
    this.write('{type: "narrate", text: "Unknown command: ' +
               $.utils.htmlEscape(text) + '"}');
  }
  if (!$.userDatabase[m[1]]) {
    var guest = Object.create($.user);
    guest.name = 'Guest' + $.connection.onReceiveLine.guestCount++;
    $.userDatabase[m[1]] = guest;
    guest.description = 'A new user who has not yet set his/her description.';
    guest.moveTo($.startRoom);
  }
  this.user = $.userDatabase[m[1]];
  if (this.user.connection) {
    this.user.connection.close();
    $.system.log('Rebinding connection to ' + this.user.name);
  } else {
    $.system.log('Binding connection to ' + this.user.name);
  }
  this.user.connection = this;
  user = this.user;
  $.execute('look');
  if (user.location) {
    user.location.narrate(user.name + ' connects.');
  }
};
$.connection.onReceiveLine.guestCount = 0;

$.connection.onEnd = function() {
  if (this.user) {
    if (user.location) {
      user.location.narrate(user.name + ' disconnects.');
    }
    if (this.user.connection === this) {
      $.system.log('Unbinding connection from ' + this.user.name);
      this.user.connection = null;
    }
    this.user = null;
  }
};

$.connection.write = function(text) {
  $.system.connectionWrite(this, text + '\n');
};

$.connection.close = function() {
  $.system.connectionClose(this);
};
