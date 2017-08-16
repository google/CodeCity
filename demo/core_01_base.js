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
$.physical.svgtext = '';
$.physical.location = null;
$.physical.contents_ = null;

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
  user.tell(this.name);
  user.tell(this.description);
  var contents = this.getContents();
  if (contents.length) {
    var text = [];
    for (var i = 0; i < contents.length; i++) {
      text[i] = String(contents[i].name || contents[i]);
    }
    user.tell('Contents: ' + text.join(', '));
  }
};
$.physical.look.dobj = 'this';

$.physical.getCommands = function() {
  return ['look ' + this.name];
};


// Thing prototype: $.thing
$.thing = Object.create($.physical);
$.thing.name = 'Thing prototype';

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
  text += '  <description>' + this.description + '</description>\n';
  text += '  <svgtext>' + $.utils.htmlEscape(this.svgtext) + '</svgtext>\n';
  var contents = this.getContents();
  if (contents.length) {
    for (var i = 0; i < contents.length; i++) {
      var thing = contents[i];
      var tag = $.user.isPrototypeOf(thing) ? 'user' : 'object';
      text += '  <' + tag + ' name="' + thing.name + '">\n';
      text += '    <svgtext>' + $.utils.htmlEscape(thing.svgtext) + '</svgtext>\n';
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

  var neil = Object.create($.user);
  neil.name = 'Neil';
  $.userDatabase['1387bfc24b159b3bd6ea187c66551d6b08f52dafb7fe5c3a5a93478f54ac6202b8f78efe5817015c250173b23a70f7f6ef3205e9f5d28730e0ff2033cc6fcf84'] = neil;
  neil.description = 'Looks a bit Canadian.';
  hangout.svgtext = '<ellipse ry="6" rx="5" cy="51" cx="17"/><line y2="83" x2="18" y1="57" x1="17"/><line y2="60" x2="4" y1="73" x1="18"/><line y2="70" x2="18" y1="62" x1="28"/><line y2="99" x2="11" y1="82" x1="18"/><line y2="99" x2="27" y1="82" x1="18"/><line y2="53" x2="18" y1="55" x1="21"/><circle r="0.4" cy="49" cx="19"/>';
  neil.moveTo(hangout);

  var chris = Object.create($.user);
  chris.name = 'Chris';
  $.userDatabase[chris.name.toLowerCase()] = chris;
  chris.description = 'Mostly harmless.';
  chris.svgtext = '<circle cx="50" cy="50" r="10" /><line x1="50" y1="60" x2="50" y2="80"/><line x1="40" y1="70" x2="60" y2="70"/><line x1="50" y1="80" x2="40" y2="100"/><line x1="50" y1="80" x2="60" y2="100"/>';
  chris.moveTo(hangout);

  var rock = Object.create($.thing);
  rock.name = 'rock';
  rock.description = 'Suspiciously cube shaped, made of granite.';
  rock.svgtext = '<path d="M10,90 l5,-5 h10 v10 l-5,5"/><line x1="20" y1="90" x2="25" y2="85"/><rect height="10" width="10" y="90" x="10"/>';
  rock.moveTo(hangout);

  connectionListen(7777, $.connection);
})();
