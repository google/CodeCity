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
 * @fileoverview JavaScript Server Pages for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.jssp = {};
Object.setOwnerOf($.jssp, $.physicals.Neil);
$.jssp.OutputBuffer = function OutputBuffer() {
  /* An OutputBuffer is a mock $.servers.http.Response, used wheen we
   * want a Jssp to produce a string rather than write to an HTTP
   * client.
   */
  this.buffer_ = '';
};
Object.setOwnerOf($.jssp.OutputBuffer, $.physicals.Maximilian);
$.jssp.OutputBuffer.prototype.write = function write(text) {
  this.buffer_ += String(text);
};
Object.setOwnerOf($.jssp.OutputBuffer.prototype.write, $.physicals.Neil);
$.jssp.OutputBuffer.prototype.toString = function toString() {
  return this.buffer_;
};
Object.setOwnerOf($.jssp.OutputBuffer.prototype.toString, $.physicals.Neil);
$.jssp.OutputBuffer.prototype.writeEscaped = function writeEscaped(text) {
  // Same as .write, but HTML-escape the text first.
  this.write($.utils.html.escape(text));
};
Object.setOwnerOf($.jssp.OutputBuffer.prototype.writeEscaped, $.physicals.Neil);
Object.setOwnerOf($.jssp.OutputBuffer.prototype.writeEscaped.prototype, $.physicals.Neil);
$.jssp.eval = function $_jssp_eval(obj, prop, opt_request, opt_response) {
  /* Compile and run a JavaScript Server Page.
   *
   * The specified property on the given object will, if it is a string,
   * be compiled to a function and then called.
   *
   * TODO: cache the compiled JSSP.  Separate copy per owner?
   *
   * Arguments:
   * - obj: Object - an object containing a property which is a JSSP source
   *   string, and which will be used as the value of 'this' when the
   *   the resulting function is called.
   * - prop: string - name of the property on obj that contains the JSSP source.
   * - opt_request: any - a value to be passed as the first argument to the
   *   compiled function.  Most typically an instnace of $.servers.http.Request
   *   or some kind of options object.
   * - opt_response: {write: function(string)} | undefined - an object to
   *   accumulate generated output.  Most typically an instance of
   *   $.servers.http.Response.  If omitted, a $.jssp.OutputBuffer will be
   *   supplied, and the accumulated output returned by eval as a string.
   *
   * Returns: any - if opt_response was omitted, this will be the generated
   *     string; otherwise, it will be the actual return value of the compiled
   *     function (typically undefined).
   */
  if (!$.utils.isObject(obj)) {
    throw new TypeError('first argument must be an object');
  } else if (!(prop in obj)) {
    throw new RangeError('"' + prop + '" not on object.');
  }
  var source = obj[prop];
  if (typeof source !== 'string') {
    throw TypeError('source property "' + prop + '" must be a string');
  }

  // Switch to the JSSP owner's permissions.  The owner of the JSSP might
  // not be the object's owner if the property is inherited.
  var locationObj = $.utils.object.getPropertyLocation(obj, prop);
  setPerms(Object.getOwnerOf(locationObj));

  var request = opt_request;
  var response = opt_response || new $.jssp.OutputBuffer();

  // Compile source into a function.
  var code = this.compile_(source);
  code = '\n' +
      'var this_ = this;\n' +
      'function include(prop) {return $.jssp.eval(this_, prop, request, response);}\n' +
      code;
  var func;
  try {
    func = new Function('request, response', code);
  } catch (e) {
    suspend();
    $.system.log('JSSP compilation error.  ' + String(e) +
                 '.  Code was:\n' + code.split('\n')
                     .map(function (line, lineNumber) {
                            return String(lineNumber) + ': ' + line;})
                     .join('\n'));
    throw e;
  }

  // Create a .name for this function.
  var selector = $.Selector.for(locationObj);
  if (selector) {
    selector = new $.Selector(selector.concat(prop));
    Object.defineProperty(func, 'name', {value: selector.toString(), configurable: true});
  }

  var result = func.call(obj, request, response);
  return opt_response ? result : response.toString();
};
Object.setOwnerOf($.jssp.eval, $.physicals.Maximilian);
Object.setOwnerOf($.jssp.eval.prototype, $.physicals.Neil);
$.jssp.compile_ = function compile_(src) {
  /* Compile JavaScript Server Page srouce and return the translated source
   * if successful.  It is left to the caller to pass the resulting source
   * code to the Function constructor.
   *
   * Arguments:
   * - src: string - the JSSP source code.
   * Returns: string - the JavaScript generated from src.
   */
  if (typeof src !== 'string') {
    throw new TypeError('src must be a string');
  }
  var tokens = src.trim().split(/(<%(?:--|:|=)?|(?:--)?%>)/);
  var code = [
    '// DO NOT EDIT THIS CODE: AUTOMATICALLY GENERATED BY JSSP ' +
        compile_.lastModifiedTime + '.',
  ];
  var STATES = {
    LITERAL: 0,
    STATEMENT: 1,
    EXPRESSION: 2,
    EXPRESSION_ESCAPED: 3,
    COMMENT: 4
  };
  var state = STATES.LITERAL;
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (!token) {
      continue;  // Empty string caused by splitting adjacent tags.
    }
    switch (state) {
      case STATES.LITERAL:
        if (token === '<%') {
          state = STATES.STATEMENT;
        } else if (token === '<%=') {
          state = STATES.EXPRESSION;
        } else if (token === '<%:') {
          state = STATES.EXPRESSION_ESCAPED;
        } else if (token === '<%--') {
          state = STATES.COMMENT;
        } else {
          code.push('response.write(' + JSON.stringify(token) + ');');
        }
        break;
      case STATES.STATEMENT:
        if (token === '%>') {
          state = STATES.LITERAL;
        } else {
          code.push(token);
        }
        break;
      case STATES.EXPRESSION:
      case STATES.EXPRESSION_ESCAPED:
        if (token === '%>') {
          state = STATES.LITERAL;
        } else {
          token = token.trim();
          if (token) {
            code.push();
            if (state === STATES.EXPRESSION_ESCAPED) {
              code.push('response.writeEscaped(' + token + ');');
            } else {
              code.push('response.write(' + token + ');');
            }
          }
        }
        break;
      case STATES.COMMENT:
        if (token === '--%>') {
          state = STATES.LITERAL;
        }
        break;
    }
  }
  if (state !== STATES.LITERAL) {
    throw new SyntaxError('unclosed JSSP tag');
  }
  return code.join('\n') + '\n';
};
Object.setOwnerOf($.jssp.compile_, $.physicals.Neil);
Object.setOwnerOf($.jssp.compile_.prototype, $.physicals.Maximilian);

