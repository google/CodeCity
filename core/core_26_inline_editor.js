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
 * @fileoverview Inline code editor for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.hosts.code = (new 'Object.create')($.servers.http.Host.prototype);

$.hosts.code['/inlineEdit'] = {};
$.hosts.code['/inlineEdit'].edit = function edit(obj, name, key) {
  /* Return a (valid) URL for a web editing session editing obj[key],
   * where obj might more commonly be known as name.
   */
  if (!$.utils.isObject(obj)) throw new TypeError('obj must be an object');
  if (typeof(key) !== 'string') throw new TypeError('key must be a string');

  var objId = $.db.tempId.storeObj(obj);
  var url = $.hosts.root.url('code') + 'inlineEdit?objId=' + objId;
  if (name) {
    url += '&name=' + encodeURIComponent(name);
  }
  if (key) {
    url += '&key=' + encodeURIComponent(key);
  }
  return url;
};
Object.setOwnerOf($.hosts.code['/inlineEdit'].edit, $.physicals.Maximilian);
$.hosts.code['/inlineEdit'].load = function load(obj, key) {
  /* Return string containing initial editor contents for editing
   * obj[key].
   */
  var pd = Object.getOwnPropertyDescriptor(obj, key);
  var value = pd ? pd.value : undefined;
  if (typeof value === 'function') {
    return Function.prototype.toString.apply(value);
  } else {
    return $.utils.code.expressionFor(value, {depth: 1});
  }
};
Object.setOwnerOf($.hosts.code['/inlineEdit'].load, $.physicals.Maximilian);
$.hosts.code['/inlineEdit'].save = function save(obj, key, src) {
  /* Eval the string src and (if successful) save the resulting value
   * as obj[key].  If the value produced from src and the existing
   * value of obj[key] are both objects, then an attempt will be made
   * to copy any properties from the old value to the new one.
   */
  var old = obj[key];
  src = $.utils.code.rewriteForEval(src, /* forceExpression= */ true);
  // Evaluate src in global scope (eval by any other name, literally).
  // TODO: don't use eval - prefer Function constructor for
  // functions; generate other values from an Acorn parse tree.
  var evalGlobal = eval;
  var val = evalGlobal(src);
  if (typeof old === 'function' && typeof val === 'function') {
    $.utils.object.transplantProperties(old, val);
  }
  if (typeof val === 'function') {
    val.lastModifiedTime = Date.now();
    // TODO: Add user.
    //val.lastModifiedUser = ...;
  }
  obj[key] = val;
  return this.load(obj, key);
};
Object.setOwnerOf($.hosts.code['/inlineEdit'].save, $.physicals.Maximilian);
$.hosts.code['/inlineEdit'].www = '<%\nvar staticUrl = request.hostUrl(\'static\');\nvar params = request.parameters;\nvar objId = params.objId;\nvar obj = $.db.tempId.getObjById(params.objId);\nif (!$.utils.isObject(obj)) {\n  // Bad edit URL.\n  response.sendError(404);\n  return;\n}\nvar key = params.key;\nvar src = params.src;\nvar status = \'\';\nif (src) {\n  try {\n    if (!request.fromSameOrigin()) {\n      // Security check to ensure this is being loaded by the code editor.\n      throw new Error(\'Cross-origin referer: \' + String(request.headers.referer));\n    }\n    src = this.save(obj, key, src);\n    status = \'(saved)\';\n    if (typeof obj[key] === \'function\') {\n      if (params.isVerb) {\n        obj[key].verb = params.verb;\n        obj[key].dobj = params.dobj;\n        obj[key].prep = params.prep;\n        obj[key].iobj = params.iobj;\n      } else {\n        delete obj[key].verb;\n        delete obj[key].dobj;\n        delete obj[key].prep;\n        delete obj[key].iobj;\n      }\n    }\n  } catch (e) {\n    status = \'(ERROR: \' + String(e) + \')\';\n  }\n} else {\n  src = this.load(obj, key);\n}\nvar isVerb = (Object.getOwnPropertyDescriptor(obj, key) && typeof obj[key] === \'function\') && obj[key].verb ? \'checked\' : \'\';\nvar verb = $.utils.html.escape((obj[key] && obj[key].verb) || \'\');\nvar dobj = obj[key] && obj[key].dobj;\nvar prep = obj[key] && obj[key].prep;\nvar iobj = obj[key] && obj[key].iobj;\nvar name = $.utils.html.escape(params.name);\nkey = $.utils.html.escape(key);\nvar objOpts = [\'none\', \'this\', \'any\']\n%>\n<!DOCTYPE html>\n<html><head>\n  <title>Code Editor for <%= name %>.<%= key %></title>\n  <link href="<%=staticUrl%>style/jfk.css" rel="stylesheet">\n  <style>\n    body {margin: 0; font-family: sans-serif}\n    h1 {margin-bottom: 5; font-size: small}\n    #submit {position: fixed; bottom: 1ex; right: 2ex; z-index: 9}\n    .CodeMirror {height: auto; border: 1px solid #eee}\n    #verb {width: 15ex}\n  </style>\n\n  <link rel="stylesheet" href="<%=staticUrl%>CodeMirror/lib/codemirror.css">\n  <script src="<%=staticUrl%>CodeMirror/lib/codemirror.js"></script>\n  <script src="<%=staticUrl%>CodeMirror/mode/javascript/javascript.js"></script>\n</head><body>\n  <form action="inlineEdit" method="post">\n  <button type="submit" class="jfk-button-submit" id="submit"\n    onclick="document.getElementById(\'src\').value = editor.getValue()">Save</button>\n  <h1>Editing <%= name %>.<%= key %>\n    <span id="status"><%= status %></span></h1>\n  <input name="objId" type="hidden" value="<%= $.utils.html.escape(objId) %>">\n  <input name="name" type="hidden" value="<%= name %>">\n  <input name="key" type="hidden" value="<%= key %>">\n  <div><input type="checkbox" name="isVerb" id="isVerb" <%= isVerb %> onclick="updateDisabled(); changed()">\n    <label for="isVerb">Verb:</label>\n    <input name="verb" id="verb" value="<%= verb %>" placeholder="name">\n    <select name="dobj" id="dobj" onchange="changed()">\n      <% for (var i = 0; i < objOpts.length; i++) {%>\n        <option <%= dobj === objOpts[i] ? \'selected\' : \'\' %>><%= objOpts[i] %></option>\n      <% } %>\n    </select>\n    <select name="prep" id="prep" onchange="changed()">\n      <% for (var i = 0; i < $.utils.command.prepositionOptions.length; i++) {%>\n        <option <%= prep === $.utils.command.prepositionOptions[i] ? \'selected\' : \'\' %>><%= $.utils.command.prepositionOptions[i] %></option>\n      <% } %>\n    </select>\n    <select name="iobj" id="iobj" onchange="changed()">\n      <% for (var i = 0; i < objOpts.length; i++) {%>\n        <option <%= iobj === objOpts[i] ? \'selected\' : \'\' %>><%= objOpts[i] %></option>\n      <% } %>\n    </select>\n  </div>\n  <textarea name="src" id="src"><%= $.utils.html.escape(src) %>\n</textarea>\n  </form>\n  <script>\n    var editor = CodeMirror.fromTextArea(document.getElementById(\'src\'), {\n      lineNumbers: true,\n      matchBrackets: true,\n      viewportMargin: Infinity,\n    });\n    editor.on(\'change\', changed);\n    function changed() {\n      document.getElementById(\'status\').innerText = \'(modified)\'\n    }\n    function updateDisabled() {\n      var disabled = document.getElementById(\'isVerb\').checked ? \'\' : \'disabled\';\n      document.getElementById(\'verb\').disabled = disabled;\n      document.getElementById(\'dobj\').disabled = disabled;\n      document.getElementById(\'prep\').disabled = disabled;\n      document.getElementById(\'iobj\').disabled = disabled;\n    }\n    updateDisabled();\n  </script>\n</body></html>';

$.hosts.root.subdomains.code = $.hosts.code;

