/**
 * @license
 * Code City: serialisation to eval-able JS
 *
 * Copyright 2018 Google Inc.
 * https://github.com/NeilFraser/CodeCity
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
 * @fileoverview Infrastructure to save the state of an Interpreter as
 *     eval-able JS.
 * @author cpcallen@google.com (Christohper Allen)
 */
'use strict';

var code = require('./code');
var Interpreter = require('./interpreter');
var Selector = require('./selector');

/**
 * Dump an Interpreter using a given dump specification.
 * @param {!Interpreter} intrp The interpreter to dump.
 * @param {!Array<SpecEntry>} spec The dump specificaiton.
 */
var dump = function(intrp, spec) {
  var dumper = new Dumper(intrp, spec);

};

///////////////////////////////////////////////////////////////////////////////
// Dumper.

/**
 * Dumper encapsulates all machinery to dump an Interpreter object to
 * eval-able JS, including maintaining all the dump-state info
 * required to keep track of what has and hasn't yet been dumped.
 * @constructor
 * @param {!Interpreter} intrp The interpreter to be dumped.
 * @param {!Array<SpecEntry>} spec The dump specification.
 */
var Dumper = function(intrp, spec) {
  this.intrp = intrp;
  this.config = new Config(spec);
  /** @type {!Map<!Interpreter.Scope,!ScopeInfo>} */
  this.scopeInfo = new Map;
  /** @type {!Map<!Interpreter.prototype.Object,!ObjectInfo>} */
  this.objInfo = new Map;
  /**
   * Which scope are we presently outputting code in the context of?
   * @type {!Interpreter.Scope}
   */
  this.scope = intrp.global;
};

/**
 * Generate JS source text to declare and optionally initialise a
 * particular binding (as specified by a Selector).
 * 
 * E.g., if foo = [42, 69, 105], then:
 *
 * myDumper.dumpBinding(new Selector('foo'), Do.DECL)
 * // => 'var foo;\n'
 * myDumper.dumpBinding(new Selector('foo'), Do.SET)
 * // => 'foo = [];\n'
 * myDumper.dumpBinding(new Selector('foo[0]'), Do.SET)
 * // => 'foo[0] = 42;\n'
 * myDumper.dumpBinding(new Selector('foo'), Do.RECURSE)
 * // => 'foo[1] = 69;\nfoo[2] = 105;\n'
 *
 * @param {!Selector} selector The selector for the binding to be dumped.
 * @param {Do} todo How much to dump.  Must be >= Do.DECL.
 * @return {string} An eval-able program to initialise the specified binding.
 */
Dumper.prototype.dumpBinding = function(selector, todo) {
  var output = [];

  if (selector.isVar()) {
    var ref = undefined;
    var info = this.getScopeInfo(this.scope);
  } else {
    ref = new Selector(selector);
    ref.pop();
    var obj = this.getValueForSelector(ref);
    if (!(obj instanceof this.intrp.Object)) {
      throw new TypeError("Can't set properties of primitive");
    }
    info = this.getObjectInfo(obj);
  }

  var part = selector[selector.length - 1];
  var done = info.getDone(part);
  var doDecl = (todo >= Do.DECL && done < Do.DECL);
  var doInit = (todo >= Do.SET && done < Do.SET);
  var doRecurse = (todo >= Do.RECURSE && done < Do.RECURSE);

  // Get value for initialiser and/or recursion.
  if (doInit || doRecurse) {
    var value = this.getValueForSelector(selector);
  }

  output.push(info.dumpBinding(this, part, todo));

  if (doRecurse && value instanceof this.intrp.Object) {
    // Record what we're about to do, to avoid infinite recursion.
    //
    // TODO(cpcallen): We should probably record some intermediate
    // state: enough to stop further recursive calls, but not indicating
    // final completion.  At the moment this makes the setDone call
    // below a no-op.
    info.setDone(part, todo);

    var oi = this.getObjectInfo(value);
    var root = this.intrp.ROOT;
    var keys = value.ownKeys(root);
    var subselector = new Selector(selector);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (oi.getDone(key) >= todo) continue;  // Skip already-done properties.
      subselector.push(key);
      output.push(this.dumpBinding(subselector, todo));
      subselector.pop();
    }
    // Record completion.
    info.setDone(part, todo);
  }

  return output.join('');
};

