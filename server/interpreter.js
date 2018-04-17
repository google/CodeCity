/**
 * @license
 * Code City: JavaScript Interpreter
 *
 * Copyright 2013 Google Inc.
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
 * @fileoverview Interpreting JavaScript in JavaScript.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var acorn = require('acorn');
var net = require('net');

// Create an Acorn plugin called 'alwaysStrict'.
acorn.plugins.alwaysStrict = function(parser, configValue) {
  parser.extend('strictDirective', function(nextMethod) {
    return function strictDirective(start) {
      return configValue;
    };
  });
};

/**
 * Create a new interpreter.
 * @constructor
 */
var Interpreter = function() {
  this.installTypes();
  /**
   * Map of builtins - e.g. Object, Function.prototype, Array.pop, etc.
   * @private @const {Object<Interpreter.Value>}
   */
  this.builtins_ = Object.create(null);
  /**
   * For cycle detection in array to string and error conversion; see
   * spec bug github.com/tc39/ecma262/issues/289. At the moment this
   * is used only for actions which are atomic (i.e., take place
   * entirely within the duration of a single call to .step), so it
   * could be a global or class property, but better to have it be
   * per-instance so that we can eventually call user toString
   * methods.
   *
   * TODO(cpcallen): Make this per-thread when threads are introduced.
   * @private @const {!Array<!Interpreter.prototype.Object>}
   */
  this.toStringCycles_ = [];

  /**
   * The interpreter's global scope.
   * @const {!Interpreter.Scope}
   */
  this.global = new Interpreter.Scope(/** @type {?} */ (undefined), null);
  // Create builtins and (minimally) initialize global scope:
  this.initBuiltins_();

  /**  @private @const {!Array<!Interpreter.Thread>} */
  this.threads = [];
  /** @private @type {?Interpreter.Thread} */
  this.thread = null;
  /** @private (Type is whatever is returned by setTimeout()) */
  this.runner_ = null;
  /** @type {boolean} */
  this.done = true;  // True if any non-ZOMBIE threads exist.

  /** @private @const {!Object<number,!Interpreter.prototype.Server>} */
  this.listeners_ = Object.create(null);

  // Bring interpreter up to PAUSED status, setting up timers etc.
  /** @type {!Interpreter.Status} */
  this.status = Interpreter.Status.STOPPED;
  /** @private @type {number} */
  this.previousTime_ = 0;
  /** @private @type {number} */
  this.cumulativeTime_ = 0;
  this.pause();
};

/**
 * Interpreter statuses.
 * @enum {number}
 */
Interpreter.Status = {
  /**
   * Won't run code.  Any listening sockets are unlistened.  No time
   * passes (as measured by .uptime() and .now(), which underly
   * setTimeout etc.)
   */
  STOPPED: 0,

  /**
   * Will run code *only* if .step() or .run() is called.  Will listen
   * on network sockets (including re-listening on any that were
   * unlistened because the interpreter was stopped).  Time will pass
   * (as measured by .uptime() and .now()).
   */
  PAUSED: 1,

  /**
   * Will run code automatically in response to thread creation,
   * timeouts and network activity.
   */
  RUNNING: 2
};

/**
 * @const {!Object} Configuration used for all Acorn parsing.
 */
Interpreter.PARSE_OPTIONS = {
  ecmaVersion: 5,
  plugins: {alwaysStrict: true}
};

/**
 * Class for unique sentinel values passed to various functions.
 * Declared so that sentinel values can have a specific type that we
 * can type-check against (though as they share a single type you
 * could still pass the wrong sentinel value to a function).
 * @constructor
 */
Interpreter.Sentinel = function Sentinel() {};

/**
 * Unique sentinel for indicating that a reference is a variable on the scope,
 * not an object property.
 */
Interpreter.SCOPE_REFERENCE = new Interpreter.Sentinel();

/**
 * Return a monotonically increasing count of milliseconds since this
 * Interpreter was last brought to PAUSED or RUNNING status from
 * STOPPED.  This excludes time when Node was suspended by the host OS
 * (say, because the machine was asleep).
 * @return {number} Elapsed time in milliseconds.
 */
Interpreter.prototype.uptime = function() {
  var t = process.hrtime(this.hrStartTime_);
  return t[0] * 1000 + t[1] / 1000000;
};

/**
 * Return a monotonically increasing count of milliseconds since this
 * Interpreter instance was created.  In the event of an interpreter
 * being serialized / deserialized, this count will continue from
 * where it left off before serialization.
 * @return {number} Elapsed total time in milliseconds.
 */
Interpreter.prototype.now = function() {
  return this.uptime() + this.previousTime_;
};

/**
 * Create a new thread and add it to .threads.  New thread runs with
 * same permissions (i.e., owner) as global scope was created with.
 * @param {!Interpreter.State|!Interpreter.Node|string} runnable Initial
 *     state, or AST node to construct state from, or raw JavaScript
 *     text to parse into AST.
 * @param {number=} runAt Time at which thread should begin execution
 *     (default: now).
 * @return {number} thread ID.
 */
Interpreter.prototype.createThread = function(runnable, runAt) {
  var source = '';
  if (typeof runnable === 'string') {
    source = runnable;
    // Acorn may throw a Syntax error, but it's the caller's problem.
    runnable = acorn.parse(runnable, Interpreter.PARSE_OPTIONS);
    runnable['source'] = source;
  }
  if (runnable instanceof Interpreter.Node) {
    if (runnable['type'] !== 'Program') {
      throw Error('Expecting AST to start with a Program node.');
    }
    this.populateScope_(runnable, this.global, source);
    runnable = new Interpreter.State(runnable, this.global);
  } else if (!(runnable instanceof Interpreter.State)) {
    throw TypeError("Can't create thread for " + runnable);
  }
  var id = this.threads.length;
  var thread = new Interpreter.Thread(id, runnable, runAt || this.now());
  this.threads.push(thread);
  this.go_();
  return id;
};

/**
 * Create a new thread to execute a particular function call.
 * @param {!Interpreter.prototype.Function} func Function to call.
 * @param {Interpreter.Value} thisVal value of 'this' in function call.
 * @param {!Array<Interpreter.Value>} args Arguments to pass.
 * @param {number=} runAt Time at which thread should begin execution
 *     (default: now).
 * @return {number} thread ID.
 */
Interpreter.prototype.createThreadForFuncCall = function(
    func, thisVal, args, runAt) {
  // TODO(cpcallen:perms): add perms argument.
  var state = Interpreter.State.newForCall(func, thisVal, args, this.ROOT);
  return this.createThread(state, runAt);
};

/**
 * Schedule the next runnable thread.  Returns 0 if a READY thread
 * successfuly scheduled; otherwise returns earliest .runAt time
 * amongst SLEEPING threads (if any), or Number.MAX_VALUE if there are
 * none.  If there are additionally no BLOCKED threads left (i.e.,
 * there are no non-ZOMBIE theads at all) it will also set .done to
 * true.
 * @return {number} See description.
 */
Interpreter.prototype.schedule = function() {
  var now = this.now();
  var runAt = Number.MAX_VALUE;
  var threads = this.threads;
  // Assume all remaining threads are ZOMBIEs until proven otherwise.
  this.done = true;
  this.thread = null;
  // .threads will be very sparse, so use for-in loop.
  for (var i in threads) {
    i = Number(i);  // Make Closure Compiler happy.
    if (!threads.hasOwnProperty(i)) {
      continue;
    }
    switch (threads[i].status) {
      case Interpreter.Thread.Status.ZOMBIE:
        // Remove zombie from threads.
        delete threads[i];
        continue;
      case Interpreter.Thread.Status.BLOCKED:
        // Ignore blocked threads except noting existence.
        this.done = false;
        continue;
      case Interpreter.Thread.Status.SLEEPING:
        if (threads[i].runAt > now) {
          runAt = Math.min(runAt, threads[i].runAt);
          this.done = false;
          continue;
        }
        // Done sleeping; wake thread.
        threads[i].status = Interpreter.Thread.Status.READY;
        // fall through
      case Interpreter.Thread.Status.READY:
        // Is this this most-overdue thread found so far?
        if (threads[i].runAt < runAt) {
          this.thread = threads[i];
          runAt = this.thread.runAt;
        }
        this.done = false;
        break;
      default:
        throw Error('Unknown thread state');
    }
  }
  return runAt < now ? 0 : runAt;
};

/**
 * Execute one step of the interpreter.
 * @return {boolean} True if a step was executed, false if no more
 *     READY threads.
 */
Interpreter.prototype.step = function() {
  /* NOTE: Beware that an async (user) Function might reject
   * immediately, unwinding the stack before the CallExpression step
   * function returns.
   */
  if (this.status !== Interpreter.Status.PAUSED) {
    throw Error('Can only step paused interpreter');
  }
  if (!this.thread || this.thread.status !== Interpreter.Thread.Status.READY) {
    if (this.schedule() > 0) {
      return false;
    }
  }
  var thread = this.thread;
  var stack = thread.stateStack_;
  var state = stack[stack.length - 1];
  var node = state.node;
  try {
    var nextState = stepFuncs_[node['type']].call(this, stack, state, node);
  } catch (e) {
    if (e instanceof Error) {
      // Uh oh.  This is a real error in the interpreter.  Kill thread
      // and rethrow.
      thread.status = Interpreter.Thread.Status.ZOMBIE;
      throw e;
    } else if (!(e instanceof this.Object) && e !== null &&
        (typeof e === 'object' || typeof e === 'function')) {
      throw TypeError('Unexpected exception value ' + String(e));
    }
    this.unwind_(thread, Interpreter.CompletionType.THROW, e, undefined);
  }
  if (nextState) {
    stack.push(nextState);
  }
  if (stack.length === 0) {
    thread.status = Interpreter.Thread.Status.ZOMBIE;
  }
  return true;
};

/**
 * Execute the interpreter to program completion.  Vulnerable to
 * infinite loops.  Alternates between waking any past-due SLEEPING
 * threads and running the most-overdue READY thread until there are
 * no more READY threads, then returns an integer as follows:
 *
 * - If there are SLEEPING threads, then a positive number that is the
 *   smallest .runAt value of any sleeping thread.
 * - If there are no SLEEPING threads, but there are BLOCKED threads
 *   then a negative number is returned.
 * - If only ZOMBIE threads remain, then zero is returned.
 * @return {number} See description.
 */
Interpreter.prototype.run = function() {
  /* NOTE: Beware that an async (user) Function might reject
   * immediately, unwinding the stack before the CallExpression step
   * function returns.
   */
  if (this.status === Interpreter.Status.STOPPED) {
    throw Error("Can't run stopped interpreter");
  }
  var t;
  while ((t = this.schedule()) === 0) {
    var thread = this.thread;
    var stack = thread.stateStack_;
    while (thread.status === Interpreter.Thread.Status.READY) {
      var state = stack[stack.length - 1];
      var node = state.node;
      try {
        var nextState = stepFuncs_[node['type']].call(this, stack, state, node);
      } catch (e) {
        if (e instanceof Error) {
          // Uh oh.  This is a real error in the interpreter.  Kill
          // thread and rethrow.
          thread.status = Interpreter.Thread.Status.ZOMBIE;
          throw e;
        } else if (typeof e !== 'boolean' && typeof e !== 'number' &&
            typeof e !== 'string' && e !== undefined && e !== null &&
            !(e instanceof this.Object)) {
          throw TypeError('Unexpected exception value ' + String(e));
        }
        this.unwind_(thread, Interpreter.CompletionType.THROW, e, undefined);
        nextState = undefined;
      }
      if (nextState) {
        stack.push(nextState);
      }
      if (stack.length === 0) {
        thread.status = Interpreter.Thread.Status.ZOMBIE;
      }
    }
  }
  if (t === Number.MAX_VALUE) {
    return this.done ? 0 : -1;
  }
  return t;
};

/**
 * If interpreter status is RUNNING, use setTimeout to repeatedly call
 * .run() until there are no more sleeping threads.
 * @private
 */
Interpreter.prototype.go_ = function() {
  // Ignore calls to .go_ when PAUSED or STOPPED
  if (this.status !== Interpreter.Status.RUNNING) {
    return;
  }
  // Kill any existing runner and restart.
  if (this.runner_) clearTimeout(this.runner_);
  var intrp = this;
  this.runner_ = setTimeout(function runner() {
    // Invariant check: pausing or stopping interpreter should cancel
    // timeout, so we should never get here while it is not RUNNING.
    if (intrp.status !== Interpreter.Status.RUNNING) {
      throw Error('Un-cancelled runner on non-RUNNING interpreteter');
    }
    // N.B.: .run may indirectly call .go_ or even .pause or .stop
    // (e.g. via native function calling .createThread, .pause, etc.).
    var r = intrp.run();
    if (intrp.runner_) {
      // Clear any outstanding timeout.  This might be the
      // just-completed one that called this invocation of runner, but
      // it might be a new one created by a reentrant call to .go_
      // (e.g. via .run -> [native function] -> .createThread).
      clearTimeout(intrp.runner_);
      intrp.runner_ = null;
    }
    if (r > 0 && intrp.status === Interpreter.Status.RUNNING) {
      // No more code to run right now, but there is an outstanding
      // userland timeout, so set up a future reinvocation of runner
      // when it's time for that to run.
      intrp.runner_ = setTimeout(runner, r - intrp.now());
    }
  });
};

/**
 * Set the interpreter status to RUNNING and kick it into action if
 * there is anything to do.
 */
Interpreter.prototype.start = function() {
  if (this.status !== Interpreter.Status.RUNNING) {
    // Take care of STOPPED -> PAUSED transition if required.
    this.pause();
  }
  this.status = Interpreter.Status.RUNNING;
  this.go_();
};

/**
 * Set the interpreter status to PAUSED.  If it was previously
 * STOPPED, begin listening on any listened ports.  If it was
 * previously RUNNING, ensure the interpreter takes no further action
 * of its own.
 *
 * Call this function before serializing a RUNNING or PAUSED
 * interpreter to ensure correct timer restoration when deserializing.
 * (No need to call it if instance is already STOPPED.)
 */
Interpreter.prototype.pause = function() {
  switch (this.status) {
    case Interpreter.Status.RUNNING:
      clearTimeout(this.runner_);
      this.runner_ = null;
      this.cumulativeTime_ = this.now();  // Save elapsed time.
      break;
    case Interpreter.Status.PAUSED:
      // No state change; just update elapsed time.
      this.cumulativeTime_ = this.now();
      break;
    case Interpreter.Status.STOPPED:
      // Re-listen to any previously listened ports:
      for (var port in this.listeners_) {
        var intrp = this;
        var server = this.listeners_[Number(port)];
        server.listen(undefined, function(error) {
          // Something went wrong while re-listening.  Maybe port in use.
          console.log('Re-listen on port %s failed: %s: %s', server.port,
                      error.name, error.message);
          // Report this to userland by calling .onError on proto
          // (with this === proto) - for lack of a better option.
          var func = server.proto.get('onError', intrp.ROOT);
          if (func instanceof intrp.Function && func.owner !== null) {
            var userError = intrp.nativeToPseudo(error, func.owner);
            intrp.createThreadForFuncCall(func, server.proto, [userError]);
          }
        });
      }
      // Reset .uptime() to start counting from *NOW*, and .now() to
      // continue from where it was before the interpreter was stopped.
      this.previousTime_ = this.cumulativeTime_;
      this.hrStartTime_ = process.hrtime();
  }
  this.status = Interpreter.Status.PAUSED;
};

/**
 * Set the interpreter status to STOPPED, stop listening on any port
 * (but do not close any open sockets), and ensure the interpreter
 * takes no further action of its own.
 */
Interpreter.prototype.stop = function() {
  if (this.status === Interpreter.Status.STOPPED) {
    return;
  }
  // Do RUNNING -> PAUSED transition if required; update elapsed time.
  this.pause();
  // Unlisten to network sockets.
  for (var port in this.listeners_) {
    this.listeners_[Number(port)].unlisten();
  }
  this.status = Interpreter.Status.STOPPED;
};

/**
 * Create and register the builtin classes and functions specified in
 * the ECMAScript specification plus our extensions.  Add a few items
 * (e.g., eval) to the global scope that can't be added any other way.
 * @private
 */
Interpreter.prototype.initBuiltins_ = function() {
  // Initialize uneditable global properties.
  this.addVariableToScope(this.global, 'NaN', NaN, true);
  this.addVariableToScope(this.global, 'Infinity', Infinity, true);
  this.addVariableToScope(this.global, 'undefined', undefined, true);
  this.addVariableToScope(this.global, 'this', undefined, true);

  // Create the objects which will become Object.prototype and
  // Function.prototype, which are needed to bootstrap everything else.
  this.OBJECT = new this.Object(null, null);
  this.builtins_['Object.prototype'] = this.OBJECT;

  // Create the object that will own all of the system objects.
  var root = new this.Object(null, this.OBJECT);
  this.ROOT = /** @type {!Interpreter.Owner} */ (root);
  this.builtins_['CC.root'] = root;
  this.global.perms = this.ROOT;
  // Retroactively apply root ownership to Object.prototype:
  this.OBJECT.owner = this.ROOT;

  // NativeFunction constructor adds new function to the map of builtins.
  this.FUNCTION = new this.NativeFunction({
    id: 'Function.prototype', name: '', length: 0, proto: this.OBJECT,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) { /* do nothing */ }
  });

  // Initialize global objects.
  this.initObject_();
  this.initFunction_();
  this.initArray_();
  this.initString_();
  this.initBoolean_();
  this.initNumber_();
  this.initDate_();
  this.initRegExp_();
  this.initError_();
  this.initMath_();
  this.initJSON_();
  this.initWeakMap_();
  this.initPerms_();

  // Initialize ES standard global functions.
  var intrp = this;

  var eval_ = new this.NativeFunction({
    id: 'eval', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var code = args[0];
      if (typeof code !== 'string') {  // eval()
        // Eval returns the argument if the argument is not a string.
        // eval(Array) -> Array
        return code;
      }
      try {
        var ast = acorn.parse(code, Interpreter.PARSE_OPTIONS);
      } catch (e) {
        // Acorn threw a SyntaxError.  Rethrow as a trappable error.
        throw intrp.errorNativeToPseudo(e, state.scope.perms);
      }
      var evalNode = new Interpreter.Node;
      evalNode['type'] = 'EvalProgram_';
      evalNode['body'] = ast['body'];
      evalNode['source'] = code;
      // Create new scope and update it with definitions in eval().
      var outerScope = state.info_.directEval ? state.scope : intrp.global;
      var scope = new Interpreter.Scope(state.scope.perms, outerScope);
      intrp.populateScope_(ast, scope, code);
      thread.stateStack_.push(new Interpreter.State(evalNode, scope));
      state.value = undefined;  // Default value if no explicit return.
      return FunctionResult.AwaitValue;
    }
  });
  // eval is a special case; it must be added to the global scope at
  // startup time (rather than by a "var eval = new 'eval';" statement
  // in es5.js) because binding eval is illegal in strict mode.
  this.addVariableToScope(this.global, 'eval', eval_);

  this.createNativeFunction('isFinite', isFinite, false);
  this.createNativeFunction('isNaN', isNaN, false);
  this.createNativeFunction('parseFloat', parseFloat, false);
  this.createNativeFunction('parseInt', parseInt, false);

  var strFunctions = [
    [escape, 'escape'], [unescape, 'unescape'],
    [decodeURI, 'decodeURI'], [decodeURIComponent, 'decodeURIComponent'],
    [encodeURI, 'encodeURI'], [encodeURIComponent, 'encodeURIComponent']
  ];
  for (var i = 0; i < strFunctions.length; i++) {
    var wrapper = (function(nativeFunc) {
      return function(str) {
        try {
          return nativeFunc(str);
        } catch (e) {
          // decodeURI('%xy') will throw an error.  Catch and rethrow.
          throw intrp.errorNativeToPseudo(e, intrp.thread.perms());
        }
      };
    })(strFunctions[i][0]);
    this.createNativeFunction(strFunctions[i][1], wrapper, false);
  }

  // Initialize CC-specific globals.
  this.initThreads_();
  this.initNetwork_();
};

/**
 * Initialize the Object class.
 * @private
 */
