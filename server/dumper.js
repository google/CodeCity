/**
 * @license
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
 * @fileoverview The Dumper class (and related helpers) to diff the
 *     state of (parts or all of) two Interpreter objects, outputing
 *     eval-able JS code to convert the one into the other.  eval-able
 *     JS.
 * @author cpcallen@google.com (Christohper Allen)
 */
'use strict';

var code = require('./code');
var Interpreter = require('./interpreter');
var Selector = require('./selector');

///////////////////////////////////////////////////////////////////////////////
// Dumper.

/**
 * Dumper compares the state of two Interpreter instances, for the
 * purpose of generating eval-able JS that would update part or all(*)
 * of the first to the same state as the second.  This can be used to
 * dump the state of an Interpreter by comparing it against a pristine
 * Interpreter instance, or to produce a software patch by comparing a
 * long-running Interpreter against a previous version of itself or
 * against the target to which the patch will be applied.
 *
 * (*) Limitations: since there is no way to construct arbitrary stack
 * frames by evaling JS source code, it is not at present possible to
 * dump the state of threads.  This could be rectified in future by
 * providing host functions for creating/modifying the stack frames
 * associated with Thread objects.
 *
 * @constructor
 * @param {!Interpreter} intrp1 An interpreter initialised exactly as
 *     the one the ouptut JS will be executed by.
 * @param {!Interpreter} intrp2 An interpreter containing state
 *     modifications (relative to intrp1) to be dumped.
 */
var Dumper = function(intrp1, intrp2) {
  this.intrp1 = intrp1;
  this.intrp2 = intrp2;
  /** @const {!Map<!Interpreter.Scope,!ScopeDumper>} */
  this.scopeDumpers = new Map();
  /** @const {!Map<!Interpreter.prototype.Object,!ObjectDumper>} */
  this.objDumpers2 = new Map();
  /**
   * Map of Arguments objects to the ScopeDumpers for the scopes to
   * which they belong.
   * @const {!Map<!Interpreter.prototype.Arguments,!ScopeDumper>}
   */
  this.argumentsScopeDumpers = new Map();
  /**
   * Set of Scope/Object dumpers currently being recursively surveyed/dumped.
   * @const {!Set<(!ScopeDumper|!ObjectDumper)>}
   */
  this.visiting = new Set();
  /**
   * Which scope are we presently outputting code in the context of?
   * @type {!Interpreter.Scope}
   */
  this.scope = intrp2.global;
  /** @type {!Interpreter.Owner} Perms at present point in output. */
  this.perms = intrp2.ROOT;
  /** @const {!Array<string>} Accumulated output for the current file. */
  this.output = [];  // TODO(cpcallen): use Buffer or Uint8Array?
  /**
   * Map from objects from intrp1 to corresponding objects in intrp2.
   * @type {!Map<?Interpreter.prototype.Object, ?Interpreter.prototype.Object>}
   */
  this.objs1to2 = new Map();

  this.diffBuiltins();

  // Create and initialise ScopeDumper for global scope.
  var globalDumper = this.getScopeDumper(intrp2.global);
  for (var v in intrp1.global.vars) {
    var val1 = intrp1.global.get(v);
    var val2 = intrp2.global.get(v);
    var val1in2;
    if (val1 instanceof intrp1.Object) {
      if (!(val2 instanceof intrp2.Object)) {
        throw new TypeError('Primitive / object mistmatch');
      }
      val1in2 = this.objs1to2.get(val1);
    } else {
      val1in2 = val1;
    }
    if (Object.is(val1in2, val2)) {
      globalDumper.setDone(v,
                           (typeof val2 === 'object') ? Do.DONE : Do.RECURSE);
      if (val2 instanceof intrp2.Object) {
        this.getObjectDumper(val2).ref = new Selector(v);
        // Other initialialisation will be taken care of below.
      }
    }
  }

  // Survey objects accessible via global scope to find their outer scopes.
  globalDumper.survey(this);
};

/**
 * Diff the values of buit-ins.
 */
Dumper.prototype.diffBuiltins = function() {
  // Initialise intrpObjs.
  var builtins = this.intrp1.builtins.keys();
  for (var i = 0; i < builtins.length; i++) {
    var builtin = builtins[i];
    var obj1 = this.intrp1.builtins.get(builtin);
    var obj2 = this.intrp2.builtins.get(builtin);
    if (!(obj2 instanceof this.intrp2.Object)) {
      continue;  // Skip primitive-valued builtins.
    } else if (obj1 === undefined) {
      throw new Error('Builtin not found in intrp1 Interpreter');
    } else if (!(obj1 instanceof this.intrp1.Object)) {
      throw new Error("Builtin wasn't an object originally");
    }
    // TODO(cpcallen): add check for inconsistent duplicate
    // registrations - e.g., if parseInt and Number.parseInt were
    // the same in intrp2 but different in intrp1.
    this.objs1to2.set(obj1, obj2);
  }

  // Create and initialise ObjectDumpers for builtin objects.
  for (var i = 0; i < builtins.length; i++) {
    builtin = builtins[i];
    obj2 = this.intrp2.builtins.get(builtin);
    if (!(obj2 instanceof this.intrp2.Object)) continue;  // Skip primitives.
    var objDumper = this.getObjectDumper(obj2);
    obj1 = this.intrp1.builtins.get(builtin);
    // Record pre-set prototype.
    objDumper.proto =
        (obj1.proto === null) ? null : this.objs1to2.get(obj1.proto);
    if (obj2.proto === objDumper.proto) {
      objDumper.setDone(Selector.PROTOTYPE,
                        (obj2.proto === null) ? Do.RECURSE : Do.DONE);
    }
    // Record pre-set owner.
    var owner = /** @type{?Interpreter.Owner} */(
        (obj1.owner === null) ? null : this.objs1to2.get(
            /** @type{?Interpreter.prototype.Object} */(obj1.owner)));
    if (obj2.owner === owner) {
      objDumper.setDone(Selector.OWNER,
                        (obj2.owner === null) ? Do.RECURSE : Do.DONE);
    }
    // Record pre-set property values/attributes.
    var keys = obj1.ownKeys(this.intrp1.ROOT);
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      var pd1 = obj1.getOwnPropertyDescriptor(key, this.intrp1.ROOT);
      var pd2 = obj2.getOwnPropertyDescriptor(key, this.intrp2.ROOT);
      var attrs = {
        writable: pd1.writable,
        enumerable: pd1.enumerable,
        configurable: pd1.configurable
      };
      objDumper.attributes[key] = attrs;
      var value = pd1.value instanceof this.intrp2.Object ?
          this.objs1to2.get(pd1.value) : pd1.value;
      objDumper.checkProperty(key, value, attrs, pd2);
    }
  }
};

