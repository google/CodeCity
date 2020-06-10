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
 * @fileoverview Physical object prototype for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.physical = {};
$.physical.name = 'Physical object prototype';
$.physical.description = '';
$.physical.svgText = '';
$.physical.location = null;
$.physical.contents_ = null;
$.physical.getSvgText = function() {
  return this.svgText;
};
$.physical.getSvgText.prototype.constructor = function getSvgText() {
  return this.isOpen ? this.svgTextOpen : this.svgTextClosed;
};
$.physical.getDescription = function() {
  return this.description;
};
$.physical.getContents = function getContents() {
  $.physical.validate.call(this);
  return this.contents_.slice();
};
$.physical.addContents = function addContents(newThing, opt_neighbour) {
  // Add newThing to this's contents.  It will be added after
  // opt_neighbour, or to the end of list if opt_neighbour not given.
  // An item already in the contents list will be moved to the
  // specified position.
  $.physical.validate.call(this);
  if (!$.physical.isPrototypeOf(newThing)) {
    throw new TypeError('cannot add non-$.physical to contents');
  } else if(newThing.location !== this) {
    throw new RangeError('object to be added to contents must have .location set first');
  }
  for (var loc = this; loc; loc = loc.location) {
		if (loc === newThing) {
      throw new RangeError('object cannot contain itself');
    }
  }
  var contents = this.contents_;
  var index = contents.indexOf(newThing);
  if (index !== -1) {
    // Remove existing thing.
    contents.splice(index, 1);
  }
  if (opt_neighbour) {
    for (var i = 0, thing; (thing = contents[i]); i++) {
      if (thing === opt_neighbour) {
        contents.splice(i + 1, 0, newThing);
        return;
      }
    }
    // Neighbour not found, just append.
  }
  // Common case of appending a thing.
  contents.push(newThing);
};
$.physical.removeContents = function(thing) {
  var contents = this.getContents();
  var index = contents.indexOf(thing);
  if (index !== -1) {
    contents.splice(index, 1);
  }
  this.contents_ = contents;
};
$.physical.moveTo = function moveTo(dest, opt_neighbour) {
  // Move his object to the specified destination location.
  // Attempt to position this object next to a specified neighbour, if given.
  $.physical.validate.call(this);
  if (!$.physical.isPrototypeOf(dest) && dest !== null) {
    throw new Error('destination must be a $.physical or null');
  }
  var src = this.location;
  if (src === dest) return;  // Nothing to do.
  // Preliminary check for recursive move.  This is formally enforced by
  // $.physical.addContents(), but we bail here if it is likely to fail later.
  for (var loc = dest; loc; loc = loc.location) {
		if (loc === this) {
      throw new RangeError('cannot move object inside itself');
    }
  }
  // Call this.moveable(dest), and refuse move unless it returns true without suspending.
	var movable = false;
  new Thread(function checkMovable() {
 		movable = Boolean(this.movable(dest));
  }, 0, this);
  suspend(0);
  if (!movable) {
    throw new PermissionError(String(this) + " isn't movable to " + String(dest));
  }
  // Call dest.accept(this), and refuse move unless it returns true without suspending.
	var accept = false;
  new Thread(function checkAccept() {
 		accept = (dest === null || Boolean(dest.accept(this)));
  }, 0, this);
  suspend(0);
  if (!accept) {
    throw new PermissionError(String(dest) + " doesn't accept " + String(this));
  }
  // Call src.onExit(this, dest).
  new Thread(function callOnExit() {
    if (src) src.onExit(this, dest);
  }, 0, this);
  suspend(0);
  // Perform move.
  if (src && src.removeContents) src.removeContents(this);
  this.location = dest;
  if (dest) {
    try {
      dest.addContents(this, opt_neighbour);
    } finally {
      if (!dest.getContents().includes(this)) {
        this.location = null;  // Uh oh.
        dest = null;
      }
    }
  }
  // Call dest.onEnter(this, src).
  new Thread(function callOnEnter() {
    if (dest) dest.onEnter(this, src);
  }, 0, this);
  suspend(0);
};
Object.setOwnerOf($.physical.moveTo, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.moveTo.updateScene_ = function(room, mover) {
  if (!$.room.isPrototypeOf(room)) return;
  var contents = room.getContents();
  for (var i = 0; i < contents.length; i++) {
    var who = contents[i];
    if ($.user.isPrototypeOf(who)) {
      room.sendScene(who, who === mover);
    }
  }
};
$.physical.look = function look(cmd) {
  var html = this.lookJssp.toString(this, {user: cmd.user});
  cmd.user.readMemo({type: "html", htmlText: html});
};
Object.setOwnerOf($.physical.look, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.look.verb = 'l(ook)?';
$.physical.look.dobj = 'this';
$.physical.look.prep = 'none';
$.physical.look.iobj = 'none';
// CLOSURE: type: function, vars: source, jssp
// CLOSURE: type: funexp, vars: Jssp
$.physical.lookJssp = function jssp(request, response) {
  // DO NOT EDIT THIS CODE.  AUTOMATICALLY GENERATED BY JSSP.
  // To edit contents of generated page, edit this.source.
  return jssp.render(this, request, response);  // See $.Jssp for explanation.
};
Object.setPrototypeOf($.physical.lookJssp, $.Jssp.prototype);
Object.setOwnerOf($.physical.lookJssp, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.physical.lookJssp.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.lookJssp.source = '<table style="height: 100%; width: 100%;">\n  <tr>\n    <td style="padding: 1ex; width: 30%;">\n      <svg width="100%" height="100%" viewBox="0 0 0 0">\n        <%= this.getSvgText() %>\n      </svg>\n    </td>\n    <td>\n    <h1><%= $.utils.html.escape(this.name) + $.utils.commandMenu(this.getCommands(request.user)) %></h1>\n    <p><%= $.utils.html.preserveWhitespace(this.getDescription()) %></p>\n<%\nvar contents = this.getContents();\nif (contents.length) {\n  var contentsHtml = [];\n  for (var i = 0; i < contents.length; i++) {\n    contentsHtml[i] = $.utils.html.escape(contents[i].name) +\n        $.utils.commandMenu(contents[i].getCommands(request.user));\n  }\n  response.write(\'<p>Contents: \' + contentsHtml.join(\', \') + \'</p>\');\n}\nif (this.location) {\n  response.write(\'<p>Location: \' + $.utils.html.escape(this.location.name) +\n      $.utils.commandMenu(this.location.getCommands(request.user)) + \'</p>\');\n}\n%>\n    </td>\n  </tr>\n</table>';
$.physical.lookJssp.hash_ = '75be546dc1c383713d40c9cbbf952381v1.0.0';
$.physical.lookJssp.compiled_ = function(request, response) {
// DO NOT EDIT THIS CODE: AUTOMATICALLY GENERATED BY JSSP.
response.write("<table style=\"height: 100%; width: 100%;\">\n  <tr>\n    <td style=\"padding: 1ex; width: 30%;\">\n      <svg width=\"100%\" height=\"100%\" viewBox=\"0 0 0 0\">\n        ");
response.write(this.getSvgText());
response.write("\n      </svg>\n    </td>\n    <td>\n    <h1>");
response.write($.utils.html.escape(this.name) + $.utils.commandMenu(this.getCommands(request.user)));
response.write("</h1>\n    <p>");
response.write($.utils.html.preserveWhitespace(this.getDescription()));
response.write("</p>\n");

var contents = this.getContents();
if (contents.length) {
  var contentsHtml = [];
  for (var i = 0; i < contents.length; i++) {
    contentsHtml[i] = $.utils.html.escape(contents[i].name) +
        $.utils.commandMenu(contents[i].getCommands(request.user));
  }
  response.write('<p>Contents: ' + contentsHtml.join(', ') + '</p>');
}
if (this.location) {
  response.write('<p>Location: ' + $.utils.html.escape(this.location.name) +
      $.utils.commandMenu(this.location.getCommands(request.user)) + '</p>');
}

response.write("\n    </td>\n  </tr>\n</table>");
};
delete $.physical.lookJssp.compiled_.name;
Object.setOwnerOf($.physical.lookJssp.compiled_, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.physical.lookJssp.compiled_.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.inspect = function inspect(cmd) {
  // Open this object in the code editor.
  var selector = $.Selector.for(this);
  if (!selector) {
    cmd.user.narrate('Unfortuantely the code editor does not know how to locate ' + String(this) + ' yet.');
    return;
  }
  var link = '/code?' + encodeURIComponent(String(selector));
  cmd.user.readMemo({type: "link", href: link});
};
Object.setOwnerOf($.physical.inspect, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.inspect.verb = 'inspect';
$.physical.inspect.dobj = 'this';
$.physical.inspect.prep = 'none';
$.physical.inspect.iobj = 'none';
$.physical.getCommands = function(who) {
  return [
    'look ' + this.name,
    'examine ' + this.name,
    'inspect ' + this.name
  ];
};
delete $.physical.getCommands.name;
Object.setOwnerOf($.physical.getCommands, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.validate = function validate() {
  /* Validate this $.physical object to enforce that certain
   * invariants are true.  Those invariants are:
   * - this.location must be a $.physical or null.
   * - this.contents_ must be an array unique to this (not inherited)
   * - Each item in this.contents_ must be a $.physical and have
   *   item.location === this.
   */
  // Recover this if it has inadvertently become $.garbage.
  //
  // TODO(cpcallen): ideally validatate is non-overridable, and
  // everywhere that presently invokes $.physical.validate.call(x) can
  // just do x.validate() instead, and this line can go away.
  if ($.garbage.isPrototypeOf(this)) this.validate();
  if (!$.physical.isPrototypeOf(this)) {
    throw TypeError('$.physical.validate called on incompatible receiver');
  }
  // They can only be located in another $.physical object (or null)
  // and that object must have this in its contents:
  var loc = this.location;
  if ($.garbage.isPrototypeOf(loc)) loc.validate();
  if (!$.physical.isPrototypeOf(loc) ||
      ($.utils.validate.ownArray(loc, 'contents_'),  // N.B.: comma operator
       !loc.contents_.includes(this))) {
    this.location = null;
  }
  // this.contents_ must be an array unique to this (not inherited):
  $.utils.validate.ownArray(this, 'contents_');
  // this.contents_ must not contain any duplicates, non-$.physical
  // objects, objects not located in this:
  for (var i = this.contents_.length - 1; i >= 0; i--) {
    var item = this.contents_[i];
    if ($.garbage.isPrototypeOf(item)) item.validate();
    if (this.contents_.indexOf(item) !== i ||  // true for duplicates
        !$.physical.isPrototypeOf(item) ||
        item.location !== this) {
      this.contents_.splice(i, 1);
    }
  }
  // TODO: check for circular containment?
};
Object.setOwnerOf($.physical.validate, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.toString = function toString() {
  return this.name;
};
$.physical.toString.prototype.constructor = function toString() {
  var prototype = Object.getPrototypeOf(this);
  var pickFightOwner = (this.pickFight === prototype.pickFight) ?
      null : Object.getOwnerOf(this.pickFight);
  var proposeMateOwner = (this.proposeMate === prototype.proposeMate) ?
      null : Object.getOwnerOf(this.proposeMate);
  var acceptMateOwner = (this.acceptMate === prototype.acceptMate) ?
      null : Object.getOwnerOf(this.acceptMate);
  return this.name + ' (' + String(pickFightOwner) +
      '/' + String(proposeMateOwner) +
      '/' + String(acceptMateOwner) + ')';
};
$.physical.movable = function(dest) {
  // Returns true iff this is willing to move to dest.
  return false;
};
delete $.physical.movable.name;
$.physical.accept = function(what, src) {
  // Returns true iff this is willing to accept what arriving from src.
  //
  // This function should only be called by $.physical.moveTo()
  // immediately before actually performing a move.  It is OK if this
  // function (or its overrides) has some kind of observable
  // side-effect (making noise, causing some other action, etc.).
  //
  // Other code wanting to test if a move might succeed should call
  // .willAccept(what, src) instead.
  //
  // Throwing an error or suspending is equivalent to returning false.
  return this.willAccept(what, src);
};
delete $.physical.accept.name;
$.physical.accept.prototype.constructor = function(what, src) {
  // Returns true iff this is willing to accept what arriving from src.
  //
  // This function should only be called by $.physical.moveTo()
  // immediately before actually performing a move.  It is OK if this
  // function (or its overrides) has some kind of observable
  // side-effect (making noise, causing some other action, etc.).
  //
  // Other code wanting to test if a move might succeed should call
  // .acceptable(what, src) instead.
  return this.acceptable(what, src);
};
delete $.physical.accept.prototype.constructor.name;
$.physical.accept.prototype.constructor.prototype = $.physical.accept.prototype;
$.physical.willAccept = function(what, src) {
  // Returns true iff this is willing to accept what arriving from src.
  //
  // This function (or its overrides) MUST NOT have any kind of
  // observable side-effect (making noise, causing some other action,
  // etc.).
  return false;
};
delete $.physical.willAccept.name;
$.physical.onExit = function(what, dest) {
  // Called by $.physical.moveTo just before what leaves for dest.
};
delete $.physical.onExit.name;
$.physical.onEnter = function(what, src) {
  // Called by $.physical.moveTo just after what arrives from src.
};
delete $.physical.onEnter.name;
$.physical.lookAt = function lookAt(cmd) {
  this.look.call(this, cmd);
};
$.physical.lookAt.prototype.constructor = function lookAt(cmd) {
  this.look.call(this, cmd);
};
$.physical.lookAt.prototype.constructor.prototype = $.physical.lookAt.prototype;
$.physical.lookAt.verb = 'l(ook)?';
$.physical.lookAt.dobj = 'none';
$.physical.lookAt.prep = 'at/to';
$.physical.lookAt.iobj = 'this';
$.physical.kick = function kick(cmd) {
  cmd.user.narrate('You kick ' + String(this) + '.');
  if (cmd.user.location) {
    cmd.user.location.narrate(String(cmd.user) + ' kicks ' + String(this) + '.', cmd.user);
  }
  this.validate();
};
$.physical.kick.verb = 'kick';
$.physical.kick.dobj = 'this';
$.physical.kick.prep = 'none';
$.physical.kick.iobj = 'none';
$.physical.readMemo = function readMemo(memo) {
  // Deliver a memo to this object.
  //
  // A memo is an object that encodes a message about something that
  // can be seen or has just happened nearby.  Most usually they are
  // sent to the user's client (after being converted to JSON), but in
  // principle any $.physical object can receve a memo and potentially
  // react to it.
  //
  // Some example memos:
  //
  // A scene (simlified):
  // {type: 'scene', user: <the user>, where: <a room>,
  //  svgText: '<background image for room>',
  //  contents: [
  //    {type: 'user', what: <the user>, svgText: '<image of user>' },
  //    {type: 'thing', what: <a thing>, svgText: '<image of thing>'}
  //  ]}
  //
  // A narration:
  // {type: 'narrate', text: "A door appears!"}
  //
  // Someone says something:
  // {type: 'say', source: <a user>, where: <a room>, text: 'Hi.'}
  //
  // If you want to make an object react to memos (e.g., by responding
  // to things said to it), it is better to create an .onMemo method
  // rather than overriding .readMemo.
  if (this.onMemo) {
    new Thread(function readMemoDispatcher() {
      try {
        this.onMemo(memo)
      } catch (e) {
        suspend();
        if ($.room.isPrototypeOf(this.location)) {
          this.location.narrate(String(e) + '\n' + e.stack, undefined, this);
        } else {
          throw e;
        }
      }
    }, 0, this);
  }
};
$.physical.setName = function setName(name, tryAlternative) {
  /* Set the .name of this physical object.  If the desired name is
   * already in use and tryAlternative is true a similar name (like
   * "foo #2" or "foo #3") will be used instead; otherwise RangeError
   * will be thrown.
   *
   * name: string: the desired new name.
   * tryAlternative: boolean: try to find an alternative name.
   *
   * Returns the object's new name.
   */
  if (!$.physical.isPrototypeOf(this)) {
    throw new TypeError('must be called on a $.physical');
  } else if (typeof name !== 'string' || name.length < 1) {
    throw new TypeError('new name must be a non-empty string');
  }

  function check(name) {
    if (!(name in $.physicals)) return true;  // Name not in use.
    var oldObj = $.physicals[name];
    if (!$.physical.isPrototypeOf(oldObj) && $.physical !== oldObj) {
      delete $.physicals[name];
      return true;  // Name was in use but holder no longer a $.physical
    }
    return $.physicals[name] === this;  // Name in use, but maybe it's us?
  }

  if (!check.call(this, name)) {  // Desired name in use.
    if (!tryAlternative) throw new RangeError('there is already another object named ' + name);

    for (var i = 2; i < Object.getOwnPropertyNames($.physicals).length + 2; i++) {
      var proposed = name + ' #' + i;
      if (check.call(this, proposed)) {
        name = proposed;
        break;
      }
    }
  }
  // New name is not in use, or already ours.
  if (name !== this.name) {
    if (this.name in $.physicals && $.physicals[this.name] === this) {
      delete $.physicals[this.name];
    }
  }
  this.name = name;
  $.physicals[name] = this;
  new $.Selector(['$', 'physicals', name]).toValue(/*save:*/true);
  return name;
};
Object.setOwnerOf($.physical.setName, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.physical.setName.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.destroy = function destroy() {
  // TODO: add security check here!!

  // Remove from containment heirarchy.
  this.validate();
  var contents = this.getContents();
  for (var obj, i = 0; (obj = contents[i]); i++) {
    var dests = [this.location, obj.home, $.startRoom, null];
    for (i in dests) {
      var dest = dests[i];
      try {
        obj.moveTo(dest);
        break;
      } catch (e) {
        // Continue to try next dest.
      }
    }
    if (obj.location === this) obj.location = null;  // Sorry if you didn't want to go there.
  }
  try {
    this.moveTo(null);
  } catch (e) {
    this.location.removeContents(this);
  }

  var origProto = Object.getPrototypeOf(this);  // Note original protoype.
  Object.setPrototypeOf(this, $.garbage);  // Make it a non-$.physical
  if ($.physicals[this.name] === this) delete $.physicals[this.name];  // Free up name.
  // Delete as much data as possible.
  var names = Object.getOwnPropertyNames(this);
  for (i = 0; i < names.length; i++) {
    delete this[names[i]];
  }
  Object.setOwnerOf(this, null);  // Try to remove from owner's quota.

  // Save original prototype, so that $.physical.validate can reparent
  // children of this object.  (Ideally we'd do so now, but we can't
  // know which they are until we have an Object.getChildrenOf
  // function.
  this.proto = origProto;  // Record original prototype.
};
Object.setOwnerOf($.physical.destroy, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.rename = function rename(cmd) {
  try {
    var oldName = String(this);
    this.setName(cmd.iobjstr);
    cmd.user.narrate(oldName + ' renamed to ' + String(this));
  } catch (e) {
    throw e.message;
  }
};
Object.setOwnerOf($.physical.rename, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.physical.rename.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.rename.verb = 'rename';
$.physical.rename.dobj = 'this';
$.physical.rename.prep = 'at/to';
$.physical.rename.iobj = 'any';
$.physical.destroyVerb = function destroyVerb(cmd) {
  // Safety checks.
  if (!cmd.dobj === this) throw 'Not sure what you want to destroy.';
  var selector = $.Selector.for(this);
  if (selector && (selector[0] !== '$' || selector[1] !== 'physicals')) {
    throw String(this) + ' seems too well known: ' + selector.toString();
  }

  var name = String(this);
  this.destroy();
  cmd.user.narrate(name + ' destroyed.');
};
Object.setOwnerOf($.physical.destroyVerb, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.physical.destroyVerb.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.destroyVerb.verb = 'destroy';
$.physical.destroyVerb.dobj = 'this';
$.physical.destroyVerb.prep = 'none';
$.physical.destroyVerb.iobj = 'none';
$.physical.home = null;
$.physical.teleportTo = function teleport(dest, opt_neighbour) {
  /* Like moveTo, but with a bit more pizzazz.
   */
  if (this.location === dest) return;
  if ($.physical.isPrototypeOf(this.location)) {
    this.location.narrate(String(this) + ' vanishes into thin air.', this);
  }
  this.moveTo(dest, opt_neighbour);
  if ($.physical.isPrototypeOf(this.location)) {
    this.location.narrate(String(this) + ' appears out of thin air.', this);
  }
};
Object.setOwnerOf($.physical.teleportTo, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.physical.teleportTo.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.describe = function describe(cmd) {
  this.description = cmd.iobjstr;
  cmd.user.narrate($.utils.string.capitalize(String(this)) + '\'s description set to "' + this.description + '".');
};
Object.setOwnerOf($.physical.describe, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.physical.describe.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.describe.verb = 'describe';
$.physical.describe.dobj = 'this';
$.physical.describe.prep = 'as';
$.physical.describe.iobj = 'any';
$.physical.examine = function examine(cmd) {
  var html = examine.jssp.toString(this, {user: cmd.user});
  cmd.user.readMemo({type: "html", htmlText: html});
};
Object.setOwnerOf($.physical.examine, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.physical.examine.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.examine.verb = 'ex(amine)?';
$.physical.examine.dobj = 'this';
$.physical.examine.prep = 'none';
$.physical.examine.iobj = 'none';
// CLOSURE: type: function, vars: source, jssp
// CLOSURE: type: funexp, vars: Jssp
$.physical.examine.jssp = function jssp(request, response) {
  // DO NOT EDIT THIS CODE.  AUTOMATICALLY GENERATED BY JSSP.
  // To edit contents of generated page, edit this.source.
  return jssp.render(this, request, response);  // See $.Jssp for explanation.
};
Object.setPrototypeOf($.physical.examine.jssp, $.Jssp.prototype);
Object.setOwnerOf($.physical.examine.jssp, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.physical.examine.jssp.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.physical.examine.jssp.source = "<h1>\n  <svg width=\"32px\" height=\"32px\" viewBox=\"0 0 0 0\">\n    <%= this.getSvgText() %>\n  </svg>\n  <%= $.utils.html.escape(this.name) + $.utils.commandMenu(this.getCommands(request.user)) %>\n</h1>\nYou can:\n<ul>\n<%\n  for (var key in this) {\n    var method = this[key];\n    if (typeof method  !== 'function' || !method.verb) continue;\n    var command = method.verb.replace('|', '/');\n    if (method.dobj === 'this') {\n      command += ' ' + this.name;\n    } else if (method.dobj === 'any') {\n      command += ' &lt;any&gt;';\n    }\n    if (method.prep  !== 'none') {\n      command += ' ' + (method.prep === 'any' ? '&lt;any&gt;' : method.prep);\n      if (method.iobj === 'this') {\n        command += ' ' + this.name;\n      } else if (method.iobj === 'any') {\n        command += ' &lt;any&gt;';\n      }\n    }\n    response.write('<li>' + command + '</li>');\n  }\n%>\n</ul>";
$.physical.examine.jssp.hash_ = '6bb122e06f567f0b2cf2a8b18860e504v1.0.0';
$.physical.examine.jssp.compiled_ = function(request, response) {
// DO NOT EDIT THIS CODE: AUTOMATICALLY GENERATED BY JSSP.
response.write("<h1>\n  <svg width=\"32px\" height=\"32px\" viewBox=\"0 0 0 0\">\n    ");
response.write(this.getSvgText());
response.write("\n  </svg>\n  ");
response.write($.utils.html.escape(this.name) + $.utils.commandMenu(this.getCommands(request.user)));
response.write("\n</h1>\nYou can:\n<ul>\n");

  for (var key in this) {
    var method = this[key];
    if (typeof method  !== 'function' || !method.verb) continue;
    var command = method.verb.replace('|', '/');
    if (method.dobj === 'this') {
      command += ' ' + this.name;
    } else if (method.dobj === 'any') {
      command += ' &lt;any&gt;';
    }
    if (method.prep  !== 'none') {
      command += ' ' + (method.prep === 'any' ? '&lt;any&gt;' : method.prep);
      if (method.iobj === 'this') {
        command += ' ' + this.name;
      } else if (method.iobj === 'any') {
        command += ' &lt;any&gt;';
      }
    }
    response.write('<li>' + command + '</li>');
  }

response.write("\n</ul>");
};
Object.setOwnerOf($.physical.examine.jssp.compiled_, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.physical.examine.jssp.compiled_.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.defineProperty($.physical.examine.jssp.compiled_, 'name', {value: '$.physical.examine.jssp.compiled_'});

$.physicals = (new 'Object.create')(null);

$.physicals['Physical object prototype'] = $.physical;

$.utils.validate.physicals = function physicals(doSpider) {
  // First, make sure that $.physicals is plausible before we mess with it.
  var db = $.physicals;
  if (typeof db !== 'object' && Object.getPrototypeOf(db) === null) {
    throw new TypeError("$.physicals looks wrong");
  }
  for (var name in db) {
    var obj = db[name];
    if (!$.physical.isPrototypeOf(obj) && $.physical !== obj) {
      delete db[name];
      continue;
    }
    if (obj.name !== name) {
      delete $.physicals[name];
      obj.setName(obj.name, /*tryAlternative:*/ true);
    }
  }

  if (doSpider) {
    $.utils.object.spider($, function(obj) {
      if (!$.physical.isPrototypeOf(obj)) return false;  // Skip, but don't prune.
      obj.setName(obj.name, /*tryAlternative:*/ true);
    });
  }
};
Object.setOwnerOf($.utils.validate.physicals, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.utils.validate.physicals.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));

$.garbage = {};
$.garbage.toString = function toString() {
  return 'garbage';
};
Object.setOwnerOf($.garbage.toString, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.garbage.toString.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));
$.garbage.README = "We can't forcibly delete objects, so when we want to destroy an object (such as in $.physical.destroy), we do our best to delete obvious references to it (e.g. by deleting its entry in $.physicals and moving it to null), delete all properties on it, set its owner to null and set its prototype to this $.garbage, so that if other references to it are discovered later we know they should be deleted too.";
$.garbage.validate = function validate() {
  /* Fix the prototype of an object which now inherits from a
   * $.garbage object.
   *
   * Objects whose direct prototype is $.garbage are intentional
   * garbage and will not be resurrected in this way, but any other
   * descendents of $.garbage are assumed to be collateral damage from
   * $.physical.destroy and an effort is made to restore their
   * original prototype.  This may involve walking the prototype
   * chain, if their direct prototype's prototype is not $.garbage.
   *
   * Once a direct descendent of $.garbage is found, that's object's
   * .proto property is used as th its direct child's new prototype.
   */
  if (!$.garbage.isPrototypeOf(this)) {
    throw new TypeError('$.garbage.validate called on incompatible receiver');
  }
  var obj = this;
  var proto = Object.getPrototypeOf(obj);
  while (true) {
    var grandProto = Object.getPrototypeOf(proto);
    if (grandProto === $.garbage) {
      if (proto.hasOwnProperty('proto')) {
        Object.setPrototypeOf(obj, proto.proto);
        // Revalidate.  Only recursive in case of tiered garbage.
        this.validate();
      }
      return;
    }
    obj = proto;
    proto = grandProto;
  }
};
Object.setOwnerOf($.garbage.validate, Object.getOwnerOf($.Jssp.OutputBuffer));
Object.setOwnerOf($.garbage.validate.prototype, Object.getOwnerOf($.Jssp.OutputBuffer));