Interpreter.prototype.initObject_ = function() {
  // Object constructor.
  new this.NativeFunction({
    id: 'Object', length: 1,
    /** @type {!Interpreter.NativeConstructImpl} */
    construct: function(intrp, thread, state, args) {
      var value = args[0];
      if (value instanceof intrp.Object) {
        return value;
      } else if (typeof value === 'boolean' || typeof value === 'number' ||
          typeof value === 'string') {
        // No boxed primitives in Code City.
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'Boxed primitives not supported.');
      } else if (value === undefined || value === null) {
        return new intrp.Object(state.scope.perms);
      } else {
        throw TypeError('Unknown value type??');
      }
    },
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return this.construct.call(this, intrp, thread, state, args);
    }
  });

  var intrp = this;

  /**
   * Checks if the provided value is null or undefined.
   * If so, then throw an error in the call stack.
   * @param {Interpreter.Value} value Value to check.
   */
  var throwIfNullUndefined = function(value) {
    if (value === undefined || value === null) {
      // TODO(cpcallen): use state.scope.perms instead.
      throw new intrp.Error(intrp.thread.perms(), intrp.TYPE_ERROR,
          "Cannot convert '" + value + "' to object");
    }
  };

  // Static methods on Object.
  this.createNativeFunction('Object.is', Object.is, false);

  new this.NativeFunction({
    id: 'Object.getOwnPropertyNames', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      throwIfNullUndefined(obj);
      if (obj instanceof intrp.Object) {
        var keys = obj.ownKeys(state.scope.perms);
      } else {  // obj is actually a primitive.
        // N.B.: we use ES6 definition; ES5.1 would throw TypeError.
        // TODO(cpcallen): the cast below is just to satisfy
        // closure-compiler which by default assumes input language is
        // ES5.1.  Remove it once compiler knows we use ES6.
        keys = Object.getOwnPropertyNames(/** @type{?} */ (obj));
      }
      return intrp.arrayNativeToPseudo(keys, state.scope.perms);
    }
  });

  new this.NativeFunction({
    id: 'Object.keys', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = state.scope.perms;
      var obj = intrp.toObject(args[0], perms);
      return intrp.arrayNativeToPseudo(obj.ownKeys(perms), perms);
    }
  });

  new this.NativeFunction({
    id: 'Object.create', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var proto = args[0];
      // Support for the second argument is the responsibility of a polyfill.
      if (proto === null) {
        return new intrp.Object(state.scope.perms, null);
      }
      if (!(proto === null || proto instanceof intrp.Object)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'Object prototype may only be an Object or null');
      }
      return new intrp.Object(state.scope.perms, proto);
    }
  });

  new this.NativeFunction({
    id: 'Object.defineProperty', length: 3,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      var key = args[1];
      var attr = args[2];
      var perms = state.scope.perms;
      if (!(obj instanceof intrp.Object)) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'Object.defineProperty called on non-object');
      }
      key = String(key);
      if (!(attr instanceof intrp.Object)) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'Property description must be an object');
      }
      // Can't just use pseudoToNative since descriptors can inherit properties.
      var desc = new Descriptor;
      if (attr.has('configurable', perms)) {
        desc.configurable = Boolean(attr.get('configurable', perms));
      }
      if (attr.has('enumerable', perms)) {
        desc.enumerable = Boolean(attr.get('enumerable', perms));
      }
      if (attr.has('writable', perms)) {
        desc.writable = Boolean(attr.get('writable', perms));
      }
      if (attr.has('value', perms)) {
        desc.value = attr.get('value', perms);
      }
      obj.defineProperty(key, desc, perms);
      return obj;
    }
  });

  new this.NativeFunction({
    id: 'Object.getOwnPropertyDescriptor', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      var prop = args[1];
      var perms = state.scope.perms;
      if (!(obj instanceof intrp.Object)) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'Object.getOwnPropertyDescriptor called on non-object');
      }
      prop = String(prop);
      var pd = obj.getOwnPropertyDescriptor(prop, perms);
      if (!pd) {
        return undefined;
      }
      var descriptor = new intrp.Object(perms);
      descriptor.set('configurable', pd.configurable, perms);
      descriptor.set('enumerable', pd.enumerable, perms);
      descriptor.set('writable', pd.writable, perms);
      descriptor.set('value', pd.value, perms);
      return descriptor;
    }
  });

  new this.NativeFunction({
    id: 'Object.getPrototypeOf', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      throwIfNullUndefined(obj);
      // TODO(cpcallen): behaviour of our getPrototype is wrong for
      // getPrototypeOf according to ES5.1 (but correct for ES6).
      return intrp.getPrototype(obj);
    }
  });

  new this.NativeFunction({
    id: 'Object.setPrototypeOf', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      var proto = args[1];
      throwIfNullUndefined(obj);
      if (proto !== null && !(proto instanceof intrp.Object)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'Object prototype may only be an Object or null');
      }
      if (!(obj instanceof intrp.Object)) {
        return obj;
      }
      // TODO(cpcallen): actually implement prototype change.
      return obj;
    }
  });

  new this.NativeFunction({
    id: 'Object.isExtensible', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      if (!(obj instanceof intrp.Object)) {
        return false;  // ES6 §19.1.2.11.  ES5.1 would throw TypeError.
      }
      return obj.isExtensible(state.scope.perms);
    }
  });

  new this.NativeFunction({
    id: 'Object.preventExtensions', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      var perms = state.scope.perms;
      if (!(obj instanceof intrp.Object)) {
        return obj;  // ES6 §19.1.2.15.  ES5.1 would throw TypeError.
      }
      if (!obj.preventExtensions(perms)) {
        // Can only happen once we have Proxy objects.
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            obj.toString() + " can't be made non-extensible.");
      }
      return obj;
    }
  });

  // Instance methods on Object.
  this.createNativeFunction('Object.prototype.toString',
                            this.Object.prototype.toString, false);
  this.createNativeFunction('Object.prototype.toLocaleString',
                            this.Object.prototype.toLocaleString, false);
  this.createNativeFunction('Object.prototype.valueOf',
                            this.Object.prototype.valueOf, false);


  new this.NativeFunction({
    id: 'Object.prototype.hasOwnProperty', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var key = args[0];
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      return Boolean(obj.getOwnPropertyDescriptor(String(key), perms));
    }
  });

  new this.NativeFunction({
    id: 'Object.prototype.propertyIsEnumerable', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var key = String(args[0]);
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var desc = obj.getOwnPropertyDescriptor(key, perms);
      if (desc === undefined) {
        return false;
      }
      return desc.enumerable;
    }
  });

  new this.NativeFunction({
    id: 'Object.prototype.isPrototypeOf', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      while (true) {
        // Note, circular loops shouldn't be possible.
        // BUG(cpcallen): behaviour of getPrototype is wrong for
        // isPrototypeOf, according to either ES5.1 or ES6.
        obj = intrp.getPrototype(obj);
        if (obj === null) {
          // No parent; reached the top.
          return false;
        }
        if (obj === thisVal) {
          return true;
        }
      }
    }
  });
};

/**
 * Initialize the Function class.
 * @private
 */
Interpreter.prototype.initFunction_ = function() {
  var intrp = this;
  var wrapper;
  var identifierRegexp = /^[A-Za-z_$][\w$]*$/;
  // Function constructor.
  new this.NativeFunction({
    id: 'Function', length: 1,
    /** @type {!Interpreter.NativeConstructImpl} */
    construct: function(intrp, thread, state, args) {
      var argList = args.slice();
      if (args.length) {
        var code = String(argList.pop());
      } else {
        var code = '';
      }
      var argsStr = argList.join(',').trim();
      if (argsStr) {
        argsStr.split(/\s*,\s*/).map(function(name) {
          if (!identifierRegexp.test(name)) {
            throw new intrp.Error(state.scope.perms, intrp.SYNTAX_ERROR,
                'Invalid function argument: ' + name);
          }
        });
        argsStr = argList.join(', ');
      }
      // Acorn needs to parse code in the context of a function or
      // else 'return' statements will be syntax errors.
      var code = '(function(' + argsStr + ') {' + code + '})';
      try {
        var ast = acorn.parse(code, Interpreter.PARSE_OPTIONS);
      } catch (e) {
        // Acorn threw a SyntaxError.  Rethrow as a trappable error.
        throw intrp.errorNativeToPseudo(e, state.scope.perms);
      }
      if (ast['body'].length !== 1) {
        // Function('a', 'return a + 6;}; {alert(1);');
        // TODO: there must be a cleaner way to detect this!
        throw new intrp.Error(state.scope.perms, intrp.SYNTAX_ERROR,
            'Invalid code in function body');
      }
      // Interestingly, the scope for constructed functions is the global
      // scope, even if they were constructed in some other scope.
      return new intrp.UserFunction(
          ast['body'][0]['expression'], intrp.global, code, state.scope.perms);
    },
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return this.construct.call(this, intrp, thread, state, args);
    }
  });

  new this.NativeFunction({
    id: 'Function.prototype.toString', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var func = thisVal;
      if (!(func instanceof intrp.Function)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'Function.prototype.toString is not generic');
      }
      // TODO(cpcallen:perms): Perm check here?  Or in toString?
      return func.toString();
    }
  });

  new this.NativeFunction({
    id: 'Function.prototype.apply', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var func = thisVal;
      var thisArg = args[0];
      var argArray = args[1];
      var perms = state.scope.perms;
      if (!(func instanceof intrp.Function)) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            func + ' is not a function');
      } else if (argArray === null || argArray === undefined) {
        return func.call(intrp, thread, state, thisArg, []);
      } else if (!(argArray instanceof intrp.Object)) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'CreateListFromArrayLike called on non-object');
      }
      var argList = intrp.arrayPseudoToNative(argArray, perms);
      return func.call(intrp, thread, state, thisArg, argList);
    }
  });

  new this.NativeFunction({
    id: 'Function.prototype.call', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var func = thisVal;
      if (!(func instanceof intrp.Function)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            func + ' is not a function');
      }
      var thisArg = args[0];
      var argList = args.slice(1);
      return func.call(intrp, thread, state, thisArg, argList);
    }
  });
};

/**
 * Initialize the Array class.
 * @private
 */
Interpreter.prototype.initArray_ = function() {
  // Array prototype.
  this.ARRAY = new this.Array(this.ROOT, this.OBJECT);
  this.builtins_['Array.prototype'] = this.ARRAY;

  // Array constructor.
  new this.NativeFunction({
    id: 'Array', length: 1,
    /** @type {!Interpreter.NativeConstructImpl} */
    construct: function(intrp, thread, state, args) {
      var len = args[0];
      var perms = state.scope.perms;
      // TODO(ES6): Need to do GetPrototypeFromConstructor, ArrayCreate, etc.
      var arr = new intrp.Array(perms);
      if (args.length === 0) {  // ES6 §22.1.1.1
        // Nothing to do.
      } else if (args.length === 1) {
        if (typeof len !== 'number') {
          arr.defineProperty('0', Descriptor.wec.withValue(len), perms);
          var intLen = 1;
        } else {  // ES6 §22.1.1.2
          intLen = Interpreter.toUint32(len);
          if (intLen !== len) {
            throw new intrp.Error(perms, intrp.RANGE_ERROR,
                 'Invalid array length');
          }
        }
        arr.set('length', intLen, perms);
      } else {  // ES6 §22.1.1.3
        arr.set('length', args.length, perms);
        for (var k = 0; k < args.length; k++) {
          arr.defineProperty(
              String(k), Descriptor.wec.withValue(args[k]), perms);
        }
      }
      return arr;
    },
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return this.construct.call(this, intrp, thread, state, args);
    }
  });

  var intrp = this;
  var wrapper;
  var getInt = function(obj, def) {
    // Return an integer, or the default.
    var n = obj ? Math.floor(obj) : def;
    if (isNaN(n)) {
      n = def;
    }
    return n;
  };

  // Static methods on Array.
  wrapper = function(obj) {
    return obj instanceof intrp.Array;
  };
  this.createNativeFunction('Array.isArray', wrapper, false);

  // Instance methods on Array.
  this.createNativeFunction('Array.prototype.toString',
                            this.Array.prototype.toString, false);

  wrapper = function() {
    return Array.prototype.pop.apply(this.properties, arguments);
  };
  this.createNativeFunction('Array.prototype.pop', wrapper, false);

  wrapper = function(var_args) {
    return Array.prototype.push.apply(this.properties, arguments);
  };
  this.createNativeFunction('Array.prototype.push', wrapper, false);

  wrapper = function() {
    if (!this.properties.length) {
      return undefined;
    }
    var value = this.properties[0];
    for (var i = 1; i < this.properties.length; i++) {
      this.properties[i - 1] = this.properties[i];
    }
    this.properties.length--;
    delete this.properties[this.properties.length];
    return value;
  };
  this.createNativeFunction('Array.prototype.shift', wrapper, false);

  wrapper = function(var_args) {
    for (var i = this.properties.length - 1; i >= 0; i--) {
      this.properties[i + arguments.length] = this.properties[i];
    }
    this.properties.length += arguments.length;
    for (var i = 0; i < arguments.length; i++) {
      this.properties[i] = arguments[i];
    }
    return this.properties.length;
  };
  this.createNativeFunction('Array.prototype.unshift', wrapper, false);

  wrapper = function() {
    for (var i = 0; i < this.properties.length / 2; i++) {
      var tmp = this.properties[this.properties.length - i - 1];
      this.properties[this.properties.length - i - 1] = this.properties[i];
      this.properties[i] = tmp;
    }
    return this;
  };
  this.createNativeFunction('Array.prototype.reverse', wrapper, false);

  wrapper = function(index, howmany /*, var_args*/) {
    index = getInt(index, 0);
    if (index < 0) {
      index = Math.max(this.properties.length + index, 0);
    } else {
      index = Math.min(index, this.properties.length);
    }
    howmany = getInt(howmany, Infinity);
    howmany = Math.min(howmany, this.properties.length - index);
    var removed = new intrp.Array(intrp.thread.perms());
    // Remove specified elements.
    for (var i = index; i < index + howmany; i++) {
      removed.properties[removed.properties.length++] = this.properties[i];
      this.properties[i] = this.properties[i + howmany];
    }
    // Move other element to fill the gap.
    for (var i = index + howmany; i < this.properties.length - howmany; i++) {
      this.properties[i] = this.properties[i + howmany];
    }
    // Delete superfluous properties.
    for (var i = this.properties.length - howmany; i < this.properties.length; i++) {
      delete this.properties[i];
    }
    this.properties.length -= howmany;
    // Insert specified items.
    for (var i = this.properties.length - 1; i >= index; i--) {
      this.properties[i + arguments.length - 2] = this.properties[i];
    }
    this.properties.length += arguments.length - 2;
    for (var i = 2; i < arguments.length; i++) {
      this.properties[index + i - 2] = arguments[i];
    }
    return removed;
  };
  this.createNativeFunction('Array.prototype.splice', wrapper, false);

  wrapper = function(begin, end) {
    var perms = intrp.thread.perms();
    var list = new intrp.Array(perms);
    begin = getInt(begin, 0);
    if (begin < 0) {
      begin = this.properties.length + begin;
    }
    begin = Math.max(0, Math.min(begin, this.properties.length));
    end = getInt(end, this.properties.length);
    if (end < 0) {
      end = this.properties.length + end;
    }
    end = Math.max(0, Math.min(end, this.properties.length));
    var length = 0;
    for (var i = begin; i < end; i++) {
      // TODO(cpcallen:perms): Use .get() - but is this always an intrpObject?
      var element = intrp.getProperty(this, i);
      list.set(String(length++), element, perms);
    }
    return list;
  };
  this.createNativeFunction('Array.prototype.slice', wrapper, false);

  wrapper = function(separator) {
    var cycles = intrp.toStringCycles_;
    cycles.push(this);
    try {
      var text = [];
      for (var i = 0; i < this.properties.length; i++) {
        var value = this.properties[i];
        if (value !== null && value !== undefined) {
          text[i] = String(value);
        }
      }
    } finally {
      cycles.pop();
    }
    return text.join(separator);
  };
  this.createNativeFunction('Array.prototype.join', wrapper, false);

  wrapper = function(var_args) {
    var perms = intrp.thread.perms();
    var list = new intrp.Array(perms);
    var length = 0;
    // Start by copying the current array.
    for (var i = 0; i < this.properties.length; i++) {
      // TODO(cpcallen:perms): Use .get() - but is this always an intrpObject?
      var element = intrp.getProperty(this, i);
      list.set(String(length++), element, perms);
    }
    // Loop through all arguments and copy them in.
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (value instanceof intrp.Array) {
        for (var j = 0; j < value.properties.length; j++) {
          // TODO(cpcallen:perms): Use .get()
          var element = intrp.getProperty(value, j);
          list.set(String(length++), element, perms);
        }
      } else {
        list.set(String(length++), value, perms);
      }
    }
    return list;
  };
  this.createNativeFunction('Array.prototype.concat', wrapper, false);

  wrapper = function(searchElement, fromIndex) {
    searchElement = searchElement || undefined;
    fromIndex = getInt(fromIndex, 0);
    if (fromIndex < 0) {
      fromIndex = this.properties.length + fromIndex;
    }
    fromIndex = Math.max(0, fromIndex);
    for (var i = fromIndex; i < this.properties.length; i++) {
      // TODO(cpcallen:perms): Use .get() - but is this always an intrpObject?
      var element = intrp.getProperty(this, i);
      if (element === searchElement) {
        return i;
      }
    }
    return -1;
  };
  this.createNativeFunction('Array.prototype.indexOf', wrapper, false);

  wrapper = function(searchElement, fromIndex) {
    searchElement = searchElement || undefined;
    fromIndex = getInt(fromIndex, this.properties.length);
    if (fromIndex < 0) {
      fromIndex = this.properties.length + fromIndex;
    }
    fromIndex = Math.min(fromIndex, this.properties.length - 1);
    for (var i = fromIndex; i >= 0; i--) {
      // TODO(cpcallen:perms): Use .get() - but is this always an intrpObject?
      var element = intrp.getProperty(this, i);
      if (element === searchElement) {
        return i;
      }
    }
    return -1;
  };
  this.createNativeFunction('Array.prototype.lastIndexOf', wrapper, false);
};

/**
 * Initialize the String class.
 * @private
 */
Interpreter.prototype.initString_ = function() {
  var intrp = this;
  var wrapper;
  // String prototype.
  this.STRING = new this.Object(this.ROOT);
  this.builtins_['String.prototype'] = this.STRING;
  this.STRING.class = 'String';
  // String constructor.
  this.createNativeFunction('String', String, false);  // No: new String()

  // Static methods on String.
  this.createNativeFunction('String.fromCharCode', String.fromCharCode, false);

  // Instance methods on String.
  // Methods with exclusively primitive arguments.
  var functions = ['charAt', 'charCodeAt', 'concat', 'endsWith', 'includes',
      'indexOf', 'lastIndexOf', 'slice', 'startsWith', 'substr', 'substring',
      'toLocaleLowerCase', 'toLocaleUpperCase', 'toLowerCase', 'toUpperCase',
      'trim'];
  for (var i = 0; i < functions.length; i++) {
    this.createNativeFunction('String.prototype.' + functions[i],
                              String.prototype[functions[i]], false);
  }

  wrapper = function(compareString /*, locales, options*/) {
    // Messing around with arguments so that function's length is 1.
    var locales = arguments.length > 1 ?
        intrp.pseudoToNative(arguments[1]) : undefined;
    var options = arguments.length > 2 ?
        intrp.pseudoToNative(arguments[2]) : undefined;
    return this.localeCompare(compareString, locales, options);
  };
  this.createNativeFunction('String.prototype.localeCompare', wrapper, false);

  wrapper = function(separator, limit) {
    if (separator instanceof intrp.RegExp) {
      separator = separator.regexp;
    }
    var jsList = this.split(separator, limit);
    return intrp.arrayNativeToPseudo(jsList, intrp.thread.perms());
  };
  this.createNativeFunction('String.prototype.split', wrapper, false);

  wrapper = function(regexp) {
    if (regexp instanceof intrp.RegExp) {
      regexp = regexp.regexp;
    }
    var m = this.match(regexp);
    return m && intrp.arrayNativeToPseudo(m, intrp.thread.perms());
  };
  this.createNativeFunction('String.prototype.match', wrapper, false);

  wrapper = function(regexp) {
    if (regexp instanceof intrp.RegExp) {
      regexp = regexp.regexp;
    }
    return this.search(regexp);
  };
  this.createNativeFunction('String.prototype.search', wrapper, false);

  wrapper = function(substr, newSubstr) {
    // Support for function replacements is the responsibility of a polyfill.
    if (substr instanceof intrp.RegExp) {
      substr = substr.regexp;
    }
    return String(this).replace(substr, newSubstr);
  };
  this.createNativeFunction('String.prototype.replace', wrapper, false);

  wrapper = function(count) {
    try {
      return this.repeat(count);
    } catch (e) {
      // 'abc'.repeat(-1) will throw an error.  Catch and rethrow.
      throw intrp.errorNativeToPseudo(e, intrp.thread.perms());
    }
  };
  this.createNativeFunction('String.prototype.repeat', wrapper, false);
};

/**
 * Initialize the Boolean class.
 * @private
 */
Interpreter.prototype.initBoolean_ = function() {
  var intrp = this;
  // Boolean prototype.
  this.BOOLEAN = new this.Object(this.ROOT);
  this.builtins_['Boolean.prototype'] = this.BOOLEAN;
  this.BOOLEAN.class = 'Boolean';
  // Boolean constructor.
  this.createNativeFunction('Boolean', Boolean, false);  // No: new Boolean()
};

/**
 * Initialize the Number class.
 * @private
 */
