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

var acorn, net;

/**
 * Create a new interpreter.
 * @constructor
 */
var Interpreter = function() {
  this.installTypes();
  // Map of natively implemented JS functions.  E.g. Array.pop
  this.builtins_ = Object.create(null);
  // Map node types to our step function names; a property lookup is faster
  // than string concatenation with "step" prefix.
  // Note that a Map is much slower than a null-parent object (v8 in 2017).
  this.stepFunctions_ = Object.create(null);
  var stepMatch = /^step([A-Z]\w*)$/;
  var m;
  for (var methodName in this) {
    if ((typeof this[methodName] === 'function') &&
        (m = methodName.match(stepMatch))) {
      this.stepFunctions_[m[1]] = this[methodName].bind(this);
    }
  }
  // For cycle detection in array to string and error conversion; see
  // spec bug github.com/tc39/ecma262/issues/289. At the moment this
  // is used only for actions which are atomic (i.e., take place
  // entirely within the duration of a single call to .step), so it
  // could be a global or class property, but better to have it be
  // per-instance so that we can eventually call user toString
  // methods.
  // TODO(cpcallen): Make this per-thread when threads are introduced.
  this.toStringCycles_ = [];
  // Create and initialize the global scope.
  this.global = new Interpreter.Scope;
  this.initGlobalScope(this.global);
  // Set up threads and scheduler stuff:
  this.threads = [];
  this.thread = null;
  this.initUptime();
  this.previousTime_ = 0;
  this.running = false;
  this.done = true;  // True if any non-ZOMBIE threads exist.
};

/**
 * @const {!Object} Configuration used for all Acorn parsing.
 */
