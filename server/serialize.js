/**
 * @license
 * Code City: serialization and deserialization for JavaScript Intepreter.
 *
 * Copyright 2017 Google Inc.
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
 * @fileoverview Saving and restoring the state of the interpreter.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var Interpreter;

var Serializer = {};

Serializer.deserialize = function(json, intrp) {
  function decodeValue(value) {
    if (value && typeof value === 'object') {
      var data;
      if ((data = value['#'])) {
       // Object reference: {'#': 42}
       value = objectList[data];
        if (!value) {
          throw ReferenceError('Object reference not found: ' + data);
        }
        return value;
      }
      if ((data = value['Number'])) {
        // Special number: {'Number': 'Infinity'}
        return Number(data);
      }
      if ((data = value['Value'])) {
        // Special value: {'Value': 'undefined'}
        if (value['Value'] === 'undefined') {
          return undefined;
        }
      }
    }
    return value;
  }

  if (!Array.isArray(json)) {
    throw TypeError('Top-level JSON is not a list.');
  }

  // Require native functions to be present.  Can't just create fresh
  // new interpreter instance because client code may want to add
  // custom builtins.
  if (!intrp.global) {
    throw Error('Interpreter must be initialized prior to deserialization.');
  }
  // Find all native functions in existing interpreter.
  // Find all native functions to get id => func mappings.
  var objectList = [];
  Serializer.objectHunt_(intrp, objectList);
  var functionHash = Object.create(null);
  for (var i = 0; i < objectList.length; i++) {
    if (typeof objectList[i] === 'function') {
      functionHash[objectList[i].id] = objectList[i];
    }
  }
  // Get types.
  var types = this.getTypesDeserialize_(intrp);

  // First pass: Create object stubs for every object.  We don't need
  // to (re)create object #0, because that's the interpreter proper.
  objectList = [intrp];
  for (var i = 1; i < json.length; i++) {
    var jsonObj = json[i];
    var obj;
    var type = jsonObj['type'];
    switch (type) {
      case 'Map':
        obj = Object.create(null);
        break;
      case 'Object':
        obj = {};
        break;
      case 'ScopeReference':
        obj = Interpreter.SCOPE_REFERENCE;
        break;
      case 'Function':
        obj = functionHash[jsonObj['id']];
        if (!obj) {
          throw RangeError('Function ID not found: ' + jsonObj['id']);
        }
        break;
      case 'Array':
        obj = [];
        break;
      case 'Set':
        obj = new Set();
        break;
      case 'Date':
        obj = new Date(jsonObj['data']);
        if (isNaN(obj)) {
          throw TypeError('Invalid date: ' + jsonObj['data']);
        }
        break;
      case 'RegExp':
        obj = RegExp(jsonObj['source'], jsonObj['flags']);
        break;
      default:
        var constructor = types[type];
        if (!constructor) {
          throw TypeError('Unknown type: ' + jsonObj['type']);
        }
        obj = new constructor;
    }
    objectList[i] = obj;
  }
  // Second pass: Populate properties for every object.
  for (var i = 0; i < json.length; i++) {
    var jsonObj = json[i];
    var obj = objectList[i];
    // Repopulate objects.
    var props = jsonObj['props'];
    if (props) {
      var names = Object.getOwnPropertyNames(props);
      for (var j = 0; j < names.length; j++) {
        var name = names[j];
        obj[name] = decodeValue(props[name]);
      }
    }
    // Repopulate sets.
    if (obj instanceof Set) {
      var data = jsonObj['data'];
      if (data) {
        for (var j = 0; j < data.length; j++) {
          obj.add(decodeValue(data[j]));
        }
      }
    }
  }
};

Serializer.serialize = function(intrp) {
  function encodeValue(value) {
    if (value && (typeof value === 'object' || typeof value === 'function')) {
      var ref = objectList.indexOf(value);
      if (ref === -1) {
        throw RangeError('Object not found in table.');
      }
      return {'#': ref};
    }
    if (value === undefined) {
      return {'Value': 'undefined'};
    }
    if (typeof value === 'number') {
      if (value === Infinity) {
        return {'Number': 'Infinity'};
      } else if (value === -Infinity) {
        return {'Number': '-Infinity'};
      } else if (isNaN(value)) {
        return {'Number': 'NaN'};
      } else if (1 / value === -Infinity) {
        return {'Number': '-0'};
      }
    }
    return value;
  }

  // Properties on Interpreter instances to ignore.
  var skipList = ['Object', 'Function', 'Array', 'Date', 'RegExp', 'Error',
                  'Thread', 'stepFunctions_', 'runner_'];
  // Find all objects.
  var objectList = [];
  Serializer.objectHunt_(intrp, objectList, skipList);
  // Get types.
  var types = this.getTypesSerialize_(intrp);
  // Serialize every object.
  var json = [];
  for (var i = 0; i < objectList.length; i++) {
    var jsonObj = Object.create(null);
    json.push(jsonObj);
    var obj = objectList[i];
    // TODO: Add a flag on the '#' prop.  On for debugging, off for production.
    if (true) {
      jsonObj['#'] = i;
    }
    var proto = Object.getPrototypeOf(obj);
    switch (proto) {
      case null:
        jsonObj['type'] = 'Map';
        break;
      case Object.prototype:
        if (obj === Interpreter.SCOPE_REFERENCE) {
          jsonObj['type'] = 'ScopeReference';
        } else {
          jsonObj['type'] = 'Object';
        }
        break;
      case Function.prototype:
        jsonObj['type'] = 'Function';
        jsonObj['id'] = obj.id;
        if (!obj.id) {
          throw Error('Native function has no ID: ' + obj);
        }
        continue;  // No need to index properties.
      case Array.prototype:
        jsonObj['type'] = 'Array';
        break;
      case Set.prototype:
        jsonObj['type'] = 'Set';
        if (obj.size) {
          jsonObj['data'] = Array.from(obj.values()).map(encodeValue);
        }
        continue;  // No need to index properties.
      case Date.prototype:
        jsonObj['type'] = 'Date';
        jsonObj['data'] = obj.toJSON();
        continue;  // No need to index properties.
      case RegExp.prototype:
        jsonObj['type'] = 'RegExp';
        jsonObj['source'] = obj.source;
        jsonObj['flags'] = obj.flags;
        continue;  // No need to index properties.
      default:
        var type = types.get(proto);
        if (!type) {
          throw TypeError('Unknown type: ' + obj);
        }
        jsonObj['type'] = type;
    }
    var props = Object.create(null);
    var names = Object.getOwnPropertyNames(obj);
    for (var j = 0; j < names.length; j++) {
      var name = names[j];
      if (obj !== intrp || skipList.indexOf(name) === -1) {
        props[name] = encodeValue(obj[name]);
      }
    }
    if (names.length) {
      jsonObj['props'] = props;
    }
  }
  return json;
};

// Recursively search the stack to find all non-primitives.
Serializer.objectHunt_ = function(node, objectList, skipList) {
  if (node && (typeof node === 'object' || typeof node === 'function')) {
    if (objectList.indexOf(node) !== -1) {
      return;
    }
    objectList.push(node);
    if (typeof node === 'object') {  // Recurse.
      var names = Object.getOwnPropertyNames(node);
      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        if (!skipList || skipList.indexOf(name) === -1) {
          // Don't pass skiplist; it's only for top-level property keys.
          Serializer.objectHunt_(node[names[i]], objectList);
        }
      }
    }
  }
};

/**
 * Make a map of typename to contructor for each type that might be
 * found while serializing an Interpreter instance.
 * @param {!Interpreter} intrp The interpreter instance being serialized
 *     (needed for inner classes).
 * @return {!Object} A key/value map of typesnames to constructors.
 */
Serializer.getTypesDeserialize_ = function (intrp) {
  return {
    'Interpreter': Interpreter,
    'Scope': Interpreter.Scope,
    'State': Interpreter.State,
    'Thread': Interpreter.Thread,
    'PseudoObject': intrp.Object,
    'PseudoFunction': intrp.Function,
    'PseudoArray': intrp.Array,
    'PseudoDate': intrp.Date,
    'PseudoRegExp': intrp.RegExp,
    'PseudoError': intrp.Error,
    'Node': Interpreter.Node,
  };
};

/**
 * Make a map of prototype to typename for each of the types that
 * might be found while deserializing an Interpreter instance.
 * @param {!Interpreter} intrp An interpreter instance being
 *     deserialized into (needed for inner classes).
 * @return {!Map} A key/value map of protoytype objects to typesnames.
 */
Serializer.getTypesSerialize_ = function (intrp) {
  var types = this.getTypesDeserialize_(intrp);
  var map = new Map;
  for (var t in types) {
    if (types.hasOwnProperty(t)) {
      map.set(types[t].prototype, t);
    }
  }
  return map;
};

if (typeof module !== 'undefined') {  // Node.js
  Interpreter = require('./interpreter');
  module.exports = Serializer;
}
