/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
  '  <pre><%= request.method %> <%= $.utils.html.escape(request.url) %></pre>',
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
  '    h1>img {',
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
  '    <img src="/static/logo.svg" alt="" width="95px" height="100px">',
  '    Code City',
  '  </h1>',
  '  <p id="tagline">A community of inquisitive programmers.</p>',
  '  <iframe src="/login"></iframe>',
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

$.www.ROUTER.robots = {regexp: /^\/robots\.txt(\?|$)/, handler: $.www.robots};