Interpreter.PARSE_OPTIONS = {
  ecmaVersion: 5,
  forbidReserved: true
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
 * Unique symbol for indicating that a step has encountered an error, has
 * added it to the stack, and will be thrown within the user's program.
 * When STEP_ERROR is thrown by the interpreter the error can be ignored.
 */
Interpreter.STEP_ERROR = {};

/**
 * Unique symbol for indicating that a reference is a variable on the scope,
 * not an object property.
 */
Interpreter.SCOPE_REFERENCE = {};

/**
 * Parse a code string into an AST.
 * @param {string} str
 */
Interpreter.prototype.parse = function(str) {
  try {
    return acorn.parse(str, Interpreter.PARSE_OPTIONS);
  } catch (e) {
    // Acorn threw a SyntaxError.  Rethrow as a trappable error.
    this.throwException(this.SYNTAX_ERROR, 'Invalid code: ' + e.message);
  }
};

/**
 * Initialise internal structures for uptime() and now().
 */
Interpreter.prototype.initUptime = function() {
  this.startTime_ = process.hrtime();
};

/**
 * Return a monotonically increasing count of milliseconds since this
 * Interpreter instance was most recently started, not including time
 * when the interpreter runtime was suspended by the host OS (say,
 * because the machine was asleep).
 * @return {number} Elapsed total time in milliseconds.
 */
Interpreter.prototype.uptime = function() {
  var t = process.hrtime(this.startTime_);
  return t[0] * 1000 + t[1] / 1000000;
};

/**
 * Return a monotonically increasing count of milliseconds since this
 * Interpreter instance was created.  In the event of an interpreter
 * being serialized / deserialized, it is expected that after
 * deserialization that this will continue from where it left off
 * before serialization.
 * @return {number} Elapsed total time in milliseconds.
 */
Interpreter.prototype.now = function() {
  return this.uptime() + this.previousTime_;
};

/**
 * Create a new thread and add it to .threads.
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
  if (this.running) {
    this.start();
  }
  return id;
};

/**
 * Create a new thread to execute a particular function call.
 * @param {!Interpreter.prototype.Function} fun Function to call.
 * @param {Interpreter.Value} funcThis value of 'this' in function call.
 * @param {!Array<Interpreter.Value>} args Arguments to pass.
 * @param {number=} runAt Time at which thread should begin execution
 *     (defaults to now).
 * @return {number} thread ID.
 */
Interpreter.prototype.createThreadForFuncCall =
    function(func, funcThis, args, runAt) {
  if (!(func instanceof this.Function)) {
    this.throwException(this.TYPE_ERROR, func + ' is not a function');
  }
  var node = new Interpreter.Node;
  node['type'] = 'CallExpression';
  var state = new Interpreter.State(node, this.global);
  state.func_ = func;
  state.funcThis_ = funcThis;
  state.doneCallee_ = 2;
  state.arguments_ = args;
  state.doneArgs_ = true;
  return this.createThread(state, runAt || this.now());
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
  this.thread = undefined;
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
  if (!this.thread || this.thread.status !== Interpreter.Thread.Status.READY) {
    if (this.schedule() > 0) {
      return false;
    }
  }
  var thread = this.thread;
  var stack = thread.stateStack;
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
Interpreter.prototype.run = function(continuous) {
  var t;
  while ((t = this.schedule()) === 0) {
    var thread = this.thread;
    var stack = thread.stateStack;
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
 * Use setTimeout to repeatedly call .run() until there are no more
 * sleeping threads.
 */
Interpreter.prototype.start = function() {
  var intrp = this;
  var repeat = function() {
    var r = intrp.run();
    if (r > 0) {
      clearTimeout(intrp.runner_);
      intrp.runner_ = setTimeout(repeat, r - intrp.now());
    }
  };
  // Kill any existing runner and restart.
  clearTimeout(this.runner_);
  this.runner_ = setTimeout(repeat, 0);
  this.running = true;
};

/**
 * Stop an interpreter started with .start()
 */
Interpreter.prototype.stop = function() {
  clearTimeout(this.runner_);
  this.runner_ = undefined;
  this.running = false;
};

/**
 * Initialize the global scope with buitin properties and functions.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initGlobalScope = function(scope) {
  // Initialize uneditable global properties.
  this.addVariableToScope(scope, 'NaN', NaN, true);
  this.addVariableToScope(scope, 'Infinity', Infinity, true);
  this.addVariableToScope(scope, 'undefined', undefined, true);
  this.addVariableToScope(scope, 'this', undefined, true);

  // Create the objects which will become Object.prototype and
  // Function.prototype, which are needed to bootstrap everything else.
  this.OBJECT = new this.Object(null);
  this.builtins_['Object.prototype'] = this.OBJECT;
  // createNativeFunction adds the argument to the map of builtins.
  this.FUNCTION =
      this.createNativeFunction('Function.prototype', function() {}, false);
  this.FUNCTION.proto = this.OBJECT;

  // Initialize global objects.
  this.initObject(scope);
  this.initFunction(scope);
  this.initArray(scope);
  this.initString(scope);
  this.initBoolean(scope);
  this.initNumber(scope);
  this.initDate(scope);
  this.initRegExp(scope);
  this.initError(scope);
  this.initMath(scope);
  this.initJSON(scope);

  // Initialize ES standard global functions.
  var thisInterpreter = this;

  var func = this.createNativeFunction('eval',
      function(x) {throw EvalError("Can't happen");}, false);
  func.eval = true;

  this.createNativeFunction('parseInt', parseInt, false);
  this.createNativeFunction('parseFloat', parseFloat, false);
  this.createNativeFunction('isNaN', isNaN, false);
  this.createNativeFunction('isFinite', isFinite, false);

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
          thisInterpreter.throwException(thisInterpreter.URI_ERROR, e.message);
        }
      };
    })(strFunctions[i][0]);
    this.createNativeFunction(strFunctions[i][1], wrapper, false);
  }

  // Initialize CC-specific globals.
  this.initThreads(scope);
  this.initNetwork(scope);
};

/**
 * Initialize the Object class.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initObject = function(scope) {
  var thisInterpreter = this;
  var wrapper;
  // Object constructor.
  wrapper = function(value) {
    if (value === undefined || value === null) {
      // Create a new object.
      if (thisInterpreter.calledWithNew()) {
        // Called as new Object().
        return this;
      } else {
        // Called as Object().
        return new thisInterpreter.Object;
      }
    }
    if (!(value instanceof thisInterpreter.Object)) {
      // No boxed primitives in Code City.
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          'Boxing of primitives not supported.');
    }
    // Return the provided object.
    return value;
  };
  this.createNativeFunction('Object', wrapper, this.OBJECT, true);

  /**
   * Checks if the provided value is null or undefined.
   * If so, then throw an error in the call stack.
   * @param {Interpreter.Value} value Value to check.
   */
  var throwIfNullUndefined = function(value) {
    if (value === undefined || value === null) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          "Cannot convert '" + value + "' to object");
    }
  };

  // Static methods on Object.
  this.createNativeFunction('Object.is', Object.is, false);

  wrapper = function(obj) {
    throwIfNullUndefined(obj);
    var props = (obj instanceof thisInterpreter.Object) ? obj.properties : obj;
    return thisInterpreter.nativeToPseudo(Object.getOwnPropertyNames(props));
  };
  this.createNativeFunction('Object.getOwnPropertyNames', wrapper, false);

  wrapper = function(obj) {
    throwIfNullUndefined(obj);
    if (!(obj instanceof thisInterpreter.Object)) {
      return thisInterpreter.nativeToPseudo(Object.keys(obj));
    }
    var list = [];
    for (var key in obj.properties) {
      if (!obj.notEnumerable.has(key)) {
        list.push(key);
      }
    }
    return thisInterpreter.nativeToPseudo(list);
  };
  this.createNativeFunction('Object.keys', wrapper, false);

  wrapper = function(proto) {
    // Support for the second argument is the responsibility of a polyfill.
    if (proto === null) {
      return new thisInterpreter.Object(null);
    }
    if (!(proto === null || proto instanceof thisInterpreter.Object)) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          'Object prototype may only be an Object or null');
    }
    return new thisInterpreter.Object(proto);
  };
  this.createNativeFunction('Object.create', wrapper, false);

  wrapper = function(obj, prop, descriptor) {
    prop = String(prop);
    if (!(obj instanceof thisInterpreter.Object)) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          'Object.defineProperty called on non-object');
    }
    if (!(descriptor instanceof thisInterpreter.Object)) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          'Property description must be an object');
    }
    if (!obj.properties[prop] && obj.preventExtensions) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          "Can't define property '" + prop + "', object is not extensible");
    }
    // Can't just use pseudoToNative since descriptors can inherit properties.
    var nativeDescriptor = {};
    if (thisInterpreter.hasProperty(descriptor, 'configurable')) {
      nativeDescriptor.configurable =
          !!thisInterpreter.getProperty(descriptor, 'configurable');
    }
    if (thisInterpreter.hasProperty(descriptor, 'enumerable')) {
      nativeDescriptor.enumerable =
          !!thisInterpreter.getProperty(descriptor, 'enumerable');
    }
    if (thisInterpreter.hasProperty(descriptor, 'writable')) {
      nativeDescriptor.writable =
          !!thisInterpreter.getProperty(descriptor, 'writable');
    }
    if (thisInterpreter.hasProperty(descriptor, 'value')) {
      nativeDescriptor.value = thisInterpreter.getProperty(descriptor, 'value');
    }
    thisInterpreter.setProperty(obj, prop, ReferenceError, nativeDescriptor);
    return obj;
  };
  this.createNativeFunction('Object.defineProperty', wrapper, false);

  wrapper = function(obj, prop) {
    if (!(obj instanceof thisInterpreter.Object)) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          'Object.getOwnPropertyDescriptor called on non-object');
    }
    prop = String(prop);
    if (!(prop in obj.properties)) {
      return undefined;
    }
    var configurable = !obj.notConfigurable.has(prop);
    var enumerable = !obj.notEnumerable.has(prop);
    var writable = !obj.notWritable.has(prop);

    var descriptor = new thisInterpreter.Object;
    thisInterpreter.setProperty(descriptor, 'configurable', configurable);
    thisInterpreter.setProperty(descriptor, 'enumerable', enumerable);
    thisInterpreter.setProperty(descriptor, 'writable', writable);
    thisInterpreter.setProperty(descriptor, 'value',
        thisInterpreter.getProperty(obj, prop));
    return descriptor;
  };
  this.createNativeFunction('Object.getOwnPropertyDescriptor', wrapper, false);

  wrapper = function(obj) {
    throwIfNullUndefined(obj);
    // TODO(cpcallen): behaviour of our getPrototype is wrong for
    // getPrototypeOf according to ES5.1 (but correct for ES6).
    return thisInterpreter.getPrototype(obj);
  };
  this.createNativeFunction('Object.getPrototypeOf', wrapper, false);

  wrapper = function(obj) {
    return Boolean(obj) && !obj.preventExtensions;
  };
  this.createNativeFunction('Object.isExtensible', wrapper, false);

  wrapper = function(obj) {
    if (obj instanceof thisInterpreter.Object) {
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
    if (!(this instanceof thisInterpreter.Object)) {
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
      // TODO(cpcallen): behaviour of getPrototype is wrong for
      // isPrototypeOf, according to either ES5.1 or ES6.
      obj = thisInterpreter.getPrototype(obj);
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
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initFunction = function(scope) {
  var thisInterpreter = this;
  var wrapper;
  var identifierRegexp = /^[A-Za-z_$][\w$]*$/;
  // Function constructor.
  wrapper = function(var_args) {
    var newFunc = new thisInterpreter.Function;
    newFunc.addPrototype();
    if (arguments.length) {
      var code = String(arguments[arguments.length - 1]);
    } else {
      var code = '';
    }
    var args = [];
    for (var i = 0; i < arguments.length - 1; i++) {
      var name = String(arguments[i]);
      if (!name.match(identifierRegexp)) {
        thisInterpreter.throwException(thisInterpreter.SYNTAX_ERROR,
            'Invalid function argument: ' + name);
      }
      args.push(name);
    }
    args = args.join(', ');
    // Interestingly, the scope for constructed functions is the global scope,
    // even if they were constructed in some other scope.
    newFunc.parentScope = thisInterpreter.global;
    // Acorn needs to parse code in the context of a function or else 'return'
    // statements will be syntax errors.
    var code = '(function(' + args + ') {' + code + '})';
    var ast = thisInterpreter.parse(code);
    if (ast['body'].length !== 1) {
      // Function('a', 'return a + 6;}; {alert(1);');
      thisInterpreter.throwException(thisInterpreter.SYNTAX_ERROR,
          'Invalid code in function body.');
    }
    newFunc.node = ast['body'][0]['expression'];
    newFunc.node['source'] = code;
    thisInterpreter.setProperty(newFunc, 'length', newFunc.node['length'],
        Interpreter.READONLY_DESCRIPTOR);
    return newFunc;
  };
  this.createNativeFunction('Function', wrapper, true);

  this.createNativeFunction('Function.prototype.toString',
                            this.Function.prototype.toString, false);

  wrapper = function(thisArg, args) {
    var state = thisInterpreter.thread.stateStack[
        thisInterpreter.thread.stateStack.length - 1];
    // Rewrite the current 'CallExpression' to apply a different function.
    state.func_ = this;
    // Assign the 'this' object.
    state.funcThis_ = thisArg;
    // Bind any provided arguments.
    state.arguments_ = [];
    if (args !== null && args !== undefined) {
      if (args instanceof thisInterpreter.Object) {
        state.arguments_ = thisInterpreter.pseudoToNative(args);
      } else {
        thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
            'CreateListFromArrayLike called on non-object');
      }
    }
    state.doneExec_ = false;
  };
  this.createNativeFunction('Function.prototype.apply', wrapper, false);

  wrapper = function(thisArg, var_args) {
    var state =
        thisInterpreter.thread.stateStack[
            thisInterpreter.thread.stateStack.length - 1];
    // Rewrite the current 'CallExpression' to call a different function.
    state.func_ = this;
    // Assign the 'this' object.
    state.funcThis_ = thisArg;
    // Bind any provided arguments.
    state.arguments_ = [];
    for (var i = 1; i < arguments.length; i++) {
      state.arguments_.push(arguments[i]);
    }
    state.doneExec_ = false;
  };
  this.createNativeFunction('Function.prototype.call', wrapper, false);
};

/**
 * Initialize the Array class.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initArray = function(scope) {
  var thisInterpreter = this;
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
    var newArray = new thisInterpreter.Array;
    var first = arguments[0];
    if (arguments.length === 1 && typeof first === 'number') {
      if (isNaN(Interpreter.legalArrayLength(first))) {
        thisInterpreter.throwException(thisInterpreter.RANGE_ERROR,
                                       'Invalid array length');
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
    return obj instanceof thisInterpreter.Array;
  };
  this.createNativeFunction('Array.isArray', wrapper, false);

  // Instance methods on Array.
  this.createNativeFunction('Array.prototype.toString',
                            this.Array.prototype.toString, false);

  wrapper = function() {
    if (this.properties.length) {
      var value = this.properties[this.properties.length - 1];
      delete this.properties[this.properties.length - 1];
      this.properties.length--;
    } else {
      var value = undefined;
    }
    return value;
  };
  this.createNativeFunction('Array.prototype.pop', wrapper, false);

  wrapper = function(var_args) {
    for (var i = 0; i < arguments.length; i++) {
      this.properties[this.properties.length] = arguments[i];
      this.properties.length++;
    }
    return this.properties.length;
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
    delete this.properties[thi.properties.length];
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
    var removed = new thisInterpreter.Array;
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

  wrapper = function(opt_begin, opt_end) {
    var list = new thisInterpreter.Array;
    var begin = getInt(opt_begin, 0);
    if (begin < 0) {
      begin = this.properties.length + begin;
    }
    begin = Math.max(0, Math.min(begin, this.properties.length));
    var end = getInt(opt_end, this.properties.length);
    if (end < 0) {
      end = this.properties.length + end;
    }
    end = Math.max(0, Math.min(end, this.properties.length));
    var length = 0;
    for (var i = begin; i < end; i++) {
      var element = thisInterpreter.getProperty(this, i);
      thisInterpreter.setProperty(list, length++, element);
    }
    return list;
  };
  this.createNativeFunction('Array.prototype.slice', wrapper, false);

  wrapper = function(opt_separator) {
    var cycles = thisInterpreter.toStringCycles_;
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
    return text.join(opt_separator);
  };
  this.createNativeFunction('Array.prototype.join', wrapper, false);

  wrapper = function(var_args) {
    var list = new thisInterpreter.Array;
    var length = 0;
    // Start by copying the current array.
    for (var i = 0; i < this.properties.length; i++) {
      var element = thisInterpreter.getProperty(this, i);
      thisInterpreter.setProperty(list, length++, element);
    }
    // Loop through all arguments and copy them in.
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (value instanceof thisInterpreter.Array) {
        for (var j = 0; j < value.properties.length; j++) {
          var element = thisInterpreter.getProperty(value, j);
          thisInterpreter.setProperty(list, length++, element);
        }
      } else {
        thisInterpreter.setProperty(list, length++, value);
      }
    }
    return list;
  };
  this.createNativeFunction('Array.prototype.concat', wrapper, false);

  wrapper = function(searchElement, opt_fromIndex) {
    searchElement = searchElement || undefined;
    var fromIndex = getInt(opt_fromIndex, 0);
    if (fromIndex < 0) {
      fromIndex = this.properties.length + fromIndex;
    }
    fromIndex = Math.max(0, fromIndex);
    for (var i = fromIndex; i < this.properties.length; i++) {
      var element = thisInterpreter.getProperty(this, i);
      if (element === searchElement) {
        return i;
      }
    }
    return -1;
  };
  this.createNativeFunction('Array.prototype.indexOf', wrapper, false);

  wrapper = function(searchElement, opt_fromIndex) {
    searchElement = searchElement || undefined;
    var fromIndex = getInt(opt_fromIndex, this.properties.length);
    if (fromIndex < 0) {
      fromIndex = this.properties.length + fromIndex;
    }
    fromIndex = Math.min(fromIndex, this.properties.length - 1);
    for (var i = fromIndex; i >= 0; i--) {
      var element = thisInterpreter.getProperty(this, i);
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
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initString = function(scope) {
  var thisInterpreter = this;
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
  var functions = ['trim', 'toLowerCase', 'toUpperCase',
      'toLocaleLowerCase', 'toLocaleUpperCase', 'charAt', 'charCodeAt',
      'substring', 'slice', 'substr', 'indexOf', 'lastIndexOf', 'concat'];
  for (var i = 0; i < functions.length; i++) {
    this.createNativeFunction('String.prototype.' + functions[i],
                              String.prototype[functions[i]], false);
  }

  wrapper = function(compareString /*, locales, options*/) {
    // Messing around with arguments so that function's length is 1.
    var locales = arguments.length > 1 ?
        thisInterpreter.pseudoToNative(arguments[1]) : undefined;
    var options = arguments.length > 2 ?
        thisInterpreter.pseudoToNative(arguments[2]) : undefined;
    return this.localeCompare(compareString, locales, options);
  };
  this.createNativeFunction('String.prototype.toLocaleString', wrapper, false);

  wrapper = function(separator, limit) {
    if (separator instanceof thisInterpreter.RegExp) {
      separator = separator.regexp;
    }
    var jsList = this.split(separator, limit);
    return thisInterpreter.nativeToPseudo(jsList);
  };
  this.createNativeFunction('String.prototype.split', wrapper, false);

  wrapper = function(regexp) {
    regexp = regexp ? regexp.regexp : undefined;
    var match = this.match(regexp);
    if (!match) {
      return null;
    }
    return thisInterpreter.nativeToPseudo(match);
  };
  this.createNativeFunction('String.prototype.match', wrapper, false);

  wrapper = function(regexp) {
    regexp = regexp ? regexp.regexp : undefined;
    return this.search(regexp);
  };
  this.createNativeFunction('String.prototype.search', wrapper, false);

  wrapper = function(substr, newSubstr) {
    // Support for function replacements is the responsibility of a polyfill.
    return String(this).replace((substr instanceof thisInterpreter.RegExp) ?
                                substr.regexp : substr, newSubstr);
  };
  this.createNativeFunction('String.prototype.replace', wrapper, false);
};

