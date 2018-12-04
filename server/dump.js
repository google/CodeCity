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
 * @param {!Interpreter} pristine A pristine interpreter, initialised
 *     exactly as the one the ouptut JS will be executed by.
 * @param {!Array<SpecEntry>} spec The dump specificaiton.
 */
var dump = function(intrp, pristine, spec) {
  var dumper = new Dumper(intrp, pristine, spec);
};

///////////////////////////////////////////////////////////////////////////////
// Dumper.

/**
 * Dumper encapsulates all machinery to dump an Interpreter object to
 * eval-able JS, including maintaining all the dump-state info
 * required to keep track of what has and hasn't yet been dumped.
 * @constructor
 * @param {!Interpreter} intrp The interpreter to be dumped.
 * @param {!Interpreter} pristine A pristine interpreter, initialised
 *     exactly as the one the ouptut JS will be executed by.
 * @param {!Array<SpecEntry>} spec The dump specification.
 */
var Dumper = function(intrp, pristine, spec) {
  this.intrp = intrp;
  this.pristine = pristine;
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
  /** @type {!Interpreter.Owner} Perms at present point in output. */
  this.perms = intrp.ROOT;

  /**
   * Map from pristine objects to their corresponding intrp objects.
   * This is mainly for checking to see if builtins have had their
   * prototype or object-valued properties modified.
   * @type {!Map<!Interpreter.prototype.Object, !Interpreter.prototype.Object>}
   */
  var intrpObjs = new Map();
  // Initialise intrpObjs.
  var attrNames = ['writable', 'configurable', 'enumerable'];
  var builtins = pristine.builtins.keys();
  for (var i = 0; i < builtins.length; i++) {
    var builtin = builtins[i];
    var obj = intrp.builtins.get(builtin);
    var pobj = pristine.builtins.get(builtin);
    if (!(obj instanceof intrp.Object)) {
      continue;  // Skip primitive-valued builtins.
    } else if (pobj === undefined) {
      throw new Error('Builtin not found in pristine Interpreter');
    } else if (!(pobj instanceof pristine.Object)) {
      throw new Error('Builtin no longer an object in pristine Interpreter');
    }
    // TODO(cpcallen): add check for inconsistent duplicate
    // registrations - e.g., if parseInt and Number.parseInt were
    // the same in intrp but different in pristine.
    intrpObjs.set(pobj, obj);
  }

  // Create and initialise ObjectInfos for builtin objects.
  for (i = 0; i < builtins.length; i++) {
    builtin = builtins[i];
    obj = intrp.builtins.get(builtin);
    if (!(obj instanceof intrp.Object)) continue;  // Skip primitives.
    var oi = this.getObjectInfo(obj);
    pobj = pristine.builtins.get(builtin);
    // Record pre-set prototype.
    oi.proto = (pobj.proto === null) ? null : intrpObjs.get(pobj.proto);
    oi.doneProto = (obj.proto === oi.proto) ? Do.SET : Do.DECL;
    // Record pre-set owner.
    var owner = (pobj.owner === null) ? null :
        intrpObjs.get(/** @type{!Interpreter.prototype.Object} */(pobj.owner));
    oi.doneOwner = (obj.owner === /** @type{?Interpreter.Owner} */(owner)) ?
        Do.SET : Do.DECL;
    // Record pre-set property values/attributes.
    var keys = pobj.ownKeys(pristine.ROOT);
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      var pd = obj.getOwnPropertyDescriptor(key, intrp.ROOT);
      var ppd = pobj.getOwnPropertyDescriptor(key, pristine.ROOT);
      var doneAttrs = true;
      var attrs = {};
      for (var k = 0; k < attrNames.length; k++) {
        var attr = attrNames[k];
        attrs[attr] = ppd[attr];
        if (pd[attr] !== ppd[attr]) {
          doneAttrs = false;
        }
      }
      oi.attributes[key] = attrs;
      var value = ppd.value instanceof intrp.Object ?
          intrpObjs.get(ppd.value) : ppd.value;
      if (Object.is(pd.value, value)) {
        if (doneAttrs) {
          oi.setDone(key, Do.ATTR);
        } else {
          oi.setDone(key, Do.SET);
        }
      } else {
        oi.setDone(key, Do.DECL);
      }
    }
  }
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
 * @param {!Selector} selector The selector for the binding to be dumped.
 * @param {Do} todo How much to dump.  Must be >= Do.DECL.
 * @return {string} An eval-able program to initialise the specified binding.
 */
