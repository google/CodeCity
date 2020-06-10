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
 * @author cpcallen@google.com (Christopher Allen)
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.utils.isObject = function isObject(v) {
  /* Returns true iff v is an object (of any class, including Array
   * and Function). */
  return (typeof v === 'object' && v !== null) || typeof v === 'function';
};
Object.setOwnerOf($.utils.isObject, Object.getOwnerOf($.system.onStartup.prototype));
$.utils.validate.ownArray = function(object, key) {
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
delete $.utils.validate.ownArray.name;
$.utils.validate.ownArray.prototype.constructor = function(object, key) {
 	// Ensure that object[key] is an array not shared with any other
  // object, not inherited from a prototype, etc.  If it is, it
  // will be relaced by a new, unshared array with the same
  // contents.
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
delete $.utils.validate.ownArray.prototype.constructor.name;
$.utils.validate.ownArray.prototype.constructor.prototype = $.utils.validate.ownArray.prototype;
$.utils.imageMatch = {};
$.utils.imageMatch.send = function send(ink) {
  var json = $.system.xhr('https://neil.fraser.name/scripts/imageMatch.py' +
                          '?ink=' + encodeURIComponent(JSON.stringify(ink)));
  return JSON.parse(json);
};
Object.setOwnerOf($.utils.imageMatch.send, {});
Object.setOwnerOf($.utils.imageMatch.send.prototype, Object.getOwnerOf($.utils.imageMatch.send));
$.utils.imageMatch.recog = function recog(ink) {
  //var ink = this.svgToInk(svg);
  var json = this.send(ink);
  try {
    var name = json[1][0][1][0];
  } catch (e) {
    // No match.
  }
  return name;
};
Object.setOwnerOf($.utils.imageMatch.recog, Object.getOwnerOf($.utils.imageMatch.send.prototype));
Object.setOwnerOf($.utils.imageMatch.recog.prototype, Object.getOwnerOf($.utils.imageMatch.recog));
$.utils.imageMatch.svgToInk = function svgToInk(svg) {
  ink = [];
  return ink;
};
Object.setOwnerOf($.utils.imageMatch.svgToInk, Object.getOwnerOf($.utils.imageMatch.recog.prototype));
Object.setOwnerOf($.utils.imageMatch.svgToInk.prototype, Object.getOwnerOf($.utils.imageMatch.recog.prototype));

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
$.utils.array.filterUntilFound.prototype.constructor = function filterUntilFound(array, filter1 /*, filter2, filter3... */) {
  // 
};
$.utils.array.filterUntilFound.prototype.constructor.prototype = $.utils.array.filterUntilFound.prototype;

$.utils.object = {};
Object.setOwnerOf($.utils.object, Object.getOwnerOf($.system.onStartup.prototype));
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
  thread.setTimeLimit(Math.min(thread.getTimeLimit(), 100));
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
Object.setOwnerOf($.utils.object.spider, Object.getOwnerOf($.system.onStartup.prototype));
Object.setOwnerOf($.utils.object.spider.prototype, Object.getOwnerOf($.system.onStartup.prototype));
$.utils.object.transplantProperties = function transplantProperties(oldObject, newObject) {
  // Copy all properties defined on one object to another.
  if (!$.utils.isObject(newObject) || !$.utils.isObject(oldObject)) {
    throw new TypeError("Can't transplant properties on non-objects.");
  }
  if (oldObject === newObject) return;  // Nothing to do!
  var keys = Object.getOwnPropertyNames(oldObject);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var pd = Object.getOwnPropertyDescriptor(oldObject, k);
    if (typeof newObject === 'function') {
      if (k === 'length' || k === 'name') continue;  // Skip these.
      if (k === 'prototype' && $.utils.isObject(pd.value)) {
        // Fix foo.constructor.prototype to be foo, if .constructor writable.
        var cpd = Object.getOwnPropertyDescriptor(pd.value, 'constructor');
        if (cpd.writable) {
          cpd.value = newObject;
          Object.defineProperty(pd.value, 'constructor', cpd);
        }
      }
    }
    try {
      Object.defineProperty(newObject, k, pd);
    } catch (e) {
      try {
        // If defineProperty fails, try simple assignment.
        // TODO(cpcallen): remove this when server allows
        // (non-effective) redefinition of nonconfigurable
        // properties?
        newObject[k] = pd.value;
      } catch (e) {
        // Ignore failed attempt to copy properties.
      }
    }
  }
};

$.utils.string = {};
$.utils.string.capitalize = function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.substring(1);
};
Object.setOwnerOf($.utils.string.capitalize, Object.getOwnerOf($.system.onStartup.prototype));
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
Object.setOwnerOf($.utils.string.translate, Object.getOwnerOf($.system.onStartup.prototype));
Object.setOwnerOf($.utils.string.translate.prototype, Object.getOwnerOf($.system.onStartup.prototype));