Interpreter.prototype.initNumber_ = function() {
  var intrp = this;
  var wrapper;
  // Number prototype.
  this.NUMBER = new this.Object(this.ROOT);
  this.builtins_['Number.prototype'] = this.NUMBER;
  this.NUMBER.class = 'Number';
  // Number constructor.
  this.createNativeFunction('Number', Number, false);  // No: new Number()

  // Static methods on Number.
  this.createNativeFunction('Number.isFinite', Number.isFinite, false);
  this.createNativeFunction('Number.isNaN', Number.isNaN, false);
  this.createNativeFunction('Number.isSafeInteger', Number.isSafeInteger,
                            false);

  // Instance methods on Number.
  wrapper = function(fractionDigits) {
    try {
      return this.toExponential(fractionDigits);
    } catch (e) {
      // Throws if fractionDigits isn't within 0-20.
      throw intrp.errorNativeToPseudo(e, intrp.thread.perms());
    }
  };
  this.createNativeFunction('Number.prototype.toExponential', wrapper, false);

  wrapper = function(digits) {
    try {
      return this.toFixed(digits);
    } catch (e) {
      // Throws if digits isn't within 0-20.
      throw intrp.errorNativeToPseudo(e, intrp.thread.perms());
    }
  };
  this.createNativeFunction('Number.prototype.toFixed', wrapper, false);

  wrapper = function(precision) {
    try {
      return this.toPrecision(precision);
    } catch (e) {
      // Throws if precision isn't within range (depends on implementation).
      throw intrp.errorNativeToPseudo(e, intrp.thread.perms());
    }
  };
  this.createNativeFunction('Number.prototype.toPrecision', wrapper, false);

  wrapper = function(radix) {
    try {
      return this.toString(radix);
    } catch (e) {
      // Throws if radix isn't within 2-36.
      throw intrp.errorNativeToPseudo(e, intrp.thread.perms());
    }
  };
  this.createNativeFunction('Number.prototype.toString', wrapper, false);

  wrapper = function(/*locales, options*/) {
    // Messing around with arguments so that function's length is 0.
    var locales = arguments.length > 0 ?
        intrp.pseudoToNative(arguments[0]) : undefined;
    var options = arguments.length > 1 ?
        intrp.pseudoToNative(arguments[1]) : undefined;
    return this.toLocaleString(locales, options);
  };
  this.createNativeFunction('Number.prototype.toLocaleString', wrapper, false);
};

/**
 * Initialize the Date class.
 * @private
 */
Interpreter.prototype.initDate_ = function() {
  var intrp = this;
  var wrapper;
  // Date prototype.  As of ES6 this is just an ordinary object.  (In
  // ES5 it had [[Class]] Date.)
  this.DATE = new this.Object(this.ROOT);
  this.builtins_['Date.prototype'] = this.DATE;
  // Date constructor.
  wrapper = function(value, var_args) {
    if (!intrp.calledWithNew()) {
      // Called as Date().
      // Calling Date() as a function returns a string, no arguments are heeded.
      return Date();
    }
    // Called as new Date().
    var args = [null].concat(Array.from(arguments));
    var date = new intrp.Date(intrp.thread.perms());
    date.date = new (Function.prototype.bind.apply(Date, args));
    return date;
  };
  this.createNativeFunction('Date', wrapper, true);

  // Static methods on Date.
  this.createNativeFunction('Date.now', Date.now, false);
  this.createNativeFunction('Date.parse', Date.parse, false);
  this.createNativeFunction('Date.UTC', Date.UTC, false);

  // Instance methods on Date.
  new this.NativeFunction({
    id: 'Date.prototype.toString', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var date = thisVal;
      if (!(date instanceof intrp.Date)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'Date.prototype.toString is not generic');
      }
      // TODO(cpcallen:perms): Perm check here?  Or in toString?
      return date.toString();
    }
  });

  var functions = ['getDate', 'getDay', 'getFullYear', 'getHours',
      'getMilliseconds', 'getMinutes', 'getMonth', 'getSeconds', 'getTime',
      'getTimezoneOffset', 'getUTCDate', 'getUTCDay', 'getUTCFullYear',
      'getUTCHours', 'getUTCMilliseconds', 'getUTCMinutes', 'getUTCMonth',
      'getUTCSeconds', 'getYear',
      'setDate', 'setFullYear', 'setHours', 'setMilliseconds',
      'setMinutes', 'setMonth', 'setSeconds', 'setTime', 'setUTCDate',
      'setUTCFullYear', 'setUTCHours', 'setUTCMilliseconds', 'setUTCMinutes',
      'setUTCMonth', 'setUTCSeconds', 'setYear',
      'toDateString', 'toISOString', 'toJSON', 'toGMTString',
      'toTimeString', 'toUTCString'];
  for (var i = 0; i < functions.length; i++) {
    wrapper = (function(nativeFunc) {
      return function(var_args) {
        return this.date[nativeFunc].apply(this.date, arguments);
      };
    })(functions[i]);
    this.createNativeFunction('Date.prototype.' + functions[i], wrapper, false);
  }
  functions = ['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString'];
  for (var i = 0; i < functions.length; i++) {
    wrapper = (function(nativeFunc) {
      return function(/*locales, options*/) {
        // Messing around with arguments so that function's length is 0.
        var locales = arguments.length > 0 ?
            intrp.pseudoToNative(arguments[0]) : undefined;
        var options = arguments.length > 1 ?
            intrp.pseudoToNative(arguments[1]) : undefined;
        return this.date[nativeFunc].call(this.date, locales, options);
      };
    })(functions[i]);
    this.createNativeFunction('Date.prototype.' + functions[i], wrapper, false);
  }
};

/**
 * Initialize Regular Expression object.
 * @private
 */
Interpreter.prototype.initRegExp_ = function() {
  var intrp = this;
  var wrapper;
  // RegExp prototype.  As of ES6 this is just an ordinary object.
  // (In ES5 it had [[Class]] RegExp.)
  this.REGEXP = new this.Object(this.ROOT);
  this.builtins_['RegExp.prototype'] = this.REGEXP;
  // RegExp constructor.
  wrapper = function(pattern, flags) {
    var regexp = new intrp.RegExp(intrp.thread.perms());
    pattern = pattern ? pattern.toString() : '';
    flags = flags ? flags.toString() : '';
    regexp.populate(new RegExp(pattern, flags));
    return regexp;
  };
  this.createNativeFunction('RegExp', wrapper, true);

  new this.NativeFunction({
    id: 'RegExp.prototype.toString', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var regexp= thisVal;
      if (!(regexp instanceof intrp.RegExp)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'RegExp.prototype.toString is not generic');
      }
      // TODO(cpcallen:perms): Perm check here?  Or in toString?
      return regexp.toString();
    }
  });

  wrapper = function(str) {
    if (!(this instanceof intrp.RegExp) ||
        !(this.regexp instanceof RegExp)) {
      throw new intrp.Error(intrp.thread.perms(), intrp.TYPE_ERROR,
          'Method RegExp.prototype.exec called on incompatible receiver' +
              this.toString());
    }
    return this.regexp.test(str);
  };
  this.createNativeFunction('RegExp.prototype.test', wrapper, false);

  wrapper = function(str) {
    var perms = intrp.thread.perms();
    if (!(this instanceof intrp.RegExp)) {
      throw new intrp.Error(perms, intrp.TYPE_ERROR,
          'Method RegExp.prototype.exec called on incompatible receiver ' +
          this);
    }
    str = str.toString();
    // Get lastIndex from wrapped regex, since this is settable.
    this.regexp.lastIndex = this.get('lastIndex', perms);
    var match = this.regexp.exec(str);
    this.set('lastIndex', this.regexp.lastIndex, perms);

    if (match) {
      var result = new intrp.Array(perms);
      for (var i = 0; i < match.length; i++) {
        result.set(String(i), match[i], perms);
      }
      // match has additional properties.
      result.set('index', match.index, perms);
      result.set('input', match.input, perms);
      return result;
    }
    return null;
  };
  this.createNativeFunction('RegExp.prototype.exec', wrapper, false);
};

/**
 * Initialize the Error class.
 * @private
 */
Interpreter.prototype.initError_ = function() {
  var intrp = this;

  var createErrorClass = function(name) {
    var protoproto = name === 'Error' ? intrp.OBJECT : intrp.ERROR;
    var proto = new intrp.Error(intrp.ROOT, protoproto);
    intrp.builtins_[name + '.prototype'] = proto;
    new intrp.NativeFunction({
      name: name, length: 1,
      /** @type {!Interpreter.NativeConstructImpl} */
      construct: function(intrp, thread, state, args) {
        var message = args[0];
        var err = new intrp.Error(state.scope.perms, proto);
        if (message !== undefined) {
          err.defineProperty('message',
              Descriptor.wc.withValue(String(message)), state.scope.perms);
        }
        return err;
      },
    /** @type {!Interpreter.NativeCallImpl} */
      call: function(intrp, thread, state, thisVal, args) {
        return this.construct.call(this, intrp, thread, state, args);
      }
    });
    return proto;
  };

  this.ERROR = createErrorClass('Error');  // Must be first!
  this.EVAL_ERROR = createErrorClass('EvalError');
  this.RANGE_ERROR = createErrorClass('RangeError');
  this.REFERENCE_ERROR = createErrorClass('ReferenceError');
  this.SYNTAX_ERROR = createErrorClass('SyntaxError');
  this.TYPE_ERROR = createErrorClass('TypeError');
  this.URI_ERROR = createErrorClass('URIError');
  this.PERM_ERROR = createErrorClass('PermissionError');

  this.createNativeFunction('Error.prototype.toString',
                            this.Error.prototype.toString, false);
};

/**
 * Initialize Math object.
 * @private
 */
Interpreter.prototype.initMath_ = function() {
  var numFunctions = ['abs', 'acos', 'asin', 'atan', 'atan2', 'ceil', 'cos',
                      'exp', 'floor', 'log', 'max', 'min', 'pow', 'random',
                      'round', 'sign', 'sin', 'sqrt', 'tan', 'trunc'];
  for (var i = 0; i < numFunctions.length; i++) {
    this.createNativeFunction('Math.' + numFunctions[i], Math[numFunctions[i]],
                              false);
  }
};

/**
 * Initialize JSON object.
 * @private
 */
Interpreter.prototype.initJSON_ = function() {
  var intrp = this;

  var wrapper = function(text) {
    try {
      var nativeObj = JSON.parse(text.toString());
    } catch (e) {
      throw intrp.errorNativeToPseudo(e, intrp.thread.perms());
    }
    return intrp.nativeToPseudo(nativeObj, intrp.thread.perms());
  };
  this.createNativeFunction('JSON.parse', wrapper, false);

  wrapper = function(value) {
    var nativeObj = intrp.pseudoToNative(value);
    try {
      var str = JSON.stringify(nativeObj);
    } catch (e) {
      throw intrp.errorNativeToPseudo(e, intrp.thread.perms());
    }
    return str;
  };
  this.createNativeFunction('JSON.stringify', wrapper, false);
};

/**
 * Initialize the WeakMap class.
 * @private
 */
Interpreter.prototype.initWeakMap_ = function() {
  // WeakMap prototype.
  this.WEAKMAP = new this.Object(this.ROOT);
  this.builtins_['WeakMap.prototype'] = this.WEAKMAP;

  // WeakMap constructor.
  new this.NativeFunction({
    id: 'WeakMap', length: 0,  // N.B. length is correct; arg is optional!
    /** @type {!Interpreter.NativeConstructImpl} */
    construct: function(intrp, thread, state, args) {
      // TODO(cpcallen): Support interator argument to populate map.
      return new intrp.WeakMap(intrp.thread.perms());
    }
  });

  /**
   * Decorator to add standard permission and type checks for HashMap
   * prototype methods.
   * @param {!Interpreter.NativeCallImpl} func Function to decorate.
   * @param {string=} name Name of decorated function (default:
   *     func.name).  (N.B. needed because 'delete' is a reserve word.
   * @return {!Interpreter.NativeCallImpl} The decorated function.)
   */
  var withChecks = function(func, name) {
    name = (name === undefined ? func.name : name);
    return function call(intrp, thred, state, thisVal, args) {
      // TODO(cpcallen:perms): add controls()-type and/or
      // object-readability check(s) here.
      if (!(thisVal instanceof intrp.WeakMap)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'Method WeakMap.prototype.' + name +
            ' called on incompatible receiver ' + String(thisVal));
      } else if (!(args[0] instanceof intrp.Object)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'Invalid value used as weak map key');
      }
      return func.apply(this, arguments);
    };
  };

  new this.NativeFunction({
    id: 'WeakMap.prototype.delete', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: withChecks(function (intrp, thread, state, thisVal, args) {
      return thisVal.weakMap.delete(args[0]);
    }, 'delete')
  });

  new this.NativeFunction({
    id: 'WeakMap.prototype.get', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: withChecks(function get(intrp, thread, state, thisVal, args) {
      return thisVal.weakMap.get(args[0]);
    })
  });

  new this.NativeFunction({
    id: 'WeakMap.prototype.has', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: withChecks(function has(intrp, thread, state, thisVal, args) {
      return thisVal.weakMap.has(args[0]);
    })
  });

  new this.NativeFunction({
    id: 'WeakMap.prototype.set', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: withChecks(function set(intrp, thread, state, thisVal, args) {
      thisVal.weakMap.set(args[0], args[1]);
      return thisVal;
    })
  });
};

/**
 * Initialize the thread system API.
 * @private
 */
Interpreter.prototype.initThreads_ = function() {
  new this.NativeFunction({
    id: 'suspend', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var delay = Number(args[0]) || 0;
      if (delay < 0) {
        delay = 0;
      }
      intrp.thread.sleepUntil(intrp.now() + delay);
    }
  });

  new this.NativeFunction({
    id: 'setTimeout', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var func = args[0];
      if (!(func instanceof intrp.Function)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            func + ' is not a function');
      }
      var delay = Number(args[1]) || 0;
      args = Array.prototype.slice.call(args, 2);
      return intrp.createThreadForFuncCall(func, undefined, args,
                                           intrp.now() + delay);
    }
  });

  new this.NativeFunction({
    id: 'clearTimeout', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var id = Number(args[0]);
      if (intrp.threads[id]) {
        // BUG(cpcallen): add security check here.
        intrp.threads[id].status = Interpreter.Thread.Status.ZOMBIE;
      }
    }
  });
};

/**
 * Initialize the permissions model API.
 * @private
 */
Interpreter.prototype.initPerms_ = function() {
  new this.NativeFunction({
    id: 'perms', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return /** @type {!Interpreter.prototype.Object} */ (state.scope.perms);
    }
  });

  new this.NativeFunction({
    id: 'setPerms', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = args[0];
      if (!(perms instanceof intrp.Object)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'New perms must be an object');
      }
      // TODO(cpcallen:perms): throw if current perms does not
      // control new perms.
      state.scope.perms = /** @type {!Interpreter.Owner} */ (perms);
    }
  });
};

/**
 * Initialize the networking subsystem API.
 * @private
 */
Interpreter.prototype.initNetwork_ = function() {
  var intrp = this;

  this.createAsyncFunction('CC.connectionListen', function(res, rej, port, proto) {
    var perms = intrp.thread.perms();
    if (port !== (port >>> 0) || port > 0xffff) {
      rej(new intrp.Error(perms, intrp.RANGE_ERROR, 'invalid port'));
      return;
    } else  if (port in intrp.listeners_) {
      rej(new intrp.Error(perms, intrp.RANGE_ERROR, 'port already listened'));
      return;
    }
    var server = new intrp.Server(perms, port, proto);
    intrp.listeners_[port] = server;
    server.listen(function() {
      res();
    }, function(e) {
      rej(intrp.errorNativeToPseudo(e, perms));
    });
  });

  this.createAsyncFunction('CC.connectionUnlisten', function(res, rej, port) {
    var perms = intrp.thread.perms();
    if (!(port in intrp.listeners_)) {
      rej(new intrp.Error(perms, intrp.RANGE_ERROR, 'port not listening'));
      return;
    }
    if (!(intrp.listeners_[port].server_ instanceof net.Server)) {
      throw Error('server already closed??');
    }
    intrp.listeners_[port].unlisten(function(e) {
      if (e instanceof Error) {
        // Somehow something has gone wrong.  (Maybe mulitple
        // concurrent calls to .close on the same net.Server?)
        rej(intrp.errorNativeToPseudo(e, perms));
      } else {
        // All socket (and all open connections on it) now closed.
        res();
      }
    });
    delete intrp.listeners_[port];
  });

  this.createNativeFunction('CC.connectionWrite', function(obj, data) {
    if (!(obj instanceof intrp.Object) || !obj.socket) {
      throw new intrp.Error(intrp.thread.perms(), intrp.TYPE_ERROR,
          'object is not connected');
    }
    obj.socket.write(String(data));
  }, false);

  this.createNativeFunction('CC.connectionClose', function(obj) {
    if (!(obj instanceof intrp.Object) || !obj.socket) {
      throw new intrp.Error(intrp.thread.perms(), intrp.TYPE_ERROR,
          'object is not connected');
    }
    obj.socket.end();
  }, false);
};

/**
 * Is a value a legal integer for an array length?
 * @param {Interpreter.Value} x Value to check.
 * @return {number} Zero, or a positive integer if the value can be
 *     converted to such.  NaN otherwise.
 */
Interpreter.legalArrayLength = function(x) {
  var n = x >>> 0;
  // Array length must be between 0 and 2^32-1 (inclusive).
  return (n === Number(x)) ? n : NaN;
};

/**
 * Is a value a legal integer for an array index?
 * @param {Interpreter.Value} x Value to check.
 * @return {number} Zero, or a positive integer if the value can be
 *     converted to such.  NaN otherwise.
 */
Interpreter.legalArrayIndex = function(x) {
  var n = x >>> 0;
  // Array index cannot be 2^32-1, otherwise length would be 2^32.
  // 0xffffffff is 2^32-1.
  return (String(n) === String(x) && n !== 0xffffffff) ? n : NaN;
};

/**
 * The ToInteger function from ES6 §7.1.4.  The abstract operation
 * ToInteger converts argument to an integral numeric value.
 * @param {Interpreter.Value} value
 * @return {number} An integer if the value can be converted to such;
 *     0 otherwise.
 */
Interpreter.toInteger = function toInteger(value) {
  var number = Number(value);
  if (isNaN(number)) {
    return 0;
  } else if (number === 0 || number === Infinity || number === -Infinity) {
    return number;
  }
  return Math.trunc(number);
};

/**
 * The ToUint32 function from ES6 §7.1.6.  The abstract operation
 * ToUint32 converts argument to one of 2**32 integer values in the
 * range 0 through 2**32−1, inclusive.
 * @param {Interpreter.Value} value
 * @return {number} A non-negative integer less than 2**32.
 */
Interpreter.toUint32 = function toUint32(value) {
  return Interpreter.toInteger(value) >>> 0;
};

/**
 * The ToLength function from ES6 §7.1.15.  Note that this does NOT
 * enforce the actual array length limit of 2^32-1, but deals with
 * lengths up to 2^53-1, which is correct for the polymorphic
 * Array.prototype methods.
 * @param {Interpreter.Value} value
 * @return {number} A non-negative integer less than 2**53.
 */
Interpreter.toLength = function toLength(value) {
  var len = Interpreter.toInteger(value);
  if (len <= 0) return 0;
  return Math.min(len, Number.MAX_SAFE_INTEGER);  // Handles len === Infinity.
};

/**
 * Create a new native function.  Function will be owned by root.
 * @param {string} name Name of new function.
 * @param {!Function} nativeFunc JavaScript function.
 * @param {boolean} legalConstructor True if the function can be used as a
 *     constructor (e.g. Array), false if not (e.g. escape).
 * @return {!Interpreter.prototype.Function} New function.
*/
Interpreter.prototype.createNativeFunction = function(
    name, nativeFunc, legalConstructor) {
  // Make sure impl function has an id for serialization.
  if (!nativeFunc.id) {
    nativeFunc.id = name;
  }
  var func = new this.OldNativeFunction(nativeFunc, legalConstructor);
  func.setName(name.replace(/^.*\./, ''));
  if (this.builtins_[name]) {
    throw ReferenceError('Builtin "' + name + '" already exists.');
  }
  this.builtins_[name] = func;
  return func;
};

/**
 * Create a new native asynchronous function.  Asynchronous native
 * functions are presumed not to be legal constructors.  Function will
 * be owned by root.
 *
 * TODO(cpcallen): de-dupe this with createNativeFunction, above.
 * @param {string} name Name of new function.
 * @param {!Function} asyncFunc JavaScript function.
 * @return {!Interpreter.prototype.Function} New function.
 */
Interpreter.prototype.createAsyncFunction = function(name, asyncFunc) {
  // Make sure impl function has an id for serialization.
  if (!asyncFunc.id) {
    asyncFunc.id = name;
  }
  var func = new this.OldAsyncFunction(asyncFunc);
  func.setName(name.replace(/^.*\./, ''));
  if (this.builtins_[name]) {
    throw ReferenceError('Builtin "' + name + '" already exists.');
  }
  this.builtins_[name] = func;
  return func;
};

/**
 * Converts from a native JS object or value to a JS interpreter
 * object.  Can handle JSON-style values plus regexps and errors (of
 * all standard native types), and handles additional properties on
 * arrays, regexps and errors (just as for plain objects).  Ignores
 * prototype and inherited properties.  Efficiently handles
 * sparse arrays.  Does NOT handle cyclic
 * @param {*} nativeObj The native JS object to be converted.
 * @return {Interpreter.Value} The equivalent JS interpreter object.
 * @param {!Interpreter.Owner} owner Owner for new Error
 */
