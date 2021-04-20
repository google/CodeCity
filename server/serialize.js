/**
 * @license
 * Copyright 2017 Google LLC
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

var Interpreter = require('./interpreter');
var IterableWeakMap = require('./iterable_weakmap');
var IterableWeakSet = require('./iterable_weakset');
var net = require('net');
var Node = require('./parser').Node;
var Registry = require('./registry');

var Serializer = {};

/** 
 * A record of a single serializalbe type, including a type tag, a
 * constructor function to call when deserializing an instance, and an
 * optional list of properties to exclude when serializing.
 *
 * @typedef {{
 *   tag: string,
 *   constructor: !Function,
 *   prune: (!Array<string>|undefined),
 * }}
 */
var TypeInfo;

/**
 * A configuration object containing an array of TypeInfo objects and
 * indexes by tag an prototype object.
 *
 * @typedef {{
 *   types: !Array<!TypeInfo>,
 *   byTag: !Object<!TypeInfo>,
 *   byProto: !Map<?Object,!TypeInfo>,
 * }}
 */
var Config;

/**
 * Create a configuration object for serializing or desieralizing a
 * particular Interpreter instance.
 *
 * @param {!Interpreter} intrp The interpreter instance being serialized
 *     (needed for inner classes).
 * @return {!Config} The configuration object.
 */
Serializer.getConfig_ = function(intrp) {
  var /** !Array<!TypeInfo> */ types = [
    // Generic JavaScript types, not including those requring special
    // construction (like Functions, Dates, RegExps, etc.)
    {tag: 'Object', constructor: Object},
    {tag: 'Array', constructor: Array},
    {tag: 'Map', constructor: Map},
    {tag: 'Set', constructor: Set},
    
    // Custom types, not Interpreter-specific.
    {tag: 'IterableWeakMap', constructor: IterableWeakMap,
     prune: ['refs_', 'finalisers_']},
    {tag: 'IterableWeakSet', constructor: IterableWeakSet,
     prune: ['refs_', 'map_', 'finalisers_']},
    {tag: 'Registry', constructor: Registry},
    
    // Interpreter-specific types.
    {tag: 'Interpreter', constructor: Interpreter, prune: [
      'hrStartTime_',
      'previousTime_',
      'runner_',
      'Object',
      'Function',
      'UserFunction',
      'BoundFunction',
      'NativeFunction',
      'OldNativeFunction',
      'Array',
      'Date',
      'RegExp',
      'Error',
      'Arguments',
      'WeakMap',
      'Thread',
      'Box',
      'Server',
    ]},
    {tag: 'Scope', constructor: Interpreter.Scope},
    {tag: 'State', constructor: Interpreter.State},
    {tag: 'Thread', constructor: Interpreter.Thread},
    {tag: 'PropertyIterator', constructor: Interpreter.PropertyIterator},
    {tag: 'Source', constructor: Interpreter.Source},
    {tag: 'PseudoObject', constructor: intrp.Object, prune: ['socket']},
    {tag: 'PseudoFunction', constructor: intrp.Function},
    {tag: 'PseudoUserFunction', constructor: intrp.UserFunction},
    {tag: 'PseudoBoundFunction', constructor: intrp.BoundFunction},
    {tag: 'PseudoNativeFunction', constructor: intrp.NativeFunction},
    {tag: 'PseudoOldNativeFunction', constructor: intrp.OldNativeFunction},
    {tag: 'PseudoArray', constructor: intrp.Array},
    {tag: 'PseudoDate', constructor: intrp.Date},
    {tag: 'PseudoRegExp', constructor: intrp.RegExp},
    {tag: 'PseudoError', constructor: intrp.Error},
    {tag: 'PseudoArguments', constructor: intrp.Arguments},
    {tag: 'PseudoWeakMap', constructor: intrp.WeakMap},
    {tag: 'PseudoThread', constructor: intrp.Thread},
    {tag: 'Box', constructor: intrp.Box},
    {tag: 'Server', constructor: intrp.Server, prune: ['server_']},
    {tag: 'Node', constructor: Node},
  ];
  var /** !Object<string,!TypeInfo> */ byTag = Object.create(null);
  var /** !Map<!Object,!TypeInfo> */ byProto = new Map();
  for (var type, i = 0; type = types[i]; i++) {
    byTag[type.tag] = type;
    byProto.set(type.constructor.prototype, type);
  }
  return {types: types, byTag: byTag, byProto: byProto};
};