/**
 * Get a source text representation of a given value.  The source text
 * will vary depending on the state of the dump; for instance, if the
 * value is an object that has not yet apepared in the dump it will be
 * represented by an expression creating the object - but if it has
 * appeared before, then it will instead be represented by an
 * expression referenceing the previously-constructed object.
 *
 * TODO(cpcallen): rename this (and other *ToExpr) to toSource once
 *     https://github.com/google/closure-compiler/issues/3013 is
 *     fixed.
 * @param {Interpreter.Value} value Arbitrary JS value from this.intrp.
 * @param {Selector=} selector Location in which value will be stored.
 * @return {string} An eval-able representation of the value.
 */
Dumper.prototype.toExpr = function(value, selector) {
  var intrp = this.intrp;
  if (!(value instanceof intrp.Object)) {
    return this.primitiveToExpr(value);
  }

  // Return existing reference to object (if already created).
  var info = this.getObjectInfo(value);
  if (info.ref) return info.ref.toExpr();

  // New object.  Save referece for later use.
  if (!selector) throw Error('Refusing to create non-referable object');
  info.ref = selector;

  // Object not yet referenced.  Is it a builtin?  If not, create it.
  var key = intrp.builtins.getKey(value);
  if (key) {
    return this.builtinToExpr (value, key, info);
  } else if (value instanceof intrp.Function) {
    return this.functionToExpr(value, info);
  } else if (value instanceof intrp.Array) {
    return this.arrayToExpr(value, info);
  } else if (value instanceof intrp.Date) {
    return this.dateToExpr(value, info);
  } else if (value instanceof intrp.RegExp) {
    return this.regExpToExpr(value, info);
  } else {
    return this.objectToExpr(value, info);
  }
};

/**
 * Get a source text representation of a given primitive value (not
 * including symbols).  Correctly handles having Infinity, NaN and/or
 * undefiend shadowed by binding in the current scope.
 * @param {undefined|null|boolean|number|string} value Primitive JS value.
 * @return {string} An eval-able representation of the value.
 */
Dumper.prototype.primitiveToExpr = function(value) {
  switch (typeof value) {
    case 'undefined':
      if (this.isShadowed('undefined')) return '(void 0)';
      // FALL THROUGH
    case 'boolean':
      return String(value);
    case 'number':
      // All finite values (except -0) will convert back to exactly
      // equal number, but Infinity and NaN could be shadowed.  See
      // https://stackoverflow.com/a/51218373/4969945
      if (Object.is(value, -0)) {
        return '-0';
      } else if (Number.isFinite(value)) {
        return String(value);
      } else if (Number.isNaN(value)) {
        if (this.isShadowed('NaN')) {
          return '(0/0)';
        }
        return 'NaN';
      } else {  // value is Infinity or -Infinity.
        if (this.isShadowed('Infinity')) {
          return (value > 0) ? '(1/0)' : '(-1/0)';
        }
        return String(value);
      }
    case 'string':
      return code.quote(value);
    default:
      if (value === null) {
        return 'null';
      } else {
        throw TypeError('primitiveToSource called on non-primitive value');
      }
  }
};

/**
 * Get a source text representation of a given builtin.  May or may not
 * include all properties, etc.
 * @param {!Interpreter.prototype.Object} obj Object to be recreated.
 * @param {string} key The name of the builtin.
 * @param {!ObjectInfo} info Dump-state info about func.
 * @return {string} An eval-able representation of obj.
 */
