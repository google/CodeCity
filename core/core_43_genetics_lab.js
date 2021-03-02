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
 * @fileoverview Genetics lab demo for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.physicals['Genetics Lab'] = (new 'Object.create')($.room);
$.physicals['Genetics Lab'].name = 'Genetics Lab';
$.physicals['Genetics Lab'].location = null;
$.physicals['Genetics Lab'].description = 'To create a new mouse, type: create $.cage.mousePrototype as <name>';

$.physicals['Genetics Lab'].contents_ = [];

$.physicals['Genetics Lab'].contents_.forObj = $.physicals['Genetics Lab'];
Object.defineProperty($.physicals['Genetics Lab'].contents_, 'forObj', {writable: false, enumerable: false, configurable: false});

$.physicals['Genetics Lab'].contents_.forKey = 'contents_';
Object.defineProperty($.physicals['Genetics Lab'].contents_, 'forKey', {writable: false, enumerable: false, configurable: false});

$.cage = (new 'Object.create')($.container);
$.cage.name = 'cage';
$.cage.contents_ = [];
$.cage.contents_.forObj = $.cage;
Object.defineProperty($.cage.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.cage.contents_.forKey = 'contents_';
Object.defineProperty($.cage.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.cage.isOpen = true;
$.cage.variation = 1;
$.cage.tempo = 30;
$.cage.maxPopulation = 50;
$.cage.fight = function fight(aggressor, defender) {
  var capitalizedAggressorName = $.utils.string.capitalize(String(aggressor)) + '(' + aggressor.size + ' cm)';
  var defenderName = String(defender) + '(' + defender.size + ' cm)';
  aggressor.aggressiveness--;
  var point = Math.floor(Math.random() * (aggressor.size + defender.size));
  var victim = null;
  if (point > defender.size) {
    victim = defender;
  } else if (point < defender.size) {
    victim = aggressor;
  }
  if (victim === defender) {
    this.location.narrate(capitalizedAggressorName + ' fights and kills ' + defenderName + '.');
  } else if (victim === aggressor) {
    this.location.narrate(capitalizedAggressorName + ' fights and is killed by ' + defenderName + '.');
  } else {
    this.location.narrate(capitalizedAggressorName + ' fights ' + defenderName + ' to a draw.');
  }
  if (victim) {
    this.kill(victim);
  }
};
Object.setOwnerOf($.cage.fight, $.physicals.Neil);
$.cage.kill = function kill(victim) {
  if (!this.isMouse(victim)) {
    this.location.narrate('ERROR: Cannot kill ' + String(victim) + " since it doesn't appear to be a mouse in here.");
    return;
  }
  var owner = Object.getOwnerOf(victim);
  if (this === $.physicals.cage.mousePrototype) {
    // Can't happen.  But would be catastrophic, so check anyway.
    victim.moveTo(null);
    throw Error('Tried to kill the prototype mouse.');
  } else if (owner === this) {
    // This mouse is a child.
    victim.destroy();
  } else {
    // This mouse belongs to a user.
    victim.moveTo(owner);
    this.location.narrate($.utils.string.capitalize(String(victim)) + ' is ejected from ' + String(this));
  }
};
Object.setOwnerOf($.cage.kill, $.physicals.Neil);
$.cage.breed = function breed(mother, father) {
  mother.fertility--;
  father.fertility--;
  if (mother.fertility < 0 || father.fertility < 0) {
    this.location.narrate('Mating failed since one of them is sterile.');
    return;
  }
  if (mother.sex === father.sex) {
    var sex = mother.sex;
    if (sex === 'M') {
      sex = 'male';
    } else if (sex === 'F') {
      sex = 'female';
    }
    this.location.narrate('Mating failed since both are ' + mother.sex + '.');
    return;
  }
  var mice = this.getContents();
  if (mice.length >= this.maxPopulation) {
    var oldest = mice[0];
    for (var i = 1; i < mice.length; i++) {
      if (mice[i].generation < oldest.generation) {
        oldest = mice[i];
      }
    }
    this.location.narrate('Maximum population (' + this.maxPopulation, ') reached; ' + String(oldest) + ' dies of old age.');
    this.kill(oldest);
  }

  var kid = Object.create(this.mousePrototype);
  Object.setOwnerOf(kid, this);
  kid.init(mother, father, this.variation);
  kid.moveTo(this);
  this.location.narrate($.utils.string.capitalize(String(kid)) + ' has been born to ' + String(mother) + ' & ' + String(father) + '.');
  this.tasks.push(setTimeout(this.life.bind(this, kid), 0));
};
Object.setOwnerOf($.cage.breed, $.physicals.Neil);
$.cage.tasks = [];
$.cage.setOpen = function setOpen(newState) {
  var success = Object.getPrototypeOf($.cage).setOpen.call(this, newState);
  if (!success) {
    return false;
  }
  while (this.tasks.length) {
    clearTimeout(this.tasks.pop());
  }
  var location = this.location;
  var mice = this.getContents();
  if (this.isOpen) {
    for (var i = mice.length - 1; i >= 0; i--) {
      this.kill(mice[i]);
    }
    location.narrate('All mice in ' + String(this) + ' have been exterminated.');
  } else {
    location.narrate($.utils.string.capitalize(String(this)) + ' starts running.');
    for (var i = mice.length - 1; i >= 0; i--) {
      var mouse = mice[i];
      if (this.isMouse(mouse)) {
        location.narrate($.utils.string.capitalize(String(mouse)) + ' starts moving.');
        this.startMouse(mouse);
      } else {
        location.narrate($.utils.string.capitalize(String(mouse)) + " isn't a valid mouse and gets thrown out.");
        mouse.moveTo(location);
      }
    }
  }
  return true;
};
Object.setOwnerOf($.cage.setOpen, $.physicals.Maximilian);
Object.setOwnerOf($.cage.setOpen.prototype, $.physicals.Maximilian);
$.cage.life = function life(mouse) {
  if (!this.isMouse(mouse)) {
    throw Error(String(mouse) + ' is not a valid mouse.');
  }
  var capitalizedMouseName = $.utils.string.capitalize(String(mouse));
  var self = 'itself';
  if (mouse.sex === 'M') {
    self = 'himself';
  } else if (mouse.sex === 'F') {
    self = 'herself';
  }
  while (true) {
    this.tasks.push(suspend(Math.random() * this.tempo * 1000));
    if (mouse.location !== this) {
      return;
    }
    if (mouse.aggressiveness < 1 && mouse.fertility < 1) {
      this.location.narrate(capitalizedMouseName + ' dies after a productive life.');
      this.kill(mouse);
      return;
    }
    if (mouse.aggressiveness > 0) {
      try {
        var victim = mouse.pickFight();
      } catch (e) {
        this.kill(mouse);
        this.location.narrate(capitalizedMouseName + ' threw "' + e + '" in .pickFight function.');
        this.location.narrate(capitalizedMouseName + ' is being executed to put it out of its misery.');
      }
      if (!victim) {
        this.location.narrate(capitalizedMouseName + ' decides not to fight ever again.');
        mouse.aggressiveness = 0;
      } else if (mouse === victim) {
        this.location.narrate(capitalizedMouseName + ' fights and kills ' + self + '.');
        this.kill(mouse);
        return;
      } else if (this.isMouse(victim)) {
        this.fight(mouse, victim);
      } else {
        this.location.narrate(capitalizedMouseName + ' returned "' + String(victim) + '" from .pickFight function.');
        this.location.narrate(capitalizedMouseName + ' is being executed to put it out of its misery.');
        this.kill(mouse);
        return;
      }

    } else if (mouse.fertility > 0) {
      try {
        var target = mouse.proposeMate();
      } catch (e) {
        this.kill(mouse);
        this.location.narrate($.utils.string.capitalize(String(target)) + ' threw "' + e + '" in .proposeMate function.');
        this.location.narrate($.utils.string.capitalize(String(mouse)) + ' is being executed to put it out of its misery.');
      }
      if (!target) {
        this.location.narrate(capitalizedMouseName + ' decides not to mate ever again.');
        mouse.fertility = 0;
      } else if (mouse === target) {
        mouse.fertility--;
        this.location.narrate(capitalizedMouseName + ' is caught trying to mate with ' + self + '.');
      } else if (this.isMouse(target)) {
        try {
          var answer = target.acceptMate(mouse);
        } catch (e) {
          this.location.narrate($.utils.string.capitalize(String(target)) + ' threw "' + e + '" in .acceptMate function.');
          this.location.narrate($.utils.string.capitalize(String(target)) + ' is being executed to put it out of its misery.');
          this.kill(target);
        }
        if (answer) {
          this.location.narrate(capitalizedMouseName + ' asked ' + String(target) + ' to mate.  The answer is YES!');
          this.breed(mouse, target);
        } else {
          this.location.narrate(capitalizedMouseName + ' asked ' + String(target) + ' to mate.  The answer is NO!');
        }
      } else {
        this.location.narrate(capitalizedMouseName + ' returned "' + String(target) + '" from .proposeMate function.');
        this.location.narrate(capitalizedMouseName + ' is being executed to put it out of its misery.');
        this.kill(mouse);
        return;
      }
    }
  }
};
Object.setOwnerOf($.cage.life, $.physicals.Neil);
$.cage.willAccept = function willAccept(what, src) {
  // Returns true iff this is willing to accept what arriving from src.
  //
  // This function (or its overrides) MUST NOT have any kind of
  // observable side-effect (making noise, causing some other action,
  // etc.).
  return this.isOpen || (this.mousePrototype.isPrototypeOf(what) && !src);
};
Object.setOwnerOf($.cage.willAccept, $.physicals.Neil);
Object.setOwnerOf($.cage.willAccept.prototype, $.physicals.Maximilian);
$.cage.mousePrototype = (new 'Object.create')($.thing);
$.cage.mousePrototype.name = 'Genetic Mouse Prototype';
$.cage.mousePrototype.location = null;
$.cage.mousePrototype.contents_ = [];
$.cage.mousePrototype.contents_.forObj = $.cage.mousePrototype;
Object.defineProperty($.cage.mousePrototype.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.cage.mousePrototype.contents_.forKey = 'contents_';
Object.defineProperty($.cage.mousePrototype.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.cage.mousePrototype.size = 10;
$.cage.mousePrototype.generation = 0;
$.cage.mousePrototype.sex = NaN;
$.cage.mousePrototype.proposeMate = function proposeMate() {
  // Return who you'd like to mate with!
  // Returning null will pass on this mating and all future ones.
  // Reprogram this function to make it smarter!
  var mice = this.location.getContents();
  return mice[Math.floor(Math.random() * mice.length)];
};
Object.setOwnerOf($.cage.mousePrototype.proposeMate, $.physicals.Neil);
$.cage.mousePrototype.acceptMate = function acceptMate(whom) {
  // The mouse 'whom' wishes to mate with you!
  // Return true to mate with it, or false to tell it to go away.
  // Reprogram this function to make it smarter!
  return Math.random() > 0.5;
};
Object.setOwnerOf($.cage.mousePrototype.acceptMate, $.physicals.Neil);
$.cage.mousePrototype.pickFight = function pickFight() {
  // Return who you'd like to fight with!
  // Returning null will pass on this fight and all future ones.
  // The bigger mouse (based on .size) usually wins.
  // Reprogram this function to make it smarter!
  var mice = this.location.getContents();
  return mice[Math.floor(Math.random() * mice.length)];
};
Object.setOwnerOf($.cage.mousePrototype.pickFight, $.physicals.Neil);
$.cage.mousePrototype.toString = function toString() {
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
Object.setOwnerOf($.cage.mousePrototype.toString, $.physicals.Neil);
$.cage.mousePrototype.init = function init(mother, father, variation) {
  // Blend together the numeric attributes from the parents.
  var thisMouse = this;
  function blend(name) {
    var average = (mother[name] + father[name]) / 2;
    var mutation = Math.random() * 2 * variation - variation;
    thisMouse[name] = Math.max(1, Math.round(average + mutation));
  }
  blend('size');
  blend('startFertility');
  this.fertility = this.startFertility;
  blend('startAggressiveness');
  this.aggressiveness = this.startAggressiveness;
  this.generation = 1 + Math.max(mother.generation, father.generation);
  // Random sex and name.
  this.sex = Math.random() > 0.5 ? 'M' : 'F';
  var name = '';
  for (var i = 0; i < 6; i++) {
    var letters = ((i % 2) == (this.sex === 'F') ? $.utils.string.VOWELS : $.utils.string.CONSONANTS);
    name += $.utils.string.randomCharacter(letters);
  }
  this.setName($.utils.string.capitalize(name), /*tryAlternative:*/ true);
  // Copy the three 'genetic' functions.
  // Take two from one parent, and one from the other.
  var f1 = Math.floor(Math.random() * 2);
  var f2 = Math.floor(Math.random() * 2);
  var f3 = (f1 === f2) ? 1 - f1 : Math.floor(Math.random() * 2);
  this.proposeMate = (f1 ? mother : father).proposeMate;
  this.acceptMate = (f2 ? mother : father).acceptMate;
  this.pickFight = (f3 ? mother : father).pickFight;
};
Object.setOwnerOf($.cage.mousePrototype.init, $.physicals.Neil);
$.cage.mousePrototype.svgText = '<circle class="fillWhite" cx="5.72917" cy="75.78125" fill-opacity="null" r="3.03695" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<circle class="fillWhite" cx="16.14583" cy="76.04167" fill-opacity="null" r="3.03695" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m12.03308,93.12514c0.10717,-0.16041 0.20994,-0.33687 0.3607,-0.46521c0.13567,-0.11549 0.26228,-0.2318 0.35766,-0.41378c0.09514,-0.18152 0.18337,-0.37185 0.27094,-0.54384c0.09047,-0.17769 0.23341,-0.33627 0.32625,-0.51556c0.09456,-0.18262 0.16626,-0.3955 0.25294,-0.57592c0.08473,-0.17635 0.15151,-0.35631 0.21424,-0.55787c0.0606,-0.19472 0.11528,-0.39692 0.236,-0.55692c0.11711,-0.15522 0.1751,-0.3524 0.24424,-0.54836c0.0733,-0.20776 0.17971,-0.36417 0.30408,-0.54333c0.11333,-0.16327 0.23029,-0.33189 0.31148,-0.51088c0.08883,-0.19584 0.08604,-0.43681 0.17292,-0.60107c0.09343,-0.17665 0.17524,-0.38236 0.25117,-0.60702c0.05663,-0.16755 0.14565,-0.40706 0.24423,-0.56254c0.11292,-0.17809 0.21575,-0.35482 0.29636,-0.55741c0.07633,-0.19184 0.12109,-0.38516 0.17569,-0.61406c0.04666,-0.19564 0.07422,-0.39394 0.14751,-0.60325c0.07343,-0.20968 0.15269,-0.42249 0.1859,-0.63342c0.03708,-0.23553 0.0675,-0.40802 0.09892,-0.64514c0.03015,-0.22757 0.06075,-0.43228 0.10575,-0.64423c0.04384,-0.20646 0.11445,-0.41401 0.1663,-0.63329c0.04621,-0.19545 0.02886,-0.4034 0.01633,-0.62028c-0.01387,-0.24007 0.02528,-0.45202 0.06057,-0.66655c0.03699,-0.22484 0.07443,-0.44395 0.05068,-0.66456c-0.02303,-0.21391 -0.05871,-0.42537 -0.10194,-0.62671c-0.04718,-0.21968 -0.08464,-0.43581 -0.15489,-0.62975c-0.07444,-0.20548 -0.14604,-0.39207 -0.23557,-0.57846c-0.08918,-0.18566 -0.19834,-0.32861 -0.29469,-0.50329c-0.09897,-0.17945 -0.17809,-0.31666 -0.20312,-0.41964c-0.04113,-0.1692 -0.28667,-0.14852 -0.44171,-0.233c-0.1559,-0.08495 -0.30662,-0.20848 -0.44924,-0.26572c-0.16227,-0.06513 -0.33202,-0.15875 -0.50227,-0.16386c-0.17611,-0.00528 -0.33485,0.00854 -0.5018,-0.02748c-0.17309,-0.03735 -0.34972,-0.00494 -0.52126,-0.00233c-0.1752,0.00267 -0.33668,-0.04599 -0.51453,-0.06461c-0.16328,-0.0171 -0.33364,0 -0.51639,0c-0.16946,0 -0.33838,0 -0.49933,0c-0.2001,0 -0.37072,0.01565 -0.52376,0c-0.18217,-0.01862 -0.34876,-0.10261 -0.50742,-0.12788c-0.17392,-0.0277 -0.35294,0.01033 -0.51354,-0.00204c-0.17468,-0.01345 -0.35419,-0.0047 -0.52247,0.00069c-0.17037,0.00545 -0.33059,-0.03414 -0.51396,-0.0348c-0.17038,-0.00062 -0.33266,0.0348 -0.51511,0.0348c-0.17961,0 -0.34591,0 -0.5116,0c-0.1717,0 -0.35472,-0.05006 -0.52282,0.02861c-0.15635,0.07318 -0.30353,0.16488 -0.48929,0.16523c-0.16718,0.00031 -0.33557,-0.00327 -0.49828,-0.0056c-0.16088,-0.0023 -0.33418,0.00613 -0.51423,0.04867c-0.16796,0.03968 -0.28058,0.18636 -0.43422,0.26698c-0.16081,0.08438 -0.33311,0.14746 -0.50376,0.21417c-0.16856,0.06589 -0.34886,0.06024 -0.50639,0.14344c-0.15083,0.07966 -0.29251,0.26612 -0.34361,0.46952c-0.05001,0.19908 -0.06113,0.41128 -0.10312,0.57281c-0.06418,0.24692 -0.04219,0.48684 -0.04318,0.70093c-0.00091,0.19685 -0.02179,0.44057 -0.00433,0.64629c0.01749,0.20598 0.04606,0.4338 0.055,0.66725c0.00789,0.2059 0.00868,0.44533 0.05574,0.65214c0.04451,0.19562 0.10108,0.4036 0.12911,0.62044c0.02837,0.21952 0.11424,0.40775 0.18964,0.61066c0.06952,0.18708 0.15266,0.38581 0.21557,0.572c0.06656,0.19699 0.21037,0.33757 0.31022,0.51815c0.09604,0.1737 0.19471,0.37664 0.27117,0.57747c0.07028,0.18458 0.15927,0.35897 0.27799,0.51699c0.13449,0.17902 0.22487,0.35185 0.30652,0.5394c0.08267,0.1899 0.17582,0.35748 0.27797,0.57073c0.09073,0.1894 0.19736,0.33509 0.30578,0.54181c0.09507,0.18126 0.13773,0.36801 0.26948,0.55438c0.1012,0.14315 0.1916,0.31362 0.30295,0.47201c0.10736,0.15272 0.26718,0.28502 0.35353,0.48125c0.07875,0.17895 0.08404,0.40871 0.18561,0.61244c0.08625,0.173 0.19465,0.3578 0.29178,0.53422c0.09824,0.17845 0.2189,0.34272 0.26908,0.5225c0.05477,0.19623 0.17323,0.36946 0.26577,0.54706c0.09091,0.17449 0.20319,0.34711 0.28538,0.53386c0.0811,0.18428 0.17419,0.37775 0.26136,0.57929c0.08158,0.18863 0.20843,0.34264 0.32867,0.51285c0.10846,0.15354 0.24673,0.27505 0.3601,0.44161c0.10788,0.1585 0.19981,0.31101 0.31581,0.43291c0.1382,0.14522 0.27754,0.25864 0.40544,0.42133c0.1197,0.15226 0.25321,0.29275 0.39242,0.39693c0.15915,0.11909 0.32793,0.1887 0.44168,0.24786c0.14677,0.07633 0.31817,0.06461 0.44623,-0.01292l0.00432,-0.09804l0.11123,0.11027" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<circle class="fillBlack" cx="13.80208" cy="80.85938" fill-opacity="null" r="0.67853" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<circle class="fillBlack" cx="8.72396" cy="80.72909" fill-opacity="null" r="0.54832" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<line fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" x1="13.02083" x2="26.30208" y1="89.0625" y2="86.71875"/>\n<line fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" x1="9.63542" x2="-4.16667" y1="88.54167" y2="91.66667"/>\n<line fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" x1="12.5" x2="26.04167" y1="89.0625" y2="89.0625"/>\n<line fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" x1="9.11458" x2="-3.64583" y1="88.02083" y2="88.80208"/>\n<line fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" x1="13.02083" x2="24.21875" y1="89.0625" y2="91.14583"/>\n<line fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" x1="9.375" x2="-0.52083" y1="89.0625" y2="92.70833"/>';
$.cage.mousePrototype.startAggressiveness = 2;
$.cage.mousePrototype.aggressiveness = 2;
$.cage.mousePrototype.startFertility = 4;
$.cage.mousePrototype.fertility = 3;
$.cage.mousePrototype.getCommands = function getCommands(who) {
  var commands = $.thing.getCommands.call(this, who);
  commands.push('program ' + this.name);
  return commands;
};
Object.setOwnerOf($.cage.mousePrototype.getCommands, $.physicals.Neil);
$.cage.mousePrototype.program = function program(cmd) {
  // Open this mouse in the genetics editor.
  var selector = $.Selector.for(this).toString();
  // No need to encode $.
  var query = encodeURIComponent(String(selector)).replace(/%24/g, '$');
  var link = $.hosts.root.url('genetics') + 'editor?' + query;
  cmd.user.readMemo({type: "link", href: link});
};
Object.setOwnerOf($.cage.mousePrototype.program, $.physicals.Maximilian);
Object.setOwnerOf($.cage.mousePrototype.program.prototype, $.physicals.Neil);
$.cage.mousePrototype.program.verb = 'program';
$.cage.mousePrototype.program.dobj = 'this';
$.cage.mousePrototype.program.prep = 'none';
$.cage.mousePrototype.program.iobj = 'none';
$.cage.mousePrototype.description = function description() {
  var sex = 'multi-sexual';
  if (this.sex === 'm') sex = 'male';
  if (this.sex === 'f') sex = 'female';
  var desc = [];
  desc.push('A ' + sex + ' mouse.');
  desc.push('It is ' + this.size + ' cm long, and can have ' + this.fertility + ' more children.');
  desc.push('It can fight ' + this.aggressiveness + ' other mice.');
  desc.push('It belongs to generation ' + this.generation + '.');
  return desc.join('\n');
};
Object.setOwnerOf($.cage.mousePrototype.description, $.physicals.Neil);
Object.setOwnerOf($.cage.mousePrototype.description.prototype, $.physicals.Neil);
$.cage.isMouse = function isMouse(animal) {
  return this.mousePrototype.isPrototypeOf(animal) && (animal.location === this);
};
Object.setOwnerOf($.cage.isMouse, $.physicals.Neil);
$.cage.startMouse = function startMouse(mouse) {
  // Reset all attributes to defaults.
  var reset = ['fertility', 'startFertility', 'generation', 'startAggressiveness', 'sex', 'size'];
  for (var i = 0; i < reset.length; i++) {
    delete mouse[reset[i]];
  }
  // First generation mice don't fight.
  mouse.aggressiveness = 0;
  this.tasks.push(setTimeout(this.life.bind(this, mouse), 0));
};
Object.setOwnerOf($.cage.startMouse, $.physicals.Maximilian);
$.cage.open = function open(cmd) {
  if (this.isOpen) {
    cmd.user.narrate($.utils.string.capitalize(String(cmd.dobj)) + ' is already open.');
    return;
  }
  if (this.location !== cmd.user.location && this.location !== cmd.user) {
    cmd.user.narrate($.utils.string.capitalize(String(cmd.dobj)) + ' is not here.');
    return;
  }
  if (!this.setOpen(true)) {
    cmd.user.narrate('You can\'t open ' + String(cmd.dobj));
    return;
  }
  if (cmd.user.location) {
    cmd.user.location.narrate(cmd.user.name + ' opens ' + String(cmd.dobj) + '.', cmd.user);
  }
  cmd.user.narrate('You open ' + String(cmd.dobj) + '.');
  this.look(cmd);
};
Object.setOwnerOf($.cage.open, $.physicals.Maximilian);
Object.setOwnerOf($.cage.open.prototype, $.physicals.Maximilian);
$.cage.open.verb = 'open';
$.cage.open.dobj = 'this';
$.cage.open.prep = 'none';
$.cage.open.iobj = 'none';
$.cage.svgTextClosed = '<path class="fillWhite" d="m20,80 l10,-10 l20,0 l0,20 l-10,10"/>\n<line x1="40" x2="50" y1="80" y2="70"/>\n<rect class="fillWhite" height="20" width="20" x="20" y="80"/>\n';
$.cage.svgTextOpen = '<path class="fillWhite" d="m20,80 l10,-10 l20,0 l0,20 l-10,10"/>\n<line x1="30" x2="30" y1="90" y2="70"/>\n<rect class="fillWhite" height="20" width="20" x="20" y="80"/>\n<line x1="40" x2="50" y1="80" y2="70"/>\n<path class="fillWhite" d="m20,80 l10,-10 l-16,-16 l-10,10 l16,16z"/>\n';

$.cage.location = undefined;

$.physicals.cage = $.cage;

$.physicals['Genetic Mouse Prototype'] = $.cage.mousePrototype;

$.hosts.genetics = (new 'Object.create')($.servers.http.Host.prototype);
$.hosts.genetics['/editor'] = {};
$.hosts.genetics['/editor'].www = "<!doctype html>\n<% var staticUrl = request.hostUrl('static'); %>\n<html>\n  <head>\n    <meta charset=\"utf-8\"/>\n    <title>Code City: Genetics Editor</title>\n    <link href=\"<%=staticUrl%>favicon.ico\" rel=\"shortcut icon\">\n    <link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css?family=Roboto+Mono\">\n    <link rel=\"stylesheet\" href=\"<%=staticUrl%>style/jfk.css\">\n\n    <link rel=\"stylesheet\" href=\"<%=staticUrl%>CodeMirror/lib/codemirror.css\">\n    <link rel=\"stylesheet\" href=\"<%=staticUrl%>CodeMirror/addon/lint/lint.css\">\n    <link rel=\"stylesheet\" href=\"<%=staticUrl%>CodeMirror/theme/eclipse.css\">\n    <script src=\"<%=staticUrl%>CodeMirror/lib/codemirror.js\"></script>\n    <script src=\"<%=staticUrl%>CodeMirror/addon/comment/continuecomment.js\"></script>\n    <script src=\"<%=staticUrl%>CodeMirror/addon/edit/matchbrackets.js\"></script>\n    <script src=\"<%=staticUrl%>CodeMirror/addon/lint/lint.js\"></script>\n    <script src=\"<%=staticUrl%>CodeMirror/addon/lint/javascript-lint.js\"></script>\n    <script src=\"<%=staticUrl%>CodeMirror/addon/display/rulers.js\"></script>\n    <script src=\"<%=staticUrl%>CodeMirror/mode/javascript/javascript.js\"></script>\n    <script src=\"https://unpkg.com/jshint@2.9.6/dist/jshint.js\"></script>\n    <style>\nbody {\n  background: #fff;\n  color: #444;\n  font-family: \"Roboto Mono\", monospace;\n  font-size: 11pt;\n}\n\ninput {\n  font-family: \"Roboto Mono\", monospace;\n  font-size: 11pt;\n}\n\n#editorButtons {\n  float: right;\n  margin-top: 5px;\n  margin-right: 3px;\n}\n\n#editorHeader {\n  margin: 10px 2px;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n#editorTabs {\n  font-family: \"Arial\", \"Helvetica\", sans-serif;\n  font-size: 11px;\n  margin-left: 2px;\n}\n\n#editorTabs>.spacer {\n  border-bottom: 1px solid rgba(0,0,0,.1);\n  padding: 4px 5px;\n}\n\n#editorTabs>.jfk-button {\n  border-bottom-color: #f1f1f1;\n  border-bottom-left-radius: 0;\n  border-bottom-right-radius: 0;\n  height: auto;\n  line-height: normal;\n  margin-right: 0;\n  padding-bottom: 4px;\n  padding-top: 4px;\n}\n\n#editorTabs>.highlighted {\n  background-color: #ccc;\n  background-image: none;\n}\n\n#editorContainers>div {\n  display: none;\n  position: absolute;\n  top: 60px;\n  bottom: 20px;\n  left: 10px;\n  right: 20px\n}\n\n#editorSavingMask {\n  background-color: #000;\n  bottom: 0;\n  left: 0;\n  opacity: 0;\n  position: absolute;\n  right: 0;\n  top: 0;\n  transition-property: opacity;\n  z-index: 998;\n}\n\n#editorSavingMask {\n  cursor: wait;\n  display: none;\n  transition-duration: 1s;\n}\n\n.CodeMirror {\n  border: 1px solid #ddd;\n}\n\n#editorButter {\n  display: none;\n  left: 0;\n  position: absolute;\n  right: 0;\n  top: 0;\n  pointer-events: none;\n  z-index: 10;\n}\n\n#editorButter>div {\n  text-align: center;\n}\n\n#editorButterText {\n  background: #f9edbe;\n  border: 1px solid #f0c36d;\n  border-radius: 0 0 2px 2px;\n  border-top: 0;\n  box-shadow: 0 2px 4px rgba(0,0,0,0.2);\n  display: inline-block;\n  padding: 0 10px;\n  pointer-events: auto;\n}\n\n#referencePage {\n  font-size: smaller;\n}\n\ndt {\n  font-weight: bolder;\n}\n    </style>\n    <script>\n/**\n * Create a CodeMirror editor.\n * @param {!Element} container HTML element to hold the editor.\n * @param {string} value Initial JavaScript code.\n * @return {!Object} CodeMirron editor.\n */\nfunction newCodeMirror(container, value) {\n  var options = {\n    continueComments: {continueLineComment: false},\n    extraKeys: {\n      Tab: function(cm) {\n        cm.replaceSelection('  ');\n      }\n    },\n    gutters: ['CodeMirror-lint-markers'],\n    lineNumbers: true,\n    lint: true,\n    matchBrackets: true,\n    mode: 'text/javascript',\n    rulers: [{color: '#ddd', column: 80, lineStyle: 'dashed'}],\n    tabSize: 2,\n    theme: 'eclipse',\n    undoDepth: 1024\n  };\n  var editor = CodeMirror(container, options);\n  editor.setSize('100%', '100%');\n  editor.setValue(value);\n  editor.on('change', saturateSave);\n  return editor;\n}\n\n/**\n * When a tab is clicked, highlight it and show its container.\n * @param {!Event|!Object} e Click event or object pretending to be an event.\n */\nfunction tabClick(e) {\n  var tab = e.target;\n  if (tab.parentNode.id !== 'editorTabs') {\n    throw Error();\n  }\n  // Unhighlight all tabs, hide all containers.\n  var oldTab = document.querySelector('#editorTabs>.highlighted');\n  oldTab && oldTab.classList.remove('highlighted');\n  var containers = document.querySelectorAll('#editorContainers>div');\n  for (var container of containers) {\n    container.style.display = 'none';\n  }\n\n  // Highlight one tab, show one container.\n  tab.classList.add('highlighted');\n  tab.container.style.display = 'block';\n  if (tab.editor) {\n    tab.editor.refresh();\n    tab.editor.focus();\n  }\n  // Save tab preference.\n  sessionStorage.setItem('GENETIC_TAB', tab.id);\n}\n\n/**\n * Save the current editor content.\n */\nfunction saveAll() {\n  sendXhr();\n  // Prevent the user from interacting with the editor during an async save.\n  var mask = document.getElementById('editorSavingMask');\n  mask.style.display = 'block';\n  saveMaskPid = setTimeout(function() {\n    mask.style.opacity = 0.2;\n  }, 1000);  // Wait a second before starting visible transition.\n}\n\nvar saveMaskPid;\n\n/**\n * Send a save request.\n */\nfunction sendXhr() {\n  var pickFightCode = document.getElementById('pickFightTab').editor.getValue();\n  var proposeMateCode = document.getElementById('proposeMateTab').editor.getValue();\n  var acceptMateCode = document.getElementById('acceptMateTab').editor.getValue();\n  var xhr = new XMLHttpRequest();\n  xhr.open('POST', 'editorXhr');\n  xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');\n  xhr.onload = receiveXhr;\n  var data =\n      'selector=' + encodeURIComponent(mouseSelector) +\n      '&pickFight=' + encodeURIComponent(pickFightCode) +\n      '&proposeMate=' + encodeURIComponent(proposeMateCode) +\n      '&acceptMate=' + encodeURIComponent(acceptMateCode);\n  xhr.send(data);\n}\n\n/**\n * Got a response from save request.\n * @this XMLHttpRequest\n */\nfunction receiveXhr() {\n  if (this.status !== 200) {\n    clearSaveMask();\n    showButter('Save failed: Status ' + this.status);\n    return;\n  }\n  var data = JSON.parse(this.responseText);\n  if (data.saved) {\n    desaturateSave();\n  }\n  clearSaveMask();\n\n  // If there's a message, show it in the butter.\n  if (data.butter) {\n    showButter(data.butter);\n  }\n}\n\n/**\n * Remove saving mask that prevents UI interaction.\n */\nfunction clearSaveMask() {\n  clearTimeout(saveMaskPid);\n  var mask = document.getElementById('editorSavingMask');\n  mask.style.display = 'none';\n  mask.style.opacity = 0;\n}\n\n/**\n * Show the text in the butter bar for five seconds.\n * Clobber any existing display.\n * @param {string} text Text to display.\n */\nfunction showButter(text) {\n  clearTimeout(showButter.pid_);\n  var textDiv = document.getElementById('editorButterText');\n  textDiv.innerHTML = '';\n  text = text.split('\\n');\n  for (line of text) {\n    textDiv.appendChild(document.createTextNode(line));\n    textDiv.appendChild(document.createElement('br'));\n  }\n  document.getElementById('editorButter').style.display = 'block';\n  showButter.pid_ = setTimeout(hideButter, 5000);\n}\n\nshowButter.pid_ = 0;\n\n/**\n * Hide the butter bar.\n */\nfunction hideButter() {\n  document.getElementById('editorButter').style.display = 'none';\n}\n\n/**\n * Saturate the editor's save button.\n * @param {*} e CodeMirror change event.\n */\nfunction saturateSave(e) {\n  document.getElementById('editorSave').classList.add('jfk-button-submit');\n}\n\n/**\n * Saturate the editor's save button.\n */\nfunction desaturateSave() {\n  document.getElementById('editorSave').classList.remove('jfk-button-submit');\n}\n\n/**\n * Keydown handler for the editor frame.\n * @param {!KeyboardEvent} e Keydown event.\n */\nfunction keyDown(e) {\n  // Save the editor if ⌘-s or Ctrl-s is pressed.\n  if (e.key === 's' && (e.metaKey || e.ctrlKey)) {\n    saveAll();\n    e.preventDefault();\n    e.stopPropagation();\n  }\n}\n\nfunction init() {\n  var tab;\n  tab = document.getElementById('proposeMateTab');\n  tab.addEventListener('click', tabClick);\n  tab.container = document.getElementById('proposeMateEditor');\n  tab.editor = newCodeMirror(tab.container, proposeMateCode);\n\n  tab = document.getElementById('acceptMateTab');\n  tab.addEventListener('click', tabClick);\n  tab.container = document.getElementById('acceptMateEditor');\n  tab.editor = newCodeMirror(tab.container, acceptMateCode);\n\n  tab = document.getElementById('pickFightTab');\n  tab.addEventListener('click', tabClick);\n  tab.container = document.getElementById('pickFightEditor');\n  tab.editor = newCodeMirror(tab.container, pickFightCode);\n\n  tab = document.getElementById('referenceTab');\n  tab.addEventListener('click', tabClick);\n  tab.container = document.getElementById('referencePage');\n\n  document.getElementById('editorSave').addEventListener('click', saveAll);\n  document.addEventListener('keydown', keyDown);\n\n  // Check for a tab preference.\n  var tabId = sessionStorage.getItem('GENETIC_TAB') || 'proposeMateTab';\n  var fakeEvent = {target: document.getElementById(tabId)};\n  tabClick(fakeEvent);\n}\nwindow.addEventListener('load', init);\n    </script>\n<%\nvar mouseSelector = decodeURIComponent(request.query);\nvar mouse = $(mouseSelector);\n%>\n    <script>\n// <![CDATA[\nvar mouseSelector = <%= JSON.stringify(mouseSelector) %>;\nvar pickFightCode = <%= mouse && JSON.stringify(String(mouse.pickFight)) %>;\nvar proposeMateCode = <%= mouse && JSON.stringify(String(mouse.proposeMate)) %>;\nvar acceptMateCode = <%= mouse && JSON.stringify(String(mouse.acceptMate)) %>;\n// ]]>\n    </script>\n  </head>\n\n  <body>\n    <div id=\"editorButter\"><div><div id=\"editorButterText\"></div></div></div>\n    <div id=\"editorSavingMask\"></div>\n    <div id=\"editorButtons\">\n      <button id=\"editorSave\" class=\"jfk-button\">Save All</button>\n    </div>\n    <div id=\"editorHeader\"><%= mouse && mouse.name %></div>\n    <div id=\"editorTabs\">\n      <span\n      class=\"jfk-button\" role=\"button\" tabindex=\"0\" id=\"pickFightTab\">.pickFight</span><span\n      class=\"spacer\"></span><span\n      class=\"jfk-button\" role=\"button\" tabindex=\"1\" id=\"proposeMateTab\">.proposeMate</span><span\n      class=\"spacer\"></span><span\n      class=\"jfk-button\" role=\"button\" tabindex=\"2\" id=\"acceptMateTab\">.acceptMate</span><span\n      class=\"spacer\"></span><span\n      class=\"jfk-button\" role=\"button\" tabindex=\"3\" id=\"referenceTab\">Reference</span>\n    </div>\n    <div id=\"editorContainers\">\n      <div id=\"pickFightEditor\"></div>\n      <div id=\"proposeMateEditor\"></div>\n      <div id=\"acceptMateEditor\"></div>\n      <div id=\"referencePage\">\n         <p>Properties on the mice:</p>\n         <dl>\n           <dt>.generation → integer</dt>\n           <dd>The initial mice placed in the cage are generation 0.\n           Their children are generation 1, and so on.</dd>\n           <dt>.sex → 'M' or 'F' or NaN</dt>\n           <dd>Generation 0 mice have a sex of NaN, which means they are hermaphrodites\n           and can be both male and female as needed for any given mating.\n           Subsequent generations have a sex set randomly at birth to be either \"M\" or \"F\".\n           JavaScript tip: NaN does not equal NaN.</dd>\n           <dt>.size → integer</dt>\n           <dd>Larger mice are more likely to win a fight against a smaller mouse.\n           Generation 0 mice are all 10 cm.  Subsequent births are the average of\n           their parents' sizes, plus/minus a random variation.</dd>\n           <dt>.startFertility → integer</dt>\n           <dd>The total number of attempts a mouse has to produce offspring during its life.\n            Generation 0 mice all have a startFertility of 4.  Subsequent births\n            are the average of their parents' fertility, plus/minus a random variation.</dd>\n           <dt>.fertility → integer</dt>\n           <dd>The number of remaining attempts a mouse has to produce offspring.\n            This is set to startFertility at birth, and decrements with every mating attempt.</dd>\n           <dt>.startAggressiveness → integer</dt>\n           <dd>The total number of fights a mouse may start during its life.\n            Generation 0 mice all have a startAggressiveness of 2.  Subsequent births\n            are the average of their parents' aggressiveness, plus/minus a random variation.</dd>\n           <dt>.aggressiveness → integer</dt>\n           <dd>The number of remaining fights a mouse may start.  Generation 0 mice\n            have their aggressiveness set to 0 (they can't start fights).  Subsequent births\n            have their aggressiveness set to startAggressiveness, and decrements with every\n            fight started.</dd>\n           <dt>.location → cage</dt>\n           <dd>This is the cage in which the mouse is located.  The cage has a getContents function\n           that returns an array of all mice.  this.location.getContents() will always include you.</dd>\n         </dl>\n         <p>Functions on the mice:</p>\n         <dl>\n           <dt>.pickFight → mouse or null</dt>\n           <dd>Return the mouse you'd like to fight with.\n           Returning null will pass on this fight and all future ones.\n           The bigger mouse (based on .size) usually wins, ties are possible.\n           The loser (if there is one) dies and is removed from the cage.</dd>\n           <dt>.proposeMate() → mouse or null</dt>\n           <dd>Return the mouse you'd like to mate with.\n           Returning null will pass on this mating and all future ones.\n           Only opposite-sex matings (or those involving a NaN hermaphrodite) will produce a child.\n           Each proposal decrements fertility by one, regardless of whether mating is successful.</dd>\n           <dt>.acceptMate(mouse) → boolean</dt>\n           <dd>The mouse passed in as the first variable wishes to mate with you.\n           Return true to mate with it, or false to tell it to go away.  Your fertility decrements\n           by one if you say yes.</dd>\n           <dt>Ownership</dt>\n           <dd>The owner of any function can be obtained using Object.getOwnerOf(...).  This\n           might be used to conduct surveys of the genes currently in the cage, and adjusting\n           behaviours accordingly.</dd>\n         </dl>\n         <p>Lifecycle</p>\n         <ol>\n          <li>Each mouse (other than generation 0) is given a number of opportunites to\n          fight other mice.  The pickFight functions on each mouse are called one by\n          one as many times as needed.</li>\n          <li>Each mouse is then given a number of opportunities to mate other mice.\n          The proposeMate functions on each mouse are called one by one as many times\n          as needed.  When a mouse returns another mouse it wishes to mate with, that\n          mouse's acceptMate function is called.  If this call returns true, then a mating\n          is attempted.</li>\n          <li>If a mating is successful (proposed mouse says yes, proposed mouse has remaining\n          fertility, mice have opposite genders or are hermaphrodites), a new mouse is born.\n          This mouse will inherit traits randomly from its two parents, namely the properties\n          and the three functions.</li>\n          <li>Shortly after a mouse has run out of all its opportunities to fight and all\n          its opportunities to mate, it dies and is remove from the cage.</li>\n         </ol>\n         <p>Your mouse will die.  The question is can your genes (functions) spread across the\n         population.  There are a lot of strategies, have fun!</p>\n      </div>\n    </div>\n  </body>\n</html>\n";
$.hosts.genetics['/editorXhr'] = {};
Object.setOwnerOf($.hosts.genetics['/editorXhr'], $.physicals.Neil);
$.hosts.genetics['/editorXhr'].www = function genetics_editorXhr_www(request, response) {
  var data = {login: !!request.user, saved: false};
  try {  // ends with ... finally {response.write(JSON.stringify(data));}
    if (!request.fromSameOrigin()) {
      // Security check to ensure this is being loaded by the genetics editor.
      data.butter = 'Cross-origin referer: ' + String(request.headers.referer);
      return;
    }
    var selector;
    try {
      selector = new $.Selector(decodeURIComponent(request.parameters.selector));
    } catch (e) {
      data.butter = 'Invalid selector: ' + String(e);
      return;
    }
    if (!request.user) {
      data.butter = 'User not logged in.';
      return;
    }
    setPerms(request.user);
    // Populate the (original) value object in the reverse-lookup db.
    var mouse = selector.toValue(/*save:*/true);
    if (!$.cage.mousePrototype.isPrototypeOf(mouse)) {
      data.butter = 'Not a mouse: ' + String(request.parameters.selector);
      return;
    }

    // Evaluate src in global scope (eval by any other name, literally).
    var evalGlobal = eval;
    var butter = [];
    var functionNames = ['pickFight', 'proposeMate', 'acceptMate'];
    for (var i = 0; i < functionNames.length; i++) {
      var functionName = functionNames[i];
      var src = request.parameters[functionName];
      try {
        suspend();
        var expr = $.utils.code.rewriteForEval(src, /*forceExpression:*/true);
        var saveValue = evalGlobal(expr);
        mouse[functionName] = saveValue;
      } catch (e) {
        // TODO(fraser): Send a more informative error message.
        butter.push(functionName + ': ' + String(e));
      }
    }
    if (butter.length) {
      data.butter = butter.join('\n');
    } else {
      data.butter = 'Saved';
      data.saved = true;
    }
  } finally {
    response.write(JSON.stringify(data));
  }
};
Object.setOwnerOf($.hosts.genetics['/editorXhr'].www, $.physicals.Neil);
Object.setOwnerOf($.hosts.genetics['/editorXhr'].www.prototype, $.physicals.Neil);

$.hosts.root.subdomains.genetics = $.hosts.genetics;

