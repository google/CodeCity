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

$.editor = { objs: [] };

$.editor.edit = function(obj, name, key) {
  /* Return a (valid) URL for a web editing session editing obj[key],
   * where obj might more commonly be known as name.
   */
  if (typeof obj !== 'object' && typeof obj !== 'function') {
    throw TypeError('Can only edit objects');
  }
  var objId = this.objIdFor(obj);
  var url = '/web/edit?objId=' + objId;
  if (name) {
    url += '&name=' + encodeURIComponent(name);
  }
  if (key) {
    url += '&key=' + encodeURIComponent(key);
  }
  return url;
};

$.editor.objIdFor = function(obj) {
  /* Find index of obj in this.objs, adding it if it's not already there.
   */
  for (var i = 0; i < this.objs.length; i++) {
    if (this.objs[i] === obj) {
      return i;
    }
  }
  var id = this.objs.length;
  this.objs.push(obj);
  return id;
};

$.www.web.edit = function(path, params) {
  var objId = params.objId;
  var obj = $.editor.objs[params.objId];
  if (typeof obj !== 'object' && typeof obj !== 'function') {
    // Bad edit URL.
    this.default();
    return;
  }
  var name = params.name, key = params.key, src = params.src, editor = '';
  if (src) {
    try {
      // TODO: don't eval.
      obj[key] = eval('(' + src + ')');
      editor += 'Saved!<br>';
    } catch (e) {
      editor += 'ERROR: ' + String(e);
    }
  } else {
    var v = obj[key];
    src = (typeof v === 'string' ?
        "'" + v.replace(/[\\']/g, '\$&') + "'" :
        String(v));
  }
  editor += '<h1>Editing ' + $.utils.htmlEscape(name) + '.' +
      $.utils.htmlEscape(key) + '</h1>';
  editor += '<form action="/web/edit" method="get">';
  editor += '<input name=objId type="hidden" value="' +
      $.utils.htmlEscape(objId) + '">';
  editor += '<input name=name type="hidden" value="' +
      $.utils.htmlEscape(name) + '">';
  editor += '<input name=key type="hidden" value="' +
      $.utils.htmlEscape(key) + '">';
  editor += '<textarea name="src">' + $.utils.htmlEscape(src) + '</textarea>';
  editor += '<br/>';
  editor += '<button type="reset">Revert</button>';
  editor += '<button type="submit">Save</button>';
  editor += '</form>';
  this.write('<html><head><title>Code Editor for ' +
      $.utils.htmlEscape(name) + '.' + $.utils.htmlEscape(key) +
      '</title></head>');
  this.write('<body>' + editor + '</body></html>');
};
