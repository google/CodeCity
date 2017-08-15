/**
 * @license
 * Code City: Minimal database.
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
 * @fileoverview Minimal database for Code City.
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


// Prototype physical object: $.physical
$.physical = {};
$.physical.name = 'Prototype physical object';
$.physical.description = '';
$.physical.location = null;
$.physical.contents_ = null;
$.physical.getContents = function() {return this.contents_ || [];};
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


// Prototype thing: $.thing
$.thing = Object.create($.physical);
$.thing.name = 'Prototype thing';
$.thing.get = function() {
  this.moveTo(user);
};
$.thing.get.dobj = 'this';
$.thing.drop = function() {
  this.moveTo(user.location);
};
$.thing.drop.dobj = 'this';


// Prototype room: $.room
$.room = Object.create($.physical);
$.room.name = 'Prototype room';
$.room.announce = function(text) {
  var contents = this.getContents();
  for (var i = 0; i < contents.length; i++) {
    var thing = contents[i];
    if (thing !== user && thing.tell) {
      thing.tell(text);
    }
  }
};


// Prototype user: $.user
$.user = Object.create($.physical);
$.user.name = 'Prototype user';
$.user.connection = null;
$.user.say = function(text) {
  user.tell('You say: ' + text);
  if (user.location && user.location.announce) {
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
  user.tell('Command not understood.');
};


$.playerDatabase = Object.create(null);


$.connection = {};
$.connection.onConnect = function() {
  this.user = null;
  this.write('Welcome.  Type name of user to connect as (Alpha or Beta).');
};
$.connection.onReceive = function(text) {
  if (this.user) {
    user = this.user;
    $.execute(text);
    return;
  }
  text = text.trim().toLowerCase();
  if ($.playerDatabase[text]) {
    this.user = $.playerDatabase[text];
    if (this.user.connection) {
      this.user.connection.close();
    }
    this.user.connection = this;
    $.system.log('Binding connection to ' + this.user.name);
    this.write('Connected as ' + this.user.name);
    user = this.user;
    $.execute('look here');
  } else {
    this.write('Unknown user.');
  }
};
$.connection.onEnd = function() {
  if (this.user) {
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

  var alpha = Object.create($.user);
  alpha.name = 'Alpha';
  $.playerDatabase[alpha.name.toLowerCase()] = alpha;
  alpha.description = 'Looks a bit Canadian.';
  alpha.moveTo(hangout);

  var beta = Object.create($.user);
  beta.name = 'Beta';
  $.playerDatabase[beta.name.toLowerCase()] = beta;
  beta.description = 'Mostly harmless.';
  beta.moveTo(hangout);

  var rock = Object.create($.thing);
  rock.name = 'Rock';
  rock.description = 'Cube shaped, made of granite.';
  rock.moveTo(hangout);

  connectionListen(7777, $.connection);
})();