/**
 * Initialize the Boolean class.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initBoolean = function(scope) {
  var thisInterpreter = this;
  // Boolean prototype.
  this.BOOLEAN = new this.Object;
  this.builtins_['Boolean.prototype'] = this.BOOLEAN;
  this.BOOLEAN.class = 'Boolean';
  // Boolean constructor.
  this.createNativeFunction('Boolean', Boolean, false);  // No: new Boolean()
};

/**
 * Initialize the Number class.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initNumber = function(scope) {
  var thisInterpreter = this;
  var wrapper;
  // Number prototype.
  this.NUMBER = new this.Object;
  this.builtins_['Number.prototype'] = this.NUMBER;
  this.NUMBER.class = 'Number';
  // Number constructor.
  this.createNativeFunction('Number', Number, false);  // No: new Number()

  // Instance methods on Number.
  wrapper = function(fractionDigits) {
    try {
      return this.toExponential(fractionDigits);
    } catch (e) {
      // Throws if fractionDigits isn't within 0-20.
      thisInterpreter.throwException(thisInterpreter.RANGE_ERROR, e.message);
    }
  };
  this.createNativeFunction('Number.prototype.toExponential', wrapper, false);

  wrapper = function(digits) {
    try {
      return this.toFixed(digits);
    } catch (e) {
      // Throws if digits isn't within 0-20.
      thisInterpreter.throwException(thisInterpreter.RANGE_ERROR, e.message);
    }
  };
  this.createNativeFunction('Number.prototype.toFixed', wrapper, false);

  wrapper = function(precision) {
    try {
      return this.toPrecision(precision);
    } catch (e) {
      // Throws if precision isn't within range (depends on implementation).
      thisInterpreter.throwException(thisInterpreter.RANGE_ERROR, e.message);
    }
  };
  this.createNativeFunction('Number.prototype.toPrecision', wrapper, false);

  wrapper = function(radix) {
    try {
      return this.toString(radix);
    } catch (e) {
      // Throws if radix isn't within 2-36.
      thisInterpreter.throwException(thisInterpreter.RANGE_ERROR, e.message);
    }
  };
  this.createNativeFunction('Number.prototype.toString', wrapper, false);

  wrapper = function(/*locales, options*/) {
    // Messing around with arguments so that function's length is 0.
    var locales = arguments.length > 0 ?
        thisInterpreter.pseudoToNative(arguments[0]) : undefined;
    var options = arguments.length > 1 ?
        thisInterpreter.pseudoToNative(arguments[1]) : undefined;
    return this.toLocaleString(locales, options);
  };
  this.createNativeFunction('Number.prototype.toLocaleString', wrapper, false);
};