Dumper.prototype.builtinToExpr = function(obj, key, info) {
  if (obj instanceof this.intrp.Function) {
    // The .length property and .name properties are pre-set.
    // BUG(cpcallen): Actually, .name can be changed, so we should
    // compare it to the value in a pristine Interpreter.
    info.setDone('length', Do.SET);
    info.setDone('name', Do.SET);
  }
  return 'new ' + code.quote(key);
};

/**
 * Get a source text representation of a given Object.  May or may not
 * include all properties, etc.
 * @param {!Interpreter.prototype.Object} obj Object to be recreated.
 * @param {!ObjectInfo} info Dump-state info about obj.
 * @return {string} An eval-able representation of obj.
 */
Dumper.prototype.objectToExpr = function(obj, info) {
  info.doneProto = Do.SET;
  switch (obj.proto) {
    case this.intrp.OBJECT:
      return '{}';
    case null:
      return 'Object.create(null)';
    default:
      var protoInfo = this.getObjectInfo(obj.proto);
      if (protoInfo.ref) {
        return 'Object.create(' + this.toExpr(obj.proto) + ')';
      } else {
        info.doneProto = Do.DECL;
        return '{}';  // Set [[Prototype]] later.
      }
  }
};

/**
 * Get a source text representation of a given Function object.
 * @param {!Interpreter.prototype.Function} func Function object to be
 *     recreated.
 * @param {!ObjectInfo} info Dump-state info about func.
 * @return {string} An eval-able representation of func.
 */
Dumper.prototype.functionToExpr = function(func, info) {
  if (!(func instanceof this.intrp.UserFunction)) {
    throw Error('Unable to dump non-UserFunction');
  }
  // Do we need to set [[Prototype]]?  Not if it's Function.prototype.
  if (func.proto === this.intrp.FUNCTION) info.doneProto = Do.SET;
  // The .length property will be set implicitly.
  info.setDone('length', Do.SET);
  // BUG(cpcallen): .name is only set in certain circumstances.
  info.setDone('name', Do.SET);
  // The .prototype property will automatically be created, so we
  // don't need to "declare" it.  Fortunately it's non-configurable,
  // so we don't need to worry that it might need to be deleted.
  info.setDone('prototype', Do.DECL);
  // Better still, we can use the automatically-created .prototype
  // object if the current value is an ordinary object (regardless of
  // prototype - that can be set later) and it isn't a built-in or
  // already instantiated.
  var prototype = func.get('prototype', this.intrp.ROOT);
  if (!this.intrp.builtins.getKey(prototype) &&
      prototype instanceof this.intrp.Object &&
      prototype.class === 'Object') {
    var prototypeInfo = this.getObjectInfo(prototype);
    if(prototypeInfo.ref === undefined) {
      prototypeInfo.ref = new Selector(info.ref.concat('prototype'));
      info.setDone('prototype', Do.SET);
      // Can we also use implicit .constructor?
      var constructor = prototype.get('constructor', this.intrp.ROOT);
      if (constructor === func) {
        prototypeInfo.setDone('constructor', Do.SET);
      }
    }
  }
  return func.toString();
};

/**
 * Get a source text representation of a given Array object.
 * @param {!Interpreter.prototype.Array} arr Array object to be recreated.
 * @param {!ObjectInfo} info Dump-state info about arr.
 * @return {string} An eval-able representation of obj.
 */
Dumper.prototype.arrayToExpr = function(arr, info) {
  // Do we need to set [[Prototype]]?  Not if it's Array.prototype.
  if (arr.proto === this.intrp.ARRAY) info.doneProto = Do.SET;
  var root = this.intrp.ROOT;
  var lastIndex = arr.get('length', root) - 1;
  if (lastIndex < 0 || arr.getOwnPropertyDescriptor(String(lastIndex),  root)) {
    // No need to set .length if it will be set via setting final index.
    info.setDone('length', Do.SET);
  } else {
    // Length exists; don't worry about it when preserving propery order.
    info.setDone('length', Do.DECL);
  }
  return '[]';
};

