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
var $ = {};

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

$.physical.look = function() {
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
$.physical.look.dobj = 'this';

$.physical.getCommands = function() {
  return ['look ' + this.name];
};


// Thing prototype: $.thing
$.thing = Object.create($.physical);
$.thing.name = 'Thing prototype';
$.thing.svgText = '<path d="M10,90 l5,-5 h10 v10 l-5,5"/><line x1="20" y1="90" x2="25" y2="85"/><rect height="10" width="10" y="90" x="10"/>';

$.thing.get = function() {
  this.moveTo(user);
  user.tell('You pick up ' + this.name + '.');
  if (user.location) {
    user.location.announce(user.name + ' picks up ' + this.name + '.');
  }
};
$.thing.get.dobj = 'this';

$.thing.drop = function() {
  this.moveTo(user.location);
  user.tell('You drop ' + this.name + '.');
  if (user.location) {
    user.location.announce(user.name + ' drops ' + this.name + '.');
  }
};
$.thing.drop.dobj = 'this';

$.thing.getCommands = function() {
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

$.room.look = function() {
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
$.room.look.dobj = 'this';

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

$.user.say = function(text) {
  if (user.location) {
    user.location.announceAll(
        '<say user="' + user.name + '" room="' + user.location + '">' +
        $.utils.htmlEscape(text) + '</say>');
  }
};
$.user.say.dobj = 'any';

$.user.think = function(text) {
  if (user.location) {
    user.location.announceAll(
        '<think user="' + user.name + '" room="' + user.location + '">' +
        $.utils.htmlEscape(text) + '</think>');
  }
};
$.user.say.dobj = 'any';

$.user.eval = function(code) {
  user.tell('<text>' + $.utils.htmlEscape(eval(code)) + '</text>');
};
$.user.eval.dobj = 'any';

$.user.edit = function(path) {
  user.tell('<iframe src="https://example.com/foo?src=' + encodeURIComponent(path) + '">Edit ' + $.utils.htmlEscape(path) + '</iframe>');
};
$.user.edit.dobj = 'any';

$.user.tell = function(text) {
  if (this.connection) {
    this.connection.write(text);
  }
};

$.user.quit = function() {
  if (this.connection) {
    this.connection.close();
  }
};
$.user.quit.dobj = 'none';


// Command parser.
$.execute = function(command) {
  var argstr = command.trim();
  var verbstr = argstr;
  var dobjstr = '';
  var dobj = null;
  var space = command.indexOf(' ');
  if (space !== -1) {
    verbstr = argstr.substring(0, space).trim();
    dobjstr = argstr.substring(space).trim();
  }
  if (!verbstr) {
    return;
  }
  if (dobjstr) {
    if (dobjstr === 'me') {
      dobj = user;
    } else if (dobjstr === 'here') {
      dobj = user.location;
    } else {
      var objects = [user].concat(user.getContents());
      if (user.location && user.location.getContents) {
        objects.push(user.location);
        objects = objects.concat(user.location.getContents());
      }
      for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];
        if (obj.name &&
            obj.name.toLowerCase().indexOf(dobjstr.toLowerCase()) === 0) {
          dobj = obj;
          break;
        }
      }
    }
  }
  // Collect all objects which could host the verb.
  var hosts = [user, user.location, dobj];
  for (var i = 0; i < hosts.length; i++) {
    var host = hosts[i];
    if (!host) {
      continue;
    }
    // Check every verb on each object for a match.
    for (var prop in host) {
      var func = host[prop];
      if (prop === verbstr && typeof func === 'function' && func.dobj) {
        if (func.dobj === 'any' || (func.dobj === 'this' && dobj === host) ||
            (func.dobj === 'none' && !dobj)) {
          return host[prop](dobjstr);
        }
      }
    }
  }
  user.tell('<text>Command not understood.<text>');
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
    $.execute('look here');
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
  $.userDatabase[alice.name.toLowerCase()] = alice;
  alice.description = 'Mostly harmless.';
  alice.svgText = '<path d="m 7.01,77.6 c 1.6,-5.5 3.39,-12.3 5.29,-18.6 2.1,6.5 3.5,15.1 4.8,18.6" />';
  alice.svgText += '<path d="m 5.84,99.5 c 2.86,-6.7 4.56,-16.1 6.66,-24.7 2,6.6 3.9,15.9 5.9,24.7" />';
  alice.svgText += '<path d="m 12.5,75.6 c -0.6,-7.4 -0.4,-12.1 -0.1,-17" />';
  alice.svgText += '<path d="m 12.3,58.5 c 2.4,0.8 5.6,0.4 7.6,-1.2 2.5,-2 3.7,-5.8 3.3,-9 -0.3,-2.6 -2.2,-5.3 -4.6,-6.5 -3,-1.5 -7.4,-1.8 -10.1,0.2 -2.58,1.9 -3.75,6 -3.08,9.1 0.71,3.3 3.7,6.3 6.88,7.4 z" />';
  alice.svgText += '<path d="m 6.48,53.4 c -0.1,-2.2 1.1,-5.7 4.42,-3.6 6,3.8 12.3,-3.5 11.3,-4.3 l 0,0" />';
  alice.svgText += '<path d="m 6.06,52.6 c -1.34,3.2 -1.54,7.1 -1.18,10.3 -0.15,-2.5 -4.525,-7.7 -4.243,-11.4 0.403,-5.3 2.783,-5.9 4.573,-3.6 0,2.3 0.28,3.8 0.85,4.7 z" />';
  alice.moveTo(hangout);

  var dog = Object.create($.thing);
  dog.name = 'dog';
  dog.description = 'A happy little puppy.';
  dog.svgText = '<path d="m 33.5,88.7 c 0.2,1.7 0.3,3.3 1.9,5 0,1.4 -0.4,2.7 0.1,4.3 1,1.7 2.2,1.4 3.3,1.4 3.5,-0.1 1.6,-3 -0.2,-3.9 -0.7,-5 0.4,-7.5 0.5,-11.2" />';
  dog.svgText += '<path d="m 17.8,95.4 c 0.5,1.3 0.9,2.6 1.9,3.9 2.8,-0.5 7.7,0.5 11.7,0.7 0.8,-2.5 0.9,-4.6 -3.2,-2.5 l -3.7,-0.4 c 7.6,-6.3 -0.5,-9.6 -2.9,-7.4" />';
  dog.svgText += '<path d="m 40.7,98 c 0.2,0.3 1,0.3 2,0.1 0.6,-0.6 -0.3,-2.8 -2.5,-3.1 -0.2,-3.1 -0.3,-6.7 0.3,-9.3" />';
  dog.svgText += '<path d="m 41.3,81.2 c 1,5.3 -6.7,13.1 -14.9,15.5 -12.9,3.3 -15.9,-5.5 -10.1,-14.8 1.7,-2.7 7.4,-10.4 17.3,-7.3 -3.2,-12.4 14,-21.3 16.2,-5.1 7.8,2.8 13.9,8.9 3.3,13 -6.7,2.5 -14.4,-2.3 -17.7,-5.6" />';
  dog.svgText += '<circle r="0.5" cy="69.7" cx="46" />';
  dog.svgText += '<path d="m 33.8,67.5 c 1.4,5.9 5.3,6.6 6.2,-0.6 0.3,-2 2.4,-3.9 1.4,-5.9" />';
  dog.svgText += '<path d="m 13.4,89.4 c 0,0 -3.4,-2.9 -5.73,-6.2 -2.58,-3.7 -4.84,-5.3 -2.92,1.4 1.44,5 1.2,6 8.65,6.7" />';
  dog.svgText += '<path d="m 7.75,79.8 c 1.63,0.9 2.65,2.9 3.55,5.3" />';
  dog.svgText += '<path d="m 9.28,77.6 c 1.72,1.2 2.72,2.5 3.12,3.7" />';
  dog.svgText += '<path d="m 2.48,87.5 c 0.85,4.6 4.86,7 7.72,6.6" />';
  dog.svgText += '<path d="m 1.83,93.3 c 1.2,2.3 4.44,4.9 6.65,3.8" />';
  dog.svgText += '<path d="m 53.3,79 c 0,0 0.6,1.6 4.2,1" />';
  dog.moveTo(hangout);

  connectionListen(7777, $.connection);
})();