/**
 * Initialize the Date class.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initDate = function(scope) {
  var thisInterpreter = this;
  var wrapper;
  // Date prototype.  As of ES6 this is just an ordinary object.  (In
  // ES5 it had [[Class]] Date.)
  this.DATE = new this.Object;
  this.builtins_['Date.prototype'] = this.DATE;
  // Date constructor.
  wrapper = function(value, var_args) {
    if (!thisInterpreter.calledWithNew()) {
      // Called as Date().
      // Calling Date() as a function returns a string, no arguments are heeded.
      return Date();
    }
    // Called as new Date().
    var args = [null].concat(Array.from(arguments));
    var date = new thisInterpreter.Date;
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
  var functions =
      ['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString'];
  for (var i = 0; i < functions.length; i++) {
    wrapper = (function(nativeFunc) {
      return function(/*locales, options*/) {
        // Messing around with arguments so that function's length is 0.
        var locales = arguments.length > 0 ?
            thisInterpreter.pseudoToNative(arguments[0]) : undefined;
        var options = arguments.length > 1 ?
            thisInterpreter.pseudoToNative(arguments[1]) : undefined;
        return this.date[nativeFunc].call(this.date, locales, options);
      };
    })(functions[i]);
    this.createNativeFunction('Date.prototype.' + functions[i], wrapper, false);
  }
};

