/**
 * @license
 * Copyright 2020 Google LLC
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
 * @fileoverview Basic utilities for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.utils.validate.ownArray = function ownArray(object, key) {
 	// Ensure that object[key] is an array not shared with any other
  // object or property, not inherited from a prototype, etc.
  // If it is, relaced it with a new, unshared array with the same
  // contents (if possible).
  if (!object.hasOwnProperty(key) || !Array.isArray(object[key]) ||
      object[key].forObj !== object || object[key].forKey !== key) {
    try {
      object[key] = Array.from(object[key]);
    } catch (e) {
      object[key] = [];
    }
		Object.defineProperties(object[key], {forObj: {value: object},
                                          forKey: {value: key}});
  }
};
Object.setOwnerOf($.utils.validate.ownArray, $.physicals.Neil);
$.utils.validate.functionPrototypes = function functionPrototypes() {
  /* Find (and fix) functions that have f.prototype.constructor !== f.
   */
  var u = user();
  u.narrate('Looking for functions with mismatched .prototype.constructor...');
  $.utils.object.spider($, function findProtosHelper(object, path) {
    // Skip $.archive entirely.
    if (object === $.archive) return true;
    if (typeof object !== 'function') return false;

    var selector = $.Selector.for(object) || new $.Selector(['$'].concat(path));
    if (!object.prototype) {
      if (!String(object).includes('[native code]')) {
        u.narrate(String(selector) + ' has no .prototype');
      }
    } else if (!object.prototype.constructor) {
      u.narrate(String(selector) + ' has no .prototype.constructor');
    } else if (object.prototype.constructor !== object) {
      u.narrate(String(selector) + ' has mismatched .prototype.constructor');
      var protoProps = Object.getOwnPropertyNames(object.prototype);
      var pcSelector = $.Selector.for(object.prototype.constructor);
      // Does it look like a plain old boring auto-created .prototype object?
      var pd = Object.getOwnPropertyDescriptor(object.prototype, 'constructor');
      if (Object.getPrototypeOf(object.prototype) === Object.prototype &&
          protoProps.length === 1 && protoProps[0] === 'constructor' &&
          pd.writable === true && pd.enumerable === false && pd.configurable === true ) {
        if (String(pcSelector) === String(selector) + '.prototype.constructor') {
          u.narrate('----Fixable?: yes!');
          object.prototype.constructor = object;
        } else {
          u.narrate('----Fixable?: yes🤞 (is ' + String(pcSelector) + ')');
          // Make new .prototype object, since current one is likely shared.
          var newProto = {constructor: object};
          Object.setOwnerOf(newProto, Object.getOwnerOf(object));
          Object.defineProperty(newProto, 'constructor', {enumerable: false});
          object.prototype = newProto;
        }
      } else {
        u.narrate('----Fixable?: NO: has properties other than .constructor' +
                     (pcSelector ? ' (is ' + String(pcSelector) + ')' : ''));
      }
    }
    return false;
  });
  u.narrate('Done.');
};
Object.setOwnerOf($.utils.validate.functionPrototypes, $.physicals.Maximilian);
Object.setOwnerOf($.utils.validate.functionPrototypes.prototype, $.physicals.Maximilian);
$.utils.isObject = function isObject(v) {
  /* Returns true iff v is an object (of any class, including Array
   * and Function). */
  return (typeof v === 'object' && v !== null) || typeof v === 'function';
};
Object.setOwnerOf($.utils.isObject, $.physicals.Maximilian);
$.utils.imageMatch = {};
$.utils.imageMatch.recog = function recog(svgText) {
  svgText = '<svg transform="scale(4)">' + svgText + '</svg>';
  var json = $.system.xhr('https://neil.fraser.name/scripts/imageMatch.py' +
                          '?svg=' + encodeURIComponent(svgText));
  return JSON.parse(json);
};
Object.setOwnerOf($.utils.imageMatch.recog, $.physicals.Neil);
Object.setOwnerOf($.utils.imageMatch.recog.prototype, $.physicals.Neil);
$.utils.regexp = {};
Object.setOwnerOf($.utils.regexp, $.physicals.Neil);
$.utils.regexp.escape = function escape(str) {
  // Escape a string so that it may be used as a literal in a regular expression.
  // Example: $.utils.regexp.escape('[...]') -> "\\[\\.\\.\\.\\]"
  // Usecase: new RegExp($.utils.regexp.escape('[...]')).test('Alpha [...] Beta')
  //
  // Source: https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};
Object.setOwnerOf($.utils.regexp.escape, $.physicals.Neil);
Object.setOwnerOf($.utils.regexp.escape.prototype, $.physicals.Neil);

$.utils.array = {};
$.utils.array.filterUntilFound = function filterUntilFound(array, filter1 /*, filter2, filter3... */) {
  // Apply Array.prototype.filter.call(array, filterN) for each filter
  // in turn until one returns a non-empty result.  Return that
  // result, or an empty array if there are no more filters.
  filters = Array.from(arguments).slice(1);
	while (filters.length > 0) {
    var filter = filters.shift();
    var result = array.filter(filter);
    if (result.length > 0) return result;
  }
  return [];
};

$.utils.object = {};
Object.setOwnerOf($.utils.object, $.physicals.Maximilian);
$.utils.object.spider = function spider(start, callback) {
  /* Spider the objects accessible transitively via the properties of
   * object.
   *
   * Arguments:
   * start: object: Starting point for traversal of the object graph.
   * callback: function(object, Array<string): boolean:
   *     Callback called once for each object found during traversal.
   *     It is passed the current object and an array of the names
   *     of properties from start to get to it.  If it returns true,
   *     properties of the current object are not traversed.
   */
  var thread = Thread.current();
  thread.setTimeLimit(Math.min(thread.getTimeLimit() || Infinity, 100));
  var seen = new WeakMap();
  var path = [];
  doSpider(start);

  function doSpider(object) {
    if (!$.utils.isObject(object)) return;

    // Have we seen it before?
  	if (seen.has(object)) return;
    seen.set(object, true);

    if (callback(object, path)) return;

    var keys = Object.getOwnPropertyNames(object);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      try {
        path.push(key);
        while (true) {
          try {
            doSpider(object[key]);
            break;
          } catch (e) {
            suspend(1);
            if (!(e instanceof RangeError) || e.message !== 'Thread ran too long') throw e;
          }
        }
      } finally {
        path.pop();
      }
    }
  }
};
Object.setOwnerOf($.utils.object.spider, $.physicals.Maximilian);
Object.setOwnerOf($.utils.object.spider.prototype, $.physicals.Maximilian);
$.utils.object.transplantProperties = function transplantProperties(source, destination) {
  /* Copy own properties (whether enumerable or not) from source to
   * destination, but do not overwrite existing own properties(*) on
   * destination.  Called from $.hosts.code['/editorXhr'].handleMetadata
   * to preserve properties when replacing function objects.
   *
   * (*) The exception to the no-overwrite rule is that if destination
   * is a function and source.prototype is an object then
   * destination.function will be overwritten by source.prototype;
   * moreover, if a property source.prototype.constructor exists and is
   * writable it will be redefined to set its value to destination.
   * This ensures that destination.prototype.constructor === destination.
   *
   * Arguments:
   * - source: object - the object to copy properties from.
   * - destination: object - the object to copy properties to.
   */
  if (!$.utils.isObject(source) || !$.utils.isObject(destination)) {
    throw new TypeError('source and destination must be objects');
  }
  if (destination === source) return;  // Nothing to do!
  var keys = Object.getOwnPropertyNames(source);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var pd = Object.getOwnPropertyDescriptor(source, key);
    if (typeof destination === 'function' &&
        key === 'prototype' && $.utils.isObject(pd.value)) {
      // Fix destination.constructor.prototype to be destination, if
      // .constructor writable.
      var cpd = Object.getOwnPropertyDescriptor(pd.value, 'constructor');
      if (cpd.writable) {
        cpd.value = destination;
        Object.defineProperty(pd.value, 'constructor', cpd);
      }
    } else {
      // Do not overwrite any other existing properties on destination.
      if (Object.prototype.hasOwnProperty.call(destination, key)) continue;
    }
    try {
      Object.defineProperty(destination, key, pd);
    } catch (e) {
      // Ignore failed attempt to copy properties.
    }
  }
};
Object.setOwnerOf($.utils.object.transplantProperties, $.physicals.Maximilian);
$.utils.object.getValue = function getValue(object, prop) {
  /* Get the value from an object's property.
   * If the value is a function, call it and return the result.
   * Used (for example) to get a description.  Simple objects would have a
   * string in their description property.  Compiles objects would have a
   * function in their description property that returns a string.
   */
  var value = object[prop];
  if (typeof value === 'function') {
    value = value.call(object);
  }
  return value;
};
Object.setOwnerOf($.utils.object.getValue, $.physicals.Maximilian);
Object.setOwnerOf($.utils.object.getValue.prototype, $.physicals.Neil);
$.utils.object.getPropertyLocation = function $_utils_object_getPropertyLocation(obj, propName) {
  // Returns the object that defines the given propName.
  // Might be object, or one of its prototypes, or null.
  while (obj && !Object.prototype.hasOwnProperty.call(obj, propName)) {
    obj = Object.getPrototypeOf(obj);
  }
  return obj;
};
Object.setOwnerOf($.utils.object.getPropertyLocation, $.physicals.Neil);
Object.setOwnerOf($.utils.object.getPropertyLocation.prototype, $.physicals.Neil);

