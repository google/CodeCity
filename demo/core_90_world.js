/**
 * @license
 * Code City: Demonstration database.
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

  var bob = Object.create($.user);
  bob.name = 'Bob';
  $.userDatabase['1387bfc24b159b3bd6ea187c66551d6b08f52dafb7fe5c3a5a93478f54ac6202b8f78efe5817015c250173b23a70f7f6ef3205e9f5d28730e0ff2033cc6fcf84'] = bob;
  bob.description = 'Looks a bit Canadian.';
  bob.svgText = '<path d="m 1.59,78.8 c 1.48,-6.43 3.16,-12.8 5.20,-18.9 1.71,5.85 3.26,11.5 6.06,18.5" />';
  bob.svgText += '<path d="m 0.74,99.4 c 3.18,-7.65 4.14,-15.4 6.27,-23.6 1.11,6.88 2.32,14.5 3.72,23.7" />';
  bob.svgText += '<path d="m 7.01,76.8 c -0.44,-7.45 -0.78,-14.6 -0.11,-18.7" />';
  bob.svgText += '<path d="m 6.59,58.5 c -3.47,-1.83 -6.15,-6.17 -6.06,-10.1 0.07,-3.06 2.25,-6.52 5.10,-7.65 2.94,-1.17 6.90,0.01 9.24,2.12 2.20,1.98 3.12,5.45 2.87,8.39 -0.22,2.57 -1.53,5.42 -3.72,6.80 -2.10,1.33 -5.24,1.59 -7.44,0.42 z" class="fillWhite" />';
  bob.moveTo(hangout);
  $.bob = bob;
  $.utils.selector.setSelector(bob, '$.bob');

  var alice = Object.create($.user);
  alice.name = 'Alice';
  $.userDatabase['4b567644d33ad68a38a45d3fb61e5a53a64cf261ea2516d9a3de5235e75d7490b9bd7b2dc12f64182f9b9b50ddb113f257803c1d069cbb32da1719d06a567cee'] = alice;
  alice.description = 'Mostly harmless.';
  alice.svgText = '<path d="m 7.01,77.6 c 1.6,-5.5 3.39,-12.3 5.29,-18.6 2.1,6.5 3.5,15.1 4.8,18.6" />';
  alice.svgText += '<path d="m 5.84,99.5 c 2.86,-6.7 4.56,-16.1 6.66,-24.7 2,6.6 3.9,15.9 5.9,24.7" />';
  alice.svgText += '<path d="m 12.5,75.6 c -0.6,-7.4 -0.4,-12.1 -0.1,-17" />';
  alice.svgText += '<path d="m 12.3,58.5 c 2.4,0.8 5.6,0.4 7.6,-1.2 2.5,-2 3.7,-5.8 3.3,-9 -0.3,-2.6 -2.2,-5.3 -4.6,-6.5 -3,-1.5 -7.4,-1.8 -10.1,0.2 -2.58,1.9 -3.75,6 -3.08,9.1 0.71,3.3 3.7,6.3 6.88,7.4 z" class="fillWhite" />';
  alice.svgText += '<path d="m 6.48,53.4 c -0.1,-2.2 1.1,-5.7 4.42,-3.6 6,3.8 12.3,-3.5 11.3,-4.3 l 0,0" />';
  alice.svgText += '<path d="m 6.06,52.6 c -1.34,3.2 -1.54,7.1 -1.18,10.3 -0.15,-2.5 -4.525,-7.7 -4.243,-11.4 0.403,-5.3 2.783,-5.9 4.573,-3.6 0,2.3 0.28,3.8 0.85,4.7 z" class="fillWhite" />';
  alice.moveTo(hangout);
  $.alice = alice;
  $.utils.selector.setSelector(alice, '$.alice');

  var fido = Object.create($.thing);
  fido.name = 'Fido';
  fido.aliases = ['dog'];
  fido.description = 'A happy little puppy.';
  fido.svgText = '<path d="m 15.4,98.6 c -0.1,0.2 -0.7,0.2 -1.5,0 -0.4,-0.4 0.2,-2.1 1.9,-2.3 0.1,-2.3 0.2,-5.1 -0.2,-7" class="fillWhite" />';
  fido.svgText += '<path d="m 15,85.9 c -0.8,4 5,9.9 11.2,11.7 9.7,2.4 12,-4.2 7.6,-11.2 -1.3,-2 -5.6,-7.8 -13,-5.5 2.4,-9.3 -10.6,-16 -12.22,-3.8 -5.9,2.1 -10.5,6.7 -2.5,9.8 5.02,1.9 10.82,-1.8 13.32,-4.3" class="fillWhite" />';
  fido.svgText += '<path d="m 20.8,91.5 c -0.1,1.3 -0.2,2.5 -1.4,3.8 0,1.1 0.3,2 -0.1,3.3 -0.7,1.2 -1.6,1 -2.4,1 -2.7,-0.1 -1.3,-2.3 0.1,-2.9 0.5,-3.8 -0.3,-5.7 -0.4,-8.5" class="fillWhite" />';
  fido.svgText += '<circle r="0.377" cy="77.2" cx="11.4" class="fillBlack" />';
  fido.svgText += '<path d="m 32.7,96.6 c -0.4,1 -0.7,2 -1.4,2.9 -2.2,-0.3 -5.9,0.4 -8.9,0.5 -0.6,-1.8 -0.6,-3.4 2.4,-1.8 l 2.8,-0.3 c -5.7,-4.8 0.4,-7.3 2.2,-5.6" class="fillWhite" />';
  fido.svgText += '<path d="m 20.6,75.6 c -1,4.4 -4,4.9 -4.7,-0.5 -0.2,-1.5 -1.8,-2.9 -1,-4.4" class="fillWhite" />';
  fido.svgText += '<path d="m 36,92.1 c 0,0 2.5,-2.2 4.3,-4.7 1.9,-2.8 3.6,-4 2.2,1.1 -1.1,3.7 -0.9,4.5 -6.5,5" class="fillWhite" />';
  fido.svgText += '<path d="m 40.2,84.8 c -1.2,0.7 -2,2.2 -2.6,4" class="fillWhite" />';
  fido.svgText += '<path d="m 39.1,83.2 c -1.3,0.9 -2.1,1.9 -2.4,2.8" class="fillWhite" />';
  fido.svgText += '<path d="m 44.2,90.6 c -0.6,3.5 -3.7,5.3 -5.8,5" class="fillWhite" />';
  fido.svgText += '<path d="m 44.7,95 c -0.9,1.7 -3.3,3.7 -5,2.9" class="fillWhite" />';
  fido.svgText += '<path d="m 5.88,84.2 c 0,0 -0.4,1.2 -3.1,0.8" class="fillWhite" />';
  fido.moveTo(bob);
  $.fido = fido;
  $.utils.selector.setSelector(fido, '$.fido');

  $.system.connectionListen(7777, $.servers.telnet, 100);
  $.system.connectionListen(7780, $.servers.http.connection, 100);
})();
