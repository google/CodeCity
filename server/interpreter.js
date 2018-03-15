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
   * Map node types to our step function names; a property lookup is
   * faster than string concatenation with "step" prefix.  Note that a
   * Map is much slower than a null-parent object (v8 in 2017).
   * @private @const {Object<function(!Array<!Interpreter.State>,
   *                                  !Interpreter.State,
   *                                  !Interpreter.Node)
   *                             : ?Interpreter.State>}
   */
  this.stepFunctions_ = Object.create(null);
  var stepMatch = /^step([A-Z]\w*)$/;
  var m;
  for (var methodName in this) {
    if ((typeof this[methodName] === 'function') &&
        (m = methodName.match(stepMatch))) {
      this.stepFunctions_[m[1]] = this[methodName].bind(this);
    }
  }
  /**
   * For cycle detection in array to string and error conversion; see
   * spec bug github.com/tc39/ecma262/issues/289. At the moment this
   * is used only for actions which are atomic (i.e., take place
   * entirely within the duration of a single call to .step), so it
   * could be a global or class property, but better to have it be
   * per-instance so that we can eventually call user toString
   * methods.
   * TODO(cpcallen): Make this per-thread when threads are introduced.
   * @private @const { !Array<!Interpreter.prototype.Object> }
   */
  this.toStringCycles_ = [];

  /**
   * The interpreter's global scope.
   * TODO(cpcallen:perms): this should be owned by System / root / whatever.
   * @const
   */
  this.global = new Interpreter.Scope;
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

  /** @private @const { !Object<number,!Interpreter.prototype.Server> } */
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
  plugins: { alwaysStrict: true }
};

/**
 * Property descriptor of readonly properties.
 */
Interpreter.READONLY_DESCRIPTOR = {
  configurable: true,
  enumerable: true,
  writable: false
};

/**
 * Property descriptor of non-enumerable properties.
 */
Interpreter.NONENUMERABLE_DESCRIPTOR = {
  configurable: true,
  enumerable: false,
  writable: true
};

/**
 * Property descriptor of non-enumerable, non-configurable properties.
 */
Interpreter.NONENUMERABLE_NONCONFIGURABLE_DESCRIPTOR = {
  configurable: false,
  enumerable: false,
  writable: true
};

