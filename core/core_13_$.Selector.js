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
 * @fileoverview Selector implementation for Code City core.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.Selector = function Selector(s) {
  /* A Selector is a representation of a selector string in the form
   * of an array (of Selector.Parts) which happens to have
   * Selector.prototype (with various useful convenience methods) in
   * its prototype chain.
   */
  var parts;
  if (typeof s === 'string') {
    // Parse selector text (but check in cache first).
    var cached = Selector.cache_[s];
    // Copy and set owner?
    if (cached) return cached;
    parts = Selector.parse(s);
  } else if (Array.isArray(s)) {
    parts = [];
    // Validate & copy parts list.
    if (s.length < 1) throw new RangeError('Zero-length parts list??');
    if (!$.utils.code.isIdentifier(s[0])) {
      throw new TypeError('parts array must begin with an identifier');
    }
    parts[0] = s[0];
    for (var i = 1; i < s.length; i++) {
      if (typeof s[i] === 'string' || s[i] === Selector.PROTOTYPE || s[i] === Selector.OWNER) {
	      parts[i] = s[i];
      } else if (s[i] instanceof Selector.SpecialPart) {
        throw new TypeError('Invalid SpecialPart in parts array');
	    } else if (typeof s[i] === 'object' && s[i].type) {
        // Handle normalisation of parts lists that have been roundtripped via JSON.
        switch(s[i].type) {
          case 'proto':
	          parts[i] = Selector.PROTOTYPE;
            break;
          case 'owner':
	          parts[i] = Selector.OWNER;
            break;
          default:
          throw new TypeError('Unknown SpecialPart type ' + s[i].type);
        }
      } else {
        throw new TypeError('Invalid part in parts array');
      }
    }
  } else {
    throw new TypeError('Not a selector or parts array');
  }
  Object.setPrototypeOf(parts, Selector.prototype);
  Object.freeze(parts);
  // Copy and set owner?
  Selector.cache_[parts.toString()] = parts;  // Save.
  return parts;
};
Object.setOwnerOf($.Selector, $.physicals.Maximilian);
Object.setPrototypeOf($.Selector.prototype, Array.prototype);
$.Selector.prototype.isOwner = function isOwner() {
  /* Returns true iff the selector represents an object owner binding.
   */
  return this.length > 1 && this[this.length - 1] === this.constructor.OWNER;
};
Object.setOwnerOf($.Selector.prototype.isOwner, $.physicals.Maximilian);
$.Selector.prototype.isProp = function isProp() {
  /* Returns true iff the selector represents an object property binding.
   */
  return this.length > 1 && typeof this[this.length - 1] === 'string';
};
Object.setOwnerOf($.Selector.prototype.isProp, $.physicals.Maximilian);
$.Selector.prototype.isProto = function isProto() {
  /* Returns true iff the selector represents an object prototype binding.
   */
  return this.length > 1 && this[this.length - 1] === this.constructor.PROTOTYPE;
};
Object.setOwnerOf($.Selector.prototype.isProto, $.physicals.Maximilian);
$.Selector.prototype.isVar = function isVar() {
  /* Returns true iff the selector represents a top-level variable binding.
   */
  return this.length === 1 && typeof this[0] === 'string';
};
Object.setOwnerOf($.Selector.prototype.isVar, $.physicals.Maximilian);
$.Selector.prototype.toExpr = function toExpr() {
	/* Return the selector as an evaluable expression yeilding the selected value.
	 */
  return this.toString(function(part, out) {
    if (part === $.Selector.PROTOTYPE) {
      out.unshift('Object.getPrototypeOf(');
      out.push(')');
    } else if (part === $.Selector.OWNER) {
      out.unshift('Object.getOwnerOf(');
      out.push(')');
    } else {
      throw new TypeError('Invalid part in parts array');
    }
  });
};
Object.setOwnerOf($.Selector.prototype.toExpr, $.physicals.Maximilian);
$.Selector.prototype.toSetExpr = function toSetExpr(valueExpr) {
  /* Return an expression setting the selected value to the value of the
   * supplied expression.
   *
   * The parameter valueExpr should be a string containing a JS expression that
   * evaluates to the new value to be assigned to the selected location.  It
   * must not contain any non-parenthesized operators with lower precedence
   * than '=' - specifically, the yield and comma operators.
   */
  var lastPart = this[this.length - 1];
  if (!(lastPart instanceof this.constructor.SpecialPart)) {
    return this.toExpr() + ' = ' + valueExpr;
  }
  var objExpr = new this.constructor(this.slice(0, -1)).toExpr();
  if (lastPart === this.constructor.PROTOTYPE) {
    return 'Object.setPrototypeOf(' + objExpr + ', ' + valueExpr + ')';
  } else if (lastPart === this.constructor.OWNER) {
    return 'Object.setOwnerOf(' + objExpr + ', ' + valueExpr + ')';
  } else {
    throw new TypeError('Invalid part in parts array');
  }
};
Object.setOwnerOf($.Selector.prototype.toSetExpr, $.physicals.Maximilian);
$.Selector.prototype.toString = function toString(specialHandler) {
  /* Return the canonical selector string for this Selector.
   *
   * The specialHandler optional parameter, if supplied, should be callback
   * which accepts a Selector.SpecialPart instance and an Array of strings, and
   * pushes a string representation of the SpecialPart onto the array.  (See
   * Selector.prototype.toExpr for an example of how to use this.)
   */
  var out = [this[0]];
  for (var i = 1; i < this.length; i++) {
    var part = this[i];
    if (part instanceof this.constructor.SpecialPart) {
      if (specialHandler) {
        specialHandler(part, out);
      } else {
        out.push(String(part));
      }
    } else if ($.utils.code.isIdentifierName(part)) {
      out.push('.', part);
    } else if (String(Number(part)) === part) {
      // String represents a number with same string representation.
      out.push('[', part, ']');
    } else {
      out.push('[', $.utils.code.quote(part), ']');
    }
  }
  return out.join('');
};
Object.setOwnerOf($.Selector.prototype.toString, $.physicals.Maximilian);
$.Selector.prototype.toValue = function toValue(save, global) {
  /* Return value corresponding to this Selector, or throw EvalError if that is
   * not possible.  This function basically does
   *
   *     return eval(this.toExpr())
   *
   * ...only slightly more safely.
   *
   * Added bonus features:
   * - If this selector evaluates to an object and save is true, the  selector
   *   will be added to the the reverse-lookup database.
   * - If global is specified, global variables will be evaluated by looking
   *   them up as properties on that object.
   */
  if (this.length === 0) throw RangeError('Invalid Selector');
  var varname = this[0];
  if (!$.utils.code.isIdentifier(varname)) {
    throw TypeError('invalid variable identifier');
  }
  var v;
  if (global) {
    v = global[varname];
  } else {
    try {
      var globalEval = eval;
      v = globalEval(varname);
    } catch (e) {
      v = undefined;
    }
  }
  for (var i = 1; i < this.length; i++) {
    if (!$.utils.isObject(v)) {
      var s = new this.constructor(this.slice(0, i));
      throw TypeError(String(s) + ' is not an object');
    }
    var part = this[i];
    if (typeof part === 'string') {
      v = v[part];
    } else if (part === this.constructor.PROTOTYPE) {
      v = Object.getPrototypeOf(v);
    } else if (part === this.constructor.OWNER) {
      v = Object.getOwnerOf(v);
    } else {
      throw new Error('Not implemented');
    }
  }
  if (save) {
    this.constructor.db.set(v, this);
  }
  return v;
};
Object.setOwnerOf($.Selector.prototype.toValue, $.physicals.Maximilian);
$.Selector.prototype.badness = function badness() {
  /* Returns a "badness" score, inversely proportional to how
   * desirable a particular selector is amongst other selectors
   * referring to the same object.  In general, longer selectors are
   * more bad, but selectors containing special parts are especially
   * bad.
   */
  var penalties = 0;
	for (var i = 0; i < this.length; i++) {
    var part = this[i];
    if (part instanceof this.constructor.SpecialPart) {
      penalties += 100;
    } else if ($.utils.code.isIdentifierName(part)) {
      penalties += 10;  // We like identifiers.
    } else if (String(Number(part)) === part) {
      penalties += 25;  // Numbers are OK.
    } else {
      penalties += 50;  // Quoted strings are undesirable.
    }
  }
  if (this[0] === '$') penalties += 50;  // Prefer builtins.
  return penalties + String(this).length;
};
Object.setOwnerOf($.Selector.prototype.badness, $.physicals.Maximilian);
$.Selector.SpecialPart = function SpecialPart(type) {
  // A SpecialPart is a class for all "special" selector parts (ones
  // which do not represent named variables / properties).
  this.type = type;
  Object.freeze(this);
};
$.Selector.SpecialPart.prototype.toString = function() {
  return '{' + this.type + '}';
};
$.Selector.PROTOTYPE = (new 'Object.create')($.Selector.SpecialPart.prototype);
$.Selector.PROTOTYPE.type = 'proto';
Object.defineProperty($.Selector.PROTOTYPE, 'type', {writable: false, configurable: false});
Object.preventExtensions($.Selector.PROTOTYPE);
$.Selector.OWNER = (new 'Object.create')($.Selector.SpecialPart.prototype);
$.Selector.OWNER.type = 'owner';
Object.defineProperty($.Selector.OWNER, 'type', {writable: false, configurable: false});
Object.preventExtensions($.Selector.OWNER);
$.Selector.parse = function parse(selector) {
  // Parse a selector into an array of Parts.
  var tokens = this.parse.tokenize(selector);
  var parts = [];
  var State = {
    START: 0, GOOD: 1, DOT: 2, BRACKET: 3, BRACKET_DONE: 4,
    BRACE: 5, BRACE_DONE: 6
  };
  var state = State.START;
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (token.type === 'whitespace') continue;
    switch (state) {
      case State.START:
        if (token.type !== 'id') {
          throw new SyntaxError('Selector must start with an identifier');
        }
        parts.push(token.raw);
        state = State.GOOD;
        break;

      case State.GOOD:
        if (token.type === '.') {
          state = State.DOT;
        } else if (token.type === '[') {
          state = State.BRACKET;
        } else if (token.type === '{') {
          state = State.BRACE;
        } else if (token.type === '^') {
          // State remains unchanged.
          parts.push(this.PROTOTYPE);
        } else {
          throw new SyntaxError('Invalid token ' + $.utils.code.quote(token.raw)  + ' in selector');
        }
        break;

      case State.DOT:
        if (token.type !== 'id') {
          throw new SyntaxError('"." must be followed by identifier in selector');
        }
        parts.push(token.raw);
        state = State.GOOD;
        break;

      case State.BRACKET:
        if (token.type === 'number') {
          parts.push(String(token.raw));
        } else if (token.type === 'str') {
          parts.push(String(token.value));
        } else {
          throw new SyntaxError('"[" must be followed by numeric or string literal in selector');
        }
        state = State.BRACKET_DONE;
        break;

      case State.BRACKET_DONE:
        if (token.type !== ']') {
          throw new SyntaxError('Invalid token ' + $.utils.code.quote(token.raw)  + ' after subscript');
        }
        state = State.GOOD;
        break;

      case State.BRACE:
        if (token.type === 'id' && token.raw === 'proto') {
          parts.push(this.PROTOTYPE);
        } else if (token.type === 'id' && token.raw === 'owner') {
          parts.push(this.OWNER);
        } else {
          throw new SyntaxError('"{" must be followed by "proto" or "owner"');
        }
        state = State.BRACE_DONE;
        break;

      case State.BRACE_DONE:
        if (token.type !== '}') {
          throw new SyntaxError('Invalid token ' + $.utils.code.quote(token.raw)  + ' after special');
        }
        state = State.GOOD;
        break;

      default:
        throw new Error('Invalid State in parse??');
    }
  }
  if (state !== State.GOOD) {
    throw new SyntaxError('Incomplete selector ' + selector);
  }
  return parts;
};
Object.setOwnerOf($.Selector.parse, $.physicals.Maximilian);
$.Selector.parse.tokenize = function tokenize(selector) {
  // Tokenizes a selector string.  Throws a SyntaxError if any text is
 	// found which does not form a valid token.
  var REs = {
    whitespace: /^\s+/g,
    '.': /^\./g,
    id: new RegExp('^' + $.utils.code.regexps.identifierName.source, 'g'),
    number: /^\d+/g,
    '[': /^\[/g,
    ']': /^\]/g,
    '{': /^\{/g,
    '}': /^\}/g,
    '^': /^\^/g,
    str: new RegExp('^' + $.utils.code.regexps.string.source, 'g'),
  };

  var tokens = [];
  NEXT_TOKEN: for (var index = 0; index < selector.length; ) {
    for (var tokenType in REs) {
      if (!REs.hasOwnProperty(tokenType)) continue;
      var re = REs[tokenType];
      re.lastIndex = 0;
      var m = re.exec(selector.slice(index));
      if (!m) continue;  // No match.  Try next regexp.
      tokens.push({
        type: tokenType,
        raw: m[0],
        valid: true,
        index: index,
      });
      index += re.lastIndex;
      continue NEXT_TOKEN;
    }
    // No token matched.
    throw new SyntaxError('invalid selector ' + selector);
  }

  // Postprocess token list to get values.
  for(var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (token.type === 'number') {
      token.value = Number(token.raw);
    } else if (token.type === 'str') {
      token.value = $.utils.code.parseString(token.raw);
    }
  }
  return tokens;
};
$.Selector.for = function Selector_for(object) {
  /* Return a Selector for object, or undefined if none known.
   */
  return this.db.get(object);
};
Object.setOwnerOf($.Selector.for, $.physicals.Maximilian);
$.Selector.db = {};
$.Selector.db.map_ = new WeakMap();
$.Selector.db.set = function set(object, selector) {
  if (!$.utils.isObject(object)) return;  // Ignore non-object values.
  if (!(selector instanceof $.Selector)) {
    throw new TypeError('Second argument must be a Selector');
  }
  var selectorString = selector.toString();

  var known = this.map_.get(object) || [];
  // See if this selector is already known.
  if (known.includes(selectorString)) return;  // Already known.  Ignore.
  // Add new entry.
  known.push(selectorString);
  // Sort by badness, trim to length and save.
  $.Selector.sortByBadness(known);
	this.map_.set(object, known.slice(0, this.diversityLimit));
};
Object.setOwnerOf($.Selector.db.set, $.physicals.Maximilian);
$.Selector.db.README = 'Selector.db is database mapping objects to Selectors.\n\nThis info is stored in Selector.db.map_, which is a WeakMap mapping objects to entries.\n\nEach entry is an object whose keys are selector strings and values are the corresponding Selectors (i.e., parts lists).';
$.Selector.db.diversityLimit = 5;
$.Selector.db.get = function get(object) {
  if (!$.utils.isObject(object)) return undefined;
	var known = this.map_.get(object);
  while (known && known.length) {
    var selector = new $.Selector(known[0]);
    var value = null;
    try {
      value = selector.toValue();
    } catch (e) {}
    if (value === object) {
      return selector;
    } else {
      known.shift();  // Remove 0th item.
    }
  }
  return undefined;  // Ran out of known, valid selectors.
};
Object.setOwnerOf($.Selector.db.get, $.physicals.Maximilian);
$.Selector.db.populate = function populate() {
  /* Spider the object graph, starting from the global scope, to
   * (re)build the reverse-lookup database.
   *
   * We apply a version of Dijkstra's algorithm, specifically a BFS
   * over valid Selectors, where we reenqueue children of previously-
   * -visited objects if we find a better Selector for the parent
   * object.
   */
  // Prevent this function from running more than once at a time.
  if (populate.thread_) throw new Error('already running');
  try {
    populate.thread_ = Thread.current();

    var queue = Object.getOwnPropertyNames($.utils.code.getGlobal()).map(
      function (ss) {return new $.Selector(ss);});
    var seen = new WeakMap();
    for (var i = 0; i < queue.length; i++) {
      suspend();
      var s = queue[i];
      var v = s.toValue(/*save:*/true);
      if (!$.utils.isObject(v)) continue;  // Skip primitives completely.
      var best = $.Selector.for(v);
      if (seen.has(v) && s !== best) continue;
      seen.set(v, true);

      var parts = [$.Selector.PROTOTYPE, $.Selector.OWNER].concat(Object.getOwnPropertyNames(v));
      for (var j = 0; j < parts.length; j++) {
        var part = parts[j];
        if (part === 'cache_') continue;  // Skip .cache_ properties.
        queue.push(new $.Selector(s.concat(part)));
      }
    }

  } finally {
    populate.thread_ = null;
  }

};
Object.setOwnerOf($.Selector.db.populate, $.physicals.Maximilian);
Object.setOwnerOf($.Selector.db.populate.prototype, $.physicals.Maximilian);
$.Selector.db.populate.thread_ = null;
$.Selector.sortByBadness = function sortByBadness(selectors) {
  // Sort an array (or arraylike), which may contain Selectors,
  // (valid) selector strings, or a mix of the two, according to their
  // score, as returned by Selector.prototype.badness(), with the the
  // lowest-badness ones sorted first.
  if (!$.utils.isObject(selectors) || typeof selectors.length != 'number') {
    throw new TypeError('argument must be an arraylike');
  }
  // Begin by populating a badness cache, for quick lookups.
  var cache = sortByBadness.cache_;
  for (var i = 0; i < selectors.length; i++) {
    var s, ss = selectors[i];
    if (typeof ss === 'string') {
      s = new $.Selector(ss);
    } else if (ss instanceof $.Selector) {
      s = ss;
      ss = ss.toString();
    }
    if (ss in cache) continue;
    cache[ss] = s.badness();
  }
  // Do sort.  Optimised for sorting selector strings, since
  // that's what's needed by $.Selector.db.put.
  Array.prototype.sort.call(selectors, function compare(a, b) {
    if (typeof a !== 'string') a = String(a);
    if (typeof b !== 'string') b = String(b);
    return cache[a] - cache[b];
  });
  return selectors;
};
Object.setOwnerOf($.Selector.sortByBadness, $.physicals.Maximilian);

