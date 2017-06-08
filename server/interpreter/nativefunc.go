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
	"encoding/json"
	"fmt"

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
//
// In order to be serializable using flatpack and encoding/json (which
// cannot serialise function values) it does not contain the
// NativeImpl directly but rather an index into the package variable
// nativeImpls.
type nativeFunc struct {
	data.Object
	idx natImplIdx
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
// specified owner, prototype, tag and length.
//
// The owner and proto params are as for data.NewObject().
//
// The tag param specifies which nativeImpl (from nativeImpls) should
// be used; this will also be used when serialising; a deserialised
// NativeFunc will be reconnected to a nativeImpl with the same name.
//
// the length param specifies the value for the function's .length
// property; this is neither a minimum nor maximum number of
// parameters, but a somewhat arbitrary 'usual' number of parameters
// as specified by the ES5.1 spec.
func newNativeFunc(owner *data.Owner, proto data.Object, tag string, length int) *nativeFunc {
	idx, ok := nativeImplsByTag[tag]
	if !ok {
		panic(fmt.Errorf("No NativeImpl tagged '%s' registered", tag))
	}
	o := data.NewObject(owner, proto)
	// FIXME: make not writeable? (check spec for this an other attributes)
	err := o.Set("length", data.Number(length)) // FIXME: readonly!
	if err != nil {
		panic(err)
	}
	return &nativeFunc{
		Object: o,
		idx:    idx,
	}
}

// nit is the type of the entries of the nativeImpls table
type nit struct {
	tag  string
	impl NativeImpl
}

// nativeImpls is a table mapping nativeFunc.idx values to NativeImpl
// values.
var nativeImpls []nit

// nativeImplsByTag is a map indexing nativeImpls by tag value.
var nativeImplsByTag = make(map[string]natImplIdx)

// registerNativeImpl adds impl to nativeImpls with the specified tag.
func registerNativeImpl(tag string, impl NativeImpl) {
	if _, exists := nativeImplsByTag[tag]; exists {
		panic(fmt.Errorf("A NativeImpl tagged '%s' already registered", tag))
	}
	nativeImplsByTag[tag] = natImplIdx(len(nativeImpls))
	nativeImpls = append(nativeImpls, nit{tag, impl})
}

// natImplIdx is just an integer index into nativeImpls which is
// serialised in a special way: using the corresponding tag value.
type natImplIdx int

// natImplIdx must satisfy json.Marshaler and json.Unmarshaler.
var _ json.Marshaler = natImplIdx(0)
var _ json.Unmarshaler = &[]natImplIdx{0}[0]

func (idx natImplIdx) MarshalJSON() ([]byte, error) {
	if n := len(nativeImpls); int(idx) >= n {
		return nil, fmt.Errorf("natImplIdx %d out of range [0:%d]", idx, n)
	}
	return json.Marshal(nativeImpls[idx].tag)
}

func (idx *natImplIdx) UnmarshalJSON(data []byte) error {
	var tag string
	err := json.Unmarshal(data, &tag)
	if err != nil {
		return err
	}
	var ok bool
	*idx, ok = nativeImplsByTag[tag]
	if !ok {
		return fmt.Errorf("No NativeImpl tagged '%s' registered", tag)
	}
	return nil
}
