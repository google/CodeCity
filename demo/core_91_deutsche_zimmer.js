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
 * @fileoverview Deutsche Zimmer demo for Code City.
 * @author cpcallen@google.com (Christopher Allen)
 */

///////////////////////////////////////////////////////////////////////////////
// Deutsche Zimmer (fixed example, in case of tutorial demo trouble):
//
$.dz = Object.create($.room);

$.dz.name = 'Das deutsche Zimmer';

$.dz.translate = function(text) {
  // Try to translate text into German.  If successful, return
  // translation.  If not, narrate an indication of failure and return
  // the original text untranslated.
  try {
    var json = $.system.xhr('https://translate-service.scratch.mit.edu' +
        '/translate?language=de&text=' + encodeURIComponent(text));
    return JSON.parse(json).result;
  } catch (e) {
    this.narrateAll('There is a crackling noise.');
    return text;
  }
};

$.dz.say = function(cmd) {
  // Format:  "Hello.    -or-    say Hello.
  var text = (cmd.cmdstr[0] === '"') ? cmd.cmdstr.substring(1) : cmd.argstr;
  cmd.cmdstr = [];
  cmd.argstr = this.translate(text);
  return $.room.say.call(this, cmd);
};
$.dz.say.verb = 'say|".*';
$.dz.say.dobj = 'any';
$.dz.say.prep = 'any';
$.dz.say.iobj = 'any';

///////////////////////////////////////////////////////////////////////////////
// Translation Room tutorial

$.tutorial = Object.create($.thing);
$.tutorial.name = 'tutorial';
$.tutorial.description = 'A tutorial on how to use the Google Translate API ' +
    'from within Code City.  To begin, pick it up and then look at it again.';
$.tutorial.svgText = [
  '<path class=\"fillWhite\" d="M-15,99 L0,79 H15 L0,99 Z"/>',
  '<line x1="2" x2="11" y1="81" y2="81"/>',
  '<line x1="0" x2="9" y1="83" y2="83"/>',
  '<line x1="-2" x2="4" y1="85" y2="85"/>',
].join('\n');

$.tutorial.look = function(cmd) {
  if (this.location !== cmd.user) {
    // Show description, encouraging user to pick up tutorial.
    $.thing.look.call(this, cmd);
    return;
  }
  this.show(cmd.user);  // Show current step.
};
$.tutorial.look.verb = 'l(ook)?';
$.tutorial.look.dobj = 'this';
$.tutorial.look.prep = 'none';
$.tutorial.look.iobj = 'none';

$.tutorial.user = undefined;
$.tutorial.thread = null;
$.tutorial.step = 0;
$.tutorial.room = undefined;
$.tutorial.origFunc = undefined;

$.tutorial.reset = function(cmd) {
  this.checkLocation();
  this.step = 0;
  this.room = undefined;
  this.origFunc = undefined;
  this.show();
};
$.tutorial.reset.verb = 'reset';
$.tutorial.reset.dobj = 'this';
$.tutorial.reset.prep = 'none';
$.tutorial.reset.iobj = 'none';
$.tutorial.moveTo($.startRoom);

$.tutorial.continue = function(cmd) {
  this.step++;
  this.run();
  this.show();
};
$.tutorial.continue.verb = 'continue';
$.tutorial.continue.dobj = 'this';
$.tutorial.continue.prep = 'none';
$.tutorial.continue.iobj = 'none';
$.tutorial.moveTo($.startRoom);

$.tutorial.getCommands = function(who) {
  var commands = $.thing.getCommands.call(this, who);
  if (this.location === who) {
    commands.push('continue ' + this.name);
    commands.push('reset ' + this.name);
  }
  return commands;
};

$.tutorial.moveTo = function(dest) {
  // Set this.user th the $.user holding us, or to undefined if not held.
  var r = $.thing.moveTo.call(this, dest);
  this.checkLocation();
  return r;
};

$.tutorial.checkLocation = function() {
  if ($.user.isPrototypeOf(this.location)) {
    this.user = this.location;
    this.thread = new Thread(this.check.bind(this));
  } else {
    this.user = undefined;
    if (this.t) {
      Thread.kill(this.thread);
      this.thread = null;
    }
  }
};

$.tutorial.check = function() {
  while (true) {
    var step = this.step;
    switch (step) {
      case 1:
        // See if user has done step 1: are they carrying a room?
        if (this.room) throw new Error('How is .room set already??');
        this.room = this.user.getContents().find(function(item) {
          var props = Object.getOwnPropertyNames(item);
          return $.room.isPrototypeOf(item) && props.length === 2;
        });
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
          this.room.translate = function() {
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

$.tutorial.run = function() {
  switch (this.step) {
    case 3:
      if (this.room.location !== null) this.room.moveTo(null);
      if (this.user.location !== this.room) this.user.moveTo(this.room);
      break;

    case 5:
      // Open room in the code editor.
      var link = '/code?' + encodeURIComponent('$.tutorial.room.translate');
      this.user.writeJson({type: "link", href: link});
      break;

    default:
      // Nothing to do.
  }
};

$.tutorial.show = function() {
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
        '  // Try to translate text into German.  If successful, return',
        '  // translation. If not, narrate an indication of failure and return',
        '  // the original text untranslated.',
        '  try {',
        "    var json = $.system.xhr('https://translate-service.scratch.mit.edu' +",
        "        '/translate?language=de&text=' + encodeURIComponent(text));",
        '    return JSON.parse(json).result;',
        '  } catch (e) {',
        "    this.narrateAll('There is a crackling noise.');",
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
        'function(cmd) {',
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
        "be taken back to where you came from.  JavaScript's garbage",
        "collector will automatically delete this room when it's no longer in",
        'use.</p>',
      ];
      break;

    case 10:
      this.user.moveTo($.startRoom);
      this.room = undefined;
      // FALL THROUGH
    default:
      lines = [
        '<h2>Tutorial Ended</h2>',
        "You've either finished the tutorial, or you've found a bug in it.",
        'Either way: contratulations!</p>',
        '<p>You can always <cmd>reset tutorial</cmd> to do it all again.</p>',
      ];
  }
  this.user.writeJson({type: 'html', htmlText: lines.join('\n')});
};
