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
 * @fileoverview Minimal database for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

var user = null;
var $ = {};

// System object: $.system
$.system = {};
$.system.log = new 'CC.log';
$.system.checkpoint = new 'CC.checkpoint';
$.system.shutdown = new 'CC.shutdown';
$.system.connectionListen = new 'CC.connectionListen';
$.system.connectionUnlisten = new 'CC.connectionUnlisten';
$.system.connectionWrite = new 'CC.connectionWrite';
$.system.connectionClose = new 'CC.connectionClose';


// Physical object prototype: $.physical
$.physical = {};
$.physical.name = 'Physical object prototype';
$.physical.description = '';
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


// Room prototype: $.room
$.room = Object.create($.physical);
$.room.name = 'Room prototype';

$.room.announce = function(text) {
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing !== user && thing.tell) {
      thing.tell(text);
    }
  }
};


// User prototype: $.user
$.user = Object.create($.physical);
$.user.name = 'User prototype';
$.user.connection = null;

$.user.say = function(text) {
  user.tell('You say: ' + text);
  if (user.location) {
    user.location.announce(user.name + ' says: ' + text);
  }
};
$.user.say.dobj = 'any';

$.user.eval = function(code) {
  user.tell(eval(code));
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
            obj.name.toLowerCase().startsWith(dobjstr.toLowerCase())) {
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
  user.tell('Command not understood.');
};


// Database of users so that connections can bind to a user.
$.userDatabase = Object.create(null);


$.connection = {};

$.connection.onConnect = function() {
  this.user = null;
  this.buffer = '';
  this.write('Welcome.  Type name of user to connect as (Alpha or Beta).');
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
  text = text.trim().toLowerCase();
  if ($.userDatabase[text]) {
    this.user = $.userDatabase[text];
    if (this.user.connection) {
      this.user.connection.close();
      $.system.log('Rebinding connection to ' + this.user.name);
    } else {
      $.system.log('Binding connection to ' + this.user.name);
    }
    this.user.connection = this;
    this.write('Connected as ' + this.user.name);
    user = this.user;
    $.execute('look here');
    if (user.location) {
      user.location.announce(user.name + ' connects.');
    }
  } else {
    this.write('Unknown user.');
  }
};

$.connection.onEnd = function() {
  if (this.user) {
    if (user.location) {
      user.location.announce(user.name + ' disconnects.');
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


// Set up a room, two users, and a rock.
(function () {
  var hangout = Object.create($.room);
  hangout.name = 'Hangout';
  hangout.description = 'A place to hang out, chat, and program.';

  var alpha = Object.create($.user);
  alpha.name = 'Alpha';
  $.userDatabase[alpha.name.toLowerCase()] = alpha;
  alpha.description = 'Looks a bit Canadian.';
  alpha.moveTo(hangout);

  var beta = Object.create($.user);
  beta.name = 'Beta';
  $.userDatabase[beta.name.toLowerCase()] = beta;
  beta.description = 'Mostly harmless.';
  beta.moveTo(hangout);

  var rock = Object.create($.thing);
  rock.name = 'Rock';
  rock.description = 'Suspiciously cube shaped, made of granite.';
  rock.moveTo(hangout);

  $.system.connectionListen(7777, $.connection);
})();
