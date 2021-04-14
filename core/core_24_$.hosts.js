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
 * @fileoverview Host objects for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.hosts = {};

$.hosts.root = (new 'Object.create')($.servers.http.Host.prototype);

$.hosts.root.subdomains = (new 'Object.create')(null);

$.hosts.root['/'] = {};
$.hosts.root['/'].www = '<!doctype html>\n<% var staticUrl = request.hostUrl(\'static\'); %>\n<html lang="en">\n<head>\n  <title>Code City</title>\n  <style>\n    body {\n      font-family: "Roboto Mono", monospace;\n      text-align: center;\n    }\n    h1 {\n      font-size: 40pt;\n      font-weight: 100;\n    }\n    h1>img {\n      vertical-align: text-bottom;\n    }\n    #tagline {\n      font-style: italic;\n      margin: 2em;\n    }\n    iframe {\n      height: 50px;\n      width: 100px;\n      border: none;\n      display: block;\n      margin: 0 auto;\n    }\n  </style>\n  <link href="https://fonts.googleapis.com/css?family=Roboto+Mono" rel="stylesheet">\n  <link href="<%=staticUrl%>favicon.ico" rel="shortcut icon">\n</head>\n<body>\n  <h1>\n    <img src="<%=staticUrl%>logo.svg" alt="" width="95" height="100">\n    Code City\n  </h1>\n  <p id="tagline">A community of inquisitive programmers.</p>\n  <iframe src="<%=request.hostUrl(\'login\')%>?after=<%=request.hostUrl(\'connect\')%>"></iframe>\n</body>\n</html>';
$.hosts.root['/'].wwwAccess = 'public';

$.hosts.root['/mirror'] = {};
Object.setOwnerOf($.hosts.root['/mirror'], $.physicals.Maximilian);
$.hosts.root['/mirror'].www = "<!doctype html>\n<% var staticUrl = request.hostUrl('static'); %>\n<html>\n  <head>\n    <title>Code City Browser Mirror</title>\n    <style>\n      body {\n        font-family: \"Roboto Mono\", monospace;\n      }\n      h1 {\n        text-align: center;\n      }\n      h1>img {\n        vertical-align: text-bottom;\n      }\n    </style>\n    <link href=\"https://fonts.googleapis.com/css?family=Roboto+Mono\" rel=\"stylesheet\">\n    <link href=\"<%=staticUrl%>favicon.ico\" rel=\"shortcut icon\">\n  </head>\n  <body>\n    <h1>\n      <img src=\"<%=staticUrl%>logo.svg\" alt=\"\" width=\"47.5\" height=\"50\">\n      Code City Browser Mirror\n    </h1>\n<%\nfor (var key in request) {\n  if (!request.hasOwnProperty(key)) continue;\n  var value = request[key];\n  \n  response.write('<h2>request.' + $.utils.html.escape(key) + ':</h2>\\n');\n  response.write('<pre>');\n  if (key === 'user') {\n    response.write(value ? $.utils.html.escape(value.name) : value + '\\n');\n  } else if (true || key === 'info') {\n    response.write($.utils.html.escape($.utils.code.expressionFor(value, {\n      depth: (key === 'info' ? 1 : 2),\n      abbreviateMethods: true,\n      proto: 'ignore',\n      owner: 'ignore',\n    })));\n  }\n  response.write('</pre>');\n}\n%>\n    <h2>request.fromSameOrigin(): [<a href=\"<%= request.hostUrl() %>mirror\">test</code></a>]</h2>\n    <pre><%= request.fromSameOrigin() %></pre>\n    <h2>request.hostUrl('system'):</h2>\n    <pre><%= $.utils.html.escape($.utils.code.quote(request.hostUrl('system'))) %></pre>\n    <p>Done</p>\n  </body>\n</html>";
$.hosts.root['/mirror'].wwwAccess = 'public';

