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
  return this.contents_ || [];
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

$.physical.look = function(spec) {
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
$.physical.look.verb = 'look';
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

$.thing.get = function(spec) {
  this.moveTo(user);
  user.tell('You pick up ' + this.name + '.');
  if (user.location) {
    user.location.announce(user.name + ' picks up ' + this.name + '.');
  }
};
$.thing.get.verb = 'get';
$.thing.get.dobj = 'this';
$.thing.get.prep = 'none';
$.thing.get.iobj = 'none';

$.thing.drop = function(spec) {
  this.moveTo(user.location);
  user.tell('You drop ' + this.name + '.');
  if (user.location) {
    user.location.announce(user.name + ' drops ' + this.name + '.');
  }
};
$.thing.drop.verb = 'drop';
$.thing.drop.dobj = 'this';
$.thing.drop.prep = 'none';
$.thing.drop.iobj = 'none';

$.thing.give = function(spec) {
  this.moveTo(spec.iobj);
  user.tell('You give ' + this.name + ' to ' + spec.dobj.name + '.');
  if (user.location) {
    user.location.announce(user.name + ' gives ' + this.name + ' to ' +
        spec.dobj.name + '.');
  }
};
$.thing.give.verb = 'give';
$.thing.give.dobj = 'this';
$.thing.give.prep = 'at/to';
$.thing.give.iobj = 'any';

$.thing.getCommands = function(spec) {
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

$.room.look = function(spec) {
  var text = '';
  text += '<scene user="' + user.name + '" room="' + this.name + '">\n';
  text += '  <description>' + this.getDescription() + '</description>\n';
  text += '  <svgtext>' + $.utils.htmlEscape(this.getSvgText()) + '</svgtext>\n';
  var contents = this.getContents();
  if (contents.length) {
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
$.room.look.verb = 'look';
$.room.look.dobj = 'this';
$.room.look.prep = 'none';
$.room.look.iobj = 'none';

$.room.lookhere = function(spec) {
  return this.look(spec);
}
$.room.lookhere.verb = 'look';
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

$.user.say = function(spec) {
  if (user.location) {
    user.location.announceAll(
        '<say user="' + user.name + '" room="' + user.location + '">' +
        $.utils.htmlEscape(spec.argstr) + '</say>');
  }
};
$.user.say.verb = 'say';
$.user.say.dobj = 'any';
$.user.say.prep = 'any';
$.user.say.iobj = 'any';

$.user.think = function(spec) {
  if (user.location) {
    user.location.announceAll(
        '<think user="' + user.name + '" room="' + user.location + '">' +
        $.utils.htmlEscape(spec.argstr) + '</think>');
  }
};
$.user.think.verb = 'think';
$.user.think.dobj = 'any';
$.user.think.prep = 'any';
$.user.think.iobj = 'any';

$.user.eval = function(spec) {
  user.tell('<text>' + $.utils.htmlEscape(eval(spec.argstr)) + '</text>');
};
$.user.eval.verb = 'eval';
$.user.eval.dobj = 'any';
$.user.eval.prep = 'any';
$.user.eval.iobj = 'any';

$.user.edit = function(spec) {
  user.tell('<iframe src="/web/edit/' + encodeURIComponent(spec.argstr) + '">' +
      'Edit ' + $.utils.htmlEscape(spec.argstr) + '</iframe>');
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

$.user.quit = function(spec) {
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
    this.onReceiveLine(this.buffer.substring(0, lf));
    this.buffer = this.buffer.substring(lf + 1);
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
  if (m && $.userDatabase[m[1]]) {
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
  } else {
    this.write('Unknown user: ' + text);
  }
};

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


// Set up a room, two users, and a rock.
(function () {
  var hangout = Object.create($.room);
  hangout.name = 'Hangout';
  hangout.description = 'A place to hang out, chat, and program.';
  hangout.svgtext = '<circle cx="0" cy="100" r="100"/><circle cx="0" cy="0" r="100"/>';

  var clock = Object.create($.thing);
  clock.name = 'clock';
  clock.getDescription = function() {
    return 'It is currently ' + Date();
  };
  clock.getSvgText = function() {
    var svg = '<circle cx="0" cy="30" r="10"/>';
    var r = 10;
    for (var i = 0; i < 12; i++) {
      var a = Math.PI * 2 / 12 * i;
      var length = (i % 3 === 0) ? 2 : 1;
      var x1 = Math.sin(a) * r;
      var y1 = Math.cos(a) * r + 30;
      var x2 = Math.sin(a) * (r - length);
      var y2 = Math.cos(a) * (r - length) + 30;
      svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" />';
    }
    var now = new Date;
    var minutes = now.getMinutes() + (now.getSeconds() / 60);
    var hours = now.getHours() + (minutes / 60);
    var x1 = 0;
    var y1 = 30;
    a = minutes / 60 * Math.PI * 2 + Math.PI;
    var x2 = Math.sin(a) * -8;
    var y2 = Math.cos(a) * 8 + 30;
    svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" />';
    a = hours / 12 * Math.PI * 2 + Math.PI;
    var x2 = Math.sin(a) * -6;
    var y2 = Math.cos(a) * 6 + 30;
    svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" />';
    return svg;
  };
  clock.moveTo(hangout);

  var bob = Object.create($.user);
  bob.name = 'Bob';
  $.userDatabase['1387bfc24b159b3bd6ea187c66551d6b08f52dafb7fe5c3a5a93478f54ac6202b8f78efe5817015c250173b23a70f7f6ef3205e9f5d28730e0ff2033cc6fcf84'] = bob;
  bob.description = 'Looks a bit Canadian.';
  bob.svgText = '<path d="m 1.59,78.8 c 1.48,-6.43 3.16,-12.8 5.20,-18.9 1.71,5.85 3.26,11.5 6.06,18.5" />';
  bob.svgText += '<path d="m 0.74,99.4 c 3.18,-7.65 4.14,-15.4 6.27,-23.6 1.11,6.88 2.32,14.5 3.72,23.7" />';
  bob.svgText += '<path d="m 7.01,76.8 c -0.44,-7.45 -0.78,-14.6 -0.11,-18.7" />';
  bob.svgText += '<path d="m 6.59,58.5 c -3.47,-1.83 -6.15,-6.17 -6.06,-10.1 0.07,-3.06 2.25,-6.52 5.10,-7.65 2.94,-1.17 6.90,0.01 9.24,2.12 2.20,1.98 3.12,5.45 2.87,8.39 -0.22,2.57 -1.53,5.42 -3.72,6.80 -2.10,1.33 -5.24,1.59 -7.44,0.42 z" />';
  bob.moveTo(hangout);

  var alice = Object.create($.user);
  alice.name = 'Alice';
  $.userDatabase['4b567644d33ad68a38a45d3fb61e5a53a64cf261ea2516d9a3de5235e75d7490b9bd7b2dc12f64182f9b9b50ddb113f257803c1d069cbb32da1719d06a567cee'] = alice;
  alice.description = 'Mostly harmless.';
  alice.svgText = '<path d="m 7.01,77.6 c 1.6,-5.5 3.39,-12.3 5.29,-18.6 2.1,6.5 3.5,15.1 4.8,18.6" />';
  alice.svgText += '<path d="m 5.84,99.5 c 2.86,-6.7 4.56,-16.1 6.66,-24.7 2,6.6 3.9,15.9 5.9,24.7" />';
  alice.svgText += '<path d="m 12.5,75.6 c -0.6,-7.4 -0.4,-12.1 -0.1,-17" />';
  alice.svgText += '<path d="m 12.3,58.5 c 2.4,0.8 5.6,0.4 7.6,-1.2 2.5,-2 3.7,-5.8 3.3,-9 -0.3,-2.6 -2.2,-5.3 -4.6,-6.5 -3,-1.5 -7.4,-1.8 -10.1,0.2 -2.58,1.9 -3.75,6 -3.08,9.1 0.71,3.3 3.7,6.3 6.88,7.4 z" />';
  alice.svgText += '<path d="m 6.48,53.4 c -0.1,-2.2 1.1,-5.7 4.42,-3.6 6,3.8 12.3,-3.5 11.3,-4.3 l 0,0" />';
  alice.svgText += '<path d="m 6.06,52.6 c -1.34,3.2 -1.54,7.1 -1.18,10.3 -0.15,-2.5 -4.525,-7.7 -4.243,-11.4 0.403,-5.3 2.783,-5.9 4.573,-3.6 0,2.3 0.28,3.8 0.85,4.7 z" />';
  alice.moveTo(hangout);

  var fido = Object.create($.thing);
  fido.name = 'Fido';
  fido.description = 'A happy little puppy.';
  fido.svgText = '<path d="m 20.8,91.5 c -0.1,1.3 -0.2,2.5 -1.4,3.8 0,1.1 0.3,2 -0.1,3.3 -0.7,1.2 -1.6,1 -2.4,1 -2.7,-0.1 -1.3,-2.3 0.1,-2.9 0.5,-3.8 -0.3,-5.7 -0.4,-8.5" />';
  fido.svgText += '<path d="m 15.4,98.6 c -0.1,0.2 -0.7,0.2 -1.5,0 -0.4,-0.4 0.2,-2.1 1.9,-2.3 0.1,-2.3 0.2,-5.1 -0.2,-7" />';
  fido.svgText += '<path d="m 15,85.9 c -0.8,4 5,9.9 11.2,11.7 9.7,2.4 12,-4.2 7.6,-11.2 -1.3,-2 -5.6,-7.8 -13,-5.5 2.4,-9.3 -10.6,-16 -12.22,-3.8 -5.9,2.1 -10.5,6.7 -2.5,9.8 5.02,1.9 10.82,-1.8 13.32,-4.3" />';
  fido.svgText += '<circle r="0.377" cy="77.2" cx="11.4" />';
  fido.svgText += '<path d="m 32.7,96.6 c -0.4,1 -0.7,2 -1.4,2.9 -2.2,-0.3 -5.9,0.4 -8.9,0.5 -0.6,-1.8 -0.6,-3.4 2.4,-1.8 l 2.8,-0.3 c -5.7,-4.8 0.4,-7.3 2.2,-5.6" />';
  fido.svgText += '<path d="m 20.6,75.6 c -1,4.4 -4,4.9 -4.7,-0.5 -0.2,-1.5 -1.8,-2.9 -1,-4.4" />';
  fido.svgText += '<path d="m 36,92.1 c 0,0 2.5,-2.2 4.3,-4.7 1.9,-2.8 3.6,-4 2.2,1.1 -1.1,3.7 -0.9,4.5 -6.5,5" />';
  fido.svgText += '<path d="m 40.2,84.8 c -1.2,0.7 -2,2.2 -2.6,4" />';
  fido.svgText += '<path d="m 39.1,83.2 c -1.3,0.9 -2.1,1.9 -2.4,2.8" />';
  fido.svgText += '<path d="m 44.2,90.6 c -0.6,3.5 -3.7,5.3 -5.8,5" />';
  fido.svgText += '<path d="m 44.7,95 c -0.9,1.7 -3.3,3.7 -5,2.9" />';
  fido.svgText += '<path d="m 5.88,84.2 c 0,0 -0.4,1.2 -3.1,0.8" />';
  fido.moveTo(hangout);

  connectionListen(7777, $.connection);
})();