Interpreter.prototype.nativeToPseudo = function(nativeObj, owner) {
  if ((typeof nativeObj !== 'object' && typeof nativeObj !== 'function') ||
      nativeObj === null) {
    // It's a primitive; just return it.
    return /** @type {boolean|number|string|undefined|null} */ (nativeObj);
  }

  var pseudoObj;
  switch (Object.prototype.toString.apply(nativeObj)) {
    case '[object Array]':
      pseudoObj = new this.Array(owner);
      break;
    case '[object RegExp]':
      pseudoObj = new this.RegExp(owner);
      pseudoObj.populate(/** @type {!RegExp} */(nativeObj));
      break;
    case '[object Error]':
      var proto;
      if (nativeObj instanceof EvalError) {
        proto = this.EVAL_ERROR;
      } else if (nativeObj instanceof RangeError) {
        proto = this.RANGE_ERROR;
      } else if (nativeObj instanceof ReferenceError) {
        proto = this.REFERENCE_ERROR;
      } else if (nativeObj instanceof SyntaxError) {
        proto = this.SYNTAX_ERROR;
      } else if (nativeObj instanceof TypeError) {
        proto = this.TYPE_ERROR;
      } else if (nativeObj instanceof URIError) {
        proto = this.URI_ERROR;
      } else {
        proto = this.ERROR;
      }
      pseudoObj = new this.Error(owner, proto);
      break;
    default:
      pseudoObj = new this.Object(owner);
  }

  // Cast to satisfy type-checker; it might be a lie: nativeObj could
  // be an object (i.e., non-primitive) but not an Object (i.e.,
  // inherits from Object.prototype).  Fortunately we don't care.
  var keys = Object.getOwnPropertyNames(/** @type {!Object} */(nativeObj));
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var desc = Object.getOwnPropertyDescriptor(nativeObj, key);
    desc.value = this.nativeToPseudo(desc.value, owner);
    pseudoObj.defineProperty(key, /** @type {!Descriptor} */ (desc), owner);
  }
  return pseudoObj;
};

/**
 * Converts from a JS interpreter object to native JS object.
 * Can handle JSON-style values, plus cycles.
 *
 * TODO(cpcallen): Audit this to ensure that it can safely accept any
 * user object (especially because it is used by our implementations
 * of JSON.stringify, String.prototype.localeCompare, etc.)
 *
 * TODO(cpcallen:perms): Audit all callers of this to ensure that they
 * do not allow circumvention of access control.
 * @param {Interpreter.Value} pseudoObj The JS interpreter object to
 *     be converted.
 * @param {Object=} cycles Cycle detection (used only in recursive calls).
 * @return {*} The equivalent native JS object or value.
 */
Interpreter.prototype.pseudoToNative = function(pseudoObj, cycles) {
  // BUG(cpcallen:perms): Kludge.  Incorrect except when doing .step
  // or run.  Should be an argument instead, forcing caller to decide.
  try {
    var perms = this.thread.perms();
  } catch (e) {
    perms = this.ROOT;
  }
  if (typeof pseudoObj === 'boolean' ||
      typeof pseudoObj === 'number' ||
      typeof pseudoObj === 'string' ||
      pseudoObj === null || pseudoObj === undefined) {
    return pseudoObj;
  }

  if (pseudoObj instanceof this.RegExp) {  // Regular expression.
    return pseudoObj.regexp;
  }

  if (!cycles) {
    cycles = {pseudo: [], native: []};
  }
  var i = cycles.pseudo.indexOf(pseudoObj);
  if (i !== -1) {
    return cycles.native[i];
  }
  cycles.pseudo.push(pseudoObj);
  var nativeObj;
  if (pseudoObj instanceof this.Array) {  // Array.
    nativeObj = [];
    cycles.native.push(nativeObj);
    var length = pseudoObj.get('length', perms);
    for (i = 0; i < length; i++) {
      // TODO(cpcallen): do we really want to include inherited properties?
      if (pseudoObj.has(String(i), perms)) {
        nativeObj[i] =
            this.pseudoToNative(pseudoObj.get(String(i), perms), cycles);
      }
    }
  } else {  // Object.
    nativeObj = {};
    cycles.native.push(nativeObj);
    var keys = pseudoObj.ownKeys(perms);
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var val = pseudoObj.get(key, perms);
      nativeObj[key] = this.pseudoToNative(val, cycles);
    }
  }
  cycles.pseudo.pop();
  cycles.native.pop();
  return nativeObj;
};

/**
 * Converts from a native array to an Interpreter.prototype.Array.
 * Does NOT recursively convert the type of the array's contents.
 * Algorithm intended to be inverse of arrayPseudoToNative, so only
 * numeric properties up to .length are copied, and property
 * attributes are ignored.
 * @param {!Array<Interpreter.Value>} nArray The native array to be converted.
 * @param {!Interpreter.Owner} owner Owner for new object.
 * @return {!Interpreter.prototype.Array} The equivalent interpreter array.
 */
Interpreter.prototype.arrayNativeToPseudo = function(nArray, owner) {
  var pArray = new this.Array(owner);
  for (var i = 0; i < nArray.length; i++) {
    pArray.set(String(i), nArray[i], owner);
  }
  return pArray;
};

/**
 * Converts from an Interpreter.prototype.Array or array-like ..Object
 * to a native array, using the algorithm from ES5.1 §15.3.4.3
 * (Function.prototype.apply).  Does NOT recursively convert the type
 * of the array's contents.
 * @param {!Interpreter.prototype.Object} pArray The interpreter array
 *     or array-like object to be converted.
 * @param {!Interpreter.Owner} perms Who is trying convert it?
 * @return {!Array<Interpreter.Value>} The equivalent native JS array.
 */
Interpreter.prototype.arrayPseudoToNative = function(pArray, perms) {
  var len = Interpreter.legalArrayLength(pArray.get('length', perms)) || 0;
  var nArray = [];
  for (var i = 0; i < len; i++) {
    nArray.push(pArray.get(String(i), perms));
  }
  return nArray;
};

/**
 * Converts from a native Error to a JS interpreter Error.  Unlike
 * pseudoToNative, this fucntion only converts type and .message.
 * @param {!Error} err Native Error value to be converted.
 * @param {?Interpreter.Owner} owner Owner for new (pseudo) Error object.
 * @return {!Interpreter.prototype.Error}
 */
Interpreter.prototype.errorNativeToPseudo = function(err, owner) {
  var proto;
  if (err instanceof EvalError) {
    proto = this.EVAL_ERROR;
  } else if (err instanceof RangeError) {
    proto = this.RANGE_ERROR;
  } else if (err instanceof ReferenceError) {
    proto = this.REFERENCE_ERROR;
  } else if (err instanceof SyntaxError) {
    proto = this.SYNTAX_ERROR;
  } else if (err instanceof TypeError) {
    proto = this.TYPE_ERROR;
  } else if (err instanceof URIError) {
    proto = this.URI_ERROR;
  } else {
    proto = this.ERROR;
  }
  return new this.Error(owner, proto, err.message);
};

/**
 * Implements the ToObject method from ES5.1 §9.9, but returning
 * temporary Box objects instead of boxed Boolean, Number or String
 * instances.
 * @param {Interpreter.Value} value The value to be converted to an Object.
 * @param {!Interpreter.Owner} perms Who is trying convert it?
 * @return {!Interpreter.ObjectLike}
 */
Interpreter.prototype.toObject = function(value, perms) {
  if (value === null || value === undefined) {
    throw new this.Error(perms, this.TYPE_ERROR,
        "Can't convert " + value + ' to Object');
  } else if (typeof value === 'boolean' || typeof value === 'number' ||
      typeof value === 'string') {
    return new this.Box(value);
  }
  return value;
};

/**
 * Look up the prototype for this value.
 * @param {Interpreter.Value} value Data object.
 * @return {Interpreter.prototype.Object} Prototype object, null if none.
 */
Interpreter.prototype.getPrototype = function(value) {
  switch (typeof value) {
    case 'number':
      return this.NUMBER;
    case 'boolean':
      return this.BOOLEAN;
    case 'string':
      return this.STRING;
  }
  if (value) {
    return value.proto;
  }
  return null;
};

/**
 * Fetch a property value from a data object.
 * @param {Interpreter.Value} obj Data object.
 * @param {Interpreter.Value} name Name of property.
 * @return {Interpreter.Value} Property value (may be undefined).
 */
Interpreter.prototype.getProperty = function(obj, name) {
  // BUG(cpcallen:perms): Kludge.  Incorrect except when doing .step
  // or run.  Should be an argument instead, forcing caller to decide.
  try {
    var perms = this.thread.perms();
  } catch (e) {
    perms = this.ROOT;
  }
  var key = String(name);
  return this.toObject(obj, perms).get(key, perms);
};

/**
 * Retrieves a value from the scope chain.
 * @param {!Interpreter.Scope} scope Scope to read from.
 * @param {string} name Name of variable.
 * @return {Interpreter.Value} Value (may be undefined).
 */
Interpreter.prototype.getValueFromScope = function(scope, name) {
  for (var s = scope; s; s = s.outerScope) {
    if (name in s.vars) {
      return s.vars[name];
    }
  }
  // Typeof operator is unique: it can safely look at non-defined variables.
  var stack = this.thread.stateStack_;
  var prevNode = stack[stack.length - 1].node;
  if (prevNode['type'] === 'UnaryExpression' &&
      prevNode['operator'] === 'typeof') {
    return undefined;
  }
  throw new this.Error(this.thread.perms(), this.REFERENCE_ERROR,
      name + ' is not defined');
};

/**
 * Sets a value to the current scope.
 * @param {!Interpreter.Scope} scope Scope to write to.
 * @param {string} name Name of variable.
 * @param {Interpreter.Value} value Value.
 */
Interpreter.prototype.setValueToScope = function(scope, name, value) {
  for (var s = scope; s; s = s.outerScope) {
    if (name in s.vars) {
      if (s.notWritable.has(name)) {
        // TODO(cpcallen:perms): we have a scope here, but scope.perms
        // is probably not the right value for owner of new error.
        throw new this.Error(this.thread.perms(), this.TYPE_ERROR,
            'Assignment to constant variable: ' + name);
      }
      s.vars[name] = value;
      return;
    }
  }
  throw new this.Error(this.thread.perms(), this.REFERENCE_ERROR,
      name + ' is not defined');
};

/**
 * Creates a variable in the given scope.
 * @param {!Interpreter.Scope} scope Scope to write to.
 * @param {Interpreter.Value} name Name of variable.
 * @param {Interpreter.Value} value Initial value.
 * @param {boolean=} notWritable True if constant (default: false).
 */
Interpreter.prototype.addVariableToScope =
    function(scope, name, value, notWritable) {
  name = String(name);
  if (!(name in scope.vars)) {
    scope.vars[name] = value;
  }
  if (notWritable) {
    scope.notWritable.add(name);
  }
};

/**
 * Populate a scope with declarations from given node.
 * @param {!Interpreter.Node} node AST node (program or function).
 * @param {!Interpreter.Scope} scope Scope dictionary to populate.
 * @param {string} source Original source code.
 * @private
 */
Interpreter.prototype.populateScope_ = function(node, scope, source) {
  if (node['type'] === 'VariableDeclaration') {
    for (var i = 0; i < node['declarations'].length; i++) {
      this.addVariableToScope(scope, node['declarations'][i]['id']['name'],
                              undefined);
    }
  } else if (node['type'] === 'FunctionDeclaration') {
    this.addVariableToScope(scope, node['id']['name'],
        new this.UserFunction(node, scope, source, scope.perms));
    return;  // Do not recurse into function.
  } else if (node['type'] === 'FunctionExpression') {
    return;  // Do not recurse into function.
  } else if (node['type'] === 'ExpressionStatement') {
    return;  // Expressions can't contain variable/function declarations.
  }
  for (var name in node) {
    var prop = node[name];
    if (prop && typeof prop === 'object') {
      if (Array.isArray(prop)) {
        for (var i = 0; i < prop.length; i++) {
          if (prop[i] && prop[i] instanceof Interpreter.Node) {
            this.populateScope_(prop[i], scope, source);
          }
        }
      } else {
        if (prop instanceof Interpreter.Node) {
          this.populateScope_(prop, scope, source);
        }
      }
    }
  }
};

/**
 * Is the current state directly being called with as a construction with 'new'.
 * @return {boolean} True if 'new foo()', false if 'foo()'.
 */
Interpreter.prototype.calledWithNew = function() {
  return this.thread.stateStack_[this.thread.stateStack_.length - 1]
      .node['type'] === 'NewExpression';
};

/**
 * Gets a value from the scope chain or from an object property.
 * @param {!Interpreter.Scope} scope Current scope dictionary.
 * @param {!Array} ref Reference tuple.
 * @param {!Interpreter.Owner} perms Who is trying to get it?
 * @return {Interpreter.Value} Value (may be undefined).
 */
Interpreter.prototype.getValue = function(scope, ref, perms) {
  if (ref[0] === Interpreter.SCOPE_REFERENCE) {
    // A null/varname variable lookup.
    return this.getValueFromScope(scope, ref[1]);
  } else {
    // An obj/prop components tuple (foo.bar).
    return this.toObject(ref[0], perms).get(ref[1], perms);
  }
};

/**
 * Sets a value to the scope chain or to an object property.
 * @param {!Interpreter.Scope} scope Current scope dictionary.
 * @param {!Array} ref Reference tuple.
 * @param {Interpreter.Value} value Value.
 * @param {!Interpreter.Owner} perms Who is trying to set it?
 */
Interpreter.prototype.setValue = function(scope, ref, value, perms) {
  if (ref[0] === Interpreter.SCOPE_REFERENCE) {
    // A null/varname variable lookup.
    this.setValueToScope(scope, ref[1], value);
  } else {
    // An obj/prop components tuple (foo.bar).
    this.toObject(ref[0], perms).set(ref[1], value, perms);
  }
};

/**
 * Completion Value Types.
 * @enum {number}
 */
Interpreter.CompletionType = {
  NORMAL: 0,
  BREAK: 1,
  CONTINUE: 2,
  RETURN: 3,
  THROW: 4
};

/**
 * The Completion Specification Type, from ES5.1 §8.9
 * @typedef {{type: Interpreter.CompletionType,
 *            value: Interpreter.Value,
 *            label: (string|undefined)}}
 */
Interpreter.Completion;

/**
 * Unwind the stack to the innermost relevant enclosing TryStatement,
 * For/ForIn/WhileStatement or Call/NewExpression.  If this results in
 * the stack being completely unwound the thread will be terminated
 * and an appropriate error being logged.
 *
 * N.B. Normally unwind should be called from the current stack frame
 * (i.e., do NOT do stack.pop() before calling unwind) because the
 * target label of a break statement can be the statement itself
 * (e.g., `foo: break foo;`).
 * @private
 * @param {!Interpreter.Thread} thread The thread whose stack is to be unwound.
 * @param {Interpreter.CompletionType} type Completion type.
 * @param {Interpreter.Value=} value Value computed, returned or thrown.
 * @param {string=} label Target label for break or return.
 */
Interpreter.prototype.unwind_ = function(thread, type, value, label) {
  if (type === Interpreter.CompletionType.NORMAL) {
    throw TypeError('Should not unwind for NORMAL completions');
  }
  for (var stack = thread.stateStack_; stack.length > 0; stack.pop()) {
    var state = stack[stack.length - 1];
    switch (state.node['type']) {
      case 'TryStatement':
        state.info_ = {type: type, value: value, label: label};
        return;
      case 'CallExpression':
      case 'NewExpression':
        switch (type) {
          case Interpreter.CompletionType.BREAK:
          case Interpreter.CompletionType.CONTINUE:
            throw Error('Unsynatctic break/continue not rejected by Acorn');
          case Interpreter.CompletionType.RETURN:
            state.value = value;
            return;
        }
        break;
    }
    if (type === Interpreter.CompletionType.BREAK) {
      if (label ? (state.labels && state.labels.indexOf(label) !== -1) :
          (state.isLoop || state.isSwitch)) {
        // Top of stack is now target of break.  But we are breaking
        // out of this statement, so pop to discard it.
        stack.pop();
        return;
      }
    } else if (type === Interpreter.CompletionType.CONTINUE) {
      if (label ? (state.labels && state.labels.indexOf(label) !== -1) :
          state.isLoop) {
        return;
      }
    }
  }

  // Unhandled completion.  Terminate thread.
  this.thread.status = Interpreter.Thread.Status.ZOMBIE;

  if (type === Interpreter.CompletionType.THROW) {
    // Log exception and stack trace.
    if (value instanceof this.Error) {
      console.log('Unhandled %s', value);
      var stackTrace = value.get('stack', this.ROOT);
      if (stackTrace) {
        console.log(stackTrace);
      }
    } else {
      var native = this.pseudoToNative(value);
      console.log('Unhandled exception with value: %o', native);
    }
  } else {
    throw Error('Unsynatctic break/continue/return not rejected by Acorn');
  }
};


///////////////////////////////////////////////////////////////////////////////
// Nested (but not fully inner) classes: Scope, State, Thread, etc.
///////////////////////////////////////////////////////////////////////////////

/**
 * Class for a scope.
 * @param {!Interpreter.Owner} perms The permissions with which code
 *     in the current scope is executing (default: outerScope.perms if
 *     supplied; otherwise null).
 * @param {?Interpreter.Scope} outerScope The enclosing scope ("outer
 *     lexical environment reference", in ECMAScript spec parlance)
 *     (default: null).
 * @constructor
 */
Interpreter.Scope = function(perms, outerScope) {
  /** @type {?Interpreter.Scope} */
  this.outerScope = outerScope;
  /** @type {!Interpreter.Owner} */
  this.perms = perms;
  /** @const {!Object<string, Interpreter.Value>} */
  this.vars = Object.create(null);
  this.notWritable = new Set();
};

/**
 * Class for a state.
 * @param {!Interpreter.Node} node AST node for the state.
 * @param {!Interpreter.Scope} scope Scope dictionary for the state.
 * @param {boolean=} wantRef Does parent state want reference (rather
 *     than evaluated value)?  (Default: false.)
 * @constructor
 */
Interpreter.State = function(node, scope, wantRef) {
  /** @const @type {!Interpreter.Node} */
  this.node = node;
  /** @const @type {!Interpreter.Scope} */
  this.scope = scope;
  /** @private @const @type {boolean} */
  this.wantRef_ = wantRef || false;

  /** @type {Interpreter.Value} */
  this.value = undefined;
  /** @type {?Array} */
  this.ref = null;
  /** @type {?Array<string>} */
  this.labels = null;
  /** @type {boolean} */
  this.isLoop = false;
  /** @type {boolean} */
  this.isSwitch = false;

  /** @private @type {number} */
  this.step_ = 0;
  /** @private @type {number} */
  this.n_ = 0;
  /** @private @type {Interpreter.Value|undefined} */
  this.tmp_ = undefined;
  /** @private @type {?Interpreter.CallInfo|
   *                  ?Interpreter.ForInInfo|
   *                  ?Interpreter.SwitchInfo|
   *                  ?Interpreter.Completion}
   */
  this.info_ = null;
};

/**
 * Create a new State pre-configured to begin executing a function call.
 * @param {!Interpreter.prototype.Function} func Function to call.
 * @param {Interpreter.Value} thisVal value of 'this' in function call.
 * @param {!Array<Interpreter.Value>} args Arguments to pass.
 * @param {!Interpreter.Owner} perms Who is doing the call?
 * @return {!Interpreter.State} The newly-created state.
 */
Interpreter.State.newForCall = function(func, thisVal, args, perms) {
  // N.B.: numeric constants in this function must correspond with the
  // CallExpresion step function.

  // Dummy node (used only for type).
  var node = new Interpreter.Node;
  node['type'] = 'CallExpression';
  // Dummy outer scope (used ony for perms, which will be caller perms).
  var scope = new Interpreter.Scope(perms, null);

  var state = new Interpreter.State(node, scope);
  state.info_ = {callee: func,
                 this: thisVal,
                 directEval: false,
                 arguments: args};
  state.step_ = 3;  // Skip evaluation of func/this/args; begin execution next.
  return state;
};

/**
 * Should this state be included in the stack trace generated for
 * Error objects?
 * @return {boolean}
 */
Interpreter.State.prototype.includeInStack = function() {
  // N.B.: numeric constants in this function must correspond with the
  // CallExpresion step function.

  // Is state in the last step of execution (i.e., .call called)?
  return this.node && this.node['type'] === 'CallExpression' &&
      this.step_ === 4;
};

/**
 * Class for a thread of execution.
 * @constructor
 * @param {number} id Thread ID.  Should correspond to index of this
 *     thread in .threads array.
 * @param {!Interpreter.State} state Starting state for thread.
 * @param {number} runAt Time at which to start running thread.
 */
Interpreter.Thread = function(id, state, runAt) {
  /** @type {number} */
  this.id = id;
  // Say it's sleeping for now.  May be woken immediately.
  /** @type {!Interpreter.Thread.Status} */
  this.status = Interpreter.Thread.Status.SLEEPING;
  /** @private @type {!Array<!Interpreter.State>} */
  this.stateStack_ = [state];
  /** @type {number} */
  this.runAt = runAt;
};

/**
 * Put thread to sleep until a specified time.
 * @param {number} resumeAt Time at which to wake thread.
 */
Interpreter.Thread.prototype.sleepUntil = function(resumeAt) {
  this.status = Interpreter.Thread.Status.SLEEPING;
  this.runAt = resumeAt;
};

/**
 * Returns the original source code for current state.
 * @param {number=} index Optional index in stack to look from.
 * @return {string|undefined} Source code or undefined if none.
 */