/**
 * Get a source text representation of a given Date object.
 * @param {!Interpreter.prototype.Date} date Date object to be recreated.
 * @param {!ObjectInfo} info Dump-state info about date.
 * @return {string} An eval-able representation of obj.
 */
Dumper.prototype.dateToExpr = function(date, info) {
  // Do we need to set [[Prototype]]?  Not if it's Date.prototype.
  if (date.proto === this.intrp.DATE) info.doneProto = Do.SET;
  return "new Date('" + date.date.toISOString() + "')";
};

/**
 * Get a source text representation of a given RegExp object.
 * @param {!Interpreter.prototype.RegExp} re RegExp to be recreated.
 * @param {!ObjectInfo} info Dump-state info about re.
 * @return {string} An eval-able representation of obj.
 */
Dumper.prototype.regExpToExpr = function(re, info) {
  // Do we need to set [[Prototype]]?  Not if it's RegExp.prototype.
  if (re.proto === this.intrp.REGEXP) info.doneProto = Do.SET;
  // Some properties are implicitly pre-set.
  info.setDone('source', Do.SET);
  info.setDone('global', Do.SET);
  info.setDone('ignoreCase', Do.SET);
  info.setDone('multiline', Do.SET);
  // Can skip .lastIndex iff it is 0.
  if (re.get('lastIndex', this.intrp.ROOT) === 0) {
    info.setDone('lastIndex', Do.SET);
  }
  return re.regexp.toString();
};

/**
 * Get ObjectInfo or ScopeInfo of the parent scope/object for the
 * given selector.
 * @param {!Selector} selector A selector for the binding in question.
 * @return {!ObjectInfo|!ScopeInfo};
 */
Dumper.prototype.getInfoForSelector = function(selector) {
  if (selector.isVar()) {
    return this.getScopeInfo(this.scope);
  } else {
    var ref = new Selector(selector);
    ref.pop();
    var obj = this.getValueForSelector(ref);
    if (!(obj instanceof this.intrp.Object)) {
      throw new TypeError("Can't get info for primitive");
    }
    return this.getObjectInfo(obj);
  }
};

/**
 * Get interned ScopeInfo for sope.
 * @param {!Interpreter.Scope} scope The scope to get info for.
 * @return {!ScopeInfo} The ScopeInfo for scope.
 */
Dumper.prototype.getScopeInfo = function(scope) {
  if (this.scopeInfo.has(scope)) return this.scopeInfo.get(scope);
  var si = new ScopeInfo(scope);
  this.scopeInfo.set(scope, si);
  return si;
};

/**
 * Get interned ObjectInfo for sope.
 * @param {!Interpreter.prototype.Object} obj The object to get info for.
 * @return {!ObjectInfo} The ObjectInfo for obj.
 */
Dumper.prototype.getObjectInfo = function(obj) {
  if (this.objInfo.has(obj)) return this.objInfo.get(obj);
  var oi = new ObjectInfo(this, obj);
  this.objInfo.set(obj, oi);
  return oi;
};

/**
 * Get the present value in the interpreter of a particular binding,
 * specified by selector.  If selector does not correspond to a valid
 * binding an error is thrown.
 * @param {!Selector} selector A selector, specifiying a binding.
 * @param {!Interpreter.Scope=} scope Scope which selector is relative
 *     to.  Defaults to global scope.
 * @return {Interpreter.Value} The value of that binding.
 */
Dumper.prototype.getValueForSelector = function(selector, scope) {
  if (!scope) scope = this.intrp.global;
  if (selector.length < 1) throw RangeError('Zero-length selector??');
  var varname = selector[0];
  if (typeof varname !== 'string') throw TypeError('Invalid first part??');
  var v = scope.get(varname);
  for (var i = 1; i < selector.length; i++) {
    if (!(v instanceof this.intrp.Object)) {
      var s = new Selector(selector.slice(0, i));
      throw TypeError("Can't get select part of primitive " + s + ' === ' + v);
    }
    var part = selector[i];
    if (typeof part === 'string') {
      v = v.get(part, this.intrp.ROOT);
    } else if (part === Selector.PROTOTYPE) {
      v = v.proto;
    } else {
      throw new Error('Not implemented');
    }
  }
  return v;
};

