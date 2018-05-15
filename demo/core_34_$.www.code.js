/**
 * @license
 * Code City: Code IDE.
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

$.www.code = {};

$.www.code.www = function(request, response) {
  // Overwrite on first execution.
  $.www.code.www = $.jssp.compile($.www.code.www);
  $.www.code.www.call(this, request, response);
};
$.www.code.www.jssp = [
  '<!DOCTYPE HTML Frameset DTD>',
  '<html>',
  '<head>',
  '  <title>Code City: Code</title>',
  '  <link href="/static/favicon.ico" rel="shortcut icon">',
  '  <script src="/static/code/common.js"></script>',
  '  <script src="/static/code/code.js"></script>',
  '</head>',
  '<frameset rows="40%,60%">',
  '  <frame id="explorer" src="/static/code/explorer.html" />',
  '  <frame id="editor" src="/static/code/editor.html" />',
  '</frameset>',
  '<noframes>Sorry, your browser does not support frames!</noframes>',
  '</html>'
].join('\n');

$.www.ROUTER.code = {regexp: /^\/code(\?|$)/, handler: $.www.code};


$.www.code.autocomplete = {};

$.www.code.autocomplete.www = function(request, response) {
  // HTTP handler for /code/autocomplete
  // Provide object autocompletion service for the IDE's explorer.
  // Takes one input: a JSON-encoded list of parts from the 'parts' parameter.
  // Prints a JSON-encoded 2D list of autocomplete options for the specified
  // object, and each of its prototypes.
  var parts = JSON.parse(request.parameters.parts);
  try {
    var obj = $.utils.selector.partsToValue(parts);
  } catch (e) {
    obj = null;
  }
  var completions = [];
  // For simplicity, don't provide completions for primitives (despite the
  // fact that (for example) numbers inherit a '.toFixed' function).
  if (obj !== null && (typeof obj === 'object' || typeof obj === 'function')) {
    do {
      completions.push(Object.getOwnPropertyNames(obj));
    } while ((obj = Object.getPrototypeOf(obj)));
  }
  response.write(JSON.stringify(completions));
};

$.www.ROUTER.codeAutocomplete =
    {regexp: /^\/code\/autocomplete\?/, handler: $.www.code.autocomplete};


$.www.code.objectPanel = {};

$.www.code.objectPanel.www = function(request, response) {
  // HTTP handler for /code/objectPanel
  // Provide data for the IDE's object panels.
  // Takes one input: a JSON-encoded list of parts from the 'parts' parameter.
  // Prints a browser-executed JavaScript data assignment.
  var data = {};
  var parts = JSON.parse(request.parameters.parts);
  if (parts.length) {
    try {
      var value = $.utils.selector.partsToValue(parts);
    } catch (e) {
      // Parts don't match a valid path.
      // TODO(fraser): Send an informative error message.
      data = null;
    }
    if (data) {
      if (value && (typeof value === 'object' || typeof value === 'function')) {
        data.properties = [];
        while (value !== null && value !== undefined) {
          var ownProps = Object.getOwnPropertyNames(value);
          // Add typeof information.
          for (var i = 0; i < ownProps.length; i++) {
            var prop = ownProps[i];
            var type = typeof value[prop];
            ownProps[i] = {name: prop, type: type};
          }
          data.properties.push(ownProps);
          value = Object.getPrototypeOf(value);
        }
      }
    }
  } else {
    data.roots = [];
    // Add typeof information.
    var global = $.utils.selector.getGlobal();
    for (var name in global) {
      var type = typeof global[name];
      data.roots.push({name: name, type: type});
    }
  }
  response.write('Code.ObjectPanel.data = ' + JSON.stringify(data) + ';');
};

$.www.ROUTER.codeObjectPanel =
    {regexp: /^\/code\/objectPanel\?/, handler: $.www.code.objectPanel};


$.www.code.editor = {};

$.www.code.editor.www = function(request, response) {
  // HTTP handler for /code/editor
  // Provide data for the IDE's editors.
  // Takes several inputs:
  // - parts: a JSON-encoded list of parts to the origin object
  // - key: a temporary key to the origin object
  // - src: JavaScript source representation of new value
  // Writes JSON-encoded information about what is to be edited:
  // - key: a temporary key to the origin object
  // - src: JavaScript source representation of current value
  var data = {};
  var parts = JSON.parse(request.parameters.parts);
  if (parts.length) {
    // Find the origin object.  '$.foo' is the origin of '$.foo.bar'.
    var lastPart = parts.pop();
    var object;
    if (request.parameters.key) {
      // See if temp ID DB still knows about this key.  If so, we're done.
      object = $.db.tempId.getObjById(request.parameters.key);
    }
    if (!object) {
      // Parse the parts list.
      try {
        var object = $.utils.selector.partsToValue(parts);
      } catch (e) {
        // Parts don't match a valid path.
        // TODO(fraser): Send an informative error message.
      }
    }
    if (object) {
      // Save origin object; obtain a key to retrieve it later.
      data.key = $.db.tempId.storeObj(object);
      // Populate the origin object in the selector lookup cache.
      var selector = $.utils.selector.partsToSelector(parts);
      $.utils.selector.setSelector(object, selector);

      // Save any changes.
      if (request.parameters.src) {
        var ok = true;
        try {
          // TODO(fraser): Make this secure -- somehow.
          var saveValue = eval(request.parameters.src);
        } catch (e) {
          ok = false;
          // TODO(fraser): Send an informative error message.
        }
        if (ok) {
          if (lastPart.type === 'id') {
            object[lastPart.value] = saveValue;
          } else if (lastPart.type === '^') {
            Object.setPrototypeOf(object, saveValue);
          } else {
            // Unknown part type.
            throw SyntaxError(lastPart);
          }
        }
      }

      // Find the edited value.
      var value;
      if (lastPart.type === 'id') {
        value = object[lastPart.value];
      } else if (lastPart.type === '^') {
        value = Object.getPrototypeOf(object);
      } else {
        // Unknown part type.
        throw lastPart;
      }
      // Populate the value object in the selector lookup cache.
      parts.push(lastPart);
      var selector = $.utils.selector.partsToSelector(parts);
      $.utils.selector.setSelector(value, selector);
      // Render the current value as a string.
      try {
        data.src = $.utils.code.toSource(value);
      } catch (e) {
        data.src = e.message;
      }
    }
  }
  response.write(JSON.stringify(data));
};

$.www.ROUTER.codeEditor =
    {regexp: /^\/code\/editor$/, handler: $.www.code.editor};
