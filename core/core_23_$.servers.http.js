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
 * @fileoverview Webserver for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.servers.http = {};
$.servers.http.STATUS_CODES = (new 'Object.create')(null);
$.servers.http.STATUS_CODES[100] = 'Continue';
$.servers.http.STATUS_CODES[101] = 'Switching Protocols';
$.servers.http.STATUS_CODES[102] = 'Processing';
$.servers.http.STATUS_CODES[200] = 'OK';
$.servers.http.STATUS_CODES[201] = 'Created';
$.servers.http.STATUS_CODES[202] = 'Accepted';
$.servers.http.STATUS_CODES[203] = 'Non-Authoritative Information';
$.servers.http.STATUS_CODES[204] = 'No Content';
$.servers.http.STATUS_CODES[205] = 'Reset Content';
$.servers.http.STATUS_CODES[206] = 'Partial Content';
$.servers.http.STATUS_CODES[207] = 'Multi-Status';
$.servers.http.STATUS_CODES[208] = 'Already Reported';
$.servers.http.STATUS_CODES[226] = 'IM Used';
$.servers.http.STATUS_CODES[300] = 'Multiple Choices';
$.servers.http.STATUS_CODES[301] = 'Moved Permanently';
$.servers.http.STATUS_CODES[302] = 'Found';
$.servers.http.STATUS_CODES[303] = 'See Other';
$.servers.http.STATUS_CODES[304] = 'Not Modified';
$.servers.http.STATUS_CODES[305] = 'Use Proxy';
$.servers.http.STATUS_CODES[306] = 'Switch Proxy';
$.servers.http.STATUS_CODES[307] = 'Temporary Redirect';
$.servers.http.STATUS_CODES[308] = 'Permanent Redirect';
$.servers.http.STATUS_CODES[400] = 'Bad Request';
$.servers.http.STATUS_CODES[401] = 'Unauthorized';
$.servers.http.STATUS_CODES[402] = 'Payment Required';
$.servers.http.STATUS_CODES[403] = 'Forbidden';
$.servers.http.STATUS_CODES[404] = 'Not Found';
$.servers.http.STATUS_CODES[405] = 'Method Not Allowed';
$.servers.http.STATUS_CODES[406] = 'Not Acceptable';
$.servers.http.STATUS_CODES[407] = 'Proxy Authentication Required';
$.servers.http.STATUS_CODES[408] = 'Request Timeout';
$.servers.http.STATUS_CODES[409] = 'Conflict';
$.servers.http.STATUS_CODES[410] = 'Gone';
$.servers.http.STATUS_CODES[411] = 'Length Required';
$.servers.http.STATUS_CODES[412] = 'Precondition Failed';
$.servers.http.STATUS_CODES[413] = 'Payload Too Large';
$.servers.http.STATUS_CODES[414] = 'URI Too Long';
$.servers.http.STATUS_CODES[415] = 'Unsupported Media Type';
$.servers.http.STATUS_CODES[416] = 'Range Not Satisfiable';
$.servers.http.STATUS_CODES[417] = 'Expectation Failed';
$.servers.http.STATUS_CODES[418] = "I'm a teapot";
$.servers.http.STATUS_CODES[421] = 'Misdirected Request';
$.servers.http.STATUS_CODES[422] = 'Unprocessable Entity';
$.servers.http.STATUS_CODES[423] = 'Locked';
$.servers.http.STATUS_CODES[424] = 'Failed Dependency';
$.servers.http.STATUS_CODES[426] = 'Upgrade Required';
$.servers.http.STATUS_CODES[428] = 'Precondition Required';
$.servers.http.STATUS_CODES[429] = 'Too Many Requests';
$.servers.http.STATUS_CODES[431] = 'Request Header Fields Too Large';
$.servers.http.STATUS_CODES[451] = 'Unavailable For Legal Reasons';
$.servers.http.STATUS_CODES[500] = 'Internal Server Error';
$.servers.http.STATUS_CODES[501] = 'Not Implemented';
$.servers.http.STATUS_CODES[502] = 'Bad Gateway';
$.servers.http.STATUS_CODES[503] = 'Service Unavailable';
$.servers.http.STATUS_CODES[504] = 'Gateway Timeout';
$.servers.http.STATUS_CODES[505] = 'HTTP Version Not Supported';
$.servers.http.STATUS_CODES[506] = 'Variant Also Negotiates';
$.servers.http.STATUS_CODES[507] = 'Insufficient Storage';
$.servers.http.STATUS_CODES[508] = 'Loop Detected';
$.servers.http.STATUS_CODES[510] = 'Not Extended';
$.servers.http.STATUS_CODES[511] = 'Network Authentication Required';
$.servers.http.connection = (new 'Object.create')($.connection);
$.servers.http.connection.onConnect = function onConnect() {
  $.connection.onConnect.apply(this, arguments);
  this.timeout = setTimeout(this.close.bind(this), 60 * 1000);
  this.request = new $.servers.http.Request();
  this.response = new $.servers.http.Response(this);
};
Object.setOwnerOf($.servers.http.connection.onConnect, Object.getOwnerOf($.Jssp.OutputBuffer));
$.servers.http.connection.onReceive = function onReceive(data) {
  this.buffer += data;
  var lf;
  // Start in line-delimited mode, parsing HTTP headers.
  while ((lf = this.buffer.indexOf('\n')) !== -1) {
    try {
      this.onReceiveChunk(this.buffer.substring(0, lf + 1));
    } finally {
      this.buffer = this.buffer.substring(lf + 1);
    }
  }
  if (this.request.state_ === 'body') {
    // Waiting for POST data, not line-delimited.
    this.onReceiveChunk(this.buffer);
    this.buffer = '';
  }
};
Object.setOwnerOf($.servers.http.connection.onReceive, Object.getOwnerOf($.utils.code.rewriteForEval));
$.servers.http.connection.onReceiveChunk = function onReceiveChunk(chunk) {
  if (!this.request.parse(chunk)) {
    return;  // Wait for more lines to arrive.
  }
  var pathname = this.request.pathname;
  var obj = ($.www.hasOwnProperty(pathname) && $.www[this.request.pathname]) || $.www['404'];
  try {
    obj.www(this.request, this.response);
  } catch (e) {
    suspend();
    // TODO: report error to client, somehow.
    $.system.log(String(e) + '\n' + e.stack);
  } finally {
    this.close();
  }
};
Object.setOwnerOf($.servers.http.connection.onReceiveChunk, Object.getOwnerOf($.Jssp.OutputBuffer));
$.servers.http.connection.onEnd = function onEnd() {
  clearTimeout(this.timeout);
  $.connection.onEnd.apply(this, arguments);
};
Object.setOwnerOf($.servers.http.connection.onEnd, Object.getOwnerOf($.servers.http.connection.onReceive));
$.servers.http.connection.close = function close() {
  $.system.connectionClose(this);
};
Object.setOwnerOf($.servers.http.connection.close, Object.getOwnerOf($.servers.http.connection.onEnd));
$.servers.http.connection.close.prototype = $.connection.close.prototype;
$.servers.http.connection.onError = function onError(error) {
  // TODO(cpcallen): add check for error that occurs when relistening
  // fails at server startup from checkpoint.
  if (error.message === 'write after end' ||
      error.message === 'This socket has been ended by the other party') {
    this.connected = false;
  }
};
Object.setOwnerOf($.servers.http.connection.onError, Object.getOwnerOf($.servers.http.connection.close));
$.servers.http.connection.onError.prototype = $.connection.onError.prototype;
$.servers.http.connection.onReceiveLine = function onReceiveLine(text) {
  // Override this on child classes.
};
Object.setOwnerOf($.servers.http.connection.onReceiveLine, Object.getOwnerOf($.servers.http.connection.close));
$.servers.http.connection.onReceiveLine.prototype = $.connection.onReceiveLine.prototype;
$.servers.http.connection.write = function write(text) {
  $.system.connectionWrite(this, text);
};
Object.setOwnerOf($.servers.http.connection.write, Object.getOwnerOf($.servers.http.connection.close));
$.servers.http.connection.write.prototype = $.connection.write.prototype;
$.servers.http.Request = function Request() {
  this.headers = Object.create(null);
  this.headers.cookie = Object.create(null);
  this.parameters = Object.create(null);
  // One of 'invalid', 'request', 'headers', 'body', 'done'.
  this.state_ = 'request';
};
Object.setOwnerOf($.servers.http.Request, Object.getOwnerOf($.Jssp.OutputBuffer));
$.servers.http.Request.prototype.parse = function parse(line) {
  // Returns true if parsing is complete, false if more lines are needed.
  if (this.state_ === 'request') {
    // Match "GET /images/logo.png HTTP/1.1"
    line = line.trim();
    var m = line.match(/^(GET|POST) +(\S+)/);
    if (!m) {
      $.system.log('Unrecognized WWW request line:', line);
      this.state_ = 'invalid';
      return true;
    }
    this.method = m[1];
    this.url = m[2];
    this.parseUrl_(this.url);
    this.state_ = 'headers';
    return false;
  }
  if (this.state_ === 'headers') {
    line = line.trim();
    if (!line) {
      if (this.method === 'POST') {
        this.state_ = 'body';
        this.data = '';
        return false;
      } else {
        this.parseParameters_(this.query);
        this.state_ = 'done';
        this.data = undefined;
        return true;
      }
    }
    var m = line.match(/^([-\w]+): +(.+)$/);
    if (!m) {
      $.system.log('Unrecognized WWW header line:', line);
      return false;
    }
    var name = m[1].toLowerCase();
    var value = m[2];
    var existing = this.headers[name];
    if (name === 'cookie') {
      // Cookies are processed and presented as: request.headers.cookie.foo
      var cookies = value.split(/\s*;\s*/);
      for (var i = 0; i < cookies.length; i++) {
        var eqIndex = cookies[i].indexOf('=');
        if (eqIndex !== -1) {
          var cookieName = cookies[i].substring(0, eqIndex);
          var cookieValue = cookies[i].substring(eqIndex + 1);
          if (cookieName === 'ID') {
            // Special-case the 'ID' cookie for user login.
            // Do not expose this ID string to anyone.
            var c = cookieValue.match(/^([0-9a-f]+)_[0-9a-f]+$/);
            // m[1] is the user's account ID.
            // The second part is the salted security hash.
            // Ignore the hash unless we are creating a new account.
            if (c) {
              this.user = $.userDatabase[c[1]];
            }
          } else {
            // Regular cookie.
            existing[cookieName] = cookieValue;
          }
        }
      }
      value = existing;
    } else if (name in this.headers) {
      if ($.servers.http.IncomingMessage.discardDuplicates.includes(name)) {
        // Discard this duplicate.
        value  = existing;
      } else {
        // Append this header onto previously defined header.
        value = existing + ', ' + value;
      }
    }
    this.headers[name] = value;
    return false;
  }
  if (this.state_ === 'body') {
    this.data += line;
    if (this.data.length >= this.headers['content-length']) {
      this.parseParameters_(this.data);
      this.state_ = 'done';
      return true;
    }
    return false;
  }
  // Invalid state?  Extra lines?  Ignore.
  return true;
};
Object.setOwnerOf($.servers.http.Request.prototype.parse, Object.getOwnerOf($.servers.http.connection.close));
$.servers.http.Request.prototype.parseUrl_ = function(url) {
  // pathname: /bar/baz?data  ->  /bar/baz
  // query: /bar/baz?data  ->  data
  var qIndex = url.indexOf('?');
  if (qIndex === -1) {
    this.pathname = url;
  } else {
    this.pathname = url.substring(0, qIndex);
    this.query = url.substring(qIndex + 1);
  }
};
$.servers.http.Request.prototype.parseParameters_ = function(data) {
  if (!data) {
    return;
  }
  var vars = data.split('&');
  for (var i = 0; i < vars.length; i++) {
    var eqIndex = vars[i].indexOf('=');
    if (eqIndex === -1) {
      var name = vars[i];
      var value = true;
    } else {
      var name = vars[i].substring(0, eqIndex);
      var value = vars[i].substring(eqIndex + 1);
      value = decodeURIComponent(value.replace(/\+/g, ' '));
    }
    if (name in this.parameters) {
      // ?foo=1&foo=2&foo=3
      var array = this.parameters[name];
      if (!Array.isArray(array)) {
        array = [array];
      }
      array.push(value);
      value = array;
    }
    this.parameters[name] = value;
  }
};
$.servers.http.Request.discardDuplicates = [];
$.servers.http.Request.discardDuplicates[0] = 'authorization';
$.servers.http.Request.discardDuplicates[1] = 'content-length';
$.servers.http.Request.discardDuplicates[2] = 'content-type';
$.servers.http.Request.discardDuplicates[3] = 'from';
$.servers.http.Request.discardDuplicates[4] = 'host';
$.servers.http.Request.discardDuplicates[5] = 'if-modified-since';
$.servers.http.Request.discardDuplicates[6] = 'if-unmodified-since';
$.servers.http.Request.discardDuplicates[7] = 'max-forwards';
$.servers.http.Request.discardDuplicates[8] = 'proxy-authorization';
$.servers.http.Request.discardDuplicates[9] = 'referer';
$.servers.http.Request.discardDuplicates[10] = 'user-agent';
$.servers.http.Response = function Response(connection) {
  this.headersSent = false;
  this.statusCode = 200;
  this.headers_ = Object.create(null);
  this.cookies = [];
  this.setHeader('content-type', 'text/html; charset=utf-8');
  this.connection_ = connection;
};
Object.setOwnerOf($.servers.http.Response, Object.getOwnerOf($.Jssp.OutputBuffer));
$.servers.http.Response.prototype.setHeader = function(name, value) {
  if (this.headersSent) {
    throw new Error('Header already sent.');
  }
  // Normalize all header names as lowercase.
  name = name.toLowerCase(name);
  if (name === 'set-cookie') {
    this.cookies.push(value);
  } else {
    var existing = this.headers_[name];
    if (name in this.headers_) {
      if ($.servers.http.Response.discardDuplicates.includes(name)) {
        // Discard older duplicate.
      } else {
        // Append this header onto previously defined header.
        value = existing + ', ' + value;
      }
    }
    this.headers_[name] = value;
  }
};
delete $.servers.http.Response.prototype.setHeader.name;
Object.setOwnerOf($.servers.http.Response.prototype.setHeader, Object.getOwnerOf($.Jssp.OutputBuffer));
$.servers.http.Response.prototype.writeHead = function() {
  if (this.headersSent) {
    throw new Error('Header already sent.');
  }
  this.headersSent = true;
  var statusMessage = $.servers.http.STATUS_CODES[this.statusCode] || 'Unknown';
  this.connection_.write('HTTP/1.0 ' + this.statusCode + ' ' + statusMessage +
                         '\r\n');
  for (var name in this.headers_) {
    // Print all header names as Title-Case.
    var title = name.replace(/\w+/g, this.capitalize);
    this.connection_.write(title + ': ' + this.headers_[name] + '\r\n');
  }
  for (var i = 0; i < this.cookies.length; i++) {
    // Print all cookies.
    this.connection_.write('Set-Cookie: ' + this.cookies[i] + '\r\n');
  }
  this.connection_.write('\r\n');
};
delete $.servers.http.Response.prototype.writeHead.name;
$.servers.http.Response.prototype.writeHead.prototype.constructor = function() {
  if (this.headersSent) {
    throw new Error('Header already sent.');
  }
  this.headersSent = true;
  var statusMessage = $.servers.http.STATUS_CODES[this.statusCode] || 'Unknown';
  this.connection_.write('HTTP/1.0 ' + this.statusCode + ' ' + statusMessage +
                         '\r\n');
  for (var name in this.headers_) {
    // Print all header names as Title-Case.
    var title = name.replace(/\w+/g, this.capitalize);
    this.connection_.write(title + ': ' + this.headers_[name] + '\r\n');
  }
  for (var i = 0; i < this.cookies.length; i++) {
    // Print all cookies.
    this.connection_.write('Set-Cookie: ' + this.cookies[i] + '\r\n');
  }
  this.connection_.write('\r\n');
};
$.servers.http.Response.prototype.writeHead.prototype.constructor.prototype = $.servers.http.Response.prototype.writeHead.prototype;
Object.defineProperty($.servers.http.Response.prototype.writeHead.prototype.constructor, 'name', {value: 'writeHead'});
$.servers.http.Response.prototype.capitalize = function(txt) {
  // 'foo' -> 'Foo'
  // Assumes incoming text is already lowercase.
  return txt[0].toUpperCase() + txt.substring(1);
};
$.servers.http.Response.prototype.setStatus = function(code) {
  if (this.headersSent) {
    throw new Error('Header already sent.');
  }
  this.statusCode = code;
};
$.servers.http.Response.prototype.write = function(text) {
  if (text !== '') {
    if (!this.headersSent) {
      this.writeHead();
    }
    this.connection_.write(text);
  }
};
$.servers.http.Response.discardDuplicates = [];
$.servers.http.Response.discardDuplicates[0] = 'age';
$.servers.http.Response.discardDuplicates[1] = 'content-length';
$.servers.http.Response.discardDuplicates[2] = 'content-type';
$.servers.http.Response.discardDuplicates[3] = 'etag';
$.servers.http.Response.discardDuplicates[4] = 'expires';
$.servers.http.Response.discardDuplicates[5] = 'last-modified';
$.servers.http.Response.discardDuplicates[6] = 'location';
$.servers.http.Response.discardDuplicates[7] = 'retry-after';