/**
 * Returns true if a given name is shadowed in the current scope.
 * @param {string} name Variable name that might be shadowed.
 * @param {!Interpreter.Scope=} scope Scope in which name is defind
 *     (default: the global scope).
 * @return {boolean} True iff name is bound in a scope between the
 *     current scope (this.scope) (inclusive) and scope (exclusive).
 */
Dumper.prototype.isShadowed = function(name, scope) {
  scope = scope || this.intrp.global;
  for (var s = this.scope; s !== scope; s = s.outerScope) {
    if (s === null) {
      throw Error("Looking for name '" + name + "' from non-enclosing scope??");
    }
    if (s.hasBinding(name)) return true;
  }
  return false;
};

/**
 * Dump-state information for a single scope.
 * @constructor
 * @param {!Interpreter.Scope} scope The scope to keep state for.
 */
var ScopeInfo = function(scope) {
  this.scope = scope;
  /**
   * Map of variable name -> dump status.
   * @private @const {!Object<string, Do>}
   */
  this.done_ = Object.create(null);
};

/**
 * Generate JS source text to create and/or initialize a single
 * variable binding.
 * 
 * @param {!Dumper} dumper Dumper to which this ScopeInfo belongs.
 * @param {!Selector.Part} part The part to dump.  Must be simple string.
 * @param {Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Selector=} ref Ignored.
 * @return {string} An eval-able program to initialise the specified variable.
 */
ScopeInfo.prototype.dumpBinding = function(dumper, part, todo, ref) {
  if (dumper.scope !== this.scope) {
    throw new Error("Can't create binding other than in current scope");
  } else if (typeof part !== 'string') {
    throw new TypeError('Invalid part (not a variable name)');
  }
  var done = this.getDone(part);
  if (todo === Do.DECL && done < Do.DECL) {
    this.setDone(part, Do.DECL);
    return 'var ' + part + ';\n';
  } else if (todo >= Do.SET && done < Do.SET) {
    this.setDone(part, Do.SET);
    // TODO(cpcallen): don't recreate a Selector that our caller^3 already has?
    var sel = new Selector([part]);
    return (done < Do.DECL ? 'var ' : '') + part + ' = ' +
        dumper.toExpr(this.scope.get(part), sel) + ';\n';
  } else {
    return '';
  }
};

/**
 * Return the current 'done' status of a variable binding.
 * @param {!Selector.Part} part The part get status for.  Must be simple string.
 * @return {Do} The done status of the binding.
 */
ScopeInfo.prototype.getDone = function(part) {
  if (typeof part !== 'string') {
    throw new TypeError('Invalid part (not a variable name)');
  }
  return this.done_[part] || Do.UNSTARTED;
};

/**
 * Update the current 'done' status of a variable binding.  Will throw
 * a RangeError if caller attempts to un-do a previously-done action.
 * @param {!Selector.Part} part The part set status for.  Must be simple string.
 * @param {Do} done The new done status of the binding.
 */
ScopeInfo.prototype.setDone = function(part, done) {
  if (typeof part !== 'string') {
    throw new TypeError('Invalid part (not a variable name)');
  } else if (done < this.getDone(part)) {
    throw new RangeError('Undoing previous variable binding??');
  }
  this.done_[part] = done;
};

/**
 * Dump-state information for a single object.
 * @constructor
 * @param {!Dumper} dumper Dumper to which this ObjectInfo belongs.
 * @param {!Interpreter.prototype.Object} obj The object to keep state for.
 */