/**
 * Initialize Regular Expression object.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initRegExp = function(scope) {
  var thisInterpreter = this;
  var wrapper;
  // RegExp prototype.  As of ES6 this is just an ordinary object.
  // (In ES5 it had [[Class]] RegExp.)
  this.REGEXP = new this.Object;
  this.builtins_['RegExp.prototype'] = this.REGEXP;
  // RegExp constructor.
  wrapper = function(pattern, flags) {
    var regexp = new thisInterpreter.RegExp;
    pattern = pattern ? pattern.toString() : '';
    flags = flags ? flags.toString() : '';
    regexp.populate(new RegExp(pattern, flags));
    return regexp;
  };
  this.createNativeFunction('RegExp', wrapper, true);

  this.createNativeFunction('RegExp.prototype.toString',
                            this.RegExp.prototype.toString, false);

  wrapper = function(str) {
    if (!(this instanceof thisInterpreter.RegExp) ||
        !(this.regexp instanceof RegExp)) {
      thisInterpreter.throwException(
          thisInterpreter.TYPE_ERROR,
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
        Number(thisInterpreter.getProperty(this, 'lastIndex'));
    var match = this.regexp.exec(str);
    thisInterpreter.setProperty(this, 'lastIndex', this.regexp.lastIndex);

    if (match) {
      var result = new thisInterpreter.Array;
      for (var i = 0; i < match.length; i++) {
        thisInterpreter.setProperty(result, i, match[i]);
      }
      // match has additional properties.
      thisInterpreter.setProperty(result, 'index', match.index);
      thisInterpreter.setProperty(result, 'input', match.input);
      return result;
    }
    return null;
  };
  this.createNativeFunction('RegExp.prototype.exec', wrapper, false);
};

/**
 * Initialize the Error class.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initError = function(scope) {
  var thisInterpreter = this;
  // Error prototype.
  this.ERROR = new this.Error(this.OBJECT);
  this.builtins_['Error.prototype'] = this.ERROR;
  // Error constructor.
  var wrapper = function(opt_message) {
    var newError = new thisInterpreter.Error;
    if (opt_message) {
      thisInterpreter.setProperty(newError, 'message', String(opt_message),
          Interpreter.NONENUMERABLE_DESCRIPTOR);
    }
    return newError;
  };
  this.createNativeFunction('Error', wrapper, true);

  this.createNativeFunction('Error.prototype.toString', this.Error.prototype.toString,
                            false);

  var createErrorSubclass = function(name) {
    var prototype = new thisInterpreter.Error;
    thisInterpreter.builtins_[name + '.prototype'] = prototype;

    wrapper = function(opt_message) {
      var newError = new thisInterpreter.Error(prototype);
      if (opt_message) {
        thisInterpreter.setProperty(newError, 'message',
            String(opt_message), Interpreter.NONENUMERABLE_DESCRIPTOR);
      }
      return newError;
    };
    thisInterpreter.createNativeFunction(name, wrapper, true);

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
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initMath = function(scope) {
  var numFunctions = ['abs', 'acos', 'asin', 'atan', 'atan2', 'ceil', 'cos',
                      'exp', 'floor', 'log', 'max', 'min', 'pow', 'random',
                      'round', 'sin', 'sqrt', 'tan'];
  for (var i = 0; i < numFunctions.length; i++) {
    this.createNativeFunction('Math.' + numFunctions[i], Math[numFunctions[i]],
                              false);
  }
};

/**
 * Initialize JSON object.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initJSON = function(scope) {
  var thisInterpreter = this;

  var wrapper = function(text) {
    try {
      var nativeObj = JSON.parse(text.toString());
    } catch (e) {
      thisInterpreter.throwException(thisInterpreter.SYNTAX_ERROR, e.message);
    }
    return thisInterpreter.nativeToPseudo(nativeObj);
  };
  this.createNativeFunction('JSON.parse', wrapper, false);

  wrapper = function(value) {
    var nativeObj = thisInterpreter.pseudoToNative(value);
    try {
      var str = JSON.stringify(nativeObj);
    } catch (e) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR, e.message);
    }
    return str;
  };
  this.createNativeFunction('JSON.stringify', wrapper, false);
};

/**
 * Initialize the thread system API
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initThreads = function(scope) {
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
 * Initialize the networking subsystem API
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initNetwork = function(scope) {
  var intrp = this;
  this.addVariableToScope(scope, 'connectionListen', this.createNativeFunction(
      'connectionListen',
      function(port, proto) {
        var options = {
          // TODO(cpcallen): (what is says:)
          // allowHalfOpen: true
        };

        var server = net.createServer(options, function (socket) {
          // TODO(cpcallen): Add localhost test here, like this - only
          // also allow IPV6 connections:
          // if (socket.remoteAddress != '127.0.0.1') {
          //   // Reject connections other than from localhost.
          //   console.log('Rejecting connection from ' + socket.remoteAddress);
          //   socket.end('Connection rejected.');
          //   return;
          // }
          console.log('Connection from ' + socket.remoteAddress);

          // Create new object from proto.
          var obj = new intrp.Object(proto);
          obj.socket = socket;

          // Handle incoming code from clients.
          socket.on('data', function (data) {
            var func = intrp.getProperty(obj, 'receive');
            intrp.createThreadForFuncCall(func, obj, [data]);
          });
          
          socket.on('end', function () {
            console.log('Connection from ' + socket.remoteAddress + ' closed.');
            var func = intrp.getProperty(obj, 'end');
            intrp.createThreadForFuncCall(func, obj, []);
            // TODO(cpcallen): Don't fully close half-closed connection yet.
            socket.end();
          });
          // TODO(cpcallen): save socket (and new object) somewhere we
          // can find it later.
        });
        server.listen(port, function() {
          var addr = server.address();
          console.log('Listening on %s address %s port %s', addr.family,
                      addr.address, addr.port);
        });
        // TODO(cpcallen): save server somewhere we can find it later.
      }));
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
  func.parentScope = scope;
  func.node = node;
  this.setProperty(func, 'length', func.node['params'].length,
      Interpreter.READONLY_DESCRIPTOR);
  func.source = source.substring(node['start'], node['end']);
  // Record the full original source on the function node since a function call
  // can move execution from one source to another.
  node['source'] = source;
  // Also apply the same source to the body, since the function node is bypassed
  // when stepping.
  node['body']['source'] = source;
  return func;
};

/**
 * Create a new native function.
 * @param {string} Name of new function.
 * @param {!Function} nativeFunc JavaScript function.
 * @param {boolean} legalConstructor True if the function can be used as a
 *   constructor (e.g. escape), false if not (e.g. Array).
 * @return {!Interpreter.prototype.Function} New function.
*/
Interpreter.prototype.createNativeFunction =
    function(name, nativeFunc, legalConstructor) {
  var func = new this.Function;
  func.nativeFunc = nativeFunc;
  var surname = name.replace(/^.*\./, '');
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
 * @param {string} Name of new function.
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
   * @param {!Number} id Thread ID for this async function call.
   */
  var check = function(id) {
    if (done) {
      throw Error('Async function resolved or rejected more than once');
    }
    done = true;
    var thread = intrp.threads[id];
    if (!(thread instanceof Interpreter.Thread) ||
        thread.status !== Interpreter.Thread.Status.BLOCKED ||
        thread.stateStack[thread.stateStack.length - 1].node.type !=
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
      },
      function reject(value) {
        check(id);
        // Create fake 'throw' state on appropriate thread.
        // TODO(cpcallen): find a more elegant way to do this.
        var thread = intrp.threads[id];
        var node = new Interpreter.Node;
        node['type'] = 'ThrowStatement';
        var throwState = new Interpreter.State(node,
            thread.stateStack[thread.stateStack.length - 1].scope);
        throwState.done_ = true;
        throwState.value = value;
        thread.stateStack.push(throwState);
        intrp.threads[id].status = Interpreter.Thread.Status.READY;
      }];
  })(this.thread.id);
  // Prepend resolve, reject to arguments.
  var args = callbacks.concat(state.arguments_);
  this.thread.status = Interpreter.Thread.Status.BLOCKED;
  state.func_.asyncFunc.apply(state.funcThis_, args);
};

/**
 * Converts from a native JS object or value to a JS interpreter object.
 * Can handle JSON-style values.
 * @param {*} nativeObj The native JS object to be converted.
 * @return {Interpreter.Value} The equivalent JS interpreter object.
 */
Interpreter.prototype.nativeToPseudo = function(nativeObj) {
  if (typeof nativeObj === 'boolean' ||
      typeof nativeObj === 'number' ||
      typeof nativeObj === 'string' ||
      nativeObj === null || nativeObj === undefined) {
    return nativeObj;
  }

  if (nativeObj instanceof RegExp) {
    var pseudoRegexp = new this.RegExp;
    pseudoRegexp.populate(nativeObj);
    return pseudoRegexp;
  }

  var pseudoObj;
  if (Array.isArray(nativeObj)) {  // Array.
    pseudoObj = new this.Array;
    for (var i = 0; i < nativeObj.length; i++) {
      if (i in nativeObj) {
        this.setProperty(pseudoObj, i, this.nativeToPseudo(nativeObj[i]));
      }
    }
  } else {  // Object.
    pseudoObj = new this.Object;
    for (var key in nativeObj) {
      this.setProperty(pseudoObj, key, this.nativeToPseudo(nativeObj[key]));
    }
  }
  return pseudoObj;
};

