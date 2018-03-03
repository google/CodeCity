/**
 * @license
 * Code City: Code.
 *
 * Copyright 2018 Google Inc.
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
 * @fileoverview Web-based code explorer/editor for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

// IDE object.
$.code = {};

$.code.frameset = function(request, response) {
  // Overwrite on first execution.
  $.code.frameset = $.jssp.compile($.code.frameset);
  $.code.frameset.call(this, request, response);
};
$.code.frameset.jssp = [
  '<!DOCTYPE HTML Frameset DTD>',
  '<html>',
  '<head>',
  '  <title>Code City: Code</title>',
  '  <link href="/static/favicon.ico" rel="shortcut icon">',
  '</head>',
  '<frameset rows="40%,60%">',
  '  <frame src="/code/explorer" />',
  '  <frame src="about:blank" />',
  '</frameset>',
  '<noframes>Sorry, your browser does not support frames!</noframes>',
  '</html>'
].join('\n');

$.http.router.codeFrameset = {regexp: /^\/code(\?|$)/, handler: $.code.frameset};

$.code.explorer = function(request, response) {
  // Overwrite on first execution.
  $.code.explorer = $.jssp.compile($.code.explorer);
  $.code.explorer.call(this, request, response);
};
$.code.explorer.jssp = [
  '<!doctype html>',
  '<html>',
  '<head>',
  '  <title>Code City: Code Explorer</title>',
  '  <link rel="stylesheet" href="/static/code/style.css">',
  '  <link href="https://fonts.googleapis.com/css?family=Roboto+Mono" rel="stylesheet">',
  '  <script src="/static/code/explorer.js"></script>',
  '</head>',
  '<body>',
  '  <input type="text" id="input" autocomplete="off">',
  '  <div id="autocompleteMenu"><div id="autocompleteMenuScroll"></div></div>',
  '</body>',
  '</html>'
].join('\n');

$.http.router.codeExplorer = {regexp: /^\/code\/explorer(\?|$)/, handler: $.code.explorer};


$.code.autocomplete = function(request, response) {
  var parts = JSON.parse(request.parameters.parts);
  var options = null;
  if (parts.length) {
    var first = parts[0];
    if ($.code.autocomplete.global.indexOf(first) !== -1) {
      var obj = eval(first);
      for (var i = 1; i < parts.length; i++) {
        obj = obj[parts[i]];
        if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
          obj = null;
          break;
        }
      }
      if (obj) {
        options = [];
        do {
          options.push(Object.getOwnPropertyNames(obj));
        } while ((obj = Object.getPrototypeOf(obj)));
      }
    }
  } else {
    options = [$.code.autocomplete.global];
  }
  response.write(JSON.stringify(options));
};

$.code.autocomplete.global = [
  '$',
  'Array',
  'Boolean',
  'clearTimeout',
  'Date',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'Error',
  'escape',
  'eval',
  'EvalError',
  'Function',
  'isFinite',
  'isNaN',
  'JSON',
  'Math',
  'Number',
  'Object',
  'parseFloat',
  'parseInt',
  'RangeError',
  'ReferenceError',
  'RegExp',
  'setTimeout',
  'String',
  'suspend',
  'SyntaxError',
  'TypeError',
  'unescape',
  'URIError',
  'user'
];

$.http.router.codeAutocomplete = {regexp: /^\/code\/autocomplete$/, handler: $.code.autocomplete};
