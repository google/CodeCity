/**
 * @license
 * Copyright 2013 Google LLC
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

var events = require('events');
var IterableWeakMap = require('./iterable_weakmap');
var net = require('net');
var http = require('http');
var https = require('https');
var parser = require('./parser');
var Registry = require('./registry');

var Node = parser.Node;
var Parser = parser.Parser;

/**
 * Version number for the serialisation format.  MUST be incremented
 * when any change is made to the implementation of Interpreter and
 * related classes (in this file and others) which would change how
 * the runtime state is represented on disk.
 * @type {number}
 */
var SERIALIZATION_VERSION = 1;

/**
 * Create a new interpreter.
 * @constructor
 * @struct
 * @param {!Interpreter.Options=} options
 */
var Interpreter = function(options) {
  /** @type {!Interpreter.Options} */
  this.options = options || {};
  /**
   * Serialisation version for this Interpreter instance.  Will be set
   * to SERIALIZATION_VERSION, but not here, because there exist .city
   * files that have no .serlizationVersion in them, and loading one
   * won't overwrite what we set here.  Instead, set it in
   * .preSerialize, and check in in .postDeserialize.
   * @type {number|undefined}
   */
  this.serializationVersion = undefined;
  // Install .Object, .Function, etc.
  this.installTypes();
  /**
   * Registry of builtins - e.g. Object, Function.prototype, Array.pop, etc.
   * @const {!Registry<?Interpreter.Value>}
   */
  this.builtins = new Registry;
  /**
   * For cycle detection in Array.prototype.toString; see spec bug
   * github.com/tc39/ecma262/issues/289.  (Also used in
   * Error.prototype.toString, which has same issue.)  Since these
   * functions are atomic (i.e., take place entirely within the
   * duration of a single call to .step) and do not call user code
   * which could suspend, it's fine that it's not per-Thread.
   * @private @const {!Set<!Interpreter.prototype.Object>}
   */
  this.toStringVisited_ = new Set;

  /**
   * The interpreter's global scope.
   * @const {!Interpreter.Scope}
   */
  this.global = new Interpreter.Scope(Interpreter.Scope.Type.GLOBAL,
      /** @type {?} */ (undefined), null, undefined);

  // Declare properties that wil be initialised by initBuiltins_.
  /** @type {!Interpreter.prototype.Object} */ this.OBJECT;
  /** @type {!Interpreter.Owner} */ this.ROOT;
  /** @type {!Interpreter.prototype.Function} */ this.FUNCTION;
  /** @type {!Interpreter.prototype.Array} */ this.ARRAY;
  /** @type {!Interpreter.prototype.Object} */ this.STRING;
  /** @type {!Interpreter.prototype.Object} */ this.BOOLEAN;
  /** @type {!Interpreter.prototype.Object} */ this.NUMBER;
  /** @type {!Interpreter.prototype.Object} */ this.DATE;
  /** @type {!Interpreter.prototype.Object} */ this.REGEXP;
  /** @type {!Interpreter.prototype.Error} */ this.ERROR;
  /** @type {!Interpreter.prototype.Error} */ this.EVAL_ERROR;
  /** @type {!Interpreter.prototype.Error} */ this.RANGE_ERROR;
  /** @type {!Interpreter.prototype.Error} */ this.REFERENCE_ERROR;
  /** @type {!Interpreter.prototype.Error} */ this.SYNTAX_ERROR;
  /** @type {!Interpreter.prototype.Error} */ this.TYPE_ERROR;
  /** @type {!Interpreter.prototype.Error} */ this.URI_ERROR;
  /** @type {!Interpreter.prototype.Error} */ this.PERM_ERROR;
  /** @type {!Interpreter.prototype.Object} */ this.WEAKMAP;
  /** @type {!Interpreter.prototype.Object} */ this.THREAD;
  /** @type {!Interpreter.Owner} */ this.ANYBODY;

  // Create builtins and (minimally) initialize global scope:
  this.initBuiltins_();

  /** @private @const {!Array<!Interpreter.Thread>} */
  this.threads_ = [];
  /** @private @type {?Interpreter.Thread} */
  this.thread_ = null;
  /** @private @type {number|undefined} */
  this.threadTimeLimit_ = undefined;
  /** @private (Type is whatever is returned by setTimeout()) */
  this.runner_ = null;
  /** @type {boolean} */
  this.done = true;  // True if no non-ZOMBIE threads exist.

  // TODO(cpcallen): rename this to .listeners
  /** @const {!Object<number, !Interpreter.prototype.Server>} */
  this.listeners_ = Object.create(null);

  // TODO(cpcallen): This is an ugly hack to allow the serialiser to
  // know the names of step functions in an otherwise-empty
  // interpreter.  Find a better way to do this.
  /** @const {!Object<string, !Interpreter.StepFunction>} */
  this.stepFuncs = stepFuncs_;

  // Bring interpreter up to PAUSED status, setting up timers etc.
  /** @type {!Interpreter.Status} */
  this.status = Interpreter.Status.STOPPED;
  /** @private @type {number} */
  this.previousTime_ = 0;
  /** @private @type {number} */
  this.cumulativeTime_ = 0;
  /** @private @type {!Array<number>} */
  this.hrStartTime_;  // Initialised by pause.

  this.pause();
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
 * Create a new thread and add it to .threads_, and create a companion
 * user-visible wrapper object and return it.
 * @param {!Interpreter.Owner} owner Owner of new thread.
 * @param {!Interpreter.State} state Initial state
 * @param {number=} runAt Time at which thread should begin execution
 *     (default: now).
 * @param {number=} timeLimit Maximum runtime without suspending (in ms).
 * @return {!Interpreter.prototype.Thread} Userland Thread object.
 */
Interpreter.prototype.createThread = function(owner, state, runAt, timeLimit) {
  var id = this.threads_.length;
  var thread =
      new Interpreter.Thread(id, state, runAt || this.now(), timeLimit);
  this.threads_[this.threads_.length] = thread;
  this.go_();
  return new this.Thread(thread, owner);
};

/**
 * Create a new thread to execute arbitrary JavaScript code.  Thread
 * will have specified owner, but code will be evaluated directly in
 * global scope and will consequently runs wit whatever permissions
 * the global scope has.
 * @param {string} src JavaScript source code to parse and run.
 * @param {number=} timeLimit Maximum runtime without suspending (in ms).
 * @return {!Interpreter.prototype.Thread} Userland Thread object.
 */
Interpreter.prototype.createThreadForSrc = function(src, timeLimit) {
  if (typeof src !== 'string') throw new TypeError('src must be a string');
  if (this.options.trimProgram) {
    src = src.trim();
  }
  var ast = this.compile_(src);
  this.populateScope_(ast, this.global);
  var state = new Interpreter.State(ast, this.global);
  return this.createThread(this.ROOT, state, undefined, timeLimit);
};

/**
 * Create a new thread to execute a particular function call.
 * @param {!Interpreter.Owner} owner Owner of new thread; also becomes
 *     caller perms of function.
 * @param {!Interpreter.prototype.Function} func Function to call.
 * @param {?Interpreter.Value} thisVal value of 'this' in function call.
 * @param {!Array<?Interpreter.Value>} args Arguments to pass.
 * @param {number=} runAt Time at which thread should begin execution
 *     (default: now).
 * @param {number=} timeLimit Maximum runtime without suspending (in ms).
 * @return {!Interpreter.prototype.Thread} Userland Thread object.
 */
Interpreter.prototype.createThreadForFuncCall = function(
    owner, func, thisVal, args, runAt, timeLimit) {
  var state = Interpreter.State.newForCall(func, thisVal, args, owner);
  return this.createThread(owner, state, runAt, timeLimit);
};

/**
 * Schedule the next runnable thread.  Returns 0 if a READY thread
 * successfuly scheduled (or if the current thread was already
 * runnable, which can happen when interpreter has just been
 * deserialised); otherwise returns earliest .runAt time
 * amongst SLEEPING threads (if any), or Number.MAX_VALUE if there are
 * none.  If there are additionally no BLOCKED threads left (i.e.,
 * there are no non-ZOMBIE theads at all) it will also set .done to
 * true.
 * @return {number} See description.
 */
Interpreter.prototype.schedule = function() {
  if (this.thread_ && this.thread_.status === Interpreter.Thread.Status.READY) {
    return 0;  // Nothing to do.  Don't reset .threadTimeLimit_!
  }
  var now = this.now();
  var runAt = Number.MAX_VALUE;
  var threads = this.threads_;
  // Assume all remaining threads are ZOMBIEs until proven otherwise.
  this.done = true;
  this.thread_ = null;
  // .threads_ will be very sparse, so use for-in loop.
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
          this.thread_ = threads[i];
          runAt = this.thread_.runAt;
        }
        this.done = false;
        break;
      default:
        throw new Error('Unknown thread state');
    }
  }
  this.threadTimeLimit_ = (this.thread_ && this.thread_.timeLimit) ?
      now + this.thread_.timeLimit : undefined;
  return runAt < now ? 0 : runAt;
};

/**
 * Execute one step of the interpreter.  Schedules the next runnable
 * thread if required.
 * @return {boolean} True if a step was executed, false if no more
 *     READY threads.
 */
Interpreter.prototype.step = function() {
  /* NOTE: Beware that an async (user) Function might reject
   * immediately, unwinding the stack before the Call step function
   * returns.
   */
  if (this.status !== Interpreter.Status.PAUSED) {
    throw new Error('Can only step paused interpreter');
  }
  if (!this.thread_ ||
      this.thread_.status !== Interpreter.Thread.Status.READY) {
    if (this.schedule() > 0) {
      return false;
    }
  }
  if (!this.thread_) throw new Error('Scheduling failed');  // Satisfy compiler.
  this.step_(this.thread_, this.thread_.stateStack_);
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
   * immediately, unwinding the stack before the Call step function
   * returns.
   */
  if (this.status === Interpreter.Status.STOPPED) {
    throw new Error("Can't run stopped interpreter");
  }
  var t;
  while ((t = this.schedule()) === 0) {
    var thread = this.thread_;
    var stack = thread.stateStack_;
    while (thread.status === Interpreter.Thread.Status.READY) {
      this.step_(thread, stack);
    }
  }
  if (t === Number.MAX_VALUE) {
    return this.done ? 0 : -1;
  }
  return t;
};

/**
 * Actually execute one step of the interpreter.  Presumes thread is
 * the currently-scheduled thread, is runnable, etc.
 * @private
 * @param {!Interpreter.Thread} thread The current thread.
 * @param {!Array<!Interpreter.State>} stack The current thread's state stack.
 */
Interpreter.prototype.step_ = function(thread, stack) {
  var state = stack[stack.length - 1];
  var node = state.node;
  try {
    var nextState = state.stepFunc.call(this, thread, stack, state, node);
  } catch (e) {
    this.throw_(thread, e, state.scope.perms);
    nextState = undefined;
  }
  if (nextState) {
    stack[stack.length] = nextState;
  }
  if (stack.length === 0) {
    thread.status = Interpreter.Thread.Status.ZOMBIE;
  }
};

/**
 * If interpreter status is RUNNING, use setTimeout to arrange for
 * .run() to be called repeatedly until there are no more sleeping
 * threads.
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
      throw new Error('Un-cancelled runner on non-RUNNING interpreteter');
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
        server.listen(function(error) {
          if (!error) return;
          // Something went wrong while re-listening.  Maybe port in use.
          intrp.log('net', 'Re-listen on port %s failed: %s: %s', server.port,
                    error.name, error.message);
          // Report this to userland by calling .onError on proto
          // (with this === proto) - for lack of a better option.
          if (!server.owner) return;
          var func = server.proto.get('onError', server.owner);
          if (!(func instanceof intrp.Function)) return;
          var userError = intrp.errorNativeToPseudo(error, server.owner);
          // TODO(cpcallen:perms): Is server.owner the correct owner
          // for this thread?  Note that this will typically be root,
          // and .onError will therefore get caller perms === root,
          // which is probably dangerous.
          intrp.createThreadForFuncCall(
              server.owner, func, server.proto, [userError],
              undefined, server.timeLimit);
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
 * Prepare an interpreter to be seralized.
 */
Interpreter.prototype.preSerialize = function() {
  // As noted in constructor: set .seralizationVersion only just
  // before serialising, so as to avoid mistaking old, un-versioned
  // .city files for the current version.
  this.serializationVersion = SERIALIZATION_VERSION;
};

/**
 * Prepare an interpreter to run after being deseralized.
 */
Interpreter.prototype.postDeserialize = function() {
  // Check to make sure deseralised interpreter is compatible with the
  // current implementation.
  if (this.serializationVersion !== SERIALIZATION_VERSION) {
    throw new Error('version error: seralized interpreter was version ' +
        this.serializationVersion + '; current version is ' +
        SERIALIZATION_VERSION);
  }
  // Checkpointed interpreter was probably paused, but because we're
  // restoring from a checkpoint the resurrected interpreter is
  // actually stopped (i.e., with no listening sockets, and with
  // questionable timer state information).
  this.status = Interpreter.Status.STOPPED;
};

/**
 * Convert source code into a ready-to-execute parse tree.
 * @private
 * @param {string} src The source code to be compiled.
 * @param {!Interpreter.Owner=} perms Re-throw parse errors as
 *     user errors owned by perms.  (Default: re-throw parse
 *     errors as internal (native) errors.)
 * @return {!Node} node Root AST node.
 */
Interpreter.prototype.compile_ = function(src, perms) {
  try {
    var ast = Parser.parse(src);
  } catch (e) {  // Acorn threw a SyntaxError.  Rethrow as a trappable error?
    throw perms ? this.errorNativeToPseudo(e, perms) : e;
  }

  (function analyse(node) {
    for (var name in node) {  // Recursively analyse subtrees.
      var prop = node[name];
      if (prop && typeof prop !== 'object') continue;
      if (Array.isArray(prop)) {
        for (var i = 0; i < prop.length; i++) {
          if (prop[i] && prop[i] instanceof Node) {
            analyse(prop[i]);
          }
        }
      } else {
        if (prop instanceof Node) {
          analyse(prop);
        }
      }
    }
    // Populate props on this node.
    node['stepFunc'] = stepFuncs_[node['type']];
  })(ast);

  ast['source'] = new Interpreter.Source(src);
  return ast;
};

/**
 * Create and register the builtin classes and functions specified in
 * the ECMAScript specification plus our extensions.  Add a few items
 * (e.g., eval) to the global scope that can't be added any other way.
 * @private
 */
