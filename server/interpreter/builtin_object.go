/* Copyright 2017 Google Inc.
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

package interpreter

import (
	"CodeCity/server/interpreter/data"
	"fmt"
)

func (intrp *Interpreter) initBuiltinObject() {
	intrp.mkBuiltin("Object", data.NewObject(nil, intrp.protos.ObjectProto))

	intrp.mkBuiltin("Object.prototype", intrp.protos.ObjectProto)

	intrp.mkBuiltinFunc("Object.getPrototypeOf", 1)
	intrp.mkBuiltinFunc("Object.getOwnPropertyDescriptor", 2)
	intrp.mkBuiltinFunc("Object.getOwnPropertyNames", 1)
	intrp.mkBuiltinFunc("Object.create", 2)
	intrp.mkBuiltinFunc("Object.defineProperty", 3)
	intrp.mkBuiltinFunc("Object.defineProperties", 2)
	// intrp.mkBuiltinFunc("Object.seal", 1)
	// intrp.mkBuiltinFunc("Object.freeze", 1)
	// intrp.mkBuiltinFunc("Object.preventExtensions", 1)
	// intrp.mkBuiltinFunc("Object.isSealed", 1)
	// intrp.mkBuiltinFunc("Object.isFrozen", 1)
	// intrp.mkBuiltinFunc("Object.isExtensible", 1)
	// intrp.mkBuiltinFunc("Object.keys", 1)

	intrp.mkBuiltinFunc("Object.prototype.toString", 0)
	// etc.
}

// Underscores replace '.'s in names of builtin function
// implementations.  Sorry, golint.

func builtinObject_getPrototypeOf(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool) {
	// Need at least one argument:
	for len(args) < 1 {
		args = append(args, data.Undefined{})
	}
	obj, ok := args[0].(data.Object)
	if !ok {
		return intrp.typeError(fmt.Sprintf("Cannot get prototype of %s", args[0].ToString())), true
	}
	proto := obj.Proto()
	if proto == nil {
		return data.Null{}, false
	}
	return proto, false
}

func builtinObject_getOwnPropertyDescriptor(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool) {
	// Need at least two arguments:
	for len(args) < 2 {
		args = append(args, data.Undefined{})
	}
	obj, ok := args[0].(data.Object)
	if !ok {
		return intrp.typeError(fmt.Sprintf("Cannot get property descriptor from %s", args[0].ToString())), true
	}
	key := string(args[1].ToString())
	pd, ok := obj.GetOwnProperty(key)
	if !ok {
		return data.Undefined{}, false
	}
	// FIXME: set owner
	desc, ne := data.FromPropertyDescriptor(pd, nil, intrp.protos.ObjectProto)
	if ne != nil {
		return intrp.nativeError(ne), true
	}
	return desc, false
}

func builtinObject_getOwnPropertyNames(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool) {
	// Need at least one argument:
	for len(args) < 1 {
		args = append(args, data.Undefined{})
	}
	obj, ok := args[0].(data.Object)
	if !ok {
		return intrp.typeError(fmt.Sprintf("Cannot get propery names of %s", args[0].ToString())), true
	}
	keys := data.NewArray(nil, intrp.protos.ArrayProto)
	for i, k := range obj.OwnPropertyKeys() {
		ne := keys.Set(string(data.Number(i).ToString()), data.String(k))
		if ne != nil {
			return intrp.nativeError(ne), true
		}
	}
	return keys, false
}

func builtinObject_create(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool) {
	// Need at least one argument:
	for len(args) < 1 {
		args = append(args, data.Undefined{})
	}
	if args[0] == (data.Null{}) {
		// FIXME: set owner
		return data.NewObject(nil, nil), false
	}
	proto, ok := args[0].(data.Object)
	if !ok {
		return intrp.typeError("Object prototype may only be an Object or null"), true
	}
	// FIXME: set owner
	obj := data.NewObject(nil, proto)
	if len(args) > 1 {
		builtinObject_defineProperties(intrp, this, []data.Value{obj, args[1]})
	}
	return obj, false

}

func builtinObject_defineProperty(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool) {
	// Need at least three arguments:
	for len(args) < 3 {
		args = append(args, data.Undefined{})
	}
	obj, ok := args[0].(data.Object)
	if !ok {
		return intrp.typeError(fmt.Sprintf("Cannot define property on %s", args[0].ToString())), true
	}
	key := string(args[1].ToString())
	desc, ok := args[2].(data.Object)
	if !ok {
		return intrp.typeError("Property descriptor must be an object"), true
	}
	pd, ne := data.ToPropertyDescriptor(desc)
	if ne != nil {
		return intrp.nativeError(ne), true
	}
	ne = obj.DefineOwnProperty(key, pd)
	if ne != nil {
		return intrp.nativeError(ne), true
	}
	return obj, false
}

func builtinObject_defineProperties(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool) {
	// Need at least two arguments:
	for len(args) < 2 {
		args = append(args, data.Undefined{})
	}
	obj, ok := args[0].(data.Object)
	if !ok {
		return intrp.typeError(fmt.Sprintf("Cannot define property on %s", args[0].ToString())), true
	}
	// FIXME: set owner:
	props, ne := intrp.toObject(args[1], nil)
	if ne != nil {
		return intrp.nativeError(ne), true
	}
	type kpd struct {
		key string
		pd  data.Property
	}
	var kpds []kpd
	for _, key := range props.OwnPropertyKeys() {
		pdpd, ok := props.GetOwnProperty(key)
		if !ok || !pdpd.E {
			continue
		}
		descObj, ok := pdpd.Value.(data.Object)
		if !ok {
			return intrp.typeError("Property descriptor must be an object"), true
		}
		pd, ne := data.ToPropertyDescriptor(descObj)
		if ne != nil {
			return intrp.nativeError(ne), true
		}
		kpds = append(kpds, kpd{key, pd})
	}
	// Create props in second pass (in case of errors in first).
	for _, d := range kpds {
		ne = obj.DefineOwnProperty(d.key, d.pd)
		if ne != nil {
			return intrp.nativeError(ne), true
		}
	}
	return obj, false
}

// func builtinObject_seal(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool)
// func builtinObject_freeze(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool)
// func builtinObject_preventExtensions(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool)
// func builtinObject_isSealed(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool)
// func builtinObject_isFrozen(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool)
// func builtinObject_isExtensible(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool)
// func builtinObject_keys(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool)

/****************************************************************/