/**
 * Converts from a JS interpreter object to native JS object.
 * Can handle JSON-style values, plus cycles.
 * @param {Interpreter.Value} pseudoObj The JS interpreter object to
 *     be converted.
 * @param {Object=} opt_cycles Cycle detection (used in recursive calls).
 * @return {*} The equivalent native JS object or value.
 */
Interpreter.prototype.pseudoToNative = function(pseudoObj, opt_cycles) {
  if (typeof pseudoObj === 'boolean' ||
      typeof pseudoObj === 'number' ||
      typeof pseudoObj === 'string' ||
      pseudoObj === null || pseudoObj === undefined) {
    return pseudoObj;
  }

  if (pseudoObj instanceof this.RegExp) {  // Regular expression.
    return pseudoObj.regexp;
  }

  var cycles = opt_cycles || {
    pseudo: [],
    native: []
  };
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
    for (var i = 0; i < length; i++) {
      if (this.hasProperty(pseudoObj, i)) {
        nativeObj[i] =
            this.pseudoToNative(this.getProperty(pseudoObj, i), cycles);
      }
    }
  } else {  // Object.
    nativeObj = {};
    cycles.native.push(nativeObj);
    var val;
    for (var key in pseudoObj.properties) {
      if (pseudoObj.notEnumerable.has(key)) {
        continue;
      }
      val = pseudoObj.properties[key];
      nativeObj[key] = this.pseudoToNative(val, cycles);
    }
  }
  cycles.pseudo.pop();
  cycles.native.pop();
  return nativeObj;
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
    this.throwException(this.TYPE_ERROR,
                        "Cannot read property '" + name + "' of " + obj);
  }
  if (name === 'length') {
    // Special cases for magic length property.
    if (typeof obj === 'string') {
      return obj.length;
    }
  } else if (name.charCodeAt(0) < 0x40) {
    // Might have numbers in there?
    // Special cases for string array indexing
    if (typeof obj === 'string') {
      var n = Interpreter.legalArrayIndex(name);
      if (!isNaN(n) && n < obj.length) {
        return obj[n];
      }
    }
  }
  do {
    if (obj.properties && name in obj.properties) {
      return obj.properties[name];
    }
  } while ((obj = this.getPrototype(obj)));
  return undefined;
};

/**
 * Does the named property exist on a data object.  Implements 'in'.
 * Note that although primitives have (inherited) properties, 'in' does not
 * recognize them.  Thus "'length' in 'str'" is an error.
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
 * @param {!Interpreter.prototype.Object} obj Data object.
 * @param {Interpreter.Value} name Name of property.
 * @param {Interpreter.Value|ReferenceError} value New property value.
 *   Use ReferenceError if value is handled by descriptor instead.
 * @param {Object=} opt_descriptor Optional descriptor object.
 */
