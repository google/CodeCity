/**
 * @license
 * Code City: Minimal code editor.
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
 * @fileoverview Code editor for Code City.
 * @author cpcallen@google.com (Christopher Allen)
 */

$.www.editor = {};

$.www.editor.edit = function(obj, name, key) {
  /* Return a (valid) URL for a web editing session editing obj[key],
   * where obj might more commonly be known as name.
   */
  if (typeof obj !== 'object' && typeof obj !== 'function') {
    $.utils.command.abort('Can only edit objects');
  }
  var objId = $.db.tempId.storeObj(obj);
  var url = '/editor?objId=' + objId;
  if (name) {
    url += '&name=' + encodeURIComponent(name);
  }
  if (key) {
    url += '&key=' + encodeURIComponent(key);
  }
  return url;
};

$.www.editor.load = function(obj, key) {
  /* Return string containing initial editor contents for editing
   * obj[key].
   */
  var pd = Object.getOwnPropertyDescriptor(obj, key);
  var value = pd ? pd.value : undefined;
  return $.utils.code.toSourceSafe(value);
};

$.www.editor.save = function(obj, key, src) {
  /* Eval the string src and (if successful) save the resulting value
   * as obj[key].  If the value produced from src and the existing
   * value of obj[key] are both objects, then an attempt will be made
   * to copy any properties from the old value to the new one.
   */
  // Use Acorn to trim source to first expression.
  var ast = $.utils.acorn.parseExpressionAt(src, 0, { ecmaVersion: 5 });
  src = src.substring(ast.start, ast.end);
  // Evaluate src in global scope (eval by any other name, literally).
  // TODO: don't use eval - prefer Function constructor for
  // functions; generate other values from an Acorn parse tree.
  var evalGlobal = eval;
  var old = obj[key];
  var val = evalGlobal('(' + src + ')');
  if ($.utils.isObject(val) && $.utils.isObject(old)) {
    $.utils.transplantProperties(old, val);
  }
  obj[key] = val;
  return src;
};


