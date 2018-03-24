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

$.code.getGlobal = function() {
  // Return a pseudo global object.
  // TODO: Cache this object.
  var global = Object.create(null);
  global.$ = $;
  global.Array = Array;
  global.Boolean = Boolean;
  global.clearTimeout = clearTimeout;
  global.Date = Date;
  global.decodeURI = decodeURI;
  global.decodeURIComponent = decodeURIComponent;
  global.encodeURI = encodeURI;
  global.encodeURIComponent = encodeURIComponent;
  global.Error = Error;
  global.escape = escape;
  global.eval = eval;
  global.EvalError = EvalError;
  global.Function = Function;
  global.isFinite = isFinite;
  global.isNaN = isNaN;
  global.JSON = JSON;
  global.Math = Math;
  global.Number = Number;
  global.Object = Object;
  global.parseFloat = parseFloat;
  global.parseInt = parseInt;
  global.RangeError = RangeError;
  global.ReferenceError = ReferenceError;
  global.RegExp = RegExp;
  global.setTimeout = setTimeout;
  global.String = String;
  global.suspend = suspend;
  global.SyntaxError = SyntaxError;
  global.TypeError = TypeError;
  global.unescape = unescape;
  global.URIError = URIError;
  return global;
};

$.code.getObject = function(parts) {
  // Given an array of parts, return the described object.
  // E.g. ['$', 'foo', 'bar'] -> $.foo.bar
  if (!parts.length) {
    return undefined;  // Global namespace.
  }
  var obj = $.code.getGlobal();
  for (var i = 0; i < parts.length; i++) {
    obj = obj[parts[i]];
    if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
      return null;  // Specified path doesn't exist.
    }
  }
  return obj;
};

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
  '  <script src="/static/code/common.js"></script>',
  '  <script src="/static/code/code.js"></script>',
  '</head>',
  '<frameset rows="40%,60%">',
  '  <frame id="explorer" src="about:blank" />',
  '  <frame id="editor" src="about:blank" />',
  '</frameset>',
  '<noframes>Sorry, your browser does not support frames!</noframes>',
  '</html>'
].join('\n');

$.http.router.codeFrameset =
    {regexp: /^\/code(\?|$)/, handler: $.code.frameset};

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
  '  <script src="/static/code/common.js"></script>',
  '  <script src="/static/code/explorer.js"></script>',
  '</head>',
  '<body>',
  '  <input type="text" id="input" autocomplete="off">',
  '  <div id="autocompleteMenu"><div id="autocompleteMenuScroll"></div></div>',
  '  <div id="panels"><div id="panelsScroll"><span id="panelSpacer"></span></div></div>',
  '</body>',
  '</html>'
].join('\n');

$.http.router.codeExplorer =
    {regexp: /^\/code\/explorer(\?|$)/, handler: $.code.explorer};


$.code.autocomplete = function(request, response) {
  // HTTP handler for /code/autocomplete
  // Provide object autocompletion service for the IDE's explorer.
  // Takes one input: a JSON-encoded list of parts.
  // Prints a flat list of autocomplete options for the specified object.
  var parts = JSON.parse(request.parameters.parts);
  var options = null;
  if (parts.length) {
    var obj = $.code.getObject(parts);
    if (obj !== null) {
      options = [];
      do {
        options.push(Object.getOwnPropertyNames(obj));
      } while ((obj = Object.getPrototypeOf(obj)));
    }
  } else {
    options = [Object.getOwnPropertyNames($.code.getGlobal())];
  }
  response.write(JSON.stringify(options));
};

$.http.router.codeAutocomplete =
    {regexp: /^\/code\/autocomplete$/, handler: $.code.autocomplete};


$.code.objectPanel = function(request, response) {
  // HTTP handler for /code/objectPanel
  // Provide data for the IDE's object panels.
  // Takes one input: a JSON-encoded list of parts.
  // Prints a browser-executed JS data assignment.
  var data = {};
  var parts = JSON.parse(request.parameters.parts);
  if (parts.length) {
    var obj = $.code.getObject(parts);
    if (obj !== null) {
      data.properties = [];
      do {
        var ownProps = Object.getOwnPropertyNames(obj);
        // Add typeof information.
        for (var i = 0; i < ownProps.length; i++) {
          var prop = ownProps[i];
          var type = typeof obj[prop];
          ownProps[i] = {name: prop, type: type};
        }
        data.properties.push(ownProps);
      } while ((obj = Object.getPrototypeOf(obj)));
    }
  } else {
    data.roots = [];
    // Add typeof information.
    var global = $.code.getGlobal();
    for (var name in global) {
      var type = typeof global[name];
      data.roots.push({name: name, type: type});
    }
  }
  response.write('Code.ObjectPanel.data = ' + JSON.stringify(data) + ';');
};

$.http.router.objectPanel =
    {regexp: /^\/code\/objectPanel(\?|$)/, handler: $.code.objectPanel};