/**
 * Mark a particular binding (as specified by a Selector) with a
 * certain done value (which, notably in the case of Do.PRUNE and
 * Do.SKIP has the effect of causing subequent recursive dumps to
 * ignore that property).
 * @param {!Selector} selector The selector for the binding to be deferred.
 * @param {!Do} done Do status to mark binding with.
 */
Dumper.prototype.markBinding = function(selector, done) {
  var c = this.getComponentsForSelector(selector);
  var was = c.dumper.getDone(c.part);
  if (was !== done) c.dumper.setDone(c.part, done);
};

/**
 * Generate JS source text to declare and optionally initialise a
 * particular binding (as specified by a Selector).  The generated
 * source text is written to the current output file and returned.
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
 * @param {!Do} todo How much to dump.  Must be >= Do.DECL.
 * @return {string} An eval-able program to initialise the specified binding.
 */
Dumper.prototype.dumpBinding = function(selector, todo) {
  var preLength = this.output.length;
  var c = this.getComponentsForSelector(selector);
  if (c.dumper.getDone(c.part) === Do.SKIP) {
    c.dumper.setDone(c.part, Do.UNSTARTED);
  }
  c.dumper.dumpBinding(this, c.part, todo);
  return this.output.slice(preLength).join('');
};

/**
 * Get a source text representation of a given value.  The source text
 * will vary depending on the state of the dump; for instance, if the
 * value is an object that has not yet apepared in the dump it will be
 * represented by an expression creating the object - but if it has
 * appeared before, then it will instead be represented by an
 * expression referenceing the previously-constructed object.
 * @param {Interpreter.Value} value Arbitrary JS value from this.intrp2.
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
  var intrp2 = this.intrp2;
  if (!(value instanceof intrp2.Object)) {
    return this.exprForPrimitive(value);
  }

  // Return existing reference to object (if already created).
  var objDumper = this.getObjectDumper(value);
  if (objDumper.ref) return this.exprForSelector(objDumper.ref);
  if (selector) objDumper.ref = selector;  // Safe new ref if specified.

 // Object not yet referenced.  Is it a builtin?
  var key = intrp2.builtins.getKey(value);
  if (key) {
    var quoted = code.quote(key);
    return callable ? '(new ' + quoted + ')' : 'new ' + quoted;
  }
  // New object.  Create and save referece for later use.
  if (!selector) throw Error('Refusing to create non-referable object');
  var expr;
  if (value instanceof intrp2.Function) {
    expr = this.exprForFunction(value, objDumper, funcName);
  } else if (value instanceof intrp2.Array) {
    expr = this.exprForArray(value, objDumper);
  } else if (value instanceof intrp2.Date) {
    expr = this.exprForDate(value, objDumper);
  } else if (value instanceof intrp2.RegExp) {
    expr = this.exprForRegExp(value, objDumper);
  } else if (value instanceof intrp2.Error) {
    expr = this.exprForError(value, objDumper);
  } else if (value instanceof intrp2.WeakMap) {
    // TODO(cpcallen)
    throw new Error('WeakMap dumping not implemented');
    // expr = this.exprForWeakMap(value, objDumper);
  } else {
    expr = this.exprForObject(value, objDumper);
  }
  // Do we need to set [[Prototype]]?  Not if it's already correct.
  if (value.proto === objDumper.proto) {
    objDumper.setDone(Selector.PROTOTYPE,
                      (value.proto === null) ? Do.RECURSE : Do.DONE);
  }
  // Do we need to set [[Owner]]?  Not if it's already correct.
  if (value.owner === this.perms) {
    objDumper.setDone(Selector.OWNER,
                      (value.owner === null) ? Do.RECURSE : Do.DONE);
  }
  return expr;
};

/**
 * Get a source text representation of a given Array object.
 * @param {!Interpreter.prototype.Array} arr Array object to be recreated.
 * @param {!ObjectDumper} arrDumper ObjectDumper for arr.
 * @return {string} An eval-able representation of arr.
 */
Dumper.prototype.exprForArray = function(arr, arrDumper) {
  arrDumper.proto = this.intrp2.ARRAY;
  var root = this.intrp2.ROOT;
  var lastIndex = arr.get('length', root) - 1;
  arrDumper.attributes['length'] =
      {writable: true, enumerable: false, configurable: false};
  if (lastIndex < 0 || arr.getOwnPropertyDescriptor(String(lastIndex),  root)) {
    // No need to set .length if it will be set via setting final index.
    arrDumper.setDone('length', Do.RECURSE);
  } else {
    // Length exists; don't worry about it when preserving propery order.
    arrDumper.setDone('length', Do.DECL);
  }
  return '[]';
};

/**
 * Get a source text representation of a given builtin, for the
 * purposes of calling it.
 * @param {string} builtin The name of the builtin.
 * @return {string} An eval-able representation of obj.
 */
Dumper.prototype.exprForBuiltin = function(builtin) {
  return this.exprFor(this.intrp2.builtins.get(builtin), undefined, true);
};

/**
 * Get a source text representation of a given Date object.
 * @param {!Interpreter.prototype.Date} date Date object to be recreated.
 * @param {!ObjectDumper} dateDumper ObjectDumper for date.
 * @return {string} An eval-able representation of date.
 */
Dumper.prototype.exprForDate = function(date, dateDumper) {
  dateDumper.proto = this.intrp2.DATE;
  return 'new ' + this.exprForBuiltin('Date') +
      "('" + date.date.toISOString() + "')";
};

/**
 * Get a source text representation of a given Error object.
 * @param {!Interpreter.prototype.Error} err Error object to be recreated.
 * @param {!ObjectDumper} errDumper ObjectDumper for err.
 * @return {string} An eval-able representation of err.
 */