$.utils.string = {};
$.utils.string.capitalize = function capitalize(str) {
  /* 'foo' -> 'Foo'
   * Assumes incoming text is already lowercase.
   */
  return str.charAt(0).toUpperCase() + str.substring(1);
};
Object.setOwnerOf($.utils.string.capitalize, $.physicals.Neil);
$.utils.string.randomCharacter = function randomCharacter(chars) {
  return chars.charAt(Math.random() * chars.length);
};
$.utils.string.VOWELS = 'aeiouy';
$.utils.string.CONSONANTS = 'bcdfghjklmnpqrstvwxz';
$.utils.string.ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
$.utils.string.hash = new 'CC.hash';
$.utils.string.translate = function translate(text, language) {
  /* Try to translate text into the specified language using an
   * external translation server.
   *
   * Arguments:
   * text: string: the text to be translated.
   * language: string: a two-character ISO 639-1 language code.
   *
   * Returns: the translated text.
   */
  var url = 'https://translate-service.scratch.mit.edu' +
      '/translate?language=' + encodeURIComponent(language) +
      '&text=' + encodeURIComponent(text);
  var json = $.system.xhr(url);
  return JSON.parse(json).result;
};
Object.setOwnerOf($.utils.string.translate, $.physicals.Maximilian);
Object.setOwnerOf($.utils.string.translate.prototype, $.physicals.Maximilian);
$.utils.string.generateRandom = function generateRandom(length, soup) {
  /* Return a string of the specified length consisting of characters from the
   * given soup, or $.utils.string.generateRandom.DEFAULT_SOUP if none
   * specified.
   *
   * E.g.: generateRandom(4, 'abc') might return 'cbca'.
   *
   * Arguments:
   * - length: number - length of string to generate.
   * - soup: string - alphabet to select characters randomly from.
   */
  soup = soup || $.utils.string.generateRandom.DEFAULT_SOUP;
  var out = [];
  for (var i = 0; i < length; i++) {
    out[i] = this.randomCharacter(soup);
  }
  return out.join('');
};
Object.setOwnerOf($.utils.string.generateRandom, $.physicals.Maximilian);
Object.setOwnerOf($.utils.string.generateRandom.prototype, $.physicals.Neil);
$.utils.string.generateRandom.DEFAULT_SOUP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
$.utils.string.prefixLines = function prefixLines(text, prefix) {
  // Prepend a common prefix onto each line of code.
  // Intended for indenting code or adding '//' comment markers.
  return prefix + text.replace(/(?!\n$)\n/g, '\n' + prefix);
};
Object.setOwnerOf($.utils.string.prefixLines, $.physicals.Neil);
Object.setOwnerOf($.utils.string.prefixLines.prototype, $.physicals.Neil);

