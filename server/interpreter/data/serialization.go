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

package data

import (
	"reflect"

	"CodeCity/server/flatpack"
)

func init() {
	var ifaces = reflect.TypeOf(
		struct {
			i1 Value
			i2 Object
		}{})
	for i := 0; i < ifaces.NumField(); i++ {
		flatpack.RegisterType(ifaces.Field(i).Type)
	}

	var examples = []interface{}{
		// From array.go:
		Array{},

		// From boxes.go:
		BoxedBoolean{},
		BoxedNumber{},
		BoxedString{},

		// From error.go:
		NativeError{},
		NativeErrorType(0),

		// From Object.go:
		object{},
		property{},

		// From owner.go:
		Owner{},

		// From primitives.go:
		Boolean(false),
		Number(0),
		String(""),
		Null{},
		Undefined{},

		// From propiter.go:
		PropIter{},

		// From protos.go:
		Protos{},

		// From value.go
		Type(0),
	}
	for _, val := range examples {
		flatpack.RegisterTypeOf(val)
	}
}