$.hosts.root['/robots.txt'] = {};
$.hosts.root['/robots.txt'].www = "<% response.setHeader('Content-Type', 'text/plain; charset=utf-8') %>\n# Don't index this Code City instance at this time.\nUser-agent: *\nDisallow: /";
$.hosts.root['/robots.txt'].wwwAccess = 'public';

$.hosts.system = (new 'Object.create')($.servers.http.Host.prototype);
$.hosts.system['/logout'] = {};
Object.setOwnerOf($.hosts.system['/logout'], $.physicals.Neil);
$.hosts.system['/logout'].www = '<%\nvar staticUrl = request.hostUrl(\'static\');\nvar doLogout = !request.user ||\n    (request.query === \'execute\' && request.fromSameOrigin());\nif (doLogout) {\n  response.clearIdCookie()\n}\n%>\n<!doctype html>\n<html lang="en">\n<head>\n  <title>Code City Logout</title>\n  <style>\n    body {\n      font-family: "Roboto Mono", monospace;\n      text-align: center;\n    }\n    h1 {\n      font-size: 40pt;\n      font-weight: 100;\n    }\n    h1>img {\n      vertical-align: text-bottom;\n    }\n    #tagline {\n      font-style: italic;\n      margin: 2em;\n    }\n    iframe {\n      height: 50px;\n      width: 100px;\n      border: none;\n      display: block;\n      margin: 0 auto;\n    }\n  </style>\n  <link href="https://fonts.googleapis.com/css?family=Roboto+Mono" rel="stylesheet">\n  <link href="<%=staticUrl%>favicon.ico" rel="shortcut icon">\n  <link href="<%=staticUrl%>style/jfk.css" rel="stylesheet">\n\n  </head>\n<body>\n  <h1>\n    <img src="<%=staticUrl%>logo.svg" alt="" width="95" height="100">\n    Code City\n  </h1>\n  <p id="tagline"><%= request.info.rootAuthority || request.info.host.hostname || \'\' %></p>\n<% if (doLogout) { %>\n  <p>You have been signed out.</p>\n  <iframe src="<%=request.hostUrl(\'login\')%>"></iframe>\n<% } else { %>\n  <div class="jfk-button jfk-button-action" role="button" id="signout">\n    Sign out\n  </div>\n  <script>\n    var button =  document.getElementById(\'signout\');\n    button.addEventListener(\'click\', function() {\n      parent.location = "?execute";\n    });\n  </script>\n<% } %>\n</body>\n</html>';

$.hosts.dummy = (new 'Object.create')($.servers.http.Host.prototype);
Object.setOwnerOf($.hosts.dummy, $.physicals.Maximilian);
$.hosts.dummy.handle = function handle(request, response, info) {
  /* Report the mishandling of an http(s) request which should have
   * been intercepted by the nginx front-end and proxied to one
   * of the other servers.
   *
   * This Host object is a singleton placeholer to mark (in
   * $.hosts.root.subdomains) the subdomains that should be directed
   * to loginServer, connectServer, etc., or served from the /static/
   * directory.  As such, no requests should ever be able to reach
   * this Host object except due to a misconfiguration of nginx.
   *
   * Arguments:
   * - request: $.servers.http.Request - the incoming request to handle.
   * - response: $.servers.http.Response - the response to write to.
   * - info: Object - some information used by recursive calls to this function.
   * Returns: boolean - always true as all requests successfully generate
   *     an error message.
   */
  response.sendError(500, 'This request should have been intercepted by ' +
                     'the reverse proxy.  Check nginx configuration!');
  return true;
};
Object.setOwnerOf($.hosts.dummy.handle, $.physicals.Maximilian);
Object.setOwnerOf($.hosts.dummy.handle.prototype, $.physicals.Maximilian);

$.hosts.root.subdomains.system = $.hosts.system;

$.hosts.root.subdomains.connect = $.hosts.dummy;

$.hosts.root.subdomains.login = $.hosts.dummy;

$.hosts.root.subdomains.mobwrite = $.hosts.dummy;

$.hosts.root.subdomains.static = $.hosts.dummy;


$.servers.http.hosts[0] = $.hosts.root;