Dumper.prototype.exprForError = function(err, errDumper) {
  errDumper.proto = err.proto;
  var constructor;
  if (err.proto === this.intrp2.EVAL_ERROR) {
    constructor = 'EvalError';
  } else if (err.proto === this.intrp2.RANGE_ERROR) {
    constructor = 'RangeError';
  } else if (err.proto === this.intrp2.REFERENCE_ERROR) {
    constructor = 'ReferenceError';
  } else if (err.proto === this.intrp2.SYNTAX_ERROR) {
    constructor = 'SyntaxError';
  } else if (err.proto === this.intrp2.TYPE_ERROR) {
    constructor = 'TypeError';
  } else if (err.proto === this.intrp2.URI_ERROR) {
    constructor = 'URIError';
  } else if (err.proto === this.intrp2.PERM_ERROR) {
    constructor = 'PermissionError';
  } else {
    constructor = 'Error';
    errDumper.proto = this.intrp2.ERROR;
  }
  // Try to set .message in the constructor call.
  var message = err.getOwnPropertyDescriptor('message', this.intrp2.ROOT);
  var messageExpr = '';
  if (message &&
      (typeof message.value === 'string' || message.value === undefined)) {
    messageExpr = this.exprFor(message.value);
    var attr = errDumper.attributes['message'] =
        {writable: true, enumerable: false, configurable: true};
    errDumper.checkProperty('message', message.value, attr , message);
  }
  // The .stack property is always created, and we always want to
  // overwrite (or delete) it.
  errDumper.attributes['stack'] =
      {writable: true, enumerable: false, configurable: true};
  var stack = err.getOwnPropertyDescriptor('stack', this.intrp2.ROOT);
  if (stack) {
    errDumper.setDone('stack', Do.DECL);
  } else {
    errDumper.scheduleDeletion('stack');
  }
  return 'new ' + this.exprForBuiltin(constructor) + '(' + messageExpr + ')';
};

/**
 * Get a source text representation of a given Function object.
 * @param {!Interpreter.prototype.Function} func Function object to be
 *     recreated.
 * @param {!ObjectDumper} funcDumper ObjectDumper for func.
 * @param {string=} funcName If supplied, and if value is an anonymous
 *     UserFunction, then the returned expression is presumed to appear
 *     on the right hand side of an assignment statement such that the
 *     resulting Function object has its .name property automatically
 *     set to this value if a name does not appear in the function body.
 * @return {string} An eval-able representation of func.
 */
Dumper.prototype.exprForFunction = function(func, funcDumper, funcName) {
  if (!(func instanceof this.intrp2.UserFunction)) {
    throw Error('Unable to dump non-UserFunction');
  }
  funcDumper.proto = this.intrp2.FUNCTION;  // TODO(ES6): generators, etc.?
  // The .length property will be set implicitly (and is immutable).
  funcDumper.attributes['length'] =
      {writable: false, enumerable: false, configurable: false};
  funcDumper.setDone('length', Do.RECURSE);
  // The .name property is often set automatically.
  // TODO(ES6): Handle prefix?
  if (func.node['id']) {
    funcName = func.node['id']['name'];
  }
  if (funcName) {
    var attr = funcDumper.attributes['name'] =
        {writable: false, enumerable: false, configurable: true};
    var pd = func.getOwnPropertyDescriptor('name', this.intrp2.ROOT);
    if (pd) {
      funcDumper.checkProperty('name', funcName, attr, pd);
    } else {
      funcDumper.scheduleDeletion('name');
    }
  }
  // The .prototype property will automatically be created, so we
  // don't need to "declare" it.  (Fortunately it's non-configurable,
  // so we don't need to worry that it might need to be deleted.)
  funcDumper.setDone('prototype', Do.DECL);
  // Better still, we might be able to use the automatically-created
  // .prototype object - if the current value is an ordinary Object
  // and it isn't a built-in or already instantiated.  (N.B.: we don't
  // care about its {proto}; that can be modified later.)
  attr = funcDumper.attributes['prototype'] =
      {writable: true, enumerable: false, configurable: false};
  pd = func.getOwnPropertyDescriptor('prototype', this.intrp2.ROOT);
  var prototype = pd.value;
  if (!this.intrp2.builtins.getKey(prototype) &&
      prototype instanceof this.intrp2.Object &&
      Object.getPrototypeOf(prototype) === this.intrp2.Object.prototype) {
    var prototypeFuncDumper = this.getObjectDumper(prototype);
    if(prototypeFuncDumper.ref === undefined) {
      // We can use automatic .prototype object.
      // Mark .prototype as Do.SET or Do.ATTR as appropriate.
      funcDumper.checkProperty('prototype', prototype, attr, pd);
      // Mark prototype object as existing and referenceable.
      prototypeFuncDumper.proto = this.intrp2.OBJECT;
      prototypeFuncDumper.ref =
          new Selector(funcDumper.ref.concat('prototype'));
      // Do we need to set .prototype's [[Prototype]]?
      if (prototype.proto === prototypeFuncDumper.proto) {
        prototypeFuncDumper.setDone(Selector.PROTOTYPE,
            (prototype.proto === null) ? Do.RECURSE : Do.DONE);
      }
      // Do we need to set .prototype's [[Owner]]?
      if (prototype.owner === this.perms) {
        prototypeFuncDumper.setDone(Selector.OWNER,
            (prototype.owner === null) ? Do.RECURSE : Do.DONE);
      }
      // It gets a .constructor property.  Check to see if it will
      // need to be overwritten.
      attr = prototypeFuncDumper.attributes['constructor'] =
          {writable: true, enumerable: false, configurable: true};
      pd = prototype.getOwnPropertyDescriptor('constructor', this.intrp2.ROOT);
      var constructor = pd.value;
      prototypeFuncDumper.checkProperty('constructor', func, attr, pd);
    }
  }
  return func.toString();
};

/**
 * Get a source text representation of a given Object.  May or may not
 * include all properties, etc.
 * @param {!Interpreter.prototype.Object} obj Object to be recreated.
 * @param {!ObjectDumper} objDumper ObjectDumper for obj.
 * @return {string} An eval-able representation of obj.
 */
