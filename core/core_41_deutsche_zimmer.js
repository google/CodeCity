/**
 * @license
 * Copyright 2018 Google LLC
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
 * @fileoverview Translation room and tutorial  demo for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.physicals['Das deutsche Zimmer'] = (new 'Object.create')($.room);
$.physicals['Das deutsche Zimmer'].name = 'Das deutsche Zimmer';
$.physicals['Das deutsche Zimmer'].translate = function translate(text) {
  /* Try to translate text into German.  If successful, return
   * translation.  If not, narrate an indication of failure and return
   * the original text untranslated.
   */
  try {
    return $.utils.string.translate(text, 'de');
  } catch (e) {
    this.narrate('There is a crackling noise.');
    return text;
  }
};
Object.setOwnerOf($.physicals['Das deutsche Zimmer'].translate, $.physicals.Maximilian);
$.physicals['Das deutsche Zimmer'].say = function say(cmd) {
  // Format:  "Hello.    -or-    say Hello.
  var text = (cmd.cmdstr[0] === '"') ? cmd.cmdstr.substring(1) : cmd.argstr;
  cmd.cmdstr = [];
  cmd.argstr = this.translate(text);
  return $.room.say.call(this, cmd);
};
Object.setOwnerOf($.physicals['Das deutsche Zimmer'].say, $.physicals.Maximilian);
$.physicals['Das deutsche Zimmer'].say.verb = 'say|".*';
$.physicals['Das deutsche Zimmer'].say.dobj = 'any';
$.physicals['Das deutsche Zimmer'].say.prep = 'any';
$.physicals['Das deutsche Zimmer'].say.iobj = 'any';
$.physicals['Das deutsche Zimmer'].contents_ = [];
$.physicals['Das deutsche Zimmer'].contents_.forObj = $.physicals['Das deutsche Zimmer'];
Object.defineProperty($.physicals['Das deutsche Zimmer'].contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.physicals['Das deutsche Zimmer'].contents_.forKey = 'contents_';
Object.defineProperty($.physicals['Das deutsche Zimmer'].contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.physicals['Das deutsche Zimmer'].location = null;

$.tutorial = (new 'Object.create')($.thing);
$.tutorial.name = 'tutorial';
$.tutorial.description = 'A tutorial on how to use the Google Translate API from within Code City.  To begin, pick it up and then look at it again.';
$.tutorial.svgText = '<path class="fillWhite" d="M-15,99 L0,79 H15 L0,99 Z"/>\n<line x1="2" x2="11" y1="81" y2="81"/>\n<line x1="0" x2="9" y1="83" y2="83"/>\n<line x1="-2" x2="4" y1="85" y2="85"/>';
$.tutorial.look = function look(cmd) {
  if (this.location !== cmd.user) {
    // Show description, encouraging user to pick up tutorial.
    $.thing.look.call(this, cmd);
    return;
  }
  this.show(cmd.user);  // Show current step.
};
Object.setOwnerOf($.tutorial.look, $.physicals.Maximilian);
$.tutorial.look.verb = 'l(ook)?';
$.tutorial.look.dobj = 'this';
$.tutorial.look.prep = 'none';
$.tutorial.look.iobj = 'none';
$.tutorial.reset = function reset(cmd) {
  this.checkLocation();
  this.step = 0;
  this.room = undefined;
  this.origFunc = undefined;
  if (this.user) this.show();
};
Object.setOwnerOf($.tutorial.reset, $.physicals.Maximilian);
$.tutorial.reset.verb = 'reset';
$.tutorial.reset.dobj = 'this';
$.tutorial.reset.prep = 'none';
$.tutorial.reset.iobj = 'none';
$.tutorial.continue = function continueVerb(cmd) {
  this.step++;
  this.run();
  this.show();
};
Object.setOwnerOf($.tutorial.continue, $.physicals.Maximilian);
$.tutorial.continue.verb = 'continue';
$.tutorial.continue.dobj = 'this';
$.tutorial.continue.prep = 'none';
$.tutorial.continue.iobj = 'none';
$.tutorial.getCommands = function getCOmmands(who) {
  var commands = $.thing.getCommands.call(this, who);
  if (this.location === who) {
    commands.push('continue ' + this.name);
    commands.push('reset ' + this.name);
  }
  return commands;
};
Object.setOwnerOf($.tutorial.getCommands, $.physicals.Maximilian);
$.tutorial.moveTo = function moveTo(dest) {
  // Set this.user th the $.user holding us, or to undefined if not held.
  var r = $.thing.moveTo.call(this, dest);
  this.checkLocation();
  return r;
};
Object.setOwnerOf($.tutorial.moveTo, $.physicals.Maximilian);
$.tutorial.checkLocation = function checkLocation() {
  if ($.user.isPrototypeOf(this.location)) {
    this.user = this.location;
    this.thread = new Thread(this.check, 0, this);
  } else {
    this.user = undefined;
    if (this.t) {
      Thread.kill(this.thread);
      this.thread = null;
    }
  }
};
Object.setOwnerOf($.tutorial.checkLocation, $.physicals.Maximilian);
$.tutorial.check = function check() {
  while (true) {
    var step = this.step;
    switch (step) {
      case 1:
        // See if user has done step 1: are they carrying a room?
        if (this.room) throw new Error('How is .room set already??');
        for (var key in $.physicals) {
          var item = $.physicals[key];
          if ($.room.isPrototypeOf(item) &&
              Object.getOwnerOf(item) === this.user &&
              item.name.match(/Deutsche Zimmer/i)) {
            this.room = item;
            break;
          }
        }
        if (this.room) this.step++;
        break;

      case 3:
        if (Object.getOwnPropertyDescriptor(this.room, 'description')) {
          this.step++;
        }
        break;

      case 5:
        var pd = Object.getOwnPropertyDescriptor(this.room, 'translate');
        if (pd && typeof pd.value === 'function') {
          this.origFunc = pd.value;
          var tutorial = this;
          this.room.translate = function translateHook() {
            // This is just a hook to help automate the tutorial.
            if (tutorial.step === 6) tutorial.step++;
            // Restore and call original version of the function.
            this.translate = tutorial.origFunc;
            tutorial.origFunc = undefined;
            new Thread(function() {
              tutorial.run();
              tutorial.show();
            }, 500);
            return this.translate.apply(this, arguments);
          };
          this.step++;
        }
        break;

      case 6:
        // Handled by hook function installed in step 5.
        break;

      case 7:
        var pd = Object.getOwnPropertyDescriptor(this.room, 'say');
        if (pd && typeof pd.value === 'function') {
          this.origFunc = this.room.translate;
          var tutorial = this;
          this.room.translate = function() {
            // This is just a hook to help automate the tutorial.
            if (tutorial.step === 8) tutorial.step++;
            // Restore and call original version of the function.
            this.translate = tutorial.origFunc;
            tutorial.origFunc = undefined;
            new Thread(function() {
              tutorial.run();
              tutorial.show();
            }, 500);
            return this.translate.apply(this, arguments);
          };
          this.step++;
        }
        break;

      case 8:
        // Handled by hook function installed in step 7.
        break;

      default:
        // Nothing to do.
    }
    if (this.step !== step) {
      this.run();
      this.show();
    }
    suspend(1000);
  }
};
Object.setOwnerOf($.tutorial.check, $.physicals.Maximilian);
$.tutorial.run = function run() {
  switch (this.step) {
    case 3:
      if (this.room.location !== null) this.room.moveTo(null);
      if (this.user.location !== this.room) this.user.moveTo(this.room);
      break;

    case 5:
      // Open room in the code editor.
      var link = '/code?' + encodeURIComponent($.Selector.for(this.room).toString() + '.translate');
      this.user.readMemo({type: "link", href: link});
      break;

    default:
      // Nothing to do.
  }
};
Object.setOwnerOf($.tutorial.run, $.physicals.Maximilian);
$.tutorial.show = function show() {
  var lines;
  var step = this.step;
  switch(step) {
    case 0:
      lines = [
        '<h1>Translation API Tutorial</h1>',
        '<p>This tutorial will teach you how to use the Google machine',
        'translation API to create a room that will automatically',
        'translate everything said to the language of your choice.</p>',
        '<p>Type <cmd>continue tutorial</cmd> to continue.</p>'
      ];
      break;

    case 1:
      lines = [
        '<h2>Step 1: Create a new room</h2>',
        '<p>Run the following command:</p>',
        '<cmd>create $.room as Deutsche Zimmer</cmd>',
        '<p>(Click to run, or type your own variation.)</p>',
      ];
      break;

    case 2:
      lines = [
        '<h2>Step 2: Move to the newly-created room</h2>',
        '<p>You\'ve created a room named "' + this.room.name + '".  Now type',
        "<cmd>continue tutorial</cmd> and you'll be transported there",
        'automagically.</p>',
      ];
      break;

    case 3:
      lines = [
        '<h2>Step 3: Give your new room a description</h3>',
        "<p>You're now in you're newly-created room.  Let's give it a",
        'description using the eval command:</p>',
        '<cmd>eval here.description = "Wir sprechen Deutsch hier."</cmd>',
      ];
      break;

    case 4:
      lines = [
        '<h2>Step 4: Open code editor</h2>',
        "<p>We'll use the code editor to add a translate method to this room.",
        'When you type <cmd>continue tutorial</cmd> the code inspector/editor',
        'will open in another tab.  (You might need to enable pop-ups!)',
        'Click back to this tab to see the next set of instructions.',
      ];
      break;

    case 5:
      lines = [
        '<h2>Step 5: Add a translate() method</h2>',
        '<p>Make sure the status bar of the code inspector says',
        '$.tutorial.room.translate, then replace "undefined" with the',
        'following code (and save it):</p>',
        '<pre>',
        'function translate(text) {',
        '  // Try to translate text into German.  If successful, return the translation.',
        '  // If not, narrate an indication of failure and return the original text.',
        '  try {',
        "    var json = $.system.xhr('https://translate-service.scratch.mit.edu' +",
        "        '/translate?language=de&text=' + encodeURIComponent(text));",
        '    return JSON.parse(json).result;',
        '  } catch (e) {',
        "    this.narrate('There is a crackling noise.');",
        '    return text;',
        '  }',
        '};',
        '</pre>',
      ];
      break;

    case 6:
      lines = [
        '<h2>Step 6: Test the translate() method</h2>',
        '<p>Let\'s use the eval command to test the the new translate',
        'method:</p>',
        '<cmd>eval here.translate("Good morning.")</cmd>',
        '<p>You should see output that looks like this:</p>',
        '<p>=> "Guten Morgen."</p>',
      ];
      break;

    case 7:
      lines = [
        '<h2>Step 7: Override the "say" verb</h2>',
        '<p>Use the top part of the inspector to navigate to the "say"',
        'function, and replace it with the following:</p>',
        '<pre>',
        'function say(cmd) {',
        '  // Format:  "Hello.    -or-    say Hello.',
        '  var text = (cmd.cmdstr[0] === \'"\') ? cmd.cmdstr.substring(1) : cmd.argstr;',
        '  cmd.cmdstr = [];',
        '  cmd.argstr = this.translate(text);',
        '  return $.room.say.call(this, cmd);',
        '}',
        '</pre>',
      ];
      break;

    case 8:
      lines = [
        '<h2>Step 8: Test out the new "say" verb</h2>',
        '<p>The function you created in the last step, $.tutorial.room.say,',
        'overrides the default $.room.say function by translating the text to',
        'be said and then passing it along to the latter to actually say.</p>',
        "<p>Let's test it it out by saying something!:</p>",
        '<cmd>say Now I can speak German!</cmd>',
      ];
      break;

    case 9:
      lines = [
        '<h2>Step 9: Finish up</h2>',
        "<p>Feel free to hang around an play with the room you've created.",
        'Can you change the language it translates into?',
        '(Hint: look in $.tutorial.room.translate, and remever that "de" is',
        'the two-letter code for the German language.)</p>',
        "<p>When you're done, type <cmd>continue tutorial</cmd> and you'll",
        'be taken back to where you came from.  You can delete this room ',
        'when you no longer want it by typing <cmd>destroy ' +
        $.Selector.for(this.room).toString() + '</cmd>.',
      ];
      break;

    case 10:
      this.user.moveTo($.startRoom);
      this.room = undefined;
      // FALLTTHROUGH
    default:
      lines = [
        '<h2>Tutorial Ended</h2>',
        "You've either finished the tutorial, or you've found a bug in it.",
        'Either way: contratulations!</p>',
        '<p>You can always <cmd>reset tutorial</cmd> to do it all again.</p>',
      ];
  }
  this.user.readMemo({type: 'html', htmlText: lines.join('\n')});
};
Object.setOwnerOf($.tutorial.show, $.physicals.Maximilian);
$.tutorial.contents_ = [];
$.tutorial.contents_.forObj = $.tutorial;
Object.defineProperty($.tutorial.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.tutorial.contents_.forKey = 'contents_';
Object.defineProperty($.tutorial.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});

$.tutorial.location = undefined;

$.tutorial.user = undefined;

$.tutorial.thread = undefined;

$.tutorial.step = undefined;

$.tutorial.room = undefined;

$.tutorial.origFunc = undefined;

$.physicals.tutorial = $.tutorial;

