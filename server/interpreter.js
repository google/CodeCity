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

var acorn;

/**
 * Create a new interpreter.
 * @constructor
 */
var Interpreter = function() {
  this.installTypes();
  this.paused_ = false;
  // Unique identifier for native functions.  Used in serialization.
  this.functionCounter_ = 0;
  // Map node types to our step function names; a property lookup is faster
  // than string concatenation with "step" prefix.
  // Note that a Map is much slower than a null-parent object (v8 in 2017).
  this.functionMap_ = Object.create(null);
  var stepMatch = /^step([A-Z]\w*)$/;
  var m;
  for (var methodName in this) {
    if ((m = methodName.match(stepMatch))) {
      this.functionMap_[m[1]] = this[methodName].bind(this);
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
  this.value = undefined;
  this.stateStack = [{
    node: acorn.parse('', Interpreter.PARSE_OPTIONS),
    scope: this.global,
    done: false
  }];
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
  configurable: true,
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
 * Add more code to the interpreter.
 * @param {string|!Object} code Raw JavaScript text or AST.
 */
Interpreter.prototype.appendCode = function(code) {
  var state = this.stateStack[0];
  if (!state || state.node['type'] !== 'Program') {
    throw Error('Expecting original AST to start with a Program node.');
  }
  if (typeof code === 'string') {
    code = acorn.parse(code, Interpreter.PARSE_OPTIONS);
  }
  if (!code || code['type'] !== 'Program') {
    throw Error('Expecting new AST to start with a Program node.');
  }
  this.populateScope_(code, state.scope);
  // Append the new program to the old one.
  for (var i = 0, node; (node = code['body'][i]); i++) {
    state.node['body'].push(node);
  }
  state.done = false;
};

/**
 * Execute one step of the interpreter.
 * @return {boolean} True if a step was executed, false if no more instructions.
 */
Interpreter.prototype.step = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  if (!state) {
    return false;
  }
  var node = state.node, type = node['type'];
  if (type === 'Program' && state.done) {
    return false;
  } else if (this.paused_) {
    return true;
  }
  try {
    this.functionMap_[type](stack, state, node);
  } catch (e) {
    // Eat any step errors.  They have been thrown on the stack.
    if (e !== Interpreter.STEP_ERROR) {
      // Uh oh.  This is a real error in the interpreter.  Rethrow.
      throw e;
    }
  }
  return true;
};

/**
 * Execute the interpreter to program completion.  Vulnerable to infinite loops.
 * @return {boolean} True if a execution is asynchronously blocked,
 *     false if no more instructions.
 */
Interpreter.prototype.run = function() {
  var stack = this.stateStack;
  while (true) {
    var state = stack[stack.length - 1];
    if (!state) {
      break;
    }
    var node = state.node, type = node['type'];
    if (type === 'Program' && state.done || this.paused_) {
      break;
    }
    try {
      this.functionMap_[type](stack, state, node);
    } catch (e) {
      // Eat any step errors.  They have been thrown on the stack.
      if (e !== Interpreter.STEP_ERROR) {
        // Uh oh.  This is a real error in the interpreter.  Rethrow.
        throw e;
      }
    }
  }
  return this.paused_;
};

/**
 * Initialize the global scope with buitin properties and functions.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initGlobalScope = function(scope) {
  // Initialize uneditable global properties.
  this.addVariableToScope(scope, 'this', undefined, true);
  this.addVariableToScope(scope, 'Infinity', Infinity, true);
  this.addVariableToScope(scope, 'NaN', NaN, true);
  this.addVariableToScope(scope, 'undefined', undefined, true);

  // Create the objects which will become Object.prototype and
  // Function.prototype, which are needed to bootstrap everything else.
  this.OBJECT = new this.Object(null);
  this.FUNCTION = this.createNativeFunction(function() {});
  this.FUNCTION.proto = this.OBJECT;

  // Initialize global objects.
  this.initObject(scope);
  this.initFunction(scope);
  this.initArray(scope);
  this.initNumber(scope);
  this.initString(scope);
  this.initBoolean(scope);
  this.initDate(scope);
  this.initMath(scope);
  this.initRegExp(scope);
  this.initJSON(scope);
  this.initError(scope);

  // Initialize global functions.
  var thisInterpreter = this;
  this.addVariableToScope(scope, 'isNaN',
      this.createNativeFunction(isNaN));

  this.addVariableToScope(scope, 'isFinite',
      this.createNativeFunction(isFinite));

  var func = new this.Function;
  func.eval = true;
  func.illegalConstructor = true;
  this.setProperty(func, 'length', 1, Interpreter.READONLY_DESCRIPTOR);
  this.addVariableToScope(scope, 'eval', func);

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
    this.addVariableToScope(scope, strFunctions[i][1],
        this.createNativeFunction(wrapper));
  }
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
    newFunc.parentScope = thisInterpreter.stateStack[0].scope;
    // Acorn needs to parse code in the context of a function or else 'return'
    // statements will be syntax errors.
    try {
      var ast = acorn.parse('$ = function(' + args + ') {' + code + '};',
          Interpreter.PARSE_OPTIONS);
    } catch (e) {
      // Acorn threw a SyntaxError.  Rethrow as a trappable error.
      thisInterpreter.throwException(thisInterpreter.SYNTAX_ERROR,
          'Invalid code: ' + e.message);
    }
    if (ast['body'].length !== 1) {
      // Function('a', 'return a + 6;}; {alert(1);');
      thisInterpreter.throwException(thisInterpreter.SYNTAX_ERROR,
          'Invalid code in function body.');
    }
    newFunc.node = ast['body'][0]['expression']['right'];
    thisInterpreter.setProperty(newFunc, 'length', newFunc.node['length'],
        Interpreter.READONLY_DESCRIPTOR);
    return newFunc;
  };
  var FunctionConst = this.createNativeFunction(wrapper, this.FUNCTION);
  this.addVariableToScope(scope, 'Function', FunctionConst);

  this.FUNCTION.addNativeMethod('toString', this.Function.prototype.toString);

  wrapper = function(thisArg, args) {
    var state =
        thisInterpreter.stateStack[thisInterpreter.stateStack.length - 1];
    // Rewrite the current 'CallExpression' to apply a different function.
    state.func_ = this;
    // Assign the 'this' object.
    state.funcThis_ = thisArg;
    // Bind any provided arguments.
    state.arguments_ = [];
    if (args) {
      // TODO(cpcallen): this should probably accept array-like object too.
      if (args instanceof thisInterpreter.Array) {
        for (var i = 0; i < args.length; i++) {
          state.arguments_[i] = thisInterpreter.getProperty(args, i);
        }
      } else {
        thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
            'CreateListFromArrayLike called on non-object');
      }
    }
    state.doneExec_ = false;
  };
  this.FUNCTION.addNativeMethod('apply', wrapper);

  wrapper = function(thisArg, var_args) {
    var state =
        thisInterpreter.stateStack[thisInterpreter.stateStack.length - 1];
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
  this.FUNCTION.addNativeMethod('call', wrapper);

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
  var ObjectConst = this.createNativeFunction(wrapper, this.OBJECT);
  this.addVariableToScope(scope, 'Object', ObjectConst);

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
  ObjectConst.addNativeMethod('is', Object.is);

  wrapper = function(obj) {
    throwIfNullUndefined(obj);
    var props = (obj instanceof thisInterpreter.Object) ? obj.properties : obj;
    return thisInterpreter.nativeToPseudo(Object.getOwnPropertyNames(props));
  };
  ObjectConst.addNativeMethod('getOwnPropertyNames', wrapper);

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
  ObjectConst.addNativeMethod('keys', wrapper);

  wrapper = function(proto) {
    if (proto === null) {
      return new thisInterpreter.Object(null);
    }
    if (!(proto === null || proto instanceof thisInterpreter.Object)) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          'Object prototype may only be an Object or null');
    }
    return new thisInterpreter.Object(proto);
  };
  ObjectConst.addNativeMethod('create', wrapper);

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
    var nativeDescriptor = {
      configurable: thisInterpreter.getProperty(descriptor, 'configurable'),
      enumerable: thisInterpreter.getProperty(descriptor, 'enumerable'),
      writable: thisInterpreter.getProperty(descriptor, 'writable')
    };
    var value = thisInterpreter.getProperty(descriptor, 'value');
    thisInterpreter.setProperty(obj, prop, value, nativeDescriptor);
    return obj;
  };
  ObjectConst.addNativeMethod('defineProperty', wrapper);

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
  ObjectConst.addNativeMethod('getOwnPropertyDescriptor', wrapper);

  wrapper = function(obj) {
    throwIfNullUndefined(obj);
    return thisInterpreter.getPrototype(obj);
  };
  ObjectConst.addNativeMethod('getPrototypeOf', wrapper);

  wrapper = function(obj) {
    return Boolean(obj) && !obj.preventExtensions;
  };
  ObjectConst.addNativeMethod('isExtensible', wrapper);

  wrapper = function(obj) {
    if (obj instanceof thisInterpreter.Object) {
      obj.preventExtensions = true;
    }
    return obj;
  };
  ObjectConst.addNativeMethod('preventExtensions', wrapper);

  // Instance methods on Object.
  this.OBJECT.addNativeMethod('toString', this.Object.prototype.toString);
  this.OBJECT.addNativeMethod('toLocaleString', this.Object.prototype.toString);
  this.OBJECT.addNativeMethod('valueOf', this.Object.prototype.valueOf);

  wrapper = function(prop) {
    throwIfNullUndefined(this);
    if (!(this instanceof thisInterpreter.Object)) {
      return this.hasOwnProperty(prop);
    }
    return String(prop) in this.properties;
  };
  this.OBJECT.addNativeMethod('hasOwnProperty', wrapper);

  wrapper = function(prop) {
    throwIfNullUndefined(this);
    return String(prop) in this.properties && !this.notEnumerable.has(prop);
  };
  this.OBJECT.addNativeMethod('propertyIsEnumerable', wrapper);

  wrapper = function(obj) {
    while (true) {
      // Note, circular loops shouldn't be possible.
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
  this.OBJECT.addNativeMethod('isPrototypeOf',  wrapper);
};

/**
 * Initialize the Array class.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initArray = function(scope) {
  var thisInterpreter = this;
  // Array prototype.
  this.ARRAY = new this.Array(this.OBJECT);
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
      newArray.length = first;
    } else {
      for (var i = 0; i < arguments.length; i++) {
        newArray.properties[i] = arguments[i];
      }
      newArray.length = i;
    }
    return newArray;
  };
  var ArrayConst = this.createNativeFunction(wrapper, this.ARRAY);
  this.addVariableToScope(scope, 'Array', ArrayConst);

  // Static methods on Array.
  wrapper = function(obj) {
    return obj instanceof thisInterpreter.Array;
  };
  ArrayConst.addNativeMethod('isArray', wrapper);

  // Instance methods on Array.
  this.ARRAY.addNativeMethod('toString', this.Array.prototype.toString);

  wrapper = function() {
    if (this.length) {
      var value = this.properties[this.length - 1];
      delete this.properties[this.length - 1];
      this.length--;
    } else {
      var value = undefined;
    }
    return value;
  };
  this.ARRAY.addNativeMethod('pop', wrapper);

  wrapper = function(var_args) {
    for (var i = 0; i < arguments.length; i++) {
      this.properties[this.length] = arguments[i];
      this.length++;
    }
    return this.length;
  };
  this.ARRAY.addNativeMethod('push', wrapper);

  wrapper = function() {
    if (!this.length) {
      return undefined;
    }
    var value = this.properties[0];
    for (var i = 1; i < this.length; i++) {
      this.properties[i - 1] = this.properties[i];
    }
    this.length--;
    delete this.properties[this.length];
    return value;
  };
  this.ARRAY.addNativeMethod('shift', wrapper);

  wrapper = function(var_args) {
    for (var i = this.length - 1; i >= 0; i--) {
      this.properties[i + arguments.length] = this.properties[i];
    }
    this.length += arguments.length;
    for (var i = 0; i < arguments.length; i++) {
      this.properties[i] = arguments[i];
    }
    return this.length;
  };
  this.ARRAY.addNativeMethod('unshift', wrapper);

  wrapper = function() {
    for (var i = 0; i < this.length / 2; i++) {
      var tmp = this.properties[this.length - i - 1];
      this.properties[this.length - i - 1] = this.properties[i];
      this.properties[i] = tmp;
    }
    return this;
  };
  this.ARRAY.addNativeMethod('reverse', wrapper);

  wrapper = function(index, howmany /*, var_args*/) {
    index = getInt(index, 0);
    if (index < 0) {
      index = Math.max(this.length + index, 0);
    } else {
      index = Math.min(index, this.length);
    }
    howmany = getInt(howmany, Infinity);
    howmany = Math.min(howmany, this.length - index);
    var removed = new thisInterpreter.Array;
    // Remove specified elements.
    for (var i = index; i < index + howmany; i++) {
      removed.properties[removed.length++] = this.properties[i];
      this.properties[i] = this.properties[i + howmany];
    }
    // Move other element to fill the gap.
    for (var i = index + howmany; i < this.length - howmany; i++) {
      this.properties[i] = this.properties[i + howmany];
    }
    // Delete superfluous properties.
    for (var i = this.length - howmany; i < this.length; i++) {
      delete this.properties[i];
    }
    this.length -= howmany;
    // Insert specified items.
    for (var i = this.length - 1; i >= index; i--) {
      this.properties[i + arguments.length - 2] = this.properties[i];
    }
    this.length += arguments.length - 2;
    for (var i = 2; i < arguments.length; i++) {
      this.properties[index + i - 2] = arguments[i];
    }
    return removed;
  };
  this.ARRAY.addNativeMethod('splice', wrapper);

  wrapper = function(opt_begin, opt_end) {
    var list = new thisInterpreter.Array;
    var begin = getInt(opt_begin, 0);
    if (begin < 0) {
      begin = this.length + begin;
    }
    begin = Math.max(0, Math.min(begin, this.length));
    var end = getInt(opt_end, this.length);
    if (end < 0) {
      end = this.length + end;
    }
    end = Math.max(0, Math.min(end, this.length));
    var length = 0;
    for (var i = begin; i < end; i++) {
      var element = thisInterpreter.getProperty(this, i);
      thisInterpreter.setProperty(list, length++, element);
    }
    return list;
  };
  this.ARRAY.addNativeMethod('slice', wrapper);

  wrapper = function(opt_separator) {
    var cycles = thisInterpreter.toStringCycles_;
    cycles.push(this);
    try {
      var text = [];
      for (var i = 0; i < this.length; i++) {
        text[i] = String(this.properties[i]);
      }
    } finally {
      cycles.pop();
    }
    return text.join(opt_separator);
  };
  this.ARRAY.addNativeMethod('join', wrapper);

  wrapper = function(var_args) {
    var list = new thisInterpreter.Array;
    var length = 0;
    // Start by copying the current array.
    for (var i = 0; i < this.length; i++) {
      var element = thisInterpreter.getProperty(this, i);
      thisInterpreter.setProperty(list, length++, element);
    }
    // Loop through all arguments and copy them in.
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (value instanceof thisInterpreter.Array) {
        for (var j = 0; j < value.length; j++) {
          var element = thisInterpreter.getProperty(value, j);
          thisInterpreter.setProperty(list, length++, element);
        }
      } else {
        thisInterpreter.setProperty(list, length++, value);
      }
    }
    return list;
  };
  this.ARRAY.addNativeMethod('concat', wrapper);

  wrapper = function(searchElement, opt_fromIndex) {
    searchElement = searchElement || undefined;
    var fromIndex = getInt(opt_fromIndex, 0);
    if (fromIndex < 0) {
      fromIndex = this.length + fromIndex;
    }
    fromIndex = Math.max(0, fromIndex);
    for (var i = fromIndex; i < this.length; i++) {
      var element = thisInterpreter.getProperty(this, i);
      if (element === searchElement) {
        return i;
      }
    }
    return -1;
  };
  this.ARRAY.addNativeMethod('indexOf', wrapper);

  wrapper = function(searchElement, opt_fromIndex) {
    searchElement = searchElement || undefined;
    var fromIndex = getInt(opt_fromIndex, this.length);
    if (fromIndex < 0) {
      fromIndex = this.length + fromIndex;
    }
    fromIndex = Math.min(fromIndex, this.length - 1);
    for (var i = fromIndex; i >= 0; i--) {
      var element = thisInterpreter.getProperty(this, i);
      if (element === searchElement) {
        return i;
      }
    }
    return -1;
  };
  this.ARRAY.addNativeMethod('lastIndexOf', wrapper);
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
  this.NUMBER.class = 'Number';
  // Number constructor.
  var NumberConst = this.createNativeFunction(Number, this.NUMBER);
  NumberConst.illegalConstructor = true;  // Don't allow 'new Number(x)'.
  this.addVariableToScope(scope, 'Number', NumberConst);

  var numConsts = ['MAX_VALUE', 'MIN_VALUE', 'NaN', 'NEGATIVE_INFINITY',
                   'POSITIVE_INFINITY'];
  for (var i = 0; i < numConsts.length; i++) {
    this.setProperty(NumberConst, numConsts[i], Number[numConsts[i]],
        Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  }

  // Static methods on Number.

  var nativeParseFloat = this.createNativeFunction(Number.parseFloat);
  this.setProperty(NumberConst, 'parseFloat', nativeParseFloat,
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  var nativeParseInt = this.createNativeFunction(Number.parseInt);
  this.setProperty(NumberConst, 'parseInt', nativeParseInt,
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  // parseFloat and parseInt === Number.parseFloat and Number.parseInt
  this.addVariableToScope(scope, 'parseFloat', nativeParseFloat);
  this.addVariableToScope(scope, 'parseInt', nativeParseInt);

  // Instance methods on Number.
  wrapper = function(fractionDigits) {
    try {
      return this.toExponential(fractionDigits);
    } catch (e) {
      // Throws if fractionDigits isn't within 0-20.
      thisInterpreter.throwException(thisInterpreter.RANGE_ERROR, e.message);
    }
  };
  this.NUMBER.addNativeMethod('toExponential', wrapper);

  wrapper = function(digits) {
    try {
      return this.toFixed(digits);
    } catch (e) {
      // Throws if digits isn't within 0-20.
      thisInterpreter.throwException(thisInterpreter.RANGE_ERROR, e.message);
    }
  };
  this.NUMBER.addNativeMethod('toFixed', wrapper);

  wrapper = function(precision) {
    try {
      return this.toPrecision(precision);
    } catch (e) {
      // Throws if precision isn't within range (depends on implementation).
      thisInterpreter.throwException(thisInterpreter.RANGE_ERROR, e.message);
    }
  };
  this.NUMBER.addNativeMethod('toPrecision', wrapper);

  wrapper = function(radix) {
    try {
      return this.toString(radix);
    } catch (e) {
      // Throws if radix isn't within 2-36.
      thisInterpreter.throwException(thisInterpreter.RANGE_ERROR, e.message);
    }
  };
  this.NUMBER.addNativeMethod('toString', wrapper);

  wrapper = function(/*locales, options*/) {
    // Messing around with arguments so that function's length is 0.
    var locales = arguments.length > 0 ?
        thisInterpreter.pseudoToNative(arguments[0]) : undefined;
    var options = arguments.length > 1 ?
        thisInterpreter.pseudoToNative(arguments[1]) : undefined;
    return this.toLocaleString(locales, options);
  };
  this.NUMBER.addNativeMethod('toLocaleString', wrapper);
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
  this.STRING.class = 'String';
  // String constructor.
  var StringConst = this.createNativeFunction(String, this.STRING);
  StringConst.illegalConstructor = true;  // Don't allow 'new String(x)'.
  this.addVariableToScope(scope, 'String', StringConst);

  // Static methods on String.
  StringConst.addNativeMethod('fromCharCode', String.fromCharCode);

  // Instance methods on String.
  // Methods with exclusively primitive arguments.
  var functions = ['trim', 'toLowerCase', 'toUpperCase',
      'toLocaleLowerCase', 'toLocaleUpperCase', 'charAt', 'charCodeAt',
      'substring', 'slice', 'substr', 'indexOf', 'lastIndexOf', 'concat'];
  for (var i = 0; i < functions.length; i++) {
    this.STRING.addNativeMethod(functions[i], String.prototype[functions[i]]);
  }

  wrapper = function(compareString /*, locales, options*/) {
    // Messing around with arguments so that function's length is 1.
    var locales = arguments.length > 1 ?
        thisInterpreter.pseudoToNative(arguments[1]) : undefined;
    var options = arguments.length > 2 ?
        thisInterpreter.pseudoToNative(arguments[2]) : undefined;
    return this.localeCompare(compareString, locales, options);
  };
  this.STRING.addNativeMethod('localeCompare', wrapper);

  wrapper = function(separator, limit) {
    if (separator instanceof thisInterpreter.RegExp) {
      separator = separator.data;
    }
    var jsList = this.split(separator, limit);
    return thisInterpreter.nativeToPseudo(jsList);
  };
  this.STRING.addNativeMethod('split', wrapper);

  wrapper = function(regexp) {
    regexp = regexp ? regexp.data : undefined;
    var match = this.match(regexp);
    if (!match) {
      return null;
    }
    return thisInterpreter.nativeToPseudo(match);
  };
  this.STRING.addNativeMethod('match', wrapper);

  wrapper = function(regexp) {
    regexp = regexp ? regexp.data : undefined;
    return this.search(regexp);
  };
  this.STRING.addNativeMethod('search', wrapper);

  wrapper = function(substr, newSubStr) {
    // TODO: Rewrite as a polyfill to support function replacements.
    return this.replace(substr, newSubStr);
  };
  this.STRING.addNativeMethod('replace', wrapper);
};

/**
 * Initialize the Boolean class.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initBoolean = function(scope) {
  var thisInterpreter = this;
  // Boolean prototype.
  this.BOOLEAN = new this.Object;
  this.BOOLEAN.class = 'Boolean';
  // Boolean constructor.
  var BooleanConst = this.createNativeFunction(Boolean, this.BOOLEAN);
  BooleanConst.illegalConstructor = true;  // Don't allow 'new Boolean(x)'.
  this.addVariableToScope(scope, 'Boolean', BooleanConst);
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
  var DateConst = this.createNativeFunction(wrapper, this.DATE);
  this.addVariableToScope(scope, 'Date', DateConst);

  // Static methods on Date.
  DateConst.addNativeMethod('now', Date.now);
  DateConst.addNativeMethod('parse', Date.parse);
  DateConst.addNativeMethod('UTC', Date.UTC);

  // Instance methods on Date.
  this.DATE.addNativeMethod('toString', this.Date.prototype.toString);

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
    this.DATE.addNativeMethod(functions[i], wrapper);
  }
  var functions = ['toLocaleDateString', 'toLocaleString',
                   'toLocaleTimeString'];
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
    this.DATE.addNativeMethod(functions[i], wrapper);
  }
};

/**
 * Initialize Math object.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initMath = function(scope) {
  var thisInterpreter = this;
  var myMath = new this.Object;
  this.addVariableToScope(scope, 'Math', myMath);
  var mathConsts = ['E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'PI',
                    'SQRT1_2', 'SQRT2'];
  for (var i = 0; i < mathConsts.length; i++) {
    this.setProperty(myMath, mathConsts[i], Math[mathConsts[i]],
        Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  }
  var numFunctions = ['abs', 'acos', 'asin', 'atan', 'atan2', 'ceil', 'cos',
                      'exp', 'floor', 'log', 'max', 'min', 'pow', 'random',
                      'round', 'sin', 'sqrt', 'tan'];
  for (var i = 0; i < numFunctions.length; i++) {
    myMath.addNativeMethod(numFunctions[i], Math[numFunctions[i]]);
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
  // RegExp constructor.
  wrapper = function(pattern, flags) {
    var regexp = new thisInterpreter.RegExp;
    pattern = pattern ? pattern.toString() : '';
    flags = flags ? flags.toString() : '';
    regexp.populate(new RegExp(pattern, flags));
    return regexp;
  };
  var RegExpConst = this.createNativeFunction(wrapper, this.REGEXP);
  this.addVariableToScope(scope, 'RegExp', RegExpConst);

  this.setProperty(this.REGEXP, 'global', undefined,
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(this.REGEXP, 'ignoreCase', undefined,
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(this.REGEXP, 'multiline', undefined,
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(this.REGEXP, 'source', '(?:)',
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);

  this.REGEXP.addNativeMethod('toString', this.RegExp.prototype.toString);

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
  this.REGEXP.addNativeMethod('test', wrapper);

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
  this.REGEXP.addNativeMethod('exec', wrapper);
};

/**
 * Initialize JSON object.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initJSON = function(scope) {
  var thisInterpreter = this;
  var myJSON = new thisInterpreter.Object;
  this.addVariableToScope(scope, 'JSON', myJSON);

  var wrapper = function(text) {
    try {
      var nativeObj = JSON.parse(text.toString());
    } catch (e) {
      thisInterpreter.throwException(thisInterpreter.SYNTAX_ERROR, e.message);
    }
    return thisInterpreter.nativeToPseudo(nativeObj);
  };
  myJSON.addNativeMethod('parse', wrapper);
  wrapper = function(value) {
    var nativeObj = thisInterpreter.pseudoToNative(value);
    try {
      var str = JSON.stringify(nativeObj);
    } catch (e) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR, e.message);
    }
    return str;
  };
  myJSON.addNativeMethod('stringify', wrapper);
};

/**
 * Initialize the Error class.
 * @param {!Interpreter.Scope} scope Global scope.
 */
Interpreter.prototype.initError = function(scope) {
  var thisInterpreter = this;
  // Error prototype.
  this.ERROR = new this.Error(this.OBJECT);
  // Error constructor.
  var ErrorConst = this.createNativeFunction(function(opt_message) {
    var newError = new thisInterpreter.Error;
    if (opt_message) {
      thisInterpreter.setProperty(newError, 'message', String(opt_message),
          Interpreter.NONENUMERABLE_DESCRIPTOR);
    }
    return newError;
  }, this.ERROR);
  this.addVariableToScope(scope, 'Error', ErrorConst);

  this.setProperty(this.ERROR, 'message', '',
      Interpreter.NONENUMERABLE_DESCRIPTOR);
  this.setProperty(this.ERROR, 'name', 'Error',
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  this.ERROR.addNativeMethod('toString', this.Error.prototype.toString);

  var createErrorSubclass = function(name) {
    var prototype = new thisInterpreter.Error;
    thisInterpreter.setProperty(prototype, 'name', name,
        Interpreter.NONENUMERABLE_DESCRIPTOR);
    var constructor = thisInterpreter.createNativeFunction(
        function(opt_message) {
          var newError = new thisInterpreter.Error(prototype);
          if (opt_message) {
            thisInterpreter.setProperty(newError, 'message',
                String(opt_message), Interpreter.NONENUMERABLE_DESCRIPTOR);
          }
          return newError;
        }, prototype);
    thisInterpreter.addVariableToScope(scope, name, constructor);

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
 * Create a new function.
 * @param {!Object} node AST node defining the function.
 * @param {!Interpreter.Scope} scope Parent scope.
 * @return {!Interpreter.prototype.Function} New function.
 */
Interpreter.prototype.createFunctionFromAST = function(node, scope) {
  var func = new this.Function;
  func.addPrototype();
  func.parentScope = scope;
  func.node = node;
  this.setProperty(func, 'length', func.node['params'].length,
      Interpreter.READONLY_DESCRIPTOR);
  return func;
};

/**
 * Create a new native function.
 * @param {!Function} nativeFunc JavaScript function.
 * @param {Interpreter.prototype.Object=} prototype If an object (or
 *     null) is supplied, that object will be added as the function's
 *     .prototype property (with the object receiving a corresponding
 *     .constructor property).  If undefined or omitted the function
 *     cannot be used as a constructor (e.g. escape).
 * @return {!Interpreter.prototype.Function} New function.
 */
Interpreter.prototype.createNativeFunction = function(nativeFunc, prototype) {
  var func = new this.Function;
  func.nativeFunc = nativeFunc;
  nativeFunc.id = this.functionCounter_++;
  this.setProperty(func, 'length', nativeFunc.length,
      Interpreter.READONLY_DESCRIPTOR);
  if (prototype === undefined) {
    func.illegalConstructor = true;
  } else {
    func.addPrototype(prototype);
  }
  return func;
};

/**
 * Create a new native asynchronous function.
 * @param {!Function} asyncFunc JavaScript function.
 * @return {!Interpreter.prototype.Object} New function.
 */
Interpreter.prototype.createAsyncFunction = function(asyncFunc) {
  var func = new this.Function;
  func.addPrototype(); // TODO(cpcallen): is this necessary?
  func.asyncFunc = asyncFunc;
  asyncFunc.id = this.functionCounter_++;
  this.setProperty(func, 'length', asyncFunc.length,
      Interpreter.READONLY_DESCRIPTOR);
  return func;
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

  if (nativeObj instanceof Function) {
    var interpreter = this;
    var wrapper = function() {
      return interpreter.nativeToPseudo(
        nativeObj.apply(interpreter,
          Array.prototype.slice.call(arguments)
          .map(function(i) {
            return interpreter.pseudoToNative(i);
          })
        )
      );
    };
    return this.createNativeFunction(wrapper, undefined);
  }

  var pseudoObj;
  if (Array.isArray(nativeObj)) {  // Array.
    pseudoObj = new this.Array;
    for (var i = 0; i < nativeObj.length; i++) {
      this.setProperty(pseudoObj, i, this.nativeToPseudo(nativeObj[i]));
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
    return pseudoObj.data;
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
    for (var i = 0; i < pseudoObj.length; i++) {
      nativeObj[i] = this.pseudoToNative(pseudoObj.properties[i], cycles);
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
    } else if (obj instanceof this.Array) {
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
  if (name === 'length' && obj instanceof this.Array) {
    return true;
  }
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
 * @param {Interpreter.Value} value New property value.
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
    var i;
    if (name === 'length') {
      // Delete elements if length is smaller.
      var newLength = Interpreter.legalArrayLength(value);
      if (isNaN(newLength)) {
        this.throwException(this.RANGE_ERROR, 'Invalid array length');
      }
      if (newLength < obj.length) {
        for (i in obj.properties) {
          i = Interpreter.legalArrayIndex(i);
          if (!isNaN(i) && newLength <= i) {
            delete obj.properties[i];
          }
        }
      }
      obj.length = newLength;
      return;  // Don't set a real length property.
    } else if (!isNaN(i = Interpreter.legalArrayIndex(name))) {
      // Increase length if this index is larger.
      obj.length = Math.max(obj.length, i + 1);
    }
  }
  if (!obj.properties[name] && obj.preventExtensions) {
    this.throwException(this.TYPE_ERROR, "Can't add property '" + name +
                        "', object is not extensible");
  }
  if (opt_descriptor) {
    var previouslyDefined = name in obj.properties;
    // Define the property.
    obj.properties[name] = value;
    if ((!previouslyDefined || opt_descriptor.configurable !== undefined) &&
        !opt_descriptor.configurable) {
      obj.notConfigurable.add(name);
    }
    if (!previouslyDefined || opt_descriptor.enumerable !== undefined) {
      if (opt_descriptor.enumerable) {
        obj.notEnumerable.delete(name);
      } else {
        obj.notEnumerable.add(name);
      }
    }
    if (!previouslyDefined || opt_descriptor.writable !== undefined) {
      if (opt_descriptor.writable) {
        obj.notWritable.delete(name);
      } else {
        obj.notWritable.add(name);
      }
    }
  } else {
    // Set the property.
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
 * Delete a property value on a data object.
 * @param {!Interpreter.prototype.Object} obj Data object.
 * @param {Interpreter.Value} name Name of property.
 * @return {boolean} True if deleted, false if undeletable.
 */
Interpreter.prototype.deleteProperty = function(obj, name) {
  name = String(name);
  if (!(obj instanceof this.Object) || obj.notWritable.has(name)) {
    return false;
  }
 if (name === 'length' && obj instanceof this.Array) {
    return false;
  }
  return delete obj.properties[name];
};

/**
 * Returns the current scope from the stateStack.
 * @return {!Interpreter.Scope} Current scope dictionary.
 */
Interpreter.prototype.getScope = function() {
  var scope = this.stateStack[this.stateStack.length - 1].scope;
  if (!scope) {
    throw Error('No scope found.');
  }
  return scope;
};

/**
 * Retrieves a value from the scope chain.
 * @param {string} name Name of variable.
 * @return {Interpreter.Value} Value (may be undefined).
 */
Interpreter.prototype.getValueFromScope = function(name) {
  var scope = this.getScope();
  while (scope) {
    if (name in scope.properties) {
      return scope.properties[name];
    }
    scope = scope.parentScope;
  }
  // Typeof operator is unique: it can safely look at non-defined variables.
  var prevNode = this.stateStack[this.stateStack.length - 1].node;
  if (prevNode['type'] === 'UnaryExpression' &&
      prevNode['operator'] === 'typeof') {
    return undefined;
  }
  this.throwException(this.REFERENCE_ERROR, name + ' is not defined');
};

/**
 * Sets a value to the current scope.
 * @param {string} name Name of variable.
 * @param {Interpreter.Value} value Value.
 */
Interpreter.prototype.setValueToScope = function(name, value) {
  var scope = this.getScope();
  while (scope) {
    if (name in scope.properties) {
      if (scope.notWritable.has(name)) {
        this.throwException(this.TYPE_ERROR,
                            'Assignment to constant variable: ' + name);
      }
      scope.properties[name] = value;
      return;
    }
    scope = scope.parentScope;
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
 * @param {!Object} node AST node (program or function).
 * @param {!Interpreter.Scope} scope Scope dictionary to populate.
 * @private
 */
Interpreter.prototype.populateScope_ = function(node, scope) {
  if (node['type'] === 'VariableDeclaration') {
    for (var i = 0; i < node['declarations'].length; i++) {
      this.addVariableToScope(scope, node['declarations'][i]['id']['name'],
                              undefined);
    }
  } else if (node['type'] === 'FunctionDeclaration') {
    this.addVariableToScope(scope, node['id']['name'],
                            this.createFunctionFromAST(node, scope));
    return;  // Do not recurse into function.
  } else if (node['type'] === 'FunctionExpression') {
    return;  // Do not recurse into function.
  } else if (node['type'] === 'ExpressionStatement') {
    return;  // Expressions can't contain variable/function declarations.
  }
  var nodeClass = node['constructor'];
  for (var name in node) {
    var prop = node[name];
    if (prop && typeof prop === 'object') {
      if (Array.isArray(prop)) {
        for (var i = 0; i < prop.length; i++) {
          if (prop[i] && prop[i].constructor === nodeClass) {
            this.populateScope_(prop[i], scope);
          }
        }
      } else {
        if (prop.constructor === nodeClass) {
          this.populateScope_(prop, scope);
        }
      }
    }
  }
};

/**
 * Remove start and end values from AST, or set start and end values to a
 * constant value.  Used to remove highlighting from polyfills and to set
 * highlighting in an eval to cover the entire eval expression.
 * @param {!Object} node AST node.
 * @param {number=} start Starting character of all nodes, or undefined.
 * @param {number=} end Ending character of all nodes, or undefined.
 * @private
 */
Interpreter.stripLocations_ = function(node, start, end) {
  if (start) {
    node['start'] = start;
  } else {
    delete node['start'];
  }
  if (end) {
    node['end'] = end;
  } else {
    delete node['end'];
  }
  for (var name in node) {
    if (node.hasOwnProperty(name)) {
      var prop = node[name];
      if (prop && typeof prop === 'object') {
        Interpreter.stripLocations_(prop, start, end);
      }
    }
  }
};

/**
 * Is the current state directly being called with as a construction with 'new'.
 * @return {boolean} True if 'new foo()', false if 'foo()'.
 */
Interpreter.prototype.calledWithNew = function() {
  return this.stateStack[this.stateStack.length - 1].isConstructor;
};

/**
 * Gets a value from the scope chain or from an object property.
 * @param {!Array} ref Name of variable or object/propname tuple.
 * @return {Interpreter.Value} Value (may be undefined).
 */
Interpreter.prototype.getValue = function(ref) {
  if (ref[0] === Interpreter.SCOPE_REFERENCE) {
    // A null/varname variable lookup.
    return this.getValueFromScope(ref[1]);
  } else {
    // An obj/prop components tuple (foo.bar).
    return this.getProperty(ref[0], ref[1]);
  }
};

/**
 * Sets a value to the scope chain or to an object property.
 * @param {!Array} ref Name of variable or object/propname tuple.
 * @param {Interpreter.Value} value Value.
 */
Interpreter.prototype.setValue = function(ref, value) {
  if (ref[0] === Interpreter.SCOPE_REFERENCE) {
    // A null/varname variable lookup.
    this.setValueToScope(ref[1], value);
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
    this.stateStack.pop();
    var state = this.stateStack[this.stateStack.length - 1];
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
    realError = type(message);
  } else {
    realError = error.toString();
  }
  throw realError;
};

/**
 * Create and push a new state onto the statestack.
 * @param {!Object} node AST node for the state.
 * @return {!Object} New state.
 */
Interpreter.prototype.pushNode_ = function(node) {
  var state = {
    node: node,
    scope: this.stateStack[this.stateStack.length - 1].scope
  };
  this.stateStack.push(state);
  return state;
};

///////////////////////////////////////////////////////////////////////////////
// Types representing JS objects
///////////////////////////////////////////////////////////////////////////////

// This is a bunch of boilerplate that serves two purposes:
//
// * First, by declaring these types as if they were on
//   Interpreter.prototype we can get the Closure Compiler to type
//   check use of them for us.
//
// * Second, for whatever reason these declarations seem to create a
//   small performance improvement in V8.

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
  this.proto = (proto === undefined ? intrp.OBJECT : proto);
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
 * @param {string} key
 * @param {!Function} func
 */
Interpreter.prototype.Object.prototype.addNativeMethod = function(key, func) {
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
/** @param {Interpreter.prototype.Object=} prototype */
Interpreter.prototype.Function.prototype.addPrototype = function(prototype) {
  throw Error('Inner class method not callable on prototype');
};

/**
 * @param {Interpreter.prototype.Object=} proto
 * @constructor
 * @extends {Interpreter.prototype.Object}
 */
Interpreter.prototype.Array = function(proto) {
  this.length = 0;
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
   * Add a native function as a non-enumerable property of this objet.
   * @param {string} key Name of property to add
   * @param {!Function} func Native function to add.
   */
  intrp.Object.prototype.addNativeMethod = function(key, func) {
    intrp.setProperty(this, key, intrp.createNativeFunction(func),
      Interpreter.NONENUMERABLE_DESCRIPTOR);
  };

  /**
   * Class for a function
   * @param {Interpreter.prototype.Object=} proto Prototype object.
   */
  intrp.Function = function(proto) {
    intrp.Object.call(this, (proto === undefined ? intrp.FUNCTION : proto));
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
    //
    // TODO: return source code
    return 'function /*name*/ (/* args */) {/* body */}';
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
   * prototype.properites[constructor] to func.  If prototype is not
   * specified, a newly-created object will be used instead.
   * @param {Interpreter.prototype.Object=} prototype Prototype to add to this.
   */
  intrp.Function.prototype.addPrototype = function(prototype) {
    if (this.illegalConstructor) {
      // It's almost certainly an error to add a .prototype property
      // to a function we have declared isn't a constructor.  (This
      // doesn't prevent user code from doing so - just makes sure we
      // don't do it accidentally when bootstrapping or whatever.)
      throw TypeError("Illogical addition of .prototype to non-constructor");
    }
    var protoObj = prototype || new intrp.Object();
    intrp.setProperty(this, 'prototype', protoObj,
        Interpreter.NONENUMERABLE_NONCONFIGURABLE_DESCRIPTOR);
    intrp.setProperty(protoObj, 'constructor', this,
        Interpreter.NONENUMERABLE_DESCRIPTOR);
  };

  /**
   * Class for an array
   * @param {Interpreter.prototype.Object=} proto Prototype object.
   */
  intrp.Array = function(proto) {
    intrp.Object.call(this, (proto === undefined ? intrp.ARRAY : proto));
    this.length = 0;
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
      return Array.prototype.toString.apply(this);
    }
    var cycles = intrp.toStringCycles_;
    cycles.push(this);
    try {
      var strs = [];
      for (var i = 0; i < this.length; i++) {
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
   * @param {Interpreter.prototype.Object=} proto Prototype object.
   */
  intrp.Date = function(proto) {
    intrp.Object.call(this, (proto === undefined ? intrp.DATE : proto));
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
   * @param {Interpreter.prototype.Object=} proto Prototype object.
   */
  intrp.RegExp = function(proto) {
    intrp.Object.call(this, (proto === undefined ? intrp.REGEXP : proto));
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
   * @param {Interpreter.prototype.Object=} proto Prototype object.
   */
  intrp.Error = function(proto) {
    intrp.Object.call(this, (proto === undefined ? intrp.ERROR : proto));
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
    var obj = this;
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
    state.array_.length = elements.length;
  } else {
    this.setProperty(state.array_, n, state.value);
    n++;
  }
  while (n < elements.length) {
    // Skip missing elements - they're not defined, not undefined.
    if (elements[n]) {
      this.pushNode_(elements[n]);
      state.n_ = n;
      return;
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
    this.pushNode_(node['left']).components = true;
    return;
  }
  if (!state.doneRight_) {
    if (!state.leftReference_) {
      state.leftReference_ = state.value;
    }
    if (node['operator'] !== '=') {
      state.leftValue_ = this.getValue(state.leftReference_);
    }
    state.doneRight_ = true;
    this.pushNode_(node['right']);
    return;
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
  this.setValue(state.leftReference_, value);
  stack.pop();
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepBinaryExpression'] = function(stack, state, node) {
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    this.pushNode_(node['left']);
    return;
  }
  if (!state.doneRight_) {
    state.doneRight_ = true;
    state.leftValue_ = state.value;
    this.pushNode_(node['right']);
    return;
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
    this.pushNode_(expression);
  } else {
    stack.pop();
  }
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
    var nextState = this.pushNode_(node['callee']);
    nextState.components = true;
    return;
  }
  if (state.doneCallee_ === 1) {
    // Determine value of the function.
    state.doneCallee_ = 2;
    var func = state.value;
    if (Array.isArray(func)) {
      state.func_ = this.getValue(func);
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
      this.pushNode_(node['arguments'][state.n_]);
      state.n_++;
      return;
    }
    // Determine value of 'this' in function.
    if (node['type'] === 'NewExpression') {
      var func = state.func_;
      if (!(func instanceof this.Function)) {
        this.throwException(this.TYPE_ERROR, func + ' is not a function');
      } else if (func.illegalConstructor) {
        // Illegal: new escape();
        this.throwException(this.TYPE_ERROR, func + ' is not a constructor');
      }
      // Constructor, 'this' is new object.
      // TODO(cpcallen): need type check to make sure proto is an object.
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
      this.populateScope_(funcNode['body'], scope);
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
      var nextState = this.pushNode_(funcNode['body']);
      nextState.scope = scope;
      state.value = undefined;  // Default value if no explicit return.
    } else if (func.nativeFunc) {
      state.value = func.nativeFunc.apply(state.funcThis_, state.arguments_);
    } else if (func.asyncFunc) {
      var thisInterpreter = this;
      var callback = function(value) {
        state.value = value;
        thisInterpreter.paused_ = false;
      };
      var argsWithCallback = state.arguments_.concat(callback);
      this.paused_ = true;
      func.asyncFunc.apply(state.funcThis_, argsWithCallback);
      return;
    } else if (func.eval) {
      var code = state.arguments_[0];
      if (typeof code !== 'string') {  // eval()
        // Eval returns the argument if the argument is not a string.
        // eval(Array) -> Array
        state.value = code;
      } else {
        try {
          var ast = acorn.parse(String(code), Interpreter.PARSE_OPTIONS);
        } catch (e) {
          // Acorn threw a SyntaxError.  Rethrow as a trappable error.
          this.throwException(this.SYNTAX_ERROR, 'Invalid code: ' + e.message);
        }
        var evalNode = {type: 'EvalProgram_', body: ast['body']};
        Interpreter.stripLocations_(evalNode, node['start'], node['end']);
        // Update current scope with definitions in eval().
        var scope = this.getScope();
        this.populateScope_(ast, scope);
        var nextState = this.pushNode_(evalNode);
        nextState.scope = scope;
      }
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
    if (state.isConstructor && typeof state.value !== 'object') {
      stack[stack.length - 1].value = state.funcThis_;
    } else {
      stack[stack.length - 1].value = state.value;
    }
  }
};

Interpreter.prototype['stepCatchClause'] = function(stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    var scope;
    if (node['param']) {
      // Create an empty scope.
      scope = new Interpreter.Scope(this.getScope());
      // Add the argument.
      var paramName = node['param']['name'];
      this.addVariableToScope(scope, paramName, state.throwValue);
    }
    var nextState = this.pushNode_(node['body']);
    nextState.scope = scope;
  } else {
    stack.pop();
  }
};

Interpreter.prototype['stepConditionalExpression'] =
    function(stack, state, node) {
  var mode = state.mode_ || 0;
  if (mode === 0) {
    state.mode_ = 1;
    this.pushNode_(node['test']);
    return;
  }
  if (mode === 1) {
    state.mode_ = 2;
    var value = Boolean(state.value);
    if (value && node['consequent']) {
      this.pushNode_(node['consequent']);
      return;  // Execute 'if' block.
    } else if (!value && node['alternate']) {
      this.pushNode_(node['alternate']);
      return;  // Execute 'else' block.
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
    this.pushNode_(node['test']);
  } else {
    if (!state.value) {  // Done, exit loop.
      stack.pop();
    } else if (node['body']) {  // Execute the body.
      state.test_ = false;
      state.isLoop = true;
      this.pushNode_(node['body']);
    }
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
    this.pushNode_(expression);
  } else {
    stack.pop();
    stack[stack.length - 1].value = this.value;
  }
};

Interpreter.prototype['stepExpressionStatement'] =
    function(stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    this.pushNode_(node['expression']);
  } else {
    stack.pop();
    // Save this value to interpreter.value for use as a return value if
    // this code is inside an eval function.
    this.value = state.value;
  }
};

Interpreter.prototype['stepForInStatement'] = function(stack, state, node) {
  if (!state.doneObject_) {
    // First, variable initialization is illegal in strict mode.
    state.doneObject_ = true;
    if (node['left']['declarations'] &&
        node['left']['declarations'][0]['init']) {
      this.throwException(this.SYNTAX_ERROR,
          'for-in loop variable declaration may not have an initializer.');
      return;
    }
    // Second, look up the object.  Only do so once, ever.
    this.pushNode_(node['right']);
    return;
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
              state.visited_.add(prop);
              break done;
            }
          }
        }
      } else {
        for (var prop in state.object_) {
          if (!state.visited_.has(prop)) {
            state.visited_.add(prop);
            state.name_ = prop;
            state.visited_.add(prop);
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
      var nextState = this.pushNode_(left);
      nextState.components = true;
      return;
    }
  }
  if (!state.variable_) {
    state.variable_ = state.value;
  }
  // Fifth, set the variable.
  var value = state.name_;
  this.setValue(state.variable_, value);
  // Sixth, execute the body.
  if (node['body']) {
    this.pushNode_(node['body']);
  }
  // Reset back to step three.
  state.name_ = undefined;
  // Only reevaluate LHS if it wasn't a variable.
  if (state.variable_[0] !== Interpreter.SCOPE_REFERENCE) {
    state.doneVariable_ = false;
  }
};

Interpreter.prototype['stepForStatement'] = function(stack, state, node) {
  var mode = state.mode_ || 0;
  if (mode === 0) {
    state.mode_ = 1;
    if (node['init']) {
      this.pushNode_(node['init']);
    }
  } else if (mode === 1) {
    state.mode_ = 2;
    if (node['test']) {
      this.pushNode_(node['test']);
    }
  } else if (mode === 2) {
    state.mode_ = 3;
    if (node['test'] && !state.value) {
      // Done, exit loop.
      stack.pop();
    } else {  // Execute the body.
      state.isLoop = true;
      this.pushNode_(node['body']);
    }
  } else if (mode === 3) {
    state.mode_ = 1;
    if (node['update']) {
      this.pushNode_(node['update']);
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
      this.createFunctionFromAST(node, this.getScope());
};

Interpreter.prototype['stepIdentifier'] = function(stack, state, node) {
  stack.pop();
  var name = node['name'];
  var value = state.components ?
      [Interpreter.SCOPE_REFERENCE, name] : this.getValueFromScope(name);
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
  var nextState = this.pushNode_(node['body']);
  nextState.labels = labels;
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
    this.pushNode_(node['left']);
  } else if (!state.doneRight_) {
    if ((node['operator'] === '&&' && !state.value) ||
        (node['operator'] === '||' && state.value)) {
      // Shortcut evaluation.
      stack.pop();
      stack[stack.length - 1].value = state.value;
    } else {
      state.doneRight_ = true;
      this.pushNode_(node['right']);
    }
  } else {
    stack.pop();
    stack[stack.length - 1].value = state.value;
  }
};

Interpreter.prototype['stepMemberExpression'] = function(stack, state, node) {
  if (!state.doneObject_) {
    state.doneObject_ = true;
    this.pushNode_(node['object']);
    return;
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
    this.pushNode_(node['property']);
    return;
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
    this.pushNode_(property['value']);
  } else {
    stack.pop();
    stack[stack.length - 1].value = state.object_;
  }
};

Interpreter.prototype['stepProgram'] = function(stack, state, node) {
  var n = state.n_ || 0;
  var expression = node['body'][n];
  if (expression) {
    state.done = false;
    state.n_ = n + 1;
    this.pushNode_(expression);
  } else {
    state.done = true;
    // Don't pop the stateStack.
    // Leave the root scope on the tree in case the program is appended to.
  }
};

Interpreter.prototype['stepReturnStatement'] = function(stack, state, node) {
  if (node['argument'] && !state.done_) {
    state.done_ = true;
    this.pushNode_(node['argument']);
  } else {
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
  }
};

Interpreter.prototype['stepSequenceExpression'] = function(stack, state, node) {
  var n = state.n_ || 0;
  var expression = node['expressions'][n];
  if (expression) {
    state.n_ = n + 1;
    this.pushNode_(expression);
  } else {
    stack.pop();
    stack[stack.length - 1].value = state.value;
  }
};

Interpreter.prototype['stepSwitchStatement'] = function(stack, state, node) {
  if (!state.test_) {
    state.test_ = 1;
    this.pushNode_(node['discriminant']);
    return;
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
        this.pushNode_(switchCase['test']);
        return;
      }
      if (state.matched_ || state.value === state.switchValue_) {
        state.matched_ = true;
        var n = state.n_ || 0;
        if (switchCase['consequent'][n]) {
          state.isSwitch = true;
          this.pushNode_(switchCase['consequent'][n]);
          state.n_ = n + 1;
          return;
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
  stack[stack.length - 1].value = this.getValueFromScope('this');
};

Interpreter.prototype['stepThrowStatement'] = function(stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    this.pushNode_(node['argument']);
  } else {
    this.throwException(state.value);
  }
};

Interpreter.prototype['stepTryStatement'] = function(stack, state, node) {
  if (!state.doneBlock_) {
    state.doneBlock_ = true;
    this.pushNode_(node['block']);
  } else if (state.throwValue && !state.doneHandler_ && node['handler']) {
    state.doneHandler_ = true;
    var nextState = this.pushNode_(node['handler']);
    nextState.throwValue = state.throwValue;
    state.throwValue = null;  // This error has been handled, don't rethrow.
  } else if (!state.doneFinalizer_ && node['finalizer']) {
    state.doneFinalizer_ = true;
    this.pushNode_(node['finalizer']);
  } else if (state.throwValue) {
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
    var nextState = this.pushNode_(node['argument']);
    nextState.components = node['operator'] === 'delete';
    return;
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
    if (Array.isArray(value)) {
      var obj = value[0];
      var name = value[1];
    } else {
      var obj = this.getScope();
      var name = value;
    }
    value = this.deleteProperty(obj, name);
    if (!value) {
      this.throwException(this.TYPE_ERROR, "Cannot delete property '" +
                          name + "' of '" + obj + "'");
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
    var nextState = this.pushNode_(node['argument']);
    nextState.components = true;
    return;
  }
  if (!state.leftSide_) {
    state.leftSide_ = state.value;
  }
  state.leftValue_ = this.getValue(state.leftSide_);
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
  this.setValue(state.leftSide_, changeValue);
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
    this.setValueToScope(declarationNode['id']['name'], state.value);
    state.init_ = false;
    declarationNode = declarations[++n];
  }
  while (declarationNode) {
    // Skip any declarations that are not initialized.  They have already
    // been defined as undefined in populateScope_.
    if (declarationNode['init']) {
      state.n_ = n;
      state.init_ = true;
      this.pushNode_(declarationNode['init']);
      return;
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
  acorn = require('../third_party/acorn/acorn');
  module.exports = Interpreter;
}
