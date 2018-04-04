/**
 * @license
 * Code City: Web handlers.
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
 * @fileoverview Top-level URL handlers for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

// HTTP router object:
$.www = {};
$.www.ROUTER = Object.create(null);

$.www['404'] = {};

$.www['404'].www = function(request, response) {
  // Overwrite on first execution.
  $.www['404'].www = $.jssp.compile($.www['404'].www);
  $.www['404'].www.call(this, request, response);
};
$.www['404'].www.jssp = [
  '<% response.statusCode = 404 %>',
  '<html>',
  '<head>',
  '  <title>404 - Code City</title>',
  '  <style>',
  '    body {',
  '      font-family: "Roboto Mono", monospace;',
  '      text-align: center;',
  '    }',
  '    h1 {',
  '      font-size: 40pt;',
  '      font-weight: 100;',
  '    }',
  '    h1>img {',
  '      vertical-align: text-bottom;',
  '    }',
  '    pre {',
  '      margin: 2em;',
  '    }',
  '  </style>',
  '  <link href="https://fonts.googleapis.com/css?family=Roboto+Mono" rel="stylesheet">',
  '  <link href="/static/favicon.ico" rel="shortcut icon">',
  '</head>',
  '<body>',
  '  <h1>',
  '    <img src="/static/logo-error.svg" alt="">',
  '    404 Page Not Found',
  '  </h1>',
  '  <pre><%= request.method %> <%= $.utils.htmlEscape(request.url) %></pre>',
  '</body>',
  '</html>'
].join('\n');


$.www.homepage = {};

$.www.homepage.www = function(request, response) {
  // Overwrite on first execution.
  $.www.homepage.www = $.jssp.compile($.www.homepage.www);
  $.www.homepage.www.call(this, request, response);
};
$.www.homepage.www.jssp = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '  <title>Code City</title>',
  '  <style>',
  '    body {',
  '      font-family: "Roboto Mono", monospace;',
  '      text-align: center;',
  '    }',
  '    h1 {',
  '      font-size: 40pt;',
  '      font-weight: 100;',
  '    }',
  '    h1>svg {',
  '      vertical-align: text-bottom;',
  '    }',
  '    #tagline {',
  '      font-style: italic;',
  '      margin: 2em;',
  '    }',
  '    iframe {',
  '      height: 50px;',
  '      width: 100px;',
  '      border: none;',
  '      display: block;',
  '      margin: 0 auto;',
  '    }',
  '  </style>',
  '  <link href="https://fonts.googleapis.com/css?family=Roboto+Mono" rel="stylesheet">',
  '  <link href="/static/favicon.ico" rel="shortcut icon">',
  '</head>',
  '<body>',
  '  <h1>',
  '    <svg xmlns="http://www.w3.org/2000/svg" width="95px" height="100px">',
  '      <path',
  '         d="m 1,90 0,-25 10,0 0,-8 9,0 0,-5 8,0 0,5 2,0 0,33 3,0 0,-13 2,0 0,-7 2,0 0,-32 1,0 0,-7 1,0 0,-6 2,0 0,-1 1,0 0,-12 1,0 0,-11 0,11 1,0 0,12 1,0 0,1 2,0 0,6 1,0 0,7 1,0 0,32 2,0 0,7 2,0 0,13 4,0 0,-32 5,0 0,-5 6,0 0,5 3,0 0,32 5,0 0,-42 3,0 0,-9 7,0 0,-2 5,0 0,2 2,0 0,51"',
  '         style="fill: none; stroke: #000; stroke-width: 1.5;" />',
  '      <rect id="light" x="42" y="0" height="2" width="2" style="fill: #f00;stroke: none;" />',
  '    </svg>',
  '    Code City',
  '  </h1>',
  '  <p id="tagline">A community of inquisitive programmers.</p>',
  '  <iframe src="/login"></iframe>',
  '  <style>',
  '    @keyframes blink {',
  '      50% { opacity: 0; }',
  '    }',
  '    #light {',
  '      animation: blink 2s step-start 0s infinite;',
  '    }',
  '  </style>',
  '</body>',
  '</html>'
].join('\n');

$.www.ROUTER.homepage = {regexp: /^\/(\?|$)/, handler: $.www.homepage};


$.www.robots = {};

$.www.robots.www = function(request, response) {
  // Overwrite on first execution.
  $.www.robots.www = $.jssp.compile($.www.robots.www);
  $.www.robots.www.call(this, request, response);
};
$.www.robots.www.jssp = [
  '<% response.setHeader(\'Content-Type\', \'text/plain; charset=utf-8\') %>',
  '# Don\'t index this Code City instance at this time.',
  'User-agent: *',
  'Disallow: /',
].join('\n');

$.www.ROUTER.homepage = {regexp: /^\/robots\.txt(\?|$)/, handler: $.www.robots};
