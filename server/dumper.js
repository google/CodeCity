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
 * @fileoverview The Dumper class (and related helpers) to diff the
 *     state of (parts or all of) two Interpreter objects, outputing
 *     eval-able JS code to convert the one into the other.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

var code = require('./code');
var Interpreter = require('./interpreter');
var PriorityQueue = require('./priorityqueue').PriorityQueue;
var Selector = require('./selector');
var util = require('util');

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
 * @struct
 * @param {!Interpreter} intrp1 An interpreter initialised exactly as
 *     the one the ouptut JS will be executed by.
 * @param {!Interpreter} intrp2 An interpreter containing state
 *     modifications (relative to intrp1) to be dumped.
 * @param {!DumperOptions=} options Additional options.
 */
var Dumper = function(intrp1, intrp2, options) {
  this.intrp1 = intrp1;
  this.intrp2 = intrp2;
  // Copy DEFAULT_OPTIONS then apply supplied options.
  /** @type {!DumperOptions} */
  this.options = {};
  this.setOptions(DEFAULT_OPTIONS);
  if (options) this.setOptions(options);

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
   * Which scope are we presently outputting code in the context of?
   * @type {!Interpreter.Scope}
   */
  this.scope = intrp2.global;
  /** @type {!Interpreter.Owner} Perms at present point in output. */
  this.perms = intrp2.ROOT;
  /**
   * Map from objects from intrp1 to corresponding objects in intrp2.
   * @type {!Map<?Interpreter.prototype.Object, ?Interpreter.prototype.Object>}
   */
  this.objs1to2 = new Map();
  /**
   * Current indentation.
   * @type {string}
   */
  this.indent = '';

  this.diffBuiltins_();

  // Create and initialise ScopeDumper for global scope.
  /** @const !ScopeDumper */
  this.global = this.getScopeDumper_(intrp2.global);
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
      this.global.setDone(v, (typeof val2 === 'object') ? Do.DONE : Do.RECURSE);
      if (val2 instanceof intrp2.Object) {
        this.getObjectDumper_(val2)
            .updateRef(this, new Components(this.global, v));
        // Other initialialisation will be taken care of below.
      }
    }
  }

  // Survey objects accessible via global scope to find their outer scopes.
  this.survey_();
};

/**
 * Diff the values of buit-ins.
 * @private
 * @return {void}
 */