Dumper.prototype.dumpBinding = function(selector, todo) {
  if (selector.isVar()) {
    var ref = undefined;
    var info = this.getScopeInfo(this.scope);
  } else {
    ref = new Selector(selector);
    ref.pop();
    var obj = this.valueForSelector(ref);
    if (!(obj instanceof this.intrp.Object)) {
      throw new TypeError("Can't set properties of primitive");
    }
    info = this.getObjectInfo(obj);
  }
  var part = selector[selector.length - 1];
  return info.dumpBinding(this, part, todo);
};

/**
 * Get a source text representation of a given value.  The source text
 * will vary depending on the state of the dump; for instance, if the
 * value is an object that has not yet apepared in the dump it will be
 * represented by an expression creating the object - but if it has
 * appeared before, then it will instead be represented by an
 * expression referenceing the previously-constructed object.
 * @param {Interpreter.Value} value Arbitrary JS value from this.intrp.
 * @param {Selector=} selector Location in which value will be stored.
 * @param {boolean=} callable Return the expression suitably
 *     parenthesised to be used as the callee of a CallExpression.
 * @param {string=} funcName If supplied, and if value is an anonymous
 *     UserFuncion, then the returned expression is presumed to appear
 *     on the right hand side of an assignment statement such that the
 *     resulting Function object has its .name property automatically
 *     set to this value.
 * @return {string} An eval-able representation of the value.
 */
Dumper.prototype.exprFor = function(value, selector, callable, funcName) {
  var intrp = this.intrp;
  if (!(value instanceof intrp.Object)) {
    return this.exprForPrimitive(value);
  }

  // Return existing reference to object (if already created).
  var info = this.getObjectInfo(value);
  if (info.ref) return this.exprForSelector(info.ref);
  if (selector) info.ref = selector;  // Safe new ref if specified.

 // Object not yet referenced.  Is it a builtin?
  var key = intrp.builtins.getKey(value);
  if (key) {
    var quoted = code.quote(key);
    return callable ? '(new ' + quoted + ')' : 'new ' + quoted;
  }
  // New object.  Create and save referece for later use.
  if (!selector) throw Error('Refusing to create non-referable object');
  var expr;
  if (value instanceof intrp.Function) {
    expr = this.exprForFunction(value, info, funcName);
  } else if (value instanceof intrp.Array) {
    expr = this.exprForArray(value, info);
  } else if (value instanceof intrp.Date) {
    expr = this.exprForDate(value, info);
  } else if (value instanceof intrp.RegExp) {
    expr = this.exprForRegExp(value, info);
  } else if (value instanceof intrp.Error) {
    expr = this.exprForError(value, info);
  } else if (value instanceof intrp.WeakMap) {
    // TODO(cpcallen)
    throw new Error('WeakMap dumping not implemented');
    // expr = this.exprForWeakMap(value, info);
  } else {
    expr = this.exprForObject(value, info);
  }
  // Do we need to set [[Prototype]]?  Not if it's already correct.
  if (info.proto == value.proto) info.doneProto = Do.SET;
  // Do we need to set [[Owner]]?  Not if it's already correct.
  if (value.owner === this.perms) info.doneOwner = Do.SET;
  return expr;
};

/**
 * Get a source text representation of a given primitive value (not
 * including symbols).  Correctly handles having Infinity, NaN and/or
 * undefiend shadowed by binding in the current scope.
 * @param {undefined|null|boolean|number|string} value Primitive JS value.
 * @return {string} An eval-able representation of the value.
 */
Dumper.prototype.exprForPrimitive = function(value) {
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
        throw TypeError('exprForPrimitive called on non-primitive value');
      }
  }
};

