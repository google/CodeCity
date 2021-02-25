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
    $.servers.http.onRequest(this);
  }
  // Otherwise wait for more lines to arrive.
};
Object.setOwnerOf($.servers.http.connection.onReceiveChunk, $.physicals.Maximilian);
$.servers.http.connection.onEnd = function onEnd() {
  clearTimeout(this.timeout);
  $.connection.onEnd.apply(this, arguments);
};
Object.setOwnerOf($.servers.http.connection.onEnd, $.physicals.Neil);
$.servers.http.connection.route_ = function route_() {
  /* Route this.request by finding a suitable handler object for it.
   * This is done by using the request's host and path (with optional special
   * handling of wildcard subdomains) to look up a handler object in $.http,
   * then return that object.  If no handler object can be found, or the
   * handler object does not have a .www method, a suitable error is served
   * by calling this.result.sendErrror.
   *
   * Returns: an object with a .www method to handle this.request, or null
   * if no suitable hander is found.
   */
  this.request.parseSubdomain_();
  var subdomain = (this.request.subdomain || 'www') + '.';
  var path = this.request.path;
  var domainObj = ($.http.hasOwnProperty(subdomain) && $.http[subdomain]);
  if (!domainObj) {
    this.response.sendError(400, 'Invalid subdomain "' +
                            $.utils.html.escape(this.request.subdomain) +
                            '".');
    return null;
  }
  var obj = (domainObj.hasOwnProperty(path) && domainObj[path]);
  if (!obj) {
    this.response.sendError(404);
    return null;
  }
  return obj;
};
Object.setOwnerOf($.servers.http.connection.route_, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.connection.route_.prototype, $.physicals.Maximilian);
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
    if (!line) {  // Done parsing headers.
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
Object.setOwnerOf($.servers.http.Request.prototype.parse, $.physicals.Maximilian);
$.servers.http.Request.prototype.parseUrl_ = function parseUrl_(url) {
  /* Parse a URL and set this.path and this.query as appropriate:
   *
   * E.g. given url = '/bar/baz?data', set:
   * - this.path = '/bar/baz'
   * - this.query = 'data'
   *
   * Arguments:
   * - url: string - the URL to parse.
   *
   * TODO(cpcallen): add check for leading "/"?
   */
  var qIndex = url.indexOf('?');
  if (qIndex === -1) {
    this.path = url;
  } else {
    this.path = url.substring(0, qIndex);
    this.query = url.substring(qIndex + 1);
  }
};
Object.setOwnerOf($.servers.http.Request.prototype.parseUrl_, $.physicals.Maximilian);
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
    var m = this.path.match(/^\/([-A-Za-z0-9]+)(\/.*)?$/);
    if (m) {
      subdomain = m[1];
      this.path = m[2] || '/';
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
  if (!referer || (!host && !this.origin)) {
    // Missing headers.  Not enough information to know.
    return undefined;
  }
  var origin;
  if (this.origin) {  // User router-provided origin if possible.
    origin = this.orign;
  } else {  // Fall back to guessing based on host + subdomain.
    origin = host;
    if (!$.servers.http.subdomains) {
      origin += "/" + this.subdomain;
    }
  }
  var regex = new RegExp('^https?://' + $.utils.regexp.escape(origin) + '/');
  return regex.test(referer);
};
Object.setOwnerOf($.servers.http.Request.prototype.fromSameOrigin, $.physicals.Maximilian);
$.servers.http.Request.prototype.hostUrl = function hostUrl(varArgs) {
  /* Return the base URL for the host that handled this Request, or
   * a subdomain.  This is derived from (and often identical to)
   * .headers.host, but with some extra magic:
   *
   * - Absent any argument, it will be the URL which routes to the root
   *   Host object serving this Request - e.g., https://example.codecity.world/
   *   The "root" host is ordinarily just first of $.http.hosts[] to accept
   *   the request (as opposed to one of $.http.hosts[].subdomains[name]s).
   * - If an argument is supplied, the returned URL will instead be for
   *   the named subdomain.
   * - Multiple arguments can be supplied if there are nested subdomains.
   *
   * E.g.:
   * request.hostUrl()             => https://example.codecity.world/
   * request.hostUrl('code')       => https://code.example.codecity.world/
   * request.hostUrl('foo', 'bar') => https://foo.bar.example.codecity.world/
   *
   * If .pathToSubdomain is enabled on one or more Host object(s):
   * request.hostUrl('code')       => https://example.codecity.world/code/
   * request.hostUrl('foo', 'bar') => https://example.codecity.world/foo/bar/
   *                              or: https://bar.example.codecity.world/foo/
   *
   * Barring bugs, the returned URL should always end with a '/'.
   *
   * See also $.servers.http.Host.prototype.url for cases where you need
   * to generate a host URL without an incoming Request to use as reference.
   *
   * Arguments:
   * - subdomain: string - a string denoting a subdomain of interest.
   *       Multiple arguments are allowed.  RangeError is thrown if no such
   *       subdomain exists.
   * Returns: string - the URL for the desired domain/subdomain.
   */
  if (!this.route) {

    var rootHost = $.hosts.root;
    return rootHost.url.apply(rootHost, arguments);
  }

  var hostname = this.route[0].authority;
  for (var subdomain, i = 0; (subdomain = arguments[i]); i++) {
    var host = this.route[i].host;
    hostname = host.urlForSubdomain(hostname, subdomain);
  }
  return this.scheme + '://' + hostname + '/';
};
Object.setOwnerOf($.servers.http.Request.prototype.hostUrl, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.Request.prototype.hostUrl.prototype, $.physicals.Maximilian);
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
  $.jssp.eval(this, 'sendErrorJssp', this.connection_.request, this);
};
Object.setOwnerOf($.servers.http.Response.prototype.sendError, $.physicals.Neil);
Object.setOwnerOf($.servers.http.Response.prototype.sendError.prototype, $.physicals.Maximilian);
$.servers.http.Response.prototype.sendErrorJssp = '<html>\n<head>\n  <title><%=response.statusCode%> - Code City</title>\n  <style>\n    body {\n      font-family: "Roboto Mono", monospace;\n      text-align: center;\n    }\n    h1 {\n      font-size: 40pt;\n      font-weight: 100;\n    }\n    h1>img {\n      vertical-align: text-bottom;\n    }\n    pre {\n      margin: 2em;\n    }\n  </style>\n  <link href="https://fonts.googleapis.com/css?family=Roboto+Mono" rel="stylesheet">\n  <link href="<%=request.hostUrl(\'static\')%>favicon.ico" rel="shortcut icon">\n</head>\n<body>\n  <h1>\n    <img src="<%=request.hostUrl(\'static\')%>logo-error.svg" alt="">\n    <%=response.statusCode%> <%=$.servers.http.STATUS_CODES[response.statusCode]%>\n  </h1>\n  <pre>Host: <%=$.utils.html.escape(request.headers.host) %>\n<%= request.method %> <%= $.utils.html.escape(request.url) %></pre>\n  <%=response.errorMessage_%>\n</body>\n</html>';
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
$.servers.http.Host = function Host() {
  /* A Host object represents a domain or subdomain served by the
   * web server.  It is expected that most Host instances will be
   * the values of properties of $.hosts.
   *
   * Methods on Host.prototype (see individual methodd documentation
   * for details):
   *
   * - .addSubdomain() - add a new subdomain to .subdomains.
   * - .handle() - try to have this host handle an incoming request.
   * - .url() - return the URL for this host.
   * - .urlForSubdomain() - a helper method for .url().
   *
   * Instance properties of Host objects (by default these all
   * inherit their default values from Host.prototype):
   *
   * - hostname: string | undefined - the canonical hostname for
   *   this Host object.  Should include the port number, if non-default.
   * - hostRegExp: RegExp | undefined - a RegExp matching Host: header
   *   values this host should respond to.  If undefined (the default),
   *   this host will only respond to requests for .hostname.  Note that
   *   if you want to support subdomains, this regexp regexp should be
   *   constructed so that it matches starting at the beginning of the
   *   root hostname (and not be anchored with ^) - e.g.,
   *   /example.codecity.\w+(?::\d+)$/.
   * - pathToSubdomain: boolean - enable mapping the first element
   *   (directory) of request paths to a subdomain.  (Default: false.)
   * - scheme: string - The canonical scheme for this Host object.
   *   (Default: 'https'.)
   * - subdomains: Object<string, Host> | null - a null-prototype
   *   object mapping subdomain names to their respective Host objects,
   *   or just null if there are no subdomains.  Use .addSubdomain to
   *   add entries to this mapping.  (Default: null.)
   */
};
Object.setOwnerOf($.servers.http.Host, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.Host.prototype, $.physicals.Maximilian);
$.servers.http.Host.prototype.handle = function handle(request, response, info) {
  /* Attempt to handle an http(s) request.  First tries to see if the
   * request can be served by the Host object of a direct subdomain
   * of this Host, then tries to handle itself, then, if
   * this.pseudoSubdomains is enabled, attempts to route the request
   * to a subdomain Host based on the first component of the path.
   *
   * Arguments:
   * - request: $.servers.http.Request - the incoming request to handle.
   * - response: $.servers.http.Response - the response to write to.
   * - info: Object - some information used by recursive calls to this function.
   * Returns: boolean - true iff request was for this host.
   */
  // Temproray guard
  if (!this.matchHostname_(request.headers.host)) return false;

  if (!info) {  // this is a root Host.  Extract info from request.
    info = {
      scheme: this.scheme,  // TODO: extract from Forwarded header.
      authority: request.headers.host,  // May include port.
      path: request.path,
      route: [],
    };
    info.origin = info.scheme + '://' + info.authority + '/';
  } else {  // this is a subdomain Host.
    // Nothing to do.
  }

/*
  var hostRegExp = this.hostRegExp;
  if (!hostRegExp) {
    if (!this.hostname) {
      // TODO: do something clever here.
      var err = new Error('Must specify .hostname or .hostRegExp');
      $.system.log(String(err) + String(err.stack));
      $.system.log('>>> .hostname === ' + String(this.hostname));
      $.system.log('>>> .hostRegExp === ' + String(this.hostRegExp));
      return false;
    }
    hostRegExp = new RegExp($.utils.regexp.escape(this.hostname) + '$');
  }
  $.system.log(String(hostRegExp));
*/

  if (!this.matchHostname_(info.authority)) return false;
  info.route.push({authority: info.authority, host: this});

/*
    // The authorityExact RegExp gives submatches [ipAddress, dnsAddress,
    // port].  Only one of the addresses capture groups will match, and
    var m = $.utils.url.regexps.authorityExact.exec(request.headers.host);

      hostname: m[1] || m[2],  // IP or DNS addess.
      port: m[3],

    if (m[2]) {  // Got DNS rather than IP address.
      var labels = m[2].split('.');
    }
*/

  // Request is for this host.  Try to route to handler to serve page.
  this.route_(request, response, info);
  return true;
};
Object.setOwnerOf($.servers.http.Host.prototype.handle, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.Host.prototype.handle.prototype, $.physicals.Maximilian);
$.servers.http.Host.prototype.route_ = function route_(request, response, info) {
  /* Attempt to route an http(s) request for this host to the correct
   * handler.  If a handler is found, call it; if not, generate an
   * appropriate error.
   *
   * Arguments:
   * - request: $.servers.http.Request - the incoming request to handle.
   * - response: $.servers.http.Response - the response to write to.
   * - info: Object - some additional information generated by
   *       Host.prototype.route.
   */
  var path = info.path;
  if (typeof path !== 'string' || path[0] !== '/') {
    response.sendError(400, 'Invalid path "' + path + '"');
  } else if (path in this) {
    // Record routing info on Request object.
    request.scheme = info.scheme;
    request.route = info.route;
    request.origin = info.origin;
    // Serve page.
    var obj = this[path];
    if (!$.utils.isObject(obj)) {
      response.sendError(500, "Handler is not an object.");
    } else if (typeof obj.www === 'string') {
      $.jssp.eval(obj, 'www', request, response);
    } else if (typeof obj.www === 'function') {
      obj.www(request, response);
    } else {
      response.sendError(500, "Handler .www is neither a function nor a JSSP.");
    }
  } else if (this.subdomains && this.pathToSubdomain) {
    // Try to route to a subdomain based on top-level directory.
    // E.g. https://example.codecity.world/foo/bar -> foo
    var m = path.match(/^\/([-A-Za-z0-9]+)(\/.*)?$/);
    var subdomain = '';  // Empty string gives good 404 message if .match fails.
    if (m && (subdomain = m[1]) in this.subdomains) {
      // Route to th subdomain.
      info.path = m[2] || '/';
      info.origin += '/' + subdomain;
      info.route[info.route.length - 1].pathToSubdomain = true;
      if (!this.subdomains[subdomain].handle(request, response, info)) {
        response.sendError(500, 'Host for pseudo-subdomain /' + subdomain + '/ rejected request.');
        return;
      }
    } else {
      response.sendError(404, 'Not Found (and /' + subdomain + '/ does not map to a subdomain).');
    }
  } else {
    response.sendError(404);
  }
};
Object.setOwnerOf($.servers.http.Host.prototype.route_, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.Host.prototype.route_.prototype, $.physicals.Maximilian);
$.servers.http.Host.prototype.matchHostname_ = function matchHostname_(hostname) {
  /* Returns: boolean - true if hostname matches this.hostname.
   */
  if (this.hostRegExp) {
    if (!(this.hostRegExp instanceof RegExp)) {
      throw new TypeError('invalid .hostRegExp');
    }
    return this.hostRegExp.test(hostname);
  } else if (this.hostname) {
    if (typeof this.hostname !== 'string') {
      throw new TypeError('invalid .hostname');
    }
    return this.hostname === hostname;
  } else {
    return true;
  }
};
Object.setOwnerOf($.servers.http.Host.prototype.matchHostname_, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.Host.prototype.matchHostname_.prototype, $.physicals.Maximilian);
$.servers.http.Host.prototype.hostname = undefined;
$.servers.http.Host.prototype.subdomains = null;
$.servers.http.Host.prototype.addSubdomain = function addSubdomain(name, host) {
  /* Add the given Host as a subdomain of this Host.
   *
   * Arguments:
   * - name: string - the subdomain name.
   * - host: $.servers.http.Host - the Host to serve the subdomain.
   */
  name = String(name);
  if (!(host instanceof $.servers.http.Host)) {
    throw new TypeError('host must be a Host');
  }
  if (!this.hasOwnProperty('subdomains')) {
    this.subdomains = Object.create(null);
  }
  this.subdomains[name] = host;
};
Object.setOwnerOf($.servers.http.Host.prototype.addSubdomain, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.Host.prototype.addSubdomain.prototype, $.physicals.Maximilian);
$.servers.http.Host.prototype.scheme = 'https';
$.servers.http.Host.prototype.url = function url(varArgs) {
  /* Return the base URL for this host.
   *
   * Generally prefer $.servers.http.Request.prototype.hostUrl (q.v.)
   * instead of method - but in some cases it is necessary to generate
   * a URL for the webserver without an existing inbound Request to use
   * as reference, so this method allows one to be generated in the
   * obvious way from this.scheme and this.hostname.  As with .hostUrl:
   *
   * - Absent any argument, the returned URL will routes to this
   *   Host object.
   * - If an argument is supplied, the returned URL will instead be for
   *   the named subdomain.
   * - Multiple arguments can be supplied if there are nested subdomains.
   *
   * E.g.:
   * rootHost.url()             => https://example.codecity.world/
   * rootHost.url('code')       => https://code.example.codecity.world/
   * rootHost.url('foo', 'bar') => https://foo.bar.example.codecity.world/
   *
   * If .pathToSubdomain is enabled on one or more Host object(s):
   * rootHost.url('code')       => https://example.codecity.world/code/
   * rootHost.url('foo', 'bar') => https://example.codecity.world/foo/bar/
   *                           or: https://bar.example.codecity.world/foo/
   *
   * Barring bugs, the returned URL should always end with a '/'.
   * Arguments:
   * - subdomain: string - a string denoting a subdomain of interest.
   *       Multiple arguments are allowed.  RangeError is thrown if no such
   *       subdomain exists.
   * Returns: string - the URL for the desired domain/subdomain.
   */
  if (typeof this.hostname !== 'string') {
    throw new Error('canonical hostname not set');
  } else if (typeof this.scheme !== 'string') {
    throw new TypeError(".scheme should usually be 'http' or 'https'");
  }
  var hostname = this.hostname;
  var host = this;
  for (var subdomain, i = 0; (subdomain = arguments[i]); i++) {
    hostname = host.urlForSubdomain(hostname, subdomain);
  }
  return this.scheme + '://' + hostname + '/';
};
Object.setOwnerOf($.servers.http.Host.prototype.url, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.Host.prototype.url.prototype, $.physicals.Maximilian);
$.servers.http.Host.prototype.pathToSubdomain = false;
$.servers.http.Host.prototype.urlForSubdomain = function urlForSubdomain(hostname, subdomain, usePath) {
  /* A helper function for the .url method.
   *
   * Given a hostname for this host, add the specified subdomain
   * if it exists, or throw RangeError if not.
   *
   * If this.pathToSubdomain is true and usePath === true or is
   * undefined, the subdomain will be added as a directory name
   * suffix rather than a hostname pefix.
   *
   * E.g.:
   * rootHost.pathToSubdomain = false;
   * rootHost.urlForSubdomain('example.codecity.world', 'code')
   *    => 'code.example.codecity.world'
   *
   * rootHost.pathToSubdomain = true;
   * rootHost.urlForSubdomain('example', 'code')
   *    => 'example.codecity.world/code'
   * rootHost.urlForSubdomain('example', 'code', false)
   *    => 'code.example.codecity.world'
   *
   * Arguments:
   * - hostname: string - the base hostname for this Host.
   * - subdomain: string - the desired subdomain.
   * - usePath: boolean | undefined - add subdomain as suffix if
   *   this.pathToSubdomain is true (default: true).
   *
   * TODO: Give this function a better name, because what it returns
   * is not actually a valid URL.
   */
  if (!(subdomain in this.subdomains)) {
    throw new RangeError('nonexistent subdomain "' + subdomain + '"');
  }
  if (this.pathToSubdomain && usePath !== false) {
    return hostname + '/' + subdomain;
  } else if (!this.pathToSubdomain && usePath) {
    throw new Error('unexpected usePath request on non-.pathToSubdomain host');
  } else {
    return subdomain + '.' + hostname;
  }
};
Object.setOwnerOf($.servers.http.Host.prototype.urlForSubdomain, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.Host.prototype.urlForSubdomain.prototype, $.physicals.Maximilian);
$.servers.http.onRequest = function onRequest(connection) {
  /* Called from $.servers.http.connection.onReceiveChunk when the
   * connection.request has been fully parsed and is ready to be handled.
   *
   * Arguments:
   * - conenction: inherits from $.servers.http.connection instance - the
   *       connection to be handle.
   */
  // Call connection.route_() to find a handler object for connection.request,
  // then invoke that handler and deal with the aftermath.
  var request = connection.request;
  var response = connection.response;
  try {
    // Try new routing.
    for (var host, i = 0; (host = this.hosts[i]); i++) {
      if (host.handle(request, response)) return;
    }

    // Fall back to old routing.
    var obj = connection.route_();
    if (obj) {
      if (typeof obj.www === 'string') {
        $.jssp.eval(obj, 'www', request, response);
      } else if (typeof obj.www === 'function') {
        obj.www(request, response);
      } else {
        response.seendError(500);
      }
    }
  } catch (e) {
    suspend();
    $.system.log(String(e) + '\n' + e.stack);
    if (response.headersSent) {
      // Too late to return a proper error page.  Oh well.
      response.write('<pre>' + $.utils.html.escape(String(e) + '\n' + e.stack) +
                     '</pre>');
    } else {
      response.sendError(500, e);
    }
  } finally {
    connection.close();
  }
};
Object.setOwnerOf($.servers.http.onRequest, $.physicals.Maximilian);
Object.setOwnerOf($.servers.http.onRequest.prototype, $.physicals.Maximilian);

$.servers.http.hosts = [];

