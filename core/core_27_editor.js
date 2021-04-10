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
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.hosts.code['/'] = {};
$.hosts.code['/'].www = '<!DOCTYPE HTML Frameset DTD>\n<% var staticUrl = request.hostUrl(\'static\'); %>\n<html>\n<head>\n  <title>Code City: Code</title>\n  <link href="<%=staticUrl%>favicon.ico" rel="shortcut icon">\n  <script src="<%=staticUrl%>code/common.js"></script>\n  <script src="<%=staticUrl%>code/code.js"></script>\n</head>\n<frameset rows="40%,60%">\n  <frame id="explorer" src="explorer" />\n  <frame id="editor" src="editor" />\n</frameset>\n<noframes>Sorry, your browser does not support frames!</noframes>\n</html>';
$.hosts.code['/editor'] = {};
$.hosts.code['/editor'].www = '<!doctype html>\n<% var staticUrl = request.hostUrl(\'static\'); %>\n<html>\n  <head>\n    <meta charset="utf-8"/>\n    <title>Code City: Code Editor</title>\n    <link rel="stylesheet" href="<%=staticUrl%>code/style.css">\n    <link rel="stylesheet" href="<%=staticUrl%>code/editor.css">\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto+Mono">\n    <link rel="stylesheet" href="<%=staticUrl%>style/jfk.css">\n\n    <link rel="stylesheet" href="<%=staticUrl%>CodeMirror/lib/codemirror.css">\n    <link rel="stylesheet" href="<%=staticUrl%>CodeMirror/addon/lint/lint.css">\n    <link rel="stylesheet" href="<%=staticUrl%>CodeMirror/theme/eclipse.css">\n    <script src="<%=staticUrl%>CodeMirror/lib/codemirror.js"></script>\n    <script src="<%=staticUrl%>CodeMirror/addon/edit/matchbrackets.js"></script>\n    <script src="<%=staticUrl%>CodeMirror/addon/comment/continuecomment.js"></script>\n    <script src="<%=staticUrl%>CodeMirror/addon/mode/multiplex.js"></script>\n    <script src="<%=staticUrl%>CodeMirror/addon/lint/lint.js"></script>\n    <script src="<%=staticUrl%>CodeMirror/addon/lint/javascript-lint.js"></script>\n    <script src="<%=staticUrl%>CodeMirror/addon/display/rulers.js"></script>\n    <script src="<%=staticUrl%>CodeMirror/mode/css/css.js"></script>\n    <script src="<%=staticUrl%>CodeMirror/mode/htmlembedded/htmlembedded.js"></script>\n    <script src="<%=staticUrl%>CodeMirror/mode/htmlmixed/htmlmixed.js"></script>\n    <script src="<%=staticUrl%>CodeMirror/mode/javascript/javascript.js"></script>\n    <script src="<%=staticUrl%>CodeMirror/mode/xml/xml.js"></script>\n\n    <script src="<%=staticUrl%>code/common.js"></script>\n    <script id="editor_js" src="<%=staticUrl%>code/editor.js"></script>\n  </head>\n  <body>\n    <div id="editorDialog">\n      <div id="editorDialogMask"></div>\n      <div id="editorDialogBox">\n        <div id="editorConfirmBox">\n          <p>Do you want to save changes?</p>\n          <p>\n            <button id="editorConfirmDiscard" class="jfk-button">Discard</button>\n            <button id="editorConfirmSave" class="jfk-button jfk-button-submit">Save</button>\n            <button id="editorConfirmCancel" class="jfk-button">Cancel</button>\n          </p>\n        </div>\n        <div id="editorShareBox" class="disabled">\n          <p>\n            <label><input type="checkbox" id="editorShareCheck" disabled> Share this editor:</label>\n          </p>\n          <p>\n            <input id="editorShareAddress" readonly>\n          </p>\n          <p>\n            <button id="editorShareOk" class="jfk-button jfk-button-submit">Ok</button>\n          </p>\n        </div>\n      </div>\n    </div>\n    <div id="editorButter"><div><div id="editorButterText"></div></div></div>\n    <div id="editorSavingMask"></div>\n    <div id="editorButtons">\n      <button id="editorShare" class="jfk-button">Share...</button>\n      <button id="editorSave" class="jfk-button">Save</button>\n    </div>\n    <div id="editorTabs" class="disabled">\n      <span class="spacer"></span>\n    </div>\n    <div id="editorHeader" class="loading"></div>\n    <div id="editorContainers"></div>\n  </body>\n</html>\n';
$.hosts.code['/explorer'] = {};
$.hosts.code['/explorer'].www = '<!doctype html>\n<% var staticUrl = request.hostUrl(\'static\'); %>\n<html>\n  <head>\n    <meta charset="utf-8"/>\n    <title>Code City: Code Explorer</title>\n    <link rel="stylesheet" href="<%=staticUrl%>code/style.css">\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto+Mono">\n    <script src="<%=staticUrl%>code/common.js"></script>\n    <script src="<%=staticUrl%>code/explorer.js"></script>\n  </head>\n  <body>\n    <input type="text" id="input" autocomplete="off">\n    <div id="autocompleteMenu"><div id="autocompleteMenuScroll"></div></div>\n    <div id="panels"><div id="panelsScroll"><span id="panelSpacer"></span></div></div>\n  </body>\n</html>\n';
$.hosts.code['/diff'] = {};
$.hosts.code['/diff'].www = '<% var staticUrl = request.hostUrl(\'static\'); %>\n<html>\n  <head>\n    <title>Code City Diff Editor</title>\n    <script src="<%=staticUrl%>code/mobwrite/dmp.js"></script>\n    <script src="<%=staticUrl%>code/diff.js"></script>\n    <link rel="stylesheet" href="<%=staticUrl%>code/diff.css">\n  </head>\n\n  <body>\n  </body>\n</html>\n';
$.hosts.code['/objectPanel'] = {};
$.hosts.code['/objectPanel'].www = '<!doctype html>\n<% var staticUrl = request.hostUrl(\'static\'); %>\n<html>\n  <head>\n    <meta charset="utf-8"/>\n    <title>Code City: Code Object Panel</title>\n    <link rel="stylesheet" href="<%=staticUrl%>code/style.css">\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto+Mono">\n  </head>\n  <body id="objectPanel">\n    <table id="objectTable">\n      <thead>\n        <tr><td id="objectTitle">&#8203;</td></tr>\n      </thead>\n      <tbody id="objectTableBody">\n        <tr><td class="loading">&#8203;</td></tr> <!-- Zero width space to align the loading ellipsis. -->\n      </tbody>\n      <tfoot id="objectFail">\n        <tr><td>Server Error<br>Check your console&hellip;</td></tr>\n      </tfoot>\n    </table>\n    <script src="<%=staticUrl%>code/common.js"></script>\n    <script src="<%=staticUrl%>code/objectPanel.js"></script>\n    <script>\n      Code.ObjectPanel.data = <%=JSON.stringify(this.buildData(request.query), null, 2)%>;\n    </script>\n  </body>\n</html>\n';
$.hosts.code['/objectPanel'].getType = function getType(value) {
  // Return a type string for a value.
  // E.g. 'string', 'object', 'array', 'boolean'.
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if ((typeof value === 'function') && value.verb) {
    return 'verb';
  }
  return typeof value;
};
Object.setOwnerOf($.hosts.code['/objectPanel'].getType, $.physicals.Neil);
$.hosts.code['/objectPanel'].buildData = function buildData(query) {
  // Provide data for the IDE's object panels.
  // Takes one input: a JSON-encoded list of parts from the 'parts' parameter.
  // Returns a browser-executed JavaScript data assignment.
  var data = {};
  if (query) {
    var parts = new $.Selector(decodeURIComponent(query));
    try {
      var value = (new $.Selector(parts)).toValue();
    } catch (e) {
      // Parts don't match a valid path.
      $.system.log(String(e) + '\n' + e.stack);
      // TODO(fraser): Send an informative error message.
      data = null;
    }
    if (data) {
      // For simplicity, don't provide completions for primitives (despite
      // the fact that (for example) numbers inherit a '.toFixed' function).
      if (value && (typeof value === 'object' || typeof value === 'function')) {
        data.properties = [];
        while (value !== null && value !== undefined) {
          var ownProps = Object.getOwnPropertyNames(value);
          // Add typeof information.
          for (var i = 0; i < ownProps.length; i++) {
            var prop = ownProps[i];
            var type = this.getType(value[prop]);
            ownProps[i] = {name: prop, type: type};
          }
          data.properties.push(ownProps);
          value = Object.getPrototypeOf(value);
        }
        data.keywords = ['{proto}', '{owner}'];
        // Uncomment once Set, Map, WeakSet and WeakMap exist.
        //if (value instanceOf Set || value instanceOf WeakSet) {
        //  data.keywords.push('{keys}');
        //}
        //if (value instanceOf Map || value instanceOf WeakMap) {
        //  data.keywords.push('{keys}', '{values}');
        //}
      }
    }
  } else {
    data.roots = [];
    // Add typeof information.
    var global = $.utils.code.getGlobal();
    for (var name in global) {
      data.roots.push({name: name, type: this.getType(global[name])});
    }
  }
  return data;
};
Object.setOwnerOf($.hosts.code['/objectPanel'].buildData, $.physicals.Neil);
Object.setOwnerOf($.hosts.code['/objectPanel'].buildData.prototype, $.physicals.Neil);
$.hosts.code['/editorXhr'] = {};
Object.setOwnerOf($.hosts.code['/editorXhr'], $.physicals.Neil);
$.hosts.code['/editorXhr'].www = function code_editorXhr_www(request, response) {
  /* HTTP handler for /editorXhr
   * Provide data for the IDE's editors.
   * Takes several inputs:
   * - selector: a selector to the origin object
   * - key: a temporary key to the origin object
   * - src: JavaScript source representation of new value,
   *   implies request to save
   * Writes JSON-encoded information about what is to be edited:
   * - key: a temporary key to the origin object
   * - src: JavaScript source representation of current value
   * - butter: short status message to be displayed to user
   * - saved: boolean indicating if a save was successful,
   *   only present if save was requested
   * - login: boolean indicating if the user is logged in
   */
  var data = {login: !!request.user};
  try {  // ends with ... finally {response.write(JSON.stringify(data));}
    if (!request.fromSameOrigin()) {
      // Security check to ensure this is being loaded by the code editor.
      data.butter = 'Cross-origin referer: ' + String(request.headers.referer);
      return;
    }
    var selector;
    try {
      selector = new $.Selector(decodeURIComponent(request.parameters.selector));
    } catch (e) {
      data.butter = 'Invalid selector: ' + String(e);
      return;
    }

    // Get Binding being edited.
    var object;
    var part = selector[selector.length - 1];
    if (selector.isVar()) {
      // Global variable; no parent object.
      object = null;
    } else if (request.parameters.key &&
               (object = $.db.tempId.getObjById(request.parameters.key))) {
      // Successfully retrieved parent object from tempID DB.
    } else {
      // Get parent object via selector.
      var parent = new $.Selector(selector.slice(0, -1));
      try {
        // Get parent object and populate the reverse-lookup db.
        object = parent.toValue(/*save:*/true);
      } catch (e) {
        data.butter = e.message;
        return;
      }
			if (!$.utils.isObject(object)) {
        data.butter = String(parent) + ' is not an object';
        return;
      }
      // Save parent object in tempId DB; send key to client.
      data.key = $.db.tempId.storeObj(object);
    }
    var binding = new $.utils.Binding(object, part);

    // Save changes.
    if (request.parameters.src) {
      data.saved = false;
      this.save(request.parameters.src, binding, data, request.user);
    }

    // Populate the new value object in the reverse-lookup db.
    selector.toValue(/*save:*/true);

    // Load revised source.
    this.load(binding, data);
  } finally {
    suspend();
    response.write(JSON.stringify(data));
  }
};
Object.setOwnerOf($.hosts.code['/editorXhr'].www, $.physicals.Maximilian);
$.hosts.code['/editorXhr'].load = function load(binding, data) {
  /* The complement of save: render the current value of binding as a
   * string, prefixed with metadata, postfixed with type information.
   *
   * This should set data.src to a string which, when passed eval, will be (in
   * order of preference):
   *
   * - Identical to (as determined by Object.is) the current value,
   * - A shallow-copy of the current value, or
   * - Unparsable, such that eval will throw SyntaxError.
   *
   * The intention should be that it should be safe to save witout
   * having made any changes and be reasonably confident nothing will
   * break.
   *
   * Args:
   * - binding: $.utils.Binding - the binding being edited.
   * - data: {src: string, butter: string} - the data object to be returned
   *   to the client.
   */
  var value = binding.get(/*inherited:*/true);
  var inherited = !binding.exists();
  try {
    var source = this.sourceFor(value);
    data.src = this.generateMetaData(value, source, inherited) + source;
  } catch (e) {
    suspend();
    // TODO(cpcallen): Send a more informative error message.
    data.butter = String(e);
    throw e;
  }
};
Object.setOwnerOf($.hosts.code['/editorXhr'].load, $.physicals.Maximilian);
$.hosts.code['/editorXhr'].save = function $_www_code_editor_save(src, binding, data, user) {
  // Save changes by evalling src, doing post-processing as directed
  // by metadata, and then calling binding.set(/* new value */).
  // Sets data.saved and data.butter as appropriate to give feedback
  // to user.
  if (!user) {
    data.butter = 'User not logged in.';
    return;
  }
  setPerms(user);
  var saveValue;
  try {
    suspend();
    var expr = $.utils.code.rewriteForEval(src, /*forceExpression:*/true);
    // Evaluate src in global scope (eval by any other name, literally).
    var evalGlobal = eval;
    saveValue = evalGlobal(expr);
  } catch (e) {
    // TODO(fraser): Send a more informative error message.
    data.butter = String(e);
    return;
  }
  var oldValue = binding.get(/*inherited:*/false);  // Get actual current value.
  try {
    this.handleMetaData(src, oldValue, saveValue);
  } catch (e) {
    if (typeof e === 'string') {
      // A thrown string should just be printed to the user.
      data.butter = e;
      return;
    } else {
      throw e;  // Rethrow real errors.
    }
  }
  // Record last modification data on functions.
  if (typeof saveValue === 'function') {
    saveValue.lastModifiedTime = Date.now();
    saveValue.lastModifiedUser = user;
  }
  try {
    binding.set(saveValue);
  } catch (e) {
    data.butter = String(e);
    return;
  }
  data.saved = true;
  if (binding.isProto()) {
    data.butter = 'Prototype Set';
  } else if (binding.isOwner()) {
    data.butter = 'Owner Set';
  } else {
    data.butter = 'Saved';
  }
};
Object.setOwnerOf($.hosts.code['/editorXhr'].save, $.physicals.Neil);
$.hosts.code['/editorXhr'].handleMetaData = function handleMetaData(src, oldValue, newValue) {
	// Parse metadata directives from src and apply to newValue.
  //
  // The $.hosts.code['/editor'].www sends values to be edited to the
  // editor front-end encoded as JavaScript expressions, optionally preceded
  // by comments containing metadata about the value.  The editor can
  // in turn return metadata directives which will be carried out by
  // this function.
  //
  // Supported directives (order matters for now):
  // // @copy_properties true
  //    - Copy (most) properties from oldValue to newValue, if both
  //      are objects.
  // // @hash 26076758802
  //    - Warn if old value doesn't hash to this value (conflicting
  //      change happened between load and save).
  // // @delete_prop <name>
  //    - Delete the named property from newValue.
  // // @set_prop <name> <value>
  //    - Set the named property of newValue to the specified value.
  //
  // Throws user-printed strings (not Errors) if unable to complete.
  var m = src.match(/^(?:[ \t]*(?:\/\/[^\n]*)?\n)+/);
  if (!m) {
    return;
  }
  var metaLines = m[0].split('\n');
  for (var i = 0; i < metaLines.length; i++) {
    var meta = metaLines[i];
    if (meta.match(/^\s*\/\/\s*@copy_properties\s+true\s*$/)) {
      // @copy_properties true
      if (!$.utils.isObject(newValue)) {
        throw "Can't copy properties onto primitive: " + newValue;
      }
      // Silently ignore if the old value is a primitive.
      if ($.utils.isObject(oldValue)) {
        $.utils.object.transplantProperties(oldValue, newValue);
      }
    } else if ((m = meta.match(/^\s*\/\/\s*@hash\s+(\S+)\s*$/))) {
      // @hash 26076758802
      var oldSource = this.sourceFor(oldValue);
      var hash = $.utils.string.hash('md5', oldSource);
      if (String(hash) !== m[1]) {
        // The current value does not match the value when the editor was loaded.
        // This means the value changed out from under the editor.
        throw 'Collision: Out of date editor.';
      }
    } else if ((m = meta.match(/^\s*\/\/\s*@delete_prop\s+(\S+)\s*$/))) {
      // @delete_prop dobj
      try {
        delete newValue[m[1]];
      } catch (e) {
        throw "Can't delete '" + m[1] + "' property.";
      }
    } else if ((m = meta.match(/^\s*\/\/\s*@set_prop\s+(\S+)\s*=(.+)$/))) {
      // @set_prop dobj = "this"
      try {
        var propValue = JSON.parse(m[2]);
      } catch (e) {
        throw "Can't parse '" + m[1] + "' value: " + m[2];
      }
      try {
        newValue[m[1]] = propValue;
      } catch (e) {
        throw "Can't set '" + m[1] + "' property.";
      }
    }
  }
};
Object.setOwnerOf($.hosts.code['/editorXhr'].handleMetaData, $.physicals.Maximilian);
$.hosts.code['/editorXhr'].generateMetaData = function generateMetaData(value, src, inherited) {
  /* Assemble any meta-data for the editor.
   *
   * Arguments:
   * value: any - the value which will be provided as the initial value to begin
   *     editing from.  This might be a value inherited from a prototype, if the
   *     binding being edited does not yet exist.
   * inherited: boolean - should be set to true iff value is inherited from a
   *     prototype, such that saving will create a new property binding
   *     overriding the interhited value, rather than replacing an existing
   *     value.
   *
   * Returns: string - metadata informing $.hosts.code['/editorXhr'].save
   *     what to do after creating the new value from the edited description.
   *     At present, metadata is only generated if it is a function.
   */
  var meta = '';
  if ($.utils.isObject(value)) {
    // TODO: add @copy_properties here, but not if the source code is a selector?
  }
  if (typeof value === 'function') {
    if (value.lastModifiedTime) {
      var date = new Date(value.lastModifiedTime);
      meta += '// @last_modified_time ' + date.toString() + '\n';
    }
    if (value.lastModifiedUser) {
      meta += '// @last_modified_user ' + String(value.lastModifiedUser) + '\n';
    }
    meta += '// @copy_properties ' + !inherited + '\n';
    var props = ['verb', 'dobj', 'prep', 'iobj'];
    for (var i = 0, prop; (prop = props[i]); i++) {
      try {
        meta += '// ' + (value[prop] ? '@set_prop ' + prop + ' = ' +
            JSON.stringify(value[prop]) : '@delete_prop ' + prop) + '\n';
      } catch (e) {
        // Unstringable value, or read perms error.  Skip.
      }
    }
    if (inherited) src = 'undefined';  // What source of oldValue will be.
    var hash = $.utils.string.hash('md5', src);
    meta += '// @hash ' + hash + '\n';
  }
	return meta;
};
Object.setOwnerOf($.hosts.code['/editorXhr'].generateMetaData, $.physicals.Maximilian);
$.hosts.code['/editorXhr'].sourceFor = function sourceFor(value) {
  /* Generate source code for a given value.
   *
   * Arguments:
   * - value: any - any JavaScript value.
   * Returns: string - source code for value.
   */
  switch (typeof value) {
    // Special-case the most common cases for efficiency and to reduce
    // chance of editor breaking due to bugs in $.utils.code.
    //
    // TODO: consider removing special case for strings once editor frontends
    // cope with single-quoted strings.
    case 'function': return Function.prototype.toString.call(value);
    case 'string': return JSON.stringify(value);
    case 'undefined': return 'undefined';
    default:
      // TODO: allow user-specified options.  N.B.: careful when dealing with
      //     editing sessions shared via MobWrite, to avoid @hash metatdata
      //     failures.
      // TODO: add selector to options, so as to avoid including a comment
      //     about it in the output when it is as expected - but think through
      //     implications for @hash checking carefully first!
      return $.utils.code.expressionFor(value, this.sourceOptions);
  }
};
Object.setOwnerOf($.hosts.code['/editorXhr'].sourceFor, $.physicals.Maximilian);
Object.setOwnerOf($.hosts.code['/editorXhr'].sourceFor.prototype, $.physicals.Maximilian);
$.hosts.code['/editorXhr'].sourceOptions = {};
Object.setOwnerOf($.hosts.code['/editorXhr'].sourceOptions, $.physicals.Maximilian);
$.hosts.code['/editorXhr'].sourceOptions.depth = 3;
$.hosts.code['/editorXhr'].sourceOptions.abbreviateMethods = true;
$.hosts.code['/svg'] = {};
Object.setOwnerOf($.hosts.code['/svg'], $.physicals.Neil);
$.hosts.code['/svg'].www = '<% var staticUrl = request.hostUrl(\'static\'); %>\n<html>\n  <head>\n    <title>Code City SVG Editor</title>\n    <script src="<%=staticUrl%>code/SVG-Edit/jquery.min.js"></script>\n    <script src="<%=staticUrl%>code/SVG-Edit/jquery-ui/jquery-ui-1.8.17.custom.min.js"></script>\n    <script src="<%=staticUrl%>code/svg.js" type="module"></script>\n    <link rel="stylesheet" href="<%=staticUrl%>style/svg.css">\n    <link rel="stylesheet" href="<%=staticUrl%>code/svg.css">\n  </head>\n\n  <body>\n    <div id="toolbox">\n      <div id="toolboxColumn1">\n        <button id="mode-select" onclick="svgEditor.canvas.setMode(\'select\')" title="Select tool">\n          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n            <path stroke="#fff" fill="#000" d="m7.382,2.469l0.075,17.0326l3.301,-2.626l2.626,5.628l4.201,-2.626l-3.301,-4.802l4.576,-0.375l-11.478,-12.230z"/>\n          </svg>\n        </button>\n        <button id="mode-pathedit" onclick="svgEditor.canvas.setMode(\'pathedit\')" title="Select tool" style="display: none">\n          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n            <circle stroke="#00f" fill="#0ff" r="3.879" cy="5.3" cx="8.7" stroke-width="1.5"/>\n            <path d="m9.182,5.670.078,15.162l3.416,-2.338l2.717,5.009l4.347,-2.338l-3.416,-4.275l4.736,-0.334l-11.878,-10.887z" fill="#000" stroke="#fff"/>\n          </svg>\n        </button>\n        <button id="mode-fhpath" onclick="svgEditor.canvas.setMode(\'fhpath\')" title="Freehand tool">\n          <svg viewBox="0 0 48 52" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n            <defs>\n              <linearGradient id="fhpathGrad" x1="0.305" y1="0.109" x2="0.613" y2="0.394">\n                <stop offset="0.0" stop-color="#f9d225" stop-opacity="1"/>\n                <stop offset="1.0" stop-color="#bf5f00" stop-opacity="1"/>\n              </linearGradient>\n            </defs>\n            <path d="M31.5,0 l-8.75,20.25 l0.75,24 l16.5,-16.5 l6,-12.5" fill="url(#fhpathGrad)" stroke="#000" stroke-width="2" fill-opacity="1" stroke-opacity="1"/>\n            <path d="M39.5,28.5 c-2,-9.25 -10.25,-11.75 -17,-7.438 l0.484,24.441z" fill="#fce0a9" stroke="#000" stroke-width="2" fill-opacity="1" stroke-opacity="1"/>\n            <path d="M26.932,41.174 c-0.449,-2.351 -2.302,-2.987 -3.818,-1.890 l0.109,6.213z" fill="#000" stroke="#000" stroke-width="2" fill-opacity="1" stroke-opacity="1"/>\n            <path d="M2.313,4.620 c12.500,-1.689 10.473,7.094 0,21.622 c22.973,-4.054 12.162,5.405 12.162,13.176 c-0.338,4.054 8.784,21.959 26.014,-1.351" fill="none" stroke="#000" stroke-width="2" fill-opacity="1" stroke-opacity="1"/>\n          </svg>\n        </button>\n        <button id="mode-line" onclick="svgEditor.canvas.setMode(\'line\')" title="Line tool">\n          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n            <defs>\n              <linearGradient id="lineGrad1" x1="0.184" y1="0.262" x2="0.777" y2="0.566">\n                <stop offset="0" stop-color="#fff" stop-opacity="1"/>\n                <stop offset="1" stop-color="#fce564" stop-opacity="1"/>\n              </linearGradient>\n              <linearGradient id="lineGrad2" x1="0.465" y1="0.156" x2="0.938" y2="0.394">\n                <stop offset="0" stop-color="#f2feff" stop-opacity="1"/>\n                <stop offset="1" stop-color="#14609b" stop-opacity="1"/>\n              </linearGradient>\n            </defs>\n            <line x1="0.998" y1="1.491" x2="12.977" y2="21.141" stroke="#000" fill="none"/>\n            <path d="m14.053,13.687l-1.464,7.526l4.038,-6.326" stroke="#000" fill="#a0a0a0"/>\n            <path d="m13.612,10.266c-0.386,1.052 -0.607,2.403 -0.504,3.125l4.335,1.814c0.462,-0.308 1.613,-1.714 1.613,-2.520" fill="url(#lineGrad1)" stroke="#000"/>\n            <path d="m16.613,1.000l-3.673,8.602l7.103,3.473l3.178,-7.205" fill="url(#lineGrad2)" stroke="#000"/>\n          </svg>\n        </button>\n        <button id="mode-square" onclick="svgEditor.canvas.setMode(\'square\')" title="Square tool">\n          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n            <defs>\n              <linearGradient x1="0.363" y1="0.102" x2="1" y2="1" id="squareGrad">\n                <stop offset="0" stop-color="#fff" stop-opacity="1"/>\n                <stop offset="1" stop-color="#3b7e9b" stop-opacity="1"/>\n              </linearGradient>\n            </defs>\n            <rect x="1.5" y="1.5" width="20" height="20" fill="url(#squareGrad)" stroke="#000"/>\n          </svg>\n        </button>\n        <button id="mode-rect" onclick="svgEditor.canvas.setMode(\'rect\')" title="Rectangle tool">\n          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n            <defs>\n              <linearGradient y2="1" x2="1" y1="0.102" x1="0.363" id="rectGrad">\n                <stop stop-opacity="1" stop-color="#fff" offset="0"/>\n                <stop stop-opacity="1" stop-color="#3b7e9b" offset="1"/>\n              </linearGradient>\n            </defs>\n            <rect transform="matrix(1, 0, 0, 1, 0, 0)" stroke="#000" fill="url(#rectGrad)" height="12" width="20" y="5.5" x="1.5"/>\n          </svg>\n        </button>\n        <button id="mode-circle" onclick="svgEditor.canvas.setMode(\'circle\')" title="Circle tool">\n          <svg viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n            <defs>\n              <linearGradient y2="1.0" x2="1.0" y1="0.188" x1="0.172" id="circleGrad">\n                <stop stop-opacity="1" stop-color="#fff" offset="0.0"/>\n                <stop stop-opacity="1" stop-color="#f66" offset="1.0"/>\n              </linearGradient>\n            </defs>\n            <circle stroke-opacity="1" fill-opacity="1" stroke-width="2" stroke="#000" fill="url(#circleGrad)" r="23" cy="27" cx="27"/>\n          </svg>\n        </button>\n        <button id="mode-ellipse" onclick="svgEditor.canvas.setMode(\'ellipse\')" title="Ellipse tool">\n          <svg viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n            <defs>\n             <linearGradient y2="1.0" x2="1.0" y1="0.188" x1="0.172" id="ellipseGrad">\n               <stop stop-opacity="1" stop-color="#fff" offset="0.0"/>\n               <stop stop-opacity="1" stop-color="#f66" offset="1.0"/>\n              </linearGradient>\n            </defs>\n            <ellipse stroke-opacity="1" fill-opacity="1" stroke-width="2" stroke="#000" fill="url(#ellipseGrad)" rx="23" ry="15" cy="27" cx="27"/>\n          </svg>\n        </button>\n        <button id="mode-path" onclick="svgEditor.canvas.setMode(\'path\')" title="Path tool">\n          <svg viewBox="0 0 124 124" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n            <defs>\n              <linearGradient y2="1" x2="1" y1="0.281" x1="0.336" id="pathGrad">\n                <stop stop-opacity="1" stop-color="#fff" offset="0"/>\n                <stop stop-opacity="1" stop-color="#33a533" offset="1"/>\n              </linearGradient>\n            </defs>\n            <path stroke-width="4" stroke="#000" fill="url(#pathGrad)" d="m6,103l55,-87c85,33.64 -26,37.12 55,87l-110,0z"/>\n          </svg>\n        </button>\n      </div>\n\n      <div id="toolboxColumn2">\n        <div id="selected-actions" style="display: none">\n          <button onclick="svgEditor.canvas.deleteSelectedElements()" title="Delete selected">\n            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n              <rect ry="3" rx="3" stroke="#800000" fill="#a00" height="20.295" width="21.175" y="1.703" x="1.420"/>\n              <rect ry="3" rx="3" stroke="#f55" fill="#a00" height="18.630" width="19.611" y="2.536" x="2.203"/>\n              <line stroke-width="2" fill="none" stroke="#fff" y2="16.851" x2="17.006" y1="6.851" x1="7.006"/>\n              <line stroke-width="2" fill="none" stroke="#fff" y2="16.851" x2="7.006" y1="6.851" x1="17.006"/>\n            </svg>\n          </button>\n        </div>\n        <div id="selected-single-actions" style="display: none">\n          <button onclick="svgEditor.canvas.moveToTopSelectedElement()" title="Move to top">\n            <svg viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n              <defs>\n                <linearGradient id="moveupGrad" x1="0" y1="0" x2="1" y2="0">\n                  <stop offset="0" stop-color="#9fdcf4" stop-opacity="1"/>\n                  <stop offset="1" stop-color="#617e96" stop-opacity="1"/>\n                </linearGradient>\n              </defs>\n              <line x1="1.3" y1="8.199" x2="12.8" y2="8.199" stroke="#000" fill="none" stroke-width="2"/>\n              <line x1="1.298" y1="12.199" x2="12.798" y2="12.199" stroke="#000" fill="none" stroke-width="2"/>\n              <line x1="1.299" y1="16.199" x2="12.799" y2="16.199" stroke="#000" fill="none" stroke-width="2"/>\n              <line x1="1.299" y1="20.199" x2="12.799" y2="20.199" stroke="#000" fill="none" stroke-width="2"/>\n              <rect x="1.55" y="1.85" width="20" height="3.2" fill="url(#moveupGrad)" stroke="#000"/>\n              <path d="m16.835,21.146l2.332,0l0,-11.046l1.985,0l-3.151,-3.449l-3.151,3.449l1.985,0l0,11.046z" fill="#000" stroke="none"/>\n            </svg>\n          </button>\n          <button onclick="svgEditor.canvas.moveToBottomSelectedElement()" title="Move to bottom">\n            <svg viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n              <defs>\n                <linearGradient y2="0" x2="1" y1="0" x1="0" id="movedownGrad">\n                  <stop stop-opacity="1" stop-color="#bc7f05" offset="0"/>\n                  <stop stop-opacity="1" stop-color="#fcfc9f" offset="1"/>\n                </linearGradient>\n              </defs>\n              <line stroke-width="2" fill="none" stroke="#000" y2="2.5" x2="22" y1="2.5" x1="10.5"/>\n              <line stroke-width="2" fill="none" stroke="#000" y2="6.5" x2="21.998" y1="6.5" x1="10.498"/>\n              <line stroke-width="2" fill="none" stroke="#000" y2="10.5" x2="21.999" y1="10.5" x1="10.499"/>\n              <line stroke-width="2" fill="none" stroke="#000" y2="14.5" x2="21.999" y1="14.5" x1="10.499"/>\n              <rect stroke="#000" fill="url(#movedownGrad)" height="2.2" width="20" y="17.65" x="1.65"/>\n              <path stroke="none" fill="#000" d="m4.25,1.55l2.35,0l0,11.05l2,0l-3.175,3.45l-3.175,-3.45l2,0l0,-11.05z"/>\n            </svg>\n          </button>\n          <button onclick="svgEditor.changeFill()" title="Fill colour">\n            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n              <rect height="24" width="24" y="0" x="0" id="fillRect"/>\n              <g id=\'fillNone\'>\n                <line stroke="#d40000" x1="0" y1="0" x2="24" y2="24"/>\n                <line stroke="#d40000" x1="24" y1="0" x2="0" y2="24"/>\n              </g>\n              <rect height="24" width="24" y="0" x="0" fill="none" stroke="#000" stroke-width="1"/>\n            </svg>\n          </button>\n          <button onclick="svgEditor.changeStroke()" title="Line colour">\n            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n              <rect height="20" width="20" y="2" x="2" id="strokeRect"/>\n            </svg>\n          </button>\n          <button onclick="svgEditor.canvas.convertToPath()" title="Convert to path" id="convertpath-action">\n            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n              <defs>\n                <linearGradient y2="0.469" x2="0.430" y1="0.102" x1="0.105" id="convertpathGrad">\n                  <stop stop-color="#f00" offset="0"/>\n                  <stop stop-opacity="0" stop-color="#f00" offset="1"/>\n                </linearGradient>\n              </defs>\n              <circle cx="21" cy="21.312" r="18.445" fill="url(#convertpathGrad)" stroke="#000"/>\n              <path fill="none" stroke="#000" d="m2.875,21.312c-0.375,-9.25 7.75,-18.875 17.75,-18"/>\n              <line x1="25.375" y1="3.062" x2="8.5" y2="3.062" stroke="#808080" fill="none"/>\n              <line x1="2.625" y1="24.75" x2="2.625" y2="9.812" stroke="#808080" fill="none"/>\n              <circle cx="8.5" cy="2.938" r="1.953" fill="#0ff" stroke="#00f" stroke-width="0.5"/>\n              <circle cx="2.625" cy="9.812" r="1.953" fill="#0ff" stroke="#00f" stroke-width="0.5"/>\n              <circle cx="20.875" cy="3.188" r="2.5" fill="#0ff" stroke="#00f"/>\n              <circle cx="2.875" cy="21.062" r="2.5" fill="#0ff" stroke="#00f"/>\n            </svg>\n          </button>\n        </div>\n        <div id="node-actions" style="display: none">\n          <button onclick="svgEditor.canvas.pathActions.clonePathNode()" title="Add node">\n            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n              <path stroke-width="2" d="m4.195,19.421c15.494,-15.533 -0.211,0.158 15.611,-15.579" stroke="#8dd35f" fill="none"/>\n              <circle stroke-width="0.5" stroke="#00f" fill="#0ff" r="2.262" cy="4" cx="19.75"/>\n              <circle stroke-width="0.5" stroke="#00f" fill="#0ff" r="2.262" cy="19.403" cx="4.065"/>\n              <circle stroke-width="0.5" stroke="#00f" fill="#0ff" r="2.262" cy="11.625" cx="11.938"/>\n              <line stroke-linecap="round" y2="14.466" x2="9.666" y1="4.022" x1="9.782" stroke-dasharray="null" stroke-width="2" stroke="#00f" fill="#00f"/>\n              <line stroke-linecap="round" y2="9.453" x2="15.150" y1="9.394" x1="4.473" stroke-dasharray="null" stroke-width="2" stroke="#00f" fill="#00f"/>\n            </svg>\n          </button>\n          <button onclick="svgEditor.canvas.pathActions.deletePathNode()" title="Delete node">\n            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n              <path stroke-width="2" d="m4.195,19.421c15.494,-15.533 -0.211,0.158 15.611,-15.579" stroke="#8dd35f" fill="none"/>\n              <circle stroke-width="0.5" stroke="#00f" fill="#0ff" r="2.262" cy="4" cx="19.75"/>\n              <circle stroke-width="0.5" stroke="#00f" fill="#0ff" r="2.262" cy="19.403" cx="4.065"/>\n              <circle stroke-width="0.5" stroke="#00f" fill="#0ff" r="2.262" cy="11.625" cx="11.938"/>\n              <g transform="rotate(-45.29 9.81,9.24)">\n                <line stroke-linecap="round" y2="9.453" x2="15.150" y1="9.394" x1="4.473" stroke-dasharray="null" stroke-width="2" stroke="#f00" fill="none"/>\n                <line stroke-linecap="round" y2="14.466" x2="9.666" y1="4.022" x1="9.782" stroke-dasharray="null" stroke-width="2" stroke="#f00" fill="none"/>\n              </g>\n            </svg>\n          </button>\n          <button onclick="svgEditor.canvas.pathActions.opencloseSubPath()" id="open-action" title="Open path" style="display: none">\n            <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n              <path stroke="#000" stroke-width="15" fill="#ffc8c8" d="m123.5,38l-84,106l27,115l166,2l29,-111"/>\n              <line x1="276.5" y1="153" x2="108.5" y2="24" stroke="#000" stroke-width="10" fill="none"/>\n              <g stroke-width="15" stroke="#00f" fill="#0ff">\n                <circle r="30" cy="41" cx="123"/>\n                <circle r="30" cy="146" cx="40"/>\n                <circle r="30" cy="260" cx="69"/>\n                <circle r="30" cy="260" cx="228"/>\n                <circle r="30" cy="148" cx="260"/>\n              </g>\n              <g stroke="#a00" stroke-width="15" fill="none">\n                <line x1="168" y1="24" x2="210" y2="150"/>\n                <line x1="210" y1="24" x2="168" y2="150"/>\n              </g>\n            </svg>\n          </button>\n          <button onclick="svgEditor.canvas.pathActions.opencloseSubPath()" id="close-action" title="Close path" style="display: none">\n            <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n              <path stroke="#000" stroke-width="15" fill="#ffc8c8" d="m121.5,40l-84,106l27,115l166,2l29,-111"/>\n              <line x1="240" y1="136" x2="169.5" y2="74" stroke="#a00" stroke-width="25" fill="none"/>\n              <path stroke="none" fill="#a00" d="m158,65l31,74l-3,-50l51,-3z"/>\n              <g stroke-width="15" stroke="#00f" fill="#0ff">\n                <circle r="30" cy="41" cx="123"/>\n                <circle r="30" cy="146" cx="40"/>\n                <circle r="30" cy="260" cx="69"/>\n                <circle r="30" cy="260" cx="228"/>\n                <circle r="30" cy="148" cx="260"/>\n              </g>\n            </svg>\n          </button>\n        </div>\n      </div>\n    </div>\n\n    <div id="editorContainer"></div>\n\n    <div id="menu">\n      <div id="menuCut" class="menuitem">Cut</div>\n      <div id="menuCopy" class="menuitem">Copy</div>\n      <div id="menuPaste" class="menuitem">Paste</div>\n      <div class="menudiv"></div>\n      <div id="menuDelete" class="menuitem">Delete</div>\n    </div>\n  </body>\n</html>\n';
$.hosts.code['/login'] = {};
Object.setOwnerOf($.hosts.code['/login'], $.physicals.Neil);
$.hosts.code['/login'].www = '<!doctype html>\n<% var staticUrl = request.hostUrl(\'static\'); %>\n<html lang="en">\n<head>\n  <title>Code City Login</title>\n  <style>\n    body {\n      font-family: "Roboto Mono", monospace;\n      text-align: center;\n    }\n    h1 {\n      font-size: 40pt;\n      font-weight: 100;\n    }\n    h1>img {\n      vertical-align: text-bottom;\n    }\n    #tagline {\n      font-style: italic;\n      margin: 2em;\n    }\n    iframe {\n      height: 50px;\n      width: 100px;\n      border: none;\n      display: block;\n      margin: 0 auto;\n    }\n  </style>\n  <link href="https://fonts.googleapis.com/css?family=Roboto+Mono" rel="stylesheet">\n  <link href="<%=staticUrl%>favicon.ico" rel="shortcut icon">\n</head>\n<body>\n  <h1>\n    <img src="<%=staticUrl%>logo.svg" alt="" width="95" height="100">\n    Code City\n  </h1>\n  <p id="tagline">Login required to edit code.</p>\n  <iframe src="<%=request.hostUrl(\'login\')%>?after=<%=staticUrl%>login-close.html"></iframe>\n</body>\n</html>';
$.hosts.code['/mirror'] = $.hosts.root['/mirror'];
$.hosts.code['/eval'] = {};
Object.setOwnerOf($.hosts.code['/eval'], $.physicals.Neil);
$.hosts.code['/eval'].www = "<!doctype html>\n<% var staticUrl = request.hostUrl('static'); %>\n<html>\n  <head>\n    <title>Code City Eval</title>\n    <style>\nbody {\n  font-family: \"Roboto Mono\", monospace;\n  margin: 0;\n}\n#resultsPre {\n  bottom: 4em;\n  box-sizing: border-box;\n  left: 0;\n  overflow-y: scroll;\n  padding-left: 1em;\n  position: absolute;\n  top: 2em;\n  width: 100%;\n}\n      \n#evalTextarea {\n  color: #000;\n  bottom: 0;\n  box-sizing: border-box;\n  background-color: #f8f8f8;\n  font-size: 12pt;\n  height: 42pt;\n  margin-top: 2px;\n  position: absolute;\n  resize: none;\n  width: 100%;\n}\n    </style>\n    <link href=\"https://fonts.googleapis.com/css?family=Roboto+Mono\" rel=\"stylesheet\">\n    <link href=\"<%=staticUrl%>favicon.ico\" rel=\"shortcut icon\">\n    <script>\nfunction init() {\n  document.getElementById('evalTextarea').addEventListener('keydown', keydown, false);\n}\nwindow.addEventListener('load', init);\n      \nfunction keydown(e) {\n  if (e.key !== 'Enter') {\n    return;\n  }\n  var ta = document.getElementById('evalTextarea');\n  var value = ta.value.trim();\n  ta.value = '';\n  ta.placeholder = '';\n  e.preventDefault();\n  if (value === '') {\n    return;\n  }\n  addLine('> ' + value);\n  send(value);\n}\n\nfunction send(text) {\n  var xhr = new XMLHttpRequest();   // new HttpRequest instance \n  var theUrl = \"/json-handler\";\n  xhr.open('POST', 'evalXhr');\n  xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');\n  xhr.onload = receive;\n  xhr.send(text);\n}\n\nfunction receive() {\n  if (this.status !== 200) {\n    addLine('HTTP Error: ' + this.status);\n  } else {\n    addLine(this.responseText);\n  }\n}\n\nfunction addLine(text) {\n  var pre = document.getElementById('resultsPre');\n  pre.textContent += '\\n' + text;\n  pre.scrollTop = Number.MAX_SAFE_INTEGER;\n}\n    </script>\n  \n  </head>\n  <body>\n    <h4>Immediate Eval</h4>\n    <pre id=\"resultsPre\"></pre>\n    <textarea id=\"evalTextarea\" placeholder=\"1 + 2\" style=\"font-family: 'Roboto Mono', monospace;\"></textarea>\n  </body>\n</html>";
$.hosts.code['/evalXhr'] = {};
Object.setOwnerOf($.hosts.code['/evalXhr'], $.physicals.Neil);
$.hosts.code['/evalXhr'].www = function code_evalXhr_www(request, response) {
  setPerms(request.user);
  var output = '';
  if (!request.fromSameOrigin()) {
    // Security check to ensure this is being loaded by the eval editor.
    output = 'Cross-origin referer: ' + String(request.headers.referer);
  } else {
    try {
      var src = $.utils.code.rewriteForEval(request.data);
      output = $.utils.code.eval(src);
    } catch (e) {
      suspend();
      output = String(e);
    }
  }
  response.write(output);
};
Object.setOwnerOf($.hosts.code['/evalXhr'].www, $.physicals.Maximilian);
Object.setOwnerOf($.hosts.code['/evalXhr'].www.prototype, $.physicals.Neil);

