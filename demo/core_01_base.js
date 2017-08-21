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

$.utils.htmlEscape = function(text) {
  return String(text).replace(/&/g, '&amp;')
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
  return this.svgText;
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
};

$.physical.look = function(cmd) {
  var html = '<table><tr><td>';
  html += '<svg height="200" width="100" viewBox="0 0 100 100">' + this.getSvgText() + '</svg>';
  html += '</td><td>';
  html += '<h1>' + this.name + $.utils.commandMenu(this.getCommands()) + '</h1>';
  html += '<p>' + this.getDescription() + '</p>';
  var contents = this.getContents();
  if (contents.length) {
    var contentsHtml = [];
    for (var i = 0; i < contents.length; i++) {
      contentsHtml[i] = contents[i].name +
          $.utils.commandMenu(contents[i].getCommands());
    }
    html += '<p>Contents: ' + contentsHtml.join(', ') + '</p>';
  }
  if (this.location) {
    html += '<p>Location: ' + this.location.name +
        $.utils.commandMenu(this.location.getCommands()) + '</p>';
  }
  html += '</td></tr></table>';
  user.tell('<htmltext>' + $.utils.htmlEscape(html) + '</htmltext>');
};
$.physical.look.verb = 'l(ook)?';
$.physical.look.dobj = 'this';
$.physical.look.prep = 'none';
$.physical.look.iobj = 'none';

$.physical.getCommands = function() {
  return ['look ' + this.name];
};


// Thing prototype: $.thing
$.thing = Object.create($.physical);
$.thing.name = 'Thing prototype';
$.thing.svgText = '<path d="M10,90 l5,-5 h10 v10 l-5,5"/><line x1="20" y1="90" x2="25" y2="85"/><rect height="10" width="10" y="90" x="10"/>';

$.thing.get = function(cmd) {
  this.moveTo(user);
  user.tell('You pick up ' + this.name + '.');
  if (user.location) {
    user.location.announce(user.name + ' picks up ' + this.name + '.');
  }
};
$.thing.get.verb = 'get|take';
$.thing.get.dobj = 'this';
$.thing.get.prep = 'none';
$.thing.get.iobj = 'none';

$.thing.drop = function(cmd) {
  this.moveTo(user.location);
  user.tell('You drop ' + this.name + '.');
  if (user.location) {
    user.location.announce(user.name + ' drops ' + this.name + '.');
  }
};
$.thing.drop.verb = 'drop|throw';
$.thing.drop.dobj = 'this';
$.thing.drop.prep = 'none';
$.thing.drop.iobj = 'none';

$.thing.give = function(cmd) {
  this.moveTo(cmd.iobj);
  user.tell('You give ' + this.name + ' to ' + cmd.iobj.name + '.');
  if (user.location) {
    user.location.announce(user.name + ' gives ' + this.name + ' to ' +
        cmd.iobj.name + '.');
  }
};
$.thing.give.verb = 'give';
$.thing.give.dobj = 'this';
$.thing.give.prep = 'at/to';
$.thing.give.iobj = 'any';

$.thing.getCommands = function(cmd) {
  var commands = $.physical.getCommands.apply(this);
  if (this.location === user) {
    commands.push('drop ' + this.name);
  } else if (this.location === user.location) {
    commands.push('get ' + this.name);
  }
  return commands;
};

// Room prototype: $.room
$.room = Object.create($.physical);
$.room.name = 'Room prototype';
$.room.svgText = '<line x1="-1000" y1="90" x2="1000" y2="90" />';

$.room.look = function(cmd) {
  var text = '';
  text += '<scene user="' + user.name + '" room="' + this.name + '">\n';
  text += '  <description>' + this.getDescription() + '</description>\n';
  text += '  <svgtext>' + $.utils.htmlEscape(this.getSvgText()) + '</svgtext>\n';
  var contents = this.getContents();
  if (contents.length) {
    var userIndex = contents.indexOf(user);
    if (userIndex !== -1) {
      contents.splice(userIndex, 1);
      contents.unshift(user);
    }
    for (var i = 0; i < contents.length; i++) {
      var thing = contents[i];
      var tag = $.user.isPrototypeOf(thing) ? 'user' : 'object';
      text += '  <' + tag + ' name="' + thing.name + '">\n';
      text += '    <svgtext>' + $.utils.htmlEscape(thing.getSvgText()) + '</svgtext>\n';
      var commands = thing.getCommands();
      if (commands.length) {
        text += '    ' + $.utils.commandMenu(commands) + '\n';
      }
      text += '  </' + tag + '>\n';
    }
  }
  text += '</scene>';
  user.tell(text);
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

$.room.announce = function(text) {
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing !== user && thing.tell) {
      thing.tell(text);
    }
  }
};

$.room.announceAll = function(text) {
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing.tell) {
      thing.tell(text);
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
    user.location.announceAll(
        '<say user="' + user.name + '" room="' + user.location + '">' +
        $.utils.htmlEscape(cmd.argstr) + '</say>');
  }
};
$.user.say.verb = 'say|".*';
$.user.say.dobj = 'any';
$.user.say.prep = 'any';
$.user.say.iobj = 'any';

$.user.think = function(cmd) {
  if (user.location) {
    user.location.announceAll(
        '<think user="' + user.name + '" room="' + user.location + '">' +
        $.utils.htmlEscape(cmd.argstr) + '</think>');
  }
};
$.user.think.verb = 'think|\.oO';
$.user.think.dobj = 'any';
$.user.think.prep = 'any';
$.user.think.iobj = 'any';

$.user.eval = function(cmd) {
  try {
    var r = eval(cmd.argstr);
  } catch (e) {
    if (e instanceof Error) {
      r = String(e.name);
      if (e.message) {
        r += ': ' + String(e.message);
      }
      if (e.stack) {
        r += '\n' + e.stack;
      }
    } else {
      r = 'Unhandled exception: ' + String(e);
    }
  }
  user.tell('<text>' + $.utils.htmlEscape(r) + '</text>');
};
$.user.eval.verb = 'eval|;.*';
$.user.eval.dobj = 'any';
$.user.eval.prep = 'any';
$.user.eval.iobj = 'any';

$.user.edit = function(cmd) {
  user.tell('<iframe src="/web/edit/' + encodeURIComponent(cmd.argstr) + '">' +
      'Edit ' + $.utils.htmlEscape(cmd.argstr) + '</iframe>');
};
$.user.edit.verb = 'edit';
$.user.edit.dobj = 'any';
$.user.edit.prep = 'any';
$.user.edit.iobj = 'any';

$.user.tell = function(text) {
  if (this.connection) {
    this.connection.write(text);
  }
};

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
    user.tell('<text>Command not understood.</text>');
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
    this.write('<text>Unknown command: ' + $.utils.htmlEscape(text) + '</text>');
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
  }
  this.user.connection = this;
  $.system.log('Binding connection to ' + this.user.name);
  user = this.user;
  $.execute('look');
  if (user.location) {
    user.location.announce('<text>' + user.name + ' connects.</text>');
  }
};
$.connection.onReceiveLine.guestCount = 0;

$.connection.onEnd = function() {
  if (this.user) {
    if (user.location) {
      user.location.announce('<text>' + user.name + ' disconnects.</text>');
    }
    $.system.log('Unbinding connection from ' + this.user.name);
    this.user.connection = null;
    this.user = null;
  }
};

$.connection.write = function(text) {
  $.system.connectionWrite(this, text + '\n');
};

$.connection.close = function() {
  $.system.connectionClose(this);
};