Dumper.prototype.diffBuiltins_ = function() {
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
    var objDumper = this.getObjectDumper_(obj2);
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
 * Dump everything that has not already been dumped so far.  The
 * generated source text is written to the current output buffer.
 * Notably, this will also dump any listening sockets.
 * @return {void}
 */
Dumper.prototype.dump = function() {
  // Dump all remaining bindings.
  this.global.dump(this);

  // Dump listening Servers.
  for (var key in this.intrp2.listeners_) {
    var port = Number(key);
    var server = this.intrp2.listeners_[port];
    var args = [port, server.proto];
    if (server.timeLimit) args.push(server.timeLimit);
    this.write(this.exprForCall_('CC.connectionListen', args), ';');
  }
};

/**
 * Generate JS source text to declare and optionally initialise a
 * particular binding (as specified by a Selector).  The generated
 * source text is written to the current output buffer.
 *
 * E.g., if foo = [42, 69, 105], then:
 *
 * myDumper.dumpBinding(new Selector('foo'), Do.DECL)
 * // Writes: 'var foo;\n'
 * myDumper.dumpBinding(new Selector('foo'), Do.SET)
 * // Writes: 'foo = [];\n'
 * myDumper.dumpBinding(new Selector('foo[0]'), Do.SET)
 * // Writes: 'foo[0] = 42;\n'
 * myDumper.dumpBinding(new Selector('foo'), Do.RECURSE)
 * // Writs: 'foo[1] = 69;\nfoo[2] = 105;\n'
 *
 * This is mainly a wrapper around Object/ScopeDumper.p.dumpBinding
 * and ObjectDumper.p.dump.
 *
 * @param {!Selector} selector The selector for the binding to be dumped.
 * @param {!Do} todo How much to dump.  Must be >= Do.DECL.
 * @return {void}
 */
Dumper.prototype.dumpBinding = function(selector, todo) {
  var c = this.getComponentsForSelector_(selector);
  var done = c.dumper.dumpBinding(this, c.part, todo);
  if (todo >= Do.RECURSE && done < Do.RECURSE) {
    var value = c.dumper.getValue(this, c.part);
    if (value instanceof this.intrp2.Object) {
      var objDone = this.getObjectDumper_(value).dump(this, selector);
      if (objDone === ObjectDumper.Done.DONE_RECURSIVELY) {
        if (c.dumper.getDone(c.part) < Do.RECURSE) {
          c.dumper.setDone(c.part, Do.RECURSE);
        }
      }
    }
  }
};

/**
 * Get a source text representation of a given value.  The source text
 * will vary depending on the state of the dump; for instance, if the
 * value is an object that has not yet apepared in the dump it will be
 * represented by an expression creating the object - but if it has
 * appeared before, then it will instead be represented by an
 * expression referenceing the previously-constructed object.
 *
 * This method is mostly a wrapper around the other .exprFor<Foo>_
 * methods (but notably not .exprForBuiltin_ and .exprForCall_, which
 * are wrappers around this method); see them for examples of expected
 * output.
 *
 * @private
 * @param {Interpreter.Value} value Arbitrary JS value from this.intrp2.
 * @param {!Components=} ref Location in which value will be stored.
 * @param {boolean=} callable Return the expression suitably
 *     parenthesised to be used as the callee of a CallExpression.
 * @param {string=} funcName If supplied, and if value is an anonymous
 *     UserFuncion, then the returned expression is presumed to appear
 *     on the right hand side of an assignment statement such that the
 *     resulting Function object has its .name property automatically
 *     set to this value.
 * @return {string} An eval-able representation of the value.
 */
Dumper.prototype.exprFor_ = function(value, ref, callable, funcName) {
  var intrp2 = this.intrp2;
  if (!(value instanceof intrp2.Object)) {
    return this.exprForPrimitive_(value);
  }

  // Return existing reference to object (if already created).
  var objDumper = this.getObjectDumper_(value);
  var selector;  // Existing selector for value, if any.
  if (objDumper.proto !== undefined && objDumper.ref) {
    selector = objDumper.getSelector();
  }
  if (ref) objDumper.updateRef(this, ref);  // Safe new ref if specified.
  if (selector) return this.exprForSelector_(selector);

  // Object not yet referenced.  Is it a builtin?
  var key = intrp2.builtins.getKey(value);
  if (key) {
    var quoted = code.quote(key);
    return callable ? '(new ' + quoted + ')' : 'new ' + quoted;
  }

  // Seems to be a new object.  Check it really doesn't exist already
  // and that it will be referenceable.
  if (objDumper.proto !== undefined) {
    throw new Error('object already exists but is not referenced');
  } else if (!objDumper.ref) {
    throw new Error('refusing to create non-referable object');
  }

  var expr;
  if (value instanceof intrp2.Function) {
    expr = this.exprForFunction_(value, objDumper, funcName);
  } else if (value instanceof intrp2.Array) {
    expr = this.exprForArray_(value, objDumper);
  } else if (value instanceof intrp2.Date) {
    expr = this.exprForDate_(value, objDumper);
  } else if (value instanceof intrp2.RegExp) {
    expr = this.exprForRegExp_(value, objDumper);
  } else if (value instanceof intrp2.Error) {
    expr = this.exprForError_(value, objDumper);
  } else if (value instanceof intrp2.WeakMap) {
    expr = this.exprForWeakMap_(value, objDumper);
  } else {
    expr = this.exprForObject_(value, objDumper);
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
 * Get a source text representation of a given Array object.  For the
 * moment the return value is always '[]', but the specified arrDumper
 * is modified to reflect what further work will need to be done to
 * finsh dumping the array object.
 * TODO(cpcallen): Return a more interesting array literal when possible.
 * @private
 * @param {!Interpreter.prototype.Array} arr Array object to be recreated.
 * @param {!ObjectDumper} arrDumper ObjectDumper for arr.
 * @return {string} An eval-able representation of arr.
 */
Dumper.prototype.exprForArray_ = function(arr, arrDumper) {
  arrDumper.proto = this.intrp2.ARRAY;
  var root = this.intrp2.ROOT;
  var lastIndex = arr.get('length', root) - 1;
  arrDumper.attributes['length'] =
      {writable: true, enumerable: false, configurable: false};
  if (lastIndex < 0 || arr.getOwnPropertyDescriptor(String(lastIndex), root)) {
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
 * purposes of calling it.  Usually the return value will be a string
 * like 'Object.defineProperty', but if the builtin in question hasn't
 * yet been assigned to an object it will instead return a string like
 * "(new 'Object.defineProperty')" to invoke the new hack to obtain
 * it.  This is a trivial wrapper around exprFor_ for a common use
 * case.
 * @private
 * @param {string} builtin The name of the builtin.
 * @return {string} An eval-able representation of obj.
 */
Dumper.prototype.exprForBuiltin_ = function(builtin) {
  return this.exprFor_(this.intrp2.builtins.get(builtin), undefined, true);
};

/**
 * Get a source text representation of a call to a given builtin
 * function.  The array of arguments can contain either
 * Interpreter.Values or Selectors, which will be passed to .exprFor_
 * and .exprForSelector_, respectively.
 * @private
 * @param {string} builtin The name of the builtin function to call.
 * @param {!Array<!Selector|Interpreter.Value>=} args Arguments to the  call.
 * @return {string} An eval-able representation of a builtin function call.
 */
Dumper.prototype.exprForCall_ = function(builtin, args) {
  var dumper = this;
  return this.exprForBuiltin_(builtin) + '(' +
      Array.from(args || []).map(function (argument) {
        if (argument instanceof Selector) {
          return dumper.exprForSelector_(argument);
        } else {
          return dumper.exprFor_(argument);
        }
      }).join(', ') + ')';
};

/**
 * Get a source text representation of a given Date object.  The
 * return value will usually be a string of the form "new
 * Date('1975-07-27T23:59:59.000Z')" (but the new hack will be invoked
 * if the Data constructor has not yet been initialised).
 * @private
 * @param {!Interpreter.prototype.Date} date Date object to be recreated.
 * @param {!ObjectDumper} dateDumper ObjectDumper for date.
 * @return {string} An eval-able representation of date.
 */
Dumper.prototype.exprForDate_ = function(date, dateDumper) {
  dateDumper.proto = this.intrp2.DATE;
  return 'new ' + this.exprForCall_('Date', [date.date.toISOString()]);
};

/**
 * Get a source text representation of a given Error object.  The
 * return value will usually be a string of the form "new
 * RangeError()" or "new TypeError('message')" (but the new hack will
 * be invoked if the Data constructor has not yet been initialised).
 * Only the built-in Error constructors will be used; for custom error
 * stub-types errDumper will be left in a state that will ensure that
 * {proto} is subsequently set appropriately.
 * @private
 * @param {!Interpreter.prototype.Error} err Error object to be recreated.
 * @param {!ObjectDumper} errDumper ObjectDumper for err.
 * @return {string} An eval-able representation of err.
 */
Dumper.prototype.exprForError_ = function(err, errDumper) {
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
  var args = [];
  if (message && typeof message.value === 'string') {
    args.push(message.value);
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
  return 'new ' + this.exprForCall_(constructor, args);
};

/**
 * Get a source text representation of a given Function object.  The
 * returned string is just this.obj.toString(), which will be a string
 * of the form "function name(arg0, arg1, ...) { body; }", formatted
 * with whitespace and line breaks as it was in the original source.
 * Most of this method is therefore devoted to ensuring that
 * funcDumper is modified to reflect what further work will need to be
 * done to finsh dumping the function object.
 * TODO(cpcallen): Dump FunctionDeclarations as such, rather than
 * converting them into FunctionExpressions.
 * @private
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
Dumper.prototype.exprForFunction_ = function(func, funcDumper, funcName) {
  if (!(func instanceof this.intrp2.UserFunction)) {
    throw Error('Unable to dump non-UserFunction');
  }
  // TODO(cpcallen): Should throw, rather than merely warn.
  for (var scope = func.scope; scope !== this.scope; scope = scope.outerScope) {
    var vars = Object.getOwnPropertyNames(scope.vars);
    if (scope.type === Interpreter.Scope.Type.FUNEXP && scope === func.scope ||
        vars.length === 0) {
      continue;
    }
    this.warn(util.format('CLOSURE: type: %s, vars: %s',
                          scope.type, vars.join(', ')));
  }

  // Record stuff that gets done automatically by evaluating a
  // function expression, like setting its __proto__ and .prototype.
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
    var prototypeFuncDumper = this.getObjectDumper_(prototype);
    if (prototypeFuncDumper.proto === undefined) {
      // We can use automatic .prototype object.
      // Mark .prototype as Do.SET or Do.ATTR as appropriate.
      funcDumper.checkProperty('prototype', prototype, attr, pd);
      // Mark prototype object as existing and referenceable.
      prototypeFuncDumper.proto = this.intrp2.OBJECT;
      prototypeFuncDumper
          .updateRef(this, new Components(funcDumper, 'prototype'));
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
      prototypeFuncDumper.checkProperty('constructor', func, attr, pd);
    }
  }
  return func.toString();
};

/**
 * Get a source text representation of a given Object.  For now the
 * return value will always be either the string '{}' or one of the
 * form 'Object.create(prototype)' (and/or invoking the new hack if
 * required).
 * TODO(cpcallen): return a more interesting object literal when possible.
 * @private
 * @param {!Interpreter.prototype.Object} obj Object to be recreated.
 * @param {!ObjectDumper} objDumper ObjectDumper for obj.
 * @return {string} An eval-able representation of obj.
 */
Dumper.prototype.exprForObject_ = function(obj, objDumper) {
  switch (obj.proto) {
    case null:
      objDumper.proto = null;
      return this.exprForCall_('Object.create', [null]);
    case this.intrp2.OBJECT:
      objDumper.proto = this.intrp2.OBJECT;
      return '{}';
    default:
      if (this.getObjectDumper_(obj.proto).proto !== undefined) {
        // Record prototype connection.
        objDumper.proto = obj.proto;
        this.getObjectDumper_(obj.proto)
            .updateRef(this, new Components(objDumper, Selector.PROTOTYPE));
        return this.exprForCall_('Object.create', [obj.proto]);
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
 * undefiend shadowed by binding in the current scope.  In general
 * this is just the obvious literal, but note:
 *
 * - Strings will be single- or double-quoted depending on which is
 *   more concise.
 * - If Infinity, NaN or undefined is shadowed an alternative
 *   expression evaluating to the desired value will be returned
 *   instead.  (N.B.: true, false and null are literals so cannot be
 *   shadowed.)
 * @private
 * @param {undefined|null|boolean|number|string} value Primitive JS value.
 * @return {string} An eval-able representation of the value.
 */
Dumper.prototype.exprForPrimitive_ = function(value) {
  switch (typeof value) {
    case 'undefined':
      if (this.isShadowed_('undefined')) return '(void 0)';
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
        if (this.isShadowed_('NaN')) {
          return '(0/0)';
        }
        return 'NaN';
      } else {  // value is Infinity or -Infinity.
        if (this.isShadowed_('Infinity')) {
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
        throw TypeError('exprForPrimitive_ called on non-primitive value');
      }
  }
};

/**
 * Get a source text representation of a given RegExp object.  The
 * returned value will be a string containing a regexp literal, like
 * '/foobar/gi'.
 * @private
 * @param {!Interpreter.prototype.RegExp} re RegExp to be recreated.
 * @param {!ObjectDumper} reDumper ObjectDumper for re.
 * @return {string} An eval-able representation of re.
 */
Dumper.prototype.exprForRegExp_ = function(re, reDumper) {
  reDumper.proto = this.intrp2.REGEXP;
  // Some properties are implicitly pre-set.
  var props = ['source', 'global', 'ignoreCase', 'multiline'];
  for (var prop, i = 0; (prop = props[i]); i++) {
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
 * given Selector s and Dumper d, d.exprForSelector_(s) will be the
 * same as s.toExpr() except when the output needs to call a builtin
 * function like Object.getPrototypeOf that is not available via its
 * usual name - e.g. if Object.getPrototypeOf has not yet been dumped
 * then the selector foo.bar{proto} might be represented as "(new
 * 'Object.getPrototypeOf')(foo.bar)" instead of
 * "Object.getPrototypeOf(foo.bar)".
 * @private
 * @param {Selector=} selector Selector to obtain value of.
 * @return {string} An eval-able representation of the value.
 */
Dumper.prototype.exprForSelector_ = function(selector) {
  var dumper = this;
  return selector.toString(function(part, out) {
    if (part === Selector.PROTOTYPE) {
      out.unshift(dumper.exprForBuiltin_('Object.getPrototypeOf'), '(');
      out.push(')');
    } else if (part === Selector.OWNER) {
      out.unshift(dumper.exprForBuiltin_('Object.getOwnerOf'), '(');
      out.push(')');
    } else {
      throw new TypeError('Invalid part in parts array');
    }
  });
};

/**
 * Get a source text representation of a given WeakMap object.  The
 * return value will usually be the string "new WeakMap()" (but the
 * new hack will be invoked if the WeakMap constructor has not yet
 * been initialised).
 * @private
 * @param {!Interpreter.prototype.WeakMap} weakMap WeakMap object to
 *     be recreated.
 * @param {!ObjectDumper} weakMapDumper ObjectDumper for weakmap.
 * @return {string} An eval-able representation of weakmap.
 */
Dumper.prototype.exprForWeakMap_ = function(weakMap, weakMapDumper) {
  weakMapDumper.proto = this.intrp2.WEAKMAP;
  return 'new ' + this.exprForCall_('WeakMap');
};

/**
 * Given a Selector and optionally a Scope, get the corresponding
 * Components.
 * @private
 * @param {!Selector} selector A selector for the binding in question.
 * @param {!Interpreter.Scope=} scope Scope which selector is relative to.
 *     Defaults to current scope.
 * @return {!Components} The dumper and part corresponding to selector.
 */
Dumper.prototype.getComponentsForSelector_ = function(selector, scope) {
  if (!scope) scope = this.scope;
  if (selector.length < 1) throw new RangeError('Zero-length selector??');
  var /** !SubDumper */ dumper = this.getScopeDumper_(scope);
  var /** Interpreter.Value */ v;
  for (var i = 0; i < selector.length - 1; i++) {
    v = dumper.getValue(this, selector[i]);
    if (!(v instanceof this.intrp2.Object)) {
      var s = new Selector(selector.slice(0, i + 1));
      throw TypeError("Can't select part of primitive " + s + ' === ' + v);
    }
    dumper = this.getObjectDumper_(v);
  }
  return new Components(dumper, selector[selector.length - 1]);
};

/**
 * Given a Selector or selector string and optionally a Scope, get the
 * SubDumper for the value object identified.  This is intended to be
 * used only for testing.
 * @param {!Selector|string} selector A Selector or selector string
 *     referring to an object.
 * @param {!Interpreter.Scope=} scope Scope which ss is relative to.
 *     Defaults to current scope.
 * @return {!ObjectDumper} The ObjectDumper for the referred-to object.
 */
Dumper.prototype.getDumperFor = function(selector, scope) {
  if (typeof selector === 'string') selector = new Selector(selector);
  if (!scope) scope = this.scope;
  var /** !SubDumper */ dumper = this.getScopeDumper_(scope);
  var /** Interpreter.Value */ v;
  for (var i = 0; i < selector.length; i++) {
    v = dumper.getValue(this, selector[i]);
    if (!(v instanceof this.intrp2.Object)) {
      var s = new Selector(selector.slice(0, i + 1));
      throw TypeError("Can't select part of primitive " + s + ' === ' + v);
    }
    dumper = this.getObjectDumper_(v);
  }
  if (!(dumper instanceof ObjectDumper)) throw new TypeError('corrupt state');
  return dumper;
};

/**
 * Get interned ObjectDumper for sope.
 * @private
 * @param {!Interpreter.prototype.Object} obj The object to get the dumper for.
 * @return {!ObjectDumper} The ObjectDumper for obj.
 */
Dumper.prototype.getObjectDumper_ = function(obj) {
  if (this.objDumpers2.has(obj)) return this.objDumpers2.get(obj);
  var objDumper = new ObjectDumper(obj);
  this.objDumpers2.set(obj, objDumper);
  return objDumper;
};

/**
 * Get interned ScopeDumper for sope.
 * @private
 * @param {!Interpreter.Scope} scope The scope to get info for.
 * @return {!ScopeDumper} The ScopeDumper for scope.
 */
Dumper.prototype.getScopeDumper_ = function(scope) {
  if (this.scopeDumpers.has(scope)) return this.scopeDumpers.get(scope);
  var scopeDumper = new ScopeDumper(scope);
  this.scopeDumpers.set(scope, scopeDumper);
  return scopeDumper;
};

/**
 * Returns true if a given name is shadowed in the current scope.
 * TODO(cpcallen): Use .reachable on the global Scope's ScopeDumper.
 * @private
 * @param {string} name Variable name that might be shadowed.
 * @param {!Interpreter.Scope=} scope Scope in which name is defined.
 *     Defaults to the global scope.
 * @return {boolean} True iff name is bound in a scope between the
 *     current scope (this.scope) (inclusive) and scope (exclusive).
 */
Dumper.prototype.isShadowed_ = function(name, scope) {
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
 * Mark a particular binding (as specified by a Selector) with a
 * certain done value.
 * @private
 * @param {!Selector} selector The selector for the binding to be deferred.
 * @param {!Do} done Do status to mark binding with.
 */
Dumper.prototype.markBinding_ = function(selector, done) {
  var c = this.getComponentsForSelector_(selector);
  var was = c.dumper.getDone(c.part);
  if (was !== done) c.dumper.setDone(c.part, done);
};

/**
 * Mark a particular binding (as specified by a Selector) to pruned,
 * which will have the effect of trying to ensure it does not exist in
 * the state reconstructed by the dump output.
 * TODO(cpcallen): actually delete pruned properties if necessary.
 * @param {!Selector} selector The selector for the binding to be pruned.
 */
Dumper.prototype.prune = function(selector) {
  var c = this.getComponentsForSelector_(selector);
  c.dumper.prune(c.part);
};

/**
 * Set the .prune flag on the ObjectDumper for the object identified
 * by the given Selector to true.
 * TODO(cpcallen): actually delete pruned properties if necessary.
 * @param {!Selector} selector The selector for the binding to be pruned.
 */
Dumper.prototype.pruneRest = function(selector) {
  selector = new Selector(selector.concat(['']));  // N.B. ugly hack!
  var c = this.getComponentsForSelector_(selector);
  if (!(c.dumper instanceof ObjectDumper)) throw new TypeError();
  c.dumper.pruneRest = true;
};

/**
 * Set options for this dumper.  Can be called to change options
 * between calls to .dumpbBinding.  Will update existing settings with
 * new values, so only changed options need to be supplied.
 * @param {!DumperOptions} options The new options to apply.
 * @return {void}
 */
Dumper.prototype.setOptions = function(options) {
  for (var key in DEFAULT_OPTIONS) {
    if (key in options) this.options[key] = options[key];
  }
};

/**
 * Mark a particular binding (as specified by a Selector) to be
 * skipped, which will have the effect of preventing any further
 * dumping of it until it is unskipped.
 * @param {!Selector} selector The selector for the binding to be skipped.
 */
Dumper.prototype.skip = function(selector) {
  var c = this.getComponentsForSelector_(selector);
  c.dumper.skip(c.part);
};

/**
 * Survey the global Scope and recursively everything accessible via
 * its bindings, to prepare for dumping.
 *
 * This is done useing Dijkstra's Algorithm to create a least-cost
 * spanning tree starting from the global scope, with distance
 * measured by Selector badness.
 *
 * @private
 * @return {void}
 */
Dumper.prototype.survey_ = function() {
  var /** !Set<!SubDumper> */ visited = new Set();
  var /** !PriorityQueue<!SubDumper> */ queue = new PriorityQueue();
  // TODO(cpcallen): Remove badness; this info is already stored in queue.
  var /** !Map<!SubDumper,number> */ badness = new Map();

  // Start building spanning tree from the global scope.
  var globalScopeDumper = this.getScopeDumper_(this.intrp2.global);
  var /* @const */ globalBadness = 0;
  badness.set(globalScopeDumper, globalBadness);
  queue.insert(globalScopeDumper, globalBadness);

  while (queue.length) {
    var /** !SubDumper */ dumper = queue.deleteMin();
    if (visited.has(dumper)) throw new Error('surveying same dumper twice??');
    visited.add(dumper);
    var baseBadness = badness.get(dumper);
    badness.delete(dumper);

    var /** !Array<!OutwardEdge> */ adjacent = dumper.survey(this);
    for (var j = 0; j < adjacent.length; j++) {
      var edge = adjacent[j];
      if (edge instanceof ScopeDumper) {
        if (visited.has(edge)) continue;
        badness.set(edge, Infinity);
        queue.set(edge, Infinity);
      }
      if (!(edge.value instanceof this.intrp2.Object)) continue;
      var objectDumper = this.getObjectDumper_(edge.value);
      if (visited.has(objectDumper)) continue;
      var newBadness = baseBadness + Selector.partBadness(edge.part);
      // If we've not seen objectDumper before, .get will return
      // undefined and the following test will return false.
      // (Undefined is effectivly a 'bigger infinity' here!)
      if (newBadness >= badness.get(objectDumper)) continue;
      objectDumper.preferredRef = new Components(dumper, edge.part);
      badness.set(objectDumper, newBadness);
      queue.set(objectDumper, newBadness);
    }
  }
};

/**
 * Mark a particular binding (as specified by a Selector) as no longer
 * to be skipped.
 * @param {!Selector} selector The selector for the binding to be skipped.
 */
Dumper.prototype.unskip = function(selector) {
  var c = this.getComponentsForSelector_(selector);
  c.dumper.unskip(c.part);
};

/**
 * Log a warning about something suspicious that happened while
 * dumping.  By default this prints to the console and .write()s a
 * comment to the file being output, but it can be overridden on
 * individual instances.
 * @param {string} warning Warning to output or log.
 */
Dumper.prototype.warn = function(warning) {
  if (this.options.verbose) console.log(warning);
  warning = warning.replace(/^(?!$)/gm, this.indent + '// ')
      .slice(this.indent.length);  // Remove indent from first line.
  this.write(warning);
};

/**
 * Write strings to current output file.  (May be buffered.)  The
 * arguments will be concatenated into a single string, which will be
 * pefixed with the current indentation and have a trailing newline
 * added if necessary.  No indentation will be added to the second and
 * subsequent lines of a multi-line write, however, to preserve
 * indentation in function bodies / multi-line string literals / etc.
 * @param {...string} var_args Strings to output.
 */
Dumper.prototype.write = function(var_args) {
  if (this.options.output) {
    var line = this.indent + Array.prototype.join.call(arguments, '');
    if (!line.endsWith('\n')) line += '\n';
    this.options.output.write(line);
  }
};

///////////////////////////////////////////////////////////////////////////////
// SubDumper

/**
 * Common interface and functionality for ScopeDumper and ObjectDumper.
 * @abstract @constructor
 * @struct
 */
var SubDumper = function() {
  /** @type {?Set<Selector.Part>} */
  this.skip_ = null;
  /** @type {?Set<Selector.Part>} */
  this.prune_ = null;
};

/**
 * Generate JS source text to create and/or initialize a single
 * binding (varialbe in a scope, or property / internal slot of an
 * object).
 * @abstract
 * @param {!Dumper} dumper Dumper to which this ScopeDumper belongs.
 * @param {Selector.Part} part The part to dump.  Must be simple string.
 * @param {!Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @return {!Do} How much has been done on the specified binding.
 */
SubDumper.prototype.dumpBinding = function(dumper, part, todo) {};

/**
 * Return the current 'done' status of a binding.
 * @abstract
 * @param {Selector.Part} part The part to get status for.
 * @return {!Do} The done status of the binding.
 */
SubDumper.prototype.getDone = function(part) {};

/**
 * Return the value of the given part in intrp2 (i.e., the intended
 * final value, provided that it isn't going to be pruned.)
 * @abstract
 * @param {!Dumper} dumper Dumper to which this SubDumper belongs.
 * @param {Selector.Part} part The binding part to get the value of.
 * @return {Interpreter.Value} The value of that part.
 */
SubDumper.prototype.getValue = function(dumper, part) {};

/**
 * Update the current 'done' status of a binding.  Will throw a
 * RangeError if caller attempts to un-do or re-do a previously-done
 * action.
 * @param {Selector.Part} part The part to set status for.
 * @param {!Do} done The new done status of the binding.
 */
SubDumper.prototype.setDone = function(part, done) {};

/**
 * Mark a particular binding (as specified by a Part) to be pruned,
 * which will have the effect of trying to ensure it does not exist in
 * the state reconstructed by the dump output.
 * TODO(cpcallen): actually delete pruned properties if necessary.
 * @param {Selector.Part} part The binding to be pruned.
 */
SubDumper.prototype.prune = function(part) {
  if (!this.prune_) this.prune_ = new Set();
  this.prune_.add(part);
};

/**
 * Return true the specified part is presently reachable - i.e., could
 * be set or read by an expression in the currently-dumped scope.
 * @abstract
 * @param {!Dumper} dumper Dumper to which this SubDumper belongs.
 * @param {Selector.Part=} part The binding whose reachability is of
 *     interest.  Ignored, since all object bindings are always
 *     reachable if the object is.
 * @return {boolean}
 */
SubDumper.prototype.reachable = function(dumper, part) {};

/**
 * Mark a particular binding (as specified by a Part) to be skipped,
 * which will have the effect of preventing any further dumping of it
 * until it is unskipped.
 * @param {Selector.Part} part The binding to be skipped.
 */
SubDumper.prototype.skip = function(part) {
  if (!this.skip_) this.skip_ = new Set();
  this.skip_.add(part);
};

/**
 * Survey the scope or object associated with this SubDumper in
 * preparation for dumping.
 *
 * Returns a list of OutwardEdges representing outward edges
 * from this node of the object graph.: the properties (and internal
 * slots) of this object.  Exceptionally, because Scopes are not
 * Interpreter Objects (and there is no Selector.Part corresponding to
 * the enclosing scope slot of a UserFunction object), the
 * ObjectDumper for a UserFunction will also include a bare
 * ScopeDumper in its returned array.
 *
 * @abstract
 * @param {!Dumper} dumper Dumper to which this ScopeDumper belongs.
 * @return {!Array<OutwardEdge>}
 */
SubDumper.prototype.survey = function(dumper) {};

/**
 * Mark a particular binding (as specified by a Selector) as no longer
 * to be skipped.
 * @param {Selector.Part} part The binding to be unskipped.
 */
SubDumper.prototype.unskip = function(part) {
  if (!this.skip_) return;
  this.skip_.delete(part);
  if (this.skip_.size === 0) this.skip_ = null;
};

///////////////////////////////////////////////////////////////////////////////
// ScopeDumper

/**
 * ScopeDumper encapsulates all machinery to dump an Interpreter.Scope
 * to eval-able JS, including maintaining all the dump-state info
 * required to keep track of what variable bindings have and haven't
 * yet been dumped.
 * @constructor @extends {SubDumper}
 * @struct
 * @param {!Interpreter.Scope} scope The scope to keep state for.
 */
var ScopeDumper = function(scope) {
  SubDumper.call(this);
  this.scope = scope;
  /** @private @const {!Object<string, Do>} Done status of each variable. */
  this.doneVar_ = Object.create(null);
  /** @const {!Set<!ScopeDumper>} Set of inner scopes. */
  this.innerScopes = new Set();
  /** @const {!Set<!ObjectDumper>} Set of inner functions. */
  this.innerFunctions = new Set();
};
Object.setPrototypeOf(ScopeDumper, SubDumper);
Object.setPrototypeOf(ScopeDumper.prototype, SubDumper.prototype);

/**
 * Generate JS source text to create and/or initialize a single
 * variable binding.
 * @param {!Dumper} dumper Dumper to which this ScopeDumper belongs.
 * @return {void}
 */
ScopeDumper.prototype.dump = function(dumper) {
  if (dumper.scope !== this.scope) {
    throw new Error("Can't dump scope other than current scope");
  }
  // Dump variable bindings.
  for (var name in this.scope.vars) {
    if (this.getDone(name) >= Do.RECURSE) continue;  // Skip already-done.
    // Dump binding itself.
    var done = this.dumpBinding(dumper, name, Do.RECURSE);
    // Attempt to recursively dump the value object, if there is one.
    if (done >= Do.RECURSE) continue;
    var value = this.getValue(dumper, name);
    if (!(value instanceof dumper.intrp2.Object)) continue;
    var valueDumper = dumper.getObjectDumper_(value);
    var objDone = valueDumper.dump(dumper, new Selector(name));
    if (objDone === ObjectDumper.Done.DONE_RECURSIVELY) {
      this.setDone(name, Do.RECURSE);
    }
  }
};

/**
 * Generate JS source text to create and/or initialize a single
 * variable binding.
 * @param {!Dumper} dumper Dumper to which this ScopeDumper belongs.
 * @param {Selector.Part} part The part to dump.  Must be simple string.
 * @param {!Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @return {!Do} How much has been done on the specified binding.
 */
ScopeDumper.prototype.dumpBinding = function(dumper, part, todo) {
  if (dumper.scope !== this.scope) {
    throw new Error("Can't create binding other than in current scope");
  } else if (typeof part !== 'string') {
    throw new TypeError('Invalid part (not a variable name)');
  } else if (!this.scope.hasBinding(part)) {
    throw new ReferenceError("Can't dump non-existent variable " + part);
  } else if (this.prune_ && this.prune_.has(part)) {
    return Do.RECURSE;  // Don't dump this binding at all.
  } else if (this.skip_ && this.skip_.has(part)) {
    return this.getDone(part);  // Do nothing but don't lie about it.
  }
  var done = this.getDone(part);
  var output = [];
  if (todo < Do.DECL || done >= todo || done > Do.SET) return done;
  if (done < Do.DECL) {
    output.push('var ');
    done = Do.DECL;
  }
  if (done < Do.SET) {
    output.push(part);
    if (todo >= Do.SET) {
      var ref = new Components(this, part);
      var value = this.scope.get(part);
      output.push(' = ', dumper.exprFor_(value, ref, false, part));
      done = (value instanceof dumper.intrp2.Object) ? Do.DONE : Do.RECURSE;
    }
    output.push(';');
  }
  this.setDone(part, done);
  dumper.write.apply(dumper, output);
  return done;
};

/**
 * Return the current 'done' status of a variable binding.
 * @param {Selector.Part} part The part get status for.  Must be simple string.
 * @return {!Do} The done status of the binding.
 */
ScopeDumper.prototype.getDone = function(part) {
  if (typeof part !== 'string') {
    throw new TypeError('Invalid part (not a variable name)');
  }
  var done = this.doneVar_[part];
  return done === undefined ? Do.UNSTARTED : done;
};

/**
 * Update the current 'done' status of a variable binding.  Will throw
 * a RangeError if caller attempts to un-do a previously-done action.
 * @param {Selector.Part} part The part set status for.  Must be simple string.
 * @param {!Do} done The new done status of the binding.
 */
ScopeDumper.prototype.setDone = function(part, done) {
  if (typeof part !== 'string') {
    throw new TypeError('Invalid part (not a variable name)');
  }
  var old = this.getDone(part);

  // Invariant checks.
  if (done <= old) {
    var fault = (done === old) ? 'Refusing redundant' : "Can't undo previous";
    throw new RangeError(fault + ' work on variable ' + part);
  }
  this.doneVar_[part] = done;
};

/**
 * Return the value of the given variable in this.scope (i.e., the
 * value in intrp2, and the intended final value - provided that it
 * isn't going to be pruned.)
 * @param {!Dumper} dumper Dumper to which this ScopeDumper belongs.
 * @param {Selector.Part} part The binding part to get the value of.
 * @return {Interpreter.Value} The value of that part.
 */
ScopeDumper.prototype.getValue = function(dumper, part) {
  if (typeof part !== 'string') throw new TypeError('Invalid first part??');
  if (!this.scope.hasBinding(part)) {
    throw new ReferenceError(part + ' is not defined');
  }
  return this.scope.get(part);
};

/**
 * Return true iff the given binding (which must be a variable name)
 * is currently reachable.  Specifically, this will return true if:
 *
 * 1. this.scope is the current value dumper.scope, since we can
 *    always access existing bindings and create new ones in the
 *    current scope.
 * 2. this.scope is an outer scope of dumper.scope and par 
 *    is not shadowed in dumper.scope or any intervening one.
 *
 * BUG(cpcallen): Only #1 is implemented at the moment.
 *
 * @param {!Dumper} dumper Dumper to which this ScopeDumper belongs.
 * @param {Selector.Part=} part Variable name whose reachability is of
 *     interest.
 * @return {boolean}
 */
ScopeDumper.prototype.reachable = function(dumper, part) {
  return this.scope === dumper.scope;
};

/**
 * Visit a Scope to prepare for dumping.  In particular:
 *
 * - If this.scope.outerScope is set, record this as one of it's inner
 *   scopes, so that when we go to dump that scope later we know we
 *   need to dump this one inside it.
 *
 * - Find any Arguments object attached to this scope and record the
 *   relationship in the dumper.argumentsScopeDumpers map.
 *
 * - Collect and return an array of {part, value} tuples, where each
 *   represents a variable in this scope.
 *
 * @param {!Dumper} dumper Dumper to which this ScopeDumper belongs.
 * @return {!Array<OutwardEdge>}
 */
ScopeDumper.prototype.survey = function(dumper) {
  var /** !Array<OutwardEdge> */ adjacent = [];

  // Record parent scope.
  if (this.scope !== dumper.intrp2.global) {
    if (this.scope.outerScope === null) {
      throw new TypeError('Non-global scope has null outer scope');
    }
    var outerScopeDumper = dumper.getScopeDumper_(this.scope.outerScope);
    // Record this as inner scope of this.outerScope.
    outerScopeDumper.innerScopes.add(this);
    // Don't forget to survey the outerScope, too:
    adjacent.push(outerScopeDumper);
  }
  // Record arguments object attached to this scope if it's a function scope.
  if (this.scope.type === Interpreter.Scope.Type.FUNCTION &&
      this.scope.hasImmutableBinding('arguments')) {
    var argsObject = this.scope.get('arguments');
    if (!(argsObject instanceof dumper.intrp2.Arguments)) {
      // BUG(cpcallen): what about function(arguments) {...}?
      throw new TypeError('arguments not an Arguments object');
    } else if (dumper.argumentsScopeDumpers.has(argsObject)) {
      // BUG(cpcallen): what about (function(arguments) {...})(
      //     (function() {return arguments;})()); ?
      throw new Error('Arguments object belongs to more than one scope');
    }
    dumper.argumentsScopeDumpers.set(argsObject, this);
  }

  // Collect Components for other objects reachable from this one.
  for (var name in this.scope.vars) {
    adjacent.push({part: name, value: this.scope.get(name)});
  }

  return adjacent;
};

///////////////////////////////////////////////////////////////////////////////
// ObjectDumper

/**
 * ObjectDumper encapsulates all machinery to dump an
 * Interpreter.prototype.Object to eval-able JS, including maintaining
 * all the dump-state info required to keep track of what properties
 * (etc.) have and haven't yet been dumped.
 * @constructor @extends {SubDumper}
 * @struct
 * @param {!Interpreter.prototype.Object} obj The object to keep state for.
 */
var ObjectDumper = function(obj) {
  SubDumper.call(this);
  /** @type {!Interpreter.prototype.Object} */
  this.obj = obj;
  /**
   * Preferred reference to this object.  E.g., for Object.prototype
   * this would be {dumper: <dumper for Object>, part: 'prototype'}.
   * @type {?Components}
   */
  this.preferredRef = null;
  /**
   * A valid-at-this-point-in-the-dump referrence to this object.
   * @type {?Components} Reference to this object, once created.
   */
  this.ref = null;
  /**
   * If true, then .dump() will not dump any ordinary (property /
   * member / entry) bindings.  This means that only bindings dumped
   * by calls to .dumpBinding() will be dumped.  (Prototype and owner
   * bindings will still be dumped unless they are individually
   * .prune()ed.)
   * @type {boolean}
   */
  this.pruneRest = false;
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
Object.setPrototypeOf(ObjectDumper, SubDumper);
Object.setPrototypeOf(ObjectDumper.prototype, SubDumper.prototype);

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
  var done;
  if (!Object.is(value, pd.value)) {
    done = Do.DECL;
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
 * @param {!Selector=} objSelector Selector refering to this object.
 *     Optional; defaults to whatever selector was used to create the
 *     object.
 * @param {!Array<(!SubDumper)>=} visiting List of Scope/Object dumpers
 *     currently being recursively dumped.  Used only when
 *     recursing.
 * @param {!Set<(!SubDumper)>=} visited Set of Scope/Object dumpers
 *     currently that have already been visited.  Used only when
 *     recursing.
 * @return {!ObjectDumper.Done|?ObjectDumper.Pending} Done status for
 *     object, or or null if there is an outstanding dump or
 *     dumpBinding invocaion for this object, or a (bindings,
 *     dependencies) pair if a recursive call encountered such an
 *     outstanding invocation.
 */
ObjectDumper.prototype.dump = function(
    dumper, objSelector, visiting, visited) {
  if (!visiting) visiting = [];
  if (!visited) visited = new Set();
  if (!objSelector) objSelector = this.getSelector();
  if (!objSelector) throw new Error("can't dump unreferencable object");
  if (this.proto === undefined) {
    throw new Error("can't dump uncreated object " + this.getSelector(true));
  }
  if (visited.has(this)) return null;
  if (this.done === ObjectDumper.Done.DONE_RECURSIVELY) return this.done;
  visiting.push(this);
  visited.add(this);

  // Delete properties that shouldn't exist.
  if (this.toDelete) {
    var sel = new Selector(objSelector);
    for (var key, i = 0; (key = this.toDelete[i]); i++) {
      sel.push(key);
      dumper.write('delete ', dumper.exprForSelector_(sel), ';');
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
  var parts = [Selector.PROTOTYPE, Selector.OWNER];
  if (!this.pruneRest) parts = parts.concat(keys);
  for (i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (this.prune_ && this.prune_.has(part)) {
      // TODO(cpcallen): delete binding if necessary.
      continue;
    } else if (this.skip_ && this.skip_.has(part) ||
        dumper.options.skipBindings.includes(part)) {
      // Can't finish an object with skipped parts.
      done = /** @type {!ObjectDumper.Done} */(
          Math.min(done, ObjectDumper.Done.NO));
      continue;
    }
    // Attempt to dump the binding itself.
    var bindingSelector = new Selector(objSelector.concat(part));
    var bindingDone =
        this.dumpBinding(dumper, part, Do.DONE, objSelector, bindingSelector);
    if (bindingDone === Do.RECURSE) {  // Nothing more to do for part.
      continue;
    } else if (bindingDone < Do.DONE) {  // Object can't be done.
      done = /** @type {!ObjectDumper.Done} */(
          Math.min(done, ObjectDumper.Done.NO));
    }
    if (bindingDone < Do.SET) continue;  // Can't recurse if no object yet!

    // Attempt to recursively dump the value object, if there is one.
    var value = this.getValue(dumper, part);
    if (!(value instanceof dumper.intrp2.Object)) continue;
    var valueDumper = dumper.getObjectDumper_(value);
    if (dumper.options.treeOnly &&
        (this !== valueDumper.preferredRef.dumper ||
         part !== valueDumper.preferredRef.part)) {
      // Refuse to recurse into objects outside of the spanning tree.
      done = /** @type {!ObjectDumper.Done} */(
          Math.min(done, ObjectDumper.Done.DONE));
      continue;
    }
    valueDumper.updateRef(dumper, new Components(this, part));
    var objDone =
        valueDumper.dump(dumper, bindingSelector, visiting, visited);
    if (objDone === null || objDone instanceof ObjectDumper.Pending) {
      // Circular structure detected.
      if (!pending) {
        pending = new ObjectDumper.Pending(bindingSelector, valueDumper);
      } else {
        pending.add(bindingSelector, valueDumper);
      }
      if (objDone instanceof ObjectDumper.Pending) {
        // Circular dependency detected amongst objects being recursively
        // dumped.  Record details of circularity.  Add this binding.
        pending.merge(objDone);
      }
    } else if (objDone === ObjectDumper.Done.DONE_RECURSIVELY) {
      // Successful recursive dump.  Upgrade binding accordingly.
      this.setDone(part, Do.RECURSE);
    }
  }

  if (this.done < ObjectDumper.Done.DONE && done >= ObjectDumper.Done.DONE) {
    // Dump extensibility.
    if (!this.obj.isExtensible(dumper.intrp2.ROOT)) {
      dumper.write(
          dumper.exprForCall_('Object.preventExtensions', [objSelector]),
          ';');
    }
    this.done = ObjectDumper.Done.DONE;  // Set now to allow cycles to complete.
  }

  visiting.pop();
  // If all parts of circular dependency are DONE, mark all as
  // RECURSE / DONE_RECURSIVELY.
  // TODO(cpcallen): Clean up this code.
  if (done) {
    if (pending) {
      if (pending.dependencies.some(
          function(dep) {return !dep.done || visiting.includes(dep);})) {
        done = /** @type {!ObjectDumper.Done} */(
            Math.min(done, ObjectDumper.Done.DONE));
      } else {
        var /** !Selector */ binding;
        for (i = 0; (binding = pending.bindings[i]); i++) {
          dumper.markBinding_(binding, Do.RECURSE);
        }
        for (var dep, i = 0; (dep = pending.dependencies[i]); i++) {
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
 * binding (property or internal slot) of the object.
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {Selector.Part} part The binding part to dump.
 * @param {!Do} todo How much to do.  Must be >= Do.DECL; > Do.ATTR ignored.
 * @param {!Selector=} objSelector Selector refering to this object.
 *     Optional; will be created using getSelector if not supplied.
 * @param {!Selector=} bindingSelector Selector refering to part.
 *     Optional; will be created by appending part to objSelector.
 * @return {!Do} The done status of the specified binding.
 */
ObjectDumper.prototype.dumpBinding = function(
    dumper, part, todo, objSelector, bindingSelector) {
  if (!objSelector) objSelector = this.getSelector();
  if (!objSelector) {
    throw new Error("can't dump unreferencable object");
  } else if (this.proto === undefined) {
    throw new Error("can't dump uncreated object " + this.getSelector(true));
  } else if (this.prune_ && this.prune_.has(part)) {
    return Do.RECURSE;  // Don't dump requested binding at all.
  } else if (this.skip_ && this.skip_.has(part)) {
    return this.getDone(part);  // Do nothing but don't lie about it.
  }

  if (!bindingSelector) {
    bindingSelector = new Selector(objSelector.concat(part));
  }
  var partRef = new Components(this, part);
  if (part === Selector.PROTOTYPE) {
    return this.dumpPrototype_(dumper, todo, partRef,
                               objSelector, bindingSelector);
  } else if (part === Selector.OWNER) {
    return this.dumpOwner_(dumper, todo, partRef,
                           objSelector, bindingSelector);
  } else if (typeof part === 'string') {
    return this.dumpProperty_(dumper, part, todo, partRef,
                              objSelector, bindingSelector);
  } else {
    throw new Error('Invalid part');
  }
};

/**
 * Generate JS source text to set the object's [[Owner]].
 * @private
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {!Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Components} partRef A reference to this object's [[Owner]] slot.
 * @param {!Selector} objSelector Selector refering to this object.
 * @param {!Selector} bindingSelector Selector refering to this
 *     object's [[Owner]] slot.
 * @return {!Do} The done status of the object's [[Owner]] slot.
 */
ObjectDumper.prototype.dumpOwner_ = function(
    dumper, todo, partRef, objSelector,bindingSelector) {
  var value = /** @type {?Interpreter.prototype.Object} */(this.obj.owner);
  if (todo >= Do.SET && this.doneOwner_ < Do.SET) {
    // Record owner connection.
    if (value !== null) {
      dumper.getObjectDumper_(value)
          .updateRef(dumper, new Components(this, Selector.OWNER));
    }
    dumper.write(
        dumper.exprForCall_('Object.setOwnerOf', [objSelector, value]),
        ';');
    this.doneOwner_ = (value === null) ? Do.RECURSE: Do.DONE;
  }
  return this.doneOwner_;
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
 * @param {!Components} partRef A reference to this object's property [key].
 * @param {!Selector} objSelector Selector refering to this object.
 * @param {!Selector} bindingSelector Selector refering to key.
 * @return {!Do} The done status of the specified property.
 */
ObjectDumper.prototype.dumpProperty_ = function(
    dumper, key, todo, partRef, objSelector, bindingSelector) {
  var pd = this.obj.getOwnPropertyDescriptor(key, dumper.intrp2.ROOT);
  if (!pd) {
    throw new RangeError("can't dump nonexistent property " + bindingSelector);
  }

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
      dumper.write(dumper.exprForSelector_(bindingSelector), ' = ',
                   dumper.exprFor_(value, partRef, false, funcName), ';');
      done = this.checkProperty(key, value, attr, pd);
    }

    // Output defineProperty call if useful.
    if (todo > done && done < Do.ATTR) {
      if (!attr) {
        attr = this.attributes[key] =
            {writable: false, enumerable: false, configurable: false};
      } else if (!attr.configurable) {
        dumper.warn(
            "Can't redefine non-configurable property " + bindingSelector);
        return done;
      }
      var items = [];
      if (attr.writable !== (pd.writable || todo < Do.SET)) {
        attr.writable = pd.writable || todo < Do.SET;
        items.push('writable: ' + attr.writable);
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
        // TODO(cpcallen): supply selector here?
        items.push('value: ' + dumper.exprFor_(value));
      }
      dumper.write(dumper.exprForBuiltin_('Object.defineProperty'), '(',
                   dumper.exprForSelector_(objSelector), ', ',
                   dumper.exprFor_(key), ', {', items.join(', '), '});');
      done = this.checkProperty(key, value, attr, pd);
    }
  }
  return done;
};

/**
 * Generate JS source text to set the object's [[Prototype]].
 * @private
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {!Do} todo How much to do.  Must be >= Do.DECL; > Do.SET ignored.
 * @param {!Components} partRef A reference to this object's [[Owner]] slot.
 * @param {!Selector} objSelector Selector refering to this object.
 * @param {!Selector} bindingSelector Selector refering to this
 *     object's [[Prototype]] slot.
 * @return {!Do} The done status of the object's [[Prototype]] slot.
 */
ObjectDumper.prototype.dumpPrototype_ = function(
    dumper, todo, partRef, objSelector, bindingSelector) {
  var value = this.obj.proto;
  if (todo >= Do.SET && this.doneProto_ < Do.SET) {
    // Record prototype connection.
    this.proto = value;
    if (value !== null) {
      dumper.getObjectDumper_(value)
          .updateRef(dumper, new Components(this, Selector.PROTOTYPE));
    }
    dumper.write(
        dumper.exprForCall_('Object.setPrototypeOf', [objSelector, value]),
        ';');
    this.doneProto_ = (value === null) ? Do.RECURSE: Do.DONE;
  }
  return this.doneProto_;
};

/**
 * Return the current 'done' status of an object binding.
 * @param {Selector.Part} part The part to get status for.
 * @return {!Do} The done status of the binding.
 */
ObjectDumper.prototype.getDone = function(part) {
  if (part === Selector.PROTOTYPE) {
    return this.doneProto_;
  } else if (part === Selector.OWNER) {
    return this.doneOwner_;
  } else if (typeof part === 'string') {
    var done = this.doneProp_[part];
    return done === undefined ? Do.UNSTARTED : done;
  } else {
    throw new TypeError('Invalid part');
  }
};

/**
 * Return a Selector for this object.  If preferred is true, the
 * preferred selector will be returned; this is the least-badness
 * Selecgtor in intrp2 for this.obj, but may not yet be a valid
 * selector at the current point in the dump.  Otherwise, the selector
 * returned will be the best known valid selector.  An Error will be
 * thrown if no valid selector exists.
 * @param {boolean=} preferred Return preferred selector?
 * @return {!Selector} A selector for this.obj.
 */
ObjectDumper.prototype.getSelector = function(preferred) {
  var /** !SubDumper */ sd = this;
  var /** !Array<Selector.Part> */ parts = [];
  while (sd instanceof ObjectDumper) {
    var /** ?Components */ next = preferred ? sd.preferredRef : sd.ref;
    if (!next) throw new Error('unreferenced object while building Selector');
    sd = next.dumper;
    parts.unshift(next.part);
  }
  if (!(sd instanceof ScopeDumper)) {
    throw new TypeError('unknown SubDumper subclass');
  } else  if (sd.scope.type !== Interpreter.Scope.Type.GLOBAL) {
    throw new Error('refusing to create Selector for non-global scope');
  }
  return new Selector(parts);
};

/**
 * Return the value of the given part of this.obj (i.e., the value
 * in intrp2, and the intended final value provided that it isn't
 * going to be pruned.)
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {Selector.Part} part The binding part to get the value of.
 * @return {Interpreter.Value} The value of that part.
 */
ObjectDumper.prototype.getValue = function(dumper, part) {
  if (typeof part === 'string') {
    return this.obj.get(part, dumper.intrp2.ROOT);
  } else if (part === Selector.PROTOTYPE) {
    return this.obj.proto;
  } else if (part === Selector.OWNER) {
    return /** @type{?Interpreter.prototype.Object} */(this.obj.owner);
  } else {
    throw new Error('unknown part type');
  }
};

/**
 * Return true iff the specifed property can be created or set by
 * assignment - i.e., that it exists and is writable, or doesn't exist
 * and does not inherit from a non-writable property on the prototype
 * chain.
 *
 * N.B. this not checking writability on intrp1 or intrp2, but on the
 * notional state of the interpreter at this point in the dump (i.e.,
 * somewhere in between the two), as recorded on the relevant
 * ObjectDumper .attibutes and .proto properties.
 *
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
      return dumper.getObjectDumper_(this.proto).isWritable(dumper, key);
    }
  }
};

/**
 * Return true iff this.object is currently reachable.
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @param {Selector.Part=} part The binding whose reachability is of
 *     interest.  Ignored, since all object bindings are always
 *     reachable if the object is.
 * @return {boolean}
 */
ObjectDumper.prototype.reachable = function(dumper, part) {
  return Boolean(this.ref) && this.ref.dumper.reachable(dumper, this.ref.part);
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
 * @param {Selector.Part} part The part to set status for.
 * @param {!Do} done The new done status of the binding.
 */
ObjectDumper.prototype.setDone = function(part, done) {
  var old = this.getDone(part);

  // Invariant checks.
  if (done <= old) {
    var fault = (done === old) ? 'Refusing redundant' : "Can't undo previous";
    var description = this.getSelector(/*preferred=*/true);
    throw new RangeError(fault + ' work on ' + part + ' of ' + description);
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
 * Visit an Object to prepare for dumping.  In particular:
 *
 * - If this.object is a UserFunction, record it on it's .scope's
 *   ScopeDumper's list of inner functions, so that when we go to dump
 *   that scope later we know all the functions that need to be
 *   declared within it.
 *
 * - Collect and return an array of {part, value}, where each
 *   represents a property or internal slot of this.object.  If
 *   this.object is a UserFunction, the returned array will also
 *   contain a bare ScopeDumper object representing the
 *   function's enclosing scope.
 *
 * @param {!Dumper} dumper Dumper to which this ObjectDumper belongs.
 * @return {!Array<OutwardEdge>}
 */
ObjectDumper.prototype.survey = function(dumper) {
  var /** !Array<OutwardEdge> */ adjacent = [];

  if (this.obj instanceof dumper.intrp2.UserFunction) {
    // Record this this function as inner to scope, and survey scope.
    var scopeDumper = dumper.getScopeDumper_(this.obj.scope);
    scopeDumper.innerFunctions.add(this);
    adjacent.push(scopeDumper);
  }

  adjacent.push({part: Selector.PROTOTYPE, value: this.obj.proto});
  var ownerObj = /** @type {!Interpreter.prototype.Object} */(this.obj.owner);
  adjacent.push({part: Selector.OWNER, value: ownerObj});
  var keys = this.obj.ownKeys(dumper.intrp2.ROOT);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = this.obj.get(key, dumper.intrp2.ROOT);
    adjacent.push({part: key, value: value});
  }

  return adjacent;
};

/**
 * Record a new reference to the object, if it is 'better' than the
 * existing one.  'Better' means, in order of priority:
 *
 * - Ignore references from self entirely.
 * - Prefer any reference over no reference.
 * - Prefer references from reachable objects over ones from
 *   unreachable objects.
 * - If both existing (this.ref) and proposed (ref) .dumpers are reachable:
 *   - Prefer .preferredRef over others, otherwise
 *   - Prefer reference with lowest overall badness.
 * - If neither .dumper is reachable, prefer reference with lowest overall
 *   badness when using .dumpers's .preferredRef instead.
 *
 * @param {!Dumper} dumper The Dumper to which this ObjectDumber belongs.
 * @param {!Components} ref The new reference.
 * @return {void}
 */
ObjectDumper.prototype.updateRef = function(dumper, ref) {
  if (ref.dumper === this) return;  // Ignore references from self entirely.
  if (!this.ref) {  // Prefer any reference over no reference.
    this.ref = ref;
    return;
  }
  if (this.ref.isReachable(dumper)) {
    if (ref.isReachable(dumper)) {  // Both existing and new refs reachable.
      if (this.preferredRef) {  // Prefer .preferredRef over others.
        if (this.preferredRef.equals(this.ref)) {
          return;
        } else if(this.preferredRef.equals(ref)) {
          this.ref = ref;
          return;
        }
      }
      // Otherwise, prefer ref with lowest overall badness.
      var oldBadness = this.getSelector().badness();
      var newBadness = Selector.partBadness(ref.part);
      if (ref.dumper instanceof ObjectDumper) {
        newBadness += ref.dumper.getSelector().badness();
      }
      if (newBadness < oldBadness) this.ref = ref;
    }
  } else {
    if (ref.isReachable(dumper)) {  // Existing ref unreachable but new ref is!
      this.ref = ref;
    } else {  // Neither existing nor new refs reachable.
      var oldBadness =
          Selector.partBadness(this.ref.part) + 
          (this.ref.dumper instanceof ObjectDumper ?
           this.ref.dumper.getSelector(/*preferred=*/true).badness() :
           0);
      var newBadness =
          Selector.partBadness(ref.part) + 
          (ref.dumper instanceof ObjectDumper ?
           ref.dumper.getSelector(/*preferred=*/true).badness() :
           0);
      if (newBadness < oldBadness) this.ref = ref;
    }
  }
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
 * @struct
 * @param {!Selector} binding A binding awaiting recursive completion
 *     of its value object.
 * @param {!ObjectDumper} valueDumper The ObjectDumper for the object
 *     which is the value of binding.
 */
ObjectDumper.Pending = function(binding, valueDumper) {
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
ObjectDumper.Pending.prototype.add = function(binding, valueDumper) {
  if (!binding) throw new Error('no binding');
  if (!valueDumper) throw new Error('no valueDumper');
  this.bindings.push(binding);
  this.dependencies.push(valueDumper);
};

/**
 * Merge another pending list into this one.
 * @param {!ObjectDumper.Pending} that Another Pending list.
 */
ObjectDumper.Pending.prototype.merge = function(that) {
  this.bindings = this.bindings.concat(that.bindings);
  this.dependencies = this.dependencies.concat(that.dependencies);
};

/** @override */
ObjectDumper.Pending.prototype.toString = function() {
  return '{bindings: [' + this.bindings.join(', ') + '], ' +
      'dependencies: [' + this.dependencies.map(function(od) {
        return String(od.getSelector(/*preferred=*/true));
      }).join(', ') + ']}';
};

///////////////////////////////////////////////////////////////////////////////
// Helper Classes.

/**
 * A {SubDumper, Selector.Part} tuple.
 *
 * N.B.: the usage of 'components' here is analagous to that term's
 * usage in interpreter.js but not identical: there is is a [scope,
 * variable] tuple; here it is a {ScopeDumper/ObjectDumper,
 * Selector.Part} tuple.
 *
 * @constructor
 * @struct
 * @param {!SubDumper} dumper
 * @param {Selector.Part} part
 */
var Components = function(dumper, part) {
  /** @const {!SubDumper} */ this.dumper = dumper;
  /** @const {Selector.Part} */ this.part = part;
};

/**
 * Return true iff this and that represent the same binding.
 * @param {!Components} that Another Components to compare this with.
 * @return {boolean}
 */
Components.prototype.equals = function(that) {
  return this.dumper === that.dumper && this.part === that.part;
};

/**
 * Return true iff this reference is currently reachable.
 * @param {!Dumper} dumper Dumper to which this Components belongs.
 * @return {boolean}
 */
Components.prototype.isReachable = function(dumper) {
  return this.dumper.reachable(dumper, this.part);
};

/**
 * Custom util.inspect implementation, to make debug/test output more
 * readable.
 * @param {number} depth
 * @param {util.inspect.Options} opts
 * @return {string}
 */
Components.prototype[util.inspect.custom] = function(depth, opts) {
  var /** string */ dumper;
  if (this.dumper instanceof ScopeDumper) {
    dumper = util.format('<%s scope>', this.dumper.scope.type);
  } else if (this.dumper instanceof ObjectDumper) {
    try {
      dumper = this.dumper.getSelector(/*preferred=*/true).toString();
    } catch (e) {
      dumper = '<unknown>';
    }
  }
  return util.format('[%s.%s]', dumper, this.part);
};

///////////////////////////////////////////////////////////////////////////////
// Type declarations: Do, etc.

/**
 * Possible things to do (or have done) with a variable / property /
 * etc. binding.  N.B.: values meaning "don't do this one (yet)"
 * are negative, "nothing done" is zero (and therefore falsey), and
 * "some work has been done" are positive.
 *
 * Code should not depend on the numeric values of the enum options,
 * but it is permissiible to depend on the options being in numeric
 * order of ascending completion - i.e., Do.x implies Do.y if Do.x >=
 * Do.y.
 *
 * @enum {number}
 */
var Do = {
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
   * provided as an alias for bindings (like variables,
   * [[Prototype]] and [[Owner]] that don't have attributes; for
   * those, SET should automatically be promoted to DONE.
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

/**
 * Options object for Dumper.
 * @record
 */
var DumperOptions = function() {};
/**
 * The stream that this.write() will write to.  Setting it to null
 * (the default) will cause cause .write() to do nothing, causing
 * dumped code to be lost.
 * @type {?Writable|undefined}
 */
DumperOptions.prototype.output;
/**
 * Skip the named bindings.
 * @type {!Array<Selector.Part>|undefined}
 */
DumperOptions.prototype.skipBindings;
/**
 * If true, limit recursive dumping to the spaning tree defined by the
 * preferred selectors.
 *
 * E.g.: Noting that Object{proto}, Fucntion{proto} and
 * Function.prototype are the same object.  If treeOnly is true (the
 * default), then:
 *
 * * Dumping Object recursively would set Object{proto} but not visit
 *   Function.prototype at all, while
 * * Dumping Function recursively would set Function{proto} but
 *   recurse into Function.prototype.
 *
 * On the other hand, if treeOnly is false, then dumping Object
 * recursively would recurse into Object{proto} (i.e.,
 * Function.prototype by a different name), and dumping Function might
 * choose ot recurse via Function{proto} rather than
 * Function.prototype.
 *
 * @type {boolean|undefined}
 */
DumperOptions.prototype.treeOnly;
/**
 * Print status information and warnings to the console?
 * @type {boolean|undefined}
 */
DumperOptions.prototype.verbose;

/**
 * Default options for Dumper.
 * @const @type {!DumperOptions}
 */
var DEFAULT_OPTIONS = {
  output: null,
  skipBindings: [],
  treeOnly: true,
  verbose: false,
};

/**
 * A value representing an outward edge (from an unspecified object)
 * on the object graph.
 *
 * - Outward edges that are properties or internal slots are
 *   represented as a {Selector.Part, Interpreter.Value} tuple.
 * - Outward edges that are the enclosing scope of a UserFunction are
 *   represented by a bare ScopeDumper.
 * @typedef {{part: Selector.Part, value: Interpreter.Value}|!ScopeDumper}
 */
var OutwardEdge;

/**
 * A writable stream.  Could be a stream.Writable, but we don't check
 * the return value of .write to see if it's safe to keep writing, so
 * caller might prefer to supply a synchronous implementation instead!
 * @interface
 */
var Writable = function() {};

/**
 * Write a string to the writable stream.
 * @param {string} s
 */
Writable.prototype.write = function(s) {};

///////////////////////////////////////////////////////////////////////////////
// Exports.

exports.Do = Do;
exports.Dumper = Dumper;
exports.DumperOptions = DumperOptions;
exports.Writable = Writable;

// For unit testing only!
exports.testOnly = {
  Components: Components,
  ObjectDumper: ObjectDumper,
  ScopeDumper: ScopeDumper,
};