Interpreter.Thread.prototype.getSource = function(index) {
  var i = (index === undefined) ? this.stateStack_.length - 1 : index;
  var source;
  while (source === undefined && i >= 0) {
    source = this.stateStack_[i--].node['source'];
  }
  return source;
};

/**
 * Returns the permissions with which currently-executing code is
 * running (equivalent to a unix EUID, but in the form of a
 * user/group/etc. object).  It is an error to call this function on a
 * thread that is a zombie.
 * @return {!Interpreter.Owner}
 */
Interpreter.Thread.prototype.perms = function() {
  if (this.status === Interpreter.Thread.Status.ZOMBIE) {
    throw Error('Zombie thread has no perms');
  }
  return this.stateStack_[this.stateStack_.length - 1].scope.perms;
};

/**
 * Legal thread statuses.
 * @enum {number}
 */
Interpreter.Thread.Status = {
  /** Execution of the thread has terminated. */
  ZOMBIE: 0,
  /** The thread is ready to run (or is running). */
  READY: 1,
  /** The thread is blocked, awaiting an external event (e.g. callback). */
  BLOCKED: 2,
  /** The thread is sleeping, awaiting arrival of its .runAt time. */
  SLEEPING: 3,
}

/**
 * An iterator over the properties of an ObjectLike and its
 * prototypes, following the usual for-in loop rules.
 * @constructor
 * @param {!Interpreter.ObjectLike} obj Object or Box whose properties
 *     are to be iterated over.
 * @param {!Interpreter.Owner} perms Who is doing the iteration?
 */
Interpreter.PropertyIterator = function(obj, perms) {
  if (obj === undefined) {  // Deserializing
    return;
  }
  /** @private @type {?Interpreter.ObjectLike} */
  this.obj_ = obj;
  /** @private @const @type {!Interpreter.Owner} */
  this.perms_ = perms;
  /** @private @type {!Array<string>} */
  this.keys_ = this.obj_.ownKeys(this.perms_);
  /** @private @type {number} */
  this.i_ = 0;
  /** @private @const @type {!Set<string>} */
  this.visited_ = new Set();
};

/**
 * Return the next key in the iteration, skipping non-enumerable keys
 * or keys already seen earlier in the prototype chain (even if they
 * were non-enumerable).  Returns undefined when iteration is done.
 * @return {string|undefined}
 */
Interpreter.PropertyIterator.prototype.next = function() {
  while (true) {
    if (this.i_ >= this.keys_.length) {
      this.obj_ = this.obj_.proto;
      if (this.obj_ === null) {
        // Done iteration.
        return undefined;
      }
      this.keys_ = this.obj_.ownKeys(this.perms_);
      this.i_ = 0;
    }
    var key = this.keys_[this.i_++];
    var pd = this.obj_.getOwnPropertyDescriptor(key, this.perms_);
    // Skip deleted or already-visited properties.
    if (!pd || this.visited_.has(key)) {
      continue;
    }
    this.visited_.add(key);
    if (pd.enumerable) {
      return key;
    }
  }
};

///////////////////////////////////////////////////////////////////////////////
// Types representing JS objects - Object, Function, Array, etc.
///////////////////////////////////////////////////////////////////////////////

/**
 * Typedef for JS values.
 * @typedef {!Interpreter.prototype.Object|boolean|number|string|undefined|null}
 */
Interpreter.Value;

/**
 * Interface for owners.  Anything that is an Owner is really just a
 * normal !Interpreter.prototype.Object, but since since no concrete
 * class @implements this interface we force oruselves to cast back
 * and forth, helping to catch type errors.
 * @interface
 */
Interpreter.Owner = function() {};

/**
 * An interface for object-like entities: either actual
 * Interpreter.prototype.Objects or by non-user-visible boxed
 * primitives.
 * @interface
 */
Interpreter.ObjectLike = function() {};

/** @type {?Interpreter.prototype.Object} */
Interpreter.ObjectLike.prototype.proto;

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {!Descriptor}
 */
Interpreter.ObjectLike.prototype.getOwnPropertyDescriptor =
    function(key, perms) {};

/**
 * @param {string} key
 * @param {!Descriptor} desc
 * @param {!Interpreter.Owner} perms
 */
Interpreter.ObjectLike.prototype.defineProperty =
    function(key, desc, perms) {};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.ObjectLike.prototype.has = function(key, perms) {};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {Interpreter.Value}
 */
Interpreter.ObjectLike.prototype.get = function(key, perms) {};

/**
 * @param {string} key
 * @param {Interpreter.Value} value
 * @param {!Interpreter.Owner} perms
 */
Interpreter.ObjectLike.prototype.set = function(key, value, perms) {};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.ObjectLike.prototype.deleteProperty = function(key, perms) {};

/** @param {!Interpreter.Owner} perms @return {!Array<string>} */
Interpreter.ObjectLike.prototype.ownKeys = function(perms) {};

/** @return {string} */
Interpreter.ObjectLike.prototype.toString = function() {};

/** @return {Interpreter.Value} */
Interpreter.ObjectLike.prototype.valueOf = function() {};

/**
 * @constructor
 * @implements {Interpreter.ObjectLike}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.Object = function(owner, proto) {
  /** @type {?Interpreter.prototype.Object} */
  this.proto;
  /** @type {?Interpreter.Owner} */
  this.owner;
  /** @const {!Object<Interpreter.Value>} */
  this.properties;
  throw Error('Inner class constructor not callable on prototype');
};

/** @type {Interpreter.prototype.Object} */
Interpreter.prototype.Object.prototype.proto = null;

/** @type {string} */
Interpreter.prototype.Object.prototype.class = '';

/** @param {!Interpreter.Owner} perms @return {boolean} */
Interpreter.prototype.Object.prototype.isExtensible = function(perms) {};

/** @param {!Interpreter.Owner} perms @return {boolean} */
Interpreter.prototype.Object.prototype.preventExtensions = function(perms) {};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {!Descriptor}
 */
Interpreter.prototype.Object.prototype.getOwnPropertyDescriptor = function(
    key, perms) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Descriptor} desc
 * @param {!Interpreter.Owner=} perms
 */
Interpreter.prototype.Object.prototype.defineProperty = function(
    key, desc, perms) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.prototype.Object.prototype.has = function(key, perms) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {Interpreter.Value}
 */
Interpreter.prototype.Object.prototype.get = function(key, perms) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {Interpreter.Value} value
 * @param {!Interpreter.Owner} perms
 */
Interpreter.prototype.Object.prototype.set = function(key, value, perms) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.prototype.Object.prototype.deleteProperty = function(key, perms) {
  throw Error('Inner class method not callable on prototype');
};

/** @param {!Interpreter.Owner} perms @return {!Array<string>} */
Interpreter.prototype.Object.prototype.ownKeys = function(perms) {
  throw Error('Inner class method not callable on prototype');
};

/** @return {string} */
Interpreter.prototype.Object.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};