Dumper.prototype.exprForObject = function(obj, objDumper) {
  switch (obj.proto) {
    case null:
      objDumper.proto = null;
      return this.exprForBuiltin('Object.create') + '(null)';
    case this.intrp2.OBJECT:
      objDumper.proto = this.intrp2.OBJECT;
      return '{}';
    default:
      var protoDumper = this.getObjectDumper(obj.proto);
      if (protoDumper.ref) {
        objDumper.proto = obj.proto;
        return this.exprForBuiltin('Object.create') + '(' +
            this.exprFor(obj.proto) + ')';
      } else {
        // Can't set [[Prototype]] yet.  Do it later.
        objDumper.proto = this.intrp2.OBJECT;
        return '{}';
      }
  }
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
 * Get a source text representation of a given RegExp object.
 * @param {!Interpreter.prototype.RegExp} re RegExp to be recreated.
 * @param {!ObjectDumper} reDumper ObjectDumper for re.
 * @return {string} An eval-able representation of re.
 */
Dumper.prototype.exprForRegExp = function(re, reDumper) {
  reDumper.proto = this.intrp2.REGEXP;
  // Some properties are implicitly pre-set.
  var props = ['source', 'global', 'ignoreCase', 'multiline'];
  for (var prop, i = 0; prop = props[i]; i++) {
    reDumper.attributes[prop] =
        {writable: false, enumerable: false, configurable: false};
    reDumper.setDone(prop, Do.RECURSE);
  }
  reDumper.attributes['lastIndex'] =
      {writable: true, enumerable: false, configurable: false};
  if (Object.is(re.get('lastIndex', this.intrp2.ROOT), 0)) {
    // Can skip setting .lastIndex iff it is 0.
    reDumper.setDone('lastIndex', Do.RECURSE);
  } else {
    reDumper.setDone('lastIndex', Do.DECL);
  }
  return re.regexp.toString();
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
 * Given Selector Selector([p_0, ... p_n]), get the 'parent'
 * ObjectDumper or ScopeDumper (the one referenced by Selector([p_0,
 * ... p_n-1])) plus the final part p_n.
 *
 * N.B.: the usage of 'components' here is analagous to that term's
 * usage in interpreter.js but not identical: there is is a [scope,
 * variable] tuple; here it is a {ScopeDumper/ObjectDumper,
 * Selector.Part} tuple.
 * @param {!Selector} selector A selector for the binding in question.
 * @param {!Interpreter.Scope=} scope Scope which selector is relative
 *     to.  Defaults to current scope.
 * @return {{dumper: (!ObjectDumper|!ScopeDumper), part: !Selector.Part}}
 *     The dumper and part corresponding to selector.
 */
Dumper.prototype.getComponentsForSelector = function(selector, scope) {
  if (selector.isVar()) {
    var part = selector[0];
    var dumper = this.getScopeDumper(this.scope);
  } else {
    var ref = new Selector(selector);
    part = ref.pop();
    var obj = this.valueForSelector(ref);
    if (!(obj instanceof this.intrp2.Object)) {
      throw new TypeError("Can't set properties of primitive");
    }
    dumper = this.getObjectDumper(obj);
  }
  return {dumper: dumper, part: part};
};

/**
 * Returns true if a given name is shadowed in the current scope.
 * @param {string} name Variable name that might be shadowed.
 * @param {!Interpreter.Scope=} scope Scope in which name is defind.
 *     Defaults to the global scope.
 * @return {boolean} True iff name is bound in a scope between the
 *     current scope (this.scope) (inclusive) and scope (exclusive).
 */
Dumper.prototype.isShadowed = function(name, scope) {
  if (!scope) scope = this.intrp2.global;
  for (var s = this.scope; s !== scope; s = s.outerScope) {
    if (s === null) {
      throw Error("Looking for name '" + name + "' from non-enclosing scope??");
    }
    if (s.hasBinding(name)) return true;
  }
  return false;
};

/**
 * Get interned ObjectDumper for sope.
 * @param {!Interpreter.prototype.Object} obj The object to get the dumper for.
 * @return {!ObjectDumper} The ObjectDumper for obj.
 */
Dumper.prototype.getObjectDumper = function(obj) {
  if (this.objDumpers2.has(obj)) return this.objDumpers2.get(obj);
  var objDumper = new ObjectDumper(this, obj);
  this.objDumpers2.set(obj, objDumper);
  return objDumper;
};

/**
 * Get interned ScopeDumper for sope.
 * @param {!Interpreter.Scope} scope The scope to get info for.
 * @return {!ScopeDumper} The ScopeDumper for scope.
 */
Dumper.prototype.getScopeDumper = function(scope) {
  if (this.scopeDumpers.has(scope)) return this.scopeDumpers.get(scope);
  var scopeDumper = new ScopeDumper(scope);
  this.scopeDumpers.set(scope, scopeDumper);
  return scopeDumper;
};

/**
 * Get the present value in the interpreter of a particular binding,
 * specified by selector.  If selector does not correspond to a valid
 * binding an error is thrown.
 * @param {!Selector} selector A selector, specifiying a binding.
 * @param {!Interpreter.Scope=} scope Scope which selector is relative
 *     to.  Defaults to the current scope.
 * @return {Interpreter.Value} The value of that binding.
 */
Dumper.prototype.valueForSelector = function(selector, scope) {
  if (!scope) scope = this.scope;
  if (selector.length < 1) throw new RangeError('Zero-length selector??');
  var varname = selector[0];
  if (typeof varname !== 'string') throw new TypeError('Invalid first part??');
  if (!scope.hasBinding(varname)) {
    throw new ReferenceError(varname + ' is not defined');
  }
  var /** Interpreter.Value */ v = scope.get(varname);
  for (var i = 1; i < selector.length; i++) {
    if (!(v instanceof this.intrp2.Object)) {
      var s = new Selector(selector.slice(0, i));
      throw TypeError("Can't get select part of primitive " + s + ' === ' + v);
    }
    var part = selector[i];
    if (typeof part === 'string') {
      v = v.get(part, this.intrp2.ROOT);
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
 * Write strings to current output file.  (May be buffered.)
 * @param {...string} var_args Strings to output.
 */
Dumper.prototype.write = function(var_args) {
  this.output.push.apply(this.output, arguments);
};

///////////////////////////////////////////////////////////////////////////////
// ScopeDumper

/**
 * ScopeDumper encapsulates all machinery to dump an Interpreter.Scope
 * to eval-able JS, including maintaining all the dump-state info
 * required to keep track of what variable bindings have and haven't
 * yet been dumped.
 * @constructor
 * @param {!Interpreter.Scope} scope The scope to keep state for.
 */
var ScopeDumper = function(scope) {
  this.scope = scope;
  /** @type {boolean} Has this scope already been surveyed? */
  this.surveyed = false;
  /** @private @const {!Object<string, Do>} Done status of each variable. */
  this.doneVar_ = Object.create(null);
  /** @const {!Set<!ScopeDumper>} Set of inner scopes. */
  this.innerScopes = new Set();
  /** @const {!Set<!ObjectDumper>} Set of inner functions. */
  this.innerFunctions = new Set();
};

/**
 * Generate JS source text to create and/or initialize a single
 * variable binding.
 * @param {!Dumper} dumper Dumper to which this ScopeDumper belongs.
 */
ScopeDumper.prototype.dump = function(dumper) {
  if (dumper.scope !== this.scope) {
    throw new Error("Can't dump scope other than current scope");
  }
  // Dump variable bindings.
  for (var name in this.scope.vars) {
    if (this.getDone(name) >= Do.RECURSE) continue;  // Skip already-done.
    this.dumpBinding(dumper, name, Do.RECURSE);
  }
};

/**
 * Generate JS source text to create and/or initialize a single
 * variable binding.
 * @param {!Dumper} dumper Dumper to which this ScopeDumper belongs.
 * @param {!Selector.Part} part The part to dump.  Must be simple string.
 * @param {!Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Selector=} ref Ignored.
 * @return {!Do} How much has been done on the specified binding.
 */
ScopeDumper.prototype.dumpBinding = function(dumper, part, todo, ref) {
  if (dumper.scope !== this.scope) {
    throw new Error("Can't create binding other than in current scope");
  } else if (typeof part !== 'string') {
    throw new TypeError('Invalid part (not a variable name)');
  } else if (!this.scope.hasBinding(part)) {
    throw new ReferenceError("Can't dump non-existent variable " + part);
  }
  var sel = new Selector([part]);
  var done = this.getDone(part);
  var value = this.scope.get(part);

  if (done >= 0) {  // Negative values mean don't dump (yet).
    if (todo >= Do.DECL && done < todo && done <= Do.SET) {
      if (done < Do.DECL) {
        dumper.write('var ');
        done = Do.DECL;
      }
      if (done < Do.SET) {
        dumper.write(part);
        if (todo >= Do.SET) {
          dumper.write(' = ', dumper.exprFor(value, sel, false, part));
          done = (typeof value === 'object') ? Do.DONE : Do.RECURSE;
        }
        dumper.write(';\n');
      }
      this.setDone(part, done);
    }
    if (todo >= Do.RECURSE && done < Do.RECURSE &&
        value instanceof dumper.intrp2.Object) {
      var objDone = dumper.getObjectDumper(value).dump(dumper, sel);
      if (objDone === ObjectDumper.Done.DONE_RECURSIVELY) {
        done = Do.RECURSE;
        this.setDone(part, done);
      }
    }
  }

  return done;
};

/**
 * Return the current 'done' status of a variable binding.
 * @param {!Selector.Part} part The part get status for.  Must be simple string.
 * @return {!Do} The done status of the binding.
 */
ScopeDumper.prototype.getDone = function(part) {
  if (typeof part !== 'string') {
    throw new TypeError('Invalid part (not a variable name)');
  }
  return this.doneVar_[part] || Do.UNSTARTED;
};

/**
 * Update the current 'done' status of a variable binding.  Will throw
 * a RangeError if caller attempts to un-do a previously-done action.
 * @param {!Selector.Part} part The part set status for.  Must be simple string.
 * @param {!Do} done The new done status of the binding.
 */
ScopeDumper.prototype.setDone = function(part, done) {
  if (typeof part !== 'string') {
    throw new TypeError('Invalid part (not a variable name)');
  }
  var old = this.getDone(part);

  // Invariant checks.
  if (old && done < old) {
    throw new RangeError("Can't undo previous work on variable " + part);
  } else if (done === old) {
    throw new RangeError("Redundant work on variable " + part);
  }
  this.doneVar_[part] = done;
};

/**
 * Visit a Scope (and recursively, everything accessible via its
 * binding) to prepare for dumping.
 * @param {!Dumper} dumper Dumper to which this ScopeDumper belongs.
 */
ScopeDumper.prototype.survey = function(dumper) {
  if (dumper.visiting.has(this) || this.surveyed) return;
  dumper.visiting.add(this);
  // Record parent scope.
  if (this.scope !== dumper.intrp2.global) {
    if (this.scope.outerScope === null) {
      throw new TypeError('Non-global scope has null outer scope');
    }
    var outerScopeDumper = dumper.getScopeDumper(this.scope.outerScope);
    // Record this as inner scope of this.outerScope.
    outerScopeDumper.innerScopes.add(this);
    // Recursively survey enclosing scopes.
    outerScopeDumper.survey(dumper);
  }
  // Survey variable bindings.
  for (var name in this.scope.vars) {
    var value = this.scope.get(name);
    if (!(value instanceof dumper.intrp2.Object)) continue;  // Skip primitives.
    dumper.getObjectDumper(value).survey(dumper, new Selector(name));
  }
  // Record arguments object attached to this scope if it's a function scope.
  if (this.scope.type === Interpreter.Scope.Type.FUNCTION &&
      this.scope.hasImmutableBinding('arguments')) {
    var argsObject = this.scope.get('arguments');
    if (!(argsObject instanceof dumper.intrp2.Arguments)) {
      throw new TypeError('arguments not an Arguments object');
    } else if (dumper.argumentsScopeDumpers.has(argsObject)) {
      throw new Error('Arguments object belongs to more than one scope');
    }
    dumper.argumentsScopeDumpers.set(argsObject, this);
  }
  this.surveyed = true;
  dumper.visiting.delete(this);
};

///////////////////////////////////////////////////////////////////////////////
// ObjectDumper

/**
 * ObjectDumper encapsulates all machinery to dump an
 * Interpreter.prototype.Object to eval-able JS, including maintaining
 * all the dump-state info required to keep track of what properties
 * (etc.) have and haven't yet been dumped.
 * @constructor
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {!Interpreter.prototype.Object} obj The object to keep state for.
 */
var ObjectDumper = function(dumper, obj) {
  this.obj = obj;
  /** @type {!Selector|undefined} Reference to this object, once created. */
  this.ref = undefined;
  /** @type {!ObjectDumper.Done} How much has object been dumped? */
  this.done = ObjectDumper.Done.NO;
  /** @private @type {!Do} Has prototype been set? */
  this.doneProto_ = Do.DECL;  // Never need to 'declare' the [[Prototype]] slot!
  /**
   * Current value of [[Prototype]] slot of obj at this point in dump.
   * Typically initially Object.prototype (or similar); will be ===
   * obj.proto when complete.  Used to check for unwritable inherited
   * properties when attempting to set properties by assignment.
   * Should only be undefined if object has not yet been created.
   * @type {?Interpreter.prototype.Object|undefined}
   */
  this.proto = undefined;
  /** @private @type {!Do} Has owner been set? */
  this.doneOwner_ = Do.DECL;  // Never need to 'declare' that object has owner!
  /** @private @const {!Object<string, Do>} Done status of each property. */
  this.doneProp_ = Object.create(null);
  /**
   * Map of property name -> property descriptor, where property
   * descriptor is a map of attribute names (writable, enumerable,
   * configurable, more tbd) to boolean values describing the present
   * attributes of the property at the current point in the dump; this
   * is updated as code that modifies them is generated.  (We do not
   * store values here.)
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
ObjectDumper.prototype.checkProperty = function(key, value, attr, pd) {
  if (!Object.is(value, pd.value)) {
    var done = Do.DECL;
  } else if (attr.writable === pd.writable &&
      attr.enumerable === pd.enumerable &&
      attr.configurable === pd.configurable) {
    done = (typeof value === 'object') ? Do.ATTR : Do.RECURSE;
  } else {
    done = Do.SET;
  }
  this.setDone(key, done);
  return done;
};

/**
 * Recursively dumps all bindings of the object (and objects reachable
 * via it).
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {!Selector=} ref Selector refering to this object.
 *     Optional; defaults to whatever selector was used to create the
 *     object.
 * @return {!ObjectDumper.Done|?ObjectDumper.Pending} Done status for
 *     object, or or null if there is an outstanding dump or
 *     dumpBinding invocaion for this object, or a (bindings,
 *     dependencies) pair if a recursive call encountered such an
 *     outstanding invocation.
 */
ObjectDumper.prototype.dump = function(dumper, ref) {
  if (!ref) ref = this.ref;
  if (!ref) {
    throw new Error("Can't dump unreferencable object");
  }
  if (this.proto === undefined) {
    throw new Error("Can't dump uncreated object " +  ref);
  }
  if (dumper.visiting.has(this)) {
    return null;
  }
  if (this.done === ObjectDumper.Done.DONE_RECURSIVELY) {
    return this.done;
  }
  dumper.visiting.add(this);

  // Delete properties that shouldn't exist.
  if (this.toDelete) {
    var sel = new Selector(ref);
    for (var key, i = 0; key = this.toDelete[i]; i++) {
      sel.push(key);
      dumper.write('delete ', dumper.exprForSelector(sel), ';\n');
      sel.pop();
    }
    this.toDelete = null;
  }
  // Dump bindings: prototype, owner, and properties.
  // TODO(cpcallen): Also dump set/map entries, etc.
  // Optimistically assume success until we find otherwise.
  var /** !ObjectDumper.Done */ done = ObjectDumper.Done.DONE_RECURSIVELY;
  var /** ?ObjectDumper.Pending */ pending = null;
  var keys = this.obj.ownKeys(dumper.intrp2.ROOT);
  var parts = [Selector.PROTOTYPE, Selector.OWNER].concat(keys);
  for (i = 0; i < parts.length; i++) {
    var part = parts[i];
    var bindingDone = this.dumpBinding(dumper, part, Do.RECURSE, ref);
    if (bindingDone === null) {
      throw new Error('.dumpBinding returned null to .dump');
    } else if (bindingDone instanceof ObjectDumper.Pending) {
      // Circular dependency detected amongst objects being recursively
      // dumped.  Record details of circularity.
      if (pending) {
        pending.merge(bindingDone);
      } else {
        pending = bindingDone;
      }
    } else if (bindingDone === Do.DONE) {
      done = /** @type {!ObjectDumper.Done} */(
          Math.min(done, ObjectDumper.Done.DONE));
    } else if (bindingDone < Do.DONE && bindingDone !== Do.PRUNE) {
      done = /** @type {!ObjectDumper.Done} */(
          Math.min(done, ObjectDumper.Done.NO));
    }
  }
  if (done) {
    // Dump extensibility.
    if (!this.obj.isExtensible(dumper.intrp2.ROOT)) {
      dumper.write(dumper.exprForBuiltin('Object.preventExtensions'), '(',
                   dumper.exprForSelector(ref), ');\n');
    }
    this.done = ObjectDumper.Done.DONE;
  }

  dumper.visiting.delete(this);
  // If all parts of circular dependency are DONE, mark all as
  // RECURSE / DONE_RECURSIVELY.
  // TODO(cpcallen): Clean up this code.
  if (done) {
    if (pending) {
      if (pending.dependencies.some(
          function(dep) {return !dep.done || dumper.visiting.has(dep);})) {
        done = /** @type {!ObjectDumper.Done} */(
            Math.min(done, ObjectDumper.Done.DONE));
      } else {
        var /** !Selector */ binding;
        for (i = 0; binding = pending.bindings[i]; i++) {
          dumper.markBinding(binding, Do.RECURSE);
        }
        for (var dep, i = 0; dep = pending.dependencies[i]; i++) {
          dep.done = ObjectDumper.Done.DONE_RECURSIVELY;
        }
        pending = null;
      }
    }
  }
  this.done = done;
  return pending || done;
};

/**
 * Generate JS source text to create and/or initialize a single
 * binding (property or internal slot) of the object, including
 * recursively dumping value object if requested.
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {!Selector.Part} part The binding part to dump.
 * @param {!Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Selector=} ref Selector refering to this object.
 *     Optional; defaults to whatever selector was used to create the
 *     object.
 * @return {!Do|?ObjectDumper.Pending} How much has been done on the
 *     specified binding, or null if there is an outstanding dump or
 *     dumpBinding invocaion for this object, or a (bindings,
 *     dependencies) pair if a recursive call encountered such an
 *     outstanding invocation.
 */
ObjectDumper.prototype.dumpBinding = function(dumper, part, todo, ref) {
  if (this.proto === undefined) {
    throw new Error("Can't dump part of uncreated object");
  }
  if (!ref) ref = this.ref;
  if (!ref) {
    throw new Error("Can't dump part of an unreferencable object");
  }

  var done = this.getDone(part);
  if (done  < 0) return done;  // Negative values mean don't dump (yet).
  var sel = new Selector(ref.concat(part));
  if (part === Selector.PROTOTYPE) {
    var r = this.dumpPrototype_(dumper, todo, ref, sel);
  } else if (part === Selector.OWNER) {
    r = this.dumpOwner_(dumper, todo, ref, sel);
  } else if (typeof part === 'string') {
    r = this.dumpProperty_(dumper, part, todo, ref, sel);
  } else {
    throw new Error('Invalid part');
  }
  done = r.done;
  var value = r.value;
  if (todo >= Do.RECURSE && done === Do.DONE &&
      value instanceof dumper.intrp2.Object) {
    var valueDumper = dumper.getObjectDumper(value);
    var objDone = valueDumper.dump(dumper, sel);
    if (objDone === null) {  // Circular structure detected.
      return new ObjectDumper.Pending(sel, valueDumper);
    } else if (objDone instanceof ObjectDumper.Pending) {
      objDone.add(sel, valueDumper);
      return objDone;
    } else if (objDone === ObjectDumper.Done.DONE_RECURSIVELY) {
      done = Do.RECURSE;
      // Might have already been set via circular references.
      if (this.getDone(part) < Do.RECURSE) this.setDone(part, done);
    }
  }
  return done;
};

/**
 * Generate JS source text to set the object's [[Owner]].
 * @private
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {!Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Selector} ref Selector refering to this object.
 * @param {!Selector} sel Selector refering to this object's [[Owner]] slot.
 * @return {{done: !Do, value: Interpreter.Value}} The done status of
 *     the [[Owner]] binding and the value of the object's [[Owner]]
 *     slot.
 */
ObjectDumper.prototype.dumpOwner_ = function(dumper, todo, ref, sel) {
  var value = /** @type {?Interpreter.prototype.Object} */(this.obj.owner);
  if (todo >= Do.SET && this.doneOwner_ < Do.SET) {
    dumper.write(dumper.exprForBuiltin('Object.setOwnerOf'), '(',
                 dumper.exprForSelector(ref), ', ',
                 dumper.exprFor(value, sel), ');\n');
    this.doneOwner_ = (value === null) ? Do.RECURSE: Do.DONE;
  }
  return {done: this.doneOwner_, value};
};

/**
 * Generate JS source text to create and/or initialize a single
 * property of the object.  The output will consist of:
 *
 * - An assignment statement to create the property and/or set its
 *   value, if necessary and possible.
 * - A call to Object.defineProperty, to set the property's attributes
 *   (and value, if the value couldn't be set by assignement), if
 *   necessary.
 * @private
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {string} key The property to dump.
 * @param {!Do} todo How much to do.
 * @param {!Selector} ref Selector refering to this object.
 * @param {!Selector} sel Selector refering to key.
 * @return {{done: !Do, value: Interpreter.Value}} The done status of
 *     the specified property and its (ultimate/actual) value.
 */
ObjectDumper.prototype.dumpProperty_ = function(dumper, key, todo, ref, sel) {
  var pd = this.obj.getOwnPropertyDescriptor(key, dumper.intrp2.ROOT);
  if (!pd) throw new RangeError("Can't dump nonexistent property " + sel);

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
      var funcName = dumper.intrp1.options.methodNames ? key : undefined;
      dumper.write(dumper.exprForSelector(sel), ' = ',
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
      dumper.write(dumper.exprForBuiltin('Object.defineProperty'), '(',
                   dumper.exprForSelector(ref), ', ', dumper.exprFor(key),
                   ', {', items.join(', '), '});\n');
      done = this.checkProperty(key, value, attr, pd);
    }
  }
  return {done: done, value: pd.value};
};

/**
 * Generate JS source text to set the object's [[Prototype]].
 * @private
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {!Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Selector} ref Selector refering to this object.
 * @param {!Selector} sel Selector refering to this object's [[Prototype]] slot.
 * @return {{done: !Do, value: Interpreter.Value}} The done status of
 *     the [[Owner]] binding and the value of the object's [[Owner]]
 *     slot.
 */
ObjectDumper.prototype.dumpPrototype_ = function(dumper, todo, ref, sel) {
  var value = this.obj.proto;
  if (todo >= Do.SET && this.doneProto_ < Do.SET) {
    dumper.write(dumper.exprForBuiltin('Object.setPrototypeOf'), '(',
                 dumper.exprForSelector(ref), ', ',
                 dumper.exprFor(value, sel), ');\n');
    this.proto = value;
    this.doneProto_ = (value === null) ? Do.RECURSE: Do.DONE;
  }
  return {done: this.doneProto_, value: value};
};

/**
 * Return the current 'done' status of an object binding.
 * @param {!Selector.Part} part The part to get status for.
 * @return {!Do} The done status of the binding.
 */
ObjectDumper.prototype.getDone = function(part) {
  if (part === Selector.PROTOTYPE) {
    return this.doneProto_;
  } else if (part === Selector.OWNER) {
    return this.doneOwner_;
  } else if (typeof part === 'string') {
    return this.doneProp_[part] || Do.UNSTARTED;
  } else {
    throw new TypeError('Invalid part');
  }
};

/**
 * Return true iff the specifed property can be created or set by
 * assignment - i.e., that it exists and is writable, or doesn't exist
 * and does not inherit from a non-writable property on the prototype
 * chain.
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {string} key The property key to check for writability of.
 * @return {boolean} True iff the property can be set by assignment.
 */
ObjectDumper.prototype.isWritable = function(dumper, key) {
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
      return dumper.getObjectDumper(this.proto).isWritable(dumper, key);
    }
  }
};

/**
 * Record that the (ressurected) object will have a property, not on
 * the original, that needs to be deleted.
 * @param {string} key The property key to delete.
 */
ObjectDumper.prototype.scheduleDeletion = function(key) {
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
 * @param {!Do} done The new done status of the binding.
 */
ObjectDumper.prototype.setDone = function(part, done) {
  var old = this.getDone(part);
  var name = (part === Selector.PROTOTYPE) ? 'prototype' : '.' + part;

  // Invariant checks.
  var description = this.ref ? ' of ' + this.ref : '';
  if (old && done < old) {
    throw new RangeError("Can't undo work on " + name + description);
  } else if (done === old) {
    throw new RangeError('Redundant work on ' + name + description);
  }
  // Do set.
  if (part === Selector.PROTOTYPE) {
    this.doneProto_ = done;
  } else if (part === Selector.OWNER) {
    this.doneOwner_ = done;
  } else if (typeof part === 'string') {
    this.doneProp_[part] = done;
  }
};

/**
 * Visit an Object (and recursively, everything accessible via its
 * binding) to prepare for dumping.
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {!Selector} ref Selector refering to this object.
 */
ObjectDumper.prototype.survey = function(dumper, ref) {
  if (dumper.visiting.has(this)) return;
  dumper.visiting.add(this);
  if (this.obj instanceof dumper.intrp2.UserFunction) {
    // Record this this function as inner to scope, and survey scope.
    var scopeDumper = dumper.getScopeDumper(this.obj.scope);
    scopeDumper.innerFunctions.add(this);
    scopeDumper.survey(dumper);
  }
  // Survey prototype.
  if (this.obj.proto) {
    ref.push(Selector.PROTOTYPE);
    dumper.getObjectDumper(this.obj.proto).survey(dumper, ref);
    ref.pop();
  }
  // Survey owner.
  if (this.obj.owner) {
    ref.push(Selector.OWNER);
    var ownerObj = /** @type {!Interpreter.prototype.Object} */(this.obj.owner);
    dumper.getObjectDumper(ownerObj).survey(dumper, ref);
    ref.pop();
  }
  // Survey properties.
  var keys = this.obj.ownKeys(dumper.intrp2.ROOT);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = this.obj.get(key, dumper.intrp2.ROOT);
    if (value instanceof dumper.intrp2.Object) {
      ref.push(key);
      dumper.getObjectDumper(value).survey(dumper, ref);
      ref.pop();
    }
  }
  dumper.visiting.delete(this);
};

/**
 * Tri-state "done" flag for ObjectDumper.  A bit like Do, but for the
 * whole object rather than a single binding.
 * @enum {number}
 */
ObjectDumper.Done = {
  /** Object not fully dumped. */
  NO: 0,

  /**
   * Object is done (has all own properties fully defined including
   * attributes, has correct [[Owner]] and [[Prototype]], is
   * non-extensible if applicable, etc.).
   */
  DONE: 1,

  /** This object and all objects accessible from it are done. */
  DONE_RECURSIVELY: 2,
};

/**
 * A record of pending bindings returned by the .dump and .dumpBinding
 * methods when they encounter a circular dependency while trying to
 * recursively dump some objects.
 *
 * E.g., given objects a and b, if a.b === b, and b.a === a, then
 * either both a and b can be both be fully recursivley dumped or
 * neither is.  When attempting to dump a, the dumpProperty(<a.b>)
 * will try to dump b, which will ensure that b.a is done and return a
 * Pending object indicating that <b.a> being recursively done is
 * awaiting completion of a.
 *
 * @constructor
 * @param {!Selector} binding A binding awaiting recursive completion
 *     of its value object.
 * @param {!ObjectDumper} valueDumper The ObjectDumper for the object
 *     which is the value of binding.
 */
ObjectDumper.Pending = function (binding, valueDumper) {
  if (!binding) throw new Error('no binding');
  if (!valueDumper) throw new Error('no valueDumper');
  /** !Array<!Selector> */
  this.bindings = [binding];
  /** !Array<!ObjectDumper> */
  this.dependencies = [valueDumper];
};

/**
 * Add a new (binding, dependency) pair to this Pending object.
 * @param {!Selector} binding A binding awaiting recursive completion
 *     of its value object.
 * @param {!ObjectDumper} valueDumper The ObjectDumper for the object
 *     which is the value of binding.
 */
ObjectDumper.Pending.prototype.add = function (binding, valueDumper) {
  if (!binding) throw new Error('no binding');
  if (!valueDumper) throw new Error('no valueDumper');
  this.bindings.push(binding);
  this.dependencies.push(valueDumper);
};

/**
 * Merge another pending list into this one.
 * @param {!ObjectDumper.Pending} that Another Pending list.
 */
ObjectDumper.Pending.prototype.merge = function (that) {
  this.bindings.push.apply(this.bindings, that.bindings);
  this.dependencies.push.apply(this.dependencies, that.dependencies);
};

/** @override */
ObjectDumper.Pending.prototype.toString = function() {
  return '{bindings: [' + this.bindings.join(', ') + '], ' +
      'dependencies: [' + this.dependencies.map(function(od) {
        return String(od.ref);
      }).join(', ') + ']}';
};

///////////////////////////////////////////////////////////////////////////////
// Do, etc.

/**
 * Possible things to do (or have done) with a variable / property /
 * etc. binding.  N.B.: values meaning "don't do this one (yet)"
 * are negative, "nothing done" is zero (and therefore falsey), and
 * "some work has been done" are positive.
 * @enum {number}
 */
var Do = {
  /**
   * Skip the named binding entirely (unless it or an extension of it
   * is explicitly mentioned in a later config directive); if the data
   * accessible via the named binding is not accessible via any other
   * (non-pruned) path from the global scope it will consequently not
   * be included in the dump.
   *
   * This option is intended to cause data loss, so be careful!
   */
  PRUNE: -2,

  /**
   * Skip the named binding for now, but include it in a later file
   * (whichever has rest: true).
   */
  SKIP: -1,

  /**
   * Nothing has been done about this binding yet.  Only valid as a
   * 'done' value, not as a 'do' value.
   */
  UNSTARTED: 0,

  /**
   * Ensure that the specified binding exists, but do not yet set it
   * to its final value.  If the binding is a variable, it has been /
   * will be declared; if it is a property, it has been / will be
   * created but not (yet) set to a value other than undefined (nor
   * made non-configurable).
   */
  DECL: 1,

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
   */
  SET: 2,

  /**
   * Ensure theat the specified binding has been set to its final
   * value, and additionally that the final property attributes
   * (enumerable, writable and/or configurable) are set.  DONE is
   * provided as an alias for bindings (like [[Prototype]] and
   * [[Owner]] that don't have attributes; for those, SET should
   * automatically be promoted to DONE.
   */
  ATTR: 3,
  DONE: 3,

  /**
   * Ensure the specified path is has been set to its final value (and
   * marked immuable, if applicable) and that the same has been done
   * recursively to all bindings reachable via path.
   */
  RECURSE: 4,
};

///////////////////////////////////////////////////////////////////////////////
// Exports.

exports.Do = Do;
exports.Dumper = Dumper;

// For unit testing only!
exports.testOnly = {
  ObjectDumper: ObjectDumper,
}
