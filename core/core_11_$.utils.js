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
$.utils.url = {};
Object.setOwnerOf($.utils.url, $.physicals.Maximilian);
$.utils.url.regexps = {};
$.utils.url.regexps.README = '$.utils.url.regexps contains some RegExps useful for parsing or otherwise analysing URLs.\n\nSee ._generate() for how they are constructed and what they will match.';
$.utils.url.regexps._generate = function _generate() {
  /* Generate some RegExps that match various parts of URLs.  The
   * intention is that these regular expressions conform to the
   * grammar given in RFC 3986, "Uniform Resource Identifier (URI):
   * Generic Syntax" (https://tools.ietf.org/html/rfc3986).
   *
   * TODO: add tests for generated RegExps.
   */

  ////////////////////////////////////////////////////////////////////
  // IPv4 Addresses.
  // Based on https://stackoverflow.com/a/14453696/4969945

  // Matches an octet, optionally with leading zeros.
  var octet = '(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})';
  // Matches an octet without no leading zeros.
  var octetStrict = '(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])';


  // Globally matches IPv4 addresses, optionally with leading zeros.
  this.ipv4Address = new RegExp(octet + '(?:\\.' + octet + '){3}', 'g');
  // Globally matches IPv4 addresses with no leading zeros.
  this.ipv4AddressStrict =
      new RegExp(octetStrict + '(?:\\.' + octetStrict + '){3}', 'g');

  ////////////////////////////////////////////////////////////////////
  // IPv6 Addresses.
  // Based on https://stackoverflow.com/a/17871737/4969945 but modified
  // to reduce ambiguity match more greedily when unanchored.

  // Matches a 32-bit hex value as it can appear in an IPv6 address.
  var word = '[0-9a-fA-F]{1,4}';

  // Matches an IPv4 address as it can appear in an IPv6 address.
  var ipv4 = this.ipv4AddressStrict.source;

  // Globally matches a valid IPv6 address.
  this.ipv6Address = new RegExp(
      '(?:' +
          '[fF][eE]80:(?::' + word + '){0,4}%[0-9a-zA-Z]+|' +  // fe80::7:8%eth0 fe80::7:8%1 (link-local IPv6 addresses with zone index)
          '(?:' + word + ':){1,4}:' + ipv4 + '|' +             // 2001:db8:3:4::192.0.2.33  64:ff9b::192.0.2.33 (IPv4-Embedded IPv6 Address)
          '(?:' + word + ':){7}' + word + '|' +                // 1:2:3:4:5:6:7:8
          '(?:' + word + ':){6}(?::' + word + '){1,1}|' +      // 1:2:3:4:5:6::8 ... 1:2:3:4:5:6::8
          '(?:' + word + ':){5}(?::' + word + '){1,2}|' +      // 1:2:3:4:5::8   ... 1:2:3:4:5::7:8
          '(?:' + word + ':){4}(?::' + word + '){1,3}|' +      // 1:2:3:4::8     ... 1:2:3:4::6:7:8
          '(?:' + word + ':){3}(?::' + word + '){1,4}|' +      // 1:2:3::8       ... 1:2:3::5:6:7:8
          '(?:' + word + ':){2}(?::' + word + '){1,5}|' +      // 1:2::8         ... 1:2::4:5:6:7:8
          '(?:' + word + ':){1}(?::' + word + '){1,6}|' +      // 1::8           ... 1::3:4:5:6:7:8
          '(?:' + word + ':){1,7}:|' +                         // 1::            ... 1:2:3:4:5:6:7::
          '::(?:[fF]{4}(?::0{1,4})?:)?' + ipv4 + '|' +         // ::255.255.255.255  ::ffff:255.255.255.255  ::ffff:0:255.255.255.255 (IPv4-mapped IPv6 addresses and IPv4-translated addresses)
          ':(?::' + word + '){1,7}|' +                         // ::8            ... ::2:3:4:5:6:7:8
          '::' +                                               // ::
      ')', 'g');

  ////////////////////////////////////////////////////////////////////
  // DNS Domain Names.

  // Matches a label (per RFC 952, updated by RFC 1123 to allow a
  // it to begin with a digit), limited to 63 charcters (per RFC 1035).
  var label = '[a-zA-Z0-9][a-zA-Z0-9-]{0,62}';

  // Globally matches a legal (but not necessary valid!) DNS name.
  // See also https://stackoverflow.com/q/106179/4969945 .
  // BUG: does not limit length of name to ca. 253 characters (see
  //     https://devblogs.microsoft.com/oldnewthing/20120412-00/?p=7873
  //     for gory details).
  this.dnsAddress = new RegExp(label + '(?:\\.' + label + ')*', 'g');

  ////////////////////////////////////////////////////////////////////
  // Authority section

  // Globally matches a valid IP address (v4 or v6).
  this.ipAddress = new RegExp(
    this.ipv4Address.source + '|\\[' + this.ipv6Address.source + '\\]', 'g');

  // Globally matches a valid URL authority section (e.g. domain name
  // and port); this is (not coincidentally) also the same as a valid
  // HTTP Host: header value.
  //
  // The RegExp includes capture groups for an IP address [1] *or* a
  // DNS address [2], and (optionally) a port number [3].
  this.authority = new RegExp(
    '(?:(' + this.ipAddress.source + ')|' +
       '(' + this.dnsAddress.source + '))' +
    '(?::([0-9]+))?', 'g');  // Optional port number.

  ////////////////////////////////////////////////////////////////////
  // Exact forms of the above.  These do not get the global flag.
  var keys = ['ipv4Address', 'ipv4AddressStrict', 'ipv6Address',
              'dnsAddress', 'ipAddress', 'authority'];
  for (var key, i = 0; (key = keys[i]); i++) {
    this[key + 'Exact'] = new RegExp('^' + this[key].source + '$');
  }

};
Object.setOwnerOf($.utils.url.regexps._generate.prototype, $.physicals.Maximilian);
$.utils.url.regexps.ipv4Address = /(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})){3}/g;
$.utils.url.regexps.ipv4AddressStrict = /(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}/g;
$.utils.url.regexps.ipv6Address = /(?:[fF][eE]80:(?::[0-9a-fA-F]{1,4}){0,4}%[0-9a-zA-Z]+|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){6}(?::[0-9a-fA-F]{1,4}){1,1}|(?:[0-9a-fA-F]{1,4}:){5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){2}(?::[0-9a-fA-F]{1,4}){1,5}|(?:[0-9a-fA-F]{1,4}:){1}(?::[0-9a-fA-F]{1,4}){1,6}|(?:[0-9a-fA-F]{1,4}:){1,7}:|::(?:[fF]{4}(?::0{1,4})?:)?(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|:(?::[0-9a-fA-F]{1,4}){1,7}|::)/g;
$.utils.url.regexps.dnsAddress = /[a-zA-Z0-9][a-zA-Z0-9-]{0,62}(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})*/g;
$.utils.url.regexps.ipAddress = /(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})){3}|\[(?:[fF][eE]80:(?::[0-9a-fA-F]{1,4}){0,4}%[0-9a-zA-Z]+|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){6}(?::[0-9a-fA-F]{1,4}){1,1}|(?:[0-9a-fA-F]{1,4}:){5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){2}(?::[0-9a-fA-F]{1,4}){1,5}|(?:[0-9a-fA-F]{1,4}:){1}(?::[0-9a-fA-F]{1,4}){1,6}|(?:[0-9a-fA-F]{1,4}:){1,7}:|::(?:[fF]{4}(?::0{1,4})?:)?(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|:(?::[0-9a-fA-F]{1,4}){1,7}|::)\]/g;
$.utils.url.regexps.authority = /(?:((?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})){3}|\[(?:[fF][eE]80:(?::[0-9a-fA-F]{1,4}){0,4}%[0-9a-zA-Z]+|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){6}(?::[0-9a-fA-F]{1,4}){1,1}|(?:[0-9a-fA-F]{1,4}:){5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){2}(?::[0-9a-fA-F]{1,4}){1,5}|(?:[0-9a-fA-F]{1,4}:){1}(?::[0-9a-fA-F]{1,4}){1,6}|(?:[0-9a-fA-F]{1,4}:){1,7}:|::(?:[fF]{4}(?::0{1,4})?:)?(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|:(?::[0-9a-fA-F]{1,4}){1,7}|::)\])|([a-zA-Z0-9][a-zA-Z0-9-]{0,62}(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})*))(?::([0-9]+))?/g;
$.utils.url.regexps.ipv4AddressExact = /^(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})){3}$/;
$.utils.url.regexps.ipv4AddressStrictExact = /^(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}$/;
$.utils.url.regexps.ipv6AddressExact = /^(?:[fF][eE]80:(?::[0-9a-fA-F]{1,4}){0,4}%[0-9a-zA-Z]+|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){6}(?::[0-9a-fA-F]{1,4}){1,1}|(?:[0-9a-fA-F]{1,4}:){5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){2}(?::[0-9a-fA-F]{1,4}){1,5}|(?:[0-9a-fA-F]{1,4}:){1}(?::[0-9a-fA-F]{1,4}){1,6}|(?:[0-9a-fA-F]{1,4}:){1,7}:|::(?:[fF]{4}(?::0{1,4})?:)?(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|:(?::[0-9a-fA-F]{1,4}){1,7}|::)$/;
$.utils.url.regexps.dnsAddressExact = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})*$/;
$.utils.url.regexps.ipAddressExact = /^(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})){3}|\[(?:[fF][eE]80:(?::[0-9a-fA-F]{1,4}){0,4}%[0-9a-zA-Z]+|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){6}(?::[0-9a-fA-F]{1,4}){1,1}|(?:[0-9a-fA-F]{1,4}:){5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){2}(?::[0-9a-fA-F]{1,4}){1,5}|(?:[0-9a-fA-F]{1,4}:){1}(?::[0-9a-fA-F]{1,4}){1,6}|(?:[0-9a-fA-F]{1,4}:){1,7}:|::(?:[fF]{4}(?::0{1,4})?:)?(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|:(?::[0-9a-fA-F]{1,4}){1,7}|::)\]$/;
$.utils.url.regexps.authorityExact = /^(?:((?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]{1,2})){3}|\[(?:[fF][eE]80:(?::[0-9a-fA-F]{1,4}){0,4}%[0-9a-zA-Z]+|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){6}(?::[0-9a-fA-F]{1,4}){1,1}|(?:[0-9a-fA-F]{1,4}:){5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){2}(?::[0-9a-fA-F]{1,4}){1,5}|(?:[0-9a-fA-F]{1,4}:){1}(?::[0-9a-fA-F]{1,4}){1,6}|(?:[0-9a-fA-F]{1,4}:){1,7}:|::(?:[fF]{4}(?::0{1,4})?:)?(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1[0-9]|[1-9])?[0-9])){3}|:(?::[0-9a-fA-F]{1,4}){1,7}|::)\])|([a-zA-Z0-9][a-zA-Z0-9-]{0,62}(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})*))(?::([0-9]+))?$/;

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

