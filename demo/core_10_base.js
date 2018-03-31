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
  // $() is an alias for $.utils.selector.toValue().
  return $.utils.selector.toValue.apply($.utils, arguments);
};

// System object: $.system
$.system = {};
$.system.log = new 'CC.log';
$.system.checkpoint = new 'CC.checkpoint';
$.system.shutdown = new 'CC.shutdown';
$.system.connectionListen = new 'CC.connectionListen';
$.system.connectionUnlisten = new 'CC.connectionUnlisten';
$.system.connectionWrite = new 'CC.connectionWrite';
$.system.connectionClose = new 'CC.connectionClose';

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

$.utils.transplantProperties = function(oldObject, newObject) {
  if (!$.utils.isObject(newObject) || !$.utils.isObject(oldObject)) {
    throw TypeError("Can't transplant properties on non-objects.");
  }
  var keys = Object.getOwnPropertyNames(oldObject);
  for (var i = 0, k; k = keys[i], i < keys.length; i++) {
    if (k === 'length' && typeof newObject === 'function') {
      continue;
    }
    var pd = Object.getOwnPropertyDescriptor(oldObject, k);
    try {
      Object.defineProperty(newObject, k, pd);
    } catch (e) {
      try {
        // If defineProperty fails, try simple assignment.
        // TODO(cpcallen): remove this when server allows
        // (non-effective) redefinition of nonconfigurable
        // properties?
        newObject[k] = pd.value;
      } catch (e) {
        // Ignore failed attempt to copy properties.
      }
    }
  }
};

$.utils.replacePhysicalsWithName = function(value) {
  // Deeply clone JSON object.
  // Replace all instances of $.physical with the object's name.
  if (Array.isArray(value)) {
    var newArray = [];
    for (var i = 0; i < value.length; i++) {
      newArray[i] = $.utils.replacePhysicalsWithName(value[i]);
    }
    return newArray;
  }
  if ($.physical.isPrototypeOf(value)) {
    return value.name;
  }
  if (typeof value === 'object' && value !== null) {
    var newObject = {};
    for (var prop in value) {
      newObject[prop] = $.utils.replacePhysicalsWithName(value[prop]);
    }
    return newObject;
  }
  return value;
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
  var html = $.jssp.generateString(this.lookJssp, this);
  user.writeJson({type: "html", htmlText: html});
};
$.physical.look.verb = 'l(ook)?';
$.physical.look.dobj = 'this';
$.physical.look.prep = 'none';
$.physical.look.iobj = 'none';

$.physical.lookJssp = function(request, response) {
  // Overwrite on first execution.
  $.physical.lookJssp = $.jssp.compile($.physical.lookJssp);
  $.physical.lookJssp.call(this, request, response);
};
$.physical.lookJssp.jssp = [
  '<table style="height: 100%; width: 100%;">',
  '  <tr>',
  '    <td style="padding: 1ex; width: 30%;">',
  '      <svg width="100%" height="100%" viewBox="0 0 0 0">',
  '        <%= this.getSvgText() %>',
  '      </svg>',
  '    </td>',
  '    <td>',
  '    <h1><%= $.utils.htmlEscape(this.name) + $.utils.commandMenu(this.getCommands(user)) %></h1>',
  '    <p><%= this.getDescription() %></p>',
  '<%',
  'var contents = this.getContents();',
  'if (contents.length) {',
  '  var contentsHtml = [];',
  '  for (var i = 0; i < contents.length; i++) {',
  '    contentsHtml[i] = contents[i].name +',
  '        $.utils.commandMenu(contents[i].getCommands(user));',
  '  }',
  '  response.write(\'<p>Contents: \' + contentsHtml.join(\', \') + \'</p>\');',
  '}',
  'if (this.location) {',
  '  response.write(\'<p>Location: \' + this.location.name +',
  '      $.utils.commandMenu(this.location.getCommands(user)) + \'</p>\');',
  '}',
  '%>',
  '    </td>',
  '  </tr>',
  '</table>'].join('\n');

$.physical.getCommands = function(who) {
  return ['look ' + this.name];
};

