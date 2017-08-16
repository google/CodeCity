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
};
$.www.onReceive = function(data) {
  data = data.replace(/\r/g, '');
  this.data += data;
  var i = this.data.indexOf('\n');
  if (i !== -1) {
    this.parse(this.data.substring(0, i));
    this.data = this.data.substring(i + 1);
  }
};
$.www.parse = function(line) {
  var m = line.match(/^GET (.*)$/);
  if (!m) {
    $.system.log('Unrecognized WWW command: ' + line);
    return;
  }
  var path = m[1];
  if ((m = path.match(/\/edit\/(\$(?:\.[a-zA-Z0-9_$]+)*)(?:\?src=([^ ]*))?/))) {
    m = m.map(function(s) {
      if (s === undefined) {
        return s;
      }
      return decodeURIComponent(s.replace(/\+/g, ' '));
    });
    this.edit(m[1], m[2]);
  } else {
    this.default();
  }
  connectionClose(this);
};
$.www.edit = function(path, src) {
  var editor = '';
  if (src) {
    try {
      // TODO: don't eval.
      eval(src);
      editor += 'Saved!<br>';
    } catch (e) {
      editor += 'ERROR: ' + String(e);
      $.system.log(src);
      $.system.log(e);
    }
  } else {
    var v = eval(path);
    src = path + ' = ' +
        (typeof v === 'string' ?
        "'" + v.replace(/[\\']/g, '\$&') + "'" :
        String(v));
  }
  editor += '<form action="' + path + '" method="get">';
  // TODO: don't eval.
  editor += '<textarea name="src">' + $.utils.htmlEscape(src) + '</textarea>';
  editor += '<br/>';
  editor += '<button type="reset">Revert</button>';
  editor += '<button type="submit">Save</button>';
  editor += '</form>';

  connectionWrite(this, '<html><head><title>Code Editor for ' +
      $.utils.htmlEscape(path) + '</title></head>');
  connectionWrite(this, '<body>' + editor + '</body></html>');
};
$.www.default = function() {
  connectionWrite(this, '<html><head><title>Invalid URL</title></head>');
  connectionWrite(this, '<body>URL not recognized.</body></html>');
};

connectionListen(7780, $.www);