var ObjectInfo = function(dumper, obj) {
  this.obj = obj;
  /** @type {!Selector|undefined} Reference to this object, once created. */
  this.ref = undefined;
  /**
   * Map of property name -> dump status, where:
   *
   * - .todo[p] === true means the property p has not yet been created.
   * - .todo[p] === { ...property descriptor... } means the property p
   *   has been created, and these are the present values of of the
   *   property attributes, except that todo[p].value === true iff the
   *   value has been set.
   * - .todo[p] === false means that all work on property p has been
   *   completed, but not recursively on the properties of obj.p.
   * - .todo[p] deleted meands all work has been done on property p
   *   and its properties (if any).
   *
   * @private @const {!Object<string, (boolean|!Object<string, boolean>)>}
   */
  this.todo_ = Object.create(null);
  var keys = obj.ownKeys(dumper.intrp.ROOT);
  for (var i = 0; i < keys.length; i++) {
    this.todo_[keys[i]] = true;
  }
  /** @type {!Do} Has prototype been set? */
  this.doneProto = Do.DECL;  // Never need to 'declare' the [[Prototype]] slot!
  /** @type {!Do} Has owner been set? */
  this.doneOwner = Do.DECL;  // Never need to 'declare' that object has owner!
};

/**
 * Generate JS source text to create and/or initialize a single
 * binding (property or internal slot) of the object.
 * 
 * @param {!Dumper} dumper Dumper to which this ObjectInfo belongs.
 * @param {!Selector.Part} part The binding part to dump.
 * @param {Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Selector=} ref Selector refering to this object.
 *     Optional; defaults to whatever selector was used to create the
 *     object.
 * @return {string} An eval-able program to initialise the specified binding.
 */
ObjectInfo.prototype.dumpBinding = function(dumper, part, todo, ref) {
  if (!this.ref) throw new Error("Can't dump part of uncreated object");
  if (!ref) ref = this.ref;
  if (part === Selector.PROTOTYPE) {
    return this.dumpPrototype_(dumper, todo, ref);
  } else if (typeof part === 'string') {
    return this.dumpProperty_(dumper, part, todo, ref);
  } else {
    throw new Error('Invalid part');
  }
};

/**
 * Generate JS source text to create and/or initialize a single
 * binding (property or internal slot) of the object.
 * 
 * @param {!Dumper} dumper Dumper to which this ObjectInfo belongs.
 * @param {string} key The property to dump.
 * @param {Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Selector} ref Selector refering to this object.
 * @return {string} An eval-able program to initialise the specified binding.
 */
ObjectInfo.prototype.dumpProperty_ = function(dumper, key, todo, ref) {
  var done = this.getDone(key);
  // TODO(cpcallen): don't recreate a Selector that our caller^3 already has?
  var sel = new Selector(ref);
  sel.push(key);
  if (todo === Do.DECL && done < Do.DECL) {
    this.setDone(key, Do.DECL);
    return sel.toExpr() + ' = undefined;\n';
  } else if (todo >= Do.SET && done < Do.SET) {
    this.setDone(key, Do.SET);
    return sel.toExpr() + ' = ' + dumper.toExpr(this.obj.properties[key], sel) +
        ';\n';
  } else {
    return '';
  }
};

/**
 * Generate JS source text to set the object's prototype.
 * 
 * @param {!Dumper} dumper Dumper to which this ObjectInfo belongs.
 * @param {Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Selector} ref Selector refering to this object.
 * @return {string} An eval-able program to initialise the specified binding.
 */
ObjectInfo.prototype.dumpPrototype_ = function(dumper, todo, ref) {
  if (todo >= Do.SET && this.doneProto < Do.SET) {
    this.doneProto = Do.SET;
    return 'Object.setPrototypeOf(' + ref.toExpr() + ', ' +
        dumper.toExpr(this.obj.proto) + ');\n';
  } else {
    return '';
  }
};

/**
 * Return the current 'done' status of an object binding.
 * @param {!Selector.Part} part The part to get status for.
 * @return {Do} The done status of the binding.
 */
