/**
 * @license
 * Code City: Webserver.
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
 * @fileoverview Webserver for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

// HTTP object:
$.http = {};

// Web request object:
$.http.IncomingMessage = function() {
  this.headers = {};
  this.parameters = Object.create(null);
  // State -1: Invalid.
  // State 0: Parsing request line.
  // State 1: Parsing headers.
  // State 2: Parsing body.
  // State 3: Fully parsed.
  this.state_ = 0;
};

$.http.IncomingMessage.prototype.parse = function(line) {
  // Returns true if parsing is complete, false if more lines are needed.
  if (this.state_ === 0) {
    // Match "GET /images/logo.png HTTP/1.1"
    line = line.trim();
    var m = line.match(/^(GET|POST) +(\S+)/);
    if (!m) {
      $.system.log('Unrecognized WWW request line:', line);
      this.state_ = -1;
      return true;
    }
    this.method = m[1];
    this.url = m[2];
    this.parseUrl_(this.url);
    this.state_ = 1;
    return false;
  }
  if (this.state_ === 1) {
    line = line.trim();
    if (!line) {
      if (this.method === 'POST') {
        this.state_ = 2;
        this.data = '';
        return false;
      } else {
        this.parseParameters_(this.query);
        this.state_ = 3;
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
    if (name in this.headers) {
      var existing = this.headers[name];
      if (name === 'set-cookie') {
        // set-cookie is always an array.
        existing.push(value);
        value  = existing;
      } else if (
          $.http.IncomingMessage.parse.discardDuplicates.indexOf(name) === -1) {
        // Discard this duplicate.
        value  = existing;
      } else {
        // Append this header onto previously defined header.
        value = existing + ', ' + value;
      }
    } else {
      if (name === 'set-cookie') {
        // set-cookie is always an array.
        value = [value];
      }
    }
    this.headers[name] = value;
    return false;
  }
  if (this.state_ === 2) {
    this.data += line;
    if (this.data.length >= this.headers['content-length']) {
      this.parseParameters_(this.data);
      this.state_ = 3;
      return true;
    }
    return false;
  }
  // Invalid state?  Extra lines?  Ignore.
  return true;
};
$.http.IncomingMessage.prototype.parse.discardDuplicates = [
  'age',
  'authorization',
  'content-length',
  'content-type',
  'etag',
  'expires',
  'from',
  'host',
  'if-modified-since',
  'if-unmodified-since',
  'last-modified',
  'location',
  'max-forwards',
  'proxy-authorization',
  'referer',
  'retry-after',
  'user-agent'
];

$.http.IncomingMessage.prototype.parseUrl_ = function(url) {
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

$.http.IncomingMessage.prototype.parseParameters_ = function(data) {
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


// Web response object:
$.http.ServerResponse = function(connection) {
  this.headersSent = false;
  this.statusCode = 200;
  this.headers_ = {
    'Content-Type': 'text/html; charset=utf-8',
  };
  this.connection_ = connection;
};

$.http.ServerResponse.prototype.setHeader = function(name, value) {
  if (this.headersSent) {
    throw Error('Header already sent.');
  }
  this.headers_[name] = value;
};

$.http.ServerResponse.prototype.writeHead = function() {
  if (this.headersSent) {
    throw Error('Header already sent.');
  }
  this.headersSent = true;
  var statusMessage = $.http.STATUS_CODES[this.statusCode] || 'Unknown';
  this.connection_.write('HTTP/1.0 ' + this.statusCode + ' ' + statusMessage +
                         '\r\n');
  for (var name in this.headers_) {
    this.connection_.write(name + ': ' + this.headers_[name] + '\r\n');
  }
  this.connection_.write('\r\n');
};

$.http.ServerResponse.prototype.setStatus = function(code) {
  if (this.headersSent) {
    throw Error('Header already sent.');
  }
  this.statusCode = code;
};

$.http.ServerResponse.prototype.write = function(text) {
  if (text !== '') {
    if (!this.headersSent) {
      this.writeHead();
    }
    this.connection_.write(text);
  }
};


$.http.STATUS_CODES = Object.create(null);
$.http.STATUS_CODES[100] = 'Continue';
$.http.STATUS_CODES[101] = 'Switching Protocols';
$.http.STATUS_CODES[102] = 'Processing';
$.http.STATUS_CODES[200] = 'OK';
$.http.STATUS_CODES[201] = 'Created';
$.http.STATUS_CODES[202] = 'Accepted';
$.http.STATUS_CODES[203] = 'Non-Authoritative Information';
$.http.STATUS_CODES[204] = 'No Content';
$.http.STATUS_CODES[205] = 'Reset Content';
$.http.STATUS_CODES[206] = 'Partial Content';
$.http.STATUS_CODES[207] = 'Multi-Status';
$.http.STATUS_CODES[208] = 'Already Reported';
$.http.STATUS_CODES[226] = 'IM Used';
$.http.STATUS_CODES[300] = 'Multiple Choices';
$.http.STATUS_CODES[301] = 'Moved Permanently';
$.http.STATUS_CODES[302] = 'Found';
$.http.STATUS_CODES[303] = 'See Other';
$.http.STATUS_CODES[304] = 'Not Modified';
$.http.STATUS_CODES[305] = 'Use Proxy';
$.http.STATUS_CODES[306] = 'Switch Proxy';
$.http.STATUS_CODES[307] = 'Temporary Redirect';
$.http.STATUS_CODES[308] = 'Permanent Redirect';
$.http.STATUS_CODES[400] = 'Bad Request';
$.http.STATUS_CODES[401] = 'Unauthorized';
$.http.STATUS_CODES[402] = 'Payment Required';
$.http.STATUS_CODES[403] = 'Forbidden';
$.http.STATUS_CODES[404] = 'Not Found';
$.http.STATUS_CODES[405] = 'Method Not Allowed';
$.http.STATUS_CODES[406] = 'Not Acceptable';
$.http.STATUS_CODES[407] = 'Proxy Authentication Required';
$.http.STATUS_CODES[408] = 'Request Timeout';
$.http.STATUS_CODES[409] = 'Conflict';
$.http.STATUS_CODES[410] = 'Gone';
$.http.STATUS_CODES[411] = 'Length Required';
$.http.STATUS_CODES[412] = 'Precondition Failed';
$.http.STATUS_CODES[413] = 'Payload Too Large';
$.http.STATUS_CODES[414] = 'URI Too Long';
$.http.STATUS_CODES[415] = 'Unsupported Media Type';
$.http.STATUS_CODES[416] = 'Range Not Satisfiable';
$.http.STATUS_CODES[417] = 'Expectation Failed';
$.http.STATUS_CODES[418] = 'I\'m a teapot';
$.http.STATUS_CODES[421] = 'Misdirected Request';
$.http.STATUS_CODES[422] = 'Unprocessable Entity';
$.http.STATUS_CODES[423] = 'Locked';
$.http.STATUS_CODES[424] = 'Failed Dependency';
$.http.STATUS_CODES[426] = 'Upgrade Required';
$.http.STATUS_CODES[428] = 'Precondition Required';
$.http.STATUS_CODES[429] = 'Too Many Requests';
$.http.STATUS_CODES[431] = 'Request Header Fields Too Large';
$.http.STATUS_CODES[451] = 'Unavailable For Legal Reasons';
$.http.STATUS_CODES[500] = 'Internal Server Error';
$.http.STATUS_CODES[501] = 'Not Implemented';
$.http.STATUS_CODES[502] = 'Bad Gateway';
$.http.STATUS_CODES[503] = 'Service Unavailable';
$.http.STATUS_CODES[504] = 'Gateway Timeout';
$.http.STATUS_CODES[505] = 'HTTP Version Not Supported';
$.http.STATUS_CODES[506] = 'Variant Also Negotiates';
$.http.STATUS_CODES[507] = 'Insufficient Storage';
$.http.STATUS_CODES[508] = 'Loop Detected';
$.http.STATUS_CODES[510] = 'Not Extended';
$.http.STATUS_CODES[511] = 'Network Authentication Required';


// Web server:
$.http.connection = Object.create($.connection);

$.http.connection.onConnect = function() {
  $.connection.onConnect.apply(this);
  this.timeout = setTimeout(this.close.bind(this), 60 * 1000);
  this.request = new $.http.IncomingMessage();
  this.response = new $.http.ServerResponse(this);
};

$.http.connection.onReceive = function(data) {
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
  if (this.request.state_ === 2) {
    // Waiting for POST data, not line-delimited.
    this.onReceiveChunk(this.buffer);
    this.buffer = '';
  }
};

$.http.connection.onReceiveChunk = function(chunk) {
  if (!this.request.parse(chunk)) {
    return;  // Wait for more lines to arrive.
  }

  try {
    for (var name in $.http.router) {
      var rule = $.http.router[name];
      if (rule.regexp.test(this.request.url)) {
        rule.handler(this.request, this.response);
        return;
      }
    }
    $.pages['404'](this.request, this.response);
  } finally {
    this.close();
  }
};

$.http.connection.onEnd = function() {
  clearTimeout(this.timeout);
};


$.http.router = Object.create(null);