$.www.editor.www = function(request, response) {
  // Overwrite on first execution.
  $.www.editor.www = $.jssp.compile($.www.editor.www);
  $.www.editor.www.call(this, request, response);
};
$.www.editor.www.jssp = [
  '<%',
  'var params = request.parameters;',
  'var objId = params.objId;',
  'var obj = $.db.tempId.getObjById(params.objId);',
  'if (!$.utils.isObject(obj)) {',
  '  // Bad edit URL.',
  '  $.www[\'404\'].www(request, response);',
  '  return;',
  '}',
  'var key = params.key;',
  'var src = params.src;',
  'var status = \'\';',
  'if (src) {',
  '  try {',
  '    // Use Acorn to trim source to first expression.',
  '    var ast = $.utils.acorn.parseExpressionAt(src, 0, { ecmaVersion: 5 });',
  '    src = src.substring(ast.start, ast.end);',
  '    src = $.www.editor.save(obj, key, src);',
  '    status = \'(saved)\';',
  '    if (typeof obj[key] === \'function\') {',
  '      if (params.isVerb) {',
  '        obj[key].verb = params.verb;',
  '        obj[key].dobj = params.dobj;',
  '        obj[key].prep = params.prep;',
  '        obj[key].iobj = params.iobj;',
  '      } else {',
  '        delete obj[key].verb;',
  '        delete obj[key].dobj;',
  '        delete obj[key].prep;',
  '        delete obj[key].iobj;',
  '      }',
  '    }',
  '  } catch (e) {',
  '    status = \'(ERROR: \' + String(e) + \')\';',
  '  }',
  '} else {',
  '  src = $.www.editor.load(obj, key);',
  '}',
  'var isVerb = (Object.getOwnPropertyDescriptor(obj, key) && typeof obj[key] === \'function\') && obj[key].verb ? \'checked\' : \'\';',
  'var verb = $.utils.htmlEscape((obj[key] && obj[key].verb) || \'\');',
  'var dobj = obj[key] && obj[key].dobj;',
  'var prep = obj[key] && obj[key].prep;',
  'var iobj = obj[key] && obj[key].iobj;',
  'var name = $.utils.htmlEscape(params.name);',
  'key = $.utils.htmlEscape(key);',
  'var objOpts = [\'none\', \'this\', \'any\']',
  '%>',
  '<!DOCTYPE html>',
  '<html><head>',
  '  <title>Code Editor for <%= name %>.<%= key %></title>',
  '  <link href="/static/jfk.css" rel="stylesheet">',
  '  <link href="/static/CodeMirror/codemirror.css" rel="stylesheet">',
  '  <style>',
  '    body {margin: 0; font-family: sans-serif}',
  '    h1 {margin-bottom: 5; font-size: small}',
  '    #submit {position: fixed; bottom: 1ex; right: 2ex; z-index: 9}',
  '    .CodeMirror {height: auto; border: 1px solid #eee}',
  '    #verb {width: 15ex}',
  '  </style>',
  '  <script src="/static/CodeMirror/codemirror.js"></script>',
  '  <script src="/static/CodeMirror/javascript.js"></script>',
  '</head><body>',
  '  <form action="/editor" method="post">',
  '  <button type="submit" class="jfk-button-submit" id="submit"',
  '    onclick="document.getElementById(\'src\').value = editor.getValue()">Save</button>',
  '  <h1>Editing <%= name %>.<%= key %>',
  '    <span id="status"><%= status %></span></h1>',
  '  <input name="objId" type="hidden" value="<%= $.utils.htmlEscape(objId) %>">',
  '  <input name="name" type="hidden" value="<%= name %>">',
  '  <input name="key" type="hidden" value="<%= key %>">',
  '  <div><input type="checkbox" name="isVerb" id="isVerb" <%= isVerb %> onclick="updateDisabled(); changed()">',
  '    <label for="isVerb">Verb:</label>',
  '    <input name="verb" id="verb" value="<%= verb %>" placeholder="name">',
  '    <select name="dobj" id="dobj" onchange="changed()">',
  '      <% for (var i = 0; i < objOpts.length; i++) {%>',
  '        <option <%= dobj === objOpts[i] ? \'selected\' : \'\' %>><%= objOpts[i] %></option>',
  '      <% } %>',
  '    </select>',
  '    <select name="prep" id="prep" onchange="changed()">',
  '      <% for (var i = 0; i < $.utils.command.prepositionOptions.length; i++) {%>',
  '        <option <%= prep === $.utils.command.prepositionOptions[i] ? \'selected\' : \'\' %>><%= $.utils.command.prepositionOptions[i] %></option>',
  '      <% } %>',
  '    </select>',
  '    <select name="iobj" id="iobj" onchange="changed()">',
  '      <% for (var i = 0; i < objOpts.length; i++) {%>',
  '        <option <%= iobj === objOpts[i] ? \'selected\' : \'\' %>><%= objOpts[i] %></option>',
  '      <% } %>',
  '    </select>',
  '  </div>',
  '  <textarea name="src" id="src"><%= $.utils.htmlEscape(src) %>\n</textarea>',
  '  </form>',
  '  <script>',
  '    var editor = CodeMirror.fromTextArea(document.getElementById(\'src\'), {',
  '      lineNumbers: true,',
  '      matchBrackets: true,',
  '      viewportMargin: Infinity,',
  '    });',
  '    editor.on(\'change\', changed);',
  '    function changed() {',
  '      document.getElementById(\'status\').innerText = \'(modified)\'',
  '    }',
  '    function updateDisabled() {',
  '      var disabled = document.getElementById(\'isVerb\').checked ? \'\' : \'disabled\';',
  '      document.getElementById(\'verb\').disabled = disabled;',
  '      document.getElementById(\'dobj\').disabled = disabled;',
  '      document.getElementById(\'prep\').disabled = disabled;',
  '      document.getElementById(\'iobj\').disabled = disabled;',
  '    }',
  '    updateDisabled();',
  '  </script>',
  '</body></html>',
].join('\n');

$.www.ROUTER.editor = {regexp: /^\/editor(\?|$)/, handler: $.www.editor};