/**
 * Property descriptor of readonly, non-enumerable properties.
 */
Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR = {
  configurable: true,
  enumerable: false,
  writable: false
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
 * Unique sentinel for indicating that a step has encountered an error, has
 * added it to the stack, and will be thrown within the user's program.
 * When STEP_ERROR is thrown by the interpreter the error can be ignored.
 */
Interpreter.STEP_ERROR = new Interpreter.Sentinel();

/**
 * Unique sentinel for indicating that a reference is a variable on the scope,
 * not an object property.
 */
Interpreter.SCOPE_REFERENCE = new Interpreter.Sentinel();

/**
 * Unique sentinel for indicating, when used as the value of the value
 * parameter in calls to setProperty and friends, that the value
 * should be taken from the property descriptor instead.
 */
Interpreter.VALUE_IN_DESCRIPTOR = new Interpreter.Sentinel();

/**
 * Parse a code string into an AST.
 * @param {string} str
 */
Interpreter.prototype.parse = function(str) {
  try {
    return acorn.parse(str, Interpreter.PARSE_OPTIONS);
  } catch (e) {
    // Acorn threw a SyntaxError.  Rethrow as a trappable error.
    this.throwError(this.SYNTAX_ERROR, 'Invalid code: ' + e.message);
  }
};

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
 *     (defaults to now).
 * @return {number} thread ID.
 */
Interpreter.prototype.createThread = function(runnable, runAt) {
  var source = '';
  if (typeof runnable === 'string') {
    source = runnable;
    // Acorn may throw a Syntax error.
    runnable = acorn.parse(runnable, Interpreter.PARSE_OPTIONS);
    runnable['source'] = source;
  }
  if (runnable instanceof Interpreter.Node) {
    if (runnable['type'] !== 'Program') {
      throw Error('Expecting AST to start with a Program node.');
    }
    this.populateScope_(runnable, this.global, source);
    runnable = new Interpreter.State(runnable, this.global);
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
 * @param {Interpreter.Value} funcThis value of 'this' in function call.
 * @param {!Array<Interpreter.Value>} args Arguments to pass.
 * @param {number=} runAt Time at which thread should begin execution
 *     (defaults to now).
 * @return {number} thread ID.
 */
Interpreter.prototype.createThreadForFuncCall =
    function(func, funcThis, args, runAt) {
  if (!(func instanceof this.Function)) {
    this.throwError(this.TYPE_ERROR, func + ' is not a function');
  }
  var node = new Interpreter.Node;
  node['type'] = 'CallExpression';
  var state = new Interpreter.State(node, this.global);
  state.func_ = func;
  state.funcThis_ = funcThis;
  state.doneCallee_ = 2;
  state.arguments_ = args;
  state.doneArgs_ = true;
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
    var nextState = this.stepFunctions_[node['type']](stack, state, node);
  } catch (e) {
    // Eat any step errors.  They have been thrown on the stack.
    if (e !== Interpreter.STEP_ERROR) {
      // Uh oh.  This is a real error in the interpreter.  Rethrow.
      throw e;
    }
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
        var nextState = this.stepFunctions_[node['type']](stack, state, node);
      } catch (e) {
        nextState = undefined;
        // Eat any step errors.  They have been thrown on the stack.
        if (e !== Interpreter.STEP_ERROR) {
          // Uh oh.  This is a real error in the interpreter.  Rethrow.
          throw e;
        }
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
          var func = intrp.getProperty(server.proto, 'onError');
          var userError = intrp.nativeToPseudo(error);
          if (func instanceof intrp.Function) {
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
  this.OBJECT = new this.Object(null);
  this.builtins_['Object.prototype'] = this.OBJECT;
  // createNativeFunction adds the argument to the map of builtins.
  this.FUNCTION =
      this.createNativeFunction('Function.prototype', function() {}, false);
  this.FUNCTION.proto = this.OBJECT;

  // Create the object that will own all of the system objects.
  this.ROOT = new this.Object(this.OBJECT);
  this.builtins_['CC.root'] = this.ROOT;
  this.global.perms = this.ROOT;
  // TODO(cpcallen:perms): make stuff owned by ROOT (including itself)
  
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
  this.initPerms_();

  // Initialize ES standard global functions.
  var intrp = this;

  // eval is a special case; it must be added to the global scope at
  // startup time (rather than by a "var eval = new 'eval';" statement
  // in es5.js) because binding eval is illegal in strict mode.
  var func = this.createNativeFunction('eval',
      function(x) {throw EvalError("Can't happen");}, false);
  func.eval = true;  // Recognized specially by stepCallExpresion.
  this.addVariableToScope(this.global, 'eval', func);

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
          intrp.throwError(intrp.URI_ERROR, e.message);
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
  var intrp = this;
  var wrapper;
  // Object constructor.
  wrapper = function(value) {
    if (value === undefined || value === null) {
      // Create a new object.
      if (intrp.calledWithNew()) {
        // Called as new Object().
        return this;
      } else {
        // Called as Object().
        return new intrp.Object;
      }
    }
    if (!(value instanceof intrp.Object)) {
      // No boxed primitives in Code City.
      intrp.throwError(intrp.TYPE_ERROR, 'Boxing of primitives not supported.');
    }
    // Return the provided object.
    return value;
  };
  this.createNativeFunction('Object', wrapper, true);

  /**
   * Checks if the provided value is null or undefined.
   * If so, then throw an error in the call stack.
   * @param {Interpreter.Value} value Value to check.
   */
  var throwIfNullUndefined = function(value) {
    if (value === undefined || value === null) {
      intrp.throwError(intrp.TYPE_ERROR,
          "Cannot convert '" + value + "' to object");
    }
  };

  // Static methods on Object.
  this.createNativeFunction('Object.is', Object.is, false);

  wrapper = function(obj) {
    throwIfNullUndefined(obj);
    var props = (obj instanceof intrp.Object) ? obj.properties : obj;
    return intrp.arrayNativeToPseudo(Object.getOwnPropertyNames(props));
  };
  this.createNativeFunction('Object.getOwnPropertyNames', wrapper, false);

  wrapper = function(obj) {
    throwIfNullUndefined(obj);
    if (obj instanceof intrp.Object) {
      return intrp.arrayNativeToPseudo(Object.keys(obj.properties));
    } else {
      return intrp.arrayNativeToPseudo(Object.keys(obj));
    }
  };
  this.createNativeFunction('Object.keys', wrapper, false);

  wrapper = function(proto) {
    // Support for the second argument is the responsibility of a polyfill.
    if (proto === null) {
      return new intrp.Object(null);
    }
    if (!(proto === null || proto instanceof intrp.Object)) {
      intrp.throwError(intrp.TYPE_ERROR,
          'Object prototype may only be an Object or null');
    }
    return new intrp.Object(proto);
  };
  this.createNativeFunction('Object.create', wrapper, false);

  wrapper = function(obj, prop, descriptor) {
    prop = String(prop);
    if (!(obj instanceof intrp.Object)) {
      intrp.throwError(intrp.TYPE_ERROR,
          'Object.defineProperty called on non-object');
    }
    if (!(descriptor instanceof intrp.Object)) {
      intrp.throwError(intrp.TYPE_ERROR,
          'Property description must be an object');
    }
    if (!obj.properties[prop] && obj.preventExtensions) {
      intrp.throwError(intrp.TYPE_ERROR,
          "Can't define property '" + prop + "', object is not extensible");
    }
    // Can't just use pseudoToNative since descriptors can inherit properties.
    var nativeDescriptor = {};
    if (intrp.hasProperty(descriptor, 'configurable')) {
      nativeDescriptor.configurable =
          !!intrp.getProperty(descriptor, 'configurable');
    }
    if (intrp.hasProperty(descriptor, 'enumerable')) {
      nativeDescriptor.enumerable =
          !!intrp.getProperty(descriptor, 'enumerable');
    }
    if (intrp.hasProperty(descriptor, 'writable')) {
      nativeDescriptor.writable = !!intrp.getProperty(descriptor, 'writable');
    }
    if (intrp.hasProperty(descriptor, 'value')) {
      nativeDescriptor.value = intrp.getProperty(descriptor, 'value');
    }
    intrp.setProperty(obj, prop, Interpreter.VALUE_IN_DESCRIPTOR,
                      nativeDescriptor);
    return obj;
  };
  this.createNativeFunction('Object.defineProperty', wrapper, false);

  wrapper = function(obj, prop) {
    if (!(obj instanceof intrp.Object)) {
      intrp.throwError(intrp.TYPE_ERROR,
          'Object.getOwnPropertyDescriptor called on non-object');
    }
    prop = String(prop);
    var pd = Object.getOwnPropertyDescriptor(obj.properties, prop);
    if (!pd) {
      return undefined;
    }
    var descriptor = new intrp.Object;
    intrp.setProperty(descriptor, 'configurable', pd.configurable);
    intrp.setProperty(descriptor, 'enumerable', pd.enumerable);
    intrp.setProperty(descriptor, 'writable', pd.writable);
    intrp.setProperty(descriptor, 'value', intrp.getProperty(obj, prop));
    return descriptor;
  };
  this.createNativeFunction('Object.getOwnPropertyDescriptor', wrapper, false);

  wrapper = function(obj) {
    throwIfNullUndefined(obj);
    // TODO(cpcallen): behaviour of our getPrototype is wrong for
    // getPrototypeOf according to ES5.1 (but correct for ES6).
    return intrp.getPrototype(obj);
  };
  this.createNativeFunction('Object.getPrototypeOf', wrapper, false);

  wrapper = function(obj, proto) {
    throwIfNullUndefined(obj);
    if (proto !== null && !(proto instanceof intrp.Object)) {
      intrp.throwError(intrp.TYPE_ERROR,
          'Object prototype may only be an Object or null');
    }
    if (!(obj instanceof intrp.Object)) {
      return obj;
    }
    // TODO(cpcallen): actually implement prototype change.
    return obj;
  };
  this.createNativeFunction('Object.setPrototypeOf', wrapper, false);

  wrapper = function(obj) {
    return Boolean(obj) && !obj.preventExtensions;
  };
  this.createNativeFunction('Object.isExtensible', wrapper, false);

  wrapper = function(obj) {
    if (obj instanceof intrp.Object) {
      obj.preventExtensions = true;
    }
    return obj;
  };
  this.createNativeFunction('Object.preventExtensions', wrapper, false);

  // Instance methods on Object.
  this.createNativeFunction('Object.prototype.toString',
                            this.Object.prototype.toString, false);
  this.createNativeFunction('Object.prototype.toLocaleString',
                            this.Object.prototype.toLocaleString, false);
  this.createNativeFunction('Object.prototype.valueOf',
                            this.Object.prototype.valueOf, false);

  wrapper = function(prop) {
    throwIfNullUndefined(this);
    if (!(this instanceof intrp.Object)) {
      return this.hasOwnProperty(prop);
    }
    return String(prop) in this.properties;
  };
  this.createNativeFunction('Object.prototype.hasOwnProperty', wrapper, false);

  wrapper = function(prop) {
    throwIfNullUndefined(this);
    return String(prop) in this.properties && !this.notEnumerable.has(prop);
  };
  this.createNativeFunction('Object.prototype.propertyIsEnumerable', wrapper,
                            false);

  wrapper = function(obj) {
    while (true) {
      // Note, circular loops shouldn't be possible.
      // BUG(cpcallen): behaviour of getPrototype is wrong for
      // isPrototypeOf, according to either ES5.1 or ES6.
      obj = intrp.getPrototype(obj);
      if (!obj) {
        // No parent; reached the top.
        return false;
      }
      if (obj === this) {
        return true;
      }
    }
  };
  this.createNativeFunction('Object.prototype.isPrototypeOf', wrapper, false);
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
  wrapper = function(var_args) {
    if (arguments.length) {
      var code = String(arguments[arguments.length - 1]);
    } else {
      var code = '';
    }
    var argsStr = Array.prototype.slice.call(arguments, 0, -1).join(',').trim();
    if (argsStr) {
      var args = argsStr.split(/\s*,\s*/);
      for (var i = 0; i < args.length; i++) {
        var name = args[i];
        if (!identifierRegexp.test(name)) {
          intrp.throwError(intrp.SYNTAX_ERROR,
              'Invalid function argument: ' + name);
        }
      }
      argsStr = args.join(', ');
    }
    // Acorn needs to parse code in the context of a function or else 'return'
    // statements will be syntax errors.
    var code = '(function(' + argsStr + ') {' + code + '})';
    var ast = intrp.parse(code);
    if (ast['body'].length !== 1) {
      // Function('a', 'return a + 6;}; {alert(1);');
      intrp.throwError(intrp.SYNTAX_ERROR, 'Invalid code in function body.');
    }
    // Interestingly, the scope for constructed functions is the global scope,
    // even if they were constructed in some other scope.
    return intrp.createFunctionFromAST(
        ast['body'][0]['expression'], intrp.global, code);
  };
  this.createNativeFunction('Function', wrapper, true);

  this.createNativeFunction('Function.prototype.toString',
                            this.Function.prototype.toString, false);

  wrapper = function(thisArg, args) {
    var state = intrp.thread.stateStack_[intrp.thread.stateStack_.length - 1];
    // Rewrite the current 'CallExpression' to apply a different function.
    state.func_ = this;
    // Assign the 'this' object.
    state.funcThis_ = thisArg;
    // Bind any provided arguments.
    state.arguments_ = [];
    if (args !== null && args !== undefined) {
      if (!(args instanceof intrp.Object)) {
        intrp.throwError(intrp.TYPE_ERROR,
            'CreateListFromArrayLike called on non-object');
      }
      state.arguments_ = intrp.arrayPseudoToNative(args);
    }
    state.doneExec = false;
  };
  this.createNativeFunction('Function.prototype.apply', wrapper, false);

  wrapper = function(thisArg /*, var_args*/) {
    var state =
        intrp.thread.stateStack_[intrp.thread.stateStack_.length - 1];
    // Rewrite the current 'CallExpression' to call a different function.
    state.func_ = this;
    // Assign the 'this' object.
    state.funcThis_ = thisArg;
    // Bind any provided arguments.
    state.arguments_ = [];
    for (var i = 1; i < arguments.length; i++) {
      state.arguments_.push(arguments[i]);
    }
    state.doneExec = false;
  };
  this.createNativeFunction('Function.prototype.call', wrapper, false);
};

/**
 * Initialize the Array class.
 * @private
 */
Interpreter.prototype.initArray_ = function() {
  var intrp = this;
  // Array prototype.
  this.ARRAY = new this.Array(this.OBJECT);
  this.builtins_['Array.prototype'] = this.ARRAY;
  // Array constructor.
  var getInt = function(obj, def) {
    // Return an integer, or the default.
    var n = obj ? Math.floor(obj) : def;
    if (isNaN(n)) {
      n = def;
    }
    return n;
  };
  var wrapper;
  wrapper = function(var_args) {
    var newArray = new intrp.Array;
    var first = arguments[0];
    if (arguments.length === 1 && typeof first === 'number') {
      if (isNaN(Interpreter.legalArrayLength(first))) {
        intrp.throwError(intrp.RANGE_ERROR, 'Invalid array length');
      }
      newArray.properties.length = first;
    } else {
      for (var i = 0; i < arguments.length; i++) {
        newArray.properties[i] = arguments[i];
      }
      newArray.properties.length = i;
    }
    return newArray;
  };
  this.createNativeFunction('Array', wrapper, true);

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
    var removed = new intrp.Array;
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
    var list = new intrp.Array;
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
      var element = intrp.getProperty(this, i);
      intrp.setProperty(list, length++, element);
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
    var list = new intrp.Array;
    var length = 0;
    // Start by copying the current array.
    for (var i = 0; i < this.properties.length; i++) {
      var element = intrp.getProperty(this, i);
      intrp.setProperty(list, length++, element);
    }
    // Loop through all arguments and copy them in.
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (value instanceof intrp.Array) {
        for (var j = 0; j < value.properties.length; j++) {
          var element = intrp.getProperty(value, j);
          intrp.setProperty(list, length++, element);
        }
      } else {
        intrp.setProperty(list, length++, value);
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
  this.STRING = new this.Object;
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
    return intrp.arrayNativeToPseudo(jsList);
  };
  this.createNativeFunction('String.prototype.split', wrapper, false);

  wrapper = function(regexp) {
    if (regexp instanceof intrp.RegExp) {
      regexp = regexp.regexp;
    }
    var m = this.match(regexp);
    return m && intrp.arrayNativeToPseudo(m);
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
      intrp.throwError(intrp.RANGE_ERROR, e.message);
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
  this.BOOLEAN = new this.Object;
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
  this.NUMBER = new this.Object;
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
      intrp.throwError(intrp.RANGE_ERROR, e.message);
    }
  };
  this.createNativeFunction('Number.prototype.toExponential', wrapper, false);

  wrapper = function(digits) {
    try {
      return this.toFixed(digits);
    } catch (e) {
      // Throws if digits isn't within 0-20.
      intrp.throwError(intrp.RANGE_ERROR, e.message);
    }
  };
  this.createNativeFunction('Number.prototype.toFixed', wrapper, false);

  wrapper = function(precision) {
    try {
      return this.toPrecision(precision);
    } catch (e) {
      // Throws if precision isn't within range (depends on implementation).
      intrp.throwError(intrp.RANGE_ERROR, e.message);
    }
  };
  this.createNativeFunction('Number.prototype.toPrecision', wrapper, false);

  wrapper = function(radix) {
    try {
      return this.toString(radix);
    } catch (e) {
      // Throws if radix isn't within 2-36.
      intrp.throwError(intrp.RANGE_ERROR, e.message);
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
  this.DATE = new this.Object;
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
    var date = new intrp.Date;
    date.date = new (Function.prototype.bind.apply(Date, args));
    return date;
  };
  this.createNativeFunction('Date', wrapper, true);

  // Static methods on Date.
  this.createNativeFunction('Date.now', Date.now, false);
  this.createNativeFunction('Date.parse', Date.parse, false);
  this.createNativeFunction('Date.UTC', Date.UTC, false);

  // Instance methods on Date.
  this.createNativeFunction('Date.prototype.toString',
                            this.Date.prototype.toString, false);

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
  this.REGEXP = new this.Object;
  this.builtins_['RegExp.prototype'] = this.REGEXP;
  // RegExp constructor.
  wrapper = function(pattern, flags) {
    var regexp = new intrp.RegExp;
    pattern = pattern ? pattern.toString() : '';
    flags = flags ? flags.toString() : '';
    regexp.populate(new RegExp(pattern, flags));
    return regexp;
  };
  this.createNativeFunction('RegExp', wrapper, true);

  this.createNativeFunction('RegExp.prototype.toString',
                            this.RegExp.prototype.toString, false);

  wrapper = function(str) {
    if (!(this instanceof intrp.RegExp) ||
        !(this.regexp instanceof RegExp)) {
      intrp.throwError(intrp.TYPE_ERROR,
          'Method RegExp.prototype.exec called on incompatible receiver' +
              this.toString());
    }
    return this.regexp.test(str);
  };
  this.createNativeFunction('RegExp.prototype.test', wrapper, false);

  wrapper = function(str) {
    str = str.toString();
    // Get lastIndex from wrapped regex, since this is settable.
    this.regexp.lastIndex =
        Number(intrp.getProperty(this, 'lastIndex'));
    var match = this.regexp.exec(str);
    intrp.setProperty(this, 'lastIndex', this.regexp.lastIndex);

    if (match) {
      var result = new intrp.Array;
      for (var i = 0; i < match.length; i++) {
        intrp.setProperty(result, i, match[i]);
      }
      // match has additional properties.
      intrp.setProperty(result, 'index', match.index);
      intrp.setProperty(result, 'input', match.input);
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
  // Error prototype.
  this.ERROR = new this.Error(this.OBJECT);
  this.builtins_['Error.prototype'] = this.ERROR;
  // Error constructor.
  var wrapper = function(message) {
    var newError = new intrp.Error;
    if (message) {
      intrp.setProperty(newError, 'message', String(message),
          Interpreter.NONENUMERABLE_DESCRIPTOR);
    }
    return newError;
  };
  this.createNativeFunction('Error', wrapper, true);

  this.createNativeFunction('Error.prototype.toString',
                            this.Error.prototype.toString, false);

  var createErrorSubclass = function(name) {
    var prototype = new intrp.Error;
    intrp.builtins_[name + '.prototype'] = prototype;

    wrapper = function(message) {
      var newError = new intrp.Error(prototype);
      if (message) {
        intrp.setProperty(newError, 'message',
            String(message), Interpreter.NONENUMERABLE_DESCRIPTOR);
      }
      return newError;
    };
    intrp.createNativeFunction(name, wrapper, true);

    return prototype;
  };

  this.EVAL_ERROR = createErrorSubclass('EvalError');
  this.RANGE_ERROR = createErrorSubclass('RangeError');
  this.REFERENCE_ERROR = createErrorSubclass('ReferenceError');
  this.SYNTAX_ERROR = createErrorSubclass('SyntaxError');
  this.TYPE_ERROR = createErrorSubclass('TypeError');
  this.URI_ERROR = createErrorSubclass('URIError');
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
      intrp.throwError(intrp.SYNTAX_ERROR, e.message);
    }
    return intrp.nativeToPseudo(nativeObj);
  };
  this.createNativeFunction('JSON.parse', wrapper, false);

  wrapper = function(value) {
    var nativeObj = intrp.pseudoToNative(value);
    try {
      var str = JSON.stringify(nativeObj);
    } catch (e) {
      intrp.throwError(intrp.TYPE_ERROR, e.message);
    }
    return str;
  };
  this.createNativeFunction('JSON.stringify', wrapper, false);
};

/**
 * Initialize the thread system API.
 * @private
 */
Interpreter.prototype.initThreads_ = function() {
  var intrp = this;
  this.createNativeFunction('suspend',
      function(delay) {
        delay = Number(delay) || 0;
        if (delay < 0) {
          delay = 0;
        }
        intrp.thread.sleepUntil(intrp.now() + delay);
      }, false);

  this.createNativeFunction('setTimeout',
      function(func) {
        var delay = Number(arguments[1]) || 0;
        var args = Array.prototype.slice.call(arguments, 2);
        return intrp.createThreadForFuncCall(func, undefined, args,
                                             intrp.now() + delay);
      }, false);

  this.createNativeFunction('clearTimeout',
      function(id) {
        id = Number(id);
        if (intrp.threads[id]) {
          intrp.threads[id].status = Interpreter.Thread.Status.ZOMBIE;
        }
      }, false);
};

/**
 * Initialize the permissions model API.
 * @private
 */
Interpreter.prototype.initPerms_ = function() {
  var intrp = this;
  this.createNativeFunction('perms', function() {
    if (!intrp.thread) {
      throw Error('No current thread??');
    }
    return intrp.thread.perms();
  }, false);

  this.createNativeFunction('setPerms', function(perms) {
    if (!intrp.thread) {
      throw Error('No current thread??');
    }
    if (!(perms instanceof intrp.Object)) {
      intrp.throwError(intrp.TYPE_ERROR, 'New perms must be an object');
    }
    // TODO(cpcallen:perms): throw if current perms does not
    // control new perms.
    return intrp.thread.setPerms(perms);
  }, false);
};

/**
 * Initialize the networking subsystem API.
 * @private
 */
Interpreter.prototype.initNetwork_ = function() {
  var intrp = this;

  this.createAsyncFunction('CC.connectionListen', function(res, rej, port, proto) {
    if (port !== (port >>> 0) || port > 0xffff) {
      rej(new intrp.Error(intrp.RANGE_ERROR, 'invalid port'));
      return;
    } else  if (port in intrp.listeners_) {
      rej(new intrp.Error(intrp.RANGE_ERROR, 'port already listened'));
      return;
    }
    var server = new intrp.Server(port, proto);
    intrp.listeners_[port] = server;
    server.listen(function() {
      res();
    }, function(e) {
      rej(intrp.nativeToPseudo(e));
    });
  });

  this.createAsyncFunction('CC.connectionUnlisten', function(res, rej, port) {
    if (!(port in intrp.listeners_)) {
      rej(new intrp.Error(intrp.RANGE_ERROR, 'port not listening'));
      return;
    }
    if (!(intrp.listeners_[port].server_ instanceof net.Server)) {
      throw Error('server already closed??');
    }
    intrp.listeners_[port].unlisten(function(e) {
      if (e instanceof Error) {
        // Somehow something has gone wrong.  (Maybe mulitple
        // concurrent calls to .close on the same net.Server?)
        rej(intrp.nativeToPseudo(e));
      } else {
        // All socket (and all open connections on it) now closed.
        res();
      }
    });
    delete intrp.listeners_[port];
  });

  this.createNativeFunction('CC.connectionWrite', function(obj, data) {
    if (!(obj instanceof intrp.Object) || !obj.socket) {
      intrp.throwError(intrp.TYPE_ERROR, 'object is not connected');
    }
    obj.socket.write(String(data));
  }, false);

  this.createNativeFunction('CC.connectionClose', function(obj) {
    if (!(obj instanceof intrp.Object) || !obj.socket) {
      intrp.throwError(intrp.TYPE_ERROR, 'object is not connected');
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
 * Create a new function.
 * @param {!Interpreter.Node} node AST node defining the function.
 * @param {!Interpreter.Scope} scope Parent scope.
 * @param {string} source Raw source code.
 * @return {!Interpreter.prototype.Function} New function.
 */
Interpreter.prototype.createFunctionFromAST = function(node, scope, source) {
  var func = new this.Function;
  func.addPrototype();
  func.outerScope = scope;
  func.node = node;
  this.setProperty(func, 'length', func.node['params'].length,
      Interpreter.READONLY_DESCRIPTOR);
  // Record the source on the function object.  This is needed by
  // (pseudo)Function.toString().
  func.source = source.substring(node['start'], node['end']);
  // Record the source on the function node's body node.  This is
  // needed by the (pseudo)Error constructor when generating stack
  // traces (via Thread.prototype.getSource); we store it on the body
  // node (rather than on the function node) because the function node
  // never appears on the stateStack_ when the function is being
  // executed.  We save the full original source (not just the bit
  // containing the function) because the start and end offsets on the
  // AST nodes (that will be used to generate the stack trace) are
  // relative to the start of the whole source string.
  node['body']['source'] = source;
  return func;
};

/**
 * Create a new native function.
 * @param {string} name Name of new function.
 * @param {!Function} nativeFunc JavaScript function.
 * @param {boolean} legalConstructor True if the function can be used as a
 *     constructor (e.g. Array), false if not (e.g. escape).
 * @return {!Interpreter.prototype.Function} New function.
*/
Interpreter.prototype.createNativeFunction =
    function(name, nativeFunc, legalConstructor) {
  var func = new this.Function;
  func.nativeFunc = nativeFunc;
  var surname = name.replace(/^.*\./, '');
  // TODO(cpcallen): should include formal parameter names.
  func.source = 'function ' + surname + '() { [native code] }';
  nativeFunc.id = name;
  this.setProperty(func, 'length', nativeFunc.length,
      Interpreter.READONLY_DESCRIPTOR);
  func.illegalConstructor = !legalConstructor;
  if (this.builtins_[name]) {
    throw ReferenceError('Builtin "' + name + '" already exists.');
  }
  this.builtins_[name] = func;
  return func;
};

/**
 * Create a new native asynchronous function.  Asynchronous native
 * functions are presumed not to be legal constructors.
 * @param {string} name Name of new function.
 * @param {!Function} asyncFunc JavaScript function.
 * @return {!Interpreter.prototype.Function} New function.
 */
Interpreter.prototype.createAsyncFunction = function(name, asyncFunc) {
  var func = new this.Function;
  func.asyncFunc = asyncFunc;
  var surname = name.replace(/^.*\./, '');
  func.source = 'function ' + surname + '() { [native async code] }';
  asyncFunc.id = name;
  this.setProperty(func, 'length', asyncFunc.length,
      Interpreter.READONLY_DESCRIPTOR);
  func.illegalConstructor = true;
  if (this.builtins_[name]) {
    throw ReferenceError('Builtin "' + name + '" already exists.');
  }
  this.builtins_[name] = func;
  return func;
};

/**
 * Call a native asynchronous function.
 * @param {!Interpreter.State} state State for currently-being-invoked
 *     CallExpression.
 */
Interpreter.prototype.callAsyncFunction = function(state) {
  var intrp = this;
  var done = false;

  /**
   * Invariant check to verify it's safe to resolve or reject this
   * async function call.  Blow up if the call has already been
   * resolved/rejected, or if the thread does not appear to be in a
   * plausible state.
   * @param {!number} id Thread ID for this async function call.
   */
  var check = function(id) {
    if (done) {
      throw Error('Async function resolved or rejected more than once');
    }
    done = true;
    var thread = intrp.threads[id];
    if (!(thread instanceof Interpreter.Thread) ||
        thread.status !== Interpreter.Thread.Status.BLOCKED ||
        thread.stateStack_[thread.stateStack_.length - 1].node.type !=
        'CallExpression') {
      throw Error('Async function thread state looks wrong');
    }
  };

  var callbacks = (function(id) {
    return [
      function resolve(value) {
        check(id);
        state.value = value;
        intrp.threads[id].status = Interpreter.Thread.Status.READY;
        intrp.go_();
      },
      function reject(value) {
        check(id);
        // Create fake 'throw' state on appropriate thread.
        // TODO(cpcallen): find a more elegant way to do this.
        var thread = intrp.threads[id];
        var node = new Interpreter.Node;
        node['type'] = 'ThrowStatement';
        var throwState = new Interpreter.State(node,
            thread.stateStack_[thread.stateStack_.length - 1].scope);
        throwState.done_ = true;
        throwState.value = value;
        thread.stateStack_.push(throwState);
        intrp.threads[id].status = Interpreter.Thread.Status.READY;
        intrp.go_();
      }];
  })(this.thread.id);
  // Prepend resolve, reject to arguments.
  var args = callbacks.concat(state.arguments_);
  this.thread.status = Interpreter.Thread.Status.BLOCKED;
  state.func_.asyncFunc.apply(state.funcThis_, args);
};

/**
 * Converts from a native JS object or value to a JS interpreter
 * object.  Can handle JSON-style values plus regexps and errors (of
 * all standard native types), and handles additional properties on
 * arrays, regexps and errors (just as for plain objects).  Ignores
 * prototype and inherited properties.  Efficiently handles
 * sparse arrays.  Does NOT handle cyclic data.
 * @param {*} nativeObj The native JS object to be converted.
 * @return {Interpreter.Value} The equivalent JS interpreter object.
 */
Interpreter.prototype.nativeToPseudo = function(nativeObj) {
  if ((typeof nativeObj !== 'object' && typeof nativeObj !== 'function') ||
      nativeObj === null) {
    // It's a primitive; just return it.
    return /** @type {boolean|number|string|undefined|null} */ (nativeObj);
  }

  var pseudoObj;
  switch (Object.prototype.toString.apply(nativeObj)) {
    case '[object Array]':
      pseudoObj = new this.Array;
      break;
    case '[object RegExp]':
      pseudoObj = new this.RegExp;
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
      pseudoObj = new this.Error(proto);
      break;
    default:
      pseudoObj = new this.Object;
  }

  // Cast to satisfy type-checker; it might be a lie: nativeObj could
  // be an object (i.e., non-primitive) but not an Object (i.e.,
  // inherits from Object.prototype).  Fortunately we don't care.
  var keys = Object.getOwnPropertyNames(/** @type {!Object} */(nativeObj));
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var desc = Object.getOwnPropertyDescriptor(nativeObj, key);
    desc.value = this.nativeToPseudo(desc.value);
    this.setProperty(pseudoObj, key, Interpreter.VALUE_IN_DESCRIPTOR, desc);
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
 * @param {Interpreter.Value} pseudoObj The JS interpreter object to
 *     be converted.
 * @param {Object=} cycles Cycle detection (used only in recursive calls).
 * @return {*} The equivalent native JS object or value.
 */
Interpreter.prototype.pseudoToNative = function(pseudoObj, cycles) {
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
    var length = this.getProperty(pseudoObj, 'length');
    for (i = 0; i < length; i++) {
      // TODO(cpcallen): do we really want to include inherited properties?
      if (this.hasProperty(pseudoObj, i)) {
        nativeObj[i] =
            this.pseudoToNative(this.getProperty(pseudoObj, i), cycles);
      }
    }
  } else {  // Object.
    nativeObj = {};
    cycles.native.push(nativeObj);
    var keys = Object.keys(pseudoObj.properties);
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var val = pseudoObj.properties[key];
      nativeObj[key] = this.pseudoToNative(val, cycles);
    }
  }
  cycles.pseudo.pop();
  cycles.native.pop();
  return nativeObj;
};

/**
 * Converts from a native JS array to a JS interpreter array.
 * Does handle non-numeric properties (like str.match's index prop).
 * Does NOT recurse into the array's contents.
 * @param {!Array<Interpreter.Value>} nativeArray The JS array to be converted.
 * @return {!Interpreter.prototype.Array} The equivalent JS interpreter array.
 */
Interpreter.prototype.arrayNativeToPseudo = function(nativeArray) {
  // For the benefit of closure-compiler, which doesn't think Arrays
  // should have non-numeric indices:
  var /** Object<Interpreter.Value> */ nativeObject = nativeArray;
  var pseudoArray = new this.Array;
  var props = Object.getOwnPropertyNames(nativeArray);
  for (var i = 0; i < props.length; i++) {
    this.setProperty(pseudoArray, props[i], nativeObject[props[i]]);
  }
  return pseudoArray;
};

/**
 * Converts from a JS interpreter array to native JS array.
 * Does handle non-numeric properties (like str.match's index prop).
 * Does NOT recurse into the array's contents.
 * @param {!Interpreter.prototype.Object} pseudoArray The JS interpreter array
 *     or arraylike.
 * @return {!Array<Interpreter.Value>} The equivalent native JS array.
 */
Interpreter.prototype.arrayPseudoToNative = function(pseudoArray) {
  var nativeArray = [];
  // For the benefit of closure-compiler, which doesn't think Arrays
  // should have non-numeric indices:
  var /** Object<Interpreter.Value> */ nativeObject = nativeArray;

  // TODO(cpcallen): If pseudoArray is an arraylike, length might be
  // <= one of the previously-copied indices, which could result in
  // truncating the partially-copied array.  So length should probably
  // be special-cased here as well as below.
  for (var key in pseudoArray.properties) {
    nativeObject[key] = this.getProperty(pseudoArray, key);
  }
  // pseudoArray might be an object pretending to be an array.  In this case
  // it's possible that length is non-existent, invalid, or smaller than the
  // largest defined numeric property.  Set length explicitly here.
  nativeArray.length = Interpreter.legalArrayLength(
      this.getProperty(pseudoArray, 'length')) || 0;
  return nativeArray;
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
  name = String(name);
  if (obj === undefined || obj === null) {
    this.throwError(this.TYPE_ERROR,
        "Cannot read property '" + name + "' of " + obj);
  }
  if (obj instanceof this.Object) {
    return obj.properties[name];
  } else {
    // obj is actually a primitive - but we might still be able to get
    // a property descriptor from it, e.g., if it is a string and name
    // === length (or a numeric index).  Otherwise look at proto.
    var pd = Object.getOwnPropertyDescriptor(obj, name);
    if (pd) {
      return /** @type {Interpreter.Value} */(pd.value);
    } else {
      return this.getPrototype(obj).properties[name];
    }
  }
};

/**
 * Does the named property exist on a data object.  Implements 'in'.
 * Note that although primitives have (inherited) properties, 'in' does not
 * recognize them.  Thus "'length' in 'str'" is an error.
 *
 * TODO(cpcallen): Change typing.  There is almost certainly no reason
 * for this to accept primitives.
 * @param {Interpreter.Value} obj Data object.
 * @param {Interpreter.Value} name Name of property.
 * @return {boolean|undefined} True if property exists, undefined if primitive.
 */
Interpreter.prototype.hasProperty = function(obj, name) {
  if (!(obj instanceof this.Object)) {
    return undefined;
  }
  name = String(name);
  do {
    if (obj.properties && name in obj.properties) {
      return true;
    }
  } while ((obj = this.getPrototype(obj)));
  return false;
};

/**
 * Set a property value on a data object.
 *
 * TODO(cpcallen): This should be split into (at least) two different
 * functions, because non-writable properties are treated quite
 * differently by assignment and Object.defineProperty.
 * @param {!Interpreter.prototype.Object} obj Data object.
 * @param {Interpreter.Value} name Name of property.
 * @param {Interpreter.Value|Interpreter.Sentinel} value New property
 *     value.  Use Interpreter.VALUE_IN_DESCRIPTOR if value is handled
 *     by descriptor instead.
 * @param {Object=} desc Optional descriptor object.
 */
Interpreter.prototype.setProperty = function(obj, name, value, desc) {
  name = String(name);
  if (desc) {
    var pd = {};
    if ('configurable' in desc) pd.configurable = desc.configurable;
    if ('enumerable' in desc) pd.enumerable = desc.enumerable;
    if ('writable' in desc) pd.writable = desc.writable;
    if (value === Interpreter.VALUE_IN_DESCRIPTOR) {
      if ('value' in desc) {
        pd.value = desc.value;
      }
    } else {
      pd.value = value;
    }
    try {
      Object.defineProperty(obj.properties, name, pd);
    } catch (e) {
      this.throwNativeException(e);
    }
  } else {
    try {
      obj.properties[name] = value;
    } catch (e) {
      this.throwNativeException(e);
    }
  }
};

/**
 * Retrieves a value from the scope chain.
 * @param {!Interpreter.Scope} scope Scope to read from.
 * @param {string} name Name of variable.
 * @return {Interpreter.Value} Value (may be undefined).
 */
Interpreter.prototype.getValueFromScope = function(scope, name) {
  for (var s = scope; s; s = s.outerScope) {
    if (name in s.properties) {
      return s.properties[name];
    }
  }
  // Typeof operator is unique: it can safely look at non-defined variables.
  var stack = this.thread.stateStack_;
  var prevNode = stack[stack.length - 1].node;
  if (prevNode['type'] === 'UnaryExpression' &&
      prevNode['operator'] === 'typeof') {
    return undefined;
  }
  this.throwError(this.REFERENCE_ERROR, name + ' is not defined');
};

/**
 * Sets a value to the current scope.
 * @param {!Interpreter.Scope} scope Scope to write to.
 * @param {string} name Name of variable.
 * @param {Interpreter.Value} value Value.
 */
Interpreter.prototype.setValueToScope = function(scope, name, value) {
  for (var s = scope; s; s = s.outerScope) {
    if (name in s.properties) {
      if (s.notWritable.has(name)) {
        this.throwError(this.TYPE_ERROR,
            'Assignment to constant variable: ' + name);
      }
      s.properties[name] = value;
      return;
    }
  }
  this.throwError(this.REFERENCE_ERROR, name + ' is not defined');
};

/**
 * Creates a variable in the given scope.
 * @param {!Interpreter.Scope} scope Scope to write to.
 * @param {Interpreter.Value} name Name of variable.
 * @param {Interpreter.Value} value Initial value.
 * @param {boolean=} notWritable True if constant.  Defaults to false.
 */
Interpreter.prototype.addVariableToScope =
    function(scope, name, value, notWritable) {
  name = String(name);
  if (!(name in scope.properties)) {
    scope.properties[name] = value;
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
                            this.createFunctionFromAST(node, scope, source));
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
  return this.thread.stateStack_[this.thread.stateStack_.length - 1].
      isConstructor;
};

/**
 * Gets a value from the scope chain or from an object property.
 * @param {!Interpreter.Scope} scope Current scope dictionary.
 * @param {!Array} ref Name of variable or object/propname tuple.
 * @return {Interpreter.Value} Value (may be undefined).
 */
Interpreter.prototype.getValue = function(scope, ref) {
  if (ref[0] === Interpreter.SCOPE_REFERENCE) {
    // A null/varname variable lookup.
    return this.getValueFromScope(scope, ref[1]);
  } else {
    // An obj/prop components tuple (foo.bar).
    return this.getProperty(ref[0], ref[1]);
  }
};

/**
 * Sets a value to the scope chain or to an object property.
 * @param {!Interpreter.Scope} scope Current scope dictionary.
 * @param {!Array} ref Name of variable or object/propname tuple.
 * @param {Interpreter.Value} value Value.
 */
Interpreter.prototype.setValue = function(scope, ref, value) {
  if (ref[0] === Interpreter.SCOPE_REFERENCE) {
    // A null/varname variable lookup.
    this.setValueToScope(scope, ref[1], value);
  } else {
    // An obj/prop components tuple (foo.bar).
    this.setProperty(ref[0], ref[1], value);
  }
};

/**
 * Completion Value Types.
 * @enum {number}
 */
Interpreter.Completion = {
  NORMAL: 0,
  BREAK: 1,
  CONTINUE: 2,
  RETURN: 3,
  THROW: 4
};

/**
 * Throw an exception in the interpreter that can be handled by a
 * interpreter try/catch statement.
 * @param {Interpreter.Value} value Value to be thrown.
 */
Interpreter.prototype.throwException = function(value) {
  this.unwind_(Interpreter.Completion.THROW, value, undefined);
  // Abort anything related to the current step.
  throw Interpreter.STEP_ERROR;
};

/**
 * Throw an Error in the interpreter.  A convenience method that just
 * does this.throwException(new this.Error(arguments)
 * @param {!Interpreter.prototype.Error} proto Prototype new Error object.
 * @param {string=} message Message to attach to new Error object.
 */
Interpreter.prototype.throwError = function(proto, message) {
  this.throwException(new this.Error(proto, message));
};

/**
 * Rethrow a native exception as an interpreter object that can be
 * handled by a interpreter try/catch statement.
 *
 * BUG(cpcallen): exception should have user (not native) stack trace.
 * @param {*} value Native value to be converted and thrown.
 */
Interpreter.prototype.throwNativeException = function(value) {
  value = this.nativeToPseudo(value);
  this.throwException(value);
};

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
 * @param {Interpreter.Completion} type Completion type.
 * @param {Interpreter.Value=} value Value computed, returned or thrown.
 * @param {string=} label Target label for break or return.
 */
Interpreter.prototype.unwind_ = function(type, value, label) {
  if (type === Interpreter.Completion.NORMAL) {
    throw TypeError('Should not unwind for NORMAL completions');
  }

  for (var stack = this.thread.stateStack_; stack.length > 0; stack.pop()) {
    var state = stack[stack.length - 1];
    switch (state.node['type']) {
      case 'TryStatement':
        state.cv = {type: type, value: value, label: label};
        return;
      case 'CallExpression':
      case 'NewExpression':
        switch (type) {
          case Interpreter.Completion.BREAK:
          case Interpreter.Completion.CONTINUE:
            throw Error('Unsynatctic break/continue not rejected by Acorn');
          case Interpreter.Completion.RETURN:
            state.value = value;
            return;
        }
        break;
    }
    if (type === Interpreter.Completion.BREAK) {
      if (label ? (state.labels && state.labels.indexOf(label) !== -1) :
          (state.isLoop || state.isSwitch)) {
        // Top of stack is now target of break.  But we are breaking
        // out of this statement, so pop to discard it.
        stack.pop();
        return;
      }
    } else if (type === Interpreter.Completion.CONTINUE) {
      if (label ? (state.labels && state.labels.indexOf(label) !== -1) :
          state.isLoop) {
        return;
      }
    }
  }

  // Unhandled completion.  Terminate thread.
  this.thread.status = Interpreter.Thread.Status.ZOMBIE;

  if (type === Interpreter.Completion.THROW) {
    // Log exception and stack trace.
    if (value instanceof this.Error) {
      var name = this.getProperty(value, 'name');
      var message = this.getProperty(value, 'message');
      console.log('Unhandled %s: %s', name, message);
      var stackTrace = this.getProperty(value, 'stack');
      if (stackTrace) {
        console.log(stackTrace);
      }
    } else {
      // TODO(cpcallen): log toSource(error), for clarity?
      console.log('Unhandled exception with value:', value);
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
 * @param {?Interpreter.Scope=} outerScope The enclosing scope ("outer
 *     lexical environment reference", in ECMAScript spec parlance).
 *     Defaults to null.
 * @param {?Interpreter.prototype.Object=} perms The permissions with
 *     which code in the current scope is executing.  Defaults to
 *     outerScope.perms (if supplied; otherwise null).
 * @constructor
 */
Interpreter.Scope = function(outerScope, perms) {
  this.outerScope = outerScope || null;
  if (perms === undefined) {
    this.perms = outerScope ? outerScope.perms : null;
  } else {
    this.perms = perms;
  }
  this.properties = Object.create(null);
  this.notWritable = new Set();
};

/**
 * Class for a state.
 * @param {!Interpreter.Node} node AST node for the state.
 * @param {!Interpreter.Scope} scope Scope dictionary for the state.
 * @constructor
 */
Interpreter.State = function(node, scope) {
  this.node = node;
  this.scope = scope;
};

/**
 * Class for a thread of execution.
 *
 * Parameters should only be undefined when called from the deserializer.
 * @constructor
 * @param {number=} id Thread ID.  Should correspond to index of this
 *     thread in .threads array.
 * @param {!Interpreter.State=} state Starting state for thread.
 * @param {number=} runAt Time at which to start running thread.
 */
Interpreter.Thread = function(id, state, runAt) {
  if (id === undefined || state === undefined || runAt === undefined) {
    // Deserialising. Props will be filled in later.
    /** @type {number} */
    this.id = -1;
    /** @type {!Interpreter.Thread.Status} */
    this.status = Interpreter.Thread.Status.ZOMBIE;
    /** @private @type {!Array<!Interpreter.State>} */
    this.stateStack_ = [];
    /** @type {number} */
    this.runAt = 0;
    return;
  }
  this.id = id;
  // Say it's sleeping for now.  May be woken immediately.
  this.status = Interpreter.Thread.Status.SLEEPING;
  this.stateStack_ = [state];
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
 * user/group/etc. object) - or undefined if the thread is a zombie.e
 * a zombie.

 * @return {!Interpreter.prototype.Object|undefined}
 */
Interpreter.Thread.prototype.perms = function() {
  if (this.status === Interpreter.Thread.Status.ZOMBIE) {
    return undefined;
  }
  return this.stateStack_[this.stateStack_.length - 1].scope.perms;
};

/**
 * Sets the permissions with which currently-executing code will
 * run until the end of the innermost scope.
 * @param {!Interpreter.prototype.Object} perms New perms.
 */
Interpreter.Thread.prototype.setPerms = function(perms) {
  if (this.status === Interpreter.Thread.Status.ZOMBIE) {
    throw Error("Can't set perms of zombie thread");
  }
  this.stateStack_[this.stateStack_.length - 1].scope.perms = perms;
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

///////////////////////////////////////////////////////////////////////////////
// Types representing JS objects - Object, Function, Array, etc.
///////////////////////////////////////////////////////////////////////////////

/**
 * Typedef for JS values.
 * @typedef {!Interpreter.prototype.Object|boolean|number|string|undefined|null}
 */
Interpreter.Value;

/**
 * @param {Interpreter.prototype.Object=} proto
 * @constructor
 */
Interpreter.prototype.Object = function(proto) {
  this.proto = null;
  this.properties = Object.create(null);
  throw Error('Inner class constructor not callable on prototype');
};
/** @type {Interpreter.prototype.Object} */
Interpreter.prototype.Object.prototype.proto = null;
/** @type {string} */
Interpreter.prototype.Object.prototype.class = '';
/** @return {string} */
Interpreter.prototype.Object.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};
/** @return {Interpreter.Value} */
Interpreter.prototype.Object.prototype.valueOf = function() {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {Interpreter.prototype.Object=} proto
 * @constructor
 * @extends {Interpreter.prototype.Object}
 */
Interpreter.prototype.Function = function(proto) {
  throw Error('Inner class constructor not callable on prototype');
};
/** @return {string} @override */
Interpreter.prototype.Function.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};
Interpreter.prototype.Function.prototype.addPrototype = function() {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {Interpreter.prototype.Object=} proto
 * @constructor
 * @extends {Interpreter.prototype.Object}
 */
Interpreter.prototype.Array = function(proto) {
  throw Error('Inner class constructor not callable on prototype');
};
/** @return {string} @override */
Interpreter.prototype.Array.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {Interpreter.prototype.Object=} proto
 * @constructor
 * @extends {Interpreter.prototype.Object}
 */
Interpreter.prototype.Date = function(proto) {
  this.date = null;
  throw Error('Inner class constructor not callable on prototype');
};
/** @return {string} @override */
Interpreter.prototype.Date.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};
/** @return {Interpreter.Value} */
Interpreter.prototype.Date.prototype.valueOf = function() {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {Interpreter.prototype.Object=} proto
 * @constructor
 * @extends {Interpreter.prototype.Object}
 */
Interpreter.prototype.RegExp = function(proto) {
  this.regexp = null;
  throw Error('Inner class constructor not callable on prototype');
};
/** @return {string} @override */
Interpreter.prototype.RegExp.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};
/** @param {!RegExp} nativeRegexp The native regular expression. */
Interpreter.prototype.RegExp.prototype.populate = function(nativeRegexp) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {Interpreter.prototype.Object=} proto
 * @param {string=} message
 * @constructor
 * @extends {Interpreter.prototype.Object}
 */
Interpreter.prototype.Error = function(proto, message) {
  throw Error('Inner class constructor not callable on prototype');
};
/** @return {string} @override */
Interpreter.prototype.Error.prototype.toString = function() {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @param {number} port
 * @param {!Interpreter.prototype.Object} proto
 */
Interpreter.prototype.Server = function(port, proto) {
  /** @type {number} */
  this.port = 0;
  /** @type {Interpreter.prototype.Object} */
  this.proto = null;
  /** @private @type {net.Server} */
  this.server_ = null;
  throw Error('Inner class constructor not callable on prototype');
};

/**
 * @param {!Function=} onListening
 * @param {!Function=} onError
 */
Interpreter.prototype.Server.prototype.listen = function(onListening, onError) {
  throw Error('Inner class method not callable on prototype');
};

/** @param {!Function=} onClose */
Interpreter.prototype.Server.prototype.unlisten = function(onClose) {
  throw Error('Inner class method not callable on prototype');
};

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
   * @param {Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.Object = function(proto) {
    if (proto === undefined) {
      proto = intrp.OBJECT;
    }
    // We must define .proto before .properties, because our
    // children's .properties will inherit from ours, and the
    // deserializer is not smart enough to deal with encountering
    // children's .properties before it has resurrected the
    // .proto.properties.
    this.proto = proto;
    this.properties = Object.create((proto === null) ? null : proto.properties);
  };

  /** @type {Interpreter.prototype.Object} */
  intrp.Object.prototype.proto = null;
  /** @type {string} */
  intrp.Object.prototype.class = 'Object';

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
   * Class for a function
   * @constructor
   * @extends {Interpreter.prototype.Function}
   * @param {Interpreter.prototype.Object=} proto Prototype object.
   */
  intrp.Function = function(proto) {
    intrp.Object.call(/** @type {?} */(this),
        (proto === undefined ? intrp.FUNCTION : proto));
  };

  intrp.Function.prototype = Object.create(intrp.Object.prototype);
  intrp.Function.prototype.constructor = intrp.Function;
  intrp.Function.prototype.class = 'Function';

  /**
   * Convert this function into a string.
   * @return {string} String value.
   * @override
   */
  intrp.Function.prototype.toString = function() {
    if (!(this instanceof intrp.Function)) {
      intrp.throwError(intrp.TYPE_ERROR,
          'Function.prototype.toString is not generic');
    }
    // N.B. that ES5.1 spec stipulates that output must be in syntax of
    // a function declaration; ES6 corrects this by also allowing
    // function expressions (plus generators, classes, arrow functions,
    // methods etc...) - but in any case it should look like source code.
    return this.source || 'function() { [unknown] }';
  };

  /**
   * The [[HasInstance]] internal method from §15.3.5.3 of the ES5.1 spec.
   * @param {Interpreter.Value} value The value to be checked for
   *     being an instance of this function.
   */
  intrp.Function.prototype.hasInstance = function(value) {
    if (!(value instanceof intrp.Object)) {
      return false;
    }
    var prot = intrp.getProperty(this, 'prototype');
    if (!(prot instanceof intrp.Object)) {
      intrp.throwError(intrp.TYPE_ERROR,
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
   * Add a .prototype property to this function object, setting
   * this.properties[prototype] to prototype and
   * prototype.properites[constructor] to func.
   * A newly-created object is used.
   */
  intrp.Function.prototype.addPrototype = function() {
    if (this.illegalConstructor) {
      // It's almost certainly an error to add a .prototype property
      // to a function we have declared isn't a constructor.  (This
      // doesn't prevent user code from doing so - just makes sure we
      // don't do it accidentally when bootstrapping or whatever.)
      throw TypeError("Illogical addition of .prototype to non-constructor");
    }
    var protoObj = new intrp.Object();
    intrp.setProperty(this, 'prototype', protoObj,
        Interpreter.NONENUMERABLE_NONCONFIGURABLE_DESCRIPTOR);
    intrp.setProperty(protoObj, 'constructor', this,
        Interpreter.NONENUMERABLE_DESCRIPTOR);
  };

  /**
   * Class for an array
   * @constructor
   * @extends {Interpreter.prototype.Array}
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.Array = function(proto) {
    if (proto === undefined) {
      proto = intrp.ARRAY;
    }
    intrp.Object.call(/** @type {?} */(this), proto);
    this.properties = [];
    Object.setPrototypeOf(this.properties,
                          (proto === null) ? null : proto.properties);
  };

  intrp.Array.prototype = Object.create(intrp.Object.prototype);
  intrp.Array.prototype.constructor = intrp.Array;
  intrp.Array.prototype.class = 'Array';

  /**
   * Convert array-like objects into a string.
   * @return {string} String value.
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
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.Date = function(proto) {
    intrp.Object.call(/** @type {?} */(this),
        (proto === undefined ? intrp.DATE : proto));
    /** @type {Date} */
    this.date = null;
  };

  intrp.Date.prototype = Object.create(intrp.Object.prototype);
  intrp.Date.prototype.constructor = intrp.Date;
  intrp.Date.prototype.class = 'Date';

  /**
   * Return the date as a string.
   * @return {string} Value.
   * @override
   */
  intrp.Date.prototype.toString = function() {
    if (!(this.date instanceof Date)) {
      intrp.throwError(intrp.TYPE_ERROR,
          'Date.prototype.toString is not generic');
    }
    return this.date.toString();
  };

  /**
   * Return the date as a numeric value.
   * @return {number} Value.
   * @override
   */
  intrp.Date.prototype.valueOf = function() {
    if (!(this.date instanceof Date)) {
      intrp.throwError(intrp.TYPE_ERROR,
          'Date.prototype.valueOf is not generic');
    }
    return this.date.valueOf();
  };

  /**
   * Class for a regexp
   * @constructor
   * @extends {Interpreter.prototype.RegExp}
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.RegExp = function(proto) {
    intrp.Object.call(/** @type {?} */(this),
        (proto === undefined ? intrp.REGEXP : proto));
    /** @type {RegExp} */
    this.regexp = null;
  };

  intrp.RegExp.prototype = Object.create(intrp.Object.prototype);
  intrp.RegExp.prototype.constructor = intrp.RegExp;
  intrp.RegExp.prototype.class = 'RegExp';

  /**
   * Return the regexp as a string.
   * @return {string} Value.
   * @override
   */
  intrp.RegExp.prototype.toString = function() {
    if (this.regexp instanceof RegExp) {
      return this.regexp.toString();
    }
    // BUG(cpcallen): this should do some weird stuff per §21.2.5.14 of
    // the ES6 spec.  For most non-RegExp objects it will return
    // "/undefined/undefined"...  :-/
    return '//';
  };

  /**
   * Initialize a (pseudo) RegExp from a native regular expression object.
   * @param {!RegExp} nativeRegexp The native regular expression.
   */
  intrp.RegExp.prototype.populate = function(nativeRegexp) {
    this.regexp = nativeRegexp;
    // lastIndex is settable, all others are read-only attributes
    intrp.setProperty(this, 'lastIndex', nativeRegexp.lastIndex,
      Interpreter.NONENUMERABLE_DESCRIPTOR);
    intrp.setProperty(this, 'source', nativeRegexp.source,
        Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
    intrp.setProperty(this, 'global', nativeRegexp.global,
        Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
    intrp.setProperty(this, 'ignoreCase', nativeRegexp.ignoreCase,
        Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
    intrp.setProperty(this, 'multiline', nativeRegexp.multiline,
        Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  };

  /**
   * Class for an error object
   * @constructor
   * @extends {Interpreter.prototype.Error}
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   * @param {string=} message Optional message to be attached to error object.
   */
  intrp.Error = function(proto, message) {
    intrp.Object.call(/** @type {?} */(this),
        (proto === undefined ? intrp.ERROR : proto));
    if (message !== undefined) {
      intrp.setProperty(this, 'message', message,
                        Interpreter.NONENUMERABLE_DESCRIPTOR);
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
        if (stack.length &&
            !(node['type'] === 'CallExpression' && state.doneExec)) {
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
      intrp.setProperty(this, 'stack', stack.join('\n'),
          Interpreter.NONENUMERABLE_DESCRIPTOR);
    }
  };

  intrp.Error.prototype = Object.create(intrp.Object.prototype);
  intrp.Error.prototype.constructor = intrp.Error;
  intrp.Error.prototype.class = 'Error';

  /**
   * Return the error as a string.
   * @return {string} Value.
   * @override
   */
  intrp.Error.prototype.toString = function() {
    var cycles = intrp.toStringCycles_;
    if (cycles.indexOf(this) !== -1) {
      return '[object Error]';
    }
    var name, message;
    var obj = this;
    do {
      if ('name' in obj.properties) {
        name = obj.properties['name'];
        break;
      }
    } while ((obj = obj.proto));
    obj = this;
    do {
      if ('message' in obj.properties) {
        message = obj.properties['message'];
        break;
      }
    } while ((obj = obj.proto));
    cycles.push(this);
    try {
      name = (name === undefined) ? 'Error' : String(name);
      message = (message === undefined) ? '' : String(message);
    } finally {
      cycles.pop();
    }
    if (name) {
      return message ? (name + ': ' + message) : name;
    }
    return message;
  };

  /**
   * Server is a (port, proto, (extra info)) tuple representing a
   * listening server.  It encapsulates node's net.Server type, with
   * some additional info needed to implement the connectionListen()
   * API.  In its present form it is not suitable for exposure as a
   * userland pseduoObject, but it is intended to be easily adaptable
   * for that if desired.
   *
   * TODO(cpcallen): this should be typed to permit being called
   * without arguments when deserializing.
   * @constructor
   * @extends {Interpreter.prototype.Server}
   * @param {number} port Port to listen on.
   * @param {!Interpreter.prototype.Object} proto Prototype object for
   *     new connections.
   */
  intrp.Server = function(port, proto) {
    if ((port !== (port >>> 0) || port > 0xffff) && port !== undefined) {
      throw RangeError('invalid port ' + port);
    }
    this.port = port;
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
    var netServer = new net.Server(/* { allowHalfOpen: true } */);
    netServer.on('connection', function (socket) {
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
      var obj = new intrp.Object(server.proto);
      obj.socket = socket;
      var func = intrp.getProperty(obj, 'onConnect');
      if (func instanceof intrp.Function) {
        intrp.createThreadForFuncCall(func, obj, []);
      }

      // Handle incoming data from clients.  N.B. that data is a
      // node buffer object, so we must convert it to a string
      // before passing it to user code.
      socket.on('data', function (data) {
        var func = intrp.getProperty(obj, 'onReceive');
        if (func instanceof intrp.Function) {
          intrp.createThreadForFuncCall(func, obj, [String(data)]);
        }
      });

      socket.on('end', function() {
        console.log('Connection from %s closed.', socket.remoteAddress);
        var func = intrp.getProperty(obj, 'onEnd');
        if (func instanceof intrp.Function) {
          intrp.createThreadForFuncCall(func, obj, []);
        }
        // TODO(cpcallen): Don't fully close half-closed connection yet.
        socket.end();
      });

      socket.on('error', function(error) {
        console.log('Socket error:', error);
        var func = intrp.getProperty(obj, 'onError');
        var userError = intrp.nativeToPseudo(error);
        if (func instanceof intrp.Function) {
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
   * @constructor
   * @param {Interpreter.Value} value Value whose properties are to be
   *     iterated over.
   */
  intrp.PropertyIterator = function(value) {
    // N.B.: .value must be defined before .properties (defined/set in
    // .getKeys_), and must not point at the .properties object of an
    // interpreter Object other than the one pointed to by .value, or
    // there will be problems when deserializing; see comment in
    // Interpreter.prototype.Object constructor for details.
    this.value = value;
    this.getKeys_();
    this.visited = new Set();
  };

  /**
   * Load the property keys of this.value into this.keys and reset
   * this.i to 0.
   * @private
   */
  intrp.PropertyIterator.prototype.getKeys_ = function() {
    if (this.value === null || this.value === undefined) {
      this.keys = [];
    } else {
      this.properties = (this.value instanceof intrp.Object) ?
          this.value.properties : this.value;
      // Call to Object() is not required in ES6 or later, but in
      // ES5.1 Object.getOwnPropertyNames only accepts objects, so we
      // actually need to create a boxed primitive here.
      this.keys = Object.getOwnPropertyNames(Object(this.properties));
    }
    this.i = 0;
  };

  /**
   * @return {string|undefined}
   */
  intrp.PropertyIterator.prototype.next = function() {
    while (true) {
      if (this.i >= this.keys.length) {
        this.value = intrp.getPrototype(this.value);
        if (this.value === null || this.value === undefined) {
          // Done iteration.
          return undefined;
        }
        this.getKeys_();
      }
      var key = this.keys[this.i++];
      var pd = Object.getOwnPropertyDescriptor(this.properties, key);
      // Skip deleted or already-visited properties.
      if (!pd || this.visited.has(key)) {
        continue;
      }
      this.visited.add(key);
      if (pd.enumerable) {
        return key;
      }
    }
  };

};

///////////////////////////////////////////////////////////////////////////////
// Functions to handle each node type.
///////////////////////////////////////////////////////////////////////////////

Interpreter.prototype['stepArrayExpression'] = function(stack, state, node) {
  var elements = node['elements'];
  var n = state.n_ || 0;
  if (!state.array_) {
    state.array_ = new this.Array;
    state.array_.properties.length = elements.length;
  } else {
    this.setProperty(state.array_, n, state.value);
    n++;
  }
  while (n < elements.length) {
    // Skip missing elements - they're not defined, not undefined.
    if (elements[n]) {
      state.n_ = n;
      return new Interpreter.State(elements[n], state.scope);
    }
    n++;
  }
  stack.pop();
  stack[stack.length - 1].value = state.array_;
};

Interpreter.prototype['stepAssignmentExpression'] =
    function(stack, state, node) {
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    var nextState = new Interpreter.State(node['left'], state.scope);
    nextState.components = true;
    return nextState;
  }
  if (!state.doneRight_) {
    if (!state.leftReference_) {
      state.leftReference_ = state.value;
    }
    if (node['operator'] !== '=') {
      state.leftValue_ = this.getValue(state.scope, state.leftReference_);
    }
    state.doneRight_ = true;
    return new Interpreter.State(node['right'], state.scope);
  }
  var rightValue = state.value;
  var value = state.leftValue_;
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
  this.setValue(state.scope, state.leftReference_, value);
  stack.pop();
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepBinaryExpression'] = function(stack, state, node) {
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    return new Interpreter.State(node['left'], state.scope);
  }
  if (!state.doneRight_) {
    state.doneRight_ = true;
    state.leftValue_ = state.value;
    return new Interpreter.State(node['right'], state.scope);
  }
  stack.pop();
  var leftValue = state.leftValue_;
  var rightValue = state.value;
  var value;
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
        this.throwError(this.TYPE_ERROR,
            "'in' expects an object, not '" + rightValue + "'");
      }
      value = this.hasProperty(rightValue, leftValue);
      break;
    case 'instanceof':
      if (!(rightValue instanceof this.Function)) {
        this.throwError(this.TYPE_ERROR,
            'Right-hand side of instanceof is not an object');
      }
      value = rightValue.hasInstance(leftValue);
      break;
    default:
      throw SyntaxError('Unknown binary operator: ' + node['operator']);
  }
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepBlockStatement'] = function(stack, state, node) {
  var n = state.n_ || 0;
  var expression = node['body'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
};

Interpreter.prototype['stepBreakStatement'] = function(stack, state, node) {
  this.unwind_(Interpreter.Completion.BREAK, undefined,
      node['label'] ? node['label']['name'] : undefined);
};

Interpreter.prototype['stepCallExpression'] = function(stack, state, node) {
  if (!state.doneCallee_) {
    state.doneCallee_ = 1;
    // Fallback for global function, 'this' is undefined.
    state.funcThis_ = undefined;
    // Components needed to determine value of 'this'.
    var nextState = new Interpreter.State(node['callee'], state.scope);
    nextState.components = true;
    return nextState;
  }
  if (state.doneCallee_ === 1) {
    // Determine value of the function.
    state.doneCallee_ = 2;
    var func = state.value;
    if (Array.isArray(func)) {
      state.func_ = this.getValue(state.scope, func);
      if (func[0] === Interpreter.SCOPE_REFERENCE) {
        // (Globally or locally) named function.  Is it named 'eval'?
        state.directEval_ = (func[1] === 'eval');
      } else {
        // Method function, 'this' is object (ignored if invoked as 'new').
        state.funcThis_ = func[0];
      }
    } else {
      // Callee was not an Identifier or MemberExpression, and is
      // already fully evaluated.
      state.func_ = func;
    }
    state.arguments_ = [];
    state.n_ = 0;
  }
  if (!state.doneArgs_) {
    if (state.n_ !== 0) {
      state.arguments_.push(state.value);
    }
    if (node['arguments'][state.n_]) {
      return new Interpreter.State(node['arguments'][state.n_++], state.scope);
    }
    // Determine value of 'this' in function.
    if (node['type'] === 'NewExpression') {
      var func = state.func_;
      if (typeof func === 'string' && state.arguments_.length === 0) {
        // Special hack for Code City's "new 'foo'" syntax.
        if (!this.builtins_[func]) {
          this.throwError(this.REFERENCE_ERROR, func + ' is not a builtin');
        }
        stack.pop();
        if (stack.length > 0) {
          stack[stack.length - 1].value = this.builtins_[func];
        }
        return;
      }
      if (!(func instanceof this.Function)) {
        this.throwError(this.TYPE_ERROR, func + ' is not a function');
      } else if (func.illegalConstructor) {
        // Illegal: new escape();
        this.throwError(this.TYPE_ERROR, func + ' is not a constructor');
      }
      // Constructor; 'this' will be new object being constructed.
      var proto = this.getProperty(func, 'prototype');
      // Per §13.2.2 (step 7) of ES5.1 spec:
      if (!(proto instanceof this.Object)) {
        proto = this.OBJECT;
      }
      state.funcThis_ = new this.Object(proto);
      state.isConstructor = true;
    }
    state.doneArgs_ = true;
  }
  if (!state.doneExec) {
    state.doneExec = true;
    var func = state.func_;
    // TODO(fraser): determine if this check is redundant; remove it or add
    // tests that depend on it.
    if (!(func instanceof this.Function)) {
      this.throwError(this.TYPE_ERROR, func + ' is not a function');
    }
    var funcNode = func.node;
    if (funcNode) {
      // TODO(cpcallen:perms): this should use func.owner
      var scope = new Interpreter.Scope(func.outerScope);
      if(func.source === undefined) {
        throw Error("No source for user-defined function??");
      }
      this.populateScope_(funcNode['body'], scope, func.source);
      // Add all arguments.
      for (var i = 0; i < funcNode['params'].length; i++) {
        var paramName = funcNode['params'][i]['name'];
        var paramValue = state.arguments_.length > i ? state.arguments_[i] :
            undefined;
        this.addVariableToScope(scope, paramName, paramValue);
      }
      // Build arguments variable.
      var argsList = new this.Array;
      for (var i = 0; i < state.arguments_.length; i++) {
        this.setProperty(argsList, i, state.arguments_[i]);
      }
      this.addVariableToScope(scope, 'arguments', argsList, true);
      // Add the function's name (var x = function foo(){};)
      var name = funcNode['id'] && funcNode['id']['name'];
      if (name) {
        this.addVariableToScope(scope, name, func, true);
      }
      this.addVariableToScope(scope, 'this', state.funcThis_, true);
      state.value = undefined;  // Default value if no explicit return.
      return new Interpreter.State(funcNode['body'], scope);
    } else if (func.eval) {
      var code = state.arguments_[0];
      if (typeof code !== 'string') {  // eval()
        // Eval returns the argument if the argument is not a string.
        // eval(Array) -> Array
        state.value = code;
      } else {
        code = String(code);
        var ast = this.parse(code);
        var evalNode = new Interpreter.Node;
        evalNode['type'] = 'EvalProgram_';
        evalNode['body'] = ast['body'];
        evalNode['source'] = code;
        // Create new scope and update it with definitions in eval().
        var outerScope = state.directEval_ ? state.scope : this.global;
        var scope = new Interpreter.Scope(outerScope);
        this.populateScope_(ast, scope, code);
        this.value = undefined;  // Default value if no code.
        return new Interpreter.State(evalNode, scope);
      }
    } else if (func.nativeFunc) {
      state.value = func.nativeFunc.apply(state.funcThis_, state.arguments_);
    } else if (func.asyncFunc) {
      this.callAsyncFunction(state);
      return;
    } else {
      /* A child of a function is a function but is not callable.  For example:
      var F = function() {};
      F.prototype = escape;
      var f = new F();
      f();
      */
      this.throwError(this.TYPE_ERROR, func.class + ' is not a function');
    }
  } else {
    // Execution complete.  Put the return value on the stack.
    stack.pop();
    // Program node may not exist if this is a setTimeout function.
    if (stack.length > 0) {
      if (state.isConstructor && typeof state.value !== 'object') {
        stack[stack.length - 1].value = state.funcThis_;
      } else {
        stack[stack.length - 1].value = state.value;
      }
    }
  }
};

Interpreter.prototype['stepCatchClause'] = function(stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    // Create an empty scope.
    var scope = new Interpreter.Scope(state.scope);
    // Add the argument.
    this.addVariableToScope(scope, node['param']['name'], state.throwValue);
    // Execute catch clause.
    return new Interpreter.State(node['body'], scope);
  }
  stack.pop();
};

Interpreter.prototype['stepConditionalExpression'] =
    function(stack, state, node) {
  var mode = state.mode_ || 0;
  if (mode === 0) {
    state.mode_ = 1;
    return new Interpreter.State(node['test'], state.scope);
  }
  if (mode === 1) {
    state.mode_ = 2;
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
  stack.pop();
  if (node['type'] === 'ConditionalExpression') {
    stack[stack.length - 1].value = state.value;
  }
};

Interpreter.prototype['stepContinueStatement'] = function(stack, state, node) {
  this.unwind_(Interpreter.Completion.CONTINUE, undefined,
      node['label'] ? node['label']['name'] : undefined);
};

Interpreter.prototype['stepDebuggerStatement'] = function(stack, state, node) {
  // Do nothing.  May be overridden by developers.
  stack.pop();
};

Interpreter.prototype['stepDoWhileStatement'] = function(stack, state, node) {
  if (node['type'] === 'DoWhileStatement' && state.test_ === undefined) {
    // First iteration of do/while executes without checking test.
    state.value = true;
    state.test_ = true;
  }
  if (!state.test_) {
    state.test_ = true;
    return new Interpreter.State(node['test'], state.scope);
  }
  if (!state.value) {  // Done, exit loop.
    stack.pop();
  } else if (node['body']) {  // Execute the body.
    state.test_ = false;
    state.isLoop = true;
    return new Interpreter.State(node['body'], state.scope);
  }
};

Interpreter.prototype['stepEmptyStatement'] = function(stack, state, node) {
  stack.pop();
};

Interpreter.prototype['stepEvalProgram_'] = function(stack, state, node) {
  var n = state.n_ || 0;
  var expression = node['body'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
  stack[stack.length - 1].value = this.value;
};

Interpreter.prototype['stepExpressionStatement'] =
    function(stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    return new Interpreter.State(node['expression'], state.scope);
  }
  stack.pop();
  // Save this value to interpreter.value for use as a return value if
  // this code is inside an eval function.
  //
  // TODO(cpcallen): This is suspected to not be strictly correct
  // compared to how the ES5.1 spec defines completion values.  Add
  // tests to prove it one way or the other.
  this.value = state.value;
};

Interpreter.prototype['stepForInStatement'] = function(stack, state, node) {
  if (!state.doneObject_) {
    // First, variable initialization is illegal in strict mode.
    state.doneObject_ = true;
    if (node['left']['declarations'] &&
        node['left']['declarations'][0]['init']) {
      this.throwError(this.SYNTAX_ERROR,
          'for-in loop variable declaration may not have an initializer.');
    }
    // Second, look up the object.  Only do so once, ever.
    return new Interpreter.State(node['right'], state.scope);
  }
  if (!state.isLoop) {
    // First iteration.
    state.isLoop = true;
    state.iter_ = new this.PropertyIterator(state.value);
  }
  // Third, find the property name for this iteration.
  if (state.name_ === undefined) {
    var next = state.iter_.next();
    if (next === undefined) {
      // Done, exit loop.
      stack.pop();
      return;
    }
    state.name_ = next;
  }
  // Fourth, find the variable
  if (!state.doneVariable_) {
    state.doneVariable_ = true;
    var left = node['left'];
    if (left['type'] === 'VariableDeclaration') {
      // Inline variable declaration: for (var x in y)
      state.variable_ =
          [Interpreter.SCOPE_REFERENCE, left['declarations'][0]['id']['name']];
    } else {
      // Arbitrary left side: for (foo().bar in y)
      state.variable_ = null;
      var nextState = new Interpreter.State(left, state.scope);
      nextState.components = true;
      return nextState;
    }
  }
  if (!state.variable_) {
    state.variable_ = state.value;
  }
  // Fifth, set the variable.
  var value = state.name_;
  this.setValue(state.scope, state.variable_, value);
  // Next step will be step three.
  state.name_ = undefined;
  // Only reevaluate LHS if it wasn't a variable.
  if (state.variable_[0] !== Interpreter.SCOPE_REFERENCE) {
    state.doneVariable_ = false;
  }
  // Sixth and finally, execute the body if there was one.
  if (node['body']) {
    return new Interpreter.State(node['body'], state.scope);
  }
  // TODO(cpcallen): in the absence of a body there is an unnecessary
  // step per iteration.  Fix that.
};

Interpreter.prototype['stepForStatement'] = function(stack, state, node) {
  var mode = state.mode_ || 0;
  if (mode === 0) {
    state.mode_ = 1;
    if (node['init']) {
      return new Interpreter.State(node['init'], state.scope);
    }
  } else if (mode === 1) {
    state.mode_ = 2;
    if (node['test']) {
      return new Interpreter.State(node['test'], state.scope);
    }
  } else if (mode === 2) {
    state.mode_ = 3;
    if (node['test'] && !state.value) {
      // Done, exit loop.
      stack.pop();
    } else {  // Execute the body.
      state.isLoop = true;
      return new Interpreter.State(node['body'], state.scope);
    }
  } else if (mode === 3) {
    state.mode_ = 1;
    if (node['update']) {
      return new Interpreter.State(node['update'], state.scope);
    }
  }
};

Interpreter.prototype['stepFunctionDeclaration'] =
    function(stack, state, node) {
  // This was found and handled when the scope was populated.
  stack.pop();
};

Interpreter.prototype['stepFunctionExpression'] = function(stack, state, node) {
  stack.pop();
  var src = this.thread.getSource();
  if(src === undefined) {
    throw Error("No source found when evaluating function expression??");
  }
  stack[stack.length - 1].value =
      this.createFunctionFromAST(node, state.scope, src);
};

Interpreter.prototype['stepIdentifier'] = function(stack, state, node) {
  stack.pop();
  var name = node['name'];
  var value = state.components ?
      [Interpreter.SCOPE_REFERENCE, name] :
      this.getValueFromScope(state.scope, name);
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepIfStatement'] =
    Interpreter.prototype['stepConditionalExpression'];

Interpreter.prototype['stepLabeledStatement'] = function(stack, state, node) {
  // No need to hit this node again on the way back up the stack.
  stack.pop();
  // Note that a statement might have multiple labels.
  var labels = state.labels || [];
  labels.push(node['label']['name']);
  var nextState = new Interpreter.State(node['body'], state.scope);
  nextState.labels = labels;
  return nextState;
};

Interpreter.prototype['stepLiteral'] = function(stack, state, node) {
  stack.pop();
  var value = node['value'];
  if (value instanceof RegExp) {
    var pseudoRegexp = new this.RegExp;
    pseudoRegexp.populate(value);
    value = pseudoRegexp;
  }
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepLogicalExpression'] = function(stack, state, node) {
  if (node['operator'] !== '&&' && node['operator'] !== '||') {
    throw SyntaxError('Unknown logical operator: ' + node['operator']);
  }
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    return new Interpreter.State(node['left'], state.scope);
  }
  if (!state.doneRight_ &&
      ((node['operator'] === '&&' && state.value) ||
      (node['operator'] === '||' && !state.value))) {
    // No short-circuit this time.
    state.doneRight_ = true;
    return new Interpreter.State(node['right'], state.scope);
  }
  stack.pop();
  stack[stack.length - 1].value = state.value;
};

Interpreter.prototype['stepMemberExpression'] = function(stack, state, node) {
  if (!state.doneObject_) {
    state.doneObject_ = true;
    return new Interpreter.State(node['object'], state.scope);
  }
  var propName;
  if (!node['computed']) {
    state.object_ = state.value;
    // obj.foo -- Just access 'foo' directly.
    propName = node['property']['name'];
  } else if (!state.doneProperty_) {
    state.object_ = state.value;
    // obj[foo] -- Compute value of 'foo'.
    state.doneProperty_ = true;
    return new Interpreter.State(node['property'], state.scope);
  } else {
    propName = state.value;
  }
  stack.pop();
  stack[stack.length - 1].value = state.components ?
      [state.object_, propName] : this.getProperty(state.object_, propName);
};

Interpreter.prototype['stepNewExpression'] =
    Interpreter.prototype['stepCallExpression'];

Interpreter.prototype['stepObjectExpression'] = function(stack, state, node) {
  var n = state.n_ || 0;
  var property = node['properties'][n];
  if (!state.object_) {
    // First execution.
    state.object_ = new this.Object;
  } else {
    // Determine property name.
    var key = property['key'];
    if (key['type'] === 'Identifier') {
      var propName = key['name'];
    } else if (key['type'] === 'Literal') {
      var propName = key['value'];
    } else {
      throw SyntaxError('Unknown object structure: ' + key['type']);
    }
    // Set the property computed in the previous execution.
    this.setProperty(state.object_, propName, state.value);
    state.n_ = ++n;
    property = node['properties'][n];
  }
  if (property) {
    if (property['kind'] !== 'init') {
      this.throwError(this.SYNTAX_ERROR, "Object kind: '" +
          property['kind'] + "'.  Getters and setters are not supported.");
    }
    return new Interpreter.State(property['value'], state.scope);
  }
  stack.pop();
  stack[stack.length - 1].value = state.object_;
};

Interpreter.prototype['stepProgram'] = function(stack, state, node) {
  var n = state.n_ || 0;
  var expression = node['body'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
};

Interpreter.prototype['stepReturnStatement'] = function(stack, state, node) {
  if (node['argument'] && !state.done_) {
    state.done_ = true;
    return new Interpreter.State(node['argument'], state.scope);
  }
  this.unwind_(Interpreter.Completion.RETURN, state.value, undefined);
};

Interpreter.prototype['stepSequenceExpression'] = function(stack, state, node) {
  var n = state.n_ || 0;
  var expression = node['expressions'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
  stack[stack.length - 1].value = state.value;
};

Interpreter.prototype['stepSwitchStatement'] = function(stack, state, node) {
  if (!state.test_) {
    state.test_ = 1;
    return new Interpreter.State(node['discriminant'], state.scope);
  }
  if (state.test_ === 1) {
    state.test_ = 2;
    // Preserve switch value between case tests.
    state.switchValue_ = state.value;
  }

  while (true) {
    var index = state.index_ || 0;
    var switchCase = node['cases'][index];
    if (!state.matched_ && switchCase && !switchCase['test']) {
      // Test on the default case is null.
      // Bypass (but store) the default case, and get back to it later.
      state.defaultCase_ = index;
      state.index_ = index + 1;
      continue;
    }
    if (!switchCase && !state.matched_ && state.defaultCase_) {
      // Ran through all cases, no match.  Jump to the default.
      state.matched_ = true;
      state.index_ = state.defaultCase_;
      continue;
    }
    if (switchCase) {
      if (!state.matched_ && !state.tested_ && switchCase['test']) {
        state.tested_ = true;
        return new Interpreter.State(switchCase['test'], state.scope);
      }
      if (state.matched_ || state.value === state.switchValue_) {
        state.matched_ = true;
        var n = state.n_ || 0;
        if (switchCase['consequent'][n]) {
          state.isSwitch = true;
          state.n_ = n + 1;
          return new Interpreter.State(
              switchCase['consequent'][n], state.scope);
        }
      }
      // Move on to next case.
      state.tested_ = false;
      state.n_ = 0;
      state.index_ = index + 1;
    } else {
      stack.pop();
      return;
    }
  }
};

Interpreter.prototype['stepThisExpression'] = function(stack, state, node) {
  stack.pop();
  stack[stack.length - 1].value = this.getValueFromScope(state.scope, 'this');
};

Interpreter.prototype['stepThrowStatement'] = function(stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    return new Interpreter.State(node['argument'], state.scope);
  }
  this.throwException(state.value);
};

Interpreter.prototype['stepTryStatement'] = function(stack, state, node) {
  if (!state.doneBlock_) {
    state.doneBlock_ = true;
    return new Interpreter.State(node['block'], state.scope);
  }
  if (state.cv && state.cv.type === Interpreter.Completion.THROW &&
      !state.doneHandler_ && node['handler']) {
    state.doneHandler_ = true;
    var nextState = new Interpreter.State(node['handler'], state.scope);
    nextState.throwValue = state.cv.value;
    state.cv = undefined;  // This error has been handled, don't rethrow.
    return nextState;
  }
  if (!state.doneFinalizer_ && node['finalizer']) {
    state.doneFinalizer_ = true;
    return new Interpreter.State(node['finalizer'], state.scope);
  }
  // Regardless of whether we are exiting normally or about to resume
  // unwinding the stack, we are done with this TryStatement and do
  // not want to examine it again.
  stack.pop();
  if (state.cv) {
    // There was no catch handler, or the catch/finally threw an
    // error.  Resume unwinding the stack in search of TryStatement /
    // CallExpression / target of break or continue.
    this.unwind_(state.cv.type, state.cv.value, state.cv.label);
  }
};

Interpreter.prototype['stepUnaryExpression'] = function(stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    var nextState = new Interpreter.State(node['argument'], state.scope);
    nextState.components = (node['operator'] === 'delete');
    return nextState;
  }
  stack.pop();
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
    // Expect result of evaluating argument to be reference components
    // array.  If not, skip delete and return true.
    if (!Array.isArray(value)) {
      value = true;
    } else {
      var obj = value[0];
      var key = value[1];
      if (obj instanceof this.Object) {
        try {
          value = delete obj.properties[key];
        } catch (e) {
          this.throwNativeException(e);
        }
      } else if (obj instanceof Interpreter.Sentinel) {
        // Whoops; this should have been caught by Acorn (because strict).
        throw Error('Uncaught illegal deletion of unqualified identifier');
      } else {
        // Attempting to delete property from primitive value.
        if (Object.getOwnPropertyDescriptor(obj, key)) {
          this.throwError(this.TYPE_ERROR,
              "Cannot delete property '" + key + "' from primitive.");
        } else {
          value = true;
        }
      }
    }
  } else if (node['operator'] === 'typeof') {
    value = (value instanceof this.Function) ? 'function' : typeof value;
  } else if (node['operator'] === 'void') {
    value = undefined;
  } else {
    throw SyntaxError('Unknown unary operator: ' + node['operator']);
  }
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepUpdateExpression'] = function(stack, state, node) {
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    var nextState = new Interpreter.State(node['argument'], state.scope);
    nextState.components = true;
    return nextState;
  }
  if (!state.leftSide_) {
    state.leftSide_ = state.value;
  }
  state.leftValue_ = this.getValue(state.scope, state.leftSide_);
  var leftValue = Number(state.leftValue_);
  var changeValue;
  if (node['operator'] === '++') {
    changeValue = leftValue + 1;
  } else if (node['operator'] === '--') {
    changeValue = leftValue - 1;
  } else {
    throw SyntaxError('Unknown update expression: ' + node['operator']);
  }
  var returnValue = node['prefix'] ? changeValue : leftValue;
  this.setValue(state.scope, state.leftSide_, changeValue);
  stack.pop();
  stack[stack.length - 1].value = returnValue;
};

Interpreter.prototype['stepVariableDeclaration'] =
    function(stack, state, node) {
  var declarations = node['declarations'];
  var n = state.n_ || 0;
  var declarationNode = declarations[n];
  if (state.init_ && declarationNode) {
    // Note that this is setting the init value, not defining the variable.
    // Variable definition (addVariableToScope) is done when scope is populated.
    this.setValueToScope(state.scope, declarationNode['id']['name'],
        state.value);
    state.init_ = false;
    declarationNode = declarations[++n];
  }
  while (declarationNode) {
    // Skip any declarations that are not initialized.  They have already
    // been defined as undefined in populateScope_.
    if (declarationNode['init']) {
      state.n_ = n;
      state.init_ = true;
      return new Interpreter.State(declarationNode['init'], state.scope);
    }
    declarationNode = declarations[++n];
  }
  stack.pop();
};

Interpreter.prototype['stepWithStatement'] = function(stack, state, node) {
  this.throwError(this.SYNTAX_ERROR,
      'Strict mode code may not include a with statement');
};

Interpreter.prototype['stepWhileStatement'] =
    Interpreter.prototype['stepDoWhileStatement'];

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
    acornNode.bind(acorn, { options: Interpreter.PARSE_OPTIONS });
Interpreter.Node.prototype = acornNode.prototype;
