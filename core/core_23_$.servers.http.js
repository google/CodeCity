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
Object.setOwnerOf($.servers.http.connection.onConnect, $.physicals.Maximilian);
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
Object.setOwnerOf($.servers.http.connection.onReceive, $.physicals.Neil);
$.servers.http.connection.onReceiveChunk = function onReceiveChunk(chunk) {
  if (this.request.parse(chunk)) {
    this.handle_();
  }
  // Otherwise wait for more lines to arrive.
};
Object.setOwnerOf($.servers.http.connection.onReceiveChunk, $.physicals.Maximilian);
$.servers.http.connection.onEnd = function onEnd() {
  clearTimeout(this.timeout);
  $.connection.onEnd.apply(this, arguments);
};
Object.setOwnerOf($.servers.http.connection.onEnd, $.physicals.Neil);
$.servers.http.connection.handle_ = function handle_() {
  /* Route this connection to a hander, invoke the handler, and deal with the
   * aftermath.
   */
  try {
    var subdomain = (this.request.subdomain || 'www') + '.';
    var pathname = this.request.pathname;
    var domainObj = ($.http.hasOwnProperty(subdomain) && $.http[subdomain]);
    if (!domainObj) {
      this.response.sendError(404, 'Invalid subdomain "' +
                              $.utils.html.escape(this.request.subdomain) +
                              '".');
      return;
    }
    var obj = (domainObj.hasOwnProperty(pathname) && domainObj[pathname]);
    if (!obj) {
      this.response.sendError(404);
      return;
    }
    obj.www(this.request, this.response);
  } catch (e) {
    suspend();
    $.system.log(String(e) + '\n' + e.stack);
    if (this.response.headersSent) {
      // Too late to return a proper error page.  Oh well.
      this.response.write('<pre>' +
                          $.utils.html.escape(String(e) + '\n' + e.stack) +
                          '</pre>');
    } else {
      this.response.sendError(500, e);
    }
  } finally {
    this.close();
  }
};
Object.setOwnerOf($.servers.http.connection.handle_, $.physicals.Maximilian);
$.servers.http.Request = function Request() {
  this.headers = Object.create(null);
  this.headers.cookie = Object.create(null);
  this.parameters = Object.create(null);
  // One of 'invalid', 'request', 'headers', 'body', 'done'.
  this.state_ = 'request';
};
Object.setOwnerOf($.servers.http.Request, $.physicals.Maximilian);
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
      this.parseSubdomain_();
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
              this.user = $.userDatabase.get(c[1]);
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
    // POST data.
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
Object.setOwnerOf($.servers.http.Request.prototype.parse, $.physicals.Neil);
$.servers.http.Request.prototype.parseUrl_ = function parseUrl_(url) {
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
Object.setOwnerOf($.servers.http.Request.prototype.parseUrl_, $.physicals.Neil);
$.servers.http.Request.prototype.parseParameters_ = function parseParameters_(data) {
  if (!data) {
    return;
  }
  var vars = data.split('&');
  var name, value;
  for (var i = 0; i < vars.length; i++) {
    var eqIndex = vars[i].indexOf('=');
    if (eqIndex === -1) {
      name = vars[i];
      value = true;
    } else {
      name = vars[i].substring(0, eqIndex);
      value = vars[i].substring(eqIndex + 1);
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
Object.setOwnerOf($.servers.http.Request.prototype.parseParameters_, $.physicals.Neil);
$.servers.http.Request.prototype.parseSubdomain_ = function parseSubdomain_() {
  var subdomain = 'www';
  if ($.servers.http.subdomains) {
    if (this.headers.host) {
      // Extract the wildcard subdomain.
      // E.g. https://foo.example.codecity.world/bar -> foo
      if (parseSubdomain_.hostStringCache_ !== $.servers.http.host) {
        parseSubdomain_.hostStringCache_ = $.servers.http.host;
        parseSubdomain_.hostRegExpCache_ = new RegExp('^([-A-Za-z0-9]+)\\.' +
            $.utils.regexp.escape(parseSubdomain_.hostStringCache_) + '$');
      }
      var m = this.headers.host.match(parseSubdomain_.hostRegExpCache_);
      if (m) {
        subdomain = m[1];
      }
    }
  } else {
    // Extract the first directory.
    // E.g. https://example.codecity.world/foo/bar -> foo
    var m = this.pathname.match(/^\/([-A-Za-z0-9]+)(\/.*)?$/);
    if (m) {
      subdomain = m[1];
      this.pathname = m[2] || '/';
    }
  }
  this.subdomain = subdomain;
};
Object.setOwnerOf($.servers.http.Request.prototype.parseSubdomain_, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.Request.prototype.parseSubdomain_.prototype, $.physicals.Neil);
$.servers.http.Request.prototype.parseSubdomain_.hostStringCache_ = 'google.codecity.world';
$.servers.http.Request.prototype.parseSubdomain_.hostRegExpCache_ = /^([-A-Za-z0-9]+)\.google\.codecity\.world$/;
Object.setOwnerOf($.servers.http.Request.prototype.parseSubdomain_.hostRegExpCache_, $.physicals.Neil);
$.servers.http.Request.prototype.fromSameOrigin = function fromSameOrigin() {
  /* Determines if the previous page and the requested page are from the same
   * origin.  Normally this means that they are from the same subdomain.
   * However, if $.servers.http.subdomains is set to false, then the first
   * directory name is used for comparison.
   * Returns true or false, or (in the case of missing headers) undefined.
   * Callers should choose whether to fail-safe or fail-deadly when the
   * user's proxy strips the referer header, resulting in undefined.
   */
  var referer = this.headers.referer; // https://foo.example.codecity.world/bar
  var host = this.headers.host;  // foo.example.codecity.world
  if (!referer || !host) {
    // Missing headers.  Not enough information to know.
    return undefined;
  }
  var regex = new RegExp('^https?://' + $.utils.regexp.escape(host) + '/');
  if (!regex.test(referer)) {
    // Referer is from a different host.
    return false;
  }
  if ($.servers.http.subdomains) {
    // In subdomain mode, only the host must match.
    return true;
  }
  // In non-subdomain mode, the first directory must match too.
  var m = referer.match(/^https?:\/\/[^\/]+\/([-A-Za-z0-9]+)(\/|$)/);
  var subdomain = m ? m[1] : 'www';
  return subdomain === this.subdomain;
};
Object.setOwnerOf($.servers.http.Request.prototype.fromSameOrigin, $.physicals.Neil);
Object.setOwnerOf($.servers.http.Request.prototype.fromSameOrigin.prototype, $.physicals.Neil);
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
  this.headers_ = Object.create(Response.defaultHeaders);
  this.cookies = [];
  this.setHeader('content-type', 'text/html; charset=utf-8');
  this.connection_ = connection;
};
Object.setOwnerOf($.servers.http.Response, $.physicals.Maximilian);
$.servers.http.Response.prototype.setHeader = function setHeader(name, value) {
  if (this.headersSent) {
    throw new Error('header already sent');
  }
  value = String(value).trim();
  if (value.includes('\n') || value.includes('\r')) {
    throw new RangeError('invalid header value');
  }
  // Normalize all header names as lowercase.
  name = String(name).toLowerCase(name);
  if (name === 'set-cookie') {
    if (/^\s*ID\s*=/.test(value)) {
      throw new PermissionError('not allowed to set ID cookie');
    }
    this.cookies.push(value);
  } else {
    var existing = Object.getOwnPropertyDescriptor(this.headers_, name);
    if (existing) {  // Header already set for this Response specifically.
      if ($.servers.http.Response.discardDuplicates.includes(name)) {
        // Overwrite existing value.
      } else {
        // Append this header onto previously defined header.
        value = existing.value + ', ' + value;
      }
    }
    this.headers_[name] = value;
  }
};
Object.setOwnerOf($.servers.http.Response.prototype.setHeader, $.physicals.Maximilian);
$.servers.http.Response.prototype.writeHead = function writeHead() {
  if (this.headersSent) {
    throw new Error('Header already sent.');
  }
  this.headersSent = true;
  var statusMessage = $.servers.http.STATUS_CODES[this.statusCode] || 'Unknown';
  this.connection_.write('HTTP/1.0 ' + this.statusCode + ' ' + statusMessage +
                         '\r\n');
  for (var name in this.headers_) {
    // Print all header names as Title-Case.
    var title = name.replace(/\w+/g, $.utils.string.capitalize);
    this.connection_.write(title + ': ' + this.headers_[name] + '\r\n');
  }
  for (var i = 0; i < this.cookies.length; i++) {
    // Print all cookies.
    this.connection_.write('Set-Cookie: ' + this.cookies[i] + '\r\n');
  }
  this.connection_.write('\r\n');
};
Object.setOwnerOf($.servers.http.Response.prototype.writeHead, $.physicals.Maximilian);
$.servers.http.Response.prototype.setStatus = function setStatus(statusCode) {
  /* Set the status code for this Response.
   * Must be called before .writeHead().
   *
   * - statusCode: number - the HTTP status code to return.
   */
  if (!(statusCode in $.servers.http.STATUS_CODES)) {
    throw new RangeError('invalid HTTP status code ' + statusCode);
  }
  if (this.headersSent) {
    throw new Error('header already sent.');
  }
  this.statusCode = statusCode;
};
Object.setOwnerOf($.servers.http.Response.prototype.setStatus, $.physicals.Maximilian);
$.servers.http.Response.prototype.write = function write(text) {
  text = String(text);
  if (text !== '') {
    if (!this.headersSent) {
      this.writeHead();
    }
    this.connection_.write(text);
  }
};
Object.setOwnerOf($.servers.http.Response.prototype.write, $.physicals.Neil);
$.servers.http.Response.prototype.clearIdCookie = function clearIdCookie() {
  // TODO: Security check goes here.  Should be only callable by logout.
  if (this.headersSent) {
    throw new Error('Header already sent');
  }
  var domain = $.servers.http.subdomains ? ' Domain=' + $.servers.http.host : '';
  var value = 'ID=; HttpOnly;' + domain + '; Path=/; Max-Age=0;';
  this.cookies.push(value);
};
Object.setOwnerOf($.servers.http.Response.prototype.clearIdCookie, $.physicals.Neil);
Object.setOwnerOf($.servers.http.Response.prototype.clearIdCookie.prototype, $.physicals.Neil);
$.servers.http.Response.prototype.sendRedirect = function sendRedirect(url, statusCode) {
  /* Write a redirect as the response.
   *
   * Must be called before writeHeader has been called.
   *
   * Arguments:
   * - url: string - the destination URL for the redirect.
   * - statusCode?: number - optional HTTP status code (default: 303).
   */
  if (!statusCode) statusCode = 303;
  this.setStatus(statusCode);
  this.setHeader('Location', url);
  this.writeHead();
};
Object.setOwnerOf($.servers.http.Response.prototype.sendRedirect, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.Response.prototype.sendRedirect.prototype, $.physicals.Maximilian);
$.servers.http.Response.prototype.sendError = function sendError(statusCode, message) {
  /* Send an error status and page as the response.
   *
   * Must be called before writeHeader has been called.  Writes a complete HTML
   * document to the connection, but doesn't close the connection.
   *
   * Arguments:
   * - statusCode: number - an HTTP status code.
   * - message?: string | Error - optional status message or Error instance.
   */
  this.setStatus(statusCode);
  if (message instanceof Error) {
    this.errorMessage_ = $.utils.html.escape(String(message)) +
      '<pre>' + $.utils.html.escape(message.stack) + '</pre>';
  } else if (message !== undefined) {
    this.errorMessage_ = $.utils.html.escape(message);
  } else {
    this.errorMessage_ = '';
  }
  sendError.jssp(this.connection_.request, this);
};
Object.setOwnerOf($.servers.http.Response.prototype.sendError, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.Response.prototype.sendError.prototype, $.physicals.Maximilian);
// CLOSURE: type: function, vars: source, jssp
// CLOSURE: type: funexp, vars: Jssp
$.servers.http.Response.prototype.sendError.jssp = function jssp(request, response) {
  // DO NOT EDIT THIS CODE.  AUTOMATICALLY GENERATED BY JSSP.
  // To edit contents of generated page, edit this.source.
  return jssp.render(this, request, response);  // See $.Jssp for explanation.
};
Object.setPrototypeOf($.servers.http.Response.prototype.sendError.jssp, $.Jssp.prototype);
Object.setOwnerOf($.servers.http.Response.prototype.sendError.jssp, $.physicals.Neil);
Object.setOwnerOf($.servers.http.Response.prototype.sendError.jssp.prototype, $.physicals.Neil);
$.servers.http.Response.prototype.sendError.jssp.source = '<html>\n<head>\n  <title><%=response.statusCode%> - Code City</title>\n  <style>\n    body {\n      font-family: "Roboto Mono", monospace;\n      text-align: center;\n    }\n    h1 {\n      font-size: 40pt;\n      font-weight: 100;\n    }\n    h1>img {\n      vertical-align: text-bottom;\n    }\n    pre {\n      margin: 2em;\n    }\n  </style>\n  <link href="https://fonts.googleapis.com/css?family=Roboto+Mono" rel="stylesheet">\n  <link href="<%=$.servers.http.makeUrl(\'static\', \'favicon.ico\')%>" rel="shortcut icon">\n</head>\n<body>\n  <h1>\n    <img src="<%=$.servers.http.makeUrl(\'static\', \'logo-error.svg\')%>" alt="">\n    <%=response.statusCode%> <%=$.servers.http.STATUS_CODES[response.statusCode]%>\n  </h1>\n  <pre>Host: <%=$.utils.html.escape(request.headers.host) %>\n<%= request.method %> <%= $.utils.html.escape(request.url) %></pre>\n  <%=response.errorMessage_%>\n</body>\n</html>';
$.servers.http.Response.prototype.sendError.jssp.hash_ = 'a638cf349f7eab7e22087cf4d8f5872fv1.0.0';
$.servers.http.Response.prototype.sendError.jssp.compiled_ = function(request, response) {
// DO NOT EDIT THIS CODE: AUTOMATICALLY GENERATED BY JSSP.
response.write("<html>\n<head>\n  <title>");
response.write(response.statusCode);
response.write(" - Code City</title>\n  <style>\n    body {\n      font-family: \"Roboto Mono\", monospace;\n      text-align: center;\n    }\n    h1 {\n      font-size: 40pt;\n      font-weight: 100;\n    }\n    h1>img {\n      vertical-align: text-bottom;\n    }\n    pre {\n      margin: 2em;\n    }\n  </style>\n  <link href=\"https://fonts.googleapis.com/css?family=Roboto+Mono\" rel=\"stylesheet\">\n  <link href=\"");
response.write($.servers.http.makeUrl('static', 'favicon.ico'));
response.write("\" rel=\"shortcut icon\">\n</head>\n<body>\n  <h1>\n    <img src=\"");
response.write($.servers.http.makeUrl('static', 'logo-error.svg'));
response.write("\" alt=\"\">\n    ");
response.write(response.statusCode);
response.write(" ");
response.write($.servers.http.STATUS_CODES[response.statusCode]);
response.write("\n  </h1>\n  <pre>Host: ");
response.write($.utils.html.escape(request.headers.host));
response.write("\n");
response.write(request.method);
response.write(" ");
response.write($.utils.html.escape(request.url));
response.write("</pre>\n  ");
response.write(response.errorMessage_);
response.write("\n</body>\n</html>");
};
Object.setOwnerOf($.servers.http.Response.prototype.sendError.jssp.compiled_, $.physicals.Neil);
Object.setOwnerOf($.servers.http.Response.prototype.sendError.jssp.compiled_.prototype, $.physicals.Neil);
Object.defineProperty($.servers.http.Response.prototype.sendError.jssp.compiled_, 'name', {value: '$.servers.http.Response.prototype.writeErrorPage.jssp.compiled_'});
$.servers.http.Response.discardDuplicates = [];
$.servers.http.Response.discardDuplicates[0] = 'age';
$.servers.http.Response.discardDuplicates[1] = 'content-length';
$.servers.http.Response.discardDuplicates[2] = 'content-type';
$.servers.http.Response.discardDuplicates[3] = 'etag';
$.servers.http.Response.discardDuplicates[4] = 'expires';
$.servers.http.Response.discardDuplicates[5] = 'last-modified';
$.servers.http.Response.discardDuplicates[6] = 'location';
$.servers.http.Response.discardDuplicates[7] = 'retry-after';
$.servers.http.Response.defaultHeaders = (new 'Object.create')(null);
$.servers.http.Response.defaultHeaders['cache-control'] = 'no-store';
$.servers.http.Response.defaultHeaders.server = 'CodeCity/0.0 ($.servers.http)';
$.servers.http.protocol = 'https:';
$.servers.http.host = 'google.codecity.world';
$.servers.http.subdomains = true;
$.servers.http.makeUrl = function makeUrl(subdomain, rest) {
  /* Make a URL for Code City.  Defaults to the 'www' subdomain.
   * E.g. $.servers.http.makeUrl('secret', 'cat?foo=bar')
   * -> "//secret.google.codecity.world/cat?foo=bar
   * -> "/secret/cat?foo=bar"
   */
  subdomain = subdomain || 'www';
  if (rest === undefined) rest = '';
  var url;
  if (this.subdomains) {
    url = '//';
    if (subdomain === 'www') {
      url += this.host + '/';
    } else {
      url += subdomain + '.' + this.host + '/';
    }
  } else {
    url = '/' + subdomain + '/';
  }
  return url + rest;
};
Object.setOwnerOf($.servers.http.makeUrl, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.makeUrl.prototype, $.physicals.Neil);