Interpreter.prototype.initBuiltins_ = function() {
  // Initialize uneditable global properties.
  this.global.createImmutableBinding('NaN', NaN);
  this.global.createImmutableBinding('Infinity', Infinity);
  this.global.createImmutableBinding('undefined', undefined);

  // Create the objects which will become Object.prototype and
  // Function.prototype, which are needed to bootstrap everything else.
  this.OBJECT = new this.Object(null, null);
  this.builtins.set('Object.prototype', this.OBJECT);

  // Create the object that will own all of the system objects.
  var root = new this.Object(null, this.OBJECT);
  this.ROOT = /** @type {!Interpreter.Owner} */ (root);
  this.builtins.set('CC.root', root);
  this.global.perms = this.ROOT;
  // Retroactively apply root ownership to Object.prototype:
  this.OBJECT.owner = this.ROOT;

  // NativeFunction constructor adds new function to the map of builtins.
  this.FUNCTION = new this.NativeFunction({
    id: 'Function.prototype', name: '', length: 0, proto: this.OBJECT,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {/* do nothing */}
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
  var eval_ = new this.NativeFunction({
    id: 'eval', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var code = args[0];
      var perms = state.scope.perms;
      if (intrp.options.trimEval) {
        code = code.trim();
      }
      if (typeof code !== 'string') {  // eval()
        // Eval returns the argument if the argument is not a string.
        // eval(Array) -> Array
        return code;
      }
      var ast = intrp.compile_(code, perms);
      // Change node type from Program to EvalProgram_.
      ast['type'] = 'EvalProgram_';
      ast['stepFunc'] = stepFuncs_['EvalProgram_'];
      // Create new scope and update it with definitions in eval().
      var outerScope = state.info_.directEval ? state.scope : intrp.global;
      var scope =
          new Interpreter.Scope(Interpreter.Scope.Type.EVAL, perms, outerScope);
      intrp.populateScope_(ast, scope);
      thread.stateStack_[thread.stateStack_.length] =
          new Interpreter.State(ast, scope);
      thread.value = undefined;  // In case no ExpressionStatements evaluated.
      return Interpreter.FunctionResult.AwaitValue;
    }
  });
  // eval is a special case; it must be added to the global scope at
  // startup time (rather than by a "var eval = new 'eval';" statement
  // in es5.js) because assigning to eval is illegal in strict mode.
  // This also means that it is effectively immutable despite being
  // created with createMutableBinding.
  this.global.createMutableBinding('eval', eval_);

  this.createNativeFunction('isFinite', isFinite, false);
  this.createNativeFunction('isNaN', isNaN, false);
  this.createNativeFunction('parseFloat', parseFloat, false);
  this.createNativeFunction('parseInt', parseInt, false);

  var strFunctions = [
    [escape, 'escape'], [unescape, 'unescape'],
    [decodeURI, 'decodeURI'], [decodeURIComponent, 'decodeURIComponent'],
    [encodeURI, 'encodeURI'], [encodeURIComponent, 'encodeURIComponent']
  ];
  var intrp = this;
  for (var i = 0; i < strFunctions.length; i++) {
    var wrapper = (function(nativeFunc) {
      return function(str) {
        try {
          return nativeFunc(str);
        } catch (e) {
          // decodeURI('%xy') will throw an error.  Catch and rethrow.
          throw intrp.errorNativeToPseudo(e, intrp.thread_.perms());
        }
      };
    })(strFunctions[i][0]);
    this.createNativeFunction(strFunctions[i][1], wrapper, false);
  }

  // Initialize CC-specific globals.
  this.initThread_();
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
            'boxed primitives not supported');
      } else if (value === undefined || value === null) {
        return new intrp.Object(state.scope.perms);
      } else {
        throw new TypeError('Unknown value type??');
      }
    },
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return this.construct.call(this, intrp, thread, state, args);
    }
  });

  // Static methods on Object.
  this.createNativeFunction('Object.is', Object.is, false);

  new this.NativeFunction({
    id: 'Object.getOwnPropertyNames', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = state.scope.perms;
      // N.B.: we use ES6 definition; ES5.1 would throw TypeError if
      // passed a non-object.
      var obj = intrp.toObject(args[0], perms);
      return intrp.createArrayFromList(obj.ownKeys(perms), perms);
    }
  });

  new this.NativeFunction({
    id: 'Object.keys', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = state.scope.perms;
      var obj = intrp.toObject(args[0], perms);
      var keys = obj.ownKeys(perms);
      var enumerableKeys = [];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var pd = obj.getOwnPropertyDescriptor(key, perms);
        if (pd.enumerable) enumerableKeys.push(key);
      }
      return intrp.createArrayFromList(enumerableKeys, perms);
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
      // N.B.: This conforms to ES6.  ES5.1 would throw TypeError for
      // Object.getPrototypeOf(<boolean, string or number>)
      var o = intrp.toObject(args[0], state.scope.perms);
      return o.proto;
    }
  });

  new this.NativeFunction({
    id: 'Object.setPrototypeOf', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      var proto = args[1];
      var perms = state.scope.perms;
      if (obj === null || obj === undefined) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'Object.setPrototypeOf called on null or undefined');
      }
      if (proto !== null && !(proto instanceof intrp.Object)) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'Object prototype may only be an Object or null');
      }
      if (obj instanceof intrp.Object) {
        // obj.setPrototypeOf handles security and circularity checks.
        if (!obj.setPrototypeOf(proto, perms)) {
          throw new intrp.Error(perms, intrp.TYPE_ERROR,
              'setPrototypeOf failed');
        }
      }
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

  // Properties of the Object prototype object.
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
      var v = args[0];
      if (!(v instanceof intrp.Object)) return false;
      var o = intrp.toObject(thisVal, state.scope.perms);
      while (true) {
        v = v.proto;
        if (v === null) return false;  // No parent; reached the top.
        if (o === v) return true;
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
  // Function constructor.
  new this.NativeFunction({
    id: 'Function', length: 1,
    /** @type {!Interpreter.NativeConstructImpl} */
    construct: function(intrp, thread, state, args) {
      args = args.slice();  // Copy, so we can .pop safely.
      var body = args.length ? String(args.pop()) : '';
      // Concatenate formal parameter names.  Let Acorn verify they
      // are valid Identifiers.
      var argsStr = args.map(function(arg) {return String(arg);}).join(',');
      // Acorn needs to parse body in the context of a function or
      // else 'return' statements will be syntax errors.  The name
      // "anonymous" and extra line breaks were standardised in ES2019
      // via https://tc39.es/Function-prototype-toString-revision/
      var source = '(function anonymous(' + argsStr + '\n) {\n' + body + '\n})';
      var ast = intrp.compile_(source, state.scope.perms);
      if (ast['body'].length !== 1) {
        // Function('a', 'return a + 6;}; {alert(1);');
        // TODO: there must be a cleaner way to detect this!
        throw new intrp.Error(state.scope.perms, intrp.SYNTAX_ERROR,
            'Invalid code in function body');
      }
      // Interestingly, the scope for constructed functions is the global
      // scope, even if they were constructed in some other scope.
      return new intrp.UserFunction(ast['body'][0]['expression'],
          intrp.global, new Interpreter.Source(source), state.scope.perms);
    },
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return this.construct.call(this, intrp, thread, state, args);
    }
  });

  // Properties of the Function prototype object.
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
        var argList = [];
      } else {
        argList = intrp.createListFromArrayLike(argArray, perms);
      }
      // Rewrite state.info_, as a short-circuit optimisation in case
      // we get called again due to FunctionResult.CallAgain, and also
      // to produce more useful callers() output / stack traces.
      var info = state.info_;
      info.func = func;
      info.this = thisArg;
      info.args = argList;
      info.construct = false;
      // But just go and do the first .call directly.
      return func.call(intrp, thread, state, thisArg, argList);
    }
  });

  new this.NativeFunction({
    id: 'Function.prototype.bind', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var target = thisVal;
      if (!(target instanceof intrp.Function)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            target + ' is not a function');
      }
      var thisArg = args[0];
      var argList = args.slice(1);
      var perms = state.scope.perms;
      var f = new intrp.BoundFunction(target, thisArg, argList, perms);
      var len = 0;
      if (target.has('length', perms)) {
        var targetLen = target.get('length', perms);
        if (typeof targetLen === 'number') {
          len = Math.max(0, targetLen - argList.length);
        }
      }
      f.defineProperty('length', Descriptor.c.withValue(len), perms);
      var targetName = target.get('name', perms);
      if (typeof targetName !== 'string') {
        targetName = '';
      }
      f.setName(targetName, 'bound');
      return f;
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
      // Rewrite state.info_, as a short-circuit optimisation in case
      // we get called again due to FunctionResult.CallAgain, and also
      // to produce more useful callers() output / stack traces.
      var info = state.info_;
      info.func = func;
      info.this = thisArg;
      info.args = argList;
      info.construct = false;
      // But just go and do the first .call directly.
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
  this.builtins.set('Array.prototype', this.ARRAY);

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

  // Static methods on Array.
  new this.NativeFunction({
    id: 'Array.isArray', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return args[0] instanceof intrp.Array;
    }
  });

  // Properties of the Array prototype object.
  new this.NativeFunction({
    id: 'Array.prototype.concat', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var arr = new intrp.Array(perms);
      var n = 0;

      var doConcat = function(item) {
        // TODO(ES6): IsConcatSpreadable?
        if (item instanceof intrp.Array) {  // Add elements of item.
          var len = Interpreter.toLength(item.get('length', perms));
          if (len + n > Number.MAX_SAFE_INTEGER) {
            throw new intrp.Error(perms, intrp.TYPE_ERROR, 'Concatenating ' +
                len + ' elements on an array-like of length ' + n +
                ' is disallowed, as the total surpasses 2**53-1');
          }
          for (var k = 0; k < len; n++, k++) {
            var kP = String(k);
            if (item.has(kP, perms)) {
              arr.defineProperty(String(n),
                  Descriptor.wec.withValue(item.get(kP, perms)), perms);
            }
          }
        } else {  // Add item as single element, rather than spread.
          if (n >= Number.MAX_SAFE_INTEGER) {
            throw new intrp.Error(perms, intrp.TYPE_ERROR,
                'Concatenating onto an array-like of length ' + n +
                ' is disallowed, as the total surpasses 2**53-1');
          }
          arr.defineProperty(
              String(n++), Descriptor.wec.withValue(item), perms);
        }
      };

      doConcat(thisVal);
      for (var i = 0; i < args.length; i++) {
        doConcat(args[i]);
      }
      arr.set('length', n, perms);
      return arr;
    }
  });

  new this.NativeFunction({
    id: 'Array.prototype.includes', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var searchElement = args[0];
      var fromIndex = args[1];
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var len = Interpreter.toLength(obj.get('length', perms));
      if (len === 0) return false;
      var n = (fromIndex === undefined ? 0 : Interpreter.toInteger(fromIndex));
      if (n >= len) return false;
      var k = (n >= 0) ? n : Math.max(len - Math.abs(n), 0);
      for (; k < len; k++) {
        if (obj.has(String(k), perms)) {
          var v = obj.get(String(k), perms);
          if (v === searchElement ||
              (Number.isNaN(/** @type{?} */(v)) &&
               Number.isNaN(/** @type{?} */(searchElement)))) {
            return true;
          }
        }
      }
      return false;
    }
  });

  new this.NativeFunction({
    id: 'Array.prototype.indexOf', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var searchElement = args[0];
      var fromIndex = args[1];
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var len = Interpreter.toLength(obj.get('length', perms));
      if (len === 0) return -1;
      var n = (fromIndex === undefined ? 0 : Interpreter.toInteger(fromIndex));
      if (n >= len) return -1;
      var k = (n >= 0) ? n : Math.max(len - Math.abs(n), 0);
      for (; k < len; k++) {
        if (obj.has(String(k), perms) &&
            obj.get(String(k), perms) === searchElement) {
          return k;
        }
      }
      return -1;
    }
  });

  new this.NativeFunction({
    id: 'Array.prototype.lastIndexOf', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var searchElement = args[0];
      var fromIndex = args[1];
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var len = Interpreter.toLength(obj.get('length', perms));
      if (len === 0) return -1;
      var n = (fromIndex === undefined) ? len - 1 :
          Interpreter.toInteger(fromIndex);
      var k = (n >= 0) ? Math.min(n, len - 1) : len - Math.abs(n);
      for (; k >= 0 ; k--) {
        if (obj.has(String(k), perms) &&
            obj.get(String(k), perms) === searchElement) {
          return k;
        }
      }
      return -1;
    }
  });

  new this.NativeFunction({
    id: 'Array.prototype.pop', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var len = Interpreter.toLength(obj.get('length', perms));
      if (len === 0) {
        obj.set('length', 0, perms);
        return undefined;
      }
      var newLen = len - 1;
      var element = obj.get(String(newLen), perms);
      obj.deleteProperty(String(newLen), perms);
      obj.set('length', newLen, perms);
      return element;
    }
  });

  new this.NativeFunction({
    id: 'Array.prototype.push', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var len = Interpreter.toLength(obj.get('length', perms));
      var argCount = args.length;
      if (len + args.length > Number.MAX_SAFE_INTEGER) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR, 'Pushing ' + argCount +
              ' elements on an array-like of length ' + len +
              ' is disallowed, as the total surpasses 2**53-1');
      }
      for (var i = 0; i < argCount; i++) {
        obj.set(String(len++), args[i], perms);
      }
      obj.set('length', len, perms);
      return len;
    }
  });

  new this.NativeFunction({
    id: 'Array.prototype.reverse', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var len = Interpreter.toLength(obj.get('length', perms));
      var middle = Math.floor(len / 2);
      for (var lower = 0; lower < middle; lower++) {
        var upper = len - lower - 1;
        var upperP = String(upper);
        var lowerP = String(lower);
        var lowerExists = obj.has(lowerP, perms);
        if (lowerExists) {
          var lowerValue = obj.get(lowerP, perms);
        }
        var upperExists = obj.has(upperP, perms);
        if (upperExists) {
          var upperValue = obj.get(upperP, perms);
        }
        if (lowerExists && upperExists) {
          obj.set(lowerP, upperValue, perms);
          obj.set(upperP, lowerValue, perms);
        } else if (!lowerExists && upperExists) {
          obj.set(lowerP, upperValue, perms);
          obj.deleteProperty(upperP, perms);
        } else if (lowerExists && !upperExists) {
          obj.deleteProperty(lowerP, perms);
          obj.set(upperP, lowerValue, perms);
        }  // else neither exist, and no action required.
      }
      // ES spec would have us return obj, which would be a boxed
      // primitive (Boolean, Number or String object) if thisVal was a
      // number, boolean or the empty string.  We decline to do that.
      // (Note that nonempty strings will already have thrown
      // TypeError due to non-writable properties.)
      return thisVal;
    }
  });

  new this.NativeFunction({
    id: 'Array.prototype.shift', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var len = Interpreter.toLength(obj.get('length', perms));
      if (len === 0) {
        obj.set('length', 0, perms);
        return undefined;
      }
      var first = obj.get('0', perms);
      for (var k = 1; k < len; k++) {
        var from = String(k);
        var to = String(k - 1);
        if (obj.has(from, perms)) {
          obj.set(to, obj.get(from, perms), perms);
        } else {
          obj.deleteProperty(to, perms);
        }
      }
      obj.deleteProperty(String(len - 1), perms);
      obj.set('length', len - 1, perms);
      return first;
    }
  });

  new this.NativeFunction({
    id: 'Array.prototype.slice', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var start = args[0];
      var end = args[1];
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var len = Interpreter.toLength(obj.get('length', perms));
      var relativeStart = Interpreter.toInteger(start);
      var k = (relativeStart < 0) ? Math.max(len + relativeStart, 0) :
          Math.min(relativeStart, len);
      var relativeEnd = (end === undefined) ? len : Interpreter.toInteger(end);
      var final = (relativeEnd < 0) ? Math.max(len + relativeEnd, 0) :
          Math.min(relativeEnd, len);
      // TODO(cpcallen): ArraySpeciesCreate should take count as an argument.
      // var count = Math.max(final - k, 0);
      var arr = new intrp.Array(perms);
      for (var n = 0; k < final; k++, n++) {
        var kP = String(k);
        if (obj.has(kP, perms)) {
          arr.defineProperty(
              String(n), Descriptor.wec.withValue(obj.get(kP, perms)), perms);
        }
      }
      arr.set('length', n, perms);
      return arr;
    }
  });

  new this.NativeFunction({
    id: 'Array.prototype.splice', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var start = args[0];
      var deleteCount = args[1];
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var len = Interpreter.toLength(obj.get('length', perms));
      var relativeStart = Interpreter.toInteger(start);
      var actualStart = relativeStart < 0 ? Math.max(len + relativeStart, 0) :
          Math.min(relativeStart, len);
      if (args.length === 0) {
        var insertCount = 0;
        var actualDeleteCount = 0;
      } else if (args.length === 1) {
        insertCount = 0;
        actualDeleteCount = len - actualStart;
      } else {
        insertCount = args.length - 2;
        var dc = Interpreter.toInteger(deleteCount);
        actualDeleteCount = Math.min(Math.max(dc, 0), len - actualStart);
      }
      if (len + insertCount - actualDeleteCount > Number.MAX_SAFE_INTEGER) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR, 'Splicing ' +
            insertCount - actualDeleteCount +
            ' elements on an array-like of length ' + len +
            ' is disallowed, as the total surpasses 2**53-1');
      }
      var arr = new intrp.Array(perms);
      for (var k = 0; k < actualDeleteCount; k++) {
        var from = String(actualStart + k);
        if (obj.has(from, perms)) {
          arr.defineProperty(
              String(k), Descriptor.wec.withValue(obj.get(from, perms)), perms);
        }
      }
      arr.set('length', actualDeleteCount, perms);
      var itemCount = Math.max(args.length - 2, 0);
      if (itemCount < actualDeleteCount) {
        for (k = actualStart; k < len - actualDeleteCount; k++) {
          from = String(k + actualDeleteCount);
          var to = String(k + itemCount);
          if (obj.has(from, perms)) {
            obj.set(to, obj.get(from, perms), perms);
          } else {
            obj.deleteProperty(to, perms);
          }
        }
        for (k = len; k > len - actualDeleteCount + itemCount; k--) {
          obj.deleteProperty(String(k - 1), perms);
        }
      } else if (itemCount > actualDeleteCount) {
        for (k = len - actualDeleteCount; k > actualStart; k--) {
          from = String(k + actualDeleteCount - 1);
          to = String(k + itemCount - 1);
          if (obj.has(from, perms)) {
            obj.set(to, obj.get(from, perms), perms);
          } else {
            obj.deleteProperty(to, perms);
          }
        }
      }
      for (var j = 2, k = actualStart; j < args.length; j++, k++) {
        obj.set(String(k), args[j], perms);
      }
      obj.set('length', len - actualDeleteCount + itemCount, perms);
      return arr;
    }
  });

  new this.NativeFunction({
    id: 'Array.prototype.toString', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var join = obj.get('join', perms);
      if (join instanceof intrp.Function) {
        var func = join;
      } else {
        func = /** @type {!Interpreter.prototype.Function} */ (
            intrp.builtins.get('Object.prototype.toString'));
      }
      var newState = Interpreter.State.newForCall(func, thisVal, [], perms);
      thread.stateStack_.push(newState);
      return Interpreter.FunctionResult.AwaitValue;
    }
  });

  new this.NativeFunction({
    id: 'Array.prototype.unshift', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = state.scope.perms;
      var obj = intrp.toObject(thisVal, perms);
      var len = Interpreter.toLength(obj.get('length', perms));
      var argCount = args.length;
      if (argCount > 0) {
        if (len + args.length > Number.MAX_SAFE_INTEGER) {
          throw new intrp.Error(perms, intrp.TYPE_ERROR, 'Unshifting ' +
              argCount + ' elements on an array-like of length ' + len +
              ' is disallowed, as the total surpasses 2**53-1');
        }
        for (var k = len; k > 0; k--) {
          var from = String(k - 1);
          var to = String(k);
          if (obj.has(from, perms)) {
            obj.set(to, obj.get(from, perms), perms);
          } else {
            obj.deleteProperty(to, perms);
          }
        }
        for (var j = 0; j < argCount; j++) {
          obj.set(String(j), args[j], perms);
        }
      }
      obj.set('length', len + argCount, perms);
      return len + argCount;
    }
  });
};

/**
 * Initialize the String class.
 * @private
 */
Interpreter.prototype.initString_ = function() {
  var intrp = this;
  var wrapper;
  // String prototype.  It's a String object (but the only one!)
  this.STRING = new this.Object(this.ROOT);
  this.builtins.set('String.prototype', this.STRING);
  this.STRING.class = 'String';

  // String constructor.  ES6 §21.1.1.1.
  new this.NativeFunction({
    id: 'String', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      // We don't handle symbols, so String(x) should just return
      // ToString(x) (ES6 §7.1.12) if x is primitive, or
      // ToString(ToPrimitive(x, hint String)) if not.  Note that
      // ToPrimitive (ES6 §7.1.1) is guaranteed to return a primitive
      // or throw.
      var value = args.length > 0 ? args[0] : '';
      var perms = state.scope.perms;
      if (!(value instanceof intrp.Object)) {
        return String(value);
      }
      var step = Number(state.info_.funcState) || 0;
      if (step > 0 && !(state.value instanceof intrp.Object)) {
        // Call of .toString or .valueOf by previous visit returned a
        // primitive.  Convert to string and return.
        return String(state.value);
      }
      switch(step) {
        case 0:  // Try calling toString.
          var method = value.get('toString', perms);
          if (method instanceof intrp.Function) {
            thread.stateStack_[thread.stateStack_.length] =
                Interpreter.State.newForCall(method, value, [], perms);
            state.info_.funcState = 1;
            return Interpreter.FunctionResult.CallAgain;
          }
          // FALL THROUGH
        case 1:  // toString call complete (or skipped); try calling valueOf.
          method = value.get('valueOf', perms);
          if (method instanceof intrp.Function) {
            thread.stateStack_[thread.stateStack_.length] =
                Interpreter.State.newForCall(method, value, [], perms);
            state.info_.funcState = 2;
            return Interpreter.FunctionResult.CallAgain;
          }
          // FALL THROUGH
        case 2:  // valueOf complete (or skipped); throw TypeError.
          throw new intrp.Error(perms, intrp.TYPE_ERROR,
             'Cannot convert object to primitive value');
        default:
          throw new Error('Invalid funcStep in String??');
      }
    },
    /** @type {!Interpreter.NativeConstructImpl} */
    construct: function(intrp, thread, state, args) {
      throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
         'String objects not supported.');
    }
  });

  /**
   * The thisStringValue specification method from ES6 §21.1.3.
   * Converts value arg to string or throws TypeError.
   * @param {!Interpreter} intrp The interpreter.
   * @param {?Interpreter.Value} value The this value passed into function.
   * @param {string} name Name of built-in function (for TypeError message).
   * @param {!Interpreter.Owner} perms Who called built-in?
   * @return {string}
   */
  var thisStringValue = function(intrp, value, name, perms) {
    if (typeof value === 'string') {  // String primitive.
      return value;
    } else if (value === intrp.STRING) {  // The only String object.
      return '';
    }
    throw new intrp.Error(perms, intrp.TYPE_ERROR,
        name + " requires that 'this' be a String");
  };

  // Static methods on String.
  this.createNativeFunction('String.fromCharCode', String.fromCharCode, false);

  // Properties of the String prototype object.
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
    return intrp.createArrayFromList(jsList, intrp.thread_.perms());
  };
  this.createNativeFunction('String.prototype.split', wrapper, false);

  wrapper = function(regexp) {
    if (regexp instanceof intrp.RegExp) {
      regexp = regexp.regexp;
    }
    var m = this.match(regexp);
    return m && intrp.createArrayFromList(m, intrp.thread_.perms());
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
      throw intrp.errorNativeToPseudo(e, intrp.thread_.perms());
    }
  };
  this.createNativeFunction('String.prototype.repeat', wrapper, false);

  new this.NativeFunction({
    id: 'String.prototype.toString', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return thisStringValue(intrp, thisVal,
          'String.prototype.toString', state.scope.perms);
    }
  });

  new this.NativeFunction({
    id: 'String.prototype.valueOf', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return thisStringValue(intrp, thisVal,
          'String.prototype.valueOf', state.scope.perms);
    }
  });
};

/**
 * Initialize the Boolean class.
 * @private
 */
Interpreter.prototype.initBoolean_ = function() {
  // Boolean prototype.  It's a Boolean object (but the only one!)
  this.BOOLEAN = new this.Object(this.ROOT);
  this.builtins.set('Boolean.prototype', this.BOOLEAN);
  this.BOOLEAN.class = 'Boolean';

  // Boolean constructor.
  new this.NativeFunction({
    id: 'Boolean', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return Boolean(args[0]);
    },
    /** @type {!Interpreter.NativeConstructImpl} */
    construct: function(intrp, thread, state, args) {
      throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
          'Boolean objects not supported.');
    }
  });

  /**
   * The thisBooleanValue specification method from ES6 §19.3.3.
   * Converts value arg to boolean or throws TypeError.
   * @param {!Interpreter} intrp The interpreter.
   * @param {?Interpreter.Value} value The this value passed into function.
   * @param {string} name Name of built-in function (for TypeError message).
   * @param {!Interpreter.Owner} perms Who called built-in?
   * @return {boolean}
   */
  var thisBooleanValue = function(intrp, value, name, perms) {
    if (typeof value === 'boolean') {  // Boolean primitive.
      return value;
    } else if (value === intrp.BOOLEAN) {  // The only Boolen object.
      return false;
    }
    throw new intrp.Error(perms, intrp.TYPE_ERROR,
        name + " requires that 'this' be a Boolean");
  };

  // Instance methods on Boolean.
  new this.NativeFunction({
    id: 'Boolean.prototype.toString', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return String(thisBooleanValue(intrp, thisVal,
          'Boolean.prototype.toString', state.scope.perms));
    }
  });

  new this.NativeFunction({
    id: 'Boolean.prototype.valueOf', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return thisBooleanValue(intrp, thisVal,
          'Boolean.prototype.valueOf', state.scope.perms);
    }
  });
};

/**
 * Initialize the Number class.
 * @private
 */