/** @return {Interpreter.Value} */
Interpreter.prototype.Object.prototype.valueOf = function() {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @extends {Interpreter.prototype.Object}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.Function = function(owner, proto) {
  throw Error('Inner class constructor not callable on prototype');
};

/** @override */
Interpreter.prototype.Function.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {Interpreter.Value} value
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.prototype.Function.prototype.hasInstance = function(value, perms) {
  throw Error('Inner class method not callable on prototype');
};

/** @param {string} name */
Interpreter.prototype.Function.prototype.setName = function(name) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {!Interpreter} intrp The interpreter.
 * @param {!Interpreter.Thread} thread The current thread.
 * @param {!Interpreter.State} state The current state.
 * @param {Interpreter.Value} thisVal The this value passed into function.
 * @param {!Array<Interpreter.Value>} args The arguments to the call.
 * @return {Interpreter.Value|!FunctionResult}
 */
Interpreter.prototype.Function.prototype.call = function(
    intrp, thread, state, thisVal, args) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {!Interpreter} intrp The interpreter.
 * @param {!Interpreter.Thread} thread The current thread.
 * @param {!Interpreter.State} state The current state.
 * @param {!Array<Interpreter.Value>} args The arguments to the call.
 * @return {Interpreter.Value|!FunctionResult}
 */
Interpreter.prototype.Function.prototype.construct = function(
    intrp, thread, state, args) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @extends {Interpreter.prototype.Function}
 * @param {!Interpreter.Node} node
 * @param {!Interpreter.Scope} scope Enclosing scope.
 * @param {string} src
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.UserFunction = function(node, scope, src, owner, proto) {
  /** @type {!Interpreter.Node} */
  this.node;
  /** @type {!Interpreter.Scope} */
  this.scope;
  /** @type {string} */
  this.source;
  throw Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @extends {Interpreter.prototype.Function}
 * @param {!NativeFunctionOptions=} options
 */
Interpreter.prototype.NativeFunction = function(options) {
  throw Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @extends {Interpreter.prototype.NativeFunction}
 * @param {!Function} impl
 * @param {boolean} legalConstructor
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.OldNativeFunction =
    function(impl, legalConstructor, owner, proto) {
  /** @type {!Function} */
  this.impl;
  /** @type {boolean} */
  this.illegalConstructor;
  throw Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @extends {Interpreter.prototype.OldNativeFunction}
 * @param {!Function} impl
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.OldAsyncFunction =
    function(impl, owner, proto) {
  throw Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @extends {Interpreter.prototype.Object}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.Array = function(owner, proto) {
  throw Error('Inner class constructor not callable on prototype');
};

/** @override */
Interpreter.prototype.Array.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @extends {Interpreter.prototype.Object}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.Date = function(owner, proto) {
  /** @type {!Date} */
  this.date;
  throw Error('Inner class constructor not callable on prototype');
};

/** @override */
Interpreter.prototype.Date.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};

/** @return {Interpreter.Value} */
Interpreter.prototype.Date.prototype.valueOf = function() {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @extends {Interpreter.prototype.Object}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.RegExp = function(owner, proto) {
  /** @type {!RegExp} */
  this.regexp;
  throw Error('Inner class constructor not callable on prototype');
};

/** @override */
Interpreter.prototype.RegExp.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};

/** @param {!RegExp} nativeRegexp The native regular expression. */
Interpreter.prototype.RegExp.prototype.populate = function(nativeRegexp) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @extends {Interpreter.prototype.Object}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 * @param {string=} message
 */
Interpreter.prototype.Error = function(owner, proto, message) {
  throw Error('Inner class constructor not callable on prototype');
};

/** @override */
Interpreter.prototype.Error.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @extends {Interpreter.prototype.Object}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.WeakMap = function(owner, proto) {
  /** @type {!WeakMap} */
  this.weakMap;
  throw Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @param {?Interpreter.Owner} owner
 * @param {number} port
 * @param {!Interpreter.prototype.Object} proto
 */
Interpreter.prototype.Server = function(owner, port, proto) {
  /** @type {?Interpreter.Owner} */
  this.owner;
  /** @type {number} */
  this.port;
  /** @type {Interpreter.prototype.Object} */
  this.proto;
  /** @private @type {net.Server} */
  this.server_;
  throw Error('Inner class constructor not callable on prototype');
};

/** @param {!Function=} onListening @param {!Function=} onError */
Interpreter.prototype.Server.prototype.listen = function(onListening, onError) {
  throw Error('Inner class method not callable on prototype');
};

/** @param {!Function=} onClose */
Interpreter.prototype.Server.prototype.unlisten = function(onClose) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @implements {Interpreter.ObjectLike}
 * @param {(boolean|number|string)} prim
 */
Interpreter.prototype.Box = function(prim) {
  /** @private @type {(undefined|null|boolean|number|string)} */
  this.primitive_;
  /** @type {!Interpreter.prototype.Object} */
  this.proto;
  throw Error('Inner class constructor not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {!Descriptor}
 */
Interpreter.prototype.Box.prototype.getOwnPropertyDescriptor = function(
    key, perms) {
  throw Error('Inner class method not callable on prototype');
}
/**
 * @param {string} key
 * @param {!Descriptor} desc
 * @param {!Interpreter.Owner} perms
 */
Interpreter.prototype.Box.prototype.defineProperty = function(
    key, desc, perms) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.prototype.Box.prototype.has = function(key, perms) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {Interpreter.Value}
 */
Interpreter.prototype.Box.prototype.get = function(key, perms) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @param {Interpreter.Value} value
 */
Interpreter.prototype.Box.prototype.set = function(key, value, perms) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.prototype.Box.prototype.deleteProperty = function(key, perms) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {!Interpreter.Owner} perms
 * @return {!Array<string>}
 */
Interpreter.prototype.Box.prototype.ownKeys = function(perms) {
  throw Error('Inner class method not callable on prototype');
};

/** @return {string} String value. */
Interpreter.prototype.Box.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};

/** @return {Interpreter.Value} Value. */
Interpreter.prototype.Box.prototype.valueOf = function() {
  throw Error('Inner class method not callable on prototype');
};

/**
 * Typedef for the functions used to implement NativeFunction.call.
 * @typedef {function(this: Interpreter.prototype.NativeFunction,
 *                    !Interpreter,
 *                    !Interpreter.Thread,
 *                    !Interpreter.State,
 *                    Interpreter.Value,
 *                    !Array<Interpreter.Value>)
 *               : (Interpreter.Value|!FunctionResult)}
 */
Interpreter.NativeCallImpl;

/**
 * Typedef for the functions used to implement NativeFunction.construct.
 * @typedef {function(this: Interpreter.prototype.NativeFunction,
 *                    !Interpreter,
 *                    !Interpreter.Thread,
 *                    !Interpreter.State,
 *                    !Array<Interpreter.Value>)
 *               : (Interpreter.Value|!FunctionResult)}
 */
Interpreter.NativeConstructImpl;

///////////////////////////////////////////////////////////////////////////////

/**
 * Install the actual Object, Function, Array, RegExp, Error,
 * etc. data-object constructors on an Interpreter instance.  Should
 * be called just once at interpreter-creation time.
 */
Interpreter.prototype.installTypes = function() {
  var intrp = this;

  /**
   * Class for an object.
   * @constructor
   * @extends {Interpreter.prototype.Object}
   * @param {?Interpreter.Owner=} owner Owner object or null.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.Object = function(owner, proto) {
    if (proto === undefined) {
      proto = intrp.OBJECT;
    }
    if (owner === undefined) {
      owner = null;
    }
    // We must define .proto before .properties, because our
    // children's .properties will inherit from ours, and the
    // deserializer is not smart enough to deal with encountering
    // children's .properties before it has resurrected the
    // .proto.properties.
    this.proto = proto;
    this.properties = Object.create((proto === null) ? null : proto.properties);
    // We must define .owner after .properties because we need to make
    // sure that Object.prototype's .properties object is serialized
    // before root, or a similar problem occurs.
    this.owner = owner;
  };

  /** @type {Interpreter.prototype.Object} */
  intrp.Object.prototype.proto = null;
  /** @type {string} */
  intrp.Object.prototype.class = 'Object';

  /**
   * The [[IsExtensible]] internal method from ES6 §9.1.3, with
   * substantial adaptations for Code City including added perms
   * checks.
   * @param {!Interpreter.Owner} perms Who is trying to check?
   * @return {boolean} Is the object extensible?
   */
  intrp.Object.prototype.isExtensible = function(perms) {
    if (perms === null) throw TypeError("null can't check extensibility");
    // TODO(cpcallen:perms): add check for (object) readability.
    return Object.isExtensible(this.properties);
  };

  /**
   * The [[PreventExtensions]] internal method from ES6 §9.1.4, with
   * substantial adaptations for Code City including added perms
   * checks.
   * @param {!Interpreter.Owner} perms Who is trying to prevent extensions?
   * @return {boolean} Is the object extensible afterwards?
   */
  intrp.Object.prototype.preventExtensions = function(perms) {
    if (perms === null) throw TypeError("null can't prevent extensibions");
    // TODO(cpcallen:perms): add "controls"-type perm check.
    Object.preventExtensions(this.properties);
    return true;
  };

  /**
   * The [[GetOwnOwnProperty]] internal method from ES5.1 §8.12.1,
   * with substantial adaptations for Code City including added perms
   * checks (but no support for getter or setters).
   * @param {string} key Key (name) of property to get.
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {!Descriptor} The property descriptor, or undefined if no
   *     such property exists.
   */
  intrp.Object.prototype.getOwnPropertyDescriptor = function(key, perms) {
    if (perms === null) throw TypeError("null can't getOwnPropertyDescriptor");
    // TODO(cpcallen:perms): add check for (property) readability.
    var pd = Object.getOwnPropertyDescriptor(this.properties, key);
    // TODO(cpcallen): can we eliminate this pointless busywork while
    // still maintaining type safety?
    return pd && new Descriptor(pd.writable, pd.enumerable, pd.configurable)
        .withValue(/** @type {Interpreter.Value} */ (pd.value));
  };

  /**
   * The [[DefineOwnProperty]] internal method from ES5.1 §8.12.9,
   * with substantial adaptations for Code City including added perms
   * checks (but no support for getter or setters).
   * @param {string} key Key (name) of property to set.
   * @param {!Descriptor} desc The property descriptor.
   * @param {!Interpreter.Owner=} perms Who is trying to set it?  If
   *     omitted, defaults to this.owner but skips perm check.  (This
   *     is intended to be used only when constructing.)
   */
  intrp.Object.prototype.defineProperty = function(key, desc, perms) {
    if (perms !== undefined) {
      if (perms === null) throw TypeError("null can't defineProperty");
      // TODO(cpcallen:perms): add "controls"-type perm check.
    }
    try {
      Object.defineProperty(this.properties, key, desc);
    } catch (e) {
      throw intrp.errorNativeToPseudo(e, perms || this.owner);
    }
  };

  /**
   * The [[HasProperty]] internal method from ES5.1 §8.12.6, with
   * substantial adaptations for Code City including added perms
   * checks.
   * @param {string} key Key (name) of property to get.
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {boolean} The value of the property, or undefined.
   */
  intrp.Object.prototype.has = function(key, perms) {
    if (perms === null) throw TypeError("null can't has");
    // TODO(cpcallen:perms): add check for (object) readability.
    return key in this.properties;
  };

  /**
   * The [[Get]] internal method from ES5.1 §8.12.3, with substantial
   * adaptations for Code City including added perms checks (but no
   * support for getters).
   * @param {string} key Key (name) of property to get.
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {Interpreter.Value} The value of the property, or undefined.
   */
  intrp.Object.prototype.get = function(key, perms) {
    if (perms === null) throw TypeError("null can't get");
    // TODO(cpcallen:perms): add check for (property) readability.
    return this.properties[key];
  };

  /**
   * The [[Set]] internal method from ES5.1 §8.12.5, with substantial
   * adaptations for Code City including added perms checks (but no
   * support for setters).
   * @param {string} key Key (name) of property to set.
   * @param {!Interpreter.Owner} perms Who is trying to set it?
   * @param {Interpreter.Value} value The new value of the property.
   */
  intrp.Object.prototype.set = function(key, value, perms) {
    if (perms === null) throw TypeError("null can't set");
    // TODO(cpcallen:perms): add "controls"-type perm check.
    try {
      this.properties[key] = value;
    } catch (e) {
      throw intrp.errorNativeToPseudo(e, perms);
    }

  };

  /**
   * The [[Delete]] internal method from ES5.1 §8.12.7, with
   * substantial adaptations for Code City including added perms
   * checks (but no support for getters).
   * @param {string} key Key (name) of property to get.
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {boolean} True iff successful.
   */
  intrp.Object.prototype.deleteProperty = function(key, perms) {
    if (perms === null) throw TypeError("null can't delete");
    // TODO(cpcallen:perms): add "controls"-type perm check.
    try {
      delete this.properties[key];
    } catch (e) {
      throw intrp.errorNativeToPseudo(e, perms);
    }
    return true;
  };

  /**
   * The [[OwnPropertyKeys]] internal method from ES6 §9.1.12, with
   * substantial adaptations for Code City including added perms
   * checks.
   *
   * TODO(cpcallen:perms): decide whether null user can read
   * properties.  (At the moment this is forbidden redundantly by type
   * signature an runtime check; one or both should be removed.)
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {!Array<string>} An array of own property keys.
   */
  intrp.Object.prototype.ownKeys = function(perms) {
    if (perms === null) throw TypeError("null can't ownPropertyKeys");
    // TODO(cpcallen:perms): add check for (object) readability.
    return Object.getOwnPropertyNames(this.properties);
  };

  /**
   * Convert this object into a string.
   * @return {string} String value.
   * @override
   */
  intrp.Object.prototype.toString = function() {
    var c;
    if (this instanceof intrp.Object) {
      c = this.class;
    } else {
      c = ({
        undefined: 'Undefined',
        null: 'Null',
        boolean: 'Boolean',
        number: 'Number',
        string: 'String',
      })[typeof this];
    }
    return '[object ' + c + ']';
  };

  /**
   * Return the object value.
   * @return {Interpreter.Value} Value.
   * @override
   */
  intrp.Object.prototype.valueOf = function() {
    return this;
  };

  /**
   * Class for a function.
   * @constructor
   * @extends {Interpreter.prototype.Function}
   * @param {?Interpreter.Owner=} owner Owner object (default: null).
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.Function = function(owner, proto) {
    intrp.Object.call(/** @type {?} */ (this), owner,
        (proto === undefined ? intrp.FUNCTION : proto));
  };

  intrp.Function.prototype = Object.create(intrp.Object.prototype);
  intrp.Function.prototype.constructor = intrp.Function;
  intrp.Function.prototype.class = 'Function';

  /**
   * The [[HasInstance]] internal method from §15.3.5.3 of the ES5.1 spec.
   * @param {Interpreter.Value} value The value to be checked for
   *     being an instance of this function.
   * @param {!Interpreter.Owner} perms Who wants to know?  Used in
   *     readability check of .constructor property and as owner of
   *     any Errors thrown.
   * @return {boolean}
   */
  intrp.Function.prototype.hasInstance = function(value, perms) {
    if (!(value instanceof intrp.Object)) {
      return false;
    }
    var prot = this.get('prototype', perms);
    if (!(prot instanceof intrp.Object)) {
      throw new intrp.Error(perms, intrp.TYPE_ERROR,
          "Function has non-object prototype '" + prot +
          "' in instanceof check");
    }
    for (var v = value.proto; v !== null; v = v.proto) {
      if (v === prot) {
        return true;
      }
    }
    return false;
  };

  /**
   * Add a .name property to this function object.  Partially
   * implements SetFunctionName from §9.2.11 of the ES6 spec.
   * @param {string} name Name of function.
   */
  intrp.Function.prototype.setName = function(name) {
    if (this.getOwnPropertyDescriptor('name', intrp.ROOT)) {
      throw Error('Function alreay has name??');
    }
    this.defineProperty('name', Descriptor.c.withValue(name));
  };

  /**
   * The [[Call]] internal method defined by §13.2.1 of the ES5.1 spec.
   * Generic functions (neither native nor user) can't be called.
   * @param {!Interpreter} intrp The interpreter.
   * @param {!Interpreter.Thread} thread The current thread.
   * @param {!Interpreter.State} state The current state.
   * @param {Interpreter.Value} thisVal The this value passed into function.
   * @param {!Array<Interpreter.Value>} args The arguments to the call.
   * @return {Interpreter.Value}
   * @override
   */
  intrp.Function.prototype.call = function(
      intrp, thread, state, thisVal, args) {
    throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
        "Class constructor " + this + " cannot be invoked without 'new'");
  };

  /**
   * The [[Construct]] internal method defined by §13.2.2 of the ES5.1
   * spec.
   * Generic functions (neither native nor user) can't be constructed.
   * @param {!Interpreter} intrp The interpreter.
   * @param {!Interpreter.Thread} thread The current thread.
   * @param {!Interpreter.State} state The current state.
   * @param {!Array<Interpreter.Value>} args The arguments to the call.
   * @return {Interpreter.Value}
   */
  intrp.Function.prototype.construct = function(
      intrp, thread, state, args) {
    throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
        this + ' is not a constructor');
  };

  /**
   * Class for a user-defined function.
   * @constructor
   * @extends {Interpreter.prototype.UserFunction}
   * @param {!Interpreter.Node} node AST node for function body.
   * @param {!Interpreter.Scope} scope Enclosing scope.
   * @param {string} src (Whole) source from which AST was parsed.
   * @param {?Interpreter.Owner=} owner Owner object (default: null).
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.UserFunction = function(node, scope, src, owner, proto) {
    if (!node) {  // Deserializing
      return;
    }
    intrp.Function.call(/** @type {?} */ (this), owner, proto);
    this.node = node;
    this.scope = scope;
    if (node['id']) {
      this.setName(node['id']['name']);
    }
    var length = node['params'].length;
    this.defineProperty('length', Descriptor.none.withValue(length));
    // Record the source for the function (only), for use by
    // (pseudo)Function.toString().
    this.source = src.substring(node['start'], node['end']);
    // Record the (whole) source on the function node's body node, for
    // use by the the (pseudo)Error constructor when generating stack
    // traces (via Thread.prototype.getSource).  We store it on the
    // body node (rather than on the function node) because the
    // function node never appears on the stateStack_ when the
    // function is being executed.  We save the full original source
    // (not just the part containing the function) because the start
    // and end offsets on the AST nodes are absolute, not relative.
    if (!node['body']['source']) {
      node['body']['source'] = src;
    }
    // Add .prototype property pointing at a new plain Object.
    var protoObj = new intrp.Object(this.owner);
    this.defineProperty('prototype', Descriptor.w.withValue(protoObj));
    protoObj.defineProperty('constructor', Descriptor.wc.withValue(this));
  };

  intrp.UserFunction.prototype = Object.create(intrp.Function.prototype);
  intrp.UserFunction.prototype.constructor = intrp.UserFunction;

  /**
   * Convert this function into a string.
   * @override
   */
  intrp.UserFunction.prototype.toString = function() {
    return this.source;
  };

  /**
   * The [[Call]] internal method defined by §13.2.1 of the ES5.1 spec.
   * @override
   */
  intrp.UserFunction.prototype.call = function(
      intrp, thread, state, thisVal, args) {
    if (this.owner === null) {
      throw new intrp.Error(state.scope.perms, intrp.PERM_ERROR,
          'Functions with null owner are not executable');
    }
    // Aside: we need to pass this.owner, rather than
    // this.scope.perms, for the new scope perms because (1) we want
    // to be able to change the owner of a function after it's
    // created, and (2) functions created using the Function
    // constructor have this.scope set to the global scope, which is
    // owned by root!
    var scope = new Interpreter.Scope(this.owner, this.scope);
    intrp.populateScope_(this.node['body'], scope, this.source);
    // Add all arguments.
    var params = this.node['params'];
    for (var i = 0; i < params.length; i++) {
      var paramName = params[i]['name'];
      var paramValue = args.length > i ? args[i] : undefined;
      intrp.addVariableToScope(scope, paramName, paramValue);
    }
    // Build arguments variable.
    var argsList = new intrp.Array(this.owner);
    for (var i = 0; i < args.length; i++) {
      argsList.set(String(i), args[i], this.owner);
    }
    intrp.addVariableToScope(scope, 'arguments', argsList, true);
    // Add the function's name (var x = function foo(){};)
    var name = this.node['id'] && this.node['id']['name'];
    if (name) {
      intrp.addVariableToScope(scope, name, this, true);
    }
    intrp.addVariableToScope(scope, 'this', thisVal, true);
    state.value = undefined;  // Default value if no explicit return.
    thread.stateStack_.push(new Interpreter.State(this.node['body'], scope));
    return FunctionResult.AwaitValue;
  };

  /**
   * The [[Construct]] internal method defined by §13.2.2 of the ES5.1
   * spec.
   * @override
   */
  intrp.UserFunction.prototype.construct = function(
      intrp, thread, state, args) {
    if (!state.object_) {
      if (this.owner === null) {
        throw new intrp.Error(state.scope.perms, intrp.PERM_ERROR,
            'Functions with null owner are not constructable');
      }
      // TODO(cpcallen:perms): Is it really OK to construct if caller
      // can't read .prototype?
      var proto = this.get('prototype', this.owner);
      // Per ES5.1 §13.2.2 step 7: if .prototype is primitive, use
      // Object.prototype instead.
      if (!(proto instanceof intrp.Object)) {
        proto = intrp.OBJECT;
      }
      state.object_ = new intrp.Object(state.scope.perms, proto);
      this.call(intrp, thread, state, state.object_, args);
      return FunctionResult.CallAgain;
    } else {
      // Per ES5.1 §13.2.2 steps 9,10: if constructor returns
      // primitive, return constructed object instead.
      if (!(state.value instanceof intrp.Object)) {
        return state.object_;
      }
      return state.value;
    }
  };

  /**
   * Class for a native function.
   * @constructor
   * @extends {Interpreter.prototype.NativeFunction}
   * @param {!NativeFunctionOptions=} options Options object for
   *     constructing native function.
   */
  intrp.NativeFunction = function(options) {
    options = options || {};
    var owner = (options.owner !== undefined ? options.owner : intrp.ROOT);
    // Invoke super constructor.
    intrp.Function.call(/** @type {?} */ (this), owner, options.proto);
    if (options.length !== undefined) {
      this.defineProperty('length', Descriptor.none.withValue(options.length),
                          owner);
    }
    if (options.call) {
      this.call = options.call;
    }
    if (options.construct) {
      this.construct = options.construct;
    }
    if (options.name || options.id) {
      var id = (options.id || options.name);
      this.setName(options.name !== undefined ?
          options.name : options.id.replace(/^.*\./, ''));
      // Register builtin and make sure call and construct are serializable.
      if (intrp.builtins_[id]) {
        throw ReferenceError('Duplicate builtin id ' + id);
      }
      intrp.builtins_[id] = this;
      if (this.call && this.call.id === undefined) {
        this.call.id = id;
      }
      if (this.construct && this.construct.id === undefined) {
        this.construct.id = id + ' [[construct]]';
      }
    }
  };

  intrp.NativeFunction.prototype = Object.create(intrp.Function.prototype);
  intrp.NativeFunction.prototype.constructor = intrp.NativeFunction;

  /**
   * Convert this function into a string.
   * @override
   */
  intrp.NativeFunction.prototype.toString = function() {
    // TODO(cpcallen): include formal parameter names?
    // TODO(cpcallen:perms): readability check?  Would need to add
    // perms param, in which case method should probably be renamed
    // and we need ot audit all use of String() throughout the
    // interpreter (including implicit use inside v8-native
    // functions).
    return 'function ' + this.get('name', intrp.ROOT) +
        '() { [native code] }';
  };

  /**
   * Class for an old native function.
   * @constructor
   * @extends {Interpreter.prototype.OldNativeFunction}
   * @param {!Function} impl Old-style native function implementation
   * @param {boolean} legalConstructor True if the function can be used as a
   *     constructor (e.g. Array), false if not (e.g. escape).
   * @param {?Interpreter.Owner=} owner Owner object or null (default: root).
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.OldNativeFunction = function(impl, legalConstructor, owner, proto) {
    if (!impl) {  // Deserializing
      return;
    }
    intrp.NativeFunction.call(/** @type {?} */ (this),
        {owner: owner, proto: proto, length: impl.length});
    this.impl = impl;
    this.illegalConstructor = !legalConstructor;
  };

  intrp.OldNativeFunction.prototype =
      Object.create(intrp.NativeFunction.prototype);
  intrp.OldNativeFunction.prototype.constructor = intrp.OldNativeFunction;

  /** @override */
  intrp.OldNativeFunction.prototype.call = function(
      intrp, thread, state, thisVal, args) {
    if (this.owner === null) {
      throw new intrp.Error(state.scope.perms, intrp.PERM_ERROR,
          'Functions with null owner are not executable');
    }
    return this.impl.apply(thisVal, args);
  };

  /** @override */
  intrp.OldNativeFunction.prototype.construct = function(
      intrp, thread, state, args) {
    if (this.illegalConstructor) {
      // Pass to super, which will complain about non-callability:
      intrp.Function.prototype.construct.call(
          /** @type {?} */ (this), intrp, thread, state, args);
    }
    if (this.owner === null) {
      throw new intrp.Error(state.scope.perms, intrp.PERM_ERROR,
          'Functions with null owner are not constructable');
    }
    return this.impl.apply(undefined, args);
  };

  /**
   * Class for an async function.
   * @constructor
   * @extends {Interpreter.prototype.OldAsyncFunction}
   * @param {!Function} impl Old-style native function implementation
   * @param {?Interpreter.Owner=} owner Owner object or null.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.OldAsyncFunction = function(impl, owner, proto) {
    // BUG(cpcallen): This results in .length being +2 too large.
    intrp.OldNativeFunction.call(
        /** @type {?} */ (this), impl, false, owner, proto);
  };

  intrp.OldAsyncFunction.prototype =
      Object.create(intrp.OldNativeFunction.prototype);
  intrp.OldAsyncFunction.prototype.constructor = intrp.OldAsyncFunction;

  /** @override */
  intrp.OldAsyncFunction.prototype.call = function(
      intrp, thread, state, thisVal, args) {
    if (this.owner === null) {
      throw new intrp.Error(state.scope.perms, intrp.PERM_ERROR,
          'Functions with null owner are not executable');
    }
    var done = false;

    /**
     * Invariant check to verify it's safe to resolve or reject this
     * async function call.  Blow up if the call has already been
     * resolved/rejected, or if the thread does not appear to be in a
     * plausible state.
     */
    var check = function() {
      if (done) {
        throw Error('Async function resolved or rejected more than once');
      }
      done = true;
      if (thread.status !== Interpreter.Thread.Status.BLOCKED ||
          thread.stateStack_[thread.stateStack_.length - 1] !== state) {
        throw Error('Thread state corrupt completing async function call??');
      }
    };

    var callbacks = [
      function resolve(value) {
        check();
        state.value = value;
        thread.status = Interpreter.Thread.Status.READY;
        intrp.go_();
      },
      function reject(value) {
        check();
        thread.status = Interpreter.Thread.Status.READY;
        intrp.unwind_(
            thread, Interpreter.CompletionType.THROW, value, undefined);
        intrp.go_();
      }];
    // Prepend resolve, reject to arguments.
    args = callbacks.concat(args);
    thread.status = Interpreter.Thread.Status.BLOCKED;
    intrp.OldNativeFunction.prototype.call.call(
        /** @type {?} */ (this), intrp, thread, state, thisVal, args);
    return FunctionResult.AwaitValue;
  };

  /**
   * Async functions not constructable; use generic construct which
   * always throws.
   * @override */
  intrp.OldAsyncFunction.prototype.construct =
      intrp.Function.prototype.construct;

  /**
   * Class for an array
   * @constructor
   * @extends {Interpreter.prototype.Array}
   * @param {?Interpreter.Owner=} owner Owner object or null.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.Array = function(owner, proto) {
    if (proto === undefined) {
      proto = intrp.ARRAY;
    }
    intrp.Object.call(/** @type {?} */ (this), owner, proto);
    this.properties = [];
    Object.setPrototypeOf(this.properties,
                          (proto === null) ? null : proto.properties);
  };

  intrp.Array.prototype = Object.create(intrp.Object.prototype);
  intrp.Array.prototype.constructor = intrp.Array;
  intrp.Array.prototype.class = 'Array';

  /**
   * Convert array-like objects into a string.
   * @override
   */
  intrp.Array.prototype.toString = function() {
    if (!(this instanceof intrp.Object)) {
      // TODO(cpcallen): this is supposed to do a ToObject.  Fake it
      // for now using native Array.prototype.toString.  Need to
      // verify whether this is good enough.
      return Array.prototype.toString.apply(/** @type {?} */(this));
    }
    var cycles = intrp.toStringCycles_;
    cycles.push(this);
    try {
      var strs = [];
      // BUG(cpcallen): Array.prototype.toString should be generic,
      // but here we depend on .length.
      for (var i = 0; i < this.properties.length; i++) {
        var value = this.properties[i];
        strs[i] = (value instanceof intrp.Object &&
            cycles.indexOf(value) !== -1) ? '...' : value;
      }
    } finally {
      cycles.pop();
    }
    return strs.join(',');
  };

  /**
   * Class for a date.
   * @constructor
   * @extends {Interpreter.prototype.Date}
   * @param {?Interpreter.Owner=} owner Owner object or null.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.Date = function(owner, proto) {
    intrp.Object.call(/** @type {?} */ (this), owner,
        (proto === undefined ? intrp.DATE : proto));
    /** @type {Date} */
    this.date = null;
  };

  intrp.Date.prototype = Object.create(intrp.Object.prototype);
  intrp.Date.prototype.constructor = intrp.Date;
  intrp.Date.prototype.class = 'Date';

  /**
   * Return the date as a string.
   * @override
   */
  intrp.Date.prototype.toString = function() {
    return this.date.toString();
  };

  /**
   * Return the date as a numeric value.
   * @override
   */
  intrp.Date.prototype.valueOf = function() {
    return this.date.valueOf();
  };

  /**
   * Class for a regexp
   * @constructor
   * @extends {Interpreter.prototype.RegExp}
   * @param {?Interpreter.Owner=} owner Owner object or null.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.RegExp = function(owner, proto) {
    intrp.Object.call(/** @type {?} */ (this), owner,
        (proto === undefined ? intrp.REGEXP : proto));
    /** @type {RegExp} */
    this.regexp = null;
  };

  intrp.RegExp.prototype = Object.create(intrp.Object.prototype);
  intrp.RegExp.prototype.constructor = intrp.RegExp;
  intrp.RegExp.prototype.class = 'RegExp';

  /**
   * Return the regexp as a string.
   * @override
   */
  intrp.RegExp.prototype.toString = function() {
    if (!(this.regexp instanceof RegExp)) {
      // TODO(cpcallen): ES5.1 §15.10.6.4 doesn't say what happens
      // when this is applied to a non-RegExp.  ES6 §21.2.5.14 does -
      // and the results are possibly weird, e.g. returning
      // "/undefined/undefined" or the like...  :-/
      return '//';
    }
    return this.regexp.toString();
  };

  /**
   * Initialize a (pseudo) RegExp from a native regular expression object.
   * @param {!RegExp} nativeRegexp The native regular expression.
   */
  intrp.RegExp.prototype.populate = function(nativeRegexp) {
    this.regexp = nativeRegexp;
    // lastIndex is settable, all others are read-only attributes
    this.defineProperty('lastIndex',
        Descriptor.w.withValue(nativeRegexp.lastIndex));
    this.defineProperty('source',
        Descriptor.none.withValue(nativeRegexp.source));
    this.defineProperty('global',
        Descriptor.none.withValue(nativeRegexp.global));
    this.defineProperty('ignoreCase',
        Descriptor.none.withValue(nativeRegexp.ignoreCase));
    this.defineProperty('multiline',
        Descriptor.none.withValue(nativeRegexp.multiline));
  };

  /**
   * Class for an error object
   * @constructor
   * @extends {Interpreter.prototype.Error}
   * @param {?Interpreter.Owner=} owner Owner object or null.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   * @param {string=} message Optional message to be attached to error object.
   */
  intrp.Error = function(owner, proto, message) {
    intrp.Object.call(/** @type {?} */ (this), owner,
        (proto === undefined ? intrp.ERROR : proto));
    if (message !== undefined) {
      this.defineProperty('message', Descriptor.wc.withValue(message));
    }
    // Construct a text-based stack.
    // Don't bother when building Error.prototype.
    if (intrp.thread) {
      var stack = [];
      for (var i = intrp.thread.stateStack_.length - 1; i >= 0; i--) {
        var state = intrp.thread.stateStack_[i];
        var node = state.node;
        // Always add the first state to the stack.
        // Also add any call expression that is executing.
        if (stack.length && !state.includeInStack()) {
          continue;
        }
        var code = intrp.thread.getSource(i);
        if (code === undefined) {
          continue;
        }
        var lineStart = code.lastIndexOf('\n', node['start']);
        if (lineStart === -1) {
          lineStart = 0;
        } else {
          lineStart++;
        }
        var lineEnd = code.indexOf('\n', lineStart + 1);
        if (lineEnd === -1) {
          lineEnd = code.length;
        }
        var line = code.substring(lineStart, lineEnd);
        stack.push(line);
      }
      this.defineProperty('stack', Descriptor.wc.withValue(stack.join('\n')));
    }
  };

  intrp.Error.prototype = Object.create(intrp.Object.prototype);
  intrp.Error.prototype.constructor = intrp.Error;
  intrp.Error.prototype.class = 'Error';

  /**
   * Return the error as a string.
   * @override
   */
  intrp.Error.prototype.toString = function() {
    var cycles = intrp.toStringCycles_;
    if (cycles.indexOf(this) !== -1) {
      return '[object Error]';
    }
    cycles.push(this);
    try {
      // TODO(cpcallen:perms): Wrong perms here.  Should have/use
      // perms arg, but see note in intrp.Function.prototype.toString.
      var name = this.get('name', intrp.ROOT);
      var message = this.get('message', intrp.ROOT);
      name = (name === undefined) ? 'Error' : String(name);
      message = (message === undefined) ? '' : String(message);
      if (name) {
        return message ? (name + ': ' + message) : name;
      }
      return message;
    } finally {
      cycles.pop();
    }
  };

  /**
   * The WeakMap class from ES6.
   * @constructor
   * @extends {Interpreter.prototype.WeakMap}
   * @param {?Interpreter.Owner=} owner Owner object or null.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.WeakMap = function(owner, proto) {
    intrp.Object.call(/** @type {?} */ (this), owner,
        (proto === undefined ? intrp.WEAKMAP : proto));
    /** @type {!WeakMap} */
    this.weakMap = new WeakMap;
  };

  intrp.WeakMap.prototype = Object.create(intrp.Object.prototype);
  intrp.WeakMap.prototype.constructor = intrp.WeakMap;
  intrp.WeakMap.prototype.class = 'WeakMap';

  /**
   * Server is an (owner, port, proto, (extra info)) tuple representing a
   * listening server.  It encapsulates node's net.Server type, with
   * some additional info needed to implement the connectionListen()
   * API.  In its present form it is not suitable for exposure as a
   * userland pseduoObject, but it is intended to be easily adaptable
   * for that if desired.
   * @constructor
   * @extends {Interpreter.prototype.Server}
   * @param {?Interpreter.Owner} owner Owner object or null.
   * @param {number} port Port to listen on.
   * @param {!Interpreter.prototype.Object} proto Prototype object for
   *     new connections.
   */
  intrp.Server = function(owner, port, proto) {
    // Special excepetion: port === undefined when deserializing, in
    // violation of usual type rules.
    if ((port !== (port >>> 0) || port > 0xffff) && port !== undefined) {
      throw RangeError('invalid port ' + port);
    }
    /** @type {?Interpreter.Owner} */
    this.owner = owner;
    /** @type {number} */
    this.port = port;
    /** @type {!Interpreter.prototype.Object} */
    this.proto = proto;
    this.server_ = null;
  };

  /**
   * Start a Server object listening on its assigned port.
   * @param {!Function=} onListening Callback to call once listening has begun.
   * @param {!Function=} onError Callback to call in case of error.
   */
  intrp.Server.prototype.listen = function(onListening, onError) {
    // Invariant checks.
    if (this.port === undefined || !(this.proto instanceof intrp.Object)) {
      throw Error('Invalid Server state');
    }
    if (intrp.listeners_[this.port] !== this) {
      throw Error('Listening on server not listed in .listeners_??');
    }
    var server = this;  // Because this will be undefined in handlers below.
    // Create net.Server, start it listening, and attached it to this.
    var netServer = new net.Server(/* {allowHalfOpen: true} */);
    netServer.on('connection', function(socket) {
      // TODO(cpcallen): Add localhost test here, like this - only
      // also allow IPV6 connections:
      // if (socket.remoteAddress != '127.0.0.1') {
      //   // Reject connections other than from localhost.
      //   console.log('Rejecting connection from ' + socket.remoteAddress);
      //   socket.end('Connection rejected.');
      //   return;
      // }
      console.log('Connection from %s', socket.remoteAddress);

      // Create new object from proto and call onConnect.
      var obj = new intrp.Object(server.owner, server.proto);
      obj.socket = socket;
      var func = obj.get('onConnect', this.owner);
      if (func instanceof intrp.Function) {
        intrp.createThreadForFuncCall(func, obj, []);
      }

      // Handle incoming data from clients.  N.B. that data is a
      // node buffer object, so we must convert it to a string
      // before passing it to user code.
      socket.on('data', function(data) {
        var func = obj.get('onReceive', this.owner);
        if (func instanceof intrp.Function) {
          intrp.createThreadForFuncCall(func, obj, [String(data)]);
        }
      });

      socket.on('end', function() {
        console.log('Connection from %s closed.', socket.remoteAddress);
        var func = obj.get('onEnd', this.owner);
        if (func instanceof intrp.Function) {
          intrp.createThreadForFuncCall(func, obj, []);
        }
        // TODO(cpcallen): Don't fully close half-closed connection yet.
        socket.end();
      });

      socket.on('error', function(error) {
        console.log('Socket error:', error);
        var func = obj.get('onError', this.owner);
        if (func instanceof intrp.Function && func.owner !== null) {
          var userError = intrp.errorNativeToPseudo(error, func.owner);
          intrp.createThreadForFuncCall(func, obj, [userError]);
        }
      });

      // TODO(cpcallen): save new object somewhere we can find it
      // later (when we want to obtain list of connected objects).
    });

    netServer.on('listening', function() {
      var addr = netServer.address();
      console.log('Listening on %s address %s port %s', addr.family,
                  addr.address, addr.port);
      onListening && onListening();
    });

    netServer.on('error', function(error) {
      // TODO(cpcallen): attach additional information about
      // reason for failure.
      console.log('Listen on port %s failed: %s: %s', server.port,
                  error.name, error.message);
      onError && onError(error);
    });

    netServer.on('close', function() {
      console.log('Done listening on port %s', server.port);
      server.server_ = null;
    });

    netServer.listen(this.port);
    this.server_ = netServer;
  };

  /**
   * Stop a Server object listening on its assigned port.
   * @param {!Function=} onClose Callback to call once listening has ceased.
   */
  intrp.Server.prototype.unlisten = function(onClose) {
    this.server_.close(onClose);
    // Existing .on('close', ...) event handler will take care of
    // setting this.server_ = null.
  };

  /**
   * Class for a boxed primitive.  Does not @extend
   * Interpreter.prototype.Object, because we do not want to expose
   * these to the users.  They're just used internally to simplify the
   * implementation of various bits of code that are specified by
   * ES5.1 or ES6 to do ToObject().
   *
   * @constructor
   * @extends {Interpreter.prototype.Box}
   * @param {(boolean|number|string)} prim Primitive to box
   */
  intrp.Box = function(prim) {
    /** @private @type {(undefined|null|boolean|number|string)} */
    this.primitive_ = prim;
    if (typeof prim === 'boolean') {
      /** @type {!Interpreter.prototype.Object} */
      this.proto = intrp.BOOLEAN;
    } else if (typeof prim === 'number') {
      this.proto = intrp.NUMBER;
    } else if (typeof prim === 'string') {
      this.proto = intrp.STRING;
    } else {
      throw Error('Invalid type in Box');
    }
  };

  /**
   * The [[GetOwnOwnProperty]] internal method from ES5.1 §8.12.1, as
   * applied to temporary Boolean, Number and String class objects.
   * @param {string} key Key (name) of property to get.
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {!Descriptor} The property descriptor, or undefined if no
   *     such property exists.
   * @override
   */
  intrp.Box.prototype.getOwnPropertyDescriptor = function(key, perms) {
    var pd = Object.getOwnPropertyDescriptor(this.primitive_, key);
    // TODO(cpcallen): can we eliminate this pointless busywork while
    // still maintaining type safety?
    return pd && new Descriptor(pd.writable, pd.enumerable, pd.configurable)
        .withValue(/** @type {Interpreter.Value} */ (pd.value));
  };

  /**
   * The [[DefineOwnProperty]] internal method from ES5.1 §8.12.9, as
   * applied to temporary Boolean, Number and String class objects.
   * @param {string} key Key (name) of property to set.
   * @param {!Descriptor} desc The property descriptor.
   * @param {!Interpreter.Owner} perms Who is trying to set it?
   * @override
   */
  intrp.Box.prototype.defineProperty = function(key, desc, perms) {
    throw new intrp.Error(perms, intrp.TYPE_ERROR, "Cannot create property '" +
        key + "' on " + typeof this.primitive_ + " '" + this.primitive_ + "'");
  };

  /**
   * The [[HasProperty]] internal method from ES5.1 §8.12.6, as
   * applied to temporary Boolean, Number and String class objects.
   * @param {string} key Key (name) of property to get.
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {boolean} The value of the property, or undefined.
   * @override
   */
  intrp.Box.prototype.has = function(key, perms) {
    // Important: we want to ignore any extra properties on (e.g.) the
    // native String.prototype, but be sure to find ones on
    // intrp.String.prototype.
    if (Object.getOwnPropertyDescriptor(this.primitive_, key)) {
      return true;
    }
    // Defer to prototype.
    return this.proto.has(key, perms);
  };

  /**
   * The [[Get]] internal method from ES5.1 §8.12.3, as applied to
   * temporary Boolean, Number and String class objects.
   * @param {string} key Key (name) of property to get.
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {Interpreter.Value} The value of the property, or undefined.
   * @override
   */
  intrp.Box.prototype.get = function(key, perms) {
    // Important: we want to ignore any extra properties on (e.g.) the
    // native String.prototype, but be sure to find ones on
    // intrp.String.prototype.
    var pd = Object.getOwnPropertyDescriptor(this.primitive_, key);
    if (pd) {
      return /** @type {string|number} */(pd.value);
    }
    // Defer to prototype.
    return this.proto.get(key, perms);
  };

  /**
   * The [[Set]] internal method from ES5.1 §8.12.5, as
   * applied to temporary Boolean, Number and String class objects.
   * @param {string} key Key (name) of property to set.
   * @param {!Interpreter.Owner} perms Who is trying to set it?
   * @param {Interpreter.Value} value The new value of the property.
   * @override
   */
  intrp.Box.prototype.set = function(key, value, perms) {
    throw new intrp.Error(perms, intrp.TYPE_ERROR, "Cannot set property '" +
        key + "' on " + typeof this.primitive_ + " '" + this.primitive_ + "'");
  };

  /**
   * The [[Delete]] internal method from ES5.1 §8.12.7, as applied to
   * temporary Boolean, Number and String class objects.
   * @param {string} key Key (name) of property to get.
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {boolean} True iff successful.
   */
  intrp.Box.prototype.deleteProperty = function(key, perms) {
    // Attempting to delete property from primitive value.  Succeeds
    // only if property doesn't exist.
    if (Object.getOwnPropertyDescriptor(this.primitive_, key)) {
      throw new intrp.Error(perms, intrp.TYPE_ERROR,
          "Cannot delete property '" + key + "' on " + typeof this.primitive_ +
          " '" + this.primitive_ + "'");
    }
    return true;
  };

  /**
   * The [[OwnPropertyKeys]] internal method from ES6 §9.1.12, as
   * applied to temporary Boolean, Number and String class objects.
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {!Array<string>} An array of own property keys.
   */
  intrp.Box.prototype.ownKeys = function(perms) {
    // Cast necessitated by compiler bug:
    // https://github.com/google/closure-compiler/issues/2878
    return Object.getOwnPropertyNames(/** @type {?} */(this.primitive_));
  };

  /**
   * Convert this boxed primitive into a string.
   * @return {string} String value.
   * @override
   */
  intrp.Box.prototype.toString = function() {
    return String(this.primitive_);
  };

  /**
   * Return the boxed primitive value.
   * @return {Interpreter.Value} Value.
   * @override
   */
  intrp.Box.prototype.valueOf = function() {
    return this.primitive_;
  };
};

