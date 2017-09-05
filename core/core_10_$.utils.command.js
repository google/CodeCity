/**
 * @license
 * Code City: Command parser.
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
 * @fileoverview Command parser for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

$.utils.$ = function(str) {
  /* Parse the string to extract a reference.
   * This is the actual implementation of the $() function.
   */
  // TODO: Support notations starting with @roomname and ~username.
  var m = str.match(/^\s*(\$|me|~|here|@)(.*)\s*$/);
  if (!m) {
    return undefined;
  }
  var root = m[1];
  var suffix = m[2];
  if (root === '$') {
    root = $;
  } else if (root === '~' || root === 'me') {
    root = user;
  } else if (root === '@' || root === 'here') {
    root = user.location;
  } else {
    throw Error("Can't happen.  Regex is too liberal.");
  }
  if (!suffix) {
    return root;
  }
  // This regex has two main groups:
  // 1) match .foo
  // 2) match [42] or ['bar'] or ["baz"]
  if (suffix.search(/^((\s*\.\s*[A-Za-z$_][A-Za-z0-9$_]*\s*)|(\s*\[\s*(\d+|'([^'\\]*(\\.[^'\\]*)*)'|"([^"\\]*(\\.[^"\\]*)*)")\s*\]\s*))+$/) === 0) {
    // TODO: Handle permissions for -r properties.
    return eval('(root)' + suffix);
  }
  return undefined;
};

$.utils.command = {};

$.utils.command.prepositions = Object.create(null);
$.utils.command.prepositions['with'] = 'with/using';
$.utils.command.prepositions['using'] = 'with/using';
$.utils.command.prepositions['at'] = 'at/to';
$.utils.command.prepositions['to'] = 'at/to';
$.utils.command.prepositions['in front of'] = 'in front of';
$.utils.command.prepositions['in'] = 'in/inside/into';
$.utils.command.prepositions['inside'] = 'in/inside/into';
$.utils.command.prepositions['into'] = 'in/inside/into';
$.utils.command.prepositions['on top of'] = 'on top of/on/onto/upon';
$.utils.command.prepositions['on'] = 'on top of/on/onto/upon';
$.utils.command.prepositions['onto'] = 'on top of/on/onto/upon';
$.utils.command.prepositions['upon'] = 'on top of/on/onto/upon';
$.utils.command.prepositions['over'] = 'over';
$.utils.command.prepositions['through'] = 'through';
$.utils.command.prepositions['under'] = 'under/underneath/beneath';
$.utils.command.prepositions['underneath'] = 'under/underneath/beneath';
$.utils.command.prepositions['beneath'] = 'under/underneath/beneath';
$.utils.command.prepositions['behind'] = 'behind';
$.utils.command.prepositions['beside'] = 'beside';
$.utils.command.prepositions['for'] = 'for/about';
$.utils.command.prepositions['about'] = 'for/about';
$.utils.command.prepositions['is'] = 'is';
$.utils.command.prepositions['as'] = 'as';
$.utils.command.prepositions['off'] = 'off/off of';
$.utils.command.prepositions['off of'] = 'off/off of';

$.utils.command.prepositionsRegExp = new RegExp(
    '^(.*\\s)?(with|using|upon|underneath|under|to|through|over|out +of|' +
    'onto|on +top +of|on|off +of|off|is|into|inside|in +front +of|' +
    'in|from +inside|from|for|beside|beneath|behind|at|as|about)(\\s.*)?$');

$.utils.command.prepositionOptions = [
  'none',
  'any',
  'with/using',
  'at/to',
  'in front of',
  'in/inside/into',
  'on top of/on/onto/upon',
  'over',
  'through',
  'under/underneath/beneath',
  'behind',
  'beside',
  'for/about',
  'is',
  'as',
  'off/off of'
];

$.utils.command.parse = function(cmdstr, user) {
  // Parse a user's command into components:
  // verbstr, argstr, args, dobjstr, dobj, prepstr, iobjstr, iobj
  // Returns an object with the above properties, or undefined if no verb.
  var args = cmdstr.split(/ +/);
  var verbstr = args.shift();
  if (!verbstr) {
    return undefined;
  }
  var argstr = cmdstr.substring(cmdstr.indexOf(verbstr) + verbstr.length + 1);
  var dobjstr = '';
  var dobj = null;
  var iobjstr = '';
  var iobj = null;
  var prepstr = '';
  var m = argstr.match($.utils.command.prepositionsRegExp);
  if (m) {
    dobjstr = m[1].trim();
    prepstr = m[2].replace(/ +/g, ' ');
    iobjstr = m[3].trim();
  } else {
    dobjstr = argstr;
  }
  if (dobjstr) {
    var m = $.utils.match(dobjstr, user);
    if (!m.length) {
      dobj = undefined;
    } else if (m.length === 1) {
      dobj = m[0];
    } else {
      var err = ReferenceError(dobj.length + ' matches.');
      err.data = dobj;
      dobj = err;
    }
  }
  if (iobjstr) {
    var m = $.utils.match(iobjstr, user);
    if (!m.length) {
      iobj = undefined;
    } else if (m.length === 1) {
      iobj = m[0];
    } else {
      var err = ReferenceError(iobj.length + ' matches.');
      err.data = iobj;
      iobj = err;
    }
  }
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

$.utils.command.execute = function(cmdstr, user) {
  // Parse and execute a user's command.
  // Return true if successful, false if not.
  var cmd = $.utils.command.parse(cmdstr, user);
  if (!cmd) {
    // TODO: Support trapping of empty commands.
    return true;
  }
  // Collect all objects which could host the verb.
  var hosts = [user, user.location, cmd.dobj, cmd.iobj];
  for (var i = 0; i < hosts.length; i++) {
    var host = hosts[i];
    if (!host) {
      continue;
    }
    // Check every verb on each object for a match.
    var func, verb, dobj, prep, iobj;
    for (var prop in host) {
      func = host[prop];
      if (typeof func === 'function' && (prep = func.prep) &&
          (dobj = func.dobj) && (iobj = func.iobj) && (verb = func.verb)) {
        // This is a verb.
        if (cmd.verbstr.search(verb) === 0) {
          if (prep === 'any' ||
              $.utils.command.prepositions[cmd.prepstr] === prep ||
              (prep == 'none' && !cmd.prepstr)) {
            if (dobj === 'any' || (dobj === 'this' && cmd.dobj === host) ||
                (dobj === 'none' && !cmd.dobj)) {
              if (iobj === 'any' || (iobj === 'this' && cmd.iobj === host) ||
                  (iobj === 'none' && !cmd.iobj)) {
                // TODO: security check/perms.
                host[prop](cmd);
                return true;
              }
            }
          }
        }
      }
    }
  }
  return false;
};

$.utils.match = function(str, context) {
  // Attempt to match a string with the environmental context.
  // Context can be anything (including null) but is normally a place or a user.
  // Returns an array of all matching objects.
  str = str.trim();
  // First, check for matches against universally accessible things.
  var m = $(str);
  if (m !== undefined) {
    return [m];
  }
  // Second, check the context for one or more matches.
  if (!($.physical.isPrototypeOf(context))) {
    return [];
  }
  var nameMatches = [];  // These should be Sets.
  var aliasMatches = [];
  var partialMatches = [];
  function matchObj(obj) {
    var m = $.utils.match.strength(str, obj);
    m && (m === 1 ? partialMatches : (m === 2 ? aliasMatches : nameMatches))
        .push(obj);
  }
  // Check the contextual object.
  matchObj(context);
  // Check the contextual object's contents.
  var contents = context.getContents();
  for (var i = 0; i < contents.length; i++) {
    matchObj(contents[i]);
  }
  var location = context.location;
  if ($.user.isPrototypeOf(context) && $.physical.isPrototypeOf(location)) {
    // Try the user's place next.
    matchObj(location);
    // Check the user's place's contents.
    var contents = location.getContents();
    for (var i = 0; i < contents.length; i++) {
      if (contents[i] !== context) {
        matchObj(contents[i]);
      }
    }
  }
  // Return the highest level bin.
  if (nameMatches.length) {
    return nameMatches;
  }
  if (aliasMatches.length) {
    return aliasMatches;
  }
  if (partialMatches.length) {
    return partialMatches;
  }
  return [];
};

$.utils.match.strength = function(str, obj) {
  // On a score of zero to three, how well does str match obj?
  // 0: No match.
  // 1: Partial name or alias.
  // 2: Perfect alias match.
  // 3: Perfect name match.
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