Interpreter.prototype.initNumber_ = function() {
  var intrp = this;
  var wrapper;
  // Number prototype.  It's a Number object (but the only one!)
  this.NUMBER = new this.Object(this.ROOT);
  this.builtins.set('Number.prototype', this.NUMBER);
  this.NUMBER.class = 'Number';

  // Number constructor.
  new this.NativeFunction({
    id: 'Number', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return Number(args.length ? args[0] : 0);
    },
    /** @type {!Interpreter.NativeConstructImpl} */
    construct: function(intrp, thread, state, args) {
      throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
          'Number objects not supported.');
    }
  });

  /**
   * The thisNumberValue specification method from ES6 §20.1.3.
   * Converts value arg to number or throws TypeError.
   * @param {!Interpreter} intrp The interpreter.
   * @param {?Interpreter.Value} value The this value passed into function.
   * @param {string} name Name of built-in function (for TypeError message).
   * @param {!Interpreter.Owner} perms Who called built-in?
   * @return {number}
   */
  var thisNumberValue = function(intrp, value, name, perms) {
    if (typeof value === 'number') {  // Number primitive.
      return value;
    } else if (value === intrp.NUMBER) {  // The only Boolen object.
      return 0;
    }
    throw new intrp.Error(perms, intrp.TYPE_ERROR,
        name + " requires that 'this' be a Number");
  };

  // Static methods on Number.
  this.createNativeFunction('Number.isFinite', Number.isFinite, false);
  this.createNativeFunction('Number.isInteger', Number.isInteger, false);
  this.createNativeFunction('Number.isNaN', Number.isNaN, false);
  this.createNativeFunction('Number.isSafeInteger', Number.isSafeInteger,
                            false);

  // Properties of the Number prototype object.
  wrapper = function(fractionDigits) {
    try {
      return this.toExponential(fractionDigits);
    } catch (e) {
      // Throws if fractionDigits isn't within 0-20.
      throw intrp.errorNativeToPseudo(e, intrp.thread_.perms());
    }
  };
  this.createNativeFunction('Number.prototype.toExponential', wrapper, false);

  wrapper = function(digits) {
    try {
      return this.toFixed(digits);
    } catch (e) {
      // Throws if digits isn't within 0-20.
      throw intrp.errorNativeToPseudo(e, intrp.thread_.perms());
    }
  };
  this.createNativeFunction('Number.prototype.toFixed', wrapper, false);

  wrapper = function(precision) {
    try {
      return this.toPrecision(precision);
    } catch (e) {
      // Throws if precision isn't within range (depends on implementation).
      throw intrp.errorNativeToPseudo(e, intrp.thread_.perms());
    }
  };
  this.createNativeFunction('Number.prototype.toPrecision', wrapper, false);

  wrapper = function(/*locales, options*/) {
    // Messing around with arguments so that function's length is 0.
    var locales = arguments.length > 0 ?
        intrp.pseudoToNative(arguments[0]) : undefined;
    var options = arguments.length > 1 ?
        intrp.pseudoToNative(arguments[1]) : undefined;
    return this.toLocaleString(locales, options);
  };
  this.createNativeFunction('Number.prototype.toLocaleString', wrapper, false);

  new this.NativeFunction({
    id: 'Number.prototype.toString', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var x = thisNumberValue(
          intrp, thisVal, 'Number.prototype.toString', state.scope.perms);
      var radix = args[0];
      try {
        // Throws if radix isn't within 2-36.  Cast requried because
        // Closure Compiler thinks radix should be a number.
        return Number.prototype.toString.call(x, /** @type {?} */(radix));
      } catch (e) {
        throw intrp.errorNativeToPseudo(e, intrp.thread_.perms());
      }
    }
  });

  new this.NativeFunction({
    id: 'Number.prototype.valueOf', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return thisNumberValue(intrp, thisVal,
          'Number.prototype.valueOf', state.scope.perms);
    }
  });
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
  this.builtins.set('Date.prototype', this.DATE);
  // Date constructor.
  wrapper = function(value, var_args) {
    if (!intrp.calledWithNew()) {
      // Called as Date().
      // Calling Date() as a function returns a string, no arguments are heeded.
      return Date();
    }
    // Called as new Date().
    var args = [null].concat(Array.from(arguments));
    var date = new (Function.prototype.bind.apply(Date, args))();
    return new intrp.Date(date, intrp.thread_.perms());
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
  this.builtins.set('RegExp.prototype', this.REGEXP);

  // RegExp constructor.
  new this.NativeFunction({
    id: 'RegExp', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var pattern = args[0];
      var flags = args[1];
      if (pattern instanceof intrp.RegExp && flags === undefined) {
        // Per ES6 §21.2.3.1 step 4.b, (now
        // https://tc39.es/ecma262/#sec-regexp-constructor step 2.b),
        // check pattern.constructor to see if it's RegExp.
        var patternConstructor = pattern.get('constructor', state.scope.perms);
        if (patternConstructor === this) return pattern;
      }
      return this.construct.call(this, intrp, thread, state, args);
    },
    /** @type {!Interpreter.NativeConstructImpl} */
    construct: function(intrp, thread, state, args) {
      var pattern = args[0];
      var flags = args[1];
      var perms = state.scope.perms;
      if (pattern instanceof intrp.RegExp) {
        pattern = pattern.regexp.source;
        // ES5.1 required that TypeError be thown here if flags !==
        // undefined, but ES6 and later do not.
      }
      // TODO(ES6): ES6 §21.2.3.1 step 6 (now
      // https://tc39.es/ecma262/#sec-regexp-constructor step 5).
      pattern = (pattern === undefined ? '' : String(pattern));
      flags = (flags === undefined ? '' : String(flags));
      // TODO(ES6): also accept [uy]; ES8: [s], soon: [p].
      if (!/^(?:([gim])(?!.*\1))*$/.test(flags)) {  // Reject repeated flags.
        throw new intrp.Error(perms, intrp.SYNTAX_ERROR,
            "Invalid flags supplied to RegExp constructor '" + flags + "'");
      }
      return new intrp.RegExp(new RegExp(pattern, flags), perms);
    }
  });

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
      throw new intrp.Error(intrp.thread_.perms(), intrp.TYPE_ERROR,
          'Method RegExp.prototype.exec called on incompatible receiver' +
              this);
    }
    return this.regexp.test(str);
  };
  this.createNativeFunction('RegExp.prototype.test', wrapper, false);

  wrapper = function(str) {
    var perms = intrp.thread_.perms();
    if (!(this instanceof intrp.RegExp)) {
      throw new intrp.Error(perms, intrp.TYPE_ERROR,
          'Method RegExp.prototype.exec called on incompatible receiver ' +
          this);
    }
    str = String(str);
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

  var createErrorClass = function(name, protoKey) {
    var protoproto = name === 'Error' ? intrp.OBJECT : intrp.ERROR;
    var proto = new intrp.Error(intrp.ROOT, protoproto);
    intrp.builtins.set(name + '.prototype', proto);
    new intrp.NativeFunction({
      id: name, name: name, length: 1,
      /** @type {!Interpreter.NativeConstructImpl} */
      construct: function(intrp, thread, state, args) {
        var message = (args[0] === undefined) ? undefined : String(args[0]);
        var perms = state.scope.perms;
        // Use intrp[protoKey] instead of proto because
        // deserialisation will set up intrp.ERROR et al correctly but
        // can't modify values of variables in native closures.
        /** @suppress {checkTypes} */
        var err = new intrp.Error(perms, intrp[protoKey], message);
        err.makeStack(thread.callers(perms).slice(1), perms);
        return err;
      },
      /** @type {!Interpreter.NativeCallImpl} */
      call: function(intrp, thread, state, thisVal, args) {
        return this.construct.call(this, intrp, thread, state, args);
      }
    });
    return proto;
  };

  intrp.ERROR = createErrorClass('Error', 'ERROR');  // Must be first!
  intrp.EVAL_ERROR = createErrorClass('EvalError', 'EVAL_ERROR');
  intrp.RANGE_ERROR = createErrorClass('RangeError', 'RANGE_ERROR');
  intrp.REFERENCE_ERROR = createErrorClass('ReferenceError', 'REFERENCE_ERROR');
  intrp.SYNTAX_ERROR = createErrorClass('SyntaxError', 'SYNTAX_ERROR');
  intrp.TYPE_ERROR = createErrorClass('TypeError', 'TYPE_ERROR');
  intrp.URI_ERROR = createErrorClass('URIError', 'URI_ERROR');
  intrp.PERM_ERROR = createErrorClass('PermissionError', 'PERM_ERROR');

  this.createNativeFunction('Error.prototype.toString',
                            this.Error.prototype.toString, false);
};

/**
 * Initialize Math object.
 * @private
 */
Interpreter.prototype.initMath_ = function() {
  var numFunctions = ['abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2',
      'atanh', 'cbrt', 'ceil', 'clz32', 'cos', 'cosh', 'exp', 'expm1', 'floor',
      'fround', 'hypot', 'imul', 'log', 'log10', 'log1p', 'log2', 'max', 'min',
      'pow', 'random', 'round', 'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh',
      'trunc'];
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
  var wrapper;
  wrapper = function(text) {
    try {
      var nativeObj = JSON.parse(String(text));
    } catch (e) {
      throw intrp.errorNativeToPseudo(e, intrp.thread_.perms());
    }
    return intrp.nativeToPseudo(nativeObj, intrp.thread_.perms());
  };
  this.createNativeFunction('JSON.parse', wrapper, false);

  wrapper = function(value, replacer, space) {
    var nativeObj = intrp.pseudoToNative(value);
    var perms = intrp.thread_.perms();
    if (replacer instanceof intrp.Function) {
      throw new intrp.Error(perms, intrp.TYPE_ERROR,
          'Function replacer on JSON.stringify not supported');
    } else if (replacer instanceof intrp.Array) {
      replacer = intrp.createListFromArrayLike(replacer, perms);
      replacer = replacer.filter(function(word) {
        // Spec says we should also support boxed primitives here.
        return typeof word === 'string' || typeof word === 'number';
      });
    } else {
      replacer = null;
    }
    // Spec says we should also support boxed primitives here.
    if (typeof space !== 'string' && typeof space !== 'number') {
      space = undefined;
    }
    try {
      var str = JSON.stringify(nativeObj, replacer, space);
    } catch (e) {
      throw intrp.errorNativeToPseudo(e, perms);
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
  this.builtins.set('WeakMap.prototype', this.WEAKMAP);

  // WeakMap constructor.
  new this.NativeFunction({
    id: 'WeakMap', length: 0,  // N.B. length is correct; arg is optional!
    /** @type {!Interpreter.NativeConstructImpl} */
    construct: function(intrp, thread, state, args) {
      // TODO(cpcallen): Support iterable argument to populate map.
      return new intrp.WeakMap(state.scope.perms);
    }
  });

  // Properties of the WeakMap prototype object.

  /**
   * A narrowing of Interpreter.NativeCallImpl for decorated WeakMap
   * .call implementations.
   * @typedef {function(this: Interpreter.prototype.NativeFunction,
   *                    !Interpreter,
   *                    !Interpreter.Thread,
   *                    !Interpreter.State,
   *                    !Interpreter.prototype.WeakMap,
   *                    !Array<?Interpreter.Value>)
   *               : (?Interpreter.Value|!Interpreter.FunctionResult)}
   */
  var WeakMapCallImpl;
  
  /**
   * Decorator to add standard permission and type checks for WeakMap
   * prototype methods.
   * @param {!WeakMapCallImpl} func Function to decorate.
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
    call: withChecks(function(intrp, thread, state, thisVal, args) {
      return thisVal.weakMap.delete(args[0]);
    }, 'delete')
  });

  new this.NativeFunction({
    id: 'WeakMap.prototype.get', length: 1,
    call: withChecks(function get(intrp, thread, state, thisVal, args) {
      return thisVal.weakMap.get(args[0]);
    })
  });

  new this.NativeFunction({
    id: 'WeakMap.prototype.has', length: 1,
    call: withChecks(function has(intrp, thread, state, thisVal, args) {
      return thisVal.weakMap.has(args[0]);
    })
  });

  new this.NativeFunction({
    id: 'WeakMap.prototype.set', length: 2,
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
Interpreter.prototype.initThread_ = function() {
  // Thread prototype.
  this.THREAD = new this.Object(this.ROOT);
  this.builtins.set('Thread.prototype', this.THREAD);

  /* Thread constructor.  Usage:
   *
   *     var thread = new Thread(func, delay, thisArg, ...args);
   *
   * - func is function to run in thread.  (Maybe in future we will
   *   accept src to eval, but not for now.)
   * - delay is time to wait (in ms) before starting thread.
   * - thisArg is the 'this' value to use for the call (as if via .apply).
   * - ...args are additional arguments to pass to func.
   */
  new this.NativeFunction({
    id: 'Thread', length: 1,
    /** @type {!Interpreter.NativeConstructImpl} */
    construct: function(intrp, thread, state, args) {
      var func = args[0];
      var delay = Number(args[1]) || 0;
      var thisArg = args[2];
      args = args.slice(3);
      var perms = state.scope.perms;
      if (!(func instanceof intrp.Function)) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            func + ' is not a function');
      }
      return intrp.createThreadForFuncCall(
          perms, func, thisArg, args, intrp.now() + delay, thread.timeLimit);
    }
  });

  new this.NativeFunction({
    id: 'Thread.current', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      return thread.wrapper;
    }
  });

  new this.NativeFunction({
    id: 'Thread.kill', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var t = args[0];
      var perms = state.scope.perms;
      if (!(t instanceof intrp.Thread)) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR, t + ' is not a Thread');
      }
      // TODO(cpcallen:perms): add security check here.
      var id = t.thread.id;
      if (intrp.threads_[id]) {
        intrp.threads_[id].status = Interpreter.Thread.Status.ZOMBIE;
      }
    }
  });

  new this.NativeFunction({
    id: 'Thread.suspend', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var delay = Number(args[0]) || 0;
      if (delay < 0) {
        delay = 0;
      }
      thread.runAt = intrp.now() + delay;
      return Interpreter.FunctionResult.Sleep;
    }
  });

  new this.NativeFunction({
    id: 'Thread.callers', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var perms = state.scope.perms;
      var frames = thread.callers(state.scope.perms);
      var callers = [];
      for (var i = 1, frame; (frame = frames[i]); i++) {
        var caller = new intrp.Object(perms);
        // Copy properties of frame to caller.
        for (var key in frame) {
          if (!frame.hasOwnProperty(key)) continue;
          var value = frame[key];
          if (typeof value === 'function' || typeof value === 'object' &&
              !(value instanceof intrp.Object) && value !== null) {
            throw new TypeError('Unexpected native object');
          }
          caller.defineProperty(key, Descriptor.wec.withValue(value), perms);
        }
        callers.push(caller);
      }
      return intrp.createArrayFromList(callers, perms);
    }
  });

  // Properties of the Thread prototype object.

  /**
   * A narrowing of Interpreter.NativeCallImpl for decorated Thread
   * .call implementations.
   * @typedef {function(this: Interpreter.prototype.NativeFunction,
   *                    !Interpreter,
   *                    !Interpreter.Thread,
   *                    !Interpreter.State,
   *                    !Interpreter.prototype.Thread,
   *                    !Array<?Interpreter.Value>)
   *               : (?Interpreter.Value|!Interpreter.FunctionResult)}
   */
  var ThreadCallImpl;

  /**
   * Decorator to add standard permission and type checks for Thread
   * prototype methods.
   * @param {!ThreadCallImpl} func Function to decorate.
   * @return {!Interpreter.NativeCallImpl} The decorated function.)
   */
  var withChecks = function(func) {
    name = (name === undefined) ? func.name : name;
    return function call(intrp, thred, state, thisVal, args) {
      // TODO(cpcallen:perms): add controls()-type and/or
      // object-readability check(s) here.
      if (!(thisVal instanceof intrp.Thread)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'Method Thread.prototype.' + name +
            ' called on incompatible receiver ' + String(thisVal));
      }
      return func.apply(this, arguments);
    };
  };

  new this.NativeFunction({
    id: 'Thread.prototype.getTimeLimit', length: 0,
    call: withChecks(function getTimeLimit(
        intrp, thread, state, thisVal, args) {
      return thisVal.thread.timeLimit;
    })
  });

  // BUG(cpcallen): this only sets the time limit for future slices;
  // until suspend is called the current Thread will run with its
  // existing limit.
  new this.NativeFunction({
    id: 'Thread.prototype.setTimeLimit', length: 1,
    call: withChecks(function setTimeLimit(
        intrp, thread, state, thisVal, args) {
      var limit = args[0];
      var perms = state.scope.perms;
      var old = thisVal.thread.timeLimit || Number.MAX_VALUE;
      if (typeof limit !== 'number' || Number.isNaN(limit)) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'new limit must be a number (and not NaN)');
      } else if (limit <= 0) {
        throw new intrp.Error(perms, intrp.RANGE_ERROR,
            'new limit must be > 0');
      } else if (limit > old) {
        throw new intrp.Error(perms, intrp.RANGE_ERROR,
            'new limit must be <= previous limit');
      }
      thisVal.thread.timeLimit = limit;
    })
  });
};

/**
 * Initialize the permissions model API.
 * @private
 */
Interpreter.prototype.initPerms_ = function() {
  // Create object, never available to userland, to be used to
  // rpresent the permissions of "a generic user" when such a thing is
  // needed (e.g., for internal toString implementations, which have
  // no information about caller perms but need to access properties
  // on the object - something which can't be done with the null
  // permissions).
  var anybody = new this.Object(null, this.OBJECT);
  this.ANYBODY = /** @type {!Interpreter.Owner} */ (anybody);

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

  new this.NativeFunction({
    id: 'Object.getOwnerOf', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      if (!(obj instanceof intrp.Object)) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            "Can't get owner of non-object");
      }
      return /** @type {?Interpreter.prototype.Object} */(obj.owner);
    }
  });

  new this.NativeFunction({
    id: 'Object.setOwnerOf', length: 0,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      var owner = args[1];
      var perms = state.scope.perms;
      if (!(obj instanceof intrp.Object)) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            "Can't set owner of non-object");
      }
      if (!(owner instanceof intrp.Object) && owner !== null) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            'New owner must be an object or null');
      }
      // TODO(cpcallen:perms): throw if current perms does not
      // control obj and (new) owner.
      obj.owner = /** @type {?Interpreter.Owner} */(owner);
      return obj;
    }
  });
};

/**
 * Initialize the networking subsystem API.
 * @private
 */