///////////////////////////////////////////////////////////////////////////////
// Miscellaneous internal classes not used for storing state
///////////////////////////////////////////////////////////////////////////////

/**
 * Special sentinel values returned by the call or construct method of
 * a (pseudo)Function to indicate that a return value is not
 * immediately available (e.g., in the case of a user function that
 * needs to be evaluated, or an async function that blocks).
 * @constructor
 */
var FunctionResult = function() {};
/**
 * Please evaluate whatever state(s) have been pushed onto the stack,
 * and use their completion value as the return value of the function.
 * @const
 */
FunctionResult.AwaitValue = new FunctionResult;
/**
 * Please invoke .call or .construct again the next time this state is
 * encountered.
 * @const
 */
FunctionResult.CallAgain = new FunctionResult;

/**
 * Options object for constructing a NativeFunction.
 * @typedef {{name: (string|undefined),
 *            length: (number|undefined),
 *            id: (string|undefined),
 *            call: (Interpreter.NativeCallImpl|undefined),
 *            construct: (Interpreter.NativeConstructImpl|undefined),
 *            owner: (?Interpreter.Owner|undefined),
 *            proto: (?Interpreter.prototype.Object|undefined)}}
 */
var NativeFunctionOptions;

/**
 * Class for property descriptors, with commonly-used examples and a
 * function to easily create new descriptors from a prototype.
 * @constructor
 * @param {boolean=} writable Is the property writable?
 * @param {boolean=} enumerable Is the property enumerable?
 * @param {boolean=} configurable Is the property configurable?
 */
var Descriptor = function(writable, enumerable, configurable) {
  if (writable !== undefined) this.writable = writable;
  if (enumerable !== undefined) this.enumerable = enumerable;
  if (configurable !== undefined) this.configurable = configurable;
};

/* Type declaration for the properties that
 * intrp.Object.prototype.defineProperty expects to see on a
 * descriptor.  We use "|undefined)", but what we really mean is "|not
 * defined)" because unfortunately closure-compiler's type system has
 * no way to represent the latter.
 */
/** @type {(Interpreter.Value|undefined)} */
Descriptor.prototype.value;
/** @type {boolean|undefined} */
Descriptor.prototype.writable;
/** @type {boolean|undefined} */
Descriptor.prototype.enumerable;
/** @type {boolean|undefined} */
Descriptor.prototype.configurable;

/**
 * Returns a new descriptor with the same properties as this one, with
 * the addition of a value: member with the given value.
 * @param {Interpreter.Value} value Value for the new descriptor.
 */
Descriptor.prototype.withValue = function(value) {
  var desc = Object.create(this);
  desc.value = value;
  return desc;
};

/** @const */ Descriptor.wec = new Descriptor(true, true, true);
/** @const */ Descriptor.ec = new Descriptor(false, true, true);
/** @const */ Descriptor.wc = new Descriptor(true, false, true);
/** @const */ Descriptor.we = new Descriptor(true, true, false);
/** @const */ Descriptor.w = new Descriptor(true, false, false);
/** @const */ Descriptor.e = new Descriptor(false, true, false);
/** @const */ Descriptor.c = new Descriptor(false, false, true);
/** @const */ Descriptor.none = new Descriptor(false, false, false);

///////////////////////////////////////////////////////////////////////////////
// Step Functions: one to handle each node type.
///////////////////////////////////////////////////////////////////////////////

/**
 * Typedef for step functions.
 *
 * TODO(cpcallen): It should be possible to declare individual
 * functions below using this typedef (instead of listing full type
 * details for each once.
 * https://github.com/google/closure-compiler/issues/2857 is fixed.
 * @typedef {function(this: Interpreter,
 *                    !Array<!Interpreter.State>,
 *                    !Interpreter.State,
 *                    !Interpreter.Node)
 *               : (!Interpreter.State|undefined)}
 */
Interpreter.StepFunction;

/**
 * 'Map' of node types to their corresponding step functions.  Note
 * that a Map is much slower than a null-parent object (v8 in 2017).
 * @const {Object<string,Interpreter.StepFunction>}
 */
var stepFuncs_ = {};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ArrayExpression'] = function (stack, state, node) {
  var n = state.n_;
  if (!state.tmp_) {  // Create Array object
    state.tmp_ = new this.Array(state.scope.perms);
  } else {  // Save most recently-evaluated element.
    state.tmp_.set(String(n), state.value, state.scope.perms);
    n++;
  }
  var /** !Array<!Interpreter.Node> */ elements = node['elements'];
  // Skip any elided elements - they're not defined, not undefined.
  while (n < elements.length && ! elements[n]) {
    n++;
  }
  // Evaluate next element, if we've not run past end.
  if (n < elements.length) {
    state.n_ = n;
    return new Interpreter.State(elements[n], state.scope);
  }
  state.tmp_.set('length', elements.length, state.scope.perms);
  stack.pop();
  stack[stack.length - 1].value = state.tmp_;
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['AssignmentExpression'] = function (stack, state, node) {
  if (state.step_ === 0) {  // Get Reference to left.
    state.step_ = 1;
    // Get Reference for left subexpression.
    return new Interpreter.State(node['left'], state.scope, true);
  }
  if (!state.ref) throw TypeError('left subexpression not an LVALUE??');
  if (state.step_ === 1) {  // Evaluate right.
    if (node['operator'] !== '=') {
      state.tmp_ =
          this.getValue(state.scope, state.ref, state.scope.perms);
    }
    state.step_ = 2;
    return new Interpreter.State(node['right'], state.scope);
  }
  // state.step_ === 2: Got operand(s); do assignment.
  var rightValue = state.value;
  var value = state.tmp_;
  switch (node['operator']) {
    case '=':    value =    rightValue; break;
    case '+=':   value +=   rightValue; break;
    case '-=':   value -=   rightValue; break;
    case '*=':   value *=   rightValue; break;
    case '/=':   value /=   rightValue; break;
    case '%=':   value %=   rightValue; break;
    case '<<=':  value <<=  rightValue; break;
    case '>>=':  value >>=  rightValue; break;
    case '>>>=': value >>>= rightValue; break;
    case '&=':   value &=   rightValue; break;
    case '^=':   value ^=   rightValue; break;
    case '|=':   value |=   rightValue; break;
    default:
      throw SyntaxError('Unknown assignment expression: ' + node['operator']);
  }
  this.setValue(state.scope, state.ref, value, state.scope.perms);
  stack.pop();
  stack[stack.length - 1].value = value;
};

/**
 * Extra info used by CallExpression step function.
 * @typedef {{callee: Interpreter.Value,
 *            this: Interpreter.Value,
 *            directEval: boolean,
 *            arguments: !Array<Interpreter.Value>}}
 */
Interpreter.CallInfo;

/**
 * CallExpression AND NewExpression
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['BinaryExpression'] = function (stack, state, node) {
  if (state.step_ === 0) {  // Evaluate left.
    state.step_ = 1;
    return new Interpreter.State(node['left'], state.scope);
  }
  if (state.step_ === 1) {  // Save left; evaluate right.
    state.step_ = 2;
    state.tmp_ = state.value;
    return new Interpreter.State(node['right'], state.scope);
  }
  // state.step_ === 2: Got operands; do binary operation.
  var leftValue = state.tmp_;
  var rightValue = state.value;
  var /** Interpreter.Value */ value;
  switch (node['operator']) {
    case '==':  value = leftValue ==  rightValue; break;
    case '!=':  value = leftValue !=  rightValue; break;
    case '===': value = leftValue === rightValue; break;
    case '!==': value = leftValue !== rightValue; break;
    case '>':   value = leftValue >   rightValue; break;
    case '>=':  value = leftValue >=  rightValue; break;
    case '<':   value = leftValue <   rightValue; break;
    case '<=':  value = leftValue <=  rightValue; break;
    case '+':   value = leftValue +   rightValue; break;
    case '-':   value = leftValue -   rightValue; break;
    case '*':   value = leftValue *   rightValue; break;
    case '/':   value = leftValue /   rightValue; break;
    case '%':   value = leftValue %   rightValue; break;
    case '&':   value = leftValue &   rightValue; break;
    case '|':   value = leftValue |   rightValue; break;
    case '^':   value = leftValue ^   rightValue; break;
    case '<<':  value = leftValue <<  rightValue; break;
    case '>>':  value = leftValue >>  rightValue; break;
    case '>>>': value = leftValue >>> rightValue; break;
    case 'in':
      if (!(rightValue instanceof this.Object)) {
      throw new this.Error(state.scope.perms, this.TYPE_ERROR,
            "'in' expects an object, not '" + rightValue + "'");
      }
      value = rightValue.has(String(leftValue), state.scope.perms);
      break;
    case 'instanceof':
      if (!(rightValue instanceof this.Function)) {
        throw new this.Error(state.scope.perms, this.TYPE_ERROR,
            'Right-hand side of instanceof is not an object');
      }
      value = rightValue.hasInstance(leftValue, state.scope.perms);
      break;
    default:
      throw SyntaxError('Unknown binary operator: ' + node['operator']);
  }
  stack.pop();
  stack[stack.length - 1].value = value;
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['BlockStatement'] = function (stack, state, node) {
  var n = state.n_;
  var /** ?Interpreter.Node */ statement = node['body'][n];
  if (statement) {
    state.n_ = n + 1;
    return new Interpreter.State(statement, state.scope);
  }
  stack.pop();
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['BreakStatement'] = function (stack, state, node) {
  // TODO(cpcallen): thread should be a param, or something.
  var thread = this.thread;
  if (!thread) throw Error('No thread in BreakStatement??');
  this.unwind_(thread, Interpreter.CompletionType.BREAK, undefined,
      node['label'] ? node['label']['name'] : undefined
  );
};

/**
 * ConditionalExpression AND IfStatement
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['CallExpression'] = function (stack, state, node) {
  /* NOTE 1: If you edit any of the step_ values in this function, be
   * sure to also update the following functions to match!:
   *
   *  - Interpreter.State.prototype.includeInStack
   *  - Interpreter.State.newForCall
   *
   * NOTE 2: Beware that, because
   *
   *  - an async function might not *actually* be async, and thus
   *  - its .call function might call its reject before returning, and
   *  - reject will unwind the stack, and
   *  - Interpreter#step and Interpreter#run will push any State
   *    returned by a step function such as this one,
   *
   * this CallExpression step function MUST NOT return a State after
   * calling .call (or .construct), or the thread might end up in some
   * nonsensical, corrupt configuration.
   *
   * (It's fine for CallExpresssion to return a State the *next* time
   * it's invoked, though there is no obvious reason to do so.)
   */
  if (state.step_ === 0) {  // Evaluate callee.
    state.step_ = 1;
    // Get refernce for calee, because we need to get value of 'this'.
    return new Interpreter.State(node['callee'], state.scope, true);
  }
  if (state.step_ === 1) {  // Evaluated callee, possibly got a reference.
    // Determine value of the function.
    state.step_ = 2;
    var info = {callee: undefined,
                this: undefined,  // Since we have no global object.
                directEval: false,
                arguments: []};
    if (state.ref) {  // Callee was MemberExpression or Identifier.
      info.callee = this.getValue(state.scope, state.ref, state.scope.perms);
      if (state.ref[0] === Interpreter.SCOPE_REFERENCE) {
        // (Globally or locally) named function - maybe named 'eval'?
        info.directEval = (state.ref[1] === 'eval');
      } else {
        // Method call; save 'this' value.
        info.this =  state.ref[0];
      }
    } else {  // Callee already fully evaluated.
      info.callee = state.value;
    }
    state.info_ = info;
    state.n_ = 0;
  }
  if (state.step_ === 2) {  // Evaluating arguments.
    if (state.n_ !== 0) {
      state.info_.arguments.push(state.value);
    }
    if (node['arguments'][state.n_]) {
      return new Interpreter.State(node['arguments'][state.n_++], state.scope);
    }
    // All args evaluated.  Check for new hack.
    if (node['type'] === 'NewExpression') {
      var callee = state.info_.callee;
      if (typeof callee === 'string' && state.info_.arguments.length === 0) {
        // Special hack for Code City's "new 'foo'" syntax.
        if (!this.builtins_[callee]) {
          throw new this.Error(state.scope.perms, this.REFERENCE_ERROR,
              callee + ' is not a builtin');
        }
        stack.pop();
        stack[stack.length - 1].value = this.builtins_[callee];
        return;
      }
    }
    state.step_ = 3;  // N.B: SEE NOTE 1 ABOVE!
  }
  if (state.step_ === 3) {  // Done valuating arguments; do function call.
    state.step_ = 4;  // N.B: SEE NOTE 1 ABOVE!
    var func = state.info_.callee;
    if (!(func instanceof this.Function)) {
      throw new this.Error(state.scope.perms, this.TYPE_ERROR,
          func + ' is not a function');
    }
    // TODO(cpcallen): this is here just to satisfy type checking of
    // args to .call and .construct.  Perhaps have (non-null) thread
    // arg to step functions?
    if (this.thread === null) {
      throw TypeError('No current thread??');
    }
    var args = state.info_.arguments;
    var r =
        state.node['type'] === 'NewExpression' ?
        func.construct(this, this.thread, state, args) :
        func.call(this, this.thread, state, state.info_.this, args);
    if (r instanceof FunctionResult) {
      if (r === FunctionResult.CallAgain) {
        state.step_ = 3;  // N.B: SEE NOTE 1 ABOVE!
      }
      return;  // N.B. SEE NOTE 2 ABOVE!
    }
    state.value = r;
  }
  // state.step_ === 4: Execution done; handle return value.
  stack.pop();
  // Previous stack frame may not exist if this is a setTimeout function.
  if (stack.length > 0) {
    stack[stack.length - 1].value = state.value;
  }
};

