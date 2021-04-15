/**
 * @license
 * Copyright 2020 Google LLC
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
 * @fileoverview Challenge room demo for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.physicals['Challenge room'] = (new 'Object.create')($.room);
Object.setOwnerOf($.physicals['Challenge room'], $.physicals.Neil);
$.physicals['Challenge room'].name = 'Challenge room';
$.physicals['Challenge room'].location = null;
$.physicals['Challenge room'].contents_ = [];
$.physicals['Challenge room'].contents_[0] = (new 'Object.create')($.thing);
$.physicals['Challenge room'].contents_[1] = (new 'Object.create')($.container);
$.physicals['Challenge room'].contents_[2] = (new 'Object.create')($.thing);
$.physicals['Challenge room'].contents_.forObj = $.physicals['Challenge room'];
Object.defineProperty($.physicals['Challenge room'].contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.physicals['Challenge room'].contents_.forKey = 'contents_';
Object.defineProperty($.physicals['Challenge room'].contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.physicals['Challenge room'].reset = function reset(cmd) {
  this.switch.state = false;
  this.switch.movable = true;
  this.switch.moveTo(this);
  this.switch.movable = false;

  for (var x = 0; x < 1000; x++) {
    this.safe.setOpen(true, x);
  }
  this.food.moveTo(this.safe);
  this.food.svgText = this.food.svgTextReset;
  this.safe.setOpen(false);
  this.safe.crack = this.safe.crackReset;

  this.chest.movable = true;
  this.chest.moveTo(this);
  this.chest.movable = false;
  this.chest.setOpen(true);
  this.safe.moveTo(this.chest);
  this.chest.setOpen(false);

  this.girl.movable = true;
  this.girl.moveTo(this);
  this.girl.movable = false;
  this.girl.attempts = 0;

  if (cmd) {
    this.sendScene(cmd.user, true);
    this.narrate(cmd.user.name + ' resets ' + String(this) + '.', cmd.user);
    cmd.user.narrate('You reset ' + String(this) + '.');
  }
};
Object.setOwnerOf($.physicals['Challenge room'].reset, $.physicals.Neil);
Object.setOwnerOf($.physicals['Challenge room'].reset.prototype, $.physicals.Neil);
$.physicals['Challenge room'].reset.verb = 'reset';
$.physicals['Challenge room'].reset.dobj = 'none';
$.physicals['Challenge room'].reset.prep = 'none';
$.physicals['Challenge room'].reset.iobj = 'none';
$.physicals['Challenge room'].chest = $.physicals['Challenge room'].contents_[1];
$.physicals['Challenge room'].safe = (new 'Object.create')($.container);
$.physicals['Challenge room'].girl = $.physicals['Challenge room'].contents_[2];
$.physicals['Challenge room'].food = (new 'Object.create')($.thing);
$.physicals['Challenge room'].switch = $.physicals['Challenge room'].contents_[0];
$.physicals['Challenge room'].svgTextNight = '<rect class="fillBlack strokeNone" height="100" width="2000" x="-1000" y="0"/>\n<line class="strokeWhite" x1="-1000" x2="1000" y1="90" y2="90"/>';
$.physicals['Challenge room'].getContents = function getContents() {
  $.physical.validate.call(this);
  if (this.switch.state) {
    return this.contents_.slice();
  } else {
    var contents = [];
    for (var i = 0, o; (o = this.contents_[i]); i++) {
      if (o === this.switch || $.user.isPrototypeOf(o)) {
        contents.push(o);
      }
    }
    return contents;
  }
};
Object.setOwnerOf($.physicals['Challenge room'].getContents, $.physicals.Neil);
$.physicals['Challenge room'].description = function description() {
  return this.switch.state ? 'Can you solve the challenge?' : 'It\'s dark in here.';
};
Object.setOwnerOf($.physicals['Challenge room'].description, $.physicals.Neil);
$.physicals['Challenge room'].svgTextDay = '<line x1="-1000" y1="90" x2="1000" y2="90" />';
$.physicals['Challenge room'].svgText = function svgText() {
  return this.switch.state ? this.svgTextDay : this.svgTextNight;
};
Object.setOwnerOf($.physicals['Challenge room'].svgText, $.physicals.Neil);

$.physicals['light switch'] = $.physicals['Challenge room'].switch;
Object.setOwnerOf($.physicals['light switch'], $.physicals.Neil);
$.physicals['light switch'].name = 'light switch';
$.physicals['light switch'].location = $.physicals['Challenge room'];
$.physicals['light switch'].contents_ = [];
$.physicals['light switch'].contents_.forObj = $.physicals['light switch'];
Object.defineProperty($.physicals['light switch'].contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.physicals['light switch'].contents_.forKey = 'contents_';
Object.defineProperty($.physicals['light switch'].contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.physicals['light switch'].svgText = function svgText() {
  return this.state ? this.svgTextDay : this.svgTextNight;
};
Object.setOwnerOf($.physicals['light switch'].svgText, $.physicals.Neil);
Object.setOwnerOf($.physicals['light switch'].svgText.prototype, $.physicals.Maximilian);
$.physicals['light switch'].state = false;
$.physicals['light switch'].flip = function flip(newState, user) {
  var onOff = newState ? 'on' : 'off';
  if (this.state === newState) {
    user.narrate('The switch is already ' + onOff + '.');
  } else {
    this.state = newState;
    this.home.updateScene(true);
    user.narrate('You turn ' + onOff + ' the switch.');
    this.home.narrate(String(user) + ' turns ' + onOff + ' the switch.', user);
  }
};
Object.setOwnerOf($.physicals['light switch'].flip, $.physicals.Neil);
Object.setOwnerOf($.physicals['light switch'].flip.prototype, $.physicals.Neil);
$.physicals['light switch'].flipOn1 = function flipOn1(cmd) {
  this.flip(true, cmd.user);
};
Object.setOwnerOf($.physicals['light switch'].flipOn1, $.physicals.Maximilian);
Object.setOwnerOf($.physicals['light switch'].flipOn1.prototype, $.physicals.Maximilian);
$.physicals['light switch'].flipOn1.verb = 'flip|turn|switch';
$.physicals['light switch'].flipOn1.dobj = 'this';
$.physicals['light switch'].flipOn1.prep = 'on top of/on/onto/upon';
$.physicals['light switch'].flipOn1.iobj = 'none';
$.physicals['light switch'].flipOn2 = function flipOn2(cmd) {
  this.flip(true, cmd.user);
};
Object.setOwnerOf($.physicals['light switch'].flipOn2, $.physicals.Maximilian);
Object.setOwnerOf($.physicals['light switch'].flipOn2.prototype, $.physicals.Maximilian);
$.physicals['light switch'].flipOn2.verb = 'flip|turn|switch';
$.physicals['light switch'].flipOn2.dobj = 'none';
$.physicals['light switch'].flipOn2.prep = 'on top of/on/onto/upon';
$.physicals['light switch'].flipOn2.iobj = 'this';
$.physicals['light switch'].flipOff2 = function flipOff2(cmd) {
  this.flip(false, cmd.user);
};
Object.setOwnerOf($.physicals['light switch'].flipOff2, $.physicals.Maximilian);
Object.setOwnerOf($.physicals['light switch'].flipOff2.prototype, $.physicals.Maximilian);
$.physicals['light switch'].flipOff2.verb = 'flip|turn|switch';
$.physicals['light switch'].flipOff2.dobj = 'none';
$.physicals['light switch'].flipOff2.prep = 'off/off of';
$.physicals['light switch'].flipOff2.iobj = 'this';
$.physicals['light switch'].flipOff1 = function flipOff1(cmd) {
  this.flip(false, cmd.user);
};
Object.setOwnerOf($.physicals['light switch'].flipOff1, $.physicals.Maximilian);
Object.setOwnerOf($.physicals['light switch'].flipOff1.prototype, $.physicals.Maximilian);
$.physicals['light switch'].flipOff1.verb = 'flip|turn|switch';
$.physicals['light switch'].flipOff1.dobj = 'this';
$.physicals['light switch'].flipOff1.prep = 'off/off of';
$.physicals['light switch'].flipOff1.iobj = 'none';
$.physicals['light switch'].home = $.physicals['Challenge room'];
$.physicals['light switch'].svgTextNight = '<g transform="scale(0.7) translate(0, 20)">\n  <rect class="fillGrey" height="25" width="15" x="0" y="30"/>\n  <rect class="strokeWhite" height="12" width="7" x="4" y="36.5"/>\n  <rect class="strokeBlack fillBlack" height="5" width="5" x="5" y="42.5"/>\n</g>';
$.physicals['light switch'].getCommands = function getCommands(who) {
  var commands = $.thing.getCommands.call(this, who);
  if (this.state) {
    commands.push('turn off ' + String(this));
  } else {
    commands.push('turn on ' + String(this));
  }
  return commands;
};
Object.setOwnerOf($.physicals['light switch'].getCommands, $.physicals.Neil);
Object.setOwnerOf($.physicals['light switch'].getCommands.prototype, $.physicals.Maximilian);
$.physicals['light switch'].aliases = [];
Object.setOwnerOf($.physicals['light switch'].aliases, $.physicals.Maximilian);
$.physicals['light switch'].aliases[0] = 'lightswitch';
$.physicals['light switch'].aliases[1] = 'switch';
$.physicals['light switch'].movable = false;
$.physicals['light switch'].svgTextDay = '<g transform="scale(0.7) translate(0, 20)">\n<rect class="fillWhite" height="25" width="15" x="0" y="30"/>\n<rect class="strokeGrey" height="12" width="7" x="4" y="36.5"/>\n<rect class="strokeBlack fillBlack" height="5" width="5" x="5" y="37.5"/>\n</g>';

$.physicals.chest = $.physicals['Challenge room'].chest;
Object.setOwnerOf($.physicals.chest, $.physicals.Neil);
$.physicals.chest.name = 'chest';
$.physicals.chest.location = $.physicals['Challenge room'];
$.physicals.chest.contents_ = [];
$.physicals.chest.contents_[0] = $.physicals.chest.location.safe;
$.physicals.chest.contents_.forObj = $.physicals.chest;
Object.defineProperty($.physicals.chest.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.physicals.chest.contents_.forKey = 'contents_';
Object.defineProperty($.physicals.chest.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.physicals.chest.svgTextClosed = '<path class="fillWhite" d="m8.78171,99.14543l12.33676,-7.40208l0,-26.08348l-12.33676,7.40204l0,26.08352z"/>\n<rect class="fillWhite" height="26.08352" width="42.65004" x="-33.86834" y="73.06191"/>\n<path class="fillWhite" d="m8.78171,73.06191c0.012,-5.65236 4.56828,-12.11368 8.04808,-12.25748l-42.65004,0c-3.47988,0.14376 -8.03608,6.60512 -8.04808,12.25748l42.65004,0z"/>\n<path class="fillWhite" d="m8.78171,73.06191c0.012,-5.65236 4.56828,-12.11368 8.04808,-12.25748c2.01644,-0.08336 4.22136,-0.01604 4.28868,4.85544l-12.33676,7.40204z"/>\n<rect class="fillWhite" height="7.30404" width="5.35632" x="-15.22148" y="70.20479"/>\n';
$.physicals.chest.svgTextOpen = '<rect class="fillGrey" height="26.08352" width="42.65004" x="-31.15279" y="65.38134"/>\n<path class="fillWhite" d="m-0.83951,98.86694l12.33676,-7.40208l0,-26.08348l-12.33676,7.40208l0,26.08348z"/>\n<path class="fillGrey" d="m-43.48955,72.78346l12.33676,-7.40208l0,26.08348l-12.33676,7.40208l0,-26.08348z"/>\n<path class="fillGrey" d="m-31.15279,65.38134l42.65004,0m0,0l-10.5744,-17.624l-42.65004,0l10.5744,17.624"/>\n<path class="fillWhite" d="m0.92285,47.75738c11.34116,-0.37904 15.45816,10.68644 10.5744,17.624l-10.5744,-17.624z"/>\n<path class="fillGrey" d="m-41.72719,47.75738c11.34116,-0.37904 15.45816,10.68644 10.5744,17.624l-10.5744,-17.624z"/>\n<rect class="fillWhite" height="26.08352" width="42.65004" x="-43.48956" y="72.78346"/>\n';
$.physicals.chest.isOpen = false;
$.physicals.chest.description = 'A steamer chest with a very heavy lid.';
$.physicals.chest.TIME = 5000;
$.physicals.chest.lastTime_ = 1597444509970;
$.physicals.chest.lastUser_ = $.physicals.Neil;
$.physicals.chest.open = function open(cmd) {
  if (this.isOpen) {
    cmd.user.narrate($.utils.string.capitalize(String(cmd.dobj)) + ' is already open.');
    return;
  }
  if (this.location !== cmd.user.location && this.location !== cmd.user) {
    cmd.user.narrate($.utils.string.capitalize(String(cmd.dobj)) + ' is not here.');
    return;
  }
  if (this.lastUser_ === cmd.user || this.lastTime_ + this.TIME < Date.now()) {
    cmd.user.narrate('You try to open the chest, but the lid is too heavy for one person.');
    if (cmd.user.location) {
      cmd.user.location.narrate(String(cmd.user) + ' tries to open the chest, but the lid is too heavy for one person.', cmd.user);
    }
    this.lastUser_ = cmd.user;
    this.lastTime_ = Date.now();
    return;
  }
  if (!this.setOpen(true)) {
    cmd.user.narrate('You can\'t open ' + String(cmd.dobj));
    return;
  }
  if (cmd.user.location) {
    cmd.user.location.narrate(String(cmd.user) + ' helps ' + String(this.lastUser_.name) + ' to opens ' + String(cmd.dobj) + '.', cmd.user);
  }
  cmd.user.narrate('You help ' + String(this.lastUser_) + ' to open ' + String(cmd.dobj) + '.');
  this.look(cmd);
  this.lastUser_ = null;
  this.lastTime_ = 0;
};
Object.setOwnerOf($.physicals.chest.open, $.physicals.Neil);
Object.setOwnerOf($.physicals.chest.open.prototype, $.physicals.Maximilian);
$.physicals.chest.open.verb = 'open';
$.physicals.chest.open.dobj = 'this';
$.physicals.chest.open.prep = 'none';
$.physicals.chest.open.iobj = 'none';
$.physicals.chest.movable = false;
$.physicals.chest.toFloor = true;
$.physicals.chest.setOpen = function setOpen(newState) {
  this.isOpen = Boolean(newState);
  if ($.room.isPrototypeOf(this.location)) {
    this.location.updateScene(true);
  }
  return true;
};
Object.setOwnerOf($.physicals.chest.setOpen, $.physicals.Neil);
Object.setOwnerOf($.physicals.chest.setOpen.prototype, $.physicals.Maximilian);

$.physicals.safe = $.physicals.chest.location.safe;
Object.setOwnerOf($.physicals.safe, $.physicals.Neil);
$.physicals.safe.name = 'safe';
$.physicals.safe.location = $.physicals.chest;
$.physicals.safe.contents_ = [];
$.physicals.safe.contents_[0] = $.physicals.chest.location.food;
$.physicals.safe.contents_.forObj = $.physicals.safe;
Object.defineProperty($.physicals.safe.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.physicals.safe.contents_.forKey = 'contents_';
Object.defineProperty($.physicals.safe.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.physicals.safe.isOpen = false;
$.physicals.safe.description = 'The safe is secured with a three digit combination: open safe with xxx';
$.physicals.safe.open = function open(cmd) {
  cmd.user.narrate('You need a three-digit combination to open the safe:  open ' + String(cmd.dobj) + ' with xxx');
};
Object.setOwnerOf($.physicals.safe.open, $.physicals.Maximilian);
Object.setOwnerOf($.physicals.safe.open.prototype, $.physicals.Maximilian);
$.physicals.safe.open.verb = 'open';
$.physicals.safe.open.dobj = 'this';
$.physicals.safe.open.prep = 'none';
$.physicals.safe.open.iobj = 'none';
$.physicals.safe.openWith = function openWith(cmd) {
  if (this.isOpen) {
    cmd.user.narrate($.utils.string.capitalize(String(cmd.dobj)) + ' is already open.');
    return;
  }
  if (this.location !== cmd.user.location && this.location !== cmd.user) {
    cmd.user.narrate($.utils.string.capitalize(String(cmd.dobj)) + ' is not here.');
    return;
  }
  if (!this.setOpen(true, cmd.iobjstr)) {
    cmd.user.narrate('"' + cmd.iobjstr + '" is not the correct combination.');
    return;
  }
  if (cmd.user.location) {
    cmd.user.location.narrate(cmd.user.name + ' opens ' + String(cmd.dobj) + '.', cmd.user);
  }
  cmd.user.narrate('You open ' + String(cmd.dobj) + '.');
  this.look(cmd);
};
Object.setOwnerOf($.physicals.safe.openWith, $.physicals.Maximilian);
Object.setOwnerOf($.physicals.safe.openWith.prototype, $.physicals.Maximilian);
$.physicals.safe.openWith.verb = 'open';
$.physicals.safe.openWith.dobj = 'this';
$.physicals.safe.openWith.prep = 'with/using';
$.physicals.safe.openWith.iobj = 'any';
$.physicals.safe.setOpen = function setOpen(newState, combo) {
  if (newState && this.combo !== $.utils.string.hash('md5', String(combo))) {
    return false;
  }
  return $.container.setOpen.call(this, newState);
};
Object.setOwnerOf($.physicals.safe.setOpen, $.physicals.Neil);
Object.setOwnerOf($.physicals.safe.setOpen.prototype, $.physicals.Maximilian);
$.physicals.safe.combo = 'e94550c93cd70fe748e6982b3439ad3b';
$.physicals.safe.svgTextClosed = '<path class="fillWhite" d="m0,80l10,-10l20,0l0,20l-10,10"/>\n<line x1="20" x2="30" y1="80" y2="70"/>\n<rect class="fillWhite" height="20" width="20" x="0" y="80"/>\n<circle class="fillWhite" cx="10" cy="90" fill-opacity="null" r="4"/>\n<circle class="fillWhite" cx="10" cy="90" fill-opacity="null" r="2"/>';
$.physicals.safe.svgTextOpen = '<rect class="fillGrey" height="20" width="20" x="0" y="65"/>\n<path class="fillGrey" d="m0,85l-10,10l0,-20l10,-10l0,20z"/>\n<path class="fillWhite" d="m0,65l-10,10l20,0l10,-10l-20,0z"/>\n<path class="fillGrey" d="m0,85l-10,10l20,0l10,-10l-20,0z"/>\n<path class="fillWhite" d="m20,85l-10,10l0,-20l10,-10l0,20z"/>\n<path class="fillWhite" d="m-10,95l-12.5,4.5l0,-20l12.5,-4.5l0,20z"/>';
$.physicals.safe.getCommands = function getCommands(who) {
  var commands = $.container.getCommands.call(this, who);
  commands.push('crack ' + String(this));
  return commands;
};
Object.setOwnerOf($.physicals.safe.getCommands, $.physicals.Neil);
Object.setOwnerOf($.physicals.safe.getCommands.prototype, $.physicals.Maximilian);
$.physicals.safe.crack = function crack(cmd) {
  cmd.user.narrate('The "crack" function has not been programmed.  ' +
     'To do so, visit: https://google.codecity.world/blocklySafe');
  // API information: To open the safe with combo 123, use:
  //   this.setOpen(true, 123);
  // Have fun!

};
Object.setOwnerOf($.physicals.safe.crack, $.physicals.Neil);
Object.setOwnerOf($.physicals.safe.crack.prototype, $.physicals.Neil);
$.physicals.safe.crack.verb = 'crack';
$.physicals.safe.crack.dobj = 'this';
$.physicals.safe.crack.prep = 'none';
$.physicals.safe.crack.iobj = 'none';
$.physicals.safe.crackReset = $.physicals.safe.crack;
$.physicals.safe.toFloor = true;

$.physicals.food = $.physicals.chest.location.food;
Object.setOwnerOf($.physicals.food, $.physicals.Neil);
$.physicals.food.name = 'food';
$.physicals.food.location = $.physicals.safe;
$.physicals.food.contents_ = [];
$.physicals.food.contents_.forObj = $.physicals.food;
Object.defineProperty($.physicals.food.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.physicals.food.contents_.forKey = 'contents_';
Object.defineProperty($.physicals.food.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.physicals.food.svgText = '<path d="M-7,80L-5,97C-5,100.5,5,100.5,5,97L7,80" class="fillWhite"/>\n<ellipse class="fillWhite" cx="0" cy="80" rx="7" ry="3"/>\n';
$.physicals.food.give = function give(cmd) {
  if (cmd.iobj !== this.girl) {
    return $.thing.give.call(this, cmd);
  }
  if (this.location !== cmd.user && this.location !== cmd.user.location) {
    cmd.user.narrate("You can't reach " + String(this) + ".");
    return;
  }

  cmd.user.narrate('You offer ' + String(this) + ' to ' + String(cmd.iobj) + '.');
  if (cmd.user.location) {
    cmd.user.location.narrate(
        String(cmd.user) + ' offers ' + String(this) + ' to ' + String(cmd.iobj) + '.',
        [cmd.user, cmd.iobj]);
  }
  var matches = $.utils.imageMatch.recog($.utils.object.getValue(this, 'svgText'));
  var ok = this.girl.foodList.includes(matches[0]);
  if (!ok) {
    this.girl.attempts++;
  }

  var name = matches[0] || 'nothing I\'ve ever seen before.';
  suspend(1);

  var text = 'It looks like a ' + name + '; ' +
      (ok ? 'delicious!'
       : (this.girl.attempts < 3 ?
          'I won\'t eat that!' :
          (Math.random() >= 0.5 ?
           'that won\'t keep the doctor away!' : 'some fruit would be nice!'
          )
         )
      );

  var alt = 'The girl says, "' + text +'"';
  var memo = {
    type: 'say',
    source: this.girl,
    where: this.girl.location,
    text: text,
    alt: alt
  };
  this.girl.location.sendMemo(memo);
  if (ok) {
    suspend(10);
    memo.text = 'Thank you so much.  Congratulations on solving the challenge room.  Don\'t forget to turn out the light when you leave.';
    memo.alt = 'The girl says, "' + text + '"';
    this.girl.location.sendMemo(memo);
  }
};
Object.setOwnerOf($.physicals.food.give, $.physicals.Neil);
Object.setOwnerOf($.physicals.food.give.prototype, $.physicals.Maximilian);
$.physicals.food.give.verb = 'give';
$.physicals.food.give.dobj = 'this';
$.physicals.food.give.prep = 'at/to';
$.physicals.food.give.iobj = 'any';
$.physicals.food.girl = $.physicals.chest.location.girl;
$.physicals.food.redraw = function inspect(cmd) {
  // Open this object in the SVG editor.
  var selector = $.Selector.for(this);
  if (!selector) {
    cmd.user.narrate('Unfortuantely the code editor does not know how to locate ' + String(this) + ' yet.');
    return;
  }
  var link = '/code?' + encodeURIComponent(String(selector) + '.svgText');
  cmd.user.readMemo({type: "link", href: link});
};
Object.setOwnerOf($.physicals.food.redraw, $.physicals.Neil);
Object.setOwnerOf($.physicals.food.redraw.prototype, $.physicals.Neil);
$.physicals.food.redraw.verb = 'redraw';
$.physicals.food.redraw.dobj = 'this';
$.physicals.food.redraw.prep = 'none';
$.physicals.food.redraw.iobj = 'none';
$.physicals.food.getCommands = function getCommands(who) {
  var commands = $.thing.getCommands.call(this, who);
  commands.push('redraw ' + this.name);
  commands.push('give ' + this.name + ' to girl');
  return commands;
};
Object.setOwnerOf($.physicals.food.getCommands, $.physicals.Neil);
Object.setOwnerOf($.physicals.food.getCommands.prototype, $.physicals.Maximilian);
$.physicals.food.svgTextReset = '<path d="M-7,80L-5,97C-5,100.5,5,100.5,5,97L7,80" class="fillWhite"/>\n<ellipse class="fillWhite" cx="0" cy="80" rx="7" ry="3"/>\n';

$.physicals.girl = $.physicals.food.girl;
Object.setOwnerOf($.physicals.girl, $.physicals.Neil);
$.physicals.girl.name = 'girl';
$.physicals.girl.location = $.physicals.chest.location;
$.physicals.girl.contents_ = [];
$.physicals.girl.contents_.forObj = $.physicals.girl;
Object.defineProperty($.physicals.girl.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.physicals.girl.contents_.forKey = 'contents_';
Object.defineProperty($.physicals.girl.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.physicals.girl.description = 'She looks REALLY hungry.';
$.physicals.girl.svgText = '    <path class="strokeBlack fillWhite" d="m2.453,58.76115c0.73095,3.31014 -2.35649,7.10927 -5.354,8.76109c-3.17381,1.74899 -7.60044,1.39996 -10.87024,-0.16224c-3.89018,-1.8586 -4.25816,-7.46777 -1.78467,-11.27585c4.68192,-6.68127 17.99054,-3.7308 18.00891,2.677z"/>\n    <path class="strokeBlack" d="m-16.09721,99.2163c3.36481,-7.19263 6.5246,-13.66499 10.11895,-18.35067"/>\n    <path class="strokeBlack" d="m-0.44477,99.64677c-9.09273,-22.01297 -4.01634,-23.24778 -4.74121,-31.69803"/>\n    <path class="strokeBlack" d="m-13.91994,82.09774c2.68081,-3.84038 5.03799,-6.45099 8.73396,-14.149"/>\n    <path class="strokeBlack" d="m0.06683,83.05226c-1.60238,-5.21011 -3.01935,-10.5245 -5.25281,-15.10352"/>\n    <path d="m-14.01461,54.54284c0.75415,1.15486 2.0631,1.98765 3.24485,2.67701c0.47974,0.27984 0.94301,0.68546 1.46019,0.89233c0.31757,0.12703 0.65772,0.19293 0.97345,0.32448c1.07714,0.44881 2.08283,1.16779 3.24485,1.37907c0.13302,0.02418 0.27123,-0.01492 0.40561,0c0.38566,0.04285 0.77922,0.24336 1.13569,0.24336"/>\n    <path d="m-5.9836,52.51481c0.74483,-0.31304 1.53299,-0.30212 2.27139,-0.48672c0.15429,-0.03857 0.42557,0.07114 0.56785,0c0.12707,-0.06354 0.48109,-0.16506 0.64897,-0.08112c0.14832,0.07416 0.35064,0.22242 0.48673,0.32448c0.43016,0.32262 0.44211,0.88422 0.64897,1.29794c0.03303,0.06607 0.08112,0.58378 0.08112,0.40561"/>\n    <path d="m1.31731,62.33048c0.43264,0.45969 1.2145,0.75334 1.29794,1.37906c0.06323,0.4742 -0.6672,0.68707 -0.97346,1.05458c-0.10094,0.12113 -0.18125,0.26068 -0.24336,0.40561c-0.29413,0.68629 1.28191,-0.86126 1.05457,0.73009c-0.06209,0.43463 -0.21269,0.45803 -0.16224,0.81121c0.03529,0.24702 0.29281,0.64509 0.24336,0.89233c-0.06369,0.31844 -0.29802,0.38001 -0.4056,0.64897c-0.09622,0.24055 0.10639,0.37236 0.16224,0.56785c0.06686,0.234 0.04773,0.49145 0,0.73009c-0.02668,0.13339 -0.264,0.52658 -0.16224,0.73009c0.15102,0.30205 0.24336,0.5276 0.24336,0.89234"/>\n    <path d="m-0.224,64.03403c-0.10816,1.5413 -0.35309,3.07908 -0.32448,4.62391c0.0054,0.28999 0.79206,-0.74774 0.97345,-0.32448c0.06479,0.15118 0.0122,0.33738 0.08112,0.48672c0.26892,0.58265 0.56113,0.66686 1.05458,1.05458c0.16606,0.13048 0.35707,0.2389 0.48672,0.40561c0.39433,0.50698 -0.33175,0.90203 -0.56784,1.21681c-0.01622,0.02164 0.01913,0.062 0,0.08112c-0.01913,0.01913 -0.10574,0.01119 -0.08112,0c0.32001,-0.14546 0.64897,-0.2704 0.97345,-0.4056"/>\n    <path d="m-12.31106,54.3806c0.10816,0.78417 0.15276,1.57977 0.32448,2.35252c0.14503,0.65262 0.78935,1.03271 1.21682,1.46018c0.89247,0.89247 1.60741,2.10315 2.83925,2.59588c0.52708,0.21083 1.08387,0.32516 1.62242,0.48673c0.13948,0.04184 0.26282,0.13368 0.40561,0.16224c0.208,0.0416 0.44096,-0.0416 0.64897,0c0.05929,0.01185 0.1026,0.07118 0.16224,0.08112c0.74304,0.12384 1.98436,-0.17316 2.677,0c0.2974,0.07435 0.57553,0.24336 0.89233,0.24336"/>\n    <path d="m-9.55294,52.59594c0.84943,1.18919 1.80426,3.05911 3.16373,4.05606c0.63617,0.46652 1.49601,0.62632 2.19027,0.97345c0.5421,0.27105 1.04109,0.69855 1.62243,0.89234c0.1308,0.0436 0.2748,0.03752 0.40561,0.08112c0.02837,0.0095 1.28554,0.55545 1.29793,0.56784c0.01913,0.01913 -0.02704,0.08112 0,0.08112c0.02704,0 0,-0.05408 0,-0.08112"/>\n    <path d="m-5.9836,52.51481c1.12593,1.36843 2.49316,2.58149 3.97494,3.56934c0.48793,0.32528 1.36995,0.8021 1.78466,1.21682c0.33582,0.33581 0.60781,0.77004 0.89234,1.05457"/>\n    <path d="m-11.33761,53.08266c1.71049,2.44802 3.93723,3.65235 6.24634,5.19176c0.14712,0.09808 1.56809,1.18927 1.62242,1.29794c0.02418,0.04837 -0.03824,0.124 0,0.16224c0.08847,0.08847 0.28927,0.20814 0.40561,0.32449c0.05408,0.05408 0.23796,0.17306 0.16224,0.16224c-0.22074,-0.03153 -0.43264,-0.10816 -0.64897,-0.16224"/>\n    <path d="m-10.73298,52.87959c0.89005,0.11134 1.65855,0.54411 2.35602,0.91623c0.73717,0.3933 1.519,0.72961 2.19895,1.28272c0.68926,0.56068 1.27485,1.23876 1.88482,1.88482c0.62557,0.66258 0.9644,1.39162 1.58189,1.95096l0.35249,0.66021l0.56998,0.67853"/>\n    <path d="m-11.51833,53.9267c0.31414,0.81536 1.01217,1.3372 1.71972,1.88482c0.68395,0.52935 1.34166,1.11774 2.10227,1.52496c0.75403,0.40369 1.63512,0.53793 2.48691,0.83665c0.81962,0.28743 1.57976,0.69046 2.35602,0.98922c0.79129,0.30455 1.49215,0.80729 2.34363,1.06204l0.58412,0.50859"/>\n    <path d="m-7.32985,52.6178c0.99476,0.3637 1.84934,0.61397 2.46191,1.13805c0.72862,0.62335 1.26086,1.25095 1.83128,1.95759c0.56185,0.69602 0.9057,1.57104 1.36405,2.29703c0.4745,0.75157 0.87135,1.49733 0.88726,2.35602c0.01697,0.91607 -0.45528,1.8844 0.00118,2.70755c0.39036,0.70396 1.73213,0.62234 2.07072,1.39856c0.35303,0.80931 -0.24322,1.61348 -0.62666,2.41222c-0.3626,0.75533 -0.23298,1.59712 0.13922,2.23891c0.41908,0.72262 0.24799,1.68778 -0.17086,2.24032l-0.36645,0.42164"/>\n    <path d="m-4.18849,53.14136c1.04712,0.30541 1.68764,0.85101 2.43455,1.38744c0.69793,0.50125 1.39936,1.12401 1.49215,1.95497c0.10322,0.92445 0.05804,1.80531 0,2.70855c-0.05579,0.86819 -0.58125,1.83307 -0.20942,2.30401c0.54283,0.68753 1.93388,0.40047 2.29424,1.17382c0.37992,0.81533 -0.14714,1.82877 -0.77592,2.46946c-0.60234,0.61375 -1.59314,0.68797 -2.20663,1.30017c-0.51848,0.51739 0.27888,1.25655 1.02862,1.75938l0.41501,0.67133l0.23944,0.80663l0,0.8726"/>\n    <path d="m-8.11519,53.66492c1.07749,0 1.99914,0.03017 2.75415,0.39812c0.79851,0.38915 1.5245,0.88042 2.20589,1.42055c0.66151,0.52436 1.28744,1.11145 1.90419,1.55266c0.68114,0.48727 1.46063,0.84077 1.77334,1.51017c0.3778,0.80873 -0.04902,1.79345 0.26414,2.54066c0.28977,0.6914 0.73924,1.32269 0.9346,2.16178c0.20276,0.87092 -0.41037,1.95579 0.11134,2.6274c0.28441,0.36613 0.90021,0.90364 1.03216,1.74153c0.13587,0.86279 0.01492,1.78007 -0.41627,2.46191l-0.3541,0.69324l0,0.87627"/>\n    <path d="m-10.73299,53.9267c1.07714,0 1.96335,0 2.87958,0c0.87627,0 1.65156,0.3908 2.43338,0.52356c0.88278,0.14991 1.795,-0.15591 2.67134,0c0.74723,0.13295 1.48342,0.52356 2.31863,0.61588l0.69184,0.39943"/>\n    <path d="m-10.99477,54.45026c0.91623,0 1.79642,-0.13239 2.69633,0c0.79007,0.11623 1.67562,0.02064 2.53927,0.26178c0.76641,0.21399 1.41629,0.85779 2.0199,1.33124c0.61388,0.48152 1.47675,0.50122 2.35567,0.50122c0.91802,0 1.83448,-0.05702 2.43617,0.39267c0.55872,0.41758 0.51811,1.34747 0.51811,2.2401c0,0.88172 0.34046,1.55133 0.74171,2.29742c0.38559,0.71698 0.56579,1.50296 0.56719,2.41344c0.0013,0.84869 0,1.76632 0,2.65637c0,0.89005 0,1.78011 0,2.66737l0.22997,0.68342"/>\n    <path d="m-12.30367,54.71204c0.51693,0.63491 1.08044,1.19886 1.58565,1.74014c0.52846,0.5662 0.98368,1.23125 1.56235,1.81344c0.59642,0.60005 1.25942,1.18218 1.93717,1.42024c0.85293,0.29959 1.6166,0.34467 2.30262,0.52356c0.81872,0.2135 1.74605,0.10109 2.42897,0.52356c0.64377,0.39825 1.26623,1.01143 1.43861,1.75511c0.2007,0.86587 -0.00998,1.77671 -0.16828,2.60284c-0.16169,0.84379 -0.51695,1.63445 -0.3541,2.50628c0.13298,0.71191 0.52321,1.43839 0.6349,2.28866l0.19407,0.75114l0.40558,0.56718l0.33613,0.61588"/>\n';
$.physicals.girl.get = function get(cmd) {
  cmd.user.narrate('That\'s probably not appropriate.');
  if (cmd.user.location) {
    cmd.user.location.narrate(String(cmd.user) + ' tries to pick up ' + String(this) + '.', cmd.user);
  }
};
Object.setOwnerOf($.physicals.girl.get, $.physicals.Neil);
Object.setOwnerOf($.physicals.girl.get.prototype, $.physicals.Maximilian);
$.physicals.girl.get.verb = 'get|take';
$.physicals.girl.get.dobj = 'this';
$.physicals.girl.get.prep = 'none';
$.physicals.girl.get.iobj = 'none';
$.physicals.girl.food = $.physicals.food;
$.physicals.girl.foodList = [];
$.physicals.girl.foodList[0] = 'Açaí';
$.physicals.girl.foodList[1] = 'Ackee';
$.physicals.girl.foodList[2] = 'Apple';
$.physicals.girl.foodList[3] = 'Apricot';
$.physicals.girl.foodList[4] = 'Avocado';
$.physicals.girl.foodList[5] = 'Banana';
$.physicals.girl.foodList[6] = 'Bilberry';
$.physicals.girl.foodList[7] = 'Blackberry';
$.physicals.girl.foodList[8] = 'Blackcurrant';
$.physicals.girl.foodList[9] = 'Black sapote';
$.physicals.girl.foodList[10] = 'Blueberry';
$.physicals.girl.foodList[11] = 'Boysenberry';
$.physicals.girl.foodList[12] = 'Breadfruit';
$.physicals.girl.foodList[13] = "Buddha's hand";
$.physicals.girl.foodList[14] = 'Cactus pear';
$.physicals.girl.foodList[15] = 'Crab apple';
$.physicals.girl.foodList[16] = 'Currant';
$.physicals.girl.foodList[17] = 'Cherry';
$.physicals.girl.foodList[18] = 'Cherimoya';
$.physicals.girl.foodList[19] = 'Chico fruit';
$.physicals.girl.foodList[20] = 'Cloudberry';
$.physicals.girl.foodList[21] = 'Coconut';
$.physicals.girl.foodList[22] = 'Cranberry';
$.physicals.girl.foodList[23] = 'Damson';
$.physicals.girl.foodList[24] = 'Date';
$.physicals.girl.foodList[25] = 'Dragonfruit';
$.physicals.girl.foodList[26] = 'Durian';
$.physicals.girl.foodList[27] = 'Elderberry';
$.physicals.girl.foodList[28] = 'Feijoa';
$.physicals.girl.foodList[29] = 'Fig';
$.physicals.girl.foodList[30] = 'Goji berry';
$.physicals.girl.foodList[31] = 'Gooseberry';
$.physicals.girl.foodList[32] = 'Grape';
$.physicals.girl.foodList[33] = 'Grewia asiatica';
$.physicals.girl.foodList[34] = 'Raisin';
$.physicals.girl.foodList[35] = 'Grapefruit';
$.physicals.girl.foodList[36] = 'Guava';
$.physicals.girl.foodList[37] = 'Hala Fruit';
$.physicals.girl.foodList[38] = 'Honeyberry';
$.physicals.girl.foodList[39] = 'Huckleberry';
$.physicals.girl.foodList[40] = 'Jabuticaba';
$.physicals.girl.foodList[41] = 'Jackfruit';
$.physicals.girl.foodList[42] = 'Jambul';
$.physicals.girl.foodList[43] = 'Japanese plum';
$.physicals.girl.foodList[44] = 'Jostaberry';
$.physicals.girl.foodList[45] = 'Jujube';
$.physicals.girl.foodList[46] = 'Juniper berry';
$.physicals.girl.foodList[47] = 'Kiwano';
$.physicals.girl.foodList[48] = 'Kiwifruit';
$.physicals.girl.foodList[49] = 'Kumquat';
$.physicals.girl.foodList[50] = 'Lemon';
$.physicals.girl.foodList[51] = 'Lime';
$.physicals.girl.foodList[52] = 'Loganberry';
$.physicals.girl.foodList[53] = 'Loquat';
$.physicals.girl.foodList[54] = 'Longan';
$.physicals.girl.foodList[55] = 'Lychee';
$.physicals.girl.foodList[56] = 'Mango';
$.physicals.girl.foodList[57] = 'Mangosteen';
$.physicals.girl.foodList[58] = 'Marionberry';
$.physicals.girl.foodList[59] = 'Melon';
$.physicals.girl.foodList[60] = 'Cantaloupe';
$.physicals.girl.foodList[61] = 'Galia melon';
$.physicals.girl.foodList[62] = 'Honeydew';
$.physicals.girl.foodList[63] = 'Watermelon';
$.physicals.girl.foodList[64] = 'Miracle fruit';
$.physicals.girl.foodList[65] = 'Monstera Delisiousa';
$.physicals.girl.foodList[66] = 'Mulberry';
$.physicals.girl.foodList[67] = 'Nance';
$.physicals.girl.foodList[68] = 'Nectarine';
$.physicals.girl.foodList[69] = 'Orange';
$.physicals.girl.foodList[70] = 'Blood orange';
$.physicals.girl.foodList[71] = 'Clementine';
$.physicals.girl.foodList[72] = 'Mandarine';
$.physicals.girl.foodList[73] = 'Tangerine';
$.physicals.girl.foodList[74] = 'Papaya';
$.physicals.girl.foodList[75] = 'Passionfruit';
$.physicals.girl.foodList[76] = 'Peach';
$.physicals.girl.foodList[77] = 'Pear';
$.physicals.girl.foodList[78] = 'Persimmon';
$.physicals.girl.foodList[79] = 'Plantain';
$.physicals.girl.foodList[80] = 'Plum';
$.physicals.girl.foodList[81] = 'Prune';
$.physicals.girl.foodList[82] = 'Pineapple';
$.physicals.girl.foodList[83] = 'Pineberry';
$.physicals.girl.foodList[84] = 'Plumcot';
$.physicals.girl.foodList[85] = 'Pomegranate';
$.physicals.girl.foodList[86] = 'Pomelo';
$.physicals.girl.foodList[87] = 'Purple mangosteen';
$.physicals.girl.foodList[88] = 'Quince';
$.physicals.girl.foodList[89] = 'Raspberry';
$.physicals.girl.foodList[90] = 'Salmonberry';
$.physicals.girl.foodList[91] = 'Rambutan';
$.physicals.girl.foodList[92] = 'Redcurrant';
$.physicals.girl.foodList[93] = 'Salal berry';
$.physicals.girl.foodList[94] = 'Salak';
$.physicals.girl.foodList[95] = 'Satsuma';
$.physicals.girl.foodList[96] = 'Soursop';
$.physicals.girl.foodList[97] = 'Star apple';
$.physicals.girl.foodList[98] = 'Star fruit';
$.physicals.girl.foodList[99] = 'Strawberry';
$.physicals.girl.foodList[100] = 'Surinam cherry';
$.physicals.girl.foodList[101] = 'Tamarillo';
$.physicals.girl.foodList[102] = 'Tamarind';
$.physicals.girl.foodList[103] = 'Tangelo';
$.physicals.girl.foodList[104] = 'Tayberry';
$.physicals.girl.foodList[105] = 'Ugli fruit';
$.physicals.girl.foodList[106] = 'White currant';
$.physicals.girl.foodList[107] = 'White sapote';
$.physicals.girl.foodList[108] = 'Yuzu';
$.physicals.girl.foodList[109] = 'Bell pepper';
$.physicals.girl.foodList[110] = 'Chile pepper';
$.physicals.girl.foodList[111] = 'Corn kernel';
$.physicals.girl.foodList[112] = 'Cucumber';
$.physicals.girl.foodList[113] = 'Eggplant';
$.physicals.girl.foodList[114] = 'Jalapeño';
$.physicals.girl.foodList[115] = 'Olive';
$.physicals.girl.foodList[116] = 'Pea';
$.physicals.girl.foodList[117] = 'Pumpkin';
$.physicals.girl.foodList[118] = 'Squash';
$.physicals.girl.foodList[119] = 'Tomato';
$.physicals.girl.foodList[120] = 'Zucchini';
$.physicals.girl.foodList[121] = 'asparagus';
$.physicals.girl.foodList[122] = 'apple';
$.physicals.girl.foodList[123] = 'avocado';
$.physicals.girl.foodList[124] = 'alfalfa';
$.physicals.girl.foodList[125] = 'almond';
$.physicals.girl.foodList[126] = 'arugula';
$.physicals.girl.foodList[127] = 'artichoke';
$.physicals.girl.foodList[128] = 'applesauce';
$.physicals.girl.foodList[129] = 'antelope';
$.physicals.girl.foodList[130] = 'bruscetta';
$.physicals.girl.foodList[131] = 'bacon';
$.physicals.girl.foodList[132] = 'black beans';
$.physicals.girl.foodList[133] = 'bagels';
$.physicals.girl.foodList[134] = 'baked beans';
$.physicals.girl.foodList[135] = 'bbq';
$.physicals.girl.foodList[136] = 'bison';
$.physicals.girl.foodList[137] = 'barley';
$.physicals.girl.foodList[138] = 'beer';
$.physicals.girl.foodList[139] = 'bisque';
$.physicals.girl.foodList[140] = 'bluefish';
$.physicals.girl.foodList[141] = 'bread';
$.physicals.girl.foodList[142] = 'broccoli';
$.physicals.girl.foodList[143] = 'buritto';
$.physicals.girl.foodList[144] = 'babaganoosh';
$.physicals.girl.foodList[145] = 'cabbage';
$.physicals.girl.foodList[146] = 'cake';
$.physicals.girl.foodList[147] = 'carrots';
$.physicals.girl.foodList[148] = 'carne asada';
$.physicals.girl.foodList[149] = 'celery';
$.physicals.girl.foodList[150] = 'cheese';
$.physicals.girl.foodList[151] = 'chicken';
$.physicals.girl.foodList[152] = 'catfish';
$.physicals.girl.foodList[153] = 'cheeseburger';
$.physicals.girl.foodList[154] = 'chips';
$.physicals.girl.foodList[155] = 'chocolate';
$.physicals.girl.foodList[156] = 'chowder';
$.physicals.girl.foodList[157] = 'clams';
$.physicals.girl.foodList[158] = 'coffee';
$.physicals.girl.foodList[159] = 'cookie';
$.physicals.girl.foodList[160] = 'corn';
$.physicals.girl.foodList[161] = 'cupcake';
$.physicals.girl.foodList[162] = 'crab';
$.physicals.girl.foodList[163] = 'curry';
$.physicals.girl.foodList[164] = 'cereal';
$.physicals.girl.foodList[165] = 'chimichanga';
$.physicals.girl.foodList[166] = 'dates';
$.physicals.girl.foodList[167] = 'dips';
$.physicals.girl.foodList[168] = 'duck';
$.physicals.girl.foodList[169] = 'dumpling';
$.physicals.girl.foodList[170] = 'donuts';
$.physicals.girl.foodList[171] = 'eggs';
$.physicals.girl.foodList[172] = 'enchilada';
$.physicals.girl.foodList[173] = 'eggroll';
$.physicals.girl.foodList[174] = 'english muffin';
$.physicals.girl.foodList[175] = 'edamame';
$.physicals.girl.foodList[176] = 'eel sushi';
$.physicals.girl.foodList[177] = 'fajita';
$.physicals.girl.foodList[178] = 'falafel';
$.physicals.girl.foodList[179] = 'fish';
$.physicals.girl.foodList[180] = 'franks';
$.physicals.girl.foodList[181] = 'fondu';
$.physicals.girl.foodList[182] = 'french toast';
$.physicals.girl.foodList[183] = 'french dip';
$.physicals.girl.foodList[184] = 'garlic';
$.physicals.girl.foodList[185] = 'ginger';
$.physicals.girl.foodList[186] = 'gnocchi';
$.physicals.girl.foodList[187] = 'goose';
$.physicals.girl.foodList[188] = 'granola';
$.physicals.girl.foodList[189] = 'grapes';
$.physicals.girl.foodList[190] = 'green beans';
$.physicals.girl.foodList[191] = 'guacamole';
$.physicals.girl.foodList[192] = 'gumbo';
$.physicals.girl.foodList[193] = 'grits';
$.physicals.girl.foodList[194] = 'graham crackers';
$.physicals.girl.foodList[195] = 'ham';
$.physicals.girl.foodList[196] = 'halibut';
$.physicals.girl.foodList[197] = 'hamburger';
$.physicals.girl.foodList[198] = 'honey';
$.physicals.girl.foodList[199] = 'huenos rancheros';
$.physicals.girl.foodList[200] = 'hash browns';
$.physicals.girl.foodList[201] = 'hot dogs';
$.physicals.girl.foodList[202] = 'haiku roll';
$.physicals.girl.foodList[203] = 'hummus';
$.physicals.girl.foodList[204] = 'ice cream';
$.physicals.girl.foodList[205] = 'irish stew';
$.physicals.girl.foodList[206] = 'indian food';
$.physicals.girl.foodList[207] = 'italian bread';
$.physicals.girl.foodList[208] = 'jambalaya';
$.physicals.girl.foodList[209] = 'jelly';
$.physicals.girl.foodList[210] = 'jam';
$.physicals.girl.foodList[211] = 'jerky';
$.physicals.girl.foodList[212] = 'jalapeño';
$.physicals.girl.foodList[213] = 'kale';
$.physicals.girl.foodList[214] = 'kabobs';
$.physicals.girl.foodList[215] = 'ketchup';
$.physicals.girl.foodList[216] = 'kiwi';
$.physicals.girl.foodList[217] = 'kidney beans';
$.physicals.girl.foodList[218] = 'kingfish';
$.physicals.girl.foodList[219] = 'lobster';
$.physicals.girl.foodList[220] = 'lamb';
$.physicals.girl.foodList[221] = 'linguine';
$.physicals.girl.foodList[222] = 'lasagna';
$.physicals.girl.foodList[223] = 'meatballs';
$.physicals.girl.foodList[224] = 'moose';
$.physicals.girl.foodList[225] = 'milk';
$.physicals.girl.foodList[226] = 'milkshake';
$.physicals.girl.foodList[227] = 'noodles';
$.physicals.girl.foodList[228] = 'ostrich';
$.physicals.girl.foodList[229] = 'pizza';
$.physicals.girl.foodList[230] = 'pepperoni';
$.physicals.girl.foodList[231] = 'porter';
$.physicals.girl.foodList[232] = 'pancakes';
$.physicals.girl.foodList[233] = 'quesadilla';
$.physicals.girl.foodList[234] = 'quiche';
$.physicals.girl.foodList[235] = 'reuben';
$.physicals.girl.foodList[236] = 'spinach';
$.physicals.girl.foodList[237] = 'spaghetti';
$.physicals.girl.foodList[238] = 'tater tots';
$.physicals.girl.foodList[239] = 'toast';
$.physicals.girl.foodList[240] = 'venison';
$.physicals.girl.foodList[241] = 'waffles';
$.physicals.girl.foodList[242] = 'wine';
$.physicals.girl.foodList[243] = 'walnuts';
$.physicals.girl.foodList[244] = 'yogurt';
$.physicals.girl.foodList[245] = 'ziti';
$.physicals.girl.foodList[246] = 'zucchini';
$.physicals.girl.foodList[247] = 'string bean';
$.physicals.girl.foodList[248] = 'birthday cake';
$.physicals.girl.foodList[249] = 'pear';
$.physicals.girl.foodList[250] = 'steak';
$.physicals.girl.foodList[251] = 'peanut';
$.physicals.girl.foodList[252] = 'hot dog';
$.physicals.girl.willAccept = function willAccept(what, src) {
  /* Returns true iff this is willing to accept what arriving from src.
   *
   * This function (or its overrides) MUST NOT have any kind of
   * observable side-effect (making noise, causing some other action,
   * etc.).
   */
  return what === this.food;
};
Object.setOwnerOf($.physicals.girl.willAccept, $.physicals.Maximilian);
Object.setOwnerOf($.physicals.girl.willAccept.prototype, $.physicals.Maximilian);
$.physicals.girl.movable = false;
$.physicals.girl.attempts = 0;

