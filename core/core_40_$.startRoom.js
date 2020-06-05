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
 * @fileoverview Demonstration database for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

// Set up a room, two users, and a dog.
(function () {
  var hangout = Object.create($.room);
  hangout.name = 'Hangout';
  hangout.description = 'A place to hang out, chat, and program.';
  hangout.roll = function(cmd) {
    var json = {
      type: 'iframe',
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1'
    };
    this.tellAll(json);
  };
  hangout.roll.verb = 'roll';
  hangout.roll.dobj = 'none';
  hangout.roll.prep = 'none';
  hangout.roll.iobj = 'none';
  $.startRoom = hangout;
  $.utils.selector.setSelector(hangout, '$.startRoom');

  var clock = Object.create($.thing);
  clock.name = 'clock';
  clock.getDescription = function() {
    return 'It is currently ' + Date();
  };
  clock.getSvgText = function() {
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
    var now = new Date;
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
  clock.moveTo(hangout);
  clock.chime = function(silent) {
    var msPerMinute = 60 * 1000;
    var msPerHour = 60 * msPerMinute;
    var now = new Date;
    var hours = (now.getHours() % 12) || 12;
    var nextHour = msPerHour - (now.getTime() % msPerHour);
    if (nextHour < msPerMinute && !silent) {
      // Next hour is less than a minute away, we got called a wee bit too soon.
      // Schedule for the next hour.
      nextHour += msPerHour;
      // Round current hour up to the next hour.
      hours++;
    }
    setTimeout(clock.chime.bind(clock), nextHour);
    if (!silent) {
      var text = [];
      while (hours--) {
        text.push('Bong.');
      }
      this.location.narrateAll(text.join(' '), this);
    }
  };
  clock.chime(true);
  $.clock = clock;
  $.utils.selector.setSelector(hangout, '$.clock');

  $.system.connectionListen(7777, $.servers.telnet, 100);
  $.system.connectionListen(7780, $.servers.http.connection, 100);
})();