$.utils.Binding = function Binding(object, part) {
  /* A binding is essentially just an (object, part) tuple, where part
   * is a string or a Selector.SpecialPart.
   *
   * If object is null, part must be a string conforming to the
   * syntax of an identifier; in this case the binding represents
   * a variable in the global scope.
   */
  if (object === null) {
    if (!$.utils.code.isIdentifier(part)) {
      throw TypeError('Invalid variable name');
    }
  } else if (!$.utils.isObject(object)) {
    throw TypeError('Invalid object');
  } else if (typeof part !== 'string' &&
             part !== $.Selector.PROTOTYPE &&
             part !== $.Selector.OWNER) {
    throw TypeError('Invalid part');
  }
  this.object = object;
  this.part = part;
};
Object.setOwnerOf($.utils.Binding, $.physicals.Maximilian);
$.utils.Binding.prototype.set = function set(value) {
  /* Set the value of the binding.  Throws TypeError if unable.
   */
  if (this.object === null) {
    if (!Object.prototype.hasOwnProperty.call($.utils.code.getGlobal(), this.part)) {
      throw new TypeError("Can't create new global variable");
    }
    // Use a temporary property and an eval in the global scope (eval
    // by any other name, literally) to set the global variable
    // "safely".  The temporary property is placed on $ rather than
    // using $.db.tempId to avoid the possibility of the eval
    // somehow being subverted to access a different value than
    // expected due to one of the intervening objects being
    // compromised (by a getter, say).
    var tmpId;
    do {
      tmpId = 'tmp' + Math.floor(Math.random() * 0xFFFFFFFF);
    } while (tmpId in $);
    var evalGlobal = eval;
    try {
      $[tmpId] = value;
      evalGlobal(this.part + ' = $.' + tmpId);
    } finally {
      delete $[tmpId];
    }
  } else if(this.part === $.Selector.PROTOTYPE) {
    Object.setPrototypeOf(this.object, value);
  } else if(this.part === $.Selector.OWNER) {
    Object.setOwnerOf(this.object, value);
  } else {
    // BUG: doesn't handle non-writable properties.
		this.object[this.part] = value;
  }
};
Object.setOwnerOf($.utils.Binding.prototype.set, $.physicals.Maximilian);
$.utils.Binding.prototype.get = function get(inherited) {
  /* Return the current value of the binding, or undefined if the
   * binding does not exist.
   *
   * If inherited is true and the binding is a property binding that
   * does not exist on the object, any inherited value will be returned
   * instead.
   */
  var part = this.part;
  if (this.object === null) {
    if (!$.utils.code.isIdentifier(part)) {
      throw new TypeError('invalid variable identifier');
    }
    var evalGlobal = eval;
    return evalGlobal(part);
  } else if(part === $.Selector.PROTOTYPE) {
    return Object.getPrototypeOf(this.object);
  } else if(part === $.Selector.OWNER) {
    return Object.getOwnerOf(this.object);
  }
  if (inherited || Object.prototype.hasOwnProperty.call(this.object, part)) {
    return this.object[part];
  } else {
    return undefined;
  }
};
Object.setOwnerOf($.utils.Binding.prototype.get, $.physicals.Maximilian);
$.utils.Binding.prototype.isOwner = function isOwner() {
  /* Returns true iff the binding is an bject owner binding.
   */
  return this.part === $.Selector.OWNER;
};
Object.setOwnerOf($.utils.Binding.prototype.isOwner, $.physicals.Maximilian);
$.utils.Binding.prototype.isProp = function isProp() {
  /* Returns true iff the binding is an object property binding.
   */
  return this.object !== null && typeof this.part === 'string';
};
Object.setOwnerOf($.utils.Binding.prototype.isProp, $.physicals.Maximilian);
$.utils.Binding.prototype.isProto = function isProto() {
  /* Returns true iff the binding is an object prototype binding.
   */
  return this.part === $.Selector.PROTOTYPE;
};
Object.setOwnerOf($.utils.Binding.prototype.isProto, $.physicals.Maximilian);
$.utils.Binding.prototype.isVar = function isVar() {
  /* Returns true iff the binding is a top-level variable binding.
   */
  return this.object === null;
};
Object.setOwnerOf($.utils.Binding.prototype.isVar, $.physicals.Maximilian);
$.utils.Binding.prototype.exists = function exists() {
  /* Returns true iff the binding exists.
   */
  var part = this.part;
  if (this.object === null) {
    if (!$.utils.code.isIdentifier(part)) {
        throw new TypeError('invalid variable identifier');
    }
    var evalGlobal = eval;
    try {
      globalEval(varName);
      return true;
    } catch (e) {
      return false;
    }
  } else if(part === $.Selector.PROTOTYPE ||
            part === $.Selector.OWNER) {
    return true;
  }
  return Object.prototype.hasOwnProperty.call(this.object, part);
};
Object.setOwnerOf($.utils.Binding.prototype.exists, $.physicals.Maximilian);
Object.setOwnerOf($.utils.Binding.prototype.exists.prototype, $.physicals.Maximilian);
$.utils.Binding.from = function from(selector) {
  /* Create and return a Binding for the given selector - that is,
   * such that Binding.from(s).get() === s.toValue().
   */
	var part = selector[selector.length - 1];
  if (selector.isVar()) {
    // Global variable; no parent object.
    return new this(null, part);
  }
  var parent = new $.Selector(selector);
  parent.pop();
  var object = parent.toValue();
  if (!$.utils.isObject(object)) {
    throw new TypeError(String(parent) + ' is not an object');
  }
	return new this(object, part);
};
Object.setOwnerOf($.utils.Binding.from, $.physicals.Maximilian);

$.Selector.cache_ = (new 'Object.create')(null);

$.Selector.sortByBadness.cache_ = (new 'Object.create')(null);