/**
 * Get a source text representation of a given Object.  May or may not
 * include all properties, etc.
 * @param {!Interpreter.prototype.Object} obj Object to be recreated.
 * @param {!ObjectInfo} info Dump-state info about obj.
 * @return {string} An eval-able representation of obj.
 */
Dumper.prototype.exprForObject = function(obj, info) {
  switch (obj.proto) {
    case null:
      info.proto = null;
      return 'Object.create(null)';
    case this.intrp.OBJECT:
      info.proto = this.intrp.OBJECT;
      return '{}';
    default:
      var protoInfo = this.getObjectInfo(obj.proto);
      if (protoInfo.ref) {
        info.proto = obj.proto;
        return 'Object.create(' + this.exprFor(obj.proto) + ')';
      } else {
        // Can't set [[Prototype]] yet.  Do it later.
        info.proto = this.intrp.OBJECT;
        return '{}';
      }
  }
};

/**
 * Get a source text representation of a given Function object.
 * @param {!Interpreter.prototype.Function} func Function object to be
 *     recreated.
 * @param {!ObjectInfo} info Dump-state info about func.
 * @param {string=} funcName If supplied, and if value is an anonymous
 *     UserFuncion, then the returned expression is presumed to appear
 *     on the right hand side of an assignment statement such that the
 *     resulting Function object has its .name property automatically
 *     set to this value.
 * @return {string} An eval-able representation of func.
 */
Dumper.prototype.exprForFunction = function(func, info, funcName) {
  if (!(func instanceof this.intrp.UserFunction)) {
    throw Error('Unable to dump non-UserFunction');
  }
  info.proto = this.intrp.FUNCTION;  // TODO(ES6): generators, etc.?
  // The .length property will be set implicitly (and is immutable).
  info.attributes['length'] =
      {writable: false, enumerable: false, configurable: false};
  info.setDone('length', Do.ATTR);
  // The .name property is often set automatically.
  // TODO(ES6): Handle prefix?
  if (funcName === undefined && func.node['id']) {
    funcName = func.node['id']['name'];
  }
  if (funcName) {
    var attr = info.attributes['name'] =
        {writable: false, enumerable: false, configurable: true};
    var pd = func.getOwnPropertyDescriptor('name', this.intrp.ROOT);
    if (pd) {
      info.checkProperty('name', funcName, attr , pd);
    } else {
      info.scheduleDeletion('name');
    }
  }
  // The .prototype property will automatically be created, so we
  // don't need to "declare" it.  Fortunately it's non-configurable,
  // so we don't need to worry that it might need to be deleted.
  info.attributes['prototype'] =
      {writable: true, enumerable: false, configurable: false};
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
      // We can use automatic .prototype object.
      prototypeInfo.ref = new Selector(info.ref.concat('prototype'));
      info.setDone('prototype', Do.SET);
      // It gets a .constructor property, which may or may not need to
      // be overwritten.
      prototypeInfo.attributes['constructor'] =
          {writable: true, enumerable: false, configurable: true};
      var constructorValue = prototype.get('constructor', this.intrp.ROOT);
      prototypeInfo.setDone('constructor',
          constructorValue === func ? Do.SET : Do.DECL);
    }
  }
  return func.toString();
};

/**
 * Get a source text representation of a given Array object.
 * @param {!Interpreter.prototype.Array} arr Array object to be recreated.
 * @param {!ObjectInfo} info Dump-state info about arr.
 * @return {string} An eval-able representation of arr.
 */
