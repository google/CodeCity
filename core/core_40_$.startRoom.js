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
 * @fileoverview Initial starting room for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.startRoom = (new 'Object.create')($.room);



$.startRoom.location = null;

$.startRoom.contents_ = [];

$.startRoom.contents_.forObj = $.startRoom;
Object.defineProperty($.startRoom.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});

$.startRoom.contents_.forKey = 'contents_';
Object.defineProperty($.startRoom.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});

$.startRoom.name = 'Hangout';

$.startRoom.description = 'A place to hang out, chat, and program.';

$.startRoom.roll = function roll(cmd) {
  var memo = {
    type: 'iframe',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1'
  };
  this.sendMemo(memo);
};
$.startRoom.roll.verb = 'roll';
$.startRoom.roll.dobj = 'none';
$.startRoom.roll.prep = 'none';
$.startRoom.roll.iobj = 'none';

$.clock = (new 'Object.create')($.thing);
$.clock.name = 'clock';
$.clock.location = $.startRoom;
$.clock.chime = function chime(silent) {
  // Chiming only.  Timer management all handled by .onTimeout.
  var hours = (new Date().getHours() %12) || 12;
  var text = [];
  for (var i = 0; i < hours; i++) {
    text.push('Bong.');
  }
  this.location.narrate(text.join(' '), undefined, this);
};
Object.setOwnerOf($.clock.chime, $.physicals.Maximilian);
$.clock.contents_ = [];
$.clock.contents_.forObj = $.clock;
Object.defineProperty($.clock.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.clock.contents_.forKey = 'contents_';
Object.defineProperty($.clock.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.clock.validate = function validate() {
  $.thing.validate.call(this);
  // Reset timer that runs the chime.
  this.onTimer();
};
Object.setOwnerOf($.clock.validate, $.physicals.Maximilian);
Object.setOwnerOf($.clock.validate.prototype, $.physicals.Maximilian);
$.clock.onTimer = function onTimer() {
  /* Function that creates a thread to call itself at the next hour
   * (and calls this.chime() if it is the right time to do so.)
   */
  var time = new Date();
  // Chime during first minute past the hour.  If we got called early
  // we'll automatically try again at (hopefully) the correct time.
  var doChime = (time.getMinutes() === 0);
  // Compute next hour in local timezone.
  time.setMilliseconds(0);
  time.setSeconds(0);
  time.setMinutes(0);
  time.setHours(time.getHours() + 1);  // Automagically increments date if required.

  // Kill any other thread associated with this clock.
  clearTimeout(this.thread_);
  // Schedule ourselves to be run again at time.
  this.thread_ = new Thread(this.onTimer, time - Date.now(), this);

  if (doChime) this.chime();
};
Object.setOwnerOf($.clock.onTimer, $.physicals.Maximilian);
Object.setOwnerOf($.clock.onTimer.prototype, $.physicals.Maximilian);
$.clock.movable = false;
$.clock.description = function description() {
  return 'It is currently ' + Date();
};
Object.setOwnerOf($.clock.description, $.physicals.Neil);
Object.setOwnerOf($.clock.description.prototype, $.physicals.Neil);
$.clock.svgText = function svgText() {
  var svg = '<circle cx="0" cy="30" r="10" class="fillWhite" />';
  var r = 10;
  for (var i = 0; i < 12; i++) {
    var a = Math.PI * 2 / 12 * i;
    var length = (i % 3 === 0) ? 2 : 1;
    var x1 = Math.sin(a) * r;
    var y1 = Math.cos(a) * r + 30;
    var x2 = Math.sin(a) * (r - length);
    var y2 = Math.cos(a) * (r - length) + 30;
    svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" />';
  }
  var now = new Date();
  var minutes = now.getMinutes() + (now.getSeconds() / 60);
  var hours = now.getHours() + (minutes / 60);
  var x1 = 0;
  var y1 = 30;
  a = minutes / 60 * Math.PI * 2 + Math.PI;
  var x2 = Math.sin(a) * -8;
  var y2 = Math.cos(a) * 8 + 30;
  svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" />';
  a = hours / 12 * Math.PI * 2 + Math.PI;
  var x2 = Math.sin(a) * -6;
  var y2 = Math.cos(a) * 6 + 30;
  svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" />';
  return svg;
};
Object.setOwnerOf($.clock.svgText, $.physicals.Neil);