$.physical.tell = function(json) {
  // Allow the object to add hooks (e.g. voice controlled objects).
  if (this.onTell) {
    setTimeout(this.onTell.bind(this, json), 0);
  }
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
  var scene = {
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
    scene.contents.push({
      type: $.user.isPrototypeOf(object) ? 'user' : 'thing',
      what: object,
      svgText: object.getSvgText(),
      cmds: object.getCommands(who)
    });
  }
  // Should unrequested scenes be sent to writeJson instead of tell?
  who.tell(scene);
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

$.room.tell = function(json) {
  $.physical.tell.call(this, json);
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing !== user && thing.tell) {
      thing.tell(json);
    }
  }
};

$.room.tellAll = function(json) {
  $.physical.tell.call(this, json);
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing.tell) {
      thing.tell(json);
    }
  }
};


// User prototype: $.user
$.user = Object.create($.physical);
$.user.name = 'User prototype';
$.user.connection = null;
$.user.svgText = '<circle cx="50" cy="50" r="10" class="fillWhite"/><line x1="50" y1="60" x2="50" y2="80" /><line x1="40" y1="70" x2="60" y2="70" /><line x1="50" y1="80" x2="40" y2="100" /><line x1="50" y1="80" x2="60" y2="100" />';

$.user.say = function(cmd) {
  if (user.location) {
    // Format:  "Hello.    -or-    say Hello.
    var text = (cmd.cmdstr[0] === '"') ? cmd.cmdstr.substring(1) : cmd.argstr;
    var say = {
      type: "say",
      source: user,
      where: user.location,
      text: text
    };
    user.location.tellAll(say);
  }
};
$.user.say.verb = 'say|".*';
$.user.say.dobj = 'any';
$.user.say.prep = 'any';
$.user.say.iobj = 'any';

$.user.think = function(cmd) {
  if (user.location) {
    var think = {
      type: "think",
      source: user,
      where: user.location,
      text: cmd.argstr
    };
    user.location.tellAll(think);
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
  // Save the value without creating a new variable.
  $.user.eval.value_ = $$$cmd;
  try {
    $$$cmd = JSON.stringify($$$cmd);
  } catch (e) {
    $$$cmd = undefined;
  }
  if ($$$cmd === undefined) {
    // JSON.stringify either failed with an error or just returned undefined.
    $$$cmd = String($.user.eval.value_);
  }
  delete $.user.eval.value_;
  user.narrate('⇒ ' + $$$cmd);
};
$.user.eval.verb = 'eval|;.*';
$.user.eval.dobj = 'any';
$.user.eval.prep = 'any';
$.user.eval.iobj = 'any';

$.user.edit = function(cmd) {
  try {
    var url = $.editor.edit(cmd.iobj, cmd.iobjstr, cmd.dobjstr);
  } catch (e) {
    user.narrate(e);
    return;
  }

  var iframe = {
    type: 'iframe',
    url: url,
    alt: 'Edit ' + cmd.dobjstr + ' on ' + cmd.iobjstr
  };
  user.tell(iframe);
};
$.user.edit.verb = 'edit';
$.user.edit.dobj = 'any';
$.user.edit.prep = 'on top of/on/onto/upon';
$.user.edit.iobj = 'any';

$.user.narrate = function(text, obj) {
  var narrate = {type: 'narrate', text: String(text)};
  if (obj && obj.location) {
    narrate.source = obj;
    narrate.where = obj.location;
  }
  this.tell(narrate);
};

$.user.tell = function(json) {
  $.physical.tell.call(this, json);
  this.writeJson(json);
};

$.user.writeJson = function(json) {
  if (!this.connection) {
    return;
  }
  json = $.utils.replacePhysicalsWithName(json);
  this.connection.write(JSON.stringify(json) + '\n');
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
  // Override this on child classes.
};

$.connection.onEnd = function() {
  // Override this on child classes.
};

$.connection.write = function(text) {
  $.system.connectionWrite(this, text);
};

$.connection.close = function() {
  $.system.connectionClose(this);
};

$.servers = {};

$.servers.telnet = Object.create($.connection);

$.servers.telnet.onReceiveLine = function(text) {
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
    guest.name = 'Guest' + $.servers.telnet.onReceiveLine.guestCount++;
    $.userDatabase[m[1]] = guest;
    guest.description = 'A new user who has not yet set his/her description.';
    guest.moveTo($.startRoom);
  }
  this.user = $.userDatabase[m[1]];
  if (this.user.connection) {
    try {
      this.user.connection.close();
    } catch (e) {
      // Ignore; maybe connection already closed (e.g., due to crash/reboot).
    }
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
$.servers.telnet.onReceiveLine.guestCount = 0;

$.servers.telnet.onEnd = function() {
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