Interpreter.prototype.initNetwork_ = function() {
  new this.NativeFunction({
    id: 'CC.connectionListen', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var port = args[0];
      var proto = args[1];
      var timeLimit = Number(args[2]) || thread.timeLimit;
      var perms = state.scope.perms;
      if (port !== (port >>> 0) || port > 0xffff) {
        throw new intrp.Error(perms, intrp.RANGE_ERROR, 'invalid port');
      } else if (port in intrp.listeners_) {
        throw new intrp.Error(perms, intrp.RANGE_ERROR,
            'port already listened');
      }
      if (!(proto instanceof intrp.Object)) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
           'prototype argument to connectionListen must be an object');
      }
      // TODO(cpcallen): do validity check on timeLimit.  It should
      // probaly not be larger than current limit (unless root).
      var server = new intrp.Server(perms, port, proto, timeLimit);
      intrp.listeners_[port] = server;
      var rr = intrp.getResolveReject(thread, state);
      server.listen(function(error) {
        if (!error) {
          rr.resolve();
        } else {
          rr.reject(intrp.errorNativeToPseudo(error, perms), perms);
        }
      });
      return Interpreter.FunctionResult.Block;
    }
  });

  new this.NativeFunction({
    id: 'CC.connectionUnlisten', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var port = args[0];
      var perms = state.scope.perms;
      if (port !== (port >>> 0) || port > 0xffff) {
        throw new intrp.Error(perms, intrp.RANGE_ERROR, 'invalid port');
      } else if (!(port in intrp.listeners_)) {
        throw new intrp.Error(perms, intrp.RANGE_ERROR, 'port not listening');
      }
      if (!(intrp.listeners_[port].server_ instanceof net.Server)) {
        throw new Error('no net.Serfer object for port %s??', port);
      }
      var rr = intrp.getResolveReject(thread, state);
      intrp.listeners_[port].unlisten(function() {
        // Socket (and all open connections on it) now closed.
        delete intrp.listeners_[/** @type {number} */(port)];
        rr.resolve();
      });
      return Interpreter.FunctionResult.Block;
    }
  });

  new this.NativeFunction({
    id: 'CC.connectionWrite', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      var data = args[1];
      if (!(obj instanceof intrp.Object) || !obj.socket) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'object is not connected');
      } else if (typeof data !== 'string') {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'data is not a string');
      }
      obj.socket.write(data);
    }
  });

  new this.NativeFunction({
    id: 'CC.connectionClose', length: 2,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var obj = args[0];
      if (!(obj instanceof intrp.Object) || !obj.socket) {
        throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
            'object is not connected');
      }
      obj.socket.end();
    }
  });

  new this.NativeFunction({
    id: 'CC.xhr', length: 1,
    /** @type {!Interpreter.NativeCallImpl} */
    call: function(intrp, thread, state, thisVal, args) {
      var url = String(args[0]);
      var perms = state.scope.perms;
      if (url.match(/^http:\/\//)) {
        var req = http.get(url);
      } else if (url.match(/^https:\/\//)) {
        req = https.get(url);
      } else {
        throw new intrp.Error(perms, intrp.SYNTAX_ERROR,
            'Unrecognized URL "' + url + '"');
      }
      intrp.log('net', 'XHR for %s: connect', url);
      var rr = intrp.getResolveReject(thread, state);
      req.on('response', function(res) {
        intrp.log('net', 'XHR for %s: response', url);
        if (res.statusCode !== 200) {
          var err = new intrp.Error(perms, intrp.ERROR,
              'HTTP request failed: ' + res.statusCode + ' ' +
              res.statusMessage);
          err.set('statusCode', Number(res.statusCode), perms);
          err.set('statusMessage', String(res.statusMessage), perms);
          res.resume();
          rr.reject(err, perms);
          return;
        }
        var body = '';
        res.on('data', function(data) {
          body += String(data);
        });
        res.on('end', function() {
          intrp.log('net', 'XHR for %s: end', url);
          rr.resolve(body);
        });
      }).on('error', function(e) {
        intrp.log('net', 'XHR for %s: %s', url, e);
        rr.reject(intrp.errorNativeToPseudo(e, perms), perms);
      });
      return Interpreter.FunctionResult.Block;
    }
  });
};

/**
 * The ToInteger function from ES6 §7.1.4.  The abstract operation
 * ToInteger converts argument to an integral numeric value.
 * @param {?Interpreter.Value} value
 * @return {number} An integer if the value can be converted to such;
 *     0 otherwise.
 */
Interpreter.toInteger = function toInteger(value) {
  var number = Number(value);
  if (isNaN(number)) {
    return 0;
  } else if (number === 0 || !isFinite(number)) {
    return number;
  }
  return Math.trunc(number);
};

/**
 * The ToUint32 function from ES6 §7.1.6.  The abstract operation
 * ToUint32 converts argument to one of 2**32 integer values in the
 * range 0 through 2**32−1, inclusive.
 * @param {?Interpreter.Value} value
 * @return {number} A non-negative integer less than 2**32.
 */
Interpreter.toUint32 = function toUint32(value) {
  return Interpreter.toInteger(value) >>> 0;
};

/**
 * The ToLength function from ES6 §7.1.15.  Note that this does NOT
 * enforce the actual array length limit of 2**32-1, but deals with
 * lengths up to 2**53-1, which is correct for the polymorphic
 * Array.prototype methods.
 * @param {?Interpreter.Value} value
 * @return {number} A non-negative integer less than 2**53.
 */
Interpreter.toLength = function toLength(value) {
  var len = Interpreter.toInteger(value);
  if (len <= 0) return 0;
  return Math.min(len, Number.MAX_SAFE_INTEGER);  // Handles len === Infinity.
};

/**
 * Create a new native function.  Function will be owned by root.
 * @param {string} id ID to register new function in builtins registry.
 * @param {!Function} nativeFunc Any JavaScript function.
 * @param {boolean} legalConstructor True if the function can be used as a
 *     constructor (e.g. Array), false if not (e.g. escape).
 * @return {!Interpreter.prototype.Function} New function.
*/
Interpreter.prototype.createNativeFunction = function(
    id, nativeFunc, legalConstructor) {
  if (nativeFunc instanceof this.Object) {
    throw new TypeError('createNativeFunction passed non-native function??');
  }
  // Make sure impl function has an id for serialization.
  if (!nativeFunc.id) nativeFunc.id = id;
  return new this.OldNativeFunction(nativeFunc, legalConstructor, {id: id});
};

/**
 * Converts from a native JS object or value to a JS interpreter
 * object.  Can handle JSON-style values plus regexps and errors (of
 * all standard native types), and handles additional properties on
 * arrays, regexps and errors (just as for plain objects).  Ignores
 * prototype and inherited properties.  Efficiently handles
 * sparse arrays.  Does NOT handle cyclic structures.
 * @param {*} nativeObj The native JS object to be converted.
 * @return {?Interpreter.Value} The equivalent JS interpreter object.
 * @param {!Interpreter.Owner} owner Owner for new object.
 */
Interpreter.prototype.nativeToPseudo = function(nativeObj, owner) {
  if ((typeof nativeObj !== 'object' && typeof nativeObj !== 'function') ||
      nativeObj === null) {
    // It's a primitive; just return it.
    return /** @type {boolean|number|string|undefined|null} */ (nativeObj);
  } else if (nativeObj instanceof this.Object) {
    throw new TypeError('nativeToPseudo called on a pseudo-object??');
  }

  var pseudoObj;
  switch (Object.prototype.toString.apply(nativeObj)) {
    case '[object Array]':
      pseudoObj = new this.Array(owner);
      break;
    case '[object RegExp]':
      pseudoObj = new this.RegExp(/** @type {!RegExp} */(nativeObj), owner);
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
    var pd = new Descriptor(desc.writable, desc.enumerable, desc.configurable);
    pd.value = this.nativeToPseudo(desc.value, owner);
    pseudoObj.defineProperty(key, pd, owner);
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
 * @param {?Interpreter.Value} pseudoObj The JS interpreter object to
 *     be converted.
 * @param {!Object=} cycles Cycle detection (used only in recursive calls).
 * @return {*} The equivalent native JS object or value.
 */
Interpreter.prototype.pseudoToNative = function(pseudoObj, cycles) {
  // BUG(cpcallen:perms): Kludge.  Incorrect except when doing .step
  // or run.  Should be an argument instead, forcing caller to decide.
  try {
    var perms = this.thread_.perms();
  } catch (e) {
    perms = this.ROOT;
  }
  if (typeof pseudoObj === 'boolean' ||
      typeof pseudoObj === 'number' ||
      typeof pseudoObj === 'string' ||
      pseudoObj === null || pseudoObj === undefined) {
    // It's a primitive; just return it.
    return pseudoObj;
  } else if (!(pseudoObj instanceof this.Object)) {
    throw new TypeError('pseudoToObject called on wrong type??');
  } else if (pseudoObj instanceof this.RegExp) {  // Regular expression.
    return pseudoObj.regexp;
  } else if (pseudoObj instanceof this.Function) {  // Function.
    return undefined;
  }

  if (!cycles) {
    cycles = {pseudo: [], native: []};
  }
  var i = cycles.pseudo.indexOf(pseudoObj);
  if (i !== -1) {
    return cycles.native[i];
  }
  cycles.pseudo[cycles.pseudo.length] = pseudoObj;
  var nativeObj = pseudoObj instanceof this.Array ? [] : {};
  cycles.native[cycles.native.length] = nativeObj;
  var keys = pseudoObj.ownKeys(perms);
  for (i = 0; i < keys.length; i++) {
    var key = keys[i];
    var pd = pseudoObj.getOwnPropertyDescriptor(key, perms);
    Object.defineProperty(nativeObj, key, {
      writable: pd.writable,
      enumerable: pd.enumerable,
      configurable: pd.configurable,
      value: this.pseudoToNative(pd.value, cycles)
    });
  }
  cycles.pseudo.pop();
  cycles.native.pop();
  return nativeObj;
};

/**
 * CreateArrayFromList from ES6 §7.3.16
 *
 * Converts from a native array to an Interpreter.prototype.Array.
 * Does NOT recursively convert the type of the array's contents.
 * @param {!Array<?Interpreter.Value>} elements The native array to be
 *     converted.
 * @param {!Interpreter.Owner} owner Owner for new object.
 * @return {!Interpreter.prototype.Array} The equivalent interpreter array.
 */
Interpreter.prototype.createArrayFromList = function(elements, owner) {
  if (!Array.isArray(elements) || (elements instanceof this.Object)) {
    throw new TypeError('CreateArrayFromList called on wrong type??');
  }
  var array = new this.Array(owner);
  for (var n = 0; n < elements.length; n++) {
    array.defineProperty(
        String(n), Descriptor.wec.withValue(elements[n]), owner);
  }
  return array;
};

/**
 * CreateListFromArrayLike from ES6 §7.3.17.
 *
 * This function converts from an Interpreter.prototype.Array (or
 * array-like I.p.Object) to a native array.  This is an evolution of
 * the algorithm from ES5.1 §15.3.4.3 (Function.prototype.apply).  It
 * does NOT recursively convert the type of the array's contents.
 *
 * TODO(ES6): Add elementTypes param and associated type checks.
 * @param {?Interpreter.Value} obj The interpreter array or array-like
 *     object to be converted.  Error thrown if non-object.
 * @param {!Interpreter.Owner} perms Who is trying convert it?
 * @return {!Array<?Interpreter.Value>} The equivalent native JS array.
 */
Interpreter.prototype.createListFromArrayLike = function(obj, perms) {
  if (!(obj instanceof this.Object)) {
    throw new this.Error(perms, this.TYPE_ERROR,
        'CreateListFromArrayLike called on non-object');
  }
  var len = Interpreter.toLength(obj.get('length', perms));
  var list = [];
  for (var i = 0; i < len; i++) {
    list[i] = obj.get(String(i), perms);
  }
  return list;
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
  if (err instanceof this.Object) {
    throw new TypeError('errorNativeToPseudo called on wrong type??');
  }

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
 * Implements the ToObject specification method from ES5.1 §9.9 / ES6
 * §7.1.13, but returning temporary Box objects instead of boxed
 * Boolean, Number or String instances.
 * @param {?Interpreter.Value} value The value to be converted to an Object.
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
 * Retrieves a value from the scope chain.
 * @param {!Interpreter.Scope} scope Scope to read from.
 * @param {string} name Name of variable.
 * @return {?Interpreter.Value} Value (may be undefined).
 */
Interpreter.prototype.getValueFromScope = function(scope, name) {
  for (var s = scope; s; s = s.outerScope) {
    if (name in s.vars) {
      return s.vars[name];
    }
  }
  throw new this.Error(this.thread_.perms(), this.REFERENCE_ERROR,
      name + ' is not defined');
};

/**
 * Sets a value to the current scope.
 * @param {!Interpreter.Scope} scope Scope to write to.
 * @param {string} name Name of variable.
 * @param {?Interpreter.Value} value Value.
 */
Interpreter.prototype.setValueToScope = function(scope, name, value) {
  for (var s = scope; s; s = s.outerScope) {
    if (name in s.vars) {
      try {
        s.vars[name] = value;
      } catch (e) {  // Trying to set immutable binding.
        // TODO(cpcallen:perms): we have a scope here, but scope.perms
        // is probably not the right value for owner of new error.
        throw new this.Error(this.thread_.perms(), this.TYPE_ERROR,
            'Assignment to constant variable ' + name);
      }
      return;
    }
  }
  throw new this.Error(this.thread_.perms(), this.REFERENCE_ERROR,
      name + ' is not defined');
};

/**
 * Populate a scope with declarations from given node.
 * @param {!Node} node AST node (program or function).
 * @param {!Interpreter.Scope} scope Scope dictionary to populate.
 * @param {!Interpreter.Source=} source Original source code.  If not
 *     supplied, will use node['source'] instead.
 * @private
 */
Interpreter.prototype.populateScope_ = function(node, scope, source) {
  if (!source) {
    if (!node['source']) throw new Error('Source not found');
    source = node['source'];
  }
  // Obtain list of bound names for node.  We cache this on the AST
  // node to save time when repeatedly calling the same function.
  var boundNames = getBoundNames(node);
  for (var name in boundNames) {
    var boundValue = boundNames[name];
    var value = boundValue ?
        new this.UserFunction(boundValue, scope, source, scope.perms)
        : undefined;
    if (!scope.hasBinding(name)) scope.createMutableBinding(name, value);
    if (value) this.setValueToScope(scope, name, value);
  }
};

/**
 * Is the current state directly being called with as a construction with 'new'.
 * @return {boolean} True if 'new foo()', false if 'foo()'.
 */
Interpreter.prototype.calledWithNew = function() {
  return this.thread_.stateStack_[this.thread_.stateStack_.length - 1]
      .info_.construct;
};

/**
 * Implements IsUnresolvableReference from ES5 §8.7 / ES6 §6.2.3.
 * @param {!Interpreter.Scope} scope Current scope dictionary.
 * @param {!Array} ref Reference tuple.
 * @param {!Interpreter.Owner} perms Who is trying to get it?
 * @return {boolean} True iff refernece is unresolvable.
 */
Interpreter.prototype.isUnresolvableReference = function(scope, ref, perms) {
  // Property references never unresolvable.
  return ref[0] === null;
};

/**
 * Gets the value of a referenced name from the scope or object referred to.
 * @param {!Array} ref Reference tuple.
 * @param {!Interpreter.Owner} perms Who is trying to get it?
 * @return {?Interpreter.Value} Value (may be undefined).
 */
Interpreter.prototype.getValue = function(ref, perms) {
  var base = ref[0];
  var name = ref[1];
  if (base === null) {  // Unresolvable reference.
    throw new this.Error(perms, this.REFERENCE_ERROR, name + ' is not defined');
  } else if (base instanceof Interpreter.Scope) {  // An environment reference.
    return base.get(name);
  } else {  // A property reference.
    return this.toObject(base, perms).get(name, perms);
  }
};

/**
 * Sets value of a referenced name to the scope or object referred to.
 * @param {!Array} ref Reference tuple.
 * @param {?Interpreter.Value} value Value.
 * @param {!Interpreter.Owner} perms Who is trying to set it?
 */
Interpreter.prototype.setValue = function(ref, value, perms) {
  var base = ref[0];
  var name = ref[1];
  if (base === null) {  // Unresolvable reference.
    throw new this.Error(perms, this.REFERENCE_ERROR, name + ' is not defined');
  } else if (base instanceof Interpreter.Scope) {  // An environment reference.
    var err = base.set(name, value);
    if (err) {
      throw this.errorNativeToPseudo(err, perms);
    }
  } else {  // A property reference.
    this.toObject(ref[0], perms).set(name, value, perms);
  }
};

/**
 * Check to see if the current thread has run too long.  Called at the
 * top of loops and before making function calls.
 * @private
 * @param {!Interpreter.Owner} perms Perm to use to create Error object.
 */
Interpreter.prototype.checkTimeLimit_ = function(perms) {
  if (this.threadTimeLimit_ && this.now() > this.threadTimeLimit_) {
    throw new this.Error(perms, this.RANGE_ERROR, 'Thread ran too long');
  }
};


/**
 * Carry out the mechanics of throwing an exception.
 *
 * This is intended only to be called from exception handlers in
 * .step() and .run(), and from async function's reject() callback.
 * Elsewhere, just throw.
 * @param {!Interpreter.Thread} thread in which throw is occurring.
 * @param {?Interpreter.Value} e Exception being thrown.
 * @param {!Interpreter.Owner} perms Perm to use to obtain (e.g.)
 *     function names, etc.
 */
Interpreter.prototype.throw_ = function(thread, e, perms) {
  if (e instanceof this.Error) {
    // Userland Error object thrown; make sure it has a .stack.
    // BUG(cpcallen): this will set .stack on Error.prototype, etc.
    e.makeStack(thread.callers(perms), perms);
  } else if (e instanceof Error) {
    // Uh oh.  This is an internal error in the interpreter.  Kill
    // thread and rethrow.
    thread.status = Interpreter.Thread.Status.ZOMBIE;
    throw e;
  } else if (!(e instanceof this.Object) && e !== null &&
      (typeof e === 'object' || typeof e === 'function')) {
    // WTF: not a native exception, not an interpreter object and not
    // a primitive, but just some random (internal) object.
    throw new TypeError('Unexpected exception value ' + String(e));
  }
  this.unwind_(thread, Interpreter.CompletionType.THROW, e, undefined);
};

/**
 * Unwind the stack to the innermost relevant enclosing TryStatement,
 * For/ForIn/WhileStatement or Call.  If this results in
 * the stack being completely unwound the thread will be terminated
 * and an appropriate error being logged.
 *
 * N.B. Normally unwind should be called from the current stack frame
 * (i.e., do NOT do stack.pop() before calling unwind) because the
 * target label of a break statement can be the statement itself
 * (e.g., `foo: break foo;`).
 * @private
 * @param {!Interpreter.Thread} thread The thread whose stack is to be unwound.
 * @param {!Interpreter.CompletionType} type Completion type.
 * @param {?Interpreter.Value=} value Value computed, returned or thrown.
 * @param {string=} label Target label for break or return.
 */
Interpreter.prototype.unwind_ = function(thread, type, value, label) {
  if (type === Interpreter.CompletionType.NORMAL) {
    throw new TypeError('Should not unwind for NORMAL completions');
  }
  for (var stack = thread.stateStack_; stack.length > 0; stack.pop()) {
    var state = stack[stack.length - 1];
    switch (state.node['type']) {
      case 'TryStatement':
        state.info_ = {type: type, value: value, label: label};
        return;
      case 'Call':
        switch (type) {
          case Interpreter.CompletionType.BREAK:
          case Interpreter.CompletionType.CONTINUE:
            throw new Error('Unsynatctic break/continue not rejected by Acorn');
          case Interpreter.CompletionType.RETURN:
            state.value = value;
            return;
        }
        break;
    }
    if (type === Interpreter.CompletionType.BREAK) {
      if (label ? (state.labels && state.labels.includes(label)) :
          (state.isLoop || state.isSwitch)) {
        // Top of stack is now target of break.  But we are breaking
        // out of this statement, so pop to discard it.
        stack.pop();
        return;
      }
    } else if (type === Interpreter.CompletionType.CONTINUE) {
      if (label ? (state.labels && state.labels.includes(label)) :
          state.isLoop) {
        return;
      }
    }
  }

  // Unhandled completion.  Terminate thread.
  thread.status = Interpreter.Thread.Status.ZOMBIE;

  if (type === Interpreter.CompletionType.THROW) {
    // Log exception and stack trace.
    if (value instanceof this.Error) {
      this.log('unhandled', 'Unhandled %s', value);
      var stackTrace = value.get('stack', this.ROOT);
      if (stackTrace) {
        this.log('unhandled', stackTrace);
      }
    } else {
      var native = this.pseudoToNative(value);
      this.log('unhandled', 'Unhandled exception with value: %o', native);
    }
  } else {
    throw new Error('Unsynatctic break/continue/return not rejected by Acorn');
  }
};

/**
 * Get a {resovle, reject} tuple for the specified thread and state,
 * which is presumed to be about to block on an async function call.
 *
 * The resolve function takes a single argument and, when called, will
 * unblock the thread and save its argument in state.value.
 *
 * The reject function takes a single argument and, when called, will
 * unblock the thread and unwind the stack as if its argument had been
 * thrown.
 *
 * Only one of these may be called, and only once, or an internal
 * Error will be thrown.
 * @param {!Interpreter.Thread} thread The thread to be controlled.
 * @param {!Interpreter.State} state The state in which thread to block.
 * @return {{resolve: function(?Interpreter.Value=):void,
 *           reject: function(?Interpreter.Value, !Interpreter.Owner):void}}
 */
Interpreter.prototype.getResolveReject = function(thread, state) {
  var /** boolean */ done = false;

  /**
   * Throw an internal error if previously invoked or if the thread
   * does not appear to be in a plausible state.
   */
  var check = function() {
    if (done) {
      throw new Error('Async resolved or rejected more than once??');
    }
    done = true;
    if (thread.status !== Interpreter.Thread.Status.BLOCKED ||
        thread.stateStack_[thread.stateStack_.length - 1] !== state) {
      throw new Error('Thread state corrupt at async resolve/reject??');
    }
  };

  var intrp = this;
  return {
    resolve: function resolve(value) {
      check();
      state.value = value;
      thread.status = Interpreter.Thread.Status.READY;
      intrp.go_();
    },
    reject: function reject(value, perms) {
      check();
      thread.status = Interpreter.Thread.Status.READY;
      intrp.throw_(thread, value, perms);
      intrp.go_();
    }
  };
};

/**
 * Log something.
 * @param {string} category About what topic is this log?
 * @param {...*} var_args
 */
Interpreter.prototype.log = function(category, var_args) {
  if (this.options.noLog && this.options.noLog.includes(category)) {
    return;
  }
  console.log.apply(console, Array.prototype.slice.call(arguments, 1));
};

///////////////////////////////////////////////////////////////////////////////
// Nested types & constants (not fully-fledged classes)
///////////////////////////////////////////////////////////////////////////////

/**
 * The Completion Specification Type, from ES5.1 §8.9
 * @typedef {{type: Interpreter.CompletionType,
 *            value: ?Interpreter.Value,
 *            label: (string|undefined)}}
 */
Interpreter.Completion;

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
 * Special sentinel values returned by the call or construct method of
 * a (pseudo)Function to indicate that a return value is not
 * immediately available (e.g., in the case of a user function that
 * needs to be evaluated, or an async function that blocks).
 * @constructor
 * @struct
 */
Interpreter.FunctionResult = function() {};
/**
 * Please evaluate whatever state(s) have been pushed onto the stack,
 * and use their completion value as the return value of the function.
 * @const
 */
Interpreter.FunctionResult.AwaitValue = new Interpreter.FunctionResult;
/**
 * Please mark this thread as blocked awaiting eternal event (e.g.,
 * async callback).
 * @const
 */
Interpreter.FunctionResult.Block = new Interpreter.FunctionResult;
/**
 * Please invoke .call or .construct again the next time this state is
 * encountered.
 * @const
 */
Interpreter.FunctionResult.CallAgain = new Interpreter.FunctionResult;
/**
 * Please mark this thread as sleeping until its .runAt time.
 * @const
 */
Interpreter.FunctionResult.Sleep = new Interpreter.FunctionResult;

/**
 * Options object for Interpreter constructor.
 * @typedef {{
 *     noLog: (!Array<string>|undefined),
 *     trimEval: (boolean|undefined),
 *     trimProgram: (boolean|undefined),
 *     stackLimit: (number|undefined),
 * }}
 */
Interpreter.Options;

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

///////////////////////////////////////////////////////////////////////////////
// Nested (but not fully inner) classes: Scope, State, Thread, etc.
///////////////////////////////////////////////////////////////////////////////

/**
 * Typedef for the functions used to implement NativeFunction.call.
 * @typedef {function(this: Interpreter.prototype.NativeFunction,
 *                    !Interpreter,
 *                    !Interpreter.Thread,
 *                    !Interpreter.State,
 *                    ?Interpreter.Value,
 *                    !Array<?Interpreter.Value>)
 *               : (?Interpreter.Value|!Interpreter.FunctionResult)}
 */
Interpreter.NativeCallImpl;

/**
 * Typedef for the functions used to implement NativeFunction.construct.
 * @typedef {function(this: Interpreter.prototype.NativeFunction,
 *                    !Interpreter,
 *                    !Interpreter.Thread,
 *                    !Interpreter.State,
 *                    !Array<?Interpreter.Value>)
 *               : (?Interpreter.Value|!Interpreter.FunctionResult)}
 */
Interpreter.NativeConstructImpl;

/**
 * An iterator over the properties of an ObjectLike and its
 * prototypes, following the usual for-in loop rules.
 * @constructor
 * @struct
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
  /** @private @const {!Interpreter.Owner} */
  this.perms_ = perms;
  /** @private @type {!Array<string>} */
  this.keys_ = this.obj_.ownKeys(this.perms_);
  /** @private @type {number} */
  this.i_ = 0;
  /** @private @const {!Set<string>} */
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

/**
 * Class for a scope.  Implements Lexical Environments and the
 * Environment Record specification type from E5.1 §10.2 / ES6 §8.1.
 * @constructor
 * @struct
 * @param {!Interpreter.Scope.Type} type What variety of scope is it?
 * @param {!Interpreter.Owner} perms The permissions with which code
 *     in the current scope is executing.
 * @param {?Interpreter.Scope} outerScope The enclosing scope ("outer
 *     lexical environment reference", in ECMAScript spec parlance)
 * @param {?Interpreter.Value=} thisVal Value of 'this' in scope.
 *     (Default: copy value from outerScope.  N.B.: passing undefined
 *     is NOT treated the same as passing no value!)
 */
Interpreter.Scope = function(type, perms, outerScope, thisVal) {
  /** @type {!Interpreter.Scope.Type} */
  this.type = type;
  /** @type {!Interpreter.Owner} */
  this.perms = perms;
  /** @type {?Interpreter.Scope} */
  this.outerScope = outerScope;
  /** @type {?Interpreter.Value} */
  this.this = (outerScope && arguments.length < 4) ? outerScope.this : thisVal;
  /** @const {!Object<string, ?Interpreter.Value>} */
  this.vars = Object.create(null);
};

/**
 * Returns true iff this scope has a binding for the given name.
 *
 * Based on HasBinding for declarative environment records,
 * from ES5.1 §10.2.1.1.1 / ES6 §8.1.1.1.1.
 * @param {string} name Name of variable.
 * @return {boolean} True iff name is bound in this scope.
 */
Interpreter.Scope.prototype.hasBinding = function(name) {
  return name in this.vars;
};

/**
 * Returns true iff this scope has an immutable binding for the given
 * name.
 *
 * @param {string} name Name of variable.
 * @return {boolean} True iff name is immutably bound in this scope.
 */
Interpreter.Scope.prototype.hasImmutableBinding = function(name) {
  var pd = Object.getOwnPropertyDescriptor(this.vars, name);
  return Boolean(pd && !pd.writable);
};

/**
 * Creates a mutable binding in this scope and initialises it to
 * undefined or the provided value.
 *
 * Based on CreateMutableBinding for declarative environment records,
 * from ES5.1 §10.2.1.1.2 / ES6 §8.1.1.1.2.
 * @param {string} name Name of variable.
 * @param {?Interpreter.Value=} value Initial value (default: undefined).
 */
Interpreter.Scope.prototype.createMutableBinding = function(name, value) {
  if (name in this.vars) {
    throw new Error(name + ' already has binding in this scope??');
  }
  this.vars[name] = value;
};

/**
 * Creates an immutable binding in this scope and initialises it
 * to the provided value.
 *
 * Based on CreateImmutableBinding for declarative environment records,
 * from ES5.1 §10.2.1.1.7 / ES6 §8.1.1.1.3.
 * @param {string} name Name of variable.
 * @param {?Interpreter.Value} value Initial value.
 */
Interpreter.Scope.prototype.createImmutableBinding = function(name, value) {
  if (name in this.vars) {
    throw new Error(name + ' already has binding in this scope??');
  }
  Object.defineProperty(this.vars, name, Descriptor.ec.withValue(value));
};

/**
 * Updates a mutable binding in this scope to the the provided value.
 *
 * Based on SetMutableBinding for declarative environment records,
 * from ES5.1 §10.2.1.1.3 / ES6 §8.1.1.1.5.
 * @param {string} name Name of variable.
 * @param {?Interpreter.Value} value New value to set it to.
 * @return {!Error|undefined} If an error occurs, a (native) Error
 *     object is returned.  It shoud be converted into a user error
 *     (e.g., by errorNativeToPseudo) and thrown.  (This is done
 *     because Scope is not an inner class of interpreter, and thus
 *     this method has no access to the Error constructor or error
 *     prototypes.)
 */
Interpreter.Scope.prototype.set = function(name, value) {
  try {
    this.vars[name] = value;
  } catch (e) {  // Trying to set immutable binding.
    return TypeError('Assignment to constant variable ' + name);
  }
};

/**
 * Returns the value of a binding in this scope.
 *
 * Based on GetBindingValue for declarative environment records, from
 * ES5.1 §10.2.1.1.4 / ES6 §8.1.1.1.6.
 * @param {string} name Name of variable.
 * @return {?Interpreter.Value} The current value of the named variable
 *     in this scope.
 */
Interpreter.Scope.prototype.get = function(name) {
  return this.vars[name];
};

/**
 * Searches through this scope and its outer scopes to find a binding
 * for name, and returns the scope containing that binding or null if
 * name is not bound.
 *
 * Based on the Identifier Resolution algorithm of ES5.1 §10.3.1, or
 * equivalently the ResolveBinding specification function from ES6
 * §8.3.1.
 * @param {string} name Name of variable.
 * @return {?Interpreter.Scope} The scope that binds name, or null if none.
 */
Interpreter.Scope.prototype.resolve = function(name) {
  for (var s = this; s; s = s.outerScope) {
    if (name in s.vars) return s;
  }
  return null;
};

/**
 * Scope types.  These correspond roughly to the list of environment
 * record types in ES6 §8.1.1 (declarative, object, function, global),
 * but omit ones we do not use (e.g., object), and distinguish between
 * different uses of declarative environment records (e.g., for
 * binding the name of a named function expression vs. binding the
 * name of the exception in a catch clause).
 * @enum {string}
 */
Interpreter.Scope.Type = {
  /** The global scope. */
  GLOBAL: 'global',
  /** A function invocation scope. */
  FUNCTION: 'function',
  /** A scope to contain the name of a named function expression. */
  FUNEXP: 'funexp',
  /** An eval body scope. */
  EVAL: 'eval',
  /** A catch clause scope. */
  CATCH: 'catch',
  /** For use as a dummy - e.g. the caller scope in createThreadForFuncCall */
  DUMMY: 'dummy',
};

/**
 * Source is an encapsulated hunk of source text.  Source objects can
 * be sliced to obtain a Source object representing a substring of the
 * original source text.  Such sliced objects "remember" their
 * position within the original source text.
 * @constructor
 * @struct
 * @param {string} src Some source text
 * @param {number=} offset_ For internal use only.
 */
Interpreter.Source = function(src, offset_) {
  if (src === undefined) return;  // Deserializing.
  /** @private @type {string} */
  this.src_ = src;
  /** @private @type {number} */
  this.offset_ = offset_ || 0;
  Object.freeze(this);
};

/**
 * Return the contents of a Source object as an ordinary string.
 * @return {string}
 */
Interpreter.Source.prototype.toString = function() {
  return this.src_;
};

/**
 * Return a Source object representing a substring of this Source
 * object.
 * @param {number} start Offset of first character of slice, as an absolute
 *     position within the original source text.
 * @param {number} end Offset of character following last character of
 *     slice, as an absolute position within the original source text.
 * @return {!Interpreter.Source} The sliced source.
 */
Interpreter.Source.prototype.slice = function(start, end) {
  if (start < this.offset_ || start > this.offset_ + this.src_.length) {
    throw new RangeError('Source slice start out of range');
  }
  if (end < this.offset_ || end > this.offset_ + this.src_.length) {
    throw new RangeError('Source slice end out of range');
  }
  if (start > end) {
    throw new RangeError('Source slice start past end');
  }
  return new Interpreter.Source(
      this.src_.slice(start - this.offset_, end - this.offset_),
      start);
};

/**
 * Return the (1-based) line and column numbers of a given position
 * within the Source object.
 * @param {number} pos Position whose line number we are interested
 *     in, as an absolute position within the original source text.
 * @return {{line: number, col: number}} {line, col} tuple for the
 *     position pos, relative to the start of this particular slice.
 */
Interpreter.Source.prototype.lineColForPos = function(pos) {
  if (pos < this.offset_ || pos > this.offset_ + this.src_.length) {
    throw new RangeError('Source position out of range');
  }
  var lines = this.src_.slice(0, pos - this.offset_).split('\n');
  return {line: lines.length, col: lines[lines.length - 1].length + 1};
};

/**
 * Class for a state.
 * @constructor
 * @struct
 * @param {!Node} node AST node for the state.
 * @param {!Interpreter.Scope} scope Scope dictionary for the state.
 * @param {boolean=} wantRef Does parent state want reference (rather
 *     than evaluated value)?  (Default: false.)
 */
Interpreter.State = function(node, scope, wantRef) {
  /** @const {!Node} */
  this.node = node;
  /** @const {!Interpreter.Scope} */
  this.scope = scope;
  /** @const {!Interpreter.StepFunction} */
  this.stepFunc = node['stepFunc'];
  /** @private @const {boolean} */
  this.wantRef_ = wantRef || false;
  /** @type {?Interpreter.Value} */
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
  /** @private @type {?Interpreter.Value|undefined} */
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
 * @param {?Interpreter.Value} thisVal value of 'this' in function call.
 * @param {!Array<?Interpreter.Value>} args Arguments to pass.
 * @param {!Interpreter.Owner} perms Who is doing the call?
 * @return {!Interpreter.State} The newly-created state.
 */
Interpreter.State.newForCall = function(func, thisVal, args, perms) {
  // Dummy node (used only for type).
  var node = new Node;
  node['type'] = 'Call';
  node['stepFunc'] = stepFuncs_['Call'];
  // Dummy outer scope (used ony for perms, which will be caller perms).
  var scope = new Interpreter.Scope(Interpreter.Scope.Type.DUMMY, perms, null);

  var state = new Interpreter.State(node, scope);
  state.info_ = {func: func,
                 this: thisVal,
                 arguments: args,
                 directEval: false,
                 construct: false,
                 funcState: undefined};
  return state;
};

/**
 * Information about a single call stack frame.
 * @typedef{(!{func: !Interpreter.prototype.Function,
 *             this: ?Interpreter.Value,
 *             callerPerms: !Interpreter.Owner}|
 *           !{func: !Interpreter.prototype.Function,
 *             this: ?Interpreter.Value,
 *             callerPerms: !Interpreter.Owner,
 *             line: number,
 *             col: number}|
 *           !{program: string}|
 *           !{program: string,
 *             line: number,
 *             col: number}|
 *           !{eval: string}|
 *           !{eval: string,
 *             line: number,
 *             col: number})}
 */
var FrameInfo;

/**
 * If this state represents a call stack frame, or otherwise should be
 * reported in the output of callers() or in the .stack of an Error
 * object, return an object containing information about it;
 * otherwise return undefined.
 * @return {!FrameInfo|undefined}
 */
Interpreter.State.prototype.frame = function() {
  switch (this.node['type']) {
    case 'Call':
      var info = /** @type{!Interpreter.CallInfo} */(this.info_);
      if (!info.func) throw new Error('No function for Call??');
      return {
        func: info.func,
        this: info.this,
        callerPerms: this.scope.perms,  // BUG(cpcallen:perms): wrong for bind.
      };
    case 'Program':
      var source = this.node['source'];
      if (!source) throw new Error('No source for Program??');
      return {program: String(source)};
    case 'EvalProgram_':
      source = this.node['source'];
      if (!source) throw new Error('No source for EvalProgram_??');
      return {eval: String(source)};
    default:
      return undefined;
  }
};

/**
 * Class for a thread of execution.
 *
 * Note that this is an internal class; it has a companion wrapper
 * class - Interpreter.prototype.Thread a.k.a. intrp.Thread - which
 * serves as a user-visible wrapper for this class.  The two are
 * separate for performance reasons only.
 * @constructor
 * @struct
 * @param {number} id Thread ID.  Should correspond to index of this
 *     thread in .threads_ array.
 * @param {!Interpreter.State} state Starting state for thread.
 * @param {number} runAt Time at which to start running thread.
 * @param {number=} timeLimit Maximum runtime without suspending (in ms).
 */
Interpreter.Thread = function(id, state, runAt, timeLimit) {
  /** @type {number} */
  this.id = id;
  // Say it's sleeping for now.  May be woken immediately.
  /** @type {!Interpreter.Thread.Status} */
  this.status = Interpreter.Thread.Status.SLEEPING;
  /** @private @type {!Array<!Interpreter.State>} */
  this.stateStack_ = [state];
  /** @type {number} */
  this.runAt = runAt;
  /** @type {number} */
  this.timeLimit = timeLimit || 0;
  /** @type {?Interpreter.prototype.Thread} */
  this.wrapper = null;
  /** @type {?Interpreter.Value} */
  this.value = undefined;
};

/**
 * Returns the original source code for current state.
 * @param {number=} index Optional index in stack to look from.
 * @return {?Interpreter.Source} Source code or null if none.
 */
Interpreter.Thread.prototype.getSource = function(index) {
  index = (index === undefined) ? this.stateStack_.length - 1 : index;
  for (var i = index; i >= 0; i--) {
    var source = this.stateStack_[i].node['source'];
    if (source) return source;
  }
  return null;
};

/**
 * Return information about the call stack.
 * @param {!Interpreter.Owner} perms Who wants callers info?
 * @return {!Array<!FrameInfo>} The thread's call stack.
 */
Interpreter.Thread.prototype.callers = function(perms) {
  var frames = [];
  var pos;
  var lc;
  for (var i = this.stateStack_.length - 1; i >= 0; i--) {
    var state = this.stateStack_[i];
    var node = state.node;
    if (pos !== undefined && 'source' in node) {
      lc = node['source'].lineColForPos(pos);
    }
    var frame;
    if ((frame = state.frame())) {
      // TODO(cpcallen:perms): Only include line/column info if func
      // is readable by perms - otherwise it leaks some information
      // about a supposedly-unreadable function.
      if (lc) {
        frame.line = lc.line;
        frame.col = lc.col;
      }
      lc = pos = undefined;
      frames[frames.length++] = frame;
    }
    if ((frame || frames.length === 0) && pos === undefined) {
      pos = node['start'];
    }
  }
  // TODO(cpcallen): add thread-initiator info.
  return frames;
};

/**
 * Returns the permissions with which currently-executing code is
 * running (equivalent to a unix EUID, but in the form of a
 * user/group/etc. object).  It is an error to call this function on a
 * thread that is a zombie.
 * @deprecated
 * @return {!Interpreter.Owner}
 */
Interpreter.Thread.prototype.perms = function() {
  if (this.status === Interpreter.Thread.Status.ZOMBIE) {
    throw new Error('Zombie thread has no perms');
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
};

///////////////////////////////////////////////////////////////////////////////
// Inner classes of Interpreter: Declarations.
///////////////////////////////////////////////////////////////////////////////
// Types representing JS objects - Object, Function, Array, etc.
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
 * @return {!Interpreter.Descriptor|undefined}
 */
Interpreter.ObjectLike.prototype.getOwnPropertyDescriptor =
    function(key, perms) {};

/**
 * @param {string} key
 * @param {!Interpreter.Descriptor} desc
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
 * @return {?Interpreter.Value}
 */
Interpreter.ObjectLike.prototype.get = function(key, perms) {};

/**
 * @param {string} key
 * @param {?Interpreter.Value} value
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

/** @return {?Interpreter.Value} */
Interpreter.ObjectLike.prototype.valueOf = function() {};

/**
 * @constructor
 * @struct
 * @implements {Interpreter.ObjectLike}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.Object = function(owner, proto) {
  /** @type {?Interpreter.Owner} */
  this.owner;
  /** @type {?Interpreter.prototype.Object} */
  this.proto;
  /** @const {!Object<?Interpreter.Value>} */
  this.properties;
  // TODO(cpcallen): this is kind of ugly, because connected Objects
  // have their shape mutated by the on('connect') handler in Server.
  // Consider rewriting it so that there is a WeakMap on Interpreter
  // instances mapping objects to their corresponding Socket.
  /** @type {!net.Socket|undefined} */
  this.socket;
  throw new Error('Inner class constructor not callable on prototype');
};

/** @type {?Interpreter.prototype.Object} */
Interpreter.prototype.Object.prototype.proto = null;

/** @type {string} */
Interpreter.prototype.Object.prototype.class = '';

/**
 * @param {?Interpreter.prototype.Object} proto
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.prototype.Object.prototype.setPrototypeOf = function(proto, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/** @param {!Interpreter.Owner} perms @return {boolean} */
Interpreter.prototype.Object.prototype.isExtensible = function(perms) {
  throw new Error('Inner class method not callable on prototype');
};

/** @param {!Interpreter.Owner} perms @return {boolean} */
Interpreter.prototype.Object.prototype.preventExtensions = function(perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {!Interpreter.Descriptor|undefined}
 */
Interpreter.prototype.Object.prototype.getOwnPropertyDescriptor = function(
    key, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Descriptor} desc
 * @param {!Interpreter.Owner=} perms
 */
Interpreter.prototype.Object.prototype.defineProperty = function(
    key, desc, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.prototype.Object.prototype.has = function(key, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {?Interpreter.Value}
 */
Interpreter.prototype.Object.prototype.get = function(key, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {?Interpreter.Value} value
 * @param {!Interpreter.Owner} perms
 */
Interpreter.prototype.Object.prototype.set = function(key, value, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.prototype.Object.prototype.deleteProperty = function(key, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/** @param {!Interpreter.Owner} perms @return {!Array<string>} */
Interpreter.prototype.Object.prototype.ownKeys = function(perms) {
  throw new Error('Inner class method not callable on prototype');
};

/** @return {string} */
Interpreter.prototype.Object.prototype.toString = function() {
  throw new Error('Inner class method not callable on prototype');
};

/** @return {?Interpreter.Value} */
Interpreter.prototype.Object.prototype.valueOf = function() {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.Object}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.Function = function(owner, proto) {
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @param {?Interpreter.Value} value
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.prototype.Function.prototype.hasInstance = function(value, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {string} name
 * @param {string=} prefix
 */
Interpreter.prototype.Function.prototype.setName = function(name, prefix) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {!Interpreter} intrp The interpreter.
 * @param {!Interpreter.Thread} thread The current thread.
 * @param {!Interpreter.State} state The current state.
 * @param {?Interpreter.Value} thisVal The this value passed into function.
 * @param {!Array<?Interpreter.Value>} args The arguments to the call.
 * @return {?Interpreter.Value|!Interpreter.FunctionResult}
 */
Interpreter.prototype.Function.prototype.call = function(
    intrp, thread, state, thisVal, args) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {!Interpreter} intrp The interpreter.
 * @param {!Interpreter.Thread} thread The current thread.
 * @param {!Interpreter.State} state The current state.
 * @param {!Array<?Interpreter.Value>} args The arguments to the call.
 * @return {?Interpreter.Value|!Interpreter.FunctionResult}
 */
Interpreter.prototype.Function.prototype.construct = function(
    intrp, thread, state, args) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.Function}
 * @param {!Node} node
 * @param {!Interpreter.Scope} scope Enclosing scope.
 * @param {!Interpreter.Source} source
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.UserFunction = function(
    node, scope, source, owner, proto) {
  /** @type {!Node} */
  this.node;
  /** @type {!Interpreter.Scope} */
  this.scope;
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @param {!Interpreter.Owner} owner
 * @param {?Interpreter.Value} thisVal
 * @param {!Array<?Interpreter.Value>} args
 * @return {!Interpreter.Scope}
 * @private
 */
Interpreter.prototype.UserFunction.prototype.instantiateDeclarations_ =
function(owner, thisVal, args) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.Function}
 * @param {!Interpreter.prototype.Function} func
 * @param {?Interpreter.Value} thisVal
 * @param {!Array<?Interpreter.Value>} args
 * @param {?Interpreter.Owner=} owner
 */
Interpreter.prototype.BoundFunction = function(func, thisVal, args, owner) {
  /** @type {!Interpreter.prototype.Function} */
  this.boundFunc;
  /** @type {?Interpreter.Value} */
  this.thisVal;
  /** @type {!Array<?Interpreter.Value>} */
  this.args;
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.Function}
 * @param {!NativeFunctionOptions=} options
 */
Interpreter.prototype.NativeFunction = function(options) {
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.NativeFunction}
 * @param {!Function} impl
 * @param {boolean} legalConstructor
 * @param {!NativeFunctionOptions=} options
 */
Interpreter.prototype.OldNativeFunction =
    function(impl, legalConstructor, options) {
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.Object}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.Array = function(owner, proto) {
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.Object}
 * @param {!Date} date
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.Date = function(date, owner, proto) {
  /** @type {!Date} */
  this.date;
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.Object}
 * @param {!RegExp=} re
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.RegExp = function(re, owner, proto) {
  /** @type {!RegExp} */
  this.regexp;
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.Object}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 * @param {string=} message
 * @param {!Array<!FrameInfo>=} callers
 */
Interpreter.prototype.Error = function(owner, proto, message, callers) {
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @param {!Array<!FrameInfo>} callers
 * @param {!Interpreter.Owner} perms
 */
Interpreter.prototype.Error.prototype.makeStack = function(callers, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.Object}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.Arguments = function(owner, proto) {
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.Object}
 * @param {?Interpreter.Owner=} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.WeakMap = function(owner, proto) {
  /** @type {!IterableWeakMap} */
  this.weakMap;
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @extends {Interpreter.prototype.Object}
 * @param {!Interpreter.Thread} thread
 * @param {!Interpreter.Owner} owner
 * @param {?Interpreter.prototype.Object=} proto
 */
Interpreter.prototype.Thread = function(thread, owner, proto) {
  /** @type {!Interpreter.Thread} */
  this.thread;
  throw new Error('Inner class constructor not callable on prototype');
};

///////////////////////////////////////////////////////////////////////////////
// Other types, not representing JS objects.
/**
 * @constructor
 * @struct
 * @implements {Interpreter.ObjectLike}
 * @param {(boolean|number|string)} prim
 */
Interpreter.prototype.Box = function(prim) {
  /** @private @type {(undefined|null|boolean|number|string)} */
  this.primitive_;
  /** @type {!Interpreter.prototype.Object} */
  this.proto;
  throw new Error('Inner class constructor not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {!Interpreter.Descriptor|undefined}
 */
Interpreter.prototype.Box.prototype.getOwnPropertyDescriptor = function(
    key, perms) {
  throw new Error('Inner class method not callable on prototype');
}
/**
 * @param {string} key
 * @param {!Interpreter.Descriptor} desc
 * @param {!Interpreter.Owner} perms
 */
Interpreter.prototype.Box.prototype.defineProperty = function(
    key, desc, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.prototype.Box.prototype.has = function(key, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {?Interpreter.Value}
 */
Interpreter.prototype.Box.prototype.get = function(key, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @param {?Interpreter.Value} value
 */
Interpreter.prototype.Box.prototype.set = function(key, value, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {string} key
 * @param {!Interpreter.Owner} perms
 * @return {boolean}
 */
Interpreter.prototype.Box.prototype.deleteProperty = function(key, perms) {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @param {!Interpreter.Owner} perms
 * @return {!Array<string>}
 */
Interpreter.prototype.Box.prototype.ownKeys = function(perms) {
  throw new Error('Inner class method not callable on prototype');
};

/** @return {string} String value. */
Interpreter.prototype.Box.prototype.toString = function() {
  throw new Error('Inner class method not callable on prototype');
};

/** @return {?Interpreter.Value} Value. */
Interpreter.prototype.Box.prototype.valueOf = function() {
  throw new Error('Inner class method not callable on prototype');
};

/**
 * @constructor
 * @struct
 * @param {!Interpreter.Owner} owner
 * @param {number} port
 * @param {!Interpreter.prototype.Object} proto
 * @param {number=} timeLimit
 */
Interpreter.prototype.Server = function(owner, port, proto, timeLimit) {
  /** @type {!Interpreter.Owner} */
  this.owner;
  /** @type {number} */
  this.port;
  /** @type {!Interpreter.prototype.Object} */
  this.proto;
  /** @type {number} */
  this.timeLimit;
  /** @private @type {!net.Server} */
  this.server_;
  throw new Error('Inner class constructor not callable on prototype');
};

/** @param {!function(!Error=)=} callback */
Interpreter.prototype.Server.prototype.listen = function(callback) {
  throw new Error('Inner class method not callable on prototype');
};

/** @param {!function()=} callback */
Interpreter.prototype.Server.prototype.unlisten = function(callback) {
  throw new Error('Inner class method not callable on prototype');
};

///////////////////////////////////////////////////////////////////////////////
// Inner classes of Interpreter: Implementations.
///////////////////////////////////////////////////////////////////////////////

/**
 * Install the actual Object, Function, Array, RegExp, Error,
 * etc. constructors on an Interpreter instance.  Should
 * be called just once, from the Interpreter constructor.
 */
Interpreter.prototype.installTypes = function() {
  var intrp = this;  // The interpreter instance to which these classes belong.

  /////////////////////////////////////////////////////////////////////////////
  // Types representing JS objects - Object, Function, Array, etc.
  /**
   * Class for an object.
   * @constructor
   * @struct
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
    this.owner = owner;
    this.proto = proto;
    this.properties = Object.create((proto === null) ? null : proto.properties);
  };

  /** @type {?Interpreter.prototype.Object} */
  intrp.Object.prototype.proto = null;
  /** @type {string} */
  intrp.Object.prototype.class = 'Object';

  /**
   * The [[SetPrototypeOf]] internal method from ES6 §9.1.2, with
   * substantial adaptations for Code City including added perms
   * checks.
   *
   * N.B.: Note that instead of returning false, this implementation
   * will throw a more specific error in the event that the set fails.
   * approriate error upon failure.
   * @param {?Interpreter.prototype.Object} proto The new prototype or null.
   * @param {!Interpreter.Owner} perms Who is trying set the prototype?
   * @return {boolean} True iff the set succeeded.
   */
  intrp.Object.prototype.setPrototypeOf = function(proto, perms) {
    if (perms === null) throw new TypeError("null can't check extensibility");
    // TODO(cpcallen:perms): add "controls"-type perm check.
    if (proto === this.proto) {  // Doing nothing always succeeds.
      return true;
    } else if (!this.isExtensible(perms)) {
      throw new intrp.Error(perms, intrp.TYPE_ERROR,
          "Can't set prototype of non-extensible object");
    }
    for (var p = proto; p !== null; p = p.proto) {
      if (p === this) {
        throw new intrp.Error(perms, intrp.TYPE_ERROR,
            "An object's prototype chain can't include the object itself");
      }
    }
    Object.setPrototypeOf(this.properties, proto && proto.properties);
    this.proto = proto;
    return true;
  };

  /**
   * The [[IsExtensible]] internal method from ES6 §9.1.3, with
   * substantial adaptations for Code City including added perms
   * checks.
   * @param {!Interpreter.Owner} perms Who is trying to check?
   * @return {boolean} Is the object extensible?
   */
  intrp.Object.prototype.isExtensible = function(perms) {
    if (perms === null) throw new TypeError("null can't check extensibility");
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
    if (perms === null) throw new TypeError("null can't prevent extensibions");
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
   * @return {!Interpreter.Descriptor|undefined} The property
   *     descriptor, or undefined if no such property exists.
   */
  intrp.Object.prototype.getOwnPropertyDescriptor = function(key, perms) {
    if (perms === null) {
      throw new TypeError("null can't getOwnPropertyDescriptor");
    }
    // TODO(cpcallen:perms): add check for (property) readability.
    var pd = Object.getOwnPropertyDescriptor(this.properties, key);
    // TODO(cpcallen): can we eliminate this pointless busywork while
    // still maintaining type safety?
    return pd && new Descriptor(pd.writable, pd.enumerable, pd.configurable)
        .withValue(/** @type {?Interpreter.Value} */ (pd.value));
  };

  /**
   * The [[DefineOwnProperty]] internal method from ES5.1 §8.12.9,
   * with substantial adaptations for Code City including added perms
   * checks (but no support for getter or setters).
   * @param {string} key Key (name) of property to set.
   * @param {!Interpreter.Descriptor} desc The property descriptor.
   * @param {!Interpreter.Owner=} perms Who is trying to set it?  If
   *     omitted, defaults to this.owner but skips perm check.  (This
   *     is intended to be used only when constructing.)
   */
  intrp.Object.prototype.defineProperty = function(key, desc, perms) {
    if (perms !== undefined) {
      if (perms === null) throw new TypeError("null can't defineProperty");
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
    if (perms === null) throw new TypeError("null can't has");
    // TODO(cpcallen:perms): add check for (object) readability.
    return key in this.properties;
  };

  /**
   * The [[Get]] internal method from ES5.1 §8.12.3, with substantial
   * adaptations for Code City including added perms checks (but no
   * support for getters).
   * @param {string} key Key (name) of property to get.
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {?Interpreter.Value} The value of the property, or undefined.
   */
  intrp.Object.prototype.get = function(key, perms) {
    if (perms === null) throw new TypeError("null can't get");
    // TODO(cpcallen:perms): add check for (property) readability.
    return this.properties[key];
  };

  /**
   * The [[Set]] internal method from ES5.1 §8.12.5, with substantial
   * adaptations for Code City including added perms checks (but no
   * support for setters).
   * @param {string} key Key (name) of property to set.
   * @param {!Interpreter.Owner} perms Who is trying to set it?
   * @param {?Interpreter.Value} value The new value of the property.
   */
  intrp.Object.prototype.set = function(key, value, perms) {
    if (perms === null) throw new TypeError("null can't set");
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
    if (perms === null) throw new TypeError("null can't delete");
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
    if (perms === null) throw new TypeError("null can't ownPropertyKeys");
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
    // TODO(cpcallen:perms): perms check here?
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
   * @return {?Interpreter.Value} Value.
   * @override
   */
  intrp.Object.prototype.valueOf = function() {
    return this;
  };

  /**
   * Class for a function.
   * @constructor
   * @struct
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
   * Convert this function into a string.
   * @override
   * @this {!Interpreter.prototype.Function}
   */
  intrp.Function.prototype.toString = function() {
    // Just do the simplest possible (spec-compliant) thing here.
    return 'function () { [native code] }';
  };

  /**
   * The [[HasInstance]] internal method from §15.3.5.3 of the ES5.1 spec.
   * @param {?Interpreter.Value} value The value to be checked for
   *     being an instance of this function.
   * @param {!Interpreter.Owner} perms Who wants to know?  Used in
   *     readability check of .constructor property and as owner of
   *     any Errors thrown.
   * @return {boolean}
   * @override
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
   * Add a .name property to this function object.  Implements
   * SetFunctionName from ES6 §9.2.11.
   *
   * N.B.: The setting is not subject to any perms checks, so it must
   * not be possible for a user to cause this internal method to be
   * invoked on any function object owned by another user.  Typically
   * this will be enforced by only invoking this method at the time
   * the function is constructed, or immediately afterwards by a
   * lexically-enclosing expression having first used tested the
   * expression which resulted in the function value with
   * isAnonymousFunctionDefinition (q.v.).
   *
   * TODO(ES6): allow name to be type Symbol.
   * @param {string} name Name of function.
   * @param {string=} prefix Prefix for function name (e.g. 'get', 'bound').
   * @override
   */
  intrp.Function.prototype.setName = function(name, prefix) {
    if (prefix) {
      name = prefix + ' ' + name;
    }
    this.defineProperty('name', Descriptor.c.withValue(name));
  };

  /**
   * The [[Call]] internal method defined by §13.2.1 of the ES5.1 spec.
   * Generic functions (neither native nor user) can't be called.
   * @param {!Interpreter} intrp The interpreter.
   * @param {!Interpreter.Thread} thread The current thread.
   * @param {!Interpreter.State} state The current state.
   * @param {?Interpreter.Value} thisVal The this value passed into function.
   * @param {!Array<?Interpreter.Value>} args The arguments to the call.
   * @return {?Interpreter.Value}
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
   * @param {!Array<?Interpreter.Value>} args The arguments to the call.
   * @return {?Interpreter.Value}
   * @override
   */
  intrp.Function.prototype.construct = function(
      intrp, thread, state, args) {
    throw new intrp.Error(state.scope.perms, intrp.TYPE_ERROR,
        this + ' is not a constructor');
  };

  /**
   * Class for a user-defined function.
   * @constructor
   * @struct
   * @extends {Interpreter.prototype.UserFunction}
   * @param {!Node} node AST node for function body.
   * @param {!Interpreter.Scope} scope Enclosing scope.
   * @param {!Interpreter.Source} source Source from which AST was parsed.
   * @param {?Interpreter.Owner=} owner Owner object (default: null).
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.UserFunction = function(node, scope, source, owner, proto) {
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
    // Record the source on the function node's body node.  Store it
    // on the AST (rather than on the UserFunction instance) because
    // each time a function expression is evaluated a new UserFunction
    // is created, but they all have identical source code.  Store it
    // on the body node (rather than on the function node) because the
    // function node never appears on the stateStack_ when the
    // function is being executed.
    if (!node['body']['source']) {
      node['body']['source'] = source.slice(node['start'], node['end']);
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
    // TODO(cpcallen:perms): perms check here?
    return String(this.node['body']['source']);
  };

  /**
   * The [[Call]] internal method defined by §13.2.1 of the ES5.1 spec.
   * N.B.: This function (or any called from or overriding it) must
   * not use state.info_.funcState, as that it used by
   * Userfunction.prototype.construct, which calls us.
   * @override
   */
  intrp.UserFunction.prototype.call = function(
      intrp, thread, state, thisVal, args) {
    if (this.owner === null) {
      throw new intrp.Error(state.scope.perms, intrp.PERM_ERROR,
          'Functions with null owner are not executable');
    }
    var scope = this.instantiateDeclarations_(this.owner, thisVal, args);
    state.value = undefined;  // Default value if no explicit return.
    thread.stateStack_[thread.stateStack_.length] =
        new Interpreter.State(this.node['body'], scope);
    return Interpreter.FunctionResult.AwaitValue;
  };

  /**
   * The [[Construct]] internal method defined by §13.2.2 of the ES5.1
   * spec.
   * @override
   */
  intrp.UserFunction.prototype.construct = function(
      intrp, thread, state, args) {
    if (!state.info_.funcState) {  // First visit.
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
      state.info_.funcState = new intrp.Object(state.scope.perms, proto);
      this.call(intrp, thread, state, state.info_.funcState, args);
      return Interpreter.FunctionResult.CallAgain;
    } else {  // Construction done.  Check result.
      // Per ES5.1 §13.2.2 steps 9, 10: if constructor returns
      // primitive, return constructed object instead.
      if (!(state.value instanceof intrp.Object)) {
        return /** @type {?Interpreter.Value} */ (state.info_.funcState);
      }
      return state.value;
    }
  };

  /**
   * A simplified version of the FunctionDeclarationInstantiation
   * specification function from ES6 §9.2.12 (see also Declaration
   * Binding Instantiation in ES5.1 §10.5).
   *
   * Creates a new Scope and sets up the bindings of the function's
   * parameters and variables.
   * @param {!Interpreter.Owner} owner Owner for new Scope.
   * @param {?Interpreter.Value} thisVal The value of 'this' for the call.
   * @param {!Array<?Interpreter.Value>} args The arguments to the call.
   * @return {!Interpreter.Scope} The initialised scope
   * @private
   */
  intrp.UserFunction.prototype.instantiateDeclarations_ = function(
      owner, thisVal, args) {
    // Aside: we need to pass owner, rather than
    // this.scope.perms, for the new scope perms because (1) we want
    // to be able to change the owner of a function after it's
    // created, and (2) functions created using the Function
    // constructor have this.scope set to the global scope, which is
    // owned by root!
    var scope = new Interpreter.Scope(
        Interpreter.Scope.Type.FUNCTION, owner, this.scope, thisVal);
    // Add all arguments to the scope.
    var params = this.node['params'];
    for (var i = 0; i < params.length; i++) {
      var paramName = params[i]['name'];
      var paramValue = args.length > i ? args[i] : undefined;
      scope.createMutableBinding(paramName, paramValue);
    }
    var body = this.node['body'];
    if (!('arguments' in getBoundNames(body)) &&
        hasArgumentsOrEval(body)) {
      // Build arguments object.
      var argsObj = new intrp.Arguments(owner);
      argsObj.defineProperty(
          'length', Descriptor.wc.withValue(args.length), owner);
      for (i = 0; i < args.length; i++) {
        argsObj.defineProperty(
            String(i), Descriptor.wec.withValue(args[i]), owner);
      }
      scope.createImmutableBinding('arguments', argsObj);
    }
    // Populate local variables and other inner declarations.
    intrp.populateScope_(body, scope);
    return scope;
  };

  /**
   * Class for bound functions.  See ES5 §15.3.4.5 / ES6 §9.4.1.
   * @constructor
   * @struct
   * @extends {Interpreter.prototype.BoundFunction}
   * @param {!Interpreter.prototype.Function} func Function to be bound.
   * @param {?Interpreter.Value} thisVal The this value passed into function.
   * @param {!Array<?Interpreter.Value>} args Arguments to prefix to the call.
   * @param {?Interpreter.Owner=} owner Owner object (default: null).
   */
  intrp.BoundFunction = function(func, thisVal, args, owner) {
    if (!func) return;  // Deserializing
    intrp.Function.call(/** @type {?} */ (this), owner, func.proto);
    /** @type {!Interpreter.prototype.Function} */
    this.boundFunc = func;
    /** @type {?Interpreter.Value} */
    this.thisVal = thisVal;
    /** @type {!Array<?Interpreter.Value>} */
    this.args = args;
  };

  intrp.BoundFunction.prototype = Object.create(intrp.Function.prototype);
  intrp.BoundFunction.prototype.constructor = intrp.BoundFunction;

  /**
   * The [[Call]] internal method for bound functions, defined by
   * ES5.1 §15.3.4.5.1 / ES6 §9.4.1.1.
   *
   * BUG(cpcallen:perms): the target function will see callerPerms
   * being whoever called the bound function, but should see
   * callerPerms being the owner of the bound function.
   * @override
   */
  intrp.BoundFunction.prototype.call = function(
      intrp, thread, state, thisVal, args) {
    // TODO(cpcallen:perms): Consider carefully whose perms should be
    // used where!
    if (this.owner === null) {
      throw new intrp.Error(state.scope.perms, intrp.PERM_ERROR,
          'Functions with null owner are not executable');
    }
    var argList = this.args.concat(args);
    // Rewrite state.info_, as a short-circuit optimisation in case
    // we get called again due to FunctionResult.CallAgain, and also
    // to produce more useful callers() output / stack traces.
    var info = state.info_;
    info.func = this.boundFunc;
    info.this = this.thisVal;
    info.args = argList;
    info.construct = false;
    // But just go and do the first .call directly.
    return this.boundFunc.call(intrp, thread, state, this.thisVal, argList);
  };

  /**
   * The [[Construct]] internal method for bound functions, defined by
   * ES5.1 §15.3.4.5.2 / ES6 §9.4.1.2.
   *
   * BUG(cpcallen:perms): the target function will see callerPerms
   * being whoever called the bound function, but should see
   * callerPerms being the owner of the bound function.
   * @override
   */
  intrp.BoundFunction.prototype.construct = function(
      intrp, thread, state, args) {
    // TODO(cpcallen:perms): Consider carefully whose perms should be
    // used where!
    if (this.owner === null) {
      throw new intrp.Error(state.scope.perms, intrp.PERM_ERROR,
          'Functions with null owner are not constructable');
    }
    var argList = this.args.concat(args);
    // Rewrite state.info_, as a short-circuit optimisation in case
    // we get called again due to FunctionResult.CallAgain, and also
    // to produce more useful callers() output / stack traces.
    var info = state.info_;
    info.func = this.boundFunc;
    info.this = this.thisVal;
    info.args = argList;
    info.construct = true;
    // But just go and do the first .construct directly.
    return this.boundFunc.construct(intrp, thread, state, argList);
  };

  /**
   * Class for a native function.  Options are as follows:
   *
   * If options.name is a non-empty string, the new function object's
   * .name property will be set to this value.  Otherwise, if
   * options.id is a non-empty string, the part following the last '.'
   * will be used instead.
   *
   * If options.length is supplied, the new object's .length will be
   * set to this value.
   *
   * If options.id is a non-empty string, the new native function
   * object will be registered as a builtin with that id value.
   *
   * The options.call and .construct will be used for the [[Call]] and
   * [[Construct]] specifications methods respectively.  If omitted,
   * the function will not be callable / constructable.
   *
   * The new object will be owned by options.owner (default:
   * intrp.ROOT), and have prototype options.proto (default:
   * intrp.FUNCTION - i.e., Function.prototype).
   *
   * @constructor
   * @struct
   * @extends {Interpreter.prototype.NativeFunction}
   * @param {!NativeFunctionOptions=} options Options object for
   *     constructing native function.
   */
  intrp.NativeFunction = function(options) {
    options = options || {};
    var owner = (options.owner !== undefined ? options.owner : intrp.ROOT);
    // Invoke super constructor.
    intrp.Function.call(/** @type {?} */ (this), owner, options.proto);
    // Set .name if name or id supplied, and save original name internally.
    // N.B.: Function.prototype gets .name === ''.
    /** The initial value of the .name property.  @type {string|undefined} */
    this.name = undefined;
    if (options.name !== undefined) {
      this.name = options.name;
    } else if (options.id) {
      this.name = options.id.replace(/^.*\./, '');
    }
    if (this.name !== undefined) this.setName(this.name);
    // Set .length if length supplied.
    if (options.length !== undefined) {
      this.defineProperty('length', Descriptor.none.withValue(options.length),
                          owner);
    }
    // Register as builtin if id supplied.
    if (options.id) {
      intrp.builtins.set(options.id, this);
    }
    // Install [[Call]] and [[Construct]] methods, making sure they
    // are labelled for serialization (if possible and not already).
    var serialId = options.id || options.name;
    if (options.call) {
      this.call = options.call;
      if (serialId && !('id' in this.call)) {
        this.call.id = serialId + ' [[Call]]';
      }
    }
    if (options.construct) {
      this.construct = options.construct;
      if (serialId && !('id' in this.construct)) {
        this.construct.id = serialId + ' [[Construct]]';
      }
    }
  };

  intrp.NativeFunction.prototype = Object.create(intrp.Function.prototype);
  intrp.NativeFunction.prototype.constructor = intrp.NativeFunction;

  /**
   * Convert this function into a string.  This implements
   * https://tc39.es/Function-prototype-toString-revision/#proposal-sec-function.prototype.tostring
   * (now adopted) as it applies to "Well-known Intrinsic Object[s]"
   * as well as any other NativeFunction constructed with specified
   * name or id.
   * @override
   */
  intrp.NativeFunction.prototype.toString = function() {
    if (this.name === undefined) {
      return intrp.Function.prototype.toString.call(this);
    }
    // TODO(cpcallen): include formal parameter names?
    return 'function ' + this.name + '() { [native code] }';
  };

  /**
   * Class for an old native function.
   * @constructor
   * @struct
   * @extends {Interpreter.prototype.OldNativeFunction}
   * @param {!Function} impl Old-style native function implementation
   * @param {boolean} legalConstructor True if the function can be used as a
   *     constructor (e.g. Array), false if not (e.g. escape).
   * @param {!NativeFunctionOptions=} options Options object for
   *     constructing the underlying NativeFunction.
   */
  intrp.OldNativeFunction = function(impl, legalConstructor, options) {
    if (!impl) return;  // Deserializing
    intrp.NativeFunction.call(/** @type {?} */ (this), options);
    /** @type {!Function} */
    this.impl = impl;
    /** @type {boolean} */
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
   * Class for an array
   * @constructor
   * @struct
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
    // BUG(cpcallen): toString should access properties on this with
    // the caller's permissions - but at present there is no way to
    // determine who it was called by, so use intrp.ANYBODY instead.
    var visited = intrp.toStringVisited_;
    if (visited.has(this)) {
      return '';
    }
    visited.add(this);
    try {
      var strs = [];
      var len = this.get('length', intrp.ANYBODY);
      for (var i = 0; i < this.properties.length; i++) {
        var value = this.get(String(i), intrp.ANYBODY);
        if (value === null || value === undefined) {
          strs[i] = '';
        } else {
          strs[i] = String(value);
        }
      }
    } finally {
      visited.delete(this);
    }
    return strs.join(',');
  };

  /**
   * Class for a date.
   * @constructor
   * @struct
   * @extends {Interpreter.prototype.Date}
   * @param {!Date} date Date value for this Date object.
   * @param {?Interpreter.Owner=} owner Owner object or null.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.Date = function(date, owner, proto) {
    if (!date) return;  // Deserializing
    intrp.Object.call(/** @type {?} */ (this), owner,
        (proto === undefined ? intrp.DATE : proto));
    /** @type {!Date} */
    this.date = date;
  };

  intrp.Date.prototype = Object.create(intrp.Object.prototype);
  intrp.Date.prototype.constructor = intrp.Date;
  intrp.Date.prototype.class = 'Date';

  /**
   * Return the date as a string.
   * @override
   */
  intrp.Date.prototype.toString = function() {
    // TODO(cpcallen:perms): perms check here?
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
   * @struct
   * @extends {Interpreter.prototype.RegExp}
   * @param {!RegExp=} re The RegExp value for this RegExp object.
   * @param {?Interpreter.Owner=} owner Owner object or null.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.RegExp = function(re, owner, proto) {
    if (!re) return;  // Deserializing
    intrp.Object.call(/** @type {?} */ (this), owner,
        (proto === undefined ? intrp.REGEXP : proto));
    /** @type {!RegExp} */
    this.regexp = re;
    // lastIndex is settable, all others are read-only attributes
    this.defineProperty('lastIndex', Descriptor.w.withValue(re.lastIndex));
    this.defineProperty('source', Descriptor.none.withValue(re.source));
    this.defineProperty('global', Descriptor.none.withValue(re.global));
    this.defineProperty('ignoreCase', Descriptor.none.withValue(re.ignoreCase));
    this.defineProperty('multiline', Descriptor.none.withValue(re.multiline));
  };

  intrp.RegExp.prototype = Object.create(intrp.Object.prototype);
  intrp.RegExp.prototype.constructor = intrp.RegExp;
  intrp.RegExp.prototype.class = 'RegExp';

  /**
   * Return the regexp as a string.
   * @override
   */
  intrp.RegExp.prototype.toString = function() {
    // TODO(cpcallen:perms): perms check here?
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
   * Class for an error object
   * @constructor
   * @struct
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
  };

  intrp.Error.prototype = Object.create(intrp.Object.prototype);
  intrp.Error.prototype.constructor = intrp.Error;
  intrp.Error.prototype.class = 'Error';

  /**
   * Return the error as a string.
   * @override
   */
  intrp.Error.prototype.toString = function() {
    // BUG(cpcallen): toString should access properties on this with
    // the caller's permissions - but at present there is no way to
    // determine who it was called by, so use intrp.ANYBODY instead.
    var visited = intrp.toStringVisited_;
    if (visited.has(this)) {
      return '';
    }
    visited.add(this);
    try {
      var name = this.get('name', intrp.ANYBODY);
      var message = this.get('message', intrp.ANYBODY);
      name = (name === undefined) ? 'Error' : String(name);
      message = (message === undefined) ? '' : String(message);
      if (name) {
        return message ? (name + ': ' + message) : name;
      }
      return message;
    } finally {
      visited.delete(this);
    }
  };

  /**
   * Create a .stack property on the error from the given call stack
   * information, if it does not already have one.  The stack property
   * will be created with the permissions of the owner of the Error
   * object.
   *
   * BUG(cpcallen): because this is called before unwinding the stack
   * when an intrp.Error is thrown, and because .stack is set
   * unconditionally (without perm check), any user can set .stack on
   * any Error object that doesn't already have one (including
   * e.g. Error.prototype) just by throwing it.
   * @param {!Array<!FrameInfo>} callers List of call stack frames,
   *     as returned by Thread.prototype.callers.
   * @param {!Interpreter.Owner} perms Whose perms should be used to
   *     obtain (e.g.) function names, etc.?
   * @override
   */
  intrp.Error.prototype.makeStack = function(callers, perms) {
    if (this.has('stack', intrp.ROOT)) {
      return;  // Do not overwrite existing .stack
    }
    var stack = [];
    for (var i = 0; i < callers.length; i++) {
      var /** string */ line = '    ';
      var frame = callers[i];
      if ('func' in frame) {
        var /** !Interpreter.prototype.Function */ func = frame.func;
        var /** string */ name;
        try {
          var pd = func.getOwnPropertyDescriptor('name', perms);
          if (pd) {
            name = String(pd.value);
          } else {
            name = 'anonymous function';
          }
        } catch (e) {
          name = 'unreadable function';
        }
      } else if ('eval' in frame) {
        name = '"' + frame.eval + '"';
      } else if ('program' in frame) {
        name = '"' + frame.program + '"';
      }
      if ('line' in frame) {
        line += 'at ' + name + ' ' + frame.line + ':' + frame.col;
      } else {
        line += 'in ' + name;
      }
      stack.push(line);
    }
    this.defineProperty('stack', Descriptor.wc.withValue(stack.join('\n')));
  };

  /**
   * Class for an arguments object.  See ES5 §10.6 / ES6 §9.4.4.
   *
   * N.B.: Does not support mapped properties because we are always in
   * strict mode.  Does not implement the special always-throw getters
   * for .callee and .caller, because we do not support getters.
   * What's left is basically an ordinary object with a special
   * [[Class]].
   * @constructor
   * @struct
   * @extends {Interpreter.prototype.Arguments}
   * @param {?Interpreter.Owner=} owner Owner object or null.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.Arguments = function(owner, proto) {
    intrp.Object.call(/** @type {?} */ (this), owner, proto);
  };

  intrp.Arguments.prototype = Object.create(intrp.Object.prototype);
  intrp.Arguments.prototype.constructor = intrp.Arguments;
  intrp.Arguments.prototype.class = 'Arguments';

  /**
   * The WeakMap class from ES6.
   * @constructor
   * @struct
   * @extends {Interpreter.prototype.WeakMap}
   * @param {?Interpreter.Owner=} owner Owner object or null.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.WeakMap = function(owner, proto) {
    intrp.Object.call(/** @type {?} */ (this), owner,
        (proto === undefined ? intrp.WEAKMAP : proto));
    /** @type {!IterableWeakMap} */
    this.weakMap = new IterableWeakMap;
  };

  intrp.WeakMap.prototype = Object.create(intrp.Object.prototype);
  intrp.WeakMap.prototype.constructor = intrp.WeakMap;
  intrp.WeakMap.prototype.class = 'WeakMap';

  /**
   * Class for the user-visible representation of an Interpreter.Thread.
   *
   * Note that there should be at most one of these wrappers for each
   * Interpreter.Thread, and this constructor enforces this.
   * @constructor
   * @struct
   * @extends {Interpreter.prototype.Thread}
   * @param {!Interpreter.Thread} thread Thread represented by this object.
   * @param {!Interpreter.Owner} owner Owner of this thread.
   * @param {?Interpreter.prototype.Object=} proto Prototype object or null.
   */
  intrp.Thread = function(thread, owner, proto) {
    if (!thread) return;  // Deserializing
    if (thread.wrapper) {
      throw new Error('Duplicate Thread wrapper??');
    }
    intrp.Object.call(/** @type {?} */ (this), owner,
        (proto === undefined ? intrp.THREAD : proto));
    /** @type {!Interpreter.Thread} */
    this.thread = thread;
    this.thread.wrapper = this;
    this.defineProperty('id', Descriptor.none.withValue(thread.id), owner);
  };

  intrp.Thread.prototype = Object.create(intrp.Object.prototype);
  intrp.Thread.prototype.constructor = intrp.Thread;
  intrp.Thread.prototype.class = 'Thread';

  /////////////////////////////////////////////////////////////////////////////
  // Other types, not representing JS objects.
  /**
   * Class for a boxed primitive.  Does not @extend
   * Interpreter.prototype.Object, because we do not want to expose
   * these to the users.  They're just used internally to simplify the
   * implementation of various bits of code that are specified by
   * ES5.1 or ES6 to do ToObject().
   *
   * @constructor
   * @struct
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
      throw new Error('Invalid type in Box');
    }
  };

  /**
   * The [[GetOwnOwnProperty]] internal method from ES5.1 §8.12.1, as
   * applied to temporary Boolean, Number and String class objects.
   * @param {string} key Key (name) of property to get.
   * @param {!Interpreter.Owner} perms Who is trying to get it?
   * @return {!Interpreter.Descriptor|undefined} The property
   *     descriptor, or undefined if no such property exists.
   * @override
   */
  intrp.Box.prototype.getOwnPropertyDescriptor = function(key, perms) {
    var pd = Object.getOwnPropertyDescriptor(this.primitive_, key);
    // TODO(cpcallen): can we eliminate this pointless busywork while
    // still maintaining type safety?
    return pd && new Descriptor(pd.writable, pd.enumerable, pd.configurable)
        .withValue(/** @type {?Interpreter.Value} */ (pd.value));
  };

  /**
   * The [[DefineOwnProperty]] internal method from ES5.1 §8.12.9, as
   * applied to temporary Boolean, Number and String class objects.
   * @param {string} key Key (name) of property to set.
   * @param {!Interpreter.Descriptor} desc The property descriptor.
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
   * @return {?Interpreter.Value} The value of the property, or undefined.
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
   * @param {?Interpreter.Value} value The new value of the property.
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
   * @return {?Interpreter.Value} Value.
   * @override
   */
  intrp.Box.prototype.valueOf = function() {
    return this.primitive_;
  };

  /**
   * Server is an (owner, port, proto, (extra info)) tuple representing a
   * listening server.  It encapsulates node's net.Server type, with
   * some additional info needed to implement the connectionListen()
   * API.  In its present form it is not suitable for exposure as a
   * userland pseduoObject, but it is intended to be easily adaptable
   * for that if desired.
   * @constructor
   * @struct
   * @extends {Interpreter.prototype.Server}
   * @param {!Interpreter.Owner} owner Owner object or null.
   * @param {number} port Port to listen on.
   * @param {!Interpreter.prototype.Object} proto Prototype object for
   *     new connections.
   * @param {number=} timeLimit Maximum runtime without suspending (in ms).
   */
  intrp.Server = function(owner, port, proto, timeLimit) {
    // Special excepetion: port === undefined when deserializing, in
    // violation of usual type rules.
    if ((port !== (port >>> 0) || port > 0xffff) && port !== undefined) {
      throw new RangeError('invalid port ' + port);
    }
    /** @type {!Interpreter.Owner} */
    this.owner = owner;
    /** @type {number} */
    this.port = port;
    /** @type {!Interpreter.prototype.Object} */
    this.proto = proto;
    /** @type {number} */
    this.timeLimit = timeLimit || 0;
    /** @type {!net.Server} */
    this.server_ = new net.Server({allowHalfOpen: true});

    // Create the net.Server instance and set up event handlers but
    // don't yet start it listening.
    var server = this;  // So we can refer to it in handlers below.
    this.server_.on('connection', function(socket) {
      intrp.log('net', 'Connection on :%s from %s:%s',
                server.port, socket.remoteAddress, socket.remotePort);
      // TODO(cpcallen): Add localhost test here, like this - only
      // also allow IPV6 connections:
      // if (socket.remoteAddress != '127.0.0.1') {
      //   // Reject connections other than from localhost.
      //   intrp.log('net', 'Rejecting connection from ' +
      //       socket.remoteAddress);
      //   socket.end('Connection rejected.');
      //   return;
      // }

      // Create new object from proto and call onConnect.
      var obj = new intrp.Object(server.owner, server.proto);
      obj.socket = socket;
      var func = obj.get('onConnect', server.owner);
      if (func instanceof intrp.Function && server.owner !== null) {
        // TODO(cpcallen:perms): Is server.owner the correct owner for
        // the thread?  Note that this will typically be root, and
        // .onConnect will therefore get caller perms === root, which
        // is probably dangerous.  Here and several places below.
        intrp.createThreadForFuncCall(
            server.owner, func, obj, [], undefined, server.timeLimit);
      }

      // Handle socket closing completely.
      socket.on('close', function() {
        intrp.log('net', 'Connection on :%s from %s:%s closed',
                  server.port, socket.remoteAddress, socket.remotePort);
        var func = obj.get('onClose', server.owner);
        if (func instanceof intrp.Function && server.owner !== null) {
          intrp.createThreadForFuncCall(
              server.owner, func, obj, [], undefined, server.timeLimit);
        }
      });

      // Handle incoming data from clients.  N.B. that data is a
      // node buffer object, so we must convert it to a string
      // before passing it to user code.
      socket.on('data', function(data) {
        var func = obj.get('onReceive', server.owner);
        if (func instanceof intrp.Function && server.owner !== null) {
          intrp.createThreadForFuncCall(
              server.owner, func, obj, [String(data)],
              undefined, server.timeLimit);
        }
      });

      // Handle far end closing connection.
      socket.on('end', function() {
        intrp.log('net', 'Connection on :%s from %s:%s ended',
                  server.port, socket.remoteAddress, socket.remotePort);
        var func = obj.get('onEnd', server.owner);
        if (func instanceof intrp.Function && server.owner !== null) {
          intrp.createThreadForFuncCall(
              server.owner, func, obj, [], undefined, server.timeLimit);
        }
      });

      // Handle errors.
      socket.on('error', function(error) {
        intrp.log('net', 'Socket error on :%s from %s:%s: %s: %s',
                  server.port, socket.remoteAddress, socket.remotePort,
                  error.name, error.message);
        var func = obj.get('onError', server.owner);
        if (func instanceof intrp.Function && server.owner !== null) {
          var userError = intrp.errorNativeToPseudo(error, server.owner);
          intrp.createThreadForFuncCall(
              server.owner, func, obj, [userError],
              undefined, server.timeLimit);
        }
      });

      // TODO(cpcallen): save new object somewhere we can find it
      // later (when we want to obtain list of connected objects).
    });

    this.server_.on('listening', function() {
      var addr = this.address();
      intrp.log('net', 'Listening on %s %s:%s',
                addr.family, addr.address, addr.port);
    });

    this.server_.on('error', function(error) {
      intrp.log('net', 'Error on :%s: %s: %s',
                server.port, error.name, error.message);
    });

    this.server_.on('close', function() {
      intrp.log('net', 'Stopped listening on :%s', server.port);
    });
  };

  /**
   * Start a Server object listening on its assigned port.
   * @param {!function(!Error=)=} callback
   *     Callback that will be called once listening has begun, or with
   *     an Error argument if listening fails.
   */
  intrp.Server.prototype.listen = function(callback) {
    // Invariant checks.
    if (this.port === undefined ||
        !(this.proto instanceof intrp.Object) ||
        !(this.server_ instanceof net.Server)) {
      throw new Error('invalid Server state');
    }
    if (intrp.listeners_[this.port] !== this) {
      throw new Error('Listening on server not listed in .listeners_??');
    }

    // Set up callbacks.  Fiddly, because we want to temporarily hook
    // the error handler but be sure to unhook it whether the listen
    // call succeeds or fails.
    var /** boolean */ done = false;
    /** @type {function(this:net.Server, !Error=)} */
    function hook(error) {
      if (done) throw new Error('unexpected multiple callbacks');
      done = true;
      this.removeListener(events.errorMonitor, hook);
      if (callback) callback(error);
    };
    this.server_.on(events.errorMonitor, hook);
    this.server_.listen(this.port, hook);
  };

  /**
   * Stop a Server object listening on its assigned port.
   * @param {!function()=} callback Callback that will be called after
   *     listening has ceased.
   */
  intrp.Server.prototype.unlisten = function(callback) {
    // Invariant checks.
    if (this.port === undefined ||
        !(this.proto instanceof intrp.Object) ||
        !(this.server_ instanceof net.Server)) {
      throw new Error('invalid Server state');
    }
    this.server_.close(callback);
  };
};

///////////////////////////////////////////////////////////////////////////////
// Miscellaneous internal classes not used for storing state and not exported
///////////////////////////////////////////////////////////////////////////////

/**
 * Type for options object for constructing a NativeFunction.
 * @typedef {{name: (string|undefined),
 *            length: (number|undefined),
 *            id: (string|undefined),
 *            call: (Interpreter.NativeCallImpl|undefined),
 *            construct: (Interpreter.NativeConstructImpl|undefined),
 *            owner: (!Interpreter.Owner|undefined),
 *            proto: (?Interpreter.prototype.Object|undefined)}}
 */
var NativeFunctionOptions;

/**
 * Type for property descriptors, as used by
 * Interpreter.prototype.Object.prototype.defineProperty and
 * ...getOwnPropertyDescriptor.
 * @record
 */
Interpreter.Descriptor = function() {};

/** @type {(?Interpreter.Value|undefined)} */
Interpreter.Descriptor.prototype.value;

/** @type {boolean|undefined} */
Interpreter.Descriptor.prototype.writable;

/** @type {boolean|undefined} */
Interpreter.Descriptor.prototype.enumerable;

/** @type {boolean|undefined} */
Interpreter.Descriptor.prototype.configurable;

/**
 * Convenience class for creating Interpreter.Descriptors, with
 * commonly-used examples and a function to easily create new
 * descriptors from a prototype.
 * @constructor
 * @struct
 * @implements {Interpreter.Descriptor}
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
 * defined)" because unfortunately Closure Compiler's type system has
 * no way to represent the latter.
 */
/** @type {(?Interpreter.Value|undefined)} */
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
 * @param {?Interpreter.Value} value Value for the new descriptor.
 * @return {!Descriptor}
 */
Descriptor.prototype.withValue = function(value) {
  var desc = /** @type{!Descriptor} */(Object.create(this));
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
// Static Analysis Functions
///////////////////////////////////////////////////////////////////////////////

/**
 * Get the list of BoundNames for an AST sub-tree.
 * @param {!Node} node AST node (program or function).
 * @return {!Object<string, (!Node|undefined)>} A map of
 *     bound names.  The keys are var and function declarations
 *     appearing in the subtree rooted at node; the values are
 *     undefined for VariableDeclarations or a FunctionDeclaration
 *     node for FunctionDeclarations.
 */
var getBoundNames = function(node) {
  if (!node['boundNames']) {
    performStaticAnalysis(node);
  }
  return node['boundNames'];
};

/**
 * Check if an AST contains Identifiers named "arguments" or "eval".
 * @param {!Node} node AST node (program or function).
 * @return boolean True iff tree rooted at node contains an Identifier
 *     named "arguments" or "eval", not including any
 *     FunctionDeclaration or FunctionExpression subtrees.
 */
var hasArgumentsOrEval = function(node) {
  if (node['hasArgumentsOrEval'] === undefined) {
    performStaticAnalysis(node);
  }
  return node['hasArgumentsOrEval'];
};

/**
 * The IsAnonymousFunctionDefinition specification method from ES6 §14.1.9
 * @param {!Node} node The node to be tested.
 * @return {boolean} True if node is an anonymous function expression.
 */
var isAnonymousFunctionDefinition = function(node) {
  return node['type'] === 'FunctionExpression' && !node['id'];
};

/**
 * The IsIdentifierRef specification method from ES6 §12.2.1.4 and §12.3.1.4
 * @param {!Node} node The node to be tested.
 * @return {boolean} True if node is an identifier.
 */
var isIdentifierRef = function(node) {
  return node['type'] === 'Identifier';
};

/**
 * Returns true iff node is a MemberExpression.
 * @param {!Node} node The node to be tested.
 * @return {boolean} True if node is an identifier.
 */
var isMemberRef = function(node) {
  return node['type'] === 'MemberExpression';
};

/**
 * Walk an AST (or sub-tree), collecting bound names by looking for
 * VariableDeclaration and FunctionDeclaration nodes, and checking for
 * Identifiers named "arguments" or "eval".
 *
 * The BoundNames will be stored on node['boundNames'] as an
 * !Object<string, (!Node|undefined)>, where the keys are
 * the names of VariableDeclaration and FunctionDeclarations, and the
 * values are undefined for VariableDeclarations or a
 * FunctionDeclaration node for FunctionDeclarations.
 *
 * If any Identifier named "arguments" or "eval" is seen, and
 * node['hasArgumentsOrEval'] will be set to true; otherwise it will
 * be set to false.
 *
 * @param {!Node} node AST node (program or function).
 * @return {void}
 */
var performStaticAnalysis = function(node) {
  /** !Object<string, (!Node|undefined)> */
  var boundNames = node['boundNames'] = Object.create(null);
  var hasArgumentsOrEval = false;
  walk(node);
  node['hasArgumentsOrEval'] = hasArgumentsOrEval;

  /**
   * Recursively Walk an AST sub-tree, populating boundNames as we go.
   * @param {!Node} node AST node (program or function).
   * Nested function writes to boundNames and hasArgumentsOrEval.
   * @return {void}
   */
  function walk(node) {
    if (node['type'] === 'VariableDeclaration') {
      for (var i = 0; i < node['declarations'].length; i++) {
        // VariableDeclarations can't overwrite previous
        // FunctionDeclarations (but initializer might at run time).
        var name = node['declarations'][i]['id']['name'];
        if (!(name in boundNames)) {
          boundNames[name] = undefined;
        }
      }
    } else if (node['type'] === 'Identifier') {
      name = node['name'];
      if (name === 'arguments' || name === 'eval') {
        hasArgumentsOrEval = true;
      }
    } else if (node['type'] === 'FunctionDeclaration') {
      // FunctionDeclarations overwrite any previous decl of the same name.
      name = node['id']['name'];
      boundNames[name] = node;
      return;  // Do not recurse into function.
    } else if (node['type'] === 'FunctionExpression') {
      return;  // Do not recurse into function.
    }
    // Visit node's children.
    for (var key in node) {
      var prop = node[key];
      if (prop && typeof prop === 'object') {
        if (Array.isArray(prop)) {
          for (var i = 0; i < prop.length; i++) {
            if (prop[i] && prop[i] instanceof Node) {
              walk(prop[i]);
            }
          }
        } else {
          if (prop instanceof Node) {
            walk(prop);
          }
        }
      }
    }
  }
};

///////////////////////////////////////////////////////////////////////////////
// Step Functions: one to handle each node type.
///////////////////////////////////////////////////////////////////////////////

/**
 * Typedef for step functions.
 *
 * TODO(cpcallen): It should be possible to declare individual
 * functions below using this typedef (instead of listing full type
 * details for each once
 * https://github.com/google/closure-compiler/issues/2857 is fixed.
 * @typedef {function(this: Interpreter,
 *                    !Interpreter.Thread,
 *                    !Array<!Interpreter.State>,
 *                    !Interpreter.State,
 *                    !Node)
 *               : (!Interpreter.State|undefined)}
 */
Interpreter.StepFunction;

/**
 * 'Map' of node types to their corresponding step functions.  Note
 * that a Map is much slower than a null-parent object (v8 in 2017).
 * @const {!Object<string, !Interpreter.StepFunction>}
 */
var stepFuncs_ = Object.create(null);

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ArrayExpression'] = function(thread, stack, state, node) {
  var n = state.n_;
  if (!state.tmp_) {  // Create Array object
    state.tmp_ = new this.Array(state.scope.perms);
  } else {  // Save most recently-evaluated element.
    state.tmp_.set(String(n), state.value, state.scope.perms);
    n++;
  }
  var /** !Array<!Node> */ elements = node['elements'];
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
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['AssignmentExpression'] = function(thread, stack, state, node) {
  if (state.step_ === 0) {  // Get Reference to left.
    state.step_ = 1;
    // Get Reference for left subexpression.
    return new Interpreter.State(node['left'], state.scope, true);
  }
  if (!state.ref) throw new TypeError('left subexpression not an LVALUE??');
  if (state.step_ === 1) {  // Evaluate right.
    if (node['operator'] !== '=') {
      state.tmp_ = this.getValue(state.ref, state.scope.perms);
    }
    state.step_ = 2;
    return new Interpreter.State(node['right'], state.scope);
  }
  // state.step_ === 2: Got operand(s); do assignment.
  var rightValue = state.value;
  var value = state.tmp_;
  switch (node['operator']) {
    // Regular assignment is special due to function naming & destructuring.
    case '=':
      value = rightValue;
      // Set name if anonymous function expression.
      if (isAnonymousFunctionDefinition(node['right']) &&
          (isIdentifierRef(node['left']) ||
           (this.options.methodNames && isMemberRef(node['left'])))) {
        var func = /** @type {!Interpreter.prototype.Function} */(value);
        // TODO(ES6): Check that func does not already have a 'name'
        // own property before calling setName?  (Spec requires, but
        // unclear why since we know RHS is anonymous.  Proxies?)
        func.setName(state.ref[1]);
      }
      break;
    // All the rest are simple and similar.
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
      throw new SyntaxError(
          'Unknown assignment expression: ' + node['operator']);
  }
  this.setValue(state.ref, value, state.scope.perms);
  stack.pop();
  stack[stack.length - 1].value = value;
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['BinaryExpression'] = function(thread, stack, state, node) {
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
  var /** ?Interpreter.Value */ value;
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
            'Right-hand side of instanceof is not a function');
      }
      value = rightValue.hasInstance(leftValue, state.scope.perms);
      break;
    default:
      throw new SyntaxError('Unknown binary operator: ' + node['operator']);
  }
  stack.pop();
  stack[stack.length - 1].value = value;
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['BlockStatement'] = function(thread, stack, state, node) {
  var n = state.n_;
  var /** ?Node */ statement = node['body'][n];
  if (statement) {
    state.n_ = n + 1;
    return new Interpreter.State(statement, state.scope);
  }
  stack.pop();
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['BreakStatement'] = function(thread, stack, state, node) {
  if (!thread) throw new Error('No thread in BreakStatement??');
  this.unwind_(thread, Interpreter.CompletionType.BREAK, undefined,
      node['label'] ? node['label']['name'] : undefined
  );
};

/**
 * Extra info used by CallExpression, NewExpression and Call step
 * functions:
 * - func: the function to be called or constructed.
 * - this: the value of 'this' for the call.
 * - arguments: (evaluated) arguments to the call.
 * - directEval: is this a direct call to the global eval function?
 * - construct: is this a [[Construct]] call (rather than default [[Call]])?
 * - funcState: place for NativeFunction impls to save additional state info.
 * TODO(cpcallen): give funcState a narrower type.
 * @typedef {{func: ?Interpreter.prototype.Function,
 *            this: ?Interpreter.Value,
 *            arguments: !Array<?Interpreter.Value>,
 *            directEval: boolean,
 *            construct: boolean,
 *            funcState: *}}
 */
Interpreter.CallInfo;

/**
 * CallExpression AND NewExpression: the initial part that evaluates
 * the arguments etc.
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['CallExpression'] = function(thread, stack, state, node) {
  if (state.step_ === 0) {  // Evaluate callee.
    // Special hack for Code City's "new 'foo'" syntax.
    if (node['type'] === 'NewExpression' &&
        node['callee']['type'] === 'Literal' &&
        typeof node['callee']['value'] === 'string' &&
        node['arguments'].length === 0) {
      var builtin = node['callee']['value'];
      if (!this.builtins.has(builtin)) {
        throw new this.Error(state.scope.perms, this.REFERENCE_ERROR,
            builtin + ' is not a builtin');
      }
      stack.pop();
      stack[stack.length - 1].value = this.builtins.get(builtin);
      return;
    }
    state.step_ = 1;
    // Get reference for callee, because we need to get value of 'this'.
    return new Interpreter.State(node['callee'], state.scope, true);
  }
  if (state.step_ === 1) {  // Evaluated callee, possibly got a reference.
    // Determine value of the function.
    state.step_ = 2;
    var info = {func: null,
                this: undefined,  // Since we have no global object.
                arguments: [],
                directEval: false,
                construct: state.node['type'] === 'NewExpression',
                funcState: undefined};
    if (state.ref) {  // Callee was MemberExpression or Identifier.
      state.tmp_ = this.getValue(state.ref, state.scope.perms);
      if (state.ref[0] instanceof Interpreter.Scope) {
        // (Globally or locally) named function - maybe named 'eval'?
        info.directEval = (state.ref[1] === 'eval');
      } else {
        // Method call; save 'this' value.
        info.this = state.ref[0];
      }
    } else {  // Callee already fully evaluated.
      state.tmp_ = state.value;
    }
    state.info_ = info;
    state.n_ = 0;
  }
  if (state.step_ === 2) {  // Evaluating arguments.
    if (state.n_ !== 0) {  // Save previous arg.
      state.info_.arguments[state.info_.arguments.length] = state.value;
    }
    if (node['arguments'][state.n_]) {  // Evaluate next arg.
      return new Interpreter.State(node['arguments'][state.n_++], state.scope);
    }
    // All args evaluated.  Check info_.func is actually a function.
    state.step_ = 3;  // N.B: SEE NOTE 1 ABOVE!
    if (!(state.tmp_ instanceof this.Function)) {
      throw new this.Error(state.scope.perms, this.TYPE_ERROR,
          state.tmp_ + ' is not a function');
    }
    state.info_.func = state.tmp_;
  }
  // state.step_ === 3: Done evaluating arguments; do function call.
  // Dummy Node (used only for type and position).
  var callNode = new Node;
  callNode['type'] = 'Call';
  callNode['stepFunc'] = stepFuncs_['Call'];
  callNode['start'] = node['start'];
  // New State for Call (or Construct).
  var callState = new Interpreter.State(callNode, state.scope);
  callState.info_ = state.info_;
  // Replace this CallExpression State with the new Call State.
  stack[stack.length - 1] = callState;
  // We know exactly which step function will get called next, so go
  // straight there:
  return stepFuncs_['Call'].call(this, thread, stack, callState, callNode);
};

/**
 * Call: the latter part of CallExpression / NewExpression, when the
 * actual call/construct takes place.
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['Call'] = function(thread, stack, state, node) {
  /* NOTE: Beware that, because
   *
   *  - an async function might not *actually* be async, and thus
   *  - its .call function might call its reject before returning, and
   *  - reject will unwind the stack, and
   *  - Interpreter#step and Interpreter#run will push any State
   *    returned by a step function such as this one,
   *
   * this Call step function MUST NOT return a State after
   * calling .call (or .construct), or the thread might end up in some
   * nonsensical, corrupt configuration.
   *
   * (It's fine to return a State if it *hasn't* called .call or
   * .construct - for example, on a subsequent invocation - though
   * there is no obvious reason to do so.)
   */
  if (state.step_ === 0) {  // Done evaluating arguments; do function call.
    state.step_ = 1;
    if (this.options.stackLimit && stack.length > this.options.stackLimit) {
      throw new this.Error(state.scope.perms, this.RANGE_ERROR,
          'Maximum call stack size exceeded');
    }
    var func = state.info_.func;
    var args = state.info_.arguments;
    // Abort call if out of time, unless it's a call to Thread.suspend().
    if (func !== this.builtins.get('Thread.suspend')) {
      try {
        this.checkTimeLimit_(state.scope.perms);
      } catch (e) {
        stack.pop();  // Remove not-called function from stack trace.
        throw e;
      }
    }
    var r =
        state.info_.construct ?
        func.construct(this, thread, state, args) :
        func.call(this, thread, state, state.info_.this, args);
    if (r instanceof Interpreter.FunctionResult) {
      switch (r) {
        case Interpreter.FunctionResult.AwaitValue:
          return;
        case Interpreter.FunctionResult.Block:
          thread.status = Interpreter.Thread.Status.BLOCKED;
          return;
        case Interpreter.FunctionResult.CallAgain:
          state.step_ = 0;
          return;
        case Interpreter.FunctionResult.Sleep:
          thread.status = Interpreter.Thread.Status.SLEEPING;
          return;
        default:
          throw new Error('Unknown FunctionResult??');
      }
    }
    state.value = r;
  }
  // state.step_ === 1: Execution done; handle return value.
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
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ConditionalExpression'] = function(thread, stack, state, node) {
  if (state.step_ === 0) {  // Evaluate test.
    state.step_ = 1;
    return new Interpreter.State(node['test'], state.scope);
  }
  // state.step_ === 1: Test evaluated; result is in .value
  var value = Boolean(state.value);
  stack.pop();
  if (value && node['consequent']) {
    // Execute 'if' block.
    return new Interpreter.State(node['consequent'], state.scope);
  }
  if (!value && node['alternate']) {
    // Execute 'else' block.
    return new Interpreter.State(node['alternate'], state.scope);
  }
  // eval('1;if(false){2}') -> undefined
  thread.value = undefined;
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ContinueStatement'] = function(thread, stack, state, node) {
  this.unwind_(thread, Interpreter.CompletionType.CONTINUE, undefined,
      node['label'] ? node['label']['name'] : undefined);
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['DebuggerStatement'] = function(thread, stack, state, node) {
  // Do nothing.  May be overridden by developers.
  stack.pop();
};

/**
 * DoWhileStatement AND WhileStatement.  The only difference is the
 * former skips evaluating the test expression the first time through.
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['DoWhileStatement'] = function(thread, stack, state, node) {
  if (state.step_ === 0) {  // Decide whether to skip first test.
    state.step_ = 1;
    if (node['type'] === 'DoWhileStatement') {
      // First iteration of do/while executes without checking test.
      state.value = true;
      state.step_ = 2;
    }
  }
  if (state.step_ === 1) {  // Evaluate condition.
    // Terminate loop if out of time.
    this.checkTimeLimit_(state.scope.perms);
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
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['EmptyStatement'] = function(thread, stack, state, node) {
  stack.pop();
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['EvalProgram_'] = function(thread, stack, state, node) {
  var n = state.n_;
  var /** ?Node */ expression = node['body'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
  stack[stack.length - 1].value = thread.value;
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ExpressionStatement'] = function(thread, stack, state, node) {
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
  thread.value = state.value;
};

/**
 * Extra info used by ForInStatement step function.
 * @typedef {{iter: !Interpreter.PropertyIterator,
              key: string}}
 */
Interpreter.ForInInfo;

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ForInStatement'] = function(thread, stack, state, node) {
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
        // Terminate loop if out of time.
        this.checkTimeLimit_(state.scope.perms);
        var key = state.info_.iter.next();
        if (key === undefined) {
          // Done; exit loop.
          stack.pop();
          return;
        }
        state.info_.key = key;
        // Get (or create) a Reference to node.left:
        var /** ?Node */ left = node['left'];
        if (left['type'] !== 'VariableDeclaration') {
          state.step_ = 3;
          // Arbitrary left side, e.g.: for (foo().bar in y).
          // Get Reference to whatever left side turns out to be.
          return new Interpreter.State(left, state.scope, true);
        }
        // Inline variable declaration: for (var x in y)
        var lhsName = left['declarations'][0]['id']['name'];
        state.ref = [state.scope.resolve(lhsName), lhsName];
        // FALL THROUGH
      case 3:  // Got .ref to variable to set.  Set it next key.
        if (!state.ref) throw new TypeError('loop variable not an LVALUE??');
        this.setValue(state.ref, state.info_.key, state.scope.perms);
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
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ForStatement'] = function(thread, stack, state, node) {
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
        // Terminate loop if out of time.
        this.checkTimeLimit_(state.scope.perms);
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
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['FunctionDeclaration'] = function(thread, stack, state, node) {
  // This was found and handled when the scope was populated.
  stack.pop();
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['FunctionExpression'] = function(thread, stack, state, node) {
  var source = thread.getSource();
  if (!source) {
    throw new Error("No source found when evaluating function expression??");
  }
  var scope = state.scope;
  var perms = scope.perms;
  // If the function expression has a name, create an outer scope to
  // bind that name.  See ES5.1 §13 / ES6 §14.1.20.
  var name = node['id'] && node['id']['name'];
  if (name) {
    scope = new Interpreter.Scope(Interpreter.Scope.Type.FUNEXP, perms, scope);
  }
  var func = new this.UserFunction(node, scope, source, perms);
  if (name) scope.createImmutableBinding(name, func);
  stack.pop();
  stack[stack.length - 1].value = func;
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['Identifier'] = function(thread, stack, state, node) {
  var /** string */ name = node['name'];
  if (state.wantRef_) {
    stack.pop();
    stack[stack.length - 1].ref = [state.scope.resolve(name), name];
  } else {
    var value = this.getValueFromScope(state.scope, name);
    stack.pop();  // Must be after call to getValueFromScope, which might throw.
    stack[stack.length - 1].value = value;
  }
};

stepFuncs_['IfStatement'] = stepFuncs_['ConditionalExpression'];

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['LabeledStatement'] = function(thread, stack, state, node) {
  // Note that a statement might have multiple labels.
  var /** !Array<string> */ labels = state.labels || [];
  labels[labels.length] = node['label']['name'];
  var nextState = new Interpreter.State(node['body'], state.scope);
  nextState.labels = labels;
  // No need to hit LabelStatement node again on the way back up the stack.
  stack.pop();
  return nextState;
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['Literal'] = function(thread, stack, state, node) {
  var /** (null|boolean|number|string|!RegExp) */ literal = node['value'];
  var /** ?Interpreter.Value */ value;
  if (literal instanceof RegExp) {
    value = new this.RegExp(literal, state.scope.perms);
  } else {
    value = literal;
  }
  stack.pop();
  stack[stack.length - 1].value = value;
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['LogicalExpression'] = function(thread, stack, state, node) {
  if (state.step_ === 0) {  // Eval left.
    state.step_ = 1;
    return new Interpreter.State(node['left'], state.scope);
  }
  // state.step_ == 1: Check for short-circuit; optionally eval right.
  stack.pop();
  var /** string */ op = node['operator'];
  if (op !== '&&' && op !== '||') {
    throw new SyntaxError("Unknown logical operator '" + op + "'");
  } else if ((op === '&&' && !state.value) || (op === '||' && state.value)) {
    // Short circuit.  Return left value.
    stack[stack.length - 1].value = state.value;
  } else {
    // Tail-eval right.
    return new Interpreter.State(node['right'], state.scope);
  }
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['MemberExpression'] = function(thread, stack, state, node) {
  if (state.step_ === 0) {  // Evaluate LHS (object).
    state.step_ = 1;
    return new Interpreter.State(node['object'], state.scope);
  } else if (state.step_ === 1) {  // Evaluate RHS (property key) if necessary.
    state.tmp_ = state.value;
    if (node['computed']) {  // obj[foo] -- Compute value of 'foo'.
      state.step_ = 2;
      return new Interpreter.State(node['property'], state.scope);
    }
  }
  // TODO(cpcallen): add test for order of following two specification
  // method calls from the algorithm in ES6 §2.3.2.1.
  // Step 7: bv = RequireObjectCoercible(baseValue).
  var /** ?Interpreter.Value */ base = state.tmp_;
  var /** !Interpreter.Owner */ perms = state.scope.perms;
  if (base === null || base === undefined) {
    throw new this.Error(perms, this.TYPE_ERROR,
        "Can't convert " + base + ' to Object');
  }
  // Step 9: propertyKey = ToPropertyKey(propertyNameValue).
  var /** string */ key =
      node['computed'] ? String(state.value) : node['property']['name'];
  stack.pop();  // Must be after last throw new this.Error...
  if (state.wantRef_) {
    stack[stack.length - 1].ref = [base, key];
  } else {
    // toObject guaranteed not to throw because of earlier check.
    stack[stack.length - 1].value = this.toObject(base, perms).get(key, perms);
  }
};

stepFuncs_['NewExpression'] = stepFuncs_['CallExpression'];

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ObjectExpression'] = function(thread, stack, state, node) {
  var n = state.n_;
  if (!state.tmp_) {  // First execution.  Create object.
    state.tmp_ = new this.Object(state.scope.perms);
  } else {  // Save just-evaluated property value in object.
    // Determine property name.
    var /** ?Node */ keyNode = node['properties'][n]['key'];
    if (keyNode['type'] === 'Identifier') {
      var /** string */ key = keyNode['name'];
    } else if (keyNode['type'] === 'Literal') {
      key = keyNode['value'];
    } else {
      throw new SyntaxError('Unknown object structure: ' + keyNode['type']);
    }
    var value = state.value;
    var perms = state.scope.perms;
    // Set name if anonymous function expression.
    if (isAnonymousFunctionDefinition(node['properties'][n]['value'])) {
      var func = /** @type {!Interpreter.prototype.Function} */(value);
      // TODO(ES6): Check that func does not already have a 'name' own
      // property before calling setName?  (Spec requires, but unclear
      // why since we know RHS is anonymous.  Proxies?)
      func.setName(key);
    }
    // Set the property computed in the previous execution.
    state.tmp_.defineProperty(key, Descriptor.wec.withValue(value), perms);
    state.n_ = ++n;
  }
  var /** ?Node */ property = node['properties'][n];
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
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['Program'] = function(thread, stack, state, node) {
  var n = state.n_;
  var /** ?Node */ expression = node['body'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ReturnStatement'] = function(thread, stack, state, node) {
  if (node['argument'] && state.step_ === 0) {
    state.step_ = 1;
    return new Interpreter.State(node['argument'], state.scope);
  }
  this.unwind_(
      thread, Interpreter.CompletionType.RETURN, state.value, undefined);
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['SequenceExpression'] = function(thread, stack, state, node) {
  var n = state.n_;
  var /** !Node */ expression = node['expressions'][n++];
  if (n >= node['expressions'].length) {
    stack.pop();
  }
  state.n_ = n;
  return new Interpreter.State(expression, state.scope);
};

/**
 * Extra info used by SwitchStatement step function.
 * @typedef {{default: number}}
 */
Interpreter.SwitchInfo;

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['SwitchStatement'] = function(thread, stack, state, node) {
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
      var /** Array<!Node> */ cases = node['cases'];
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
        var /** ?Node */ conseq = cases[n]['consequent'];
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
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ThisExpression'] = function(thread, stack, state, node) {
  stack.pop();
  stack[stack.length - 1].value = state.scope.this;
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['ThrowStatement'] = function(thread, stack, state, node) {
  if (state.step_ === 0) {  // Evaluate value to throw.
    state.step_ = 1;
    return new Interpreter.State(node['argument'], state.scope);
  }
  throw state.value;
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['TryStatement'] = function(thread, stack, state, node) {
  switch (state.step_) {
    case 0:  // Evaluate 'try' block.
      state.step_ = 1;
      return new Interpreter.State(node['block'], state.scope);
    case 1:  // Back from 'try' block.  Run catch?
      state.step_ = 2;
      var /** ?Node */ handler = node['handler'];
      var cv = /** ?Interpreter.Completion */ (state.info_);
      if (handler && cv && cv.type === Interpreter.CompletionType.THROW) {
        state.info_ = null;  // This error is being handled, don't rethrow.
        // Execute catch clause with varible bound to exception value.
        var scope = new Interpreter.Scope(
            Interpreter.Scope.Type.CATCH, state.scope.perms, state.scope);
        scope.createMutableBinding(handler['param']['name'], cv.value);
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
        // TryStatement / Call / target of break or continue.
        this.unwind_(
            thread, state.info_.type, state.info_.value, state.info_.label);
      }
  }
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['UnaryExpression'] = function(thread, stack, state, node) {
  if (state.step_ === 0) {  // Evaluate (or get reference) to argument.
    state.step_ = 1;
    // Get argument - need Reference if operator is 'delete' or 'typeof:
    var wr = (node['operator'] === 'delete') || (node['operator'] === 'typeof');
    return new Interpreter.State(node['argument'], state.scope, wr);
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
      if (state.ref[0] instanceof Interpreter.Scope) {
        // Whoops; this should have been caught by Acorn (because strict).
        throw new Error('Uncaught illegal deletion of unqualified identifier');
      }
      var obj = this.toObject(state.ref[0], state.scope.perms);
      value = obj.deleteProperty(state.ref[1], state.scope.perms);
    } else {
      // Attempted to deleted some expression that wasn't a reference
      // to a variable or property.  Skip delete; return true.
      value = true;
    }
  } else if (node['operator'] === 'typeof') {
    if (state.ref) {
      var perms = state.scope.perms;
      if (this.isUnresolvableReference(state.scope, state.ref, perms)) {
        value = undefined;
      } else {
        value = this.getValue(state.ref, perms);
      }
    }
    value = (value instanceof this.Function) ? 'function' : typeof value;
  } else if (node['operator'] === 'void') {
    value = undefined;
  } else {
    throw new SyntaxError('Unknown unary operator: ' + node['operator']);
  }
  stack.pop();
  stack[stack.length - 1].value = value;
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['UpdateExpression'] = function(thread, stack, state, node) {
  if (state.step_ === 0) {  // Get Reference to argument.
    state.step_ = 1;
    return new Interpreter.State(node['argument'], state.scope, true);
  }
  if (!state.ref) throw new TypeError('argument not an LVALUE??');
  var value = Number(this.getValue(state.ref, state.scope.perms));
  var prefix = Boolean(node['prefix']);
  var /** ?Interpreter.Value */ rval;
  if (node['operator'] === '++') {
    rval = (prefix ? ++value : value++);
  } else if (node['operator'] === '--') {
    rval = (prefix ? --value : value--);
  } else {
    throw new SyntaxError('Unknown update expression: ' + node['operator']);
  }
  this.setValue(state.ref, value, state.scope.perms);
  stack.pop();
  stack[stack.length - 1].value = rval;
};

/**
 * @this {!Interpreter}
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['VariableDeclaration'] = function(thread, stack, state, node) {
  var declarations = node['declarations'];
  var n = state.n_;
  var decl = declarations[n];
  if (state.step_ === 1) {  // Initialise variable with evaluated init value.
    var name = decl['id']['name'];
    var value = state.value;
    if (isAnonymousFunctionDefinition(decl['init'])) {
      var func = /** @type {!Interpreter.prototype.Function} */(value);
      // TODO(ES6): Check that func does not already have a 'name' own
      // property before calling setName?  (Spec requires, but unclear
      // why since we know RHS is anonymous.  Proxies?)
      func.setName(name);
    }
    // Note that this is setting the value, not defining the variable.
    // Variable definition is done when scope is populated.
    this.setValueToScope(state.scope, name, value);
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
 * @param {!Interpreter.Thread} thread
 * @param {!Array<!Interpreter.State>} stack
 * @param {!Interpreter.State} state
 * @param {!Node} node
 * @return {!Interpreter.State|undefined}
 */
stepFuncs_['WithStatement'] = function(thread, stack, state, node) {
  throw new this.Error(state.scope.perms, this.SYNTAX_ERROR,
      'Strict mode code may not include a with statement');
};

stepFuncs_['WhileStatement'] = stepFuncs_['DoWhileStatement'];

// Give each step function a serialisation id.
for (var name in stepFuncs_) {
  stepFuncs_[name].id = 'Step Function: ' + name;
}

///////////////////////////////////////////////////////////////////////////////
// Exports
///////////////////////////////////////////////////////////////////////////////

exports = module.exports = Interpreter;

exports.testOnly = {
  getBoundNames: getBoundNames,
  hasArgumentsOrEval: hasArgumentsOrEval,
};
