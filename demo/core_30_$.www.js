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
$.www = Object.create($.connection);

$.www.onConnect = function() {
  Object.getPrototypeOf($.www).onConnect.apply(this);
  $.connection.onConnect.apply(this);
  this.done = false;
};

$.www.onReceiveLine = function(line) {
  if (this.done) {
    return;
  }
  try {
    // Match "GET <url>" or "GET <url> <junk>".
    var m = line.match(/^GET ([^ ]+)(?: |$)/);
    if (!m) {
      $.system.log('Unrecognized WWW command:', line);
      return;
    }
    // Match "/<path>?<query>".
    var url = m[1];
    m = url.match(/^\/([^?]*)(?:\?(.*))?$/);
    if (!m) {
      $.system.log('URL parser failure for:', url);
      return;
    }
    var path = m[1], params = this.parseQueryString(m[2] || '');
    for (var prefix in this.web) {
      if (!this.web.hasOwnProperty(prefix) ||
          path.substr(0, prefix.length) !== prefix) {
        continue;
      }
      this.web[prefix].call(this, path, params);
      return;
    }
    this.default();
  } finally {
    this.done = true;
    this.close();
  }
};

$.www.onEnd = function() {
  // Nothing to do.  This function just overrides default $.connection.onEnd.
};

$.www.parseQueryString = function(query) {
  /* Parse a URL query string (the bit after the '?') into a
   * JSON-style map object.  Any keys without values are mapped to
   * 'true', and if a key appears more than once then only the last
   * instance is used, so e.g.:
   *     parseQueryString('foo=1&bar=2&baz&foo=3')
   * returns:
   *     {foo: 3, bar: 2, baz: true}
   */
  var r = {};
  query.split("&").map(function(item) {
    if(!item) {
      return;
    }
    item = item.replace(/\+/g, ' ');
    var key, value, m;
    if((m = item.match(/^([^=]*)=(.*)$/))) {
      key = decodeURIComponent(m[1]);
      value = decodeURIComponent(m[2]);
    } else {
      key = decodeURIComponent(item);
      value = true;
    }
    r[key] = value;
  });
  return r;
};

$.www.default = function() {
  this.write('<html><head><title>Invalid URL</title></head>');
  this.write('<body>URL not recognized.</body></html>');
};

$.www.web = {};