ObjectInfo.prototype.getDone = function(part) {
  if (part === Selector.PROTOTYPE) {
    return this.doneProto;
  } else if (typeof part === 'string') {
    var status = this.todo_[part];
    if (status === true) {
      return Do.UNSTARTED;
    } else if(status && !status.value) {
      return Do.DECL;
    } else if(status && status.value || status === false) {
      return Do.SET;
    } else if(status === undefined) {
      return Do.RECURSE;
    } else {
      throw new Error('Corrupt .todo_ status??');
    }
  } else {
    throw new TypeError('Invalid part');
  }
};

/**
 * Update the current 'done' status of a property.  Will throw a
 * RangeError if caller attempts to un-do or re-do a previously-done
 * action.
 * @param {!Selector.Part} part The part to set status for.
 * @param {Do} done The new done status of the binding.
 */
ObjectInfo.prototype.setDone = function(part, done) {
  if (part === Selector.PROTOTYPE) {
    if (done <= this.doneProto) {
      throw new RangeError('Prototype already done??');
    }
    this.doneProto = done;
  } else if (typeof part === 'string') {
    var status = this.todo_[part];
    if (done === Do.DECL) {
      if (status !== true &&
          (typeof status !== 'object' || status.value !== false)) {
        throw new RangeError('Property ' + part + ' already created??');
      }
      // TODO(cpcallen): also include attributes.
      this.todo_[part] = {value: false};
    } else if (done === Do.SET) {
      if (status && status.value) {
        throw new RangeError('Property already set??');
      }
      this.todo_[part] = false;
    } else if (done === Do.RECURSE) {
      if (status && status.value) {
        throw new RangeError('Recursion already complete??');
      }
      delete this.todo_[part];
    } else {
      throw new Error('Not implemented');
    }
  } else {
    throw new TypeError('Invalid part');
  }
};

/**
 * Possible things to do (or have done) with a variable / property
 * binding.  Note that all valid 'do' values are truthy.
 * @enum {number}
 */
var Do = {
  /**
   * Nothing has been done about this binding yet.  Only valid as a
   * 'done' value, not as a 'do' value.
   */
  UNSTARTED: 0,

  /**
   * Skip the named binding entirely (unless it or an extension of it
   * is explicitly mentioned in a later config directive); if the data
   * accessible via the named binding is not accessible via any other
   * (non-pruned) path from the global scope it will consequently not
   * be included in the dump.  Only valid as a 'do' value.
   *
   * This option is intended to cause data loss, so be careful!
   */
  PRUNE: 1,

  /**
   * Skip the named binding for now, but include it in a later file
   * (whichever has rest: true).  Only valid as a 'do' value.
   */
  SKIP: 2,

  /**
   * Ensure that the specified binding exists, but do not yet set it
   * to its final value.  If the binding is a variable, it has been /
   * will be declared; if it is a property, it has been / will be
   * created but not (yet) set to a value other than undefined (nor
   * made non-configurable).
   */
  DECL: 3,

  /**
   * Ensure theat the specified binding exists and has been set to its
   * final value (if primitive) or an object of the correct class (if
   * non-primitive).  It will also ensure the final property
   * attributes (enumerable, writable and/or configurable) are set.
   *
   * If a new object is created to be the value of the specified path
   * it will not (yet) have its properties or internal set/map data
   * set (but immutable internal data, such as function code, must be
   * set at this time).
   */
  SET: 4,

  /**
   * Ensure the specified path is has been set to its final value (and
   * marked immuable, if applicable) and that the same has been done
   * recursively to all bindings reachable via path.
   */
  RECURSE: 5,
};


///////////////////////////////////////////////////////////////////////////////
// Data types used to specify a dump configuration.

/**
 * A processed-and-ready-to-use configuration entry for a single
 * output file.
 * @typedef {{filename: string,
 *            contents: !Array<!ContentEntry>,
 *            rest: boolean}}
 */
