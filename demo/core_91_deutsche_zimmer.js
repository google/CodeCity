/**
 * @license
 * Code City: Demonstration database.
 *
 * Copyright 2018 Google Inc.
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

$.dz = Object.create($.room);

$.dz.name = 'Das deutsche Zimmer';

$.dz.translate = function(text) {
  try {
    var json = $.system.xhr('https://translate-service.scratch.mit.edu' +
        '/translate?language=de&text=' + encodeURIComponent(text));
    var r = JSON.parse(json);
    return r.result;
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