/**
 * ConditionalExpression AND IfStatement.  The only difference is the
 * latter does not return a value to the parent state.
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ConditionalExpression'] = function (stack, state, node) {
  if (state.step_ === 0) {  // Evaluate test.
    state.step_ = 1;
    return new Interpreter.State(node['test'], state.scope);
  }
  if (state.step_ === 1) {  // Test evaluated; result is in .value
    state.step_ = 2;
    var value = Boolean(state.value);
    if (value && node['consequent']) {
      // Execute 'if' block.
      return new Interpreter.State(node['consequent'], state.scope);
    }
    if (!value && node['alternate']) {
      // Execute 'else' block.
      return new Interpreter.State(node['alternate'], state.scope);
    }
    // eval('1;if(false){2}') -> undefined
    this.value = undefined;
  }
  // state.step_ === 2: Consequent or alternate done.  Do return?
  stack.pop();
  if (node['type'] === 'ConditionalExpression') {
    stack[stack.length - 1].value = state.value;
  }
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ContinueStatement'] = function (stack, state, node) {
  // TODO(cpcallen): thread should be a param, or something.
  var thread = this.thread;
  if (!thread) throw Error('No thread in ContinueStatement??');
  this.unwind_(thread, Interpreter.CompletionType.CONTINUE, undefined,
      node['label'] ? node['label']['name'] : undefined);
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['DebuggerStatement'] = function (stack, state, node) {
  // Do nothing.  May be overridden by developers.
  stack.pop();
};

/**
 * DoWhileStatement AND WhileStatement.  The only difference is the
 * former skips evaluating the test expression the first time through.
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['DoWhileStatement'] = function (stack, state, node) {
  if (state.step_ === 0) {  // Decide whether to skip first test.
    state.step_ = 1;
    if (node['type'] === 'DoWhileStatement') {
      // First iteration of do/while executes without checking test.
      state.value = true;
      state.step_ = 2;
    }
  }
  if (state.step_ === 1) {  // Evaluate condition.
    state.step_ = 2;
    return new Interpreter.State(node['test'], state.scope);
  }
  // state.step_ === 2: Check result of evaluation.
  if (!state.value) {  // Done, exit loop.
    stack.pop();
  } else if (node['body']) {  // Execute the body.
    state.step_ = 1;
    state.isLoop = true;
    return new Interpreter.State(node['body'], state.scope);
  }
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['EmptyStatement'] = function (stack, state, node) {
  stack.pop();
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['EvalProgram_'] = function (stack, state, node) {
  var n = state.n_;
  var /** ?Interpreter.Node */ expression = node['body'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
  stack[stack.length - 1].value = this.value;
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ExpressionStatement'] = function (stack, state, node) {
  if (state.step_ === 0) {  // Evaluate expression.
    state.step_ = 1;
    return new Interpreter.State(node['expression'], state.scope);
  }
  // state.step_ === 1: Handle completion value.
  stack.pop();
  // Save this value to interpreter.value for use as a return value if
  // this code is inside an eval function.
  //
  // TODO(cpcallen): This is suspected to not be strictly correct
  // compared to how the ES5.1 spec defines completion values.  Add
  // tests to prove it one way or the other.
  this.value = state.value;
};

/**
 * Extra info used by ForInStatement step function.
 * @typedef {{iter: !Interpreter.PropertyIterator,
              key: string}}
 */
Interpreter.ForInInfo;

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ForInStatement'] = function (stack, state, node) {
  while (true) {
    switch (state.step_) {
      case 0:  // Initial set-up.
        // First, variable initialization is illegal in strict mode.
        if (node['left']['declarations'] &&
            node['left']['declarations'][0]['init']) {
          throw new this.Error(state.scope.perms, this.SYNTAX_ERROR,
              'for-in loop variable declaration may not have an initializer.');
        }
        state.step_ = 1;
        state.isLoop = true;  // TODO(cpcallen): remove or declare.
        // Second, look up the object.  Only do so once, ever.
        return new Interpreter.State(node['right'], state.scope);
      case 1:  // Check right, create PropertyIterator.
        if (state.value === null || state.value === undefined) {
          // No iterations to do; exit loop.
          stack.pop();
          return;
        }
        var obj = this.toObject(state.value, state.scope.perms);
        var iter = new Interpreter.PropertyIterator(obj, state.scope.perms);
        state.info_ = {iter: iter, key: ''};
        // FALL THROUGH
      case 2:  // Find the property name for this iteration; do node.left.
        var key = state.info_.iter.next();
        if (key === undefined) {
          // Done; exit loop.
          stack.pop();
          return;
        }
        state.info_.key = key;
        // Get (or create) a Reference to node.left:
        var /** ?Interpreter.Node */ left = node['left'];
        if (left['type'] !== 'VariableDeclaration') {
          state.step_ = 3;
          // Arbitrary left side, e.g.: for (foo().bar in y).
          // Get Reference to whatever left side turns out to be.
          return new Interpreter.State(left, state.scope, true);
        }
        // Inline variable declaration: for (var x in y)
        state.ref = [Interpreter.SCOPE_REFERENCE,
                     left['declarations'][0]['id']['name']];
        // FALL THROUGH
      case 3:  // Got .ref to variable to set.  Set it next key.
        if (!state.ref) throw TypeError('loop variable not an LVALUE??');
        this.setValue(state.scope, state.ref, state.info_.key,
                      state.scope.perms);
        // Execute the body if there is one, followed by next iteration.
        state.step_ = 2;
        if (node['body']) {
          return new Interpreter.State(node['body'], state.scope);
        }
    }
  }
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ForStatement'] = function (stack, state, node) {
  // If we've just evaluated node.test, and result was false, terminate loop.
  if (state.step_ === 2 && !state.value) {
    stack.pop();
    return;
  }
  while (true) {
    switch (state.step_) {
      case 0:  // Eval init expression.
        state.step_ = 1;
        state.isLoop = true;  // TODO(cpcallen): remove or declare.
        if (node['init']) {
          return new Interpreter.State(node['init'], state.scope);
        }
        // FALL THROUGH
      case 1:  // Eval test expression.
        state.step_ = 2;
        if (node['test']) {
          return new Interpreter.State(node['test'], state.scope);
        }
        // FALL THROUGH
      case 2:  // Eval body.
        state.step_ = 3;
        return new Interpreter.State(node['body'], state.scope);
      case 3:  // Eval update expression.
        state.step_ = 1;
        if (node['update']) {
          return new Interpreter.State(node['update'], state.scope);
        }
    }
  }
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['FunctionDeclaration'] = function (stack, state, node) {
  // This was found and handled when the scope was populated.
  stack.pop();
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['FunctionExpression'] = function (stack, state, node) {
  stack.pop();
  var src = this.thread.getSource();
  if (src === undefined) {
    throw Error("No source found when evaluating function expression??");
  }
  stack[stack.length - 1].value =
      new this.UserFunction(node, state.scope, src, state.scope.perms);
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['Identifier'] = function (stack, state, node) {
  stack.pop();
  var /** string */ name = node['name'];
  if (state.wantRef_) {
    stack[stack.length - 1].ref = [Interpreter.SCOPE_REFERENCE, name];
  } else {
    stack[stack.length - 1].value =  this.getValueFromScope(state.scope, name);
  }
};

stepFuncs_['IfStatement'] = stepFuncs_['ConditionalExpression'];

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['LabeledStatement'] = function (stack, state, node) {
  // Note that a statement might have multiple labels.
  var /** !Array<string> */ labels = state.labels || [];
  labels.push(node['label']['name']);
  var nextState = new Interpreter.State(node['body'], state.scope);
  nextState.labels = labels;
  // No need to hit LabelStatement node again on the way back up the stack.
  stack.pop();
  return nextState;
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['Literal'] = function (stack, state, node) {
  var /** (null|boolean|number|string|!RegExp) */ literal = node['value'];
  var /** Interpreter.Value */ value;
  if (literal instanceof RegExp) {
    value = new this.RegExp(state.scope.perms);
    value.populate(literal);
  } else {
    value = literal;
  }
  stack.pop();
  stack[stack.length - 1].value = value;
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['LogicalExpression'] = function (stack, state, node) {
  if (state.step_ === 0) {  // Eval left.
    state.step_ = 1;
    return new Interpreter.State(node['left'], state.scope);
  }
  if (state.step_ == 1) {  // Check for short-circuit; eval right.
    var /** string */ op = node['operator'];
    if (op !== '&&' && op !== '||') {
      throw SyntaxError("Unknown logical operator '" + op + "'");
    } else if ((op === '&&' && state.value) || (op === '||' && !state.value)) {
      // No short-circuit this time.
      state.step_ = 2;
      return new Interpreter.State(node['right'], state.scope);
    }
  }
  // state.step_ === 2: Return most recently evaluated subexpression.
  stack.pop();
  stack[stack.length - 1].value = state.value;
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['MemberExpression'] = function (stack, state, node) {
  if (state.step_ === 0) {  // Evaluate LHS (object).
    state.step_ = 1;
    return new Interpreter.State(node['object'], state.scope);
  } else if (state.step_ === 1) {  // Evaluate RHS (property key) if necessary.
    state.tmp_ = state.value;
    if (node['computed']) {  // obj[foo] -- Compute value of 'foo'.
      state.step_ = 2;
      return new Interpreter.State(node['property'], state.scope);
    }
    var /** string */ key = node['property']['name'];
  } else {  // state.step_ === 2: Save computed property key.
    key = String(state.value);
  }
  stack.pop();
  if (state.wantRef_) {
    stack[stack.length - 1].ref = [state.tmp_, key];
  } else {
    var perms = state.scope.perms;
    stack[stack.length - 1].value =
        this.toObject(state.tmp_, perms).get(key, perms);
  }
};

stepFuncs_['NewExpression'] = stepFuncs_['CallExpression'];

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ObjectExpression'] = function (stack, state, node) {
  var n = state.n_;
  if (!state.tmp_) {  // First execution.  Create object.
    state.tmp_ = new this.Object(state.scope.perms);
  } else {  // Save just-evaluated property value in object.
    // Determine property name.
    var /** ?Interpreter.Node */ keyNode = node['properties'][n]['key'];
    if (keyNode['type'] === 'Identifier') {
      var /** string */ key = keyNode['name'];
    } else if (keyNode['type'] === 'Literal') {
      key = keyNode['value'];
    } else {
      throw SyntaxError('Unknown object structure: ' + keyNode['type']);
    }
    // Set the property computed in the previous execution.
    state.tmp_.set(key, state.value, state.scope.perms);
    state.n_ = ++n;
  }
  var /** ?Interpreter.Node */ property = node['properties'][n];
  if (property) {
    if (property['kind'] !== 'init') {
      throw new this.Error(state.scope.perms, this.SYNTAX_ERROR,
          'Only plain properties are supported - not getters or setters');
    }
    return new Interpreter.State(property['value'], state.scope);
  }
  stack.pop();
  stack[stack.length - 1].value = state.tmp_;
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['Program'] = function (stack, state, node) {
  var n = state.n_;
  var /** ?Interpreter.Node */ expression = node['body'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ReturnStatement'] = function (stack, state, node) {
  if (node['argument'] && !state.done_) {
    state.done_ = true;
    return new Interpreter.State(node['argument'], state.scope);
  }
  // TODO(cpcallen): thread should be a param, or something.
  var thread = this.thread;
  if (!thread) throw Error('No thread in ReturnStatement??');
  this.unwind_(
      thread, Interpreter.CompletionType.RETURN, state.value, undefined);
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['SequenceExpression'] = function (stack, state, node) {
  var n = state.n_;
  var /** ?Interpreter.Node */ expression = node['expressions'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
  stack[stack.length - 1].value = state.value;
};

/**
 * Extra info used by SwitchStatement step function.
 * @typedef {{default: number}}
 */
Interpreter.SwitchInfo;

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['SwitchStatement'] = function (stack, state, node) {
  // First check return value to see if case test succeeded.
  if (state.step_ === 2 && state.value === state.tmp_) {
    state.step_ = 3;
  }
  switch (state.step_) {
    case 0:  // Start by evaluating discriminant.
      state.step_ = 1;
      return new Interpreter.State(node['discriminant'], state.scope);
    case 1:  // Got evaluated discriminant.  Save it.
      state.tmp_ = state.value;
      state.isSwitch = true;
      state.info_ = {default: -1};
      state.n_ = -1;
      state.step_ = 2;
      // FALL THROUGH
    case 2:  // Find case with non-empty test and evaluate test expression.
      var /** Array<!Interpreter.Node> */ cases = node['cases'];
      var /** number */ len = cases.length;
      var n = state.n_ + 1;
      if (n < len && !cases[n]['test']) {  // Found default case. Record & skip.
        state.info_.default = n++;
      }
      if (n < len) {  // Found non-empty test expression.  Evaluate.
        state.n_ = n;
        return new Interpreter.State(cases[n]['test'], state.scope);
      }
      // Ran out of cases to test.
      if (state.info_.default === -1) {  // And there's no default.  Terminate.
        stack.pop();
        return;
      }
      // Use default case.
      state.n_ = state.info_.default;
      // FALL THROUGH
    case 3:  // Found correct case.  Prep for executing consequents.
      state.tmp_ = 0;  // Begin with the 0th consequent of current case.
      state.step_ = 4;
      // FALL THROUGH
    case 4:  // Execute case[n_].consequent[tmp_] (or next available).
      cases = node['cases'];
      len = cases.length;
      for (n = state.n_; n < len; n++) {
        var /** ?Interpreter.Node */ conseq = cases[n]['consequent'];
        if (conseq && conseq[state.tmp_]) {
          state.n_ = n;
          return new Interpreter.State(conseq[state.tmp_++], state.scope);
        }
        state.tmp_ = 0;  // Done this case; fall through 0th statement of next.
      }
      stack.pop();  // All done.
  }
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ThisExpression'] = function (stack, state, node) {
  stack.pop();
  stack[stack.length - 1].value = this.getValueFromScope(state.scope, 'this');
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ThrowStatement'] = function (stack, state, node) {
  if (state.step_ === 0) {  // Evaluate value to throw.
    state.step_ = 1;
    return new Interpreter.State(node['argument'], state.scope);
  }
  throw state.value;
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['TryStatement'] = function (stack, state, node) {
  switch (state.step_) {
    case 0:  // Evaluate 'try' block.
      state.step_ = 1;
      return new Interpreter.State(node['block'], state.scope);
    case 1:  // Back from 'try' block.  Run catch?
      state.step_ = 2;
      var /** ?Interpreter.Node */ handler = node['handler'];
      var cv = /** ?Interpreter.Completion */ (state.info_);
      if (handler && cv && cv.type === Interpreter.CompletionType.THROW) {
        state.info_ = null;  // This error is being handled, don't rethrow.
        // Execute catch clause with varible bound to exception value.
        var scope = new Interpreter.Scope(state.scope.perms, state.scope);
        this.addVariableToScope(scope, handler['param']['name'], cv.value);
        return new Interpreter.State(handler['body'], scope);
      }
      // FALL THROUGH
    case 2:  // Done 'try' and 'catch'.  Do 'finally'?
      if (node['finalizer']) {
        state.step_ = 3;
        return new Interpreter.State(node['finalizer'], state.scope);
      }
      // FALL TRHOUGH
    case 3:
      // Regardless of whether we are exiting normally or about to
      // resume unwinding the stack, we are done with this
      // TryStatement and do not want to examine it again.
      stack.pop();
      if (state.info_) {
        // There was no catch handler, or the catch/finally threw an
        // error.  Resume unwinding the stack in search of
        // TryStatement / CallExpression / target of break or continue.
        // TODO(cpcallen): thread should be a param, or something.
        var thread = this.thread;
        if (!thread) throw Error('No thread in TryStatement??');
        this.unwind_(
            thread, state.info_.type, state.info_.value, state.info_.label);
      }
  }
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['UnaryExpression'] = function (stack, state, node) {
  if (state.step_ === 0) {  // Evaluate (or get reference) to argument.
    state.step_ = 1;
    // Get argument - need Reference if operator is 'delete':
    return new Interpreter.State(
        node['argument'], state.scope, node['operator'] === 'delete');
  }
  var value = state.value;
  if (node['operator'] === '-') {
    value = -value;
  } else if (node['operator'] === '+') {
    value = +value;
  } else if (node['operator'] === '!') {
    value = !value;
  } else if (node['operator'] === '~') {
    value = ~value;
  } else if (node['operator'] === 'delete') {
    if (state.ref) {
      if (state.ref[0] instanceof Interpreter.Sentinel) {
        // Whoops; this should have been caught by Acorn (because strict).
        throw Error('Uncaught illegal deletion of unqualified identifier');
      }
      var obj = this.toObject(state.ref[0], state.scope.perms);
      value = obj.deleteProperty(state.ref[1], state.scope.perms);
    } else {
      // Attempted to deleted some expression that wasn't a reference
      // to a variable or property.  Skip delete; return true.
      value = true;
    }
  } else if (node['operator'] === 'typeof') {
    value = (value instanceof this.Function) ? 'function' : typeof value;
  } else if (node['operator'] === 'void') {
    value = undefined;
  } else {
    throw SyntaxError('Unknown unary operator: ' + node['operator']);
  }
  stack.pop();
  stack[stack.length - 1].value = value;
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['UpdateExpression'] = function (stack, state, node) {
  if (state.step_ === 0) {  // Get Reference to argument.
    state.step_ = 1;
    return new Interpreter.State(node['argument'], state.scope, true);
  }
  if (!state.ref) throw TypeError('argument not an LVALUE??');
  var value = Number(this.getValue(state.scope, state.ref, state.scope.perms));
  var prefix = Boolean(node['prefix']);
  var /** Interpreter.Value */ rval;
  if (node['operator'] === '++') {
    rval = (prefix ? ++value : value++);
  } else if (node['operator'] === '--') {
    rval = (prefix ? --value : value--);
  } else {
    throw SyntaxError('Unknown update expression: ' + node['operator']);
  }
  this.setValue(state.scope, state.ref, value, state.scope.perms);
  stack.pop();
  stack[stack.length - 1].value = rval;
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['VariableDeclaration'] = function (stack, state, node) {
  var declarations = node['declarations'];
  var n = state.n_;
  var decl = declarations[n];
  if (state.step_ === 1) {  // Initialise variable with evaluated init value.
    // Note that this is setting the value, not defining the variable.
    // Variable definition (addVariableToScope) is done when scope is populated.
    this.setValueToScope(state.scope, decl['id']['name'], state.value);
    decl = declarations[++n];
  }
  while (decl) {
    // Skip any declarations that are not initialized.  They have already
    // been defined as undefined in populateScope_.
    if (decl['init']) {
      state.n_ = n;
      state.step_ = 1;
      return new Interpreter.State(decl['init'], state.scope);
    }
    decl = declarations[++n];
  }
  stack.pop();
};

/**
 * @this {!Interpreter}
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Interpreter.Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['WithStatement'] = function (stack, state, node) {
  throw new this.Error(state.scope.perms, this.SYNTAX_ERROR,
      'Strict mode code may not include a with statement');
};

stepFuncs_['WhileStatement'] = stepFuncs_['DoWhileStatement'];


module.exports = Interpreter;

///////////////////////////////////////////////////////////////////////////////
// AST Node
///////////////////////////////////////////////////////////////////////////////
// This is mainly to assist the serializer getting access to the Acorn
// AST node constructor, but we also use it to create a fake AST nodes
// for 'eval', and may in future use it for Closure Compiler type
// checking.

var acornNode = acorn.parse('', Interpreter.PARSE_OPTIONS).constructor;
/** @constructor */ Interpreter.Node =
    acornNode.bind(acorn, {options: Interpreter.PARSE_OPTIONS});
Interpreter.Node.prototype = acornNode.prototype;
