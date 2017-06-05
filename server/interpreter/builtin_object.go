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

	intrp.mkBuiltinFunc("Object.getPrototypeOf", 1,
		func(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool) {
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
		})

	// Object.getOwnPropertyDescriptor
	// Object.getOwnPropertyNames
	// Object.create

	intrp.mkBuiltinFunc("Object.defineProperty", 3,
		func(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool) {
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
				return intrp.typeError("Property description must be an object"), true
			}
			var pd data.Property
			var ne *data.NativeError
			pd.Value, ne = desc.Get("value")
			if ne != nil {
				return intrp.nativeError(ne), true
			}
			// FIXME: set owner
			pd.Owner = nil
			attrs := []struct {
				flag *bool
				key  string
			}{
				{&pd.W, "writeable"},
				{&pd.E, "enumerable"},
				{&pd.C, "configurable"},
				{&pd.R, "readable"},
				{&pd.I, "inheritable"},
			}
			for _, attr := range attrs {
				v, ne := desc.Get(attr.key)
				if ne != nil {
					return intrp.nativeError(ne), true
				}
				*(attr.flag) = bool(v.ToBoolean())
			}
			ne = obj.DefineOwnProperty(key, pd)
			if ne != nil {
				return intrp.nativeError(ne), true
			}
			return obj, false
		})

	// Object.defineProperties
	// Object.seal
	// Object.freeze
	// Object.preventExtensions
	// Object.isSealed
	// Object.isFrozen
	// Object.isExtensible
	// Object.keys

	/****************************************************************/

	intrp.mkBuiltinFunc("Object.prototype.toString", 0,
		func(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool) {
			// FIXME: don't panic
			if this == nil {
				panic("Object.property.toString called with this == nil??")
			}
			return this.ToString(), false
		})
}