Dumper.prototype.exprForArray = function(arr, info) {
  info.proto = this.intrp.ARRAY;
  var root = this.intrp.ROOT;
  var lastIndex = arr.get('length', root) - 1;
  info.attributes['length'] =
      {writable: true, enumerable: false, configurable: false};
  if (lastIndex < 0 || arr.getOwnPropertyDescriptor(String(lastIndex),  root)) {
    // No need to set .length if it will be set via setting final index.
    info.setDone('length', Do.ATTR);
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
 * @return {string} An eval-able representation of date.
 */
Dumper.prototype.exprForDate = function(date, info) {
  info.proto = this.intrp.DATE;
  // BUG(cpcallen): Don't assume Date constructor is already dumped.
  return 'new ' + this.exprForBuiltin('Date') +
      "('" + date.date.toISOString() + "')";
};

/**
 * Get a source text representation of a given RegExp object.
 * @param {!Interpreter.prototype.RegExp} re RegExp to be recreated.
 * @param {!ObjectInfo} info Dump-state info about re.
 * @return {string} An eval-able representation of re.
 */
Dumper.prototype.exprForRegExp = function(re, info) {
  info.proto = this.intrp.REGEXP;
  // Some properties are implicitly pre-set.
  var props = ['source', 'global', 'ignoreCase', 'multiline'];
  for (var prop, i = 0; prop = props[i]; i++) {
    info.attributes[prop] =
        {writable: false, enumerable: false, configurable: false};
    info.setDone(prop, Do.ATTR);
  }
  info.attributes['lastIndex'] =
      {writable: true, enumerable: false, configurable: false};
  if (Object.is(re.get('lastIndex', this.intrp.ROOT), 0)) {
    // Can skip setting .lastIndex iff it is 0.
    info.setDone('lastIndex', Do.ATTR);
  } else {
    info.setDone('lastIndex', Do.DECL);
  }
  return re.regexp.toString();
};

/**
 * Get a source text representation of a given Error object.
 * @param {!Interpreter.prototype.Error} error Error object to be recreated.
 * @param {!ObjectInfo} info Dump-state info about error.
 * @return {string} An eval-able representation of error.
 */
Dumper.prototype.exprForError = function(error, info) {
  info.proto = error.proto;
  var constructor;
  if (error.proto === this.intrp.EVAL_ERROR) {
    constructor = 'EvalError';
  } else if (error.proto === this.intrp.RANGE_ERROR) {
    constructor = 'RangeError';
  } else if (error.proto === this.intrp.REFERENCE_ERROR) {
    constructor = 'ReferenceError';
  } else if (error.proto === this.intrp.SYNTAX_ERROR) {
    constructor = 'SyntaxError';
  } else if (error.proto === this.intrp.TYPE_ERROR) {
    constructor = 'TypeError';
  } else if (error.proto === this.intrp.URI_ERROR) {
    constructor = 'URIError';
  } else if (error.proto === this.intrp.PERM_ERROR) {
    constructor = 'PermissionError';
  } else {
    constructor = 'Error';
    info.proto = this.intrp.ERROR;
  }
  // Try to set .message in the constructor call.
  var message = error.getOwnPropertyDescriptor('message', this.intrp.ROOT);
  var messageExpr = '';
  if (message &&
      (typeof message.value === 'string' || message.value === undefined)) {
    messageExpr = this.exprFor(message.value);
    var attr = info.attributes['message'] =
        {writable: true, enumerable: false, configurable: true};
    info.checkProperty('message', message.value, attr , message);
  }
  // The .stack property is always created, and we always want to
  // overwrite (or delete) it.
  info.attributes['stack'] =
      {writable: true, enumerable: false, configurable: true};
  var stack = error.getOwnPropertyDescriptor('stack', this.intrp.ROOT);
  if (stack) {
    info.setDone('stack', Do.DECL);
  } else {
    info.scheduleDeletion('stack');
  }
  return 'new ' + this.exprForBuiltin(constructor) + '(' + messageExpr + ')';
};

/**
 * Get a source text representation of a given builtin, for the
 * purposes of calling it.
 * @param {string} builtin The name of the builtin.
 * @return {string} An eval-able representation of obj.
 */
Dumper.prototype.exprForBuiltin = function(builtin) {
  return this.exprFor(this.intrp.builtins.get(builtin), undefined, true);
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
    var obj = this.valueForSelector(ref);
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
 * Get a source text representation of a given selector.  In general,
 * given Selector s and Dumper d, d.exprForSelector(s) will be the
 * same as s.toExpr() except when the output needs to call a builtin
 * function like Object.getPrototypeOf that is not available via its
 * usual name.
 * @param {Selector=} selector Selector to obtain value of.
 * @return {string} An eval-able representation of the value.
 */
Dumper.prototype.exprForSelector = function(selector) {
  var dumper = this;
  return selector.toString(function(part, out) {
    if (part === Selector.PROTOTYPE) {
      out.unshift(dumper.exprForBuiltin('Object.getPrototypeOf'), '(');
      out.push(')');
    } else if (part === Selector.OWNER) {
      out.unshift(dumper.exprForBuiltin('Object.getOwnerOf'), '(');
      out.push(')');
    } else {
      throw new TypeError('Invalid part in parts array');
    }
  });
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
Dumper.prototype.valueForSelector = function(selector, scope) {
  if (!scope) scope = this.intrp.global;
  if (selector.length < 1) throw RangeError('Zero-length selector??');
  var varname = selector[0];
  if (typeof varname !== 'string') throw TypeError('Invalid first part??');
  var /** Interpreter.Value */ v = scope.get(varname);
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
    } else if (part === Selector.OWNER) {
      v = /** @type{?Interpreter.prototype.Object} */(v.owner);
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

///////////////////////////////////////////////////////////////////////////////
// ScopeInfo

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
  this.doneVar_ = Object.create(null);
};

/**
 * Generate JS source text to create and/or initialize a single
 * variable binding.
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
  // TODO(cpcallen): don't recreate a Selector that our caller^3 already has?
  var sel = new Selector([part]);
  var done = this.getDone(part);
  var value = this.scope.get(part);
  var output = [];

  if (todo >= Do.DECL && done < todo) {
    if (done < Do.DECL) output.push('var ');
    if (done < Do.SET) {
      output.push(part);
      if (todo >= Do.SET) {
        output.push(' = ', dumper.exprFor(value, sel, false, part));
      }
      output.push(';\n');
    }
  }
  if (todo >= Do.RECURSE && done < Do.RECURSE) {
    if (value instanceof dumper.intrp.Object) {
      var vi = dumper.getObjectInfo(value);
      output.push(vi.dumpRecursively(dumper, sel));
    }
  }
  // Record completion.
  this.setDone(part, todo);
  return output.join('');
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
  return this.doneVar_[part] || Do.UNSTARTED;
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
  this.doneVar_[part] = done;
};

///////////////////////////////////////////////////////////////////////////////
// ObjectInfo

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
  /** @type {boolean} Is object being visited in a recursive dump? */
  this.visiting = false;
  /** @type {!Do} Has prototype been set? */
  this.doneProto = Do.DECL;  // Never need to 'declare' the [[Prototype]] slot!
  /**
   * Current value of [[Prototype]] slot of obj at this point in dump.
   * Typically initially Object.prototype (or similar); will be ===
   * obj.proto when complete.  Used to check for unwritable inherited
   * properties when attempting to set properties by assignment.
   * Should only be undefined if object has not yet been created.
   * @type {?Interpreter.prototype.Object|undefined}
   */
  this.proto = undefined;
  /** @type {!Do} Has owner been set? */
  this.doneOwner = Do.DECL;  // Never need to 'declare' that object has owner!
  /** @type {!Object<string, Do>} Map of property name -> dump status. */
  this.doneProp_ = Object.create(null);
  /**
   * Map of property name -> property descriptor, where property
   * descriptor is a map of attribute names (writable, enumerable,
   * configurable, more tbd) to boolean values.  (We do not store
   * values here.)
   * @type {!Object<string, !Object<string, boolean>>}
   */
  this.attributes = Object.create(null);
  /** @type {?Array<string>} Properties to delete. */
  this.toDelete = null;
};

/**
 * Updates done state of property binding after defining/assigning a
 * property.  This computes the new done value, calls .setDone(key,
 * done) and returns the new value.
 * @param {string} key The property key just updated.
 * @param {Interpreter.Value} value The value just assigned to the property.
 * @param {!Object<string, boolean>} attr The property's current attributes.
 * @param {!Interpreter.Descriptor|undefined} pd Property descriptor
 *     returned by calling this.obj.getOwnPropertyDescriptor(key, ...).
 * @return {!Do} New done state.
 */
ObjectInfo.prototype.checkProperty = function(key, value, attr, pd) {
  if (!Object.is(value, pd.value)) {
    var done = Do.DECL;
  } else if (attr.writable === pd.writable &&
      attr.enumerable === pd.enumerable &&
      attr.configurable === pd.configurable) {
    done = Do.ATTR;
  } else {
    done = Do.SET;
  }
  this.setDone(key, done);
  return done;
};

/**
 * Generate JS source text to set the object's prototype.
 * @private
 * @param {!Dumper} dumper Dumper to which this ObjectInfo belongs.
 * @param {Do} todo How much to do.  '' returned if todo < Do.RECURSE.
 * @param {!Selector} ref Selector refering to this object.
 * @param {!Selector.Part} part The binding part that has been dumped
 *     and which might need to be recursed into.
 * @param {Interpreter.Value} value The value of the specified part.
 *     '' returned if value not an Interpreter.prototype.Object.
 * @return {string} An eval-able program to initialise the specified binding.
 */
ObjectInfo.prototype.checkRecurse_ = function(dumper, todo, ref, part, value) {
  var output = [];
  if (todo >= Do.RECURSE) {
    if (value instanceof dumper.intrp.Object) {
      var sel = new Selector(ref);
      sel.push(part);
      var vi = dumper.getObjectInfo(value);
      output.push(vi.dumpRecursively(dumper, sel));
    }
    // Record completion.
    this.setDone(part, todo);
  }
  return output.join('');
};

/**
 * Generate JS source text to create and/or initialize a single
 * binding (property or internal slot) of the object.
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
  } else if (part === Selector.OWNER) {
    return this.dumpOwner_(dumper, todo, ref);
  } else if (typeof part === 'string') {
    return this.dumpProperty_(dumper, part, todo, ref);
  } else {
    throw new Error('Invalid part');
  }
};

/**
 * Generate JS source text to set the object's owner.
 * @private
 * @param {!Dumper} dumper Dumper to which this ObjectInfo belongs.
 * @param {Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Selector} ref Selector refering to this object.
 * @return {string} An eval-able program to initialise the specified binding.
 */
ObjectInfo.prototype.dumpOwner_ = function(dumper, todo, ref) {
  // TODO(cpcallen): don't recreate a Selector that our caller^3 already has?
  var sel = new Selector(ref);
  sel.push(Selector.OWNER);
  var output = [];
  var value = /** @type {?Interpreter.prototype.Object} */(this.obj.owner);
  if (todo >= Do.SET && this.doneOwner < Do.SET) {
    output.push(dumper.exprForBuiltin('Object.setOwnerOf'), '(',
                dumper.exprForSelector(ref), ', ',
                dumper.exprFor(value, sel), ');\n');
    this.doneOwner = Do.SET;
  }
  output.push(
      this.checkRecurse_(dumper, todo, ref, Selector.OWNER, value));
  return output.join('');
};

/**
 * Generate JS source text to create and/or initialize a single
 * binding (property or internal slot) of the object.  The output will
 * consist of:

 * - An assignment statement to create the property and/or set its
 *   value, if necessary and possible.
 * - A call to Object.defineProperty, to set the property's attributes
 *   (and value, if the value couldn't be set by assignement), if
 *   necessary.
 * - Any code generated because of recursive dumping.
 * @private
 * @param {!Dumper} dumper Dumper to which this ObjectInfo belongs.
 * @param {string} key The property to dump.
 * @param {Do} todo How much to do.
 * @param {!Selector} ref Selector refering to this object.
 * @return {string} An eval-able program to initialise the specified binding.
 */
ObjectInfo.prototype.dumpProperty_ = function(dumper, key, todo, ref) {
  // TODO(cpcallen): don't recreate a Selector that our caller^3 already has?
  var sel = new Selector(ref);
  sel.push(key);
  var pd = this.obj.getOwnPropertyDescriptor(key, dumper.intrp.ROOT);
  if (!pd) throw new RangeError("Can't dump nonexistent property " + sel);
  var output = [];

  // Do this binding, if requested.
  var done = this.getDone(key);
  if (todo >= Do.DECL && todo > done && done < Do.ATTR) {
    var attr = this.attributes[key];
    // If only "declaring" property, set it to undefined.
    var value = (todo === Do.DECL) ? undefined : pd.value;

    // Output assignment statement if useful.
    if (done < Do.SET && this.isWritable(dumper, key)) {
      if (!attr) {
        attr = this.attributes[key] =
            {writable: true, enumerable: true, configurable: true};
      }
      // Will this assignemnt set the .name of an anonymous function?
      // TODO(ES6): Handle prefix?
      var funcName = dumper.pristine.options.methodNames ? key : undefined;
      output.push(dumper.exprForSelector(sel), ' = ',
                  dumper.exprFor(value, sel, false, funcName), ';\n');
      done = this.checkProperty(key, value, attr, pd);
    }

    // Output defineProperty call if useful.
    if (todo > done && done < Do.ATTR) {
      if (!attr) {
        attr = this.attributes[key] =
            {writable: false, enumerable: false, configurable: false};
      } else if (!attr.configurable) {
        throw new Error("Can't redefine non-configurable property " + sel);
      }
      var items = [];
      if (attr.writable !== (pd.writable || todo < Do.SET)) {
        attr.writable = pd.writable || todo < Do.SET;
        items.push('writable: ' +  attr.writable);
      }
      if (attr.enumerable !== (pd.enumerable || todo < Do.SET)) {
        attr.enumerable = pd.enumerable || todo < Do.SET;
        items.push('enumerable: ' + attr.enumerable);
      }
      if (attr.configurable !== (pd.configurable || todo < Do.SET)) {
        attr.configurable = pd.configurable || todo < Do.SET;
        items.push('configurable: ' + attr.configurable);
      }
      if (todo >= Do.SET && done < Do.SET) {
        items.push('value: ' + dumper.exprFor(value));
      }
      output.push(dumper.exprForBuiltin('Object.defineProperty'), '(',
                  dumper.exprForSelector(ref), ', ', dumper.exprFor(key),
                  ', {', items.join(', '), '});\n');
      done = this.checkProperty(key, value, attr, pd);
    }
  }

  output.push(this.checkRecurse_(dumper, todo, ref, key, pd.value));
  return output.join('');
};

/**
 * Generate JS source text to set the object's prototype.
 * @private
 * @param {!Dumper} dumper Dumper to which this ObjectInfo belongs.
 * @param {Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Selector} ref Selector refering to this object.
 * @return {string} An eval-able program to initialise the specified binding.
 */
ObjectInfo.prototype.dumpPrototype_ = function(dumper, todo, ref) {
  // TODO(cpcallen): don't recreate a Selector that our caller^3 already has?
  var sel = new Selector(ref);
  sel.push(Selector.PROTOTYPE);
  var output = [];
  var value = this.obj.proto;
  if (todo >= Do.SET && this.doneProto < Do.SET) {
    output.push(dumper.exprForBuiltin('Object.setPrototypeOf'), '(',
                dumper.exprForSelector(ref), ', ',
                dumper.exprFor(value, sel), ');\n');
    this.proto = value;
    this.doneProto = Do.SET;
  }
  output.push(
      this.checkRecurse_(dumper, todo, ref, Selector.PROTOTYPE, value));
  return output.join('');
};

/**
 * Recursively dumps all bindings of the object (and objects reachable
 * via it).
 * @param {!Dumper} dumper Dumper to which this ObjectInfo belongs.
 * @param {!Selector=} ref Selector refering to this object.
 *     Optional; defaults to whatever selector was used to create the
 *     object.
 * @return {string} An eval-able program to initialise the specified binding.
 */
ObjectInfo.prototype.dumpRecursively = function(dumper, ref) {
  if (this.visiting) return '';
  this.visiting = true;
  if (!this.ref || this.proto === undefined) {
    throw new Error("Can't dump an uncreated object");
  }
  if (!ref) ref = this.ref;
  var output = [];
  // Delete properties that shouldn't exist.
  if (this.toDelete) {
    var sel = new Selector(this.ref);
    for (var key, i = 0; key = this.toDelete[i]; i++) {
      sel.push(key);
      output.push('delete ', dumper.exprForSelector(sel), ';\n');
      sel.pop();
    }
  }
  // Dump prototype.
  if (this.doneProto < Do.RECURSE) {
    output.push(this.dumpPrototype_(dumper, Do.RECURSE, ref));
  }
  // Dump owner.
  if (this.doneOwner < Do.RECURSE) {
    output.push(this.dumpOwner_(dumper, Do.RECURSE, ref));
  }
  // Dump properties.
  var keys = this.obj.ownKeys(dumper.intrp.ROOT);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.getDone(key) >= Do.RECURSE) continue;  // Skip already-done.
    output.push(this.dumpProperty_(dumper, key, Do.RECURSE, ref));
  }
  // TODO(cpcallen): Dump internal elements.
  // Dump extensibility.
  if (!this.obj.isExtensible(dumper.intrp.ROOT)) {
    output.push(dumper.exprForBuiltin('Object.preventExtensions'), '(',
                dumper.exprForSelector(ref), ');\n');
  }
  this.visiting = false;
  return output.join('');
};

/**
 * Return the current 'done' status of an object binding.
 * @param {!Selector.Part} part The part to get status for.
 * @return {Do} The done status of the binding.
 */
ObjectInfo.prototype.getDone = function(part) {
  if (part === Selector.PROTOTYPE) {
    return this.doneProto;
  } else if (part === Selector.OWNER) {
    return this.doneOwner;
  } else if (typeof part === 'string') {
    return this.doneProp_[part] || Do.UNSTARTED;
  } else {
    throw new TypeError('Invalid part');
  }
};

/**
 * Return true iff the specifed property can be created or set by
 * assignment - i.e., that it exists and is writable, or doesn't exist
 * and doe snot inherit from a non-writable property on the prototype
 * chain.
 * @param {!Dumper} dumper Dumper to which this ObjectInfo belongs.
 * @param {string} key The property key to check for writability of.
 * @return {boolean} True iff the property can be set by assignment.
 */
ObjectInfo.prototype.isWritable = function(dumper, key) {
  // Invariant checks.
  if (this.proto === undefined) {
    throw new Error('Checking writability of property on non-created object');
  } else if ((key in this.attributes) !== (this.getDone(key) >= Do.DECL)) {
    throw new Error('Attribute / done mismatch');
  }
  if (key in this.attributes) {
    return this.attributes[key].writable;
  } else {
    if (this.proto === null) {
      return true;
    } else {
      return dumper.getObjectInfo(this.proto).isWritable(dumper, key);
    }
  }
};

/**
 * Record that the (ressurected) object will have a property, not on the original, that needs to be deleted.
 * @param {string} key The property key to delete.
 */
ObjectInfo.prototype.scheduleDeletion = function(key) {
  if (this.toDelete) {
    this.toDelete.push(key);
  } else {
    this.toDelete = [key];
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
  var old = this.getDone(part);
  var name = (part === Selector.PROTOTYPE) ? 'prototype' : '.' + part;

  // Invariant checks.
  if (done < old) {
    throw new RangeError("Can't undo work on " + name);
  } else if(done === old) {
    throw new RangeError('Redundant work on ' + name);
  }
  // Do set.
  if (part === Selector.PROTOTYPE) {
    this.doneProto = done;
  } else if (part === Selector.OWNER) {
    this.doneOwner = done;
  } else if (typeof part === 'string') {
    this.doneProp_[part] = done;
  }
};

///////////////////////////////////////////////////////////////////////////////
// Do, etc.

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
   * Ensure that the specified binding exists and has been set to its
   * final value (if primitive) or an object of the correct class (if
   * non-primitive).
   *
   * For property bindings, the property attributes will generally not
   * (yet) be set, and if a new object was created to be the value of
   * the specified binding it will generally not (yet) have its
   * properties or internal set/map data set (but immutable internal
   * data, such as function code, will have been set at creation).
   *
   * Possibly only useful as a 'done' value; prefer SET for 'do'
   * values.
   */
  SET: 4,

  /**
   * Ensure theat the specified binding has been set to its final
   * value, and additionally that the final property attributes
   * (enumerable, writable and/or configurable) are set.
   */
  ATTR: 5,

  /**
   * Ensure the specified path is has been set to its final value (and
   * marked immuable, if applicable) and that the same has been done
   * recursively to all bindings reachable via path.
   */
  RECURSE: 6,
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