/**
 * Deserialize the provided JSON-compatible object into an interpreter.
 * @param {!Object} JSON-compatible object.
 * @param {!Interpreter} intrp JS-Interpreter instance.
 */
Serializer.deserialize = function(json, intrp) {
  function decodeValue(value) {
    if (value && typeof value === 'object') {
      var data;
      if ((data = value['#'])) {
       // Object reference: {'#': 42}
       value = objectList[data];
        if (!value) {
          throw new ReferenceError('Object reference not found: ' + data);
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

  // Get configuration.
  var config = Serializer.getConfig_(intrp);
  
  if (!Array.isArray(json)) {
    throw new TypeError('Top-level JSON is not a list.');
  }

  // Require native functions to be present.  Can't just create fresh
  // new interpreter instance because client code may want to add
  // custom builtins.
  if (!intrp.global) {
    throw new Error(
        'Interpreter must be initialized prior to deserialization.');
  }

  // Find all native functions to get id => func mappings.
  var functionHash = Object.create(null);
  // Builtins.
  var builtins = Array.from(intrp.builtins.values());
  var implProps = ['impl', 'call', 'construct'];
  for (var i = 0; i < builtins.length; i++) {
    var builtin = builtins[i];
    for (var j = 0; j < implProps.length; j++) {
      var func = builtin[implProps[j]];
      if (func) functionHash[func.id] = func;
    }
  }
  // Step functions.
  for (var stepName in intrp.stepFuncs) {
    var stepFunc = intrp.stepFuncs[stepName];
    functionHash[stepFunc.id] = stepFunc;
  }

  // First pass: Create object stubs for every object.  We don't need
  // to (re)create object #0, because that's the interpreter proper.
  var objectList = [intrp];
  for (var i = 1; i < json.length; i++) {
    var jsonObj = json[i];
    var obj;
    var tag = jsonObj['type'];
    // Default case handles most types; sepcial cases handle only
    // those that can't be correctly created by an unparameterized
    // construction "new Constructor()".
    switch (tag) {
      case 'Function':
        obj = functionHash[jsonObj['id']];
        if (!obj) {
          throw new RangeError('Function ID not found: ' + jsonObj['id']);
        }
        break;
      case 'Date':
        obj = new Date(jsonObj['data']);
        if (isNaN(obj)) {
          throw new TypeError('Invalid date: ' + jsonObj['data']);
        }
        break;
      case 'RegExp':
        obj = RegExp(jsonObj['source'], jsonObj['flags']);
        break;
      case 'State':
        // TODO(cpcallen): this is just a little performance kludge so
        // that the State constructor doesn't need a conditional in it.
        // Find a more general solution to constructors requiring args.
        obj = new Interpreter.State(/** @type {?} */({}),
            /** @type {?} */(undefined));
        break;
      default:
        if (config.byTag[tag]) {
          obj = new config.byTag[tag].constructor();
        } else {
          throw new TypeError('Unknown type tag "' + tag + '"');
        }
    }
    objectList[i] = obj;
  }
  // Second pass: Populate properties for every object.
  for (var i = 0; i < json.length; i++) {
    var jsonObj = json[i];
    var tag = jsonObj['type'];
    var typeInfo = config.byTag[tag];
    var obj = objectList[i];
    // Set prototype, if specified.
    if (jsonObj['proto']) {
      Object.setPrototypeOf(obj, decodeValue(jsonObj['proto']));
    }
    // Repopulate properties.
    var prune = (typeInfo && typeInfo.prune) || [];
    var props = jsonObj['props'];
    if (props) {
      var nonConfigurable = jsonObj['nonConfigurable'] || [];
      var nonEnumerable = jsonObj['nonEnumerable'] || [];
      var nonWritable = jsonObj['nonWritable'] || [];
      var keys = Object.getOwnPropertyNames(props);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        if (prune.includes(key)) continue;
        Object.defineProperty(obj, key,
            {configurable: !nonConfigurable.includes(key),
             enumerable: !nonEnumerable.includes(key),
             writable: !nonWritable.includes(key),
             value: decodeValue(props[key])});
      }
    }
    // Repopulate sets.
    if (obj instanceof Set || obj instanceof IterableWeakSet) {
      var data = jsonObj['data'];
      if (data) {
        for (var j = 0; j < data.length; j++) {
          obj.add(decodeValue(data[j]));
        }
      }
    }
    // Repopulate maps.
    if (obj instanceof Map || obj instanceof IterableWeakMap) {
      var entries = jsonObj['entries'];
      if (entries) {
        for (var j = 0; j < entries.length; j++) {
          var key = decodeValue(entries[j][0]);
          var value = decodeValue(entries[j][1]);
          obj.set(key, value);
        }
      }
    }
    if (jsonObj['isExtensible'] === false) {  // N.B. normally omitted if true.
      Object.preventExtensions(obj);
    }
  }
  // Finally: fixup interpreter state, post-deserialization.
  intrp.postDeserialize();
};

/**
 * Serialize the provided interpreter.
 * @param {!Interpreter} intrp JS-Interpreter instance.
 * @return {!Object} JSON-compatible object.
 */
Serializer.serialize = function(intrp) {
  // First: prepare interpreter for serialization.
  intrp.preSerialize();
  
  function encodeValue(value) {
    if (value && (typeof value === 'object' || typeof value === 'function')) {
      var ref = objectRefs.get(value);
      if (ref === undefined) {
        console.log('>>>', value);
        throw new RangeError('object not found in table');
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
      } else if (Number.isNaN(value)) {
        return {'Number': 'NaN'};
      } else if (Object.is(value, -0)) {
        return {'Number': '-0'};
      }
    }
    return value;
  }

  // Get configuration.
  var config = Serializer.getConfig_(intrp);

  // Find all objects.
  var objectList = Serializer.getObjectList_(intrp, config);
  // Build reverse-lookup cache.
  var /** !Map<Object,number> */ objectRefs = new Map();
  for (var i = 0; i < objectList.length; i++) {
    objectRefs.set(objectList[i], i);
  }
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
    var typeInfo = config.byProto.get(proto);
    // Default case handles most types; sepcial cases handle only
    // those that have extra intenal slots.
    switch (proto) {
      case Function.prototype:
        jsonObj['type'] = 'Function';
        jsonObj['id'] = obj.id;
        if (!obj.id) {
          throw new Error('Native function has no ID: ' + obj);
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
      case Map.prototype:
        jsonObj['type'] = 'Map';
        if (obj.size) {
          jsonObj['entries'] =
              Array.from(/** @type {?} */(obj),function(entry) {
                var key = encodeValue(entry[0]);
                var value = encodeValue(entry[1]);
                return [key, value];
              });
        }
        break;
      case Set.prototype:
        jsonObj['type'] = 'Set';
        if (obj.size) {
          jsonObj['data'] = Array.from(obj.values(), encodeValue);
        }
        break;
      case IterableWeakMap.prototype:
        jsonObj['type'] = 'IterableWeakMap';
        if (obj.size) {
          jsonObj['entries'] =
              Array.from(/** @type {?} */(obj), function(entry) {
                var key = encodeValue(entry[0]);
                var value = encodeValue(entry[1]);
                return [key, value];
              });
        }
        continue;  // Mustn't index internal properties for IterableWeakMap
      case IterableWeakSet.prototype:
        jsonObj['type'] = 'IterableWeakSet';
        if (obj.size) {
          jsonObj['data'] = Array.from(obj.values(), encodeValue);
        }
        continue;  // Mustn't index internal properties for IterableWeakSet
      case Registry.prototype:
        jsonObj['type'] = 'Registry';
        break;
      default:
        if (typeInfo) {
          jsonObj['type'] = typeInfo.tag;
        } else {
          jsonObj['type'] = Array.isArray(obj) ? 'Array' : 'Object';
          jsonObj['proto'] = encodeValue(proto);
        }
    }
    var props = Object.create(null);
    var nonConfigurable = [];
    var nonEnumerable = [];
    var nonWritable = [];
    var prune = (typeInfo && typeInfo.prune) || [];
    var keys = Object.getOwnPropertyNames(obj);
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      if (prune.includes(key)) continue;
      // Skip [[Socket]] slot on connected objects.
      // TODO(cpcallen): this is pretty kludgy.  Try to find a better way.
      if (obj instanceof intrp.Object && key === 'socket') continue;

      props[key] = encodeValue(obj[key]);
      var descriptor = Object.getOwnPropertyDescriptor(obj, key);
      if (!descriptor.configurable) {
        nonConfigurable.push(key);
      }
      if (!descriptor.enumerable) {
        nonEnumerable.push(key);
      }
      if (!descriptor.writable) {
        nonWritable.push(key);
      }
    }
    if (Object.getOwnPropertyNames(keys).length) {
      jsonObj['props'] = props;
    }
    if (nonConfigurable.length) {
      jsonObj['nonConfigurable'] = nonConfigurable;
    }
    if (nonEnumerable.length) {
      jsonObj['nonEnumerable'] = nonEnumerable;
    }
    if (nonWritable.length) {
      jsonObj['nonWritable'] = nonWritable;
    }
    if (!Object.isExtensible(obj)) {
      jsonObj['isExtensible'] = false;
    }
  }
  return json;
};

/**
 * Recursively search node to find all non-primitives.
 *
 * TODO(cpcallen): use a Registry instead of Array for objectList;
 *     this would allow more readable references by using paths
 *     instead of numerical indices.
 * @param {*} node JavaScript value to search.
 * @param {!Config} config Configuation object.
 * @return {!Array<!Object>} objectList Array of all objects found via node.
 */
Serializer.getObjectList_ = function(node, config) {
  var seen = new Set();
  Serializer.objectHunt_(node, config, seen);
  return Array.from(seen.keys());
};

/**
 * Recursively search node find all non-primitives.
 *
 * @param {*} node JavaScript value to search.
 * @param {!Config} config Configuation object.
 * @param {!Set<?Object>} seen Set of objects found so far.
 */
Serializer.objectHunt_ = function(node, config, seen) {
  if (!node || (typeof node !== 'object' && typeof node !== 'function')) {
    // node is primitive.  Nothing to do.
    return;
  }
  var obj = /** @type {!Object} */(node);
  if (seen.has(obj)) return;
  var proto = Object.getPrototypeOf(obj);
  seen.add(obj);
  if (typeof obj === 'object') {  // Recurse.
    var typeInfo = config.byProto.get(proto);
    var prune = (typeInfo && typeInfo.prune) || [];
    // Properties.
    var keys = Object.getOwnPropertyNames(obj);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (prune.includes(key)) continue;
      Serializer.objectHunt_(obj[key], config, seen);
    }
    // Set members.
    if (obj instanceof Set || obj instanceof IterableWeakSet) {
      obj.forEach(function(value) {
        Serializer.objectHunt_(value, config, seen);
      });
    }
    // Map entries.
    if (obj instanceof Map || obj instanceof IterableWeakMap) {
      obj.forEach(function(value, key) {
        Serializer.objectHunt_(key, config, seen);
        Serializer.objectHunt_(value, config, seen);
      });
    }
  }
};

module.exports = Serializer;
