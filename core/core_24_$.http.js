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
 * @fileoverview Top-level URL handlers for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.http = {};

$.http['www.'] = {};

$.http['www.']['/'] = $.hosts.root['/'];

$.http['www.']['/error'] = {};
Object.setOwnerOf($.http['www.']['/error'], $.physicals.Maximilian);
$.http['www.']['/error'].www = "<% throw new Error('this is a test Error'); %>";

$.http['www.']['/mirror'] = {};
Object.setOwnerOf($.http['www.']['/mirror'], $.physicals.Maximilian);
$.http['www.']['/mirror'].www = "<html>\n  <head>\n    <title>Code City Browser Mirror</title>\n  </head>\n  <body>\n    <h1>Code City Browser Mirror</h1>\n\n<%\nfor (var key in request) {\n  if (!request.hasOwnProperty(key)) continue;\n  var value = request[key];\n  \n  response.write('<h2>request.' + $.utils.html.escape(key) + ':</h2>\\n');\n  response.write('<pre>');\n  if (key === 'user') {\n    response.write(value ? $.utils.html.escape(value.name) : value + '\\n');\n  } else if (key === 'host') {\n    response.write($.utils.html.escape($.Selector.for(value)) + '\\n');\n  } else if ($.utils.isObject(value) ) {\n    for (var subkey in value) {\n      response.write($.utils.html.escape(subkey + ': ' + JSON.stringify(value[subkey])) + '\\n');\n    }\n  } else {\n      response.write($.utils.html.escape($.utils.code.toSource(value)) + '\\n');\n  }\n  response.write('</pre>');\n}\n%>\n    <h2>request.fromSameOrigin():</h2>\n    <pre><%= request.fromSameOrigin() %></pre>\n    <p>Done</p>\n  </body>\n</html>";

$.http['www.']['/robots.txt'] = $.hosts.root['/robots.txt'];

$.http['connect.'] = null;

$.http['login.'] = null;

$.http['mobwrite.'] = null;

$.http['static.'] = null;

$.http['system.'] = {};
$.http['system.']['/logout'] = $.hosts.root.subdomains.system['/logout'];

$.www = $.http['www.'];