func builtinObject_prototype_toString(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool) {
	// FIXME: don't panic
	if this == nil {
		panic("Object.property.toString called with this == nil??")
	}
	return this.ToString(), false
}

func init() {
	registerNativeImpl("Object.getPrototypeOf", builtinObject_getPrototypeOf)
	registerNativeImpl("Object.getOwnPropertyDescriptor", builtinObject_getOwnPropertyDescriptor)
	registerNativeImpl("Object.getOwnPropertyNames", builtinObject_getOwnPropertyNames)
	registerNativeImpl("Object.create", builtinObject_create)
	registerNativeImpl("Object.defineProperty", builtinObject_defineProperty)
	registerNativeImpl("Object.defineProperties", builtinObject_defineProperties)
	// registerNativeImpl("Object.seal", builtinObject_seal)
	// registerNativeImpl("Object.freeze", builtinObject_freeze)
	// registerNativeImpl("Object.preventExtensions", builtinObject_preventExtensions)
	// registerNativeImpl("Object.isSealed", builtinObject_isSealed)
	// registerNativeImpl("Object.isFrozen", builtinObject_isFrozen)
	// registerNativeImpl("Object.isExtensible", builtinObject_isExtensible)
	// registerNativeImpl("Object.keys", builtinObject_keys)

	registerNativeImpl("Object.prototype.toString", builtinObject_prototype_toString)
}
