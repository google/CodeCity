/**
 * @license
 * Code City: Web pages.
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
 * @fileoverview Web pages for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

// Web pages object:
$.pages = {};

$.pages['404'] = function(request, response) {
  // Overwrite on first execution.
  $.pages['404'] = $.jssp.compile($.pages['404']);
  $.pages['404'].call(this, request, response);
};
$.pages['404'].jssp = [
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
  '      margin-bottom: -20px;',
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
  '    <img src="/static/logo-404.png">',
  '    404 Page Not Found',
  '  </h1>',
  '  <pre><%= request.method %> <%= $.utils.htmlEscape(request.url) %></pre>',
  '</body>',
  '</html>'
].join('\n');


$.pages.home = function(request, response) {
  // Overwrite on first execution.
  $.pages.home = $.jssp.compile($.pages.home);
  $.pages.home.call(this, request, response);
};
$.pages.home.jssp = [
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
  '      <rect id="light" x="42" y="0" height="2" width="2" style="fill: none;stroke: none;" />',
  '    </svg>',
  '    Code City',
  '  </h1>',
  '  <p id="tagline">A community of inquisitive programmers.</p>',
  '  <iframe src="/login"></iframe>',
  '  <script>',
  '  var light = document.getElementById(\'light\');',
  '  var lightActive = false;',
  '  function blink() {',
  '    light.style.fill = lightActive ? \'#f00\' : \'none\';',
  '    lightActive = !lightActive;',
  '  }',
  '  setInterval(blink, 1000)',
  '  </script>',
  '</body>',
  '</html>'
].join('\n');

$.http.router.homepage = {regexp: /^\/(\?|$)/, handler: $.pages.home};


$.pages.robots = function(request, response) {
  // Overwrite on first execution.
  $.pages.robots = $.jssp.compile($.pages.robots);
  $.pages.robots.call(this, request, response);
};
$.pages.robots.jssp = [
  '<% response.setHeader(\'Content-Type\', \'text/plain; charset=utf-8\') %>',
  '# Don\'t index this Code City instance at this time.',
  'User-agent: *',
  'Disallow: /',
].join('\n');

$.http.router.robots = {regexp: /^\/robots\.txt(\?|$)/, handler: $.pages.robots};
