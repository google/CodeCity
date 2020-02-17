/**
 * @license
 * Copyright 2018 Google LLC
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
  // - butter: short status message to be displayed to user
  // - saved: boolean indicating if a save was successful
  var data = {};
  data.saved = false;
  var parts = JSON.parse(request.parameters.parts);
  if (parts.length) {
    var lastPart = parts.pop();
    var object;
    var isGlobal = parts.length < 1;
    if (isGlobal) {
      object = $.utils.selector.getGlobal();
    } else {
      // Find the origin object.  '$.foo' is the origin of '$.foo.bar'.
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
          data.butter = 'Unknown object';
        }
      }
    }
    if (object) {
      if (!isGlobal) {
        // Save origin object; obtain a key to retrieve it later.
        data.key = $.db.tempId.storeObj(object);
        // Populate the origin object in the selector lookup cache.
        var selector = $.utils.selector.partsToSelector(parts);
        $.utils.selector.setSelector(object, selector);
      }

      // Save any changes.
      if (request.parameters.src) {
        var ok = true;
        try {
          var src = $.utils.code.rewriteForEval(request.parameters.src,
                                                /* forceExpression= */ true);
          // Evaluate src in global scope (eval by any other name, literally).
          var evalGlobal = eval;
          var saveValue = evalGlobal(src);
        } catch (e) {
          ok = false;
          // TODO(fraser): Send a more informative error message.
          data.butter = String(e);
        }
        if (ok) {
          var oldValue;
          if (lastPart.type === 'id') {
            oldValue = object[lastPart.value];
          } else if (lastPart.type === '^') {
            oldValue = Object.getPrototypeOf(object);
          } else {
            // Unknown part type.
            throw new SyntaxError(lastPart);
          }
          var error = false;
          try {
            $.www.code.editor.handleMetaData(request.parameters.src,
                                             oldValue, saveValue);
          } catch (e) {
            if (typeof e === 'string') {
              // A thrown string (probably from $.utils.command.abort) should
              // just be printed to the user.
              data.butter = String(e);
              error = true;
            } else {
              // A real error should be rethrown in full.
              throw e;
            }
          }
          if (error) {
            // Stop.  No further actions.
          } else if (lastPart.type === 'id') {
            if (isGlobal) {
              if (lastPart.value in object) {
                eval(lastPart.value + ' = saveValue');
                // Fetch a fresh global pseudo object for the returned src.
                object = $.utils.selector.getGlobal();
                data.saved = true;
                data.butter = 'Saved';
              } else {
                data.butter = 'Unknown Global';
              }
            } else {
              object[lastPart.value] = saveValue;
              data.saved = true;
              data.butter = 'Saved';
            }
          } else if (lastPart.type === '^') {
            Object.setPrototypeOf(object, saveValue);
            data.butter = 'Prototype Set';
            data.saved = true;
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
        throw new TypeError(lastPart);
      }
      // Populate the value object in the selector lookup cache.
      parts.push(lastPart);
      var selector = $.utils.selector.partsToSelector(parts);
      $.utils.selector.setSelector(value, selector);
      // Assemble any meta-data for the editor.
      var meta = '';
      if (typeof value === 'function') {
        meta += '// @copy_properties true\n';
        var props = ['verb', 'dobj', 'prep', 'iobj'];
        for (var i = 0, prop; (prop = props[i]); i++) {
          try {
            meta += '// ' + (value[prop] ? '@set_prop ' + prop + ' = ' +
                JSON.stringify(value[prop]) : '@delete_prop ' + prop) + '\n';
          } catch (e) {
            // Unstringable value, or read perms error.  Skip.
          }
        }
      }
      // Render the current value as a string.
      try {
        data.src = meta + $.utils.code.toSource(value);
      } catch (e) {
        data.src = e.message;
      }
    }
  }
  response.write(JSON.stringify(data));
};

$.www.ROUTER.codeEditor =
    {regexp: /^\/code\/editor$/, handler: $.www.code.editor};

$.www.code.editor.handleMetaData = function(src, oldValue, newValue) {
  // Editors may provide metadata in the form of comments when saving.
  // Match any leading comments.
  // Throws user-printed strings (not errors) if unable to complete.
  var m = src.match(/^(?:[ \t]*(?:\/\/[^\n]*)?\n)*/);
  if (!m) {
    return;
  }
  var metaLines = m[0].split('\n');
  for (var i = 0; i < metaLines.length; i++) {
    var meta = metaLines[i];
    if (meta.match(/^\s*\/\/\s*@copy_properties\s*true\s*$/)) {
      // @copy_properties true
      if (!$.utils.isObject(newValue)) {
        $.utils.command.abort("Can't copy properties onto primitive: " +
                              newValue);
      }
      // Silently ignore if the old value is a primitive.
      if ($.utils.isObject(oldValue)) {
        $.utils.transplantProperties(oldValue, newValue);
      }
    } else if ((m = meta.match(/^\s*\/\/\s*@delete_prop\s+(\S+)\s*$/))) {
      // @delete_prop dobj
      try {
        delete newValue[m[1]];
      } catch (e) {
        $.utils.command.abort("Can't delete '" + m[1] + "' property.");
      }
    } else if ((m = meta.match(/^\s*\/\/\s*@set_prop\s+(\S+)\s*=(.+)$/))) {
      // @set_prop dobj = "this"
      try {
        var propValue = JSON.parse(m[2]);
      } catch (e) {
        $.utils.command.abort("Can't parse '" + m[1] + "' value: " + m[2]);
      }
      try {
        newValue[m[1]] = propValue;
      } catch (e) {
        $.utils.command.abort("Can't set '" + m[1] + "' property.");
      }
    }
  }
};
