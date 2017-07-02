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
  // Create and initialize the global scope.
  this.global = this.createScope({}, null);
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
  ecmaVersion: 5
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

// For cycle detection in array to string and error conversion;
// see spec bug github.com/tc39/ecma262/issues/289
// Since this is for atomic actions only, it can be a class property.
Interpreter.toStringCycles_ = [];

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
    this.functionMap_[type]();
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
  while (!this.paused_ && this.step()) {}
  return this.paused_;
};

/**
 * Initialize the global scope with buitin properties and functions.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initGlobalScope = function(scope) {
  // Initialize uneditable global properties.
  this.addVariableToScope(scope, 'this', undefined, true);
  this.addVariableToScope(scope, 'Infinity', Infinity, true);
  this.addVariableToScope(scope, 'NaN', NaN, true);
  this.addVariableToScope(scope, 'undefined', undefined, true);

  // Create the objects which will become Object.prototype,
  // Function.prototype and Array.prototype, which are needed to
  // bootstrap everything else:
  this.OBJECT = this.createObject(null);
  this.FUNCTION = this.createFunction(this.OBJECT);
  this.ARRAY = this.createArray(this.OBJECT);
  
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
      this.createNativeFunction(isNaN, false));

  this.addVariableToScope(scope, 'isFinite',
      this.createNativeFunction(isFinite, false));

  var func = this.createFunction();
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
        this.createNativeFunction(wrapper, false));
  }
};

/**
 * Initialize the Function class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initFunction = function(scope) {
  var thisInterpreter = this;
  var wrapper;
  var identifierRegexp = /^[A-Za-z_$][\w$]*$/;
  // Function constructor.
  wrapper = function(var_args) {
    if (thisInterpreter.calledWithNew()) {
      // Called as new Function().
      var newFunc = this;
    } else {
      // Called as Function().
      var newFunc = thisInterpreter.createFunction();
      this.addFunctionPrototype(newFunc);
    }
    if (arguments.length) {
      var code = arguments[arguments.length - 1].toString();
    } else {
      var code = '';
    }
    var args = [];
    for (var i = 0; i < arguments.length - 1; i++) {
      var name = arguments[i].toString();
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
    var ast = acorn.parse('$ = function(' + args + ') {' + code + '};',
        Interpreter.PARSE_OPTIONS);
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
      if (args.class === 'array') {
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
  this.setNativeFunctionPrototype(FunctionConst, 'apply', wrapper);

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
  this.setNativeFunctionPrototype(FunctionConst, 'call', wrapper);

  // Function has no parent to inherit from, so it needs its own mandatory
  // toString and valueOf functions.
  wrapper = function() {
    return this.toString();
  };
  this.setNativeFunctionPrototype(FunctionConst, 'toString', wrapper);
  this.setProperty(FunctionConst, 'toString',
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);
  wrapper = function() {
    return this.valueOf();
  };
  this.setNativeFunctionPrototype(FunctionConst, 'valueOf', wrapper);
  this.setProperty(FunctionConst, 'valueOf',
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);
};

/**
 * Initialize the Object class.
 * @param {!Interpreter.Object} scope Global scope.
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
        return thisInterpreter.createObject(thisInterpreter.OBJECT);
      }
    }
    if (!value.isObject) {
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
   * @param {*} value Value to check.
   */
  var throwIfNullUndefined = function(value) {
    if (value === undefined || value === null) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          "Cannot convert '" + value + "' to object");
    }
  };

  // Static methods on Object.
  wrapper = function(obj) {
    throwIfNullUndefined(obj);
    var props = obj.isObject ? obj.properties : obj;
    return thisInterpreter.nativeToPseudo(Object.getOwnPropertyNames(props));
  };
  this.setProperty(ObjectConst, 'getOwnPropertyNames',
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function(obj) {
    throwIfNullUndefined(obj);
    if (!obj.isObject) {
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
  this.setProperty(ObjectConst, 'keys',
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function(proto) {
    if (proto === null) {
      return thisInterpreter.createObject(null);
    }
    if (proto === undefined || !proto.isObject) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          'Object prototype may only be an Object or null');
    }
    return thisInterpreter.createObject(proto);
  };
  this.setProperty(ObjectConst, 'create',
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function(obj, prop, descriptor) {
    prop += '';
    if (!obj || !obj.isObject) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          'Object.defineProperty called on non-object');
    }
    if (!descriptor || !descriptor.isObject) {
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
  this.setProperty(ObjectConst, 'defineProperty',
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function(obj, prop) {
    if (!obj || !obj.isObject) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          'Object.getOwnPropertyDescriptor called on non-object');
    }
    prop += '';
    if (!(prop in obj.properties)) {
      return undefined;
    }
    var configurable = !obj.notConfigurable.has(prop);
    var enumerable = !obj.notEnumerable.has(prop);
    var writable = !obj.notWritable.has(prop);

    var descriptor = thisInterpreter.nativeToPseudo({});
    thisInterpreter.setProperty(descriptor, 'configurable', configurable);
    thisInterpreter.setProperty(descriptor, 'enumerable', enumerable);
    thisInterpreter.setProperty(descriptor, 'writable', writable);
    thisInterpreter.setProperty(descriptor, 'value',
        thisInterpreter.getProperty(obj, prop));
    return descriptor;
  };
  this.setProperty(ObjectConst, 'getOwnPropertyDescriptor',
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function(obj) {
    throwIfNullUndefined(obj);
    return thisInterpreter.getPrototype(obj);
  };
  this.setProperty(ObjectConst, 'getPrototypeOf',
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function(obj) {
    return Boolean(obj) && !obj.preventExtensions;
  };
  this.setProperty(ObjectConst, 'isExtensible',
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function(obj) {
    if (obj && obj.isObject) {
      obj.preventExtensions = true;
    }
    return obj;
  };
  this.setProperty(ObjectConst, 'preventExtensions',
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  // Instance methods on Object.
  wrapper = function () {
    var c;
    if (this instanceof Interpreter.Object) {
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
  this.setNativeFunctionPrototype(ObjectConst, 'toString', wrapper);
  this.setNativeFunctionPrototype(ObjectConst, 'toLocaleString', wrapper);
  this.setNativeFunctionPrototype(ObjectConst, 'valueOf',
      Interpreter.Object.prototype.valueOf);

  wrapper = function(prop) {
    throwIfNullUndefined(this);
    if (!this.isObject) {
      return this.hasOwnProperty(prop);
    }
    return (prop + '') in this.properties;
  };
  this.setNativeFunctionPrototype(ObjectConst, 'hasOwnProperty', wrapper);

  wrapper = function(prop) {
    throwIfNullUndefined(this);
    return (prop + '') in this.properties && !this.notEnumerable.has(prop);
  };
  this.setNativeFunctionPrototype(ObjectConst, 'propertyIsEnumerable', wrapper);

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
  this.setNativeFunctionPrototype(ObjectConst, 'isPrototypeOf',  wrapper);
};

/**
 * Initialize the Array class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initArray = function(scope) {
  var thisInterpreter = this;
  var getInt = function(obj, def) {
    // Return an integer, or the default.
    var n = obj ? Math.floor(obj) : def;
    if (isNaN(n)) {
      n = def;
    }
    return n;
  };
  var wrapper;
  // Array constructor.
  wrapper = function(var_args) {
    if (thisInterpreter.calledWithNew()) {
      // Called as new Array().
      var newArray = this;
    } else {
      // Called as Array().
      var newArray = thisInterpreter.createArray();
    }
    var first = arguments[0];
    if (arguments.length === 1 && typeof first === 'number') {
      if (isNaN(thisInterpreter.legalArrayLength(first))) {
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
    return obj && obj.class === 'Array';
  };
  this.setProperty(ArrayConst, 'isArray',
                   this.createNativeFunction(wrapper, false),
                   Interpreter.NONENUMERABLE_DESCRIPTOR);

  // Instance methods on Array.
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
  this.setNativeFunctionPrototype(ArrayConst, 'pop', wrapper);

  wrapper = function(var_args) {
    for (var i = 0; i < arguments.length; i++) {
      this.properties[this.length] = arguments[i];
      this.length++;
    }
    return this.length;
  };
  this.setNativeFunctionPrototype(ArrayConst, 'push', wrapper);

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
  this.setNativeFunctionPrototype(ArrayConst, 'shift', wrapper);

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
  this.setNativeFunctionPrototype(ArrayConst, 'unshift', wrapper);

  wrapper = function() {
    for (var i = 0; i < this.length / 2; i++) {
      var tmp = this.properties[this.length - i - 1];
      this.properties[this.length - i - 1] = this.properties[i];
      this.properties[i] = tmp;
    }
    return this;
  };
  this.setNativeFunctionPrototype(ArrayConst, 'reverse', wrapper);

  wrapper = function(index, howmany /*, var_args*/) {
    index = getInt(index, 0);
    if (index < 0) {
      index = Math.max(this.length + index, 0);
    } else {
      index = Math.min(index, this.length);
    }
    howmany = getInt(howmany, Infinity);
    howmany = Math.min(howmany, this.length - index);
    var removed = thisInterpreter.createArray();
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
  this.setNativeFunctionPrototype(ArrayConst, 'splice', wrapper);

  wrapper = function(opt_begin, opt_end) {
    var list = thisInterpreter.createArray();
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
  this.setNativeFunctionPrototype(ArrayConst, 'slice', wrapper);

  wrapper = function(opt_separator) {
    var cycles = Interpreter.toStringCycles_;
    cycles.push(this);
    try {
      var text = [];
      for (var i = 0; i < this.length; i++) {
        text[i] = this.properties[i].toString();
      }
    } finally {
      cycles.pop();
    }
    return text.join(opt_separator);
  };
  this.setNativeFunctionPrototype(ArrayConst, 'join', wrapper);

  wrapper = function(var_args) {
    var list = thisInterpreter.createArray();
    var length = 0;
    // Start by copying the current array.
    for (var i = 0; i < this.length; i++) {
      var element = thisInterpreter.getProperty(this, i);
      thisInterpreter.setProperty(list, length++, element);
    }
    // Loop through all arguments and copy them in.
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (value && value.class === 'Array') {
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
  this.setNativeFunctionPrototype(ArrayConst, 'concat', wrapper);

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
  this.setNativeFunctionPrototype(ArrayConst, 'indexOf', wrapper);

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
  this.setNativeFunctionPrototype(ArrayConst, 'lastIndexOf', wrapper);
};

/**
 * Initialize the Number class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initNumber = function(scope) {
  var thisInterpreter = this;
  var wrapper;
  // Number prototype.
  this.NUMBER = this.createObject(this.OBJECT);
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

  var nativeParseFloat = this.createNativeFunction(Number.parseFloat, false);
  this.setProperty(NumberConst, 'parseFloat', nativeParseFloat);

  var nativeParseInt = this.createNativeFunction(Number.parseInt, false);
  this.setProperty(NumberConst, 'parseInt', nativeParseInt);

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
  this.setNativeFunctionPrototype(NumberConst, 'toExponential', wrapper);

  wrapper = function(digits) {
    try {
      return this.toFixed(digits);
    } catch (e) {
      // Throws if digits isn't within 0-20.
      thisInterpreter.throwException(thisInterpreter.RANGE_ERROR, e.message);
    }
  };
  this.setNativeFunctionPrototype(NumberConst, 'toFixed', wrapper);

  wrapper = function(precision) {
    try {
      return this.toPrecision(precision);
    } catch (e) {
      // Throws if precision isn't within range (depends on implementation).
      thisInterpreter.throwException(thisInterpreter.RANGE_ERROR, e.message);
    }
  };
  this.setNativeFunctionPrototype(NumberConst, 'toPrecision', wrapper);

  wrapper = function(radix) {
    try {
      return this.toString(radix);
    } catch (e) {
      // Throws if radix isn't within 2-36.
      thisInterpreter.throwException(thisInterpreter.RANGE_ERROR, e.message);
    }
  };
  this.setNativeFunctionPrototype(NumberConst, 'toString', wrapper);

  wrapper = function(/*locales, options*/) {
    // Messing around with arguments so that function's length is 0.
    var locales = arguments.length > 0 ?
        thisInterpreter.pseudoToNative(arguments[0]) : undefined;
    var options = arguments.length > 1 ?
        thisInterpreter.pseudoToNative(arguments[1]) : undefined;
    return this.toLocaleString(locales, options);
  };
  this.setNativeFunctionPrototype(NumberConst, 'toLocaleString', wrapper);
};

/**
 * Initialize the String class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initString = function(scope) {
  var thisInterpreter = this;
  var wrapper;
  // String prototype.
  this.STRING = this.createObject(this.OBJECT);
  this.STRING.class = 'String';
  // String constructor.
  var StringConst = this.createNativeFunction(String, this.STRING);
  StringConst.illegalConstructor = true;  // Don't allow 'new String(x)'.
  this.addVariableToScope(scope, 'String', StringConst);

  // Static methods on String.
  this.setProperty(StringConst, 'fromCharCode',
      this.createNativeFunction(String.fromCharCode, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  // Instance methods on String.
  // Methods with exclusively primitive arguments.
  var functions = ['trim', 'toLowerCase', 'toUpperCase',
      'toLocaleLowerCase', 'toLocaleUpperCase', 'charAt', 'charCodeAt',
      'substring', 'slice', 'substr', 'indexOf', 'lastIndexOf', 'concat'];
  for (var i = 0; i < functions.length; i++) {
    this.setNativeFunctionPrototype(StringConst, functions[i],
                                    String.prototype[functions[i]]);
  }

  wrapper = function(compareString /*, locales, options*/) {
    // Messing around with arguments so that function's length is 1.
    var locales = arguments.length > 1 ?
        thisInterpreter.pseudoToNative(arguments[1]) : undefined;
    var options = arguments.length > 2 ?
        thisInterpreter.pseudoToNative(arguments[2]) : undefined;
    return this.localeCompare(compareString, locales, options);
  };
  this.setNativeFunctionPrototype(StringConst, 'localeCompare', wrapper);

  wrapper = function(separator, limit) {
    if (separator && separator.class === 'RegExp') {
      separator = separator.data;
    }
    var jsList = this.split(separator, limit);
    return thisInterpreter.nativeToPseudo(jsList);
  };
  this.setNativeFunctionPrototype(StringConst, 'split', wrapper);

  wrapper = function(regexp) {
    regexp = regexp ? regexp.data : undefined;
    var match = this.match(regexp);
    if (!match) {
      return null;
    }
    return thisInterpreter.pseudoToNative(match);
  };
  this.setNativeFunctionPrototype(StringConst, 'match', wrapper);

  wrapper = function(regexp) {
    regexp = regexp ? regexp.data : undefined;
    return this.search(regexp);
  };
  this.setNativeFunctionPrototype(StringConst, 'search', wrapper);

  wrapper = function(substr, newSubStr) {
    // TODO: Rewrite as a polyfill to support function replacements.
    return this.replace(substr, newSubStr);
  };
  this.setNativeFunctionPrototype(StringConst, 'replace', wrapper);
};

/**
 * Initialize the Boolean class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initBoolean = function(scope) {
  var thisInterpreter = this;
  // Boolean prototype.
  this.BOOLEAN = this.createObject(this.OBJECT);
  this.BOOLEAN.class = 'Boolean';
  // Boolean constructor.
  var BooleanConst = this.createNativeFunction(Boolean, this.BOOLEAN);
  BooleanConst.illegalConstructor = true;  // Don't allow 'new Boolean(x)'.
  this.addVariableToScope(scope, 'Boolean', BooleanConst);
};

/**
 * Initialize the Date class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initDate = function(scope) {
  var thisInterpreter = this;
  var wrapper;
  // Date constructor.
  wrapper = function(value, var_args) {
    if (!thisInterpreter.calledWithNew()) {
      // Called as Date().
      // Calling Date() as a function returns a string, no arguments are heeded.
      return Date();
    }
    // Called as new Date().
    var args = [null].concat(Array.from(arguments));
    this.data = new (Function.prototype.bind.apply(Date, args));
    return this;
  };
  var DateProto = this.createNativeFunction(wrapper, true);
  this.addVariableToScope(scope, 'Date', DateProto);

  // Static methods on Date.
  this.setProperty(DateProto, 'now', this.createNativeFunction(Date.now, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  this.setProperty(DateProto, 'parse',
      this.createNativeFunction(Date.parse, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  this.setProperty(DateProto, 'UTC', this.createNativeFunction(Date.UTC, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  // Instance methods on Date.
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
        return this.data[nativeFunc].apply(this.data, arguments);
      };
    })(functions[i]);
    this.setNativeFunctionPrototype(DateProto, functions[i], wrapper);
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
        return this.data[nativeFunc].call(this.data, locales, options);
      };
    })(functions[i]);
    this.setNativeFunctionPrototype(DateProto, functions[i], wrapper);
  }
};

/**
 * Initialize Math object.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initMath = function(scope) {
  var thisInterpreter = this;
  var myMath = this.createObject(this.OBJECT);
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
    this.setProperty(myMath, numFunctions[i],
        this.createNativeFunction(Math[numFunctions[i]], false),
        Interpreter.NONENUMERABLE_DESCRIPTOR);
  }
};

/**
 * Initialize Regular Expression object.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initRegExp = function(scope) {
  var thisInterpreter = this;
  var wrapper;
  // RegExp constructor.
  wrapper = function(pattern, flags) {
    if (thisInterpreter.calledWithNew()) {
      // Called as new RegExp().
      var rgx = this;
    } else {
      // Called as RegExp().
      var rgx = thisInterpreter.createRegExp()
    }
    pattern = pattern ? pattern.toString() : '';
    flags = flags ? flags.toString() : '';
    thisInterpreter.populateRegExp(rgx, new RegExp(pattern, flags));
    return rgx;
  };
  var RegExpConst = this.createNativeFunction(wrapper, true);
  this.REGEXP = thisInterpreter.getProperty(RegExpConst, 'prototype');
  this.addVariableToScope(scope, 'RegExp', RegExpConst);

  this.setProperty(RegExpConst.properties['prototype'], 'global', undefined,
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(RegExpConst.properties['prototype'], 'ignoreCase', undefined,
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(RegExpConst.properties['prototype'], 'multiline', undefined,
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(RegExpConst.properties['prototype'], 'source', '(?:)',
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);

  wrapper = function(str) {
    return this.data.test(str);
  };
  this.setNativeFunctionPrototype(RegExpConst, 'test', wrapper);

  wrapper = function(str) {
    str = str.toString();
    // Get lastIndex from wrapped regex, since this is settable.
    this.data.lastIndex =
        Number(thisInterpreter.getProperty(this, 'lastIndex'));
    var match = this.data.exec(str);
    thisInterpreter.setProperty(this, 'lastIndex', this.data.lastIndex);

    if (match) {
      var result = thisInterpreter.createArray();
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
  this.setNativeFunctionPrototype(RegExpConst, 'exec', wrapper);
};

/**
 * Initialize JSON object.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initJSON = function(scope) {
  var thisInterpreter = this;
  var myJSON = thisInterpreter.createObject(this.OBJECT);
  this.addVariableToScope(scope, 'JSON', myJSON);

  var wrapper = function(text) {
    try {
      var nativeObj = JSON.parse(text.toString());
    } catch (e) {
      thisInterpreter.throwException(thisInterpreter.SYNTAX_ERROR, e.message);
    }
    return thisInterpreter.nativeToPseudo(nativeObj);
  };
  this.setProperty(myJSON, 'parse', this.createNativeFunction(wrapper, false));

  wrapper = function(value) {
    var nativeObj = thisInterpreter.pseudoToNative(value);
    try {
      var str = JSON.stringify(nativeObj);
    } catch (e) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR, e.message);
    }
    return str;
  };
  this.setProperty(myJSON, 'stringify',
      this.createNativeFunction(wrapper, false));
};

/**
 * Initialize the Error class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initError = function(scope) {
  var thisInterpreter = this;
  // Error prototype:
  this.ERROR = this.createError(this.OBJECT);
  // Error constructor.
  var ErrorConst = this.createNativeFunction(function(opt_message) {
    if (thisInterpreter.calledWithNew()) {
      // Called as new Error().
      var newError = this;
    } else {
      // Called as Error().
      var newError = thisInterpreter.createError();
    }
    if (opt_message) {
      thisInterpreter.setProperty(newError, 'message', opt_message + '',
          Interpreter.NONENUMERABLE_DESCRIPTOR);
    }
    return newError;
  }, this.ERROR);
  this.addVariableToScope(scope, 'Error', ErrorConst);
  
  this.setProperty(this.ERROR, 'message', '',
      Interpreter.NONENUMERABLE_DESCRIPTOR);
  this.setProperty(this.ERROR, 'name', 'Error',
      Interpreter.NONENUMERABLE_DESCRIPTOR);

  var createErrorSubclass = function(name) {
    var prototype = thisInterpreter.createError();
    thisInterpreter.setProperty(prototype, 'name', name,
        Interpreter.NONENUMERABLE_DESCRIPTOR);
    var constructor = thisInterpreter.createNativeFunction(
        function(opt_message) {
          if (thisInterpreter.calledWithNew()) {
            // Called as new XyzError().
            var newError = this;
          } else {
            // Called as XyzError().
            var newError = thisInterpreter.createError(prototype);
          }
          if (opt_message) {
            thisInterpreter.setProperty(newError, 'message', opt_message + '',
                Interpreter.NONENUMERABLE_DESCRIPTOR);
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
 * Is an object of a certain class?
 * @param {*} child Object to check.
 * @param {Interpreter.Object} constructor Constructor of object.
 * @return {boolean} True if object is the class or inherits from it.
 *     False otherwise.
 */
Interpreter.prototype.isa = function(child, constructor) {
  if (child === null || child === undefined || !constructor) {
    return false;
  }
  var proto = constructor.properties['prototype'];
  if (child === proto) {
    return true;
  }
  // The first step up the prototype chain is harder since the child might be
  // a primitive value.  Subsequent steps can just follow the .proto property.
  child = this.getPrototype(child);
  while (child) {
    if (child === proto) {
      return true;
    }
    child = child.proto;
  }
  return false;
};

/**
 * Compares two objects against each other.
 * @param {*} a First object.
 * @param {*} b Second object.
 * @return {number} -1 if a is smaller, 0 if a === b, 1 if a is bigger,
 *     NaN if they are not comparable.
 */
Interpreter.prototype.comp = function(a, b) {
  if (typeof a === 'number' && isNaN(a) ||
      typeof b === 'number' && isNaN(b)) {
    // NaN is not comparable to anything, including itself.
    return NaN;
  }
  if (a === b) {
    return 0;
  }
  var aValue = a && a.isObject ? a.toString() : a;
  var bValue = b && b.isObject ? b.toString() : b;
  if (aValue < bValue) {
    return -1;
  } else if (aValue > bValue) {
    return 1;
  } else if (a && b && a.isObject && b.isObject) {
    // Two objects that have equal values are still not equal.
    // e.g. [1, 2] !== [1, 2]
    return NaN;
  } else if (aValue == bValue) {
    return 0;
  }
  return NaN;
};

/**
 * Is a value a legal integer for an array length?
 * @param {*} n Value to check.
 * @return {number} Zero, or a positive integer if the value can be
 *     converted to such.  NaN otherwise.
 */
Interpreter.prototype.legalArrayLength = function(n) {
  n = Number(n);
  // Array length must be between 0 and 2^32-1 (inclusive).
  return (n === n >>> 0) ? n : NaN;
};

/**
 * Is a value a legal integer for an array index?
 * @param {*} n Value to check.
 * @return {number} Zero, or a positive integer if the value can be
 *     converted to such.  NaN otherwise.
 */
Interpreter.prototype.legalArrayIndex = function(n) {
  n = Number(n);
  // Array index cannot be 2^32-1, otherwise length would be 2^32.
  // 0xffffffff is 2^32-1.
  return (n === n >>> 0 && n !== 0xffffffff) ? n : NaN;
};

/**
 * Class for a scope.
 * @param {Interpreter.Scope} parentScope Inherited scope.
 * @constructor
 */
Interpreter.Scope = function(parentScope) {
  this.notWritable = new Set();
  this.properties = Object.create(null);
  this.parentScope = parentScope;
};

/**
 * Class for an object.
 * @param {Interpreter.Object} proto Prototype object or null.
 * @constructor
 */
Interpreter.Object = function(proto) {
  this.notConfigurable = new Set();
  this.notEnumerable = new Set();
  this.notWritable = new Set();
  this.properties = Object.create(null);
  this.proto = proto;
};

/**
 * @type {Interpreter.Object}
 */
Interpreter.Object.prototype.proto = null;

/**
 * @type {boolean}
 */
Interpreter.Object.prototype.isObject = true;

/**
 * @type {string}
 */
Interpreter.Object.prototype.class = 'Object';

/**
 * May include Set, Map, and Array in the future.
 * @type {RegExp|Date}
 */
Interpreter.Object.prototype.data = null;

/**
 * Convert this object into a string.
 * @return {string} String value.
 * @override
 */
Interpreter.Object.prototype.toString = function() {
  // TODO(cpcallen): this funciton should not exist in its present
  // form.  Each of the different classes (Object, Function, Array)
  // should have their own toString implementation as described in the
  // spec.
  if (this.class === 'Array') {
    // Array
    var cycles = Interpreter.toStringCycles_;
    cycles.push(this);
    try {
      var strs = [];
      for (var i = 0; i < this.length; i++) {
        var value = this.properties[i];
        strs[i] = (value && value.isObject && cycles.indexOf(value) !== -1) ?
            '...' : value;
      }
    } finally {
      cycles.pop();
    }
    return strs.join(',');
  }
  if (this.class === 'Error') {
    var cycles = Interpreter.toStringCycles_;
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
      name = name && name.toString();
      message = message && message.toString();
    } finally {
      cycles.pop();
    }
    return message ? name + ': ' + message : name + '';
  }
  if (this.class === 'Function') {
    // TODO: Return the source code.
    return '[object Function]';
  }

  // RegExp, Date.
  if (this.data !== null) {
    return String(this.data);
  }

  return '[object ' + this.class + ']';
};

/**
 * Return the object value.
 * @return {*} Value.
 * @override
 */
Interpreter.Object.prototype.valueOf = function() {
  return this.data === undefined || this.data === null ? this : this.data;
};

/**
 * Create a new data object.
 * @param {Interpreter.Object} proto Prototype object.
 * @return {!Interpreter.Object} New data object.
 */
Interpreter.prototype.createObject = function(proto) {
  var obj = new Interpreter.Object(proto);
  return obj;
};

/**
 * Create a new function object.
 * @param {Interpreter.Object=} proto Prototype object (or null);
 *     defaults to this.FUNCTION.
 * @return {!Interpreter.Object} New data object.
 */
Interpreter.prototype.createFunction = function(proto) {
  var p = (proto === undefined ? this.FUNCTION : proto);
  var obj = this.createObject(p);
  obj.class = 'Function';
  return obj;
};

/**
 * Add a prototype property to a function object, setting
 * func.prototype to prototype and prototype.constructor to func.  (If
 * prototype is not specified, a newly-created object will be used
 * instead.)
 * @param {!Interpreter.Object} func Function to be modified.
 * @param {Interpreter.Object=} prototype Prototype to add to it.
 */
Interpreter.prototype.addFunctionPrototype = function(func, prototype) {
  if (func.class !== 'Function') {
    // TODO(cpcallen): instanceof check once we have a function class:
    throw TypeError("Expected func.class === 'Function'");
  } else if (func.illegalConstructor) {
    throw TypeError('func claims not to be a constructor!');
  }
  var protoObj = prototype || this.createObject(this.OBJECT);
  this.setProperty(func, 'prototype', protoObj,
      Interpreter.NONENUMERABLE_NONCONFIGURABLE_DESCRIPTOR);
  this.setProperty(protoObj, 'constructor', func,
      Interpreter.NONENUMERABLE_DESCRIPTOR);
};

/**
 * Create a new array object.  See §15.4 of the ES5.1 spec.
 * @param {Interpreter.Object=} proto Prototype object (or null);
 *     defaults to this.ARRAY
 * @return {!Interpreter.Object} New array object.
 */
Interpreter.prototype.createArray = function(proto) {
  var p = (proto === undefined ? this.ARRAY : proto);
  var obj = this.createObject(p);
  obj.class = 'Array';
  obj.length = 0;
  return obj;
};

/**
 * Create a new regexp object.
 * @param {Interpreter.Object=} proto Prototype object (or null);
 *     defaults to this.REGEXP
 * @return {!Interpreter.Object} New data object.
 */
Interpreter.prototype.createRegExp = function(proto) {
  var p = (proto === undefined ? this.REGEXP : proto);
  var obj = this.createObject(p);
  obj.class = 'RegExp';
  return obj;
};

/**
 * Create a new error object.  See §15.11 of the ES5.1 spec.
 * @param {Interpreter.Object=} proto Prototype object (or null);
 *     defaults to this.ERROR
 * @return {!Interpreter.Object} New array object.
 */
Interpreter.prototype.createError = function(proto) {
  var p = (proto === undefined ? this.ERROR : proto);
  var obj = this.createObject(p);
  obj.class = 'Error';
  return obj;
};

/**
 * Initialize a pseudo regular expression object based on a native regular
 * expression object.
 * @param {!Interpreter.Object} pseudoRegexp The existing object to set.
 * @param {!RegExp} nativeRegexp The native regular expression.
 */
Interpreter.prototype.populateRegExp = function(pseudoRegexp, nativeRegexp) {
  pseudoRegexp.data = nativeRegexp;
  // lastIndex is settable, all others are read-only attributes
  this.setProperty(pseudoRegexp, 'lastIndex', nativeRegexp.lastIndex,
      Interpreter.NONENUMERABLE_DESCRIPTOR);
  this.setProperty(pseudoRegexp, 'source', nativeRegexp.source,
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(pseudoRegexp, 'global', nativeRegexp.global,
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(pseudoRegexp, 'ignoreCase', nativeRegexp.ignoreCase,
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(pseudoRegexp, 'multiline', nativeRegexp.multiline,
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
};

/**
 * Create a new function.
 * @param {!Object} node AST node defining the function.
 * @param {!Object} scope Parent scope.
 * @return {!Interpreter.Object} New function.
 */
Interpreter.prototype.createFunctionFromAST = function(node, scope) {
  var func = this.createFunction();
  this.addFunctionPrototype(func);
  func.parentScope = scope;
  func.node = node;
  this.setProperty(func, 'length', func.node['params'].length,
      Interpreter.READONLY_DESCRIPTOR);
  return func;
};

/**
 * Create a new native function.
 * @param {!Function} nativeFunc JavaScript function.
 * @param {!Interpreter.Object|boolean=} prototype If an object is
 *     supplied, that object will be added as the function's
 *     .prototype property (with the object receivieng a corresponding
 *     .constructor properyt).  If true, a new ordinary
 *     Interpreter.Object will be created for the purpose.  If false
 *     (or unspecified) the function cannot be used as a constructor
 *     (e.g. escape).
 * @return {!Interpreter.Object} New function.
 */
Interpreter.prototype.createNativeFunction = function(nativeFunc, prototype) {
  var func = this.createFunction();
  func.nativeFunc = nativeFunc;
  nativeFunc.id = this.functionCounter_++;
  this.setProperty(func, 'length', nativeFunc.length,
      Interpreter.READONLY_DESCRIPTOR);
  if (prototype === true) {
    this.addFunctionPrototype(func);
  } else if (prototype) {
    this.addFunctionPrototype(func, prototype);
  } else {
    func.illegalConstructor = true;
  }
  return func;
};

/**
 * Create a new native asynchronous function.
 * @param {!Function} asyncFunc JavaScript function.
 * @return {!Interpreter.Object} New function.
 */
Interpreter.prototype.createAsyncFunction = function(asyncFunc) {
  var func = this.createFunction();
  this.addFunctionPrototype(func); // TODO(cpcallen): is this necessary?
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
 * @return {*} The equivalent JS interpreter object.
 */
Interpreter.prototype.nativeToPseudo = function(nativeObj) {
  if (typeof nativeObj === 'boolean' ||
      typeof nativeObj === 'number' ||
      typeof nativeObj === 'string' ||
      nativeObj === null || nativeObj === undefined) {
    return nativeObj;
  }

  if (nativeObj instanceof RegExp) {
    var pseudoRegexp = this.createRegExp();
    this.populateRegExp(pseudoRegexp, nativeObj);
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
    pseudoObj = this.createArray();
    for (var i = 0; i < nativeObj.length; i++) {
      this.setProperty(pseudoObj, i, this.nativeToPseudo(nativeObj[i]));
    }
  } else {  // Object.
    pseudoObj = this.createObject(this.OBJECT);
    for (var key in nativeObj) {
      this.setProperty(pseudoObj, key, this.nativeToPseudo(nativeObj[key]));
    }
  }
  return pseudoObj;
};

/**
 * Converts from a JS interpreter object to native JS object.
 * Can handle JSON-style values, plus cycles.
 * @param {*} pseudoObj The JS interpreter object to be converted.
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

  if (pseudoObj.class === 'RegExp') {  // Regular expression.
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
  if (pseudoObj.class === 'Array') {  // Array.
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
 * @param {*} value Data object.
 * @return {Interpreter.Object} Prototype object, null if none.
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
 * @param {*} obj Data object.
 * @param {*} name Name of property.
 * @return {*} Property value (may be undefined).
 */
Interpreter.prototype.getProperty = function(obj, name) {
  name += '';
  if (obj === undefined || obj === null) {
    this.throwException(this.TYPE_ERROR,
                        "Cannot read property '" + name + "' of " + obj);
  }
  if (name === 'length') {
    // Special cases for magic length property.
    if (typeof obj === 'string') {
      return obj.length;
    } else if (obj.class === 'Array') {
      return obj.length;
    }
  } else if (name.charCodeAt(0) < 0x40) {
    // Might have numbers in there?
    // Special cases for string array indexing
    if (typeof obj === 'string') {
      var n = this.legalArrayIndex(name);
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
 * @param {*} obj Data object.
 * @param {*} name Name of property.
 * @return {boolean=} True if property exists, undefined if primitive.
 */
Interpreter.prototype.hasProperty = function(obj, name) {
  if (!obj.isObject) {
    return undefined;
  }
  name += '';
  if (name === 'length' && obj.class === 'Array') {
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
 * @param {!Interpreter.Object} obj Data object.
 * @param {*} name Name of property.
 * @param {*} value New property value.
 * @param {Object=} opt_descriptor Optional descriptor object.
 */
Interpreter.prototype.setProperty = function(obj, name, value, opt_descriptor) {
  name += '';
  if (opt_descriptor && obj.notConfigurable.has(name)) {
    this.throwException(this.TYPE_ERROR, 'Cannot redefine property: ' + name);
  }
  if (!obj || !obj.isObject) {
    this.throwException(this.TYPE_ERROR, "Can't create property '" + name +
                        "' on '" + obj + "'");
  }
  if (obj.class === 'Array') {
    // Arrays have a magic length variable that is bound to the elements.
    var i;
    if (name === 'length') {
      // Delete elements if length is smaller.
      var newLength = this.legalArrayLength(value);
      if (isNaN(newLength)) {
        this.throwException(this.RANGE_ERROR, 'Invalid array length');
      }
      if (newLength < obj.length) {
        for (i in obj.properties) {
          i = this.legalArrayIndex(i);
          if (!isNaN(i) && newLength <= i) {
            delete obj.properties[i];
          }
        }
      }
      obj.length = newLength;
      return;  // Don't set a real length property.
    } else if (!isNaN(i = this.legalArrayIndex(name))) {
      // Increase length if this index is larger.
      obj.length = Math.max(obj.length, i + 1);
    }
  }
  if (!obj.properties[name] && obj.preventExtensions) {
    this.throwException(this.TYPE_ERROR, "Can't add property '" + name +
                        "', object is not extensible");
  }
  if (opt_descriptor) {
    // Define the property.
    obj.properties[name] = value;
    if (!opt_descriptor.configurable) {
      obj.notConfigurable.add(name);
    }
    var enumerable = opt_descriptor.enumerable || false;
    if (enumerable) {
      obj.notEnumerable.delete(name);
    } else {
      obj.notEnumerable.add(name);
    }
    var writable = opt_descriptor.writable || false;
    if (writable) {
      obj.notWritable.delete(name);
    } else {
      obj.notWritable.add(name);
    }
  } else if (obj.notWritable.has(name)) {
    this.throwException(this.TYPE_ERROR, "Cannot assign to read only " +
        "property '" + name + "' of object '" + obj + "'");
  } else {
    obj.properties[name] = value;
  }
};

/**
 * Delete a property value on a data object.
 * @param {!Interpreter.Object} obj Data object.
 * @param {*} name Name of property.
 * @return {boolean} True if deleted, false if undeletable.
 */
Interpreter.prototype.deleteProperty = function(obj, name) {
  name += '';
  if (!obj || !obj.isObject || obj.notWritable.has(name)) {
    return false;
  }
  if (name === 'length' && obj.class === 'Array') {
    return false;
  }
  return delete obj.properties[name];
};

/**
 * Convenience method for adding a native function as a non-enumerable property
 * onto an object's prototype.
 * @param {!Interpreter.Object} obj Data object.
 * @param {*} name Name of property.
 * @param {!Function} wrapper Function object.
 */
Interpreter.prototype.setNativeFunctionPrototype =
    function(obj, name, wrapper) {
  this.setProperty(obj.properties['prototype'], name,
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);
};

/**
 * Returns the current scope from the stateStack.
 * @return {!Interpreter.Scope} Current scope dictionary.
 */
Interpreter.prototype.getScope = function() {
  for (var i = this.stateStack.length - 1; i >= 0; i--) {
    if (this.stateStack[i].scope) {
      return this.stateStack[i].scope;
    }
  }
  throw Error('No scope found.');
};

/**
 * Create a new scope dictionary.
 * @param {!Object} node AST node defining the scope container
 *     (e.g. a function).
 * @param {Interpreter.Scope} parentScope Scope to link to.
 * @return {!Interpreter.Scope} New scope.
 */
Interpreter.prototype.createScope = function(node, parentScope) {
  var scope = new Interpreter.Scope(parentScope);
  if (!parentScope) {
    this.initGlobalScope(scope);
  }
  this.populateScope_(node, scope);
  return scope;
};

/**
 * Retrieves a value from the scope chain.
 * @param {*} name Name of variable.
 * @return {*} Value (may be undefined).
 */
Interpreter.prototype.getValueFromScope = function(name) {
  var scope = this.getScope();
  name += '';
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
 * @param {*} name Name of variable.
 * @param {*} value Value.
 */
Interpreter.prototype.setValueToScope = function(name, value) {
  var scope = this.getScope();
  name += '';
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
 * @param {*} name Name of variable.
 * @param {*} value Initial value.
 * @param {boolean=} opt_notWritable True if constant.  Defaults to false.
 */
Interpreter.prototype.addVariableToScope =
    function(scope, name, value, opt_notWritable) {
  name += '';
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
 * @param {!Interpreter.Object} scope Scope dictionary to populate.
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
Interpreter.prototype.stripLocations_ = function(node, start, end) {
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
        this.stripLocations_(prop, start, end);
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
 * @param {!Array} left Name of variable or object/propname tuple.
 * @return {*} Value (may be undefined).
 */
Interpreter.prototype.getValue = function(left) {
  if (left[0]) {
    // An obj/prop components tuple (foo.bar).
    return this.getProperty(left[0], left[1]);
  } else {
    // A null/varname variable lookup.
    return this.getValueFromScope(left[1]);
  }
};

/**
 * Sets a value to the scope chain or to an object property.
 * @param {!Array} left Name of variable or object/propname tuple.
 * @param {*} value Value.
 */
Interpreter.prototype.setValue = function(left, value) {
  if (left[0]) {
    // An obj/prop components tuple (foo.bar).
    this.setProperty(left[0], left[1], value);
  } else {
    // A null/varname variable lookup.
    this.setValueToScope(left[1], value);
  }
};

/**
 * Throw an exception in the interpreter that can be handled by a
 * interpreter try/catch statement.  If unhandled, a real exception will
 * be thrown.  Can be called with either an error class and a message, or
 * with an actual object to be thrown.
 * @param {*} value Value to be thrown.  If message is provided a new
 *     error object is created using value as the prototype; if not it
 *     is used directly.
 * @param {string=} opt_message Message being thrown.
 */
Interpreter.prototype.throwException = function(value, opt_message) {
  var error
  if (opt_message === undefined) {
    error = value;  // This is a value to throw, not an error proto.
  } else {
    error = this.createError(value);
    this.setProperty(error, 'message', opt_message,
        Interpreter.NONENUMERABLE_DESCRIPTOR);
  }
  this.executeException(error);
  // Abort anything related to the current step.
  throw Interpreter.STEP_ERROR;
};

/**
 * Throw an exception in the interpreter that can be handled by a
 * interpreter try/catch statement.  If unhandled, a real exception will
 * be thrown.
 * @param {!Interpreter.Object} error Error object to execute.
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
  if (error.class === 'Error') {
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


///////////////////////////////////////////////////////////////////////////////
// Functions to handle each node type.
///////////////////////////////////////////////////////////////////////////////

Interpreter.prototype['stepArrayExpression'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var elements = state.node['elements'];
  var n = state.n_ || 0;
  if (!state.array_) {
    state.array_ = this.createArray();
  } else if (state.value) {
    this.setProperty(state.array_, n - 1, state.value);
  }
  if (n < elements.length) {
    state.n_ = n + 1;
    if (elements[n]) {
      stack.push({node: elements[n]});
    } else {
      // [0, 1, , 3][2] -> undefined
      // Missing elements are not defined, they aren't undefined.
      state.value = undefined;
    }
  } else {
    state.array_.length = state.n_ || 0;
    stack.pop();
    stack[stack.length - 1].value = state.array_;
  }
};

Interpreter.prototype['stepAssignmentExpression'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    stack.push({node: node['left'], components: true});
    return;
  }
  if (!state.doneRight_) {
    if (!state.leftSide_) {
      state.leftSide_ = state.value;
    }
    if (node['operator'] !== '=') {
      state.leftValue_ = this.getValue(state.leftSide_);
    }
    state.doneRight_ = true;
    stack.push({node: node['right']});
    return;
  }
  var rightSide = state.value;
  var value;
  if (node['operator'] === '=') {
    value = rightSide;
  } else {
    var rightValue = rightSide;
    var leftNumber = state.leftValue_ - 0;
    var rightNumber = rightValue - 0;
    if (node['operator'] === '+=') {
      var left, right;
      if (typeof state.leftValue_ === 'string' ||
          typeof rightValue === 'string') {
        left = state.leftValue_ + '';
        right = rightValue + '';
      } else {
        left = leftNumber;
        right = rightNumber;
      }
      value = left + right;
    } else if (node['operator'] === '-=') {
      value = leftNumber - rightNumber;
    } else if (node['operator'] === '*=') {
      value = leftNumber * rightNumber;
    } else if (node['operator'] === '/=') {
      value = leftNumber / rightNumber;
    } else if (node['operator'] === '%=') {
      value = leftNumber % rightNumber;
    } else if (node['operator'] === '<<=') {
      value = leftNumber << rightNumber;
    } else if (node['operator'] === '>>=') {
      value = leftNumber >> rightNumber;
    } else if (node['operator'] === '>>>=') {
      value = leftNumber >>> rightNumber;
    } else if (node['operator'] === '&=') {
      value = leftNumber & rightNumber;
    } else if (node['operator'] === '^=') {
      value = leftNumber ^ rightNumber;
    } else if (node['operator'] === '|=') {
      value = leftNumber | rightNumber;
    } else {
      throw SyntaxError('Unknown assignment expression: ' + node['operator']);
    }
  }
  this.setValue(state.leftSide_, value);
  stack.pop();
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepBinaryExpression'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    stack.push({node: node['left']});
    return;
  }
  if (!state.doneRight_) {
    state.doneRight_ = true;
    state.leftValue_ = state.value;
    stack.push({node: node['right']});
    return;
  }
  stack.pop();
  var leftSide = state.leftValue_;
  var rightSide = state.value;
  var value;
  if (node['operator'] === '==' || node['operator'] === '!=') {
    if ((!leftSide || !leftSide.isObject) &&
        (!rightSide || !rightSide.isObject)) {
      // At least one side is a primitive.
      value = leftSide == rightSide;
    } else {
      value = this.comp(leftSide, rightSide) === 0;
    }
    if (node['operator'] === '!=') {
      value = !value;
    }
  } else if (node['operator'] === '===' || node['operator'] === '!==') {
    value = leftSide === rightSide;
    if (node['operator'] === '!==') {
      value = !value;
    }
  } else if (node['operator'] === '>') {
    value = this.comp(leftSide, rightSide) === 1;
  } else if (node['operator'] === '>=') {
    var comp = this.comp(leftSide, rightSide);
    value = comp === 1 || comp === 0;
  } else if (node['operator'] === '<') {
    value = this.comp(leftSide, rightSide) === -1;
  } else if (node['operator'] === '<=') {
    var comp = this.comp(leftSide, rightSide);
    value = comp === -1 || comp === 0;
  } else if (node['operator'] === '+') {
    var leftValue = leftSide.isObject ? leftSide + '' : leftSide;
    var rightValue = rightSide.isObject ? rightSide + '' : rightSide;
    value = leftValue + rightValue;
  } else if (node['operator'] === 'in') {
    if (!rightSide || !rightSide.isObject) {
      this.throwException(this.TYPE_ERROR,
          "'in' expects an object, not '" + rightSide + "'");
    }
    value = this.hasProperty(rightSide, leftSide);
  } else if (node['operator'] === 'instanceof') {
    // TODO(cpcallen): rewrite this as rightSide instanceof
    // Interpreter.Function once such a class exists.
    if (!rightSide || !rightSide.class === 'function') {
      this.throwException(this.TYPE_ERROR,
          'Right-hand side of instanceof is not an object');
    }
    value = leftSide.isObject ? this.isa(leftSide, rightSide) : false;
  } else {
    var leftValue = Number(leftSide);
    var rightValue = Number(rightSide);
    if (node['operator'] === '-') {
      value = leftValue - rightValue;
    } else if (node['operator'] === '*') {
      value = leftValue * rightValue;
    } else if (node['operator'] === '/') {
      value = leftValue / rightValue;
    } else if (node['operator'] === '%') {
      value = leftValue % rightValue;
    } else if (node['operator'] === '&') {
      value = leftValue & rightValue;
    } else if (node['operator'] === '|') {
      value = leftValue | rightValue;
    } else if (node['operator'] === '^') {
      value = leftValue ^ rightValue;
    } else if (node['operator'] === '<<') {
      value = leftValue << rightValue;
    } else if (node['operator'] === '>>') {
      value = leftValue >> rightValue;
    } else if (node['operator'] === '>>>') {
      value = leftValue >>> rightValue;
    } else {
      throw SyntaxError('Unknown binary operator: ' + node['operator']);
    }
  }
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepBlockStatement'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var n = state.n_ || 0;
  var expression = state.node['body'][n];
  if (expression) {
    state.n_ = n + 1;
    stack.push({node: expression});
  } else {
    stack.pop();
  }
};

Interpreter.prototype['stepBreakStatement'] = function() {
  var stack = this.stateStack;
  var state = stack.pop();
  var label = null;
  if (state.node['label']) {
    label = state.node['label']['name'];
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

Interpreter.prototype['stepCallExpression'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
  if (!state.doneCallee_) {
    state.doneCallee_ = 1;
    // Components needed to determine value of 'this'.
    stack.push({node: node['callee'], components: true});
    return;
  }
  if (state.doneCallee_ === 1) {
    // Determine value of the function.
    state.doneCallee_ = 2;
    var func = state.value;
    if (Array.isArray(func)) {
      state.func_ = this.getValue(func);
      state.components_ = func;
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
      stack.push({node: node['arguments'][state.n_]});
      state.n_++;
      return;
    }
    // Determine value of 'this' in function.
    if (state.node['type'] === 'NewExpression') {
      var func = state.func_;
      if (!func || !func.isObject) {
        this.throwException(this.TYPE_ERROR, func + ' is not a function');
      } else if (func.illegalConstructor) {
        // Illegal: new escape();
        this.throwException(this.TYPE_ERROR, func + ' is not a constructor');
      }
      // Constructor, 'this' is new object.
      state.funcThis_ = this.createObject(this.getProperty(func, 'prototype'));
      state.isConstructor = true;
    } else if (state.components_) {
      // Method function, 'this' is object.
      state.funcThis_ = state.components_[0];
    } else {
      // Global function, 'this' is undefined.
      state.funcThis_ = undefined;
    }
    state.doneArgs_ = true;
  }
  if (!state.doneExec_) {
    state.doneExec_ = true;
    var func = state.func_;
    // TODO(fraser): determine if this check is redundant; remove it or add
    // tests that depend on it.
    if (!func || !func.isObject) {
      this.throwException(this.TYPE_ERROR, func + ' is not a function');
    }
    var funcNode = func.node;
    if (funcNode) {
      var scope = this.createScope(funcNode['body'], func.parentScope);
      // Add all arguments.
      for (var i = 0; i < funcNode['params'].length; i++) {
        var paramName = funcNode['params'][i]['name'];
        var paramValue = state.arguments_.length > i ? state.arguments_[i] :
            undefined;
        this.addVariableToScope(scope, paramName, paramValue);
      }
      // Build arguments variable.
      var argsList = this.createArray();
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
      var funcState = {
        node: funcNode['body'],
        scope: scope
      };
      stack.push(funcState);
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
      if (!code) {  // eval()
        state.value = undefined;
      } else {
        var ast = acorn.parse(String(code), Interpreter.PARSE_OPTIONS);
        state = {
          node: {type: 'EvalProgram_', body: ast['body']}
        };
        this.stripLocations_(state.node, node['start'], node['end']);
        // Update current scope with definitions in eval().
        var scope = this.getScope();
        this.populateScope_(ast, scope);
        stack.push(state);
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

Interpreter.prototype['stepCatchClause'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
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
    stack.push({node: node['body'], scope: scope});
  } else {
    stack.pop();
  }
};

Interpreter.prototype['stepConditionalExpression'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var mode = state.mode_ || 0;
  if (mode === 0) {
    state.mode_ = 1;
    stack.push({node: state.node['test']});
    return;
  }
  if (mode === 1) {
    state.mode_ = 2;
    var value = Boolean(state.value);
    if (value && state.node['consequent']) {
      stack.push({node: state.node['consequent']});
      return;  // Execute 'if' block.
    } else if (!value && state.node['alternate']) {
      stack.push({node: state.node['alternate']});
      return;  // Execute 'else' block.
    }
    // eval('1;if(false){2}') -> undefined
    this.value = undefined;
  }
  stack.pop();
  if (state.node['type'] === 'ConditionalExpression') {
    stack[stack.length - 1].value = state.value;
  }
};

Interpreter.prototype['stepContinueStatement'] = function() {
  var stack = this.stateStack;
  var state = stack.pop();
  var label = null;
  if (state.node['label']) {
    label = state.node['label']['name'];
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

Interpreter.prototype['stepDebuggerStatement'] = function() {
  // Do nothing.  May be overridden by developers.
  this.stateStack.pop();
};

Interpreter.prototype['stepDoWhileStatement'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  if (state.node['type'] === 'DoWhileStatement' && state.test_ === undefined) {
    // First iteration of do/while executes without checking test.
    state.value = true;
    state.test_ = true;
  }
  if (!state.test_) {
    state.test_ = true;
    stack.push({node: state.node['test']});
  } else {
    if (!state.value) {  // Done, exit loop.
      stack.pop();
    } else if (state.node['body']) {  // Execute the body.
      state.test_ = false;
      state.isLoop = true;
      stack.push({node: state.node['body']});
    }
  }
};

Interpreter.prototype['stepEmptyStatement'] = function() {
  this.stateStack.pop();
};

Interpreter.prototype['stepEvalProgram_'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var n = state.n_ || 0;
  var expression = state.node['body'][n];
  if (expression) {
    state.n_ = n + 1;
    stack.push({node: expression});
  } else {
    stack.pop();
    stack[stack.length - 1].value = this.value;
  }
};

Interpreter.prototype['stepExpressionStatement'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  if (!state.done_) {
    state.done_ = true;
    stack.push({node: state.node['expression']});
  } else {
    stack.pop();
    // Save this value to interpreter.value for use as a return value if
    // this code is inside an eval function.
    this.value = state.value;
  }
};

Interpreter.prototype['stepForInStatement'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
  // First, variable initialization is illegal in strict mode.
  if (!state.doneInit_) {
    state.doneInit_ = true;
    if (node['left']['declarations'] &&
        node['left']['declarations'][0]['init']) {
      this.throwException(this.SYNTAX_ERROR,
          'for-in loop variable declaration may not have an initializer.');
      return;
    }
  }
  // Second, look up the object.  Only do so once, ever.
  if (!state.doneObject_) {
    state.doneObject_ = true;
    if (!state.variable_) {
      state.variable_ = state.value;
    }
    stack.push({node: node['right']});
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
      if (state.object_ && state.object_.isObject) {
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
      state.variable_ = [null, left['declarations'][0]['id']['name']];
    } else {
      // Arbitrary left side: for (foo().bar in y)
      state.variable_ = null;
      stack.push({node: left, components: true});
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
    stack.push({node: node['body']});
  }
  // Reset back to step three.
  state.name_ = undefined;
  if (Array.isArray(state.variable_)) {
    state.doneVariable_ = false;
  }
};

Interpreter.prototype['stepForStatement'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
  var mode = state.mode_ || 0;
  if (mode === 0) {
    state.mode_ = 1;
    if (node['init']) {
      stack.push({node: node['init']});
    }
  } else if (mode === 1) {
    state.mode_ = 2;
    if (node['test']) {
      stack.push({node: node['test']});
    }
  } else if (mode === 2) {
    state.mode_ = 3;
    if (node['test'] && !state.value) {
      // Done, exit loop.
      stack.pop();
    } else if (node['body']) { // Execute the body.
      state.isLoop = true;
      stack.push({node: node['body']});
    }
  } else if (mode === 3) {
    state.mode_ = 1;
    if (node['update']) {
      stack.push({node: node['update']});
    }
  }
};

Interpreter.prototype['stepFunctionDeclaration'] = function() {
  // This was found and handled when the scope was populated.
  this.stateStack.pop();
};

Interpreter.prototype['stepFunctionExpression'] = function() {
  var stack = this.stateStack;
  var state = stack.pop();
  stack[stack.length - 1].value =
      this.createFunctionFromAST(state.node, this.getScope());
};

Interpreter.prototype['stepIdentifier'] = function() {
  var stack = this.stateStack;
  var state = stack.pop();
  var name = state.node['name'];
  var value = state.components ? [null, name] : this.getValueFromScope(name);
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepIfStatement'] =
    Interpreter.prototype['stepConditionalExpression'];

Interpreter.prototype['stepLabeledStatement'] = function() {
  var stack = this.stateStack;
  // No need to hit this node again on the way back up the stack.
  var state = stack.pop();
  // Note that a statement might have multiple labels.
  var labels = state.labels || [];
  labels.push(state.node['label']['name']);
  stack.push({node: state.node['body'], labels: labels});
};

Interpreter.prototype['stepLiteral'] = function() {
  var stack = this.stateStack;
  var state = stack.pop();
  var value = state.node['value'];
  if (value instanceof RegExp) {
    var pseudoRegexp = this.createRegExp();
    this.populateRegExp(pseudoRegexp, value);
    value = pseudoRegexp;
  }
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepLogicalExpression'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
  if (node['operator'] !== '&&' && node['operator'] !== '||') {
    throw SyntaxError('Unknown logical operator: ' + node['operator']);
  }
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    stack.push({node: node['left']});
  } else if (!state.doneRight_) {
    if ((node['operator'] === '&&' && !state.value) ||
        (node['operator'] === '||' && state.value)) {
      // Shortcut evaluation.
      stack.pop();
      stack[stack.length - 1].value = state.value;
    } else {
      state.doneRight_ = true;
      stack.push({node: node['right']});
    }
  } else {
    stack.pop();
    stack[stack.length - 1].value = state.value;
  }
};

Interpreter.prototype['stepMemberExpression'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
  if (!state.doneObject_) {
    state.doneObject_ = true;
    stack.push({node: node['object']});
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
    stack.push({node: node['property']});
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

Interpreter.prototype['stepObjectExpression'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var n = state.n_ || 0;
  var property = state.node['properties'][n];
  if (!state.object_) {
    // First execution.
    state.object_ = this.createObject(this.OBJECT);
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
    property = state.node['properties'][n];
  }
  if (property) {
    if (property['kind'] !== 'init') {
      this.throwException(this.SYNTAX_ERROR, "Object kind: '" +
          property['kind'] + "'.  Getters and setters are not supported.");
    }
    stack.push({node: property['value']});
  } else {
    stack.pop();
    stack[stack.length - 1].value = state.object_;
  }
};

Interpreter.prototype['stepProgram'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var n = state.n_ || 0;
  var expression = state.node['body'][n];
  if (expression) {
    state.done = false;
    state.n_ = n + 1;
    stack.push({node: expression});
  } else {
    state.done = true;
    // Don't pop the stateStack.
    // Leave the root scope on the tree in case the program is appended to.
  }
};

Interpreter.prototype['stepReturnStatement'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
  if (node['argument'] && !state.done_) {
    state.done_ = true;
    stack.push({node: node['argument']});
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

Interpreter.prototype['stepSequenceExpression'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var n = state.n_ || 0;
  var expression = state.node['expressions'][n];
  if (expression) {
    state.n_ = n + 1;
    stack.push({node: expression});
  } else {
    stack.pop();
    stack[stack.length - 1].value = state.value;
  }
};

Interpreter.prototype['stepSwitchStatement'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  if (!state.test_) {
    state.test_ = 1;
    stack.push({node: state.node['discriminant']});
    return;
  }
  if (state.test_ === 1) {
    state.test_ = 2;
    // Preserve switch value between case tests.
    state.switchValue_ = state.value;
  }

  while (true) {
    var index = state.index_ || 0;
    var switchCase = state.node['cases'][index];
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
        stack.push({node: switchCase['test']});
        return;
      }
      if (state.matched_ || this.comp(state.value, state.switchValue_) === 0) {
        state.matched_ = true;
        var n = state.n_ || 0;
        if (switchCase['consequent'][n]) {
          state.isSwitch = true;
          stack.push({node: switchCase['consequent'][n]});
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

Interpreter.prototype['stepThisExpression'] = function() {
  var stack = this.stateStack;
  stack.pop();
  stack[stack.length - 1].value = this.getValueFromScope('this');
};

Interpreter.prototype['stepThrowStatement'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  if (!state.done_) {
    state.done_ = true;
    stack.push({node: state.node['argument']});
  } else {
    this.throwException(state.value);
  }
};

Interpreter.prototype['stepTryStatement'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
  if (!state.doneBlock_) {
    state.doneBlock_ = true;
    stack.push({node: node['block']});
  } else if (state.throwValue && !state.doneHandler_ && node['handler']) {
    state.doneHandler_ = true;
    stack.push({node: node['handler'], throwValue: state.throwValue});
    state.throwValue = null;  // This error has been handled, don't rethrow.
  } else if (!state.doneFinalizer_ && node['finalizer']) {
    state.doneFinalizer_ = true;
    stack.push({node: node['finalizer']});
  } else if (state.throwValue) {
    // There was no catch handler, or the catch/finally threw an error.
    // Throw the error up to a higher try.
    this.executeException(state.throwValue);
  } else {
    stack.pop();
  }
};

Interpreter.prototype['stepUnaryExpression'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
  if (!state.done_) {
    state.done_ = true;
    var nextState = {
      node: node['argument'],
      components: node['operator'] === 'delete'
    };
    stack.push(nextState);
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
    if (value.length) {
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
    value = (value && value.class === 'Function') ? 'function' : typeof value;
  } else if (node['operator'] === 'void') {
    value = undefined;
  } else {
    throw SyntaxError('Unknown unary operator: ' + node['operator']);
  }
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepUpdateExpression'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var node = state.node;
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    stack.push({node: node['argument'], components: true});
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

Interpreter.prototype['stepVariableDeclaration'] = function() {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  var declarations = state.node['declarations'];
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
      stack.push({node: declarationNode['init']});
      return;
    }
    declarationNode = declarations[++n];
  }
  stack.pop();
};

Interpreter.prototype['stepWithStatement'] = function() {
  this.throwException(this.SYNTAX_ERROR,
                      'Strict mode code may not include a with statement');
};

Interpreter.prototype['stepWhileStatement'] =
    Interpreter.prototype['stepDoWhileStatement'];

if (typeof module !== 'undefined') { // Node.js
  acorn = require('../third_party/acorn/acorn');
  module.exports = Interpreter;
}