var ConfigEntry;

/**
 * A configuration entry as supplied by the caller, possibly omitting
 * or abridging certain information.
 * @typedef {{filename: string,
 *            contents: (!Array<string|!ContentEntry>|undefined),
 *            rest: (boolean|undefined)}}
 */
var SpecEntry;

/**
 * The type of the values of .contents entries of a ConfigEntry.
 * @record
 */
var ContentEntry = function() {};

/**
 * Path is a string like "eval", "Object.prototype" or
 * "$.util.command" identifying the variable or property binding this
 * entry applies to.
 * @type {string}
 */
ContentEntry.prototype.path;

/**
 * Do is what to to do with the specified path.
 * @type {Do}
 */
ContentEntry.prototype.do;

/**
 * Reorder is a boolean (default: false) specifying whether it is
 * acceptable to allow property or set/map entry entries to be created
 * (by the output JS) in a different order than they apear in the
 * interpreter instance being serialised.  If false, output may
 * contain placeholder entries like:
 *
 *     var obj = {};
 *     obj.foo = undefined;  // placeholder
 *     obj.bar = function() { ... };
 *
 * to allow obj.foo to be defined later while still
 * preserving property order.
 * @type {boolean|undefined}
 */
ContentEntry.prototype.reorder;

/**
 * A single node of a trie-like datastructure constructed from
 * ContentEntry path selectors.  It is used to determine in which
 * ConfigEntry a path is first mentioned in, so that e.g. $.foo can be
 * dumped to one file except for $.foo.bar which is held to be written
 * to a later file.
 * @constructor
 */
var ConfigNode = function() {
  /** @type {number|undefined} */
  this.firstFileNo = undefined;
  /** @type {!Object<string, !ConfigNode>} */
  this.kids = Object.create(null);
};

/**
 * @param {string} name
 * @return {ConfigNode}
 */
ConfigNode.prototype.kidFor = function(name) {
  if (!this.kids[name]) {
    this.kids[name] = new ConfigNode;
  }
  return this.kids[name];
};

/**
 * @constructor
 * @param {!Array<SpecEntry>} spec
 */
var Config = function(spec) {
  /** @type {!Array<!ConfigEntry>} */
  this.entries = [];
  /** @type {number|undefined} */
  this.defaultFileNo = undefined;
  /** @type {!ConfigNode} */
  this.tree = new ConfigNode;

  for (var fileNo = 0; fileNo < spec.length; fileNo++) {
    var /** !SpecEntry */ se = spec[fileNo];
    var /** !ConfigEntry */ entry = {
      filename: se.filename,
      contents: [],
      rest: Boolean(se.rest)
    };
    this.entries.push(entry);
    if (se.contents) {
      for (var i = 0; i < se.contents.length; i++) {
        var sc = se.contents[i];
        if (typeof sc === 'string') {
          var /** !ContentEntry */ content =
              {path: sc, do: Do.RECURSE, reorder: false};
        } else {
          content = {path: sc.path, do: sc.do, reorder: Boolean(sc.reorder)};
        }
        entry.contents.push(content);
        var selector = new Selector(content.path);
        var /** ?ConfigNode */ cn = this.tree;
        for (var j = 0; j < selector.length; j++) {
          var part = selector[j];
          if (typeof part !== 'string') {
            throw TypeError('Only simple selectors supported for Config');
          }
          cn = cn.kidFor(part);
        }
        // Now cn is final ConfigNode for path (often a leaf).
        cn.firstFileNo = fileNo;
      }
    }
    if (spec[fileNo].rest) {
      if (this.defaultFileNo !== undefined) {
        throw Error('Only one rest entry permitted');
      }
      this.defaultFileNo = fileNo;
    }
  }
};

///////////////////////////////////////////////////////////////////////////////
// Exports.

exports.Do = Do;
exports.dump = dump;

// For unit testing only!
exports.testOnly = {
  Dumper: Dumper,
}
