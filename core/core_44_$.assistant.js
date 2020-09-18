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
 * @fileoverview Voice-activated assistant demo for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.assistant = (new 'Object.create')($.thing);
$.assistant.name = 'assistant';
$.assistant.contents_ = [];
$.assistant.contents_.forObj = $.assistant;
Object.defineProperty($.assistant.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.assistant.contents_.forKey = 'contents_';
Object.defineProperty($.assistant.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.assistant.svgText = '<path class="strokeBlack fillGrey" d="m-7.5,75 l-1,20 c0,1.79558 3.80387,3.25 8.5,3.25 c4.69613,0 8.5,-1.45442 8.5,-3.25 l-1-20 z"/>\n<ellipse class="strokeBlack fillGrey" cx="0" cy="75" rx="7.5" ry="3"/>';
$.assistant.onMemo = function onMemo(memo) {
  if (memo.type !== 'say') return;
  // Only listen to users, not self or other bots.
  if (!$.user.isPrototypeOf(memo.source)) return;
  // Don't respond for 1s after last successful activation.
  if (!this.lastActivated) this.lastActivated = 0;
  if (Date.now() - this.lastActivated < 1000) {
    this.location.narrate(String(this) + ' flashes its lights in confusion.');
    return;
  }
  // Look for activation pharase.
  var text = memo.text;
  var activation = new RegExp('^\\s*hey[,\\s]+' + this.name + '[,:;.!?\\s]*([^,:;.!?\\s].*)?', 'i');
  var m = activation.exec(text);
  if (!m) return;  // Didn't hear "hello, <name>".
  this.lastActivated = Date.now()
  // Process command.
  this.onCommand(m[1] || '');
};
Object.setOwnerOf($.assistant.onMemo, $.physicals.Maximilian);
$.assistant.say = function say(speech) {
  if (!this.location) return;
  var memo = {
    type: 'say',
    source: this,
    where: this.location,
    text: speech
  };
  this.location.sendMemo(memo);
};
$.assistant.onCommand = function onCommand(command) {
  /* Attempt to find a handler for command, by calling methods on this
   * named cmd_* until one of them returns true.
   */
  suspend(2000);
  var raw = String(command);
  command = command.replace(/[.,!?]*$/, '');  // Trim trailing punctuation.
  command = command.replace(/\s+/, ' ');  // Normalise whitespace.
  if (!command) {
    this.say('How can I help?');
    return;
  }
  // Look for properties on this named 'cmd_<foo>'.
  var done = false;
  for (var key in this) {
    if (key.lastIndexOf('cmd_', 0) !== 0) continue;
    var func = this[key];
    if (typeof func !== 'function') continue;
    if (func.call(this, command, raw)) {
      done = true;
      break;
    }
  }
  if (!done) this.say('Sorry, I don\'t understand "' + command + '".');
};
Object.setOwnerOf($.assistant.onCommand, $.physicals.Maximilian);
$.assistant.cmd_time = function cmd_time(command, raw) {
  // First check to see if the command looked like a request for the time.
  if (!command.match(/what time is it|what('s| is) the time/i)) return false;
  // It did.  Tell the time.
  this.say('The current time is ' + new Date().toTimeString());
  return true;
};
Object.setOwnerOf($.assistant.cmd_time, $.physicals.Maximilian);
Object.setOwnerOf($.assistant.cmd_time.prototype, $.physicals.Maximilian);
$.assistant.cmd_translate = function cmd_translate(command, raw) {
  // First check to see if the command looked like a request to translate some text.
  var m = raw.match(/(?:what\s+is|how\s+do\s+you\s+say)\s+(?:"([^"]+)"|(.*))\s+in\s+(\w+)/i);
  if (!m) return false;  // Nope; try another handler.
  // It did.  Try to tranlsate it.
  var phrase = m[1] || m[2];
  var code = this.cmd_translate.languages[m[3].toLowerCase()];
  var language = $.utils.string.capitalize(m[3]);
  if (!code) {
    this.say("Sorry; I don't know how to speak " + language);
    return true;
  }
  try {
    var translation = $.utils.string.translate(phrase, code);
    this.say('"' + phrase + '" in ' + language + ' is "' + translation + '"');
  } catch (e) {
    this.say('Sorry: I seem to have forotten how to speak ' + language + '.');
  }
  return true;
};
Object.setOwnerOf($.assistant.cmd_translate, $.physicals.Maximilian);
Object.setOwnerOf($.assistant.cmd_translate.prototype, $.physicals.Maximilian);
$.assistant.cmd_translate.languages = (new 'Object.create')(null);
$.assistant.cmd_translate.languages.german = 'de';
$.assistant.cmd_translate.languages.italian = 'it';
$.assistant.cmd_translate.languages.french = 'fr';
$.assistant._README = 'The assistant works as follows:\n\nThe .onMemo handler looks for a "say" memo from $.user.  If one is received, and no other has been received too recently, it calls .onCommand, passing it what was said.\n\nThe .onCommand handler waits a respectable amount of time (2s) and then attempts to find a handler for the command.  It canonicalises the command, and then iterates through its own and inherited properties.  Any property whose name begins with "cmd_" and whose value is a function will get called, being passed the canonicalised and raw command.\n\nEach cmd_* method is expected to do some kind of string match against the command (perhaps using a RegExp) to see if if it knows how to handle that sort of command.  If it does, it should respond (perhaps using the .say method to reply to the user) and return true.  If it does not know how to handle the command, it should return false.\n\n.onCommand will iterate through the .cmd_* methods until one of them returns true.  If none do it will announce that it did not understand the command.';
$.assistant.description = "A squat grey cylinder that looks like it's listening.";

$.assistant.location = undefined;

$.assistant.lastActivated = undefined;

$.physicals.assistant = $.assistant;