Interpreter.prototype.setProperty = function(obj, name, value, opt_descriptor) {
  name = String(name);
  if (opt_descriptor && obj.notConfigurable.has(name)) {
    this.throwException(this.TYPE_ERROR, 'Cannot redefine property: ' + name);
  }
  if (!(obj instanceof this.Object)) {
    this.throwException(this.TYPE_ERROR, "Can't create property '" + name +
                        "' on '" + obj + "'");
  }
  if (obj instanceof this.Array) {
    // Arrays have a magic length variable that is bound to the elements.
    var length = obj.properties.length;
    var i;
    if (name === 'length') {
      // Delete elements if length is smaller.
      value = Interpreter.legalArrayLength(value);
      if (isNaN(value)) {
        this.throwException(this.RANGE_ERROR, 'Invalid array length');
      }
      if (value < length) {
        for (i in obj.properties) {
          i = Interpreter.legalArrayIndex(i);
          if (!isNaN(i) && value <= i) {
            delete obj.properties[i];
          }
        }
      }
    } else if (!isNaN(i = Interpreter.legalArrayIndex(name))) {
      // Increase length if this index is larger.
      obj.properties.length = Math.max(length, i + 1);
    }
  }
  if (obj.preventExtensions && !(name in obj.properties)) {
    this.throwException(this.TYPE_ERROR, "Can't add property '" + name +
                        "', object is not extensible");
  }
  if (opt_descriptor) {
    var newlyDefined = !(name in obj.properties);
    // Define the property.
    if ('configurable' in opt_descriptor) {
      if (opt_descriptor.configurable) {
        obj.notConfigurable.delete(name);  // No-op.
      } else {
        obj.notConfigurable.add(name);
      }
    } else if (newlyDefined) {
      obj.notConfigurable.add(name);
    }
    if ('enumerable' in opt_descriptor) {
      if (opt_descriptor.enumerable) {
        obj.notEnumerable.delete(name);
      } else {
        obj.notEnumerable.add(name);
      }
    } else if (newlyDefined) {
      obj.notEnumerable.add(name);
    }
    if ('writable' in opt_descriptor) {
      if (opt_descriptor.writable) {
        obj.notWritable.delete(name);
      } else {
        obj.notWritable.add(name);
      }
    } else if (newlyDefined) {
      obj.notWritable.add(name);
    }
    if ('value' in opt_descriptor) {
      obj.properties[name] = opt_descriptor.value;
    } else if (value !== ReferenceError) {
      obj.properties[name] = value;
    }
  } else {
    // Set the property.
    if (value === ReferenceError) {
      throw ReferenceError('Value not specified.');
    }
    // Determine the parent (possibly self) where the property is defined.
    var defObj = obj;
    while (!(name in defObj.properties)) {
       defObj = this.getPrototype(defObj);
       if (!defObj) {
         // This is a new property.
         defObj = obj;
         break;
       }
    }
    if (defObj.notWritable.has(name)) {
      this.throwException(this.TYPE_ERROR, "Cannot assign to read only " +
          "property '" + name + "' of object '" + obj + "'");
    } else {
      obj.properties[name] = value;
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
  for (var s = scope; s; s = s.parentScope) {
    if (name in s.properties) {
      return s.properties[name];
    }
  }
  // Typeof operator is unique: it can safely look at non-defined variables.
  var prevNode = this.thread.stateStack[this.thread.stateStack.length - 1].node;
  if (prevNode['type'] === 'UnaryExpression' &&
      prevNode['operator'] === 'typeof') {
    return undefined;
  }
  this.throwException(this.REFERENCE_ERROR, name + ' is not defined');
};

/**
 * Sets a value to the current scope.
 * @param {!Interpreter.Scope} scope Scope to write to.
 * @param {string} name Name of variable.
 * @param {Interpreter.Value} value Value.
 */
Interpreter.prototype.setValueToScope = function(scope, name, value) {
  for (var s = scope; s; s = s.parentScope) {
    if (name in s.properties) {
      if (s.notWritable.has(name)) {
        this.throwException(this.TYPE_ERROR,
                            'Assignment to constant variable: ' + name);
      }
      s.properties[name] = value;
      return;
    }
  }
  this.throwException(this.REFERENCE_ERROR, name + ' is not defined');
};

/**
 * Creates a variable in the given scope.
 * @param {!Interpreter.Scope} scope Scope to write to.
 * @param {Interpreter.Value} name Name of variable.
 * @param {Interpreter.Value} value Initial value.
 * @param {boolean=} opt_notWritable True if constant.  Defaults to false.
 */
Interpreter.prototype.addVariableToScope =
    function(scope, name, value, opt_notWritable) {
  name = String(name);
  if (!(name in scope.properties)) {
    scope.properties[name] = value;
  }
  if (opt_notWritable) {
    scope.notWritable.add(name);
  }
};

/**
 * Create a new scope for the given node.
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
  return this.thread.stateStack[this.thread.stateStack.length - 1].
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
 * Throw an exception in the interpreter that can be handled by a
 * interpreter try/catch statement.  If unhandled, a real exception will
 * be thrown.  Can be called with either an error class and a message, or
 * with an actual object to be thrown.
 * @param {Interpreter.Value} value Value to be thrown.  If message is
 *     provided a new error object is created using value as the
 *     prototype; if not it is used directly.
 * @param {string=} opt_message Message being thrown.
 */
Interpreter.prototype.throwException = function(value, opt_message) {
  var error;
  if (opt_message === undefined) {
    error = value;  // This is a value to throw, not an error proto.
  } else {
    if (!(value === null || value instanceof this.Error)) {
      throw TypeError("Can't attach message to non-Error value");
    }
    error = new this.Error(value);
    this.setProperty(error, 'message', opt_message,
        Interpreter.NONENUMERABLE_DESCRIPTOR);
  }
  this.executeException(error);
  // Abort anything related to the current step.
  throw Interpreter.STEP_ERROR;
};

/**
 * Throw an exception in the interpreter that can be handled by an
 * interpreter try/catch statement.  If unhandled, a real exception will
 * be thrown.
 * @param {Interpreter.Value} error Value being thrown.
 */
Interpreter.prototype.executeException = function(error) {
  // Search for a try statement.
  do {
    this.thread.stateStack.pop();
    var state = this.thread.stateStack[this.thread.stateStack.length - 1];
    if (state.node['type'] === 'TryStatement') {
      state.throwValue = error;
      return;
    }
  } while (state && state.node['type'] !== 'Program');

  // Throw a real error.
  var realError;
  if (error instanceof this.Error) {
    var errorTable = {
      'EvalError': EvalError,
      'RangeError': RangeError,
      'ReferenceError': ReferenceError,
      'SyntaxError': SyntaxError,
      'TypeError': TypeError,
      'URIError': URIError
    };
    var name = this.getProperty(error, 'name').toString();
    var message = this.getProperty(error, 'message').valueOf();
    var type = errorTable[name] || Error;
    realError = type(message + '\n' +
                     this.getProperty(error, 'stack'));
  } else {
    realError = error.toString();
  }
  throw realError;
};


///////////////////////////////////////////////////////////////////////////////
// Nested (but not fully inner) classes: Scope, State and Thread.
///////////////////////////////////////////////////////////////////////////////

/**
 * Class for a scope.
 * @param {Interpreter.Scope=} parentScope Inherited scope.  Defaults to null.
 * @constructor
 */
Interpreter.Scope = function(parentScope) {
  this.notWritable = new Set();
  this.properties = Object.create(null);
  this.parentScope = parentScope || null;
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
  if (id === undefined || state === undefined) {
    // Deserialising. Props will be filled in later.
    this.id = -1;
    this.status = Interpreter.Thread.Status.ZOMBIE;
    this.stateStack = [];
    this.runAt = 0;
    return;
  }
  this.id = id;
  // Say it's sleeping for now.  May be woken immediately.
  this.status = Interpreter.Thread.Status.SLEEPING;
  this.stateStack = [state];
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
 * @param {number=} opt_index Optional index in stack to look from.
 * @return {string=} Source code or undefined if none.
 */
Interpreter.Thread.prototype.getSource = function(opt_index) {
  var i = (opt_index === undefined) ?
      this.stateStack.length - 1 : opt_index;
  var source;
  while (source === undefined && i >= 0) {
    source = this.stateStack[i--].node['source'];
  }
  return source;
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
  this.notConfigurable = new Set();
  this.notEnumerable = new Set();
  this.notWritable = new Set();
  this.properties = Object.create(null);
  this.proto = null;
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
 * @constructor
 * @extends {Interpreter.prototype.Object}
 */
Interpreter.prototype.Error = function(proto) {
  throw Error('Inner class constructor not callable on prototype');
};
/** @return {string} @override */
Interpreter.prototype.Error.prototype.toString = function() {
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
    this.notConfigurable = new Set();
    this.notEnumerable = new Set();
    this.notWritable = new Set();
    this.properties = Object.create(null);
    this.proto = (proto === undefined ? intrp.OBJECT : proto);
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
   * @extends{Interpreter.prototype.Function}
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
      intrp.throwException(intrp.TYPE_ERROR,
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
      intrp.throwException(intrp.TYPE_ERROR,
          "Function has non-object prototype '" + prot +
          "' in instanceof check");
    }
    for (var v = value.proto; v !== null; v = v.proto) {
      if (v === prot) {
        return true;
      }
    }
    return false;
  }

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
   * @extends{Interpreter.prototype.Array}
   * @param {Interpreter.prototype.Object=} proto Prototype object.
   */
  intrp.Array = function(proto) {
    intrp.Object.call(/** @type {?} */(this),
        (proto === undefined ? intrp.ARRAY : proto));
    intrp.setProperty(this, 'length', 0,
                      Interpreter.NONENUMERABLE_NONCONFIGURABLE_DESCRIPTOR);
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
      // TODO(cpcallen): Array.prototype.toString should be generic,
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
   * @extends{Interpreter.prototype.Date}
   * @param {Interpreter.prototype.Object=} proto Prototype object.
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
      intrp.throwException(intrp.TYPE_ERROR,
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
      intrp.throwException(intrp.TYPE_ERROR,
          'Date.prototype.valueOf is not generic');
    }
    return this.date.valueOf();
  };

  /**
   * Class for a regexp
   * @constructor
   * @extends{Interpreter.prototype.RegExp}
   * @param {Interpreter.prototype.Object=} proto Prototype object.
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
    // TODO(cpcallen): this should do some weird stuff per §21.2.5.14 of
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
   * @extends{Interpreter.prototype.Error}
   * @param {Interpreter.prototype.Object=} proto Prototype object.
   */
  intrp.Error = function(proto) {
    intrp.Object.call(/** @type {?} */(this),
        (proto === undefined ? intrp.ERROR : proto));
    // Construct a text-based stack.
    // Don't bother when building Error.prototype.
    if (intrp.thread) {
      var stack = [];
      for (var i = intrp.thread.stateStack.length - 1; i >= 0; i--) {
        var state = intrp.thread.stateStack[i];
        var node = state.node;
        if (node['type'] !== 'CallExpression' && stack.length) {
          continue;
        }
        var code = intrp.thread.getSource(i);
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
        this.throwException(this.TYPE_ERROR,
            "'in' expects an object, not '" + rightValue + "'");
      }
      value = this.hasProperty(rightValue, leftValue);
      break;
    case 'instanceof':
      if (!(rightValue instanceof this.Function)) {
        this.throwException(this.TYPE_ERROR,
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
  stack.pop();
  var label = null;
  if (node['label']) {
    label = node['label']['name'];
  }
  while (state &&
         state.node['type'] !== 'CallExpression' &&
         state.node['type'] !== 'NewExpression') {
    if (label) {
      if (state.labels && state.labels.indexOf(label) !== -1) {
        return;
      }
    } else if (state.isLoop || state.isSwitch) {
      return;
    }
    state = stack.pop();
  }
  // Syntax error, do not allow this error to be trapped.
  throw SyntaxError('Illegal break statement');
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
      if (func[0] !== Interpreter.SCOPE_REFERENCE) {
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
          this.throwException(this.REFERENCE_ERROR, func + ' is not a builtin');
        }
        stack.pop();
        if (stack.length > 0) {
          stack[stack.length - 1].value = this.builtins_[func];
        }
        return;
      }
      if (!(func instanceof this.Function)) {
        this.throwException(this.TYPE_ERROR, func + ' is not a function');
      } else if (func.illegalConstructor) {
        // Illegal: new escape();
        this.throwException(this.TYPE_ERROR, func + ' is not a constructor');
      }
      // Constructor, 'this' is new object.
      // TODO(cpcallen): need type check to make sure .prototype is an object.
      state.funcThis_ = new this.Object(this.getProperty(func, 'prototype'));
      state.isConstructor = true;
    }
    state.doneArgs_ = true;
  }
  if (!state.doneExec_) {
    state.doneExec_ = true;
    var func = state.func_;
    // TODO(fraser): determine if this check is redundant; remove it or add
    // tests that depend on it.
    if (!(func instanceof this.Function)) {
      this.throwException(this.TYPE_ERROR, func + ' is not a function');
    }
    var funcNode = func.node;
    if (funcNode) {
      var scope = new Interpreter.Scope(func.parentScope);
      this.populateScope_(funcNode['body'], scope, this.thread.getSource());
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
        // Update current scope with definitions in eval().
        var scope = new Interpreter.Scope(state.scope);
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
      this.throwException(this.TYPE_ERROR, func.class + ' is not a function');
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
  stack.pop();
  var label = null;
  if (node['label']) {
    label = node['label']['name'];
  }
  state = stack[stack.length - 1];
  while (state &&
         state.node['type'] !== 'CallExpression' &&
         state.node['type'] !== 'NewExpression') {
    if (state.isLoop) {
      if (!label || (state.labels && state.labels.indexOf(label) !== -1)) {
        return;
      }
    }
    stack.pop();
    state = stack[stack.length - 1];
  }
  // Syntax error, do not allow this error to be trapped.
  throw SyntaxError('Illegal continue statement');
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
      this.throwException(this.SYNTAX_ERROR,
          'for-in loop variable declaration may not have an initializer.');
    }
    // Second, look up the object.  Only do so once, ever.
    return new Interpreter.State(node['right'], state.scope);
  }
  if (!state.isLoop) {
    // First iteration.
    state.isLoop = true;
    state.object_ = state.value;
    state.visited_ = new Set();
  }
  // Third, find the property name for this iteration.
  if (state.name_ === undefined) {
    done: do {
      if (state.object_ instanceof this.Object) {
        for (var prop in state.object_.properties) {
          if (!state.visited_.has(prop)) {
            state.visited_.add(prop);
            if (!state.object_.notEnumerable.has(prop)) {
              state.name_ = prop;
              break done;
            }
          }
        }
      } else {
        for (var prop in state.object_) {
          if (!state.visited_.has(prop)) {
            state.visited_.add(prop);
            state.name_ = prop;
            break done;
          }
        }
      }
      state.object_ = this.getPrototype(state.object_);
    } while (state.object_ !== null);
    if (state.object_ === null) {
      // Done, exit loop.
      stack.pop();
      return;
    }
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
  stack[stack.length - 1].value =
      this.createFunctionFromAST(node, state.scope, this.thread.getSource());
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
      this.throwException(this.SYNTAX_ERROR, "Object kind: '" +
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
  var value = state.value;
  var i = stack.length - 1;
  state = stack[i];
  while (state.node['type'] !== 'CallExpression' &&
      state.node['type'] !== 'NewExpression') {
    if (state.node['type'] !== 'TryStatement') {
      stack.splice(i, 1);
    }
    i--;
    if (i < 0) {
      // Syntax error, do not allow this error to be trapped.
      throw SyntaxError('Illegal return statement');
    }
    state = stack[i];
  }
  state.value = value;
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
      if (!state.matched_ && !stack.tested_ && switchCase['test']) {
        stack.tested_ = true;
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
      stack.tested_ = false;
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
  if (state.throwValue && !state.doneHandler_ && node['handler']) {
    state.doneHandler_ = true;
    var nextState = new Interpreter.State(node['handler'], state.scope);
    nextState.throwValue = state.throwValue;
    state.throwValue = null;  // This error has been handled, don't rethrow.
    return nextState;
  }
  if (!state.doneFinalizer_ && node['finalizer']) {
    state.doneFinalizer_ = true;
    return new Interpreter.State(node['finalizer'], state.scope);
  }
  if (state.throwValue) {
    // There was no catch handler, or the catch/finally threw an error.
    // Throw the error up to a higher try.
    this.executeException(state.throwValue);
  } else {
    stack.pop();
  }
};

Interpreter.prototype['stepUnaryExpression'] = function(stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    var nextState = new Interpreter.State(node['argument'], state.scope);
    nextState.components = node['operator'] === 'delete';
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
    // If value is not an array, then it is a primitive, or some other value.
    // If so, skip the delete and return true.
    if (Array.isArray(value)) {
      var obj = value[0];
      // Obj should be an object.  But if the AST parser is in non-strict mode
      // then obj will be a scope if the argument was a variable.
      // If so, skip the delete and return true.
      if (obj instanceof this.Object) {
        var name = String(value[1]);
        if (obj.notWritable.has(name) ||
            (name === 'length' && obj instanceof this.Array)) {
          this.throwException(this.TYPE_ERROR, "Cannot delete property '" +
                              name + "' of '" + obj + "'");
        }
        delete obj.properties[name];
      }
    }
    value = true;
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
  this.throwException(this.SYNTAX_ERROR,
                      'Strict mode code may not include a with statement');
};

Interpreter.prototype['stepWhileStatement'] =
    Interpreter.prototype['stepDoWhileStatement'];

if (typeof module !== 'undefined') { // Node.js
  net = require('net');
  acorn = require('../third_party/acorn/acorn');
  module.exports = Interpreter;
}

///////////////////////////////////////////////////////////////////////////////
// AST Node
///////////////////////////////////////////////////////////////////////////////
// This is mainly to assist the serializer getting access to the acorn
// AST node constructor, but we also use it to create a fake AST nodes
// for 'eval', and may in future use it for Closure Compiler type
// checking.

/**
 * @constructor
 */
Interpreter.Node = acorn.parse('', Interpreter.PARSE_OPTIONS).constructor;
