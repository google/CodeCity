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
)

// A NativeImpl is a Go-language function which can be used as the
// implementation of a JS function.
//
// It takes a pointer to the enclosing interpreter, a 'this' value,
// and a slice arguments.  The Go-language function is responsible for
// checking that the arguments are correct in number and type.
//
// It returns a JS value (ret) and boolean flag (throw).  If throw is
// true it indicates that ret is a thrown exception rather than a
// normal return value.
type NativeImpl func(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool)

// A nativeFunc is an object that when called / applied invokes a
// Go-language function.
type nativeFunc struct {
	data.Object
	impl NativeImpl
}

// *nativeFunc must satisfy Value.
var _ data.Value = (*nativeFunc)(nil)

func (nativeFunc) Typeof() string {
	return "function"
}

func (nativeFunc) ToString() data.String {
	return "[object Function]"
}

// newNativeFunc returns a new native function object with the
// specified owner, prototype, length and implementation.
func newNativeFunc(owner *data.Owner, proto data.Object, length int, impl NativeImpl) *nativeFunc {
	o := data.NewObject(owner, proto)
	err := o.Set("length", data.Number(length)) // FIXME: readonly!
	if err != nil {
		panic(err)
	}
	return &nativeFunc{
		Object: o,
		impl:   impl,
	}
}
