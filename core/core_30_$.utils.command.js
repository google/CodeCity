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
 * @fileoverview Command parser for Code City
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.utils.command = {};
$.utils.command.prepositions = (new 'Object.create')(null);
$.utils.command.prepositions.with = 'with/using';
$.utils.command.prepositions.using = 'with/using';
$.utils.command.prepositions.at = 'at/to';
$.utils.command.prepositions.to = 'at/to';
$.utils.command.prepositions['in front of'] = 'in front of';
$.utils.command.prepositions.in = 'in/inside/into';
$.utils.command.prepositions.inside = 'in/inside/into';
$.utils.command.prepositions.into = 'in/inside/into';
$.utils.command.prepositions['on top of'] = 'on top of/on/onto/upon';
$.utils.command.prepositions.on = 'on top of/on/onto/upon';
$.utils.command.prepositions.onto = 'on top of/on/onto/upon';
$.utils.command.prepositions.upon = 'on top of/on/onto/upon';
$.utils.command.prepositions.over = 'over';
$.utils.command.prepositions.through = 'through';
$.utils.command.prepositions.under = 'under/underneath/beneath';
$.utils.command.prepositions.underneath = 'under/underneath/beneath';
$.utils.command.prepositions.beneath = 'under/underneath/beneath';
$.utils.command.prepositions.behind = 'behind';
$.utils.command.prepositions.beside = 'beside';
$.utils.command.prepositions.for = 'for/about';
$.utils.command.prepositions.about = 'for/about';
$.utils.command.prepositions.is = 'is';
$.utils.command.prepositions.as = 'as';
$.utils.command.prepositions.off = 'off/off of';
$.utils.command.prepositions['off of'] = 'off/off of';
$.utils.command.prepositions['out of'] = 'out of/from inside/from';
$.utils.command.prepositions['from inside'] = 'out of/from inside/from';
$.utils.command.prepositions.from = 'out of/from inside/from';
$.utils.command.prepositionsRegExp = /^(.*\s)?(with|using|upon|underneath|under|to|through|over|out +of|onto|on +top +of|on|off +of|off|is|into|inside|in +front +of|in|from +inside|from|for|beside|beneath|behind|at|as|about)(\s.*)?$/;
$.utils.command.prepositionOptions = [];
$.utils.command.prepositionOptions[0] = 'none';
$.utils.command.prepositionOptions[1] = 'any';
$.utils.command.prepositionOptions[2] = 'with/using';
$.utils.command.prepositionOptions[3] = 'at/to';
$.utils.command.prepositionOptions[4] = 'in front of';
$.utils.command.prepositionOptions[5] = 'in/inside/into';
$.utils.command.prepositionOptions[6] = 'on top of/on/onto/upon';
$.utils.command.prepositionOptions[7] = 'out of/from inside/from';
$.utils.command.prepositionOptions[8] = 'over';
$.utils.command.prepositionOptions[9] = 'through';
$.utils.command.prepositionOptions[10] = 'under/underneath/beneath';
$.utils.command.prepositionOptions[11] = 'behind';
$.utils.command.prepositionOptions[12] = 'beside';
$.utils.command.prepositionOptions[13] = 'for/about';
$.utils.command.prepositionOptions[14] = 'is';
$.utils.command.prepositionOptions[15] = 'as';
$.utils.command.prepositionOptions[16] = 'off/off of';
$.utils.command.parse = function parse(cmdstr, user) {
  // Parse a user's command into components.
  //
  // Commands are generally expected to be of the form:
  //
  // <verb> <direct object> <preposition> <indirect object>
  //
  // ... where all parts but <verb> are optional, but <preposition>
  // required if <indirect object> is present.
  //
  // The parse will return an object with the following properties:
  //
  // user:    The $.user object, from the parameter of the same name.
  // cmdstr:  The cmdstr parameter (coerced to string).
  // verbstr: The first non-whitespace word of cmdstr (if any).
  // argstr:  The rest of cmdstr, starting from the second character
  //          after the verb.
  // args:    An array of all the rest of the words of cmdstr.
  // dobjstr: Sring of args up to the (first) preposition.
  // dobj:    Object matching dobjstr.  If dobjstr is the empty string
  //          then this will be null.  If no object matches, it will
  //          be $.FAILED_MATCH.  If more than one object matches it
  //          will be $.AMBIGUOUS_MATCH.
  // prepstr: String of the (first) preposition, if any.
  // iobjstr: String of args after the (first) preposition.
  // iobj:    Object matching iobjstr.  Special values as for dobj.
  //
  // If cmdstr contains no non-whitespace characters, null is returned
  // instead.
  //
  // The cmdstr, verbstr and argstr properties are "raw" strings,
  // unmodified from the cmdstr parameter, while dobjstr, prepstr and
  // iobjstr are normalised, being substrings of args.join(' ').

  // Spit off verb from the rest.
  cmdstr = String(cmdstr);
  var m = cmdstr.match($.utils.command.verbRegExp);
  if (!m) return null;
  var verbstr = m[1];
  var argstr = m[2] || '';
  // Split argstr into words.
  // TODO(cpcallen): support quoting.
  var argstrTrimmed = argstr.trim();
  var args = argstrTrimmed ? argstrTrimmed.split(/\s+/) : [];
  // Recombine args and split into dobjstr / prepstr / iobjstr
  var argsNormalised = args.join(' ');
  var dobjstr = '';
  var prepstr = '';
  var iobjstr = '';
  m = argsNormalised.match($.utils.command.prepositionsRegExp);
  if (m) {
    // Preposition found.
    dobjstr = (m[1] || '').trim();
    prepstr = m[2].replace(/ +/g, ' ');
    iobjstr = (m[3] || '').trim();
  } else {
    dobjstr = argsNormalised;
  }
  function match(str) {
    if (str === '') return null;
    if (str === 'me' || str === 'myself') return user;
    if (str === 'here') return user.location;
    return $.utils.command.match(str, user);
  }
  var dobj = match(dobjstr);
  var iobj = match(iobjstr);
  return {
    user: user,
    cmdstr: cmdstr,
    verbstr: verbstr,
    argstr: argstr,
    args: args,
    dobjstr: dobjstr,
    dobj: dobj,
    prepstr: prepstr,
    iobjstr: iobjstr,
    iobj: iobj
  };
};
Object.setOwnerOf($.utils.command.parse, $.physicals.Maximilian);
$.utils.command.execute = function execute(cmdstr, user) {
  /* Parse and execute a user's command.  Returns true if a
   * verb-function was invoked; narrates an error message and
   * false otherwise.
   */
  var cmd = $.utils.command.parse(cmdstr, user);
  if (!cmd) return false;
  // Collect all objects which could host the verb.
  var hosts = [user, user.location, cmd.dobj, cmd.iobj];
  for (var i = 0; i < hosts.length; i++) {
    var host = hosts[i];
    if (!host) {
      continue;
    }
    // Check every verb on each object for a match.
    for (var prop in host) {
      var func = host[prop];
      if (typeof func !== 'function') continue;  // Not a function.
      var verbSpec = func.verb;
      var dobjSpec = func.dobj;
      var prepSpec = func.prep;
      var iobjSpec = func.iobj;  // I can't wait for ES6.
      if (!verbSpec || !dobjSpec || !prepSpec || !iobjSpec) continue;  // Not a verb.
      var verbRegExp = new RegExp('^(?:' + verbSpec + ')$');
      if (verbRegExp.test(cmd.verbstr) &&
          (prepSpec === 'any' ||
           $.utils.command.prepositions[cmd.prepstr] === prepSpec ||
           (prepSpec == 'none' && !cmd.prepstr)) &&
          (dobjSpec === 'any' || (dobjSpec === 'this' && cmd.dobj === host) ||
           (dobjSpec === 'none' && !cmd.dobj)) &&
          (iobjSpec === 'any' || (iobjSpec === 'this' && cmd.iobj === host) ||
           (iobjSpec === 'none' && !cmd.iobj))) {
        // TODO: security check/perms.
        host[prop](cmd);
        return true;
      }
    }
  }
  cmd.user.narrate('I don\'t understand that.');
  return false;
};
Object.setOwnerOf($.utils.command.execute, $.physicals.Maximilian);
$.utils.command.verbRegExp = /^\s*(\S+)(?:\s(.*))?/;
$.utils.command.match = function match(str, context) {
  /* Attempt to find an object matching str amongst context,
   * context.location, and context.contents.
   *
   * Args:
   * - str: string: prefix of name or alias of desired object.
   * - context: $.physical: an object to search.
   *
   * Returns: an object matching str, or $.FAILED_MATCH if none or
   * $.AMBIGUOUS_MATCH if more than one.
   */
  str = str.trim();
  // First, check for matches against universally accessible things.
  try {
    var v = $(str);
    if ($.utils.isObject(v)) return v;
  } catch (e) {
    // Ignore failed Selector parse/lookup.
  }
  var objects = [context].concat(context.getContents());
  if (context.location) {
    objects = objects.concat([context.location], context.location.getContents());
  }
  var m = $.utils.command.matchObjects(str, objects);
  switch (m.length) {
    case 0:
      return $.FAILED_MATCH;
    case 1:
      return m[0];
    default:
      return $.AMBIGUOUS_MATCH;
  }
};
Object.setOwnerOf($.utils.command.match, $.physicals.Maximilian);
$.utils.command.matchFailed = function matchFailed(obj, objstr, user) {
  /* Return true iff obj is NOT a valid match, and optionally narrate
   * a suitable error message if not.
   *
   * If obj is null, $.FAILED_MATCH or $.AMBIGUOUS_MATCH (and objstr
   * and user are supplied) call user.narrate with a suitable error
   * message.
   *
   * Args:
   * - obj: $.physical | null | $.FAILED_MATCH | $.AMBIGUOUS_MATCH:
   *     A match value (e.g., cmd.dobj or cmd.iobj) to be checked.
   * - objstr: string:
   *     The string which was matched to get obj.
   * - user: $.user:
   *     The user who typed the command.
   * Returns: boolean: true if obj is a $.physical.
   */
  var send = (typeof objstr === 'string' && $.user.isPrototypeOf(user));
  if (obj === null) {
    if (send) user.narrate('You must give the name of some object.');
    return true;
  } else if (obj === $.FAILED_MATCH) {
    if (send) user.narrate('I see no "' + objstr + '" here.');
    return true;
  } else if (obj === $.AMBIGUOUS_MATCH) {
    if (send) user.narrate('I don\'t know which "' + objstr + '" you mean.');
    return true;
  } else if ($.physical.isPrototypeOf(obj)) {
    return false;
  } else {
    throw new TypeError('unexpected value checking match result');
  }
};
Object.setOwnerOf($.utils.command.matchFailed, $.physicals.Maximilian);
Object.setOwnerOf($.utils.command.matchFailed.prototype, $.physicals.Maximilian);
$.utils.command.matchObjects = function matchObjects(str, objects) {
  /* Match a string against a list of objects.  Will return an array
   * of zero or more objects such that (in order of preference):
   * - all have .name === str.
   * - all have str in their .aliases.
   * - all have str as a prefix of their name or an alias.
   *
   * Duplicate entries in objects will be ignored; only a single copy
   * will appear in the returned array.
   *
   * Args:
   * str: string to match against names and aliases of objects.
   * objects: array of $.physical objects to consider.
   *
   * Returns: possibly-empty array of objects matching str.
   *
   */
  var nameMatches = [];  // These should be Sets.
  var aliasMatches = [];
  var partialMatches = [];
  var nonMatches = [];  // Non-matches will be ignored.
  var matches = [nonMatches, partialMatches, aliasMatches, nameMatches];

  for (var i = 0; i < objects.length; i++) {
    var obj = objects[i];
    var strength = $.utils.command.matchObjects.strength(str, obj);
    if (!matches[strength].includes(obj)) {
      matches[strength].push(obj);
    }
  }

  // Return the highest level bin.
  if (nameMatches.length) return nameMatches;
  if (aliasMatches.length) return aliasMatches;
  if (partialMatches.length) return partialMatches;
  return [];
};
Object.setOwnerOf($.utils.command.matchObjects, $.physicals.Maximilian);
Object.setOwnerOf($.utils.command.matchObjects.prototype, $.physicals.Maximilian);
$.utils.command.matchObjects.strength = function strength(str, obj) {
  /* Score str as a match for obj.
   * Returns: number
   * - 0: No match.
   * - 1: Partial name or alias.
   * - 2: Perfect alias match.
   * - 3: Perfect name match.
   */
  if (!str || !obj) {
    return 0;
  }
  str = str.toLowerCase();
  var name = obj.name.toLowerCase();
  if (name === str) {
    return 3;
  }
  var partial = name.startsWith(str);
  if (Array.isArray(obj.aliases)) {
    for (var i = 0; i < obj.aliases.length; i++) {
      var alias = obj.aliases[i].toLowerCase();
      if (name === alias) {
        return 2;
      }
      partial = partial || alias.startsWith(str);
    }
  }
  return partial ? 1 : 0;
};
Object.setOwnerOf($.utils.command.matchObjects.strength, $.physicals.Maximilian);

