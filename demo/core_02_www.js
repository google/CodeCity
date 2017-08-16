/**
 * @license
 * Code City: Minimal webserver.
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
 * @fileoverview Minimal webserver for Code City.
 * @author cpcallen@google.com (Christopher Allen)
 */

// Web server:
$.www = {};
$.www.onConnect = function() {
  this.data = "";
}
$.www.onReceive = function(data) {
  data = data.replace(/\r/g, '');
  this.data += data;
  var i = this.data.indexOf('\n');
  if (i !== -1) {
    this.parse(this.data.substring(0, i));
    this.data = this.data.substring(i + 1);
  }
}
$.www.parse = function(line) {
  $.system.log('>>> ' + line);
  var m = line.match(/^GET (.*)$/);
  if (!m) {
    $.system.log('Unrecognized WWW command: ' + line);
    return;
  }
  connectionWrite(this, '<html><head><title>Test Page</title></head>');
  connectionWrite(this, '<body>Hello, world!</body></html>');
  connectionClose(this);
}
      

connectionListen(7780, $.www);

