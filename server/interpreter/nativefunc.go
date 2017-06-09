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

// A NativeImpl encapsulates information about a Go-language function
// which can be used as the implementation of a JS function.
type NativeImpl struct {
	// Tag is a string used to refer to the NativeImpl when creating
	// the corresponding JS function object (and when serializing
	// interpreter state to disk).  It must be unique amongst
	// (registered) NativeImpls, and can be any arbitrary value but is
	// normally the same as the Javascript name of the function this
	// NativeImpl implements (for example:
	// "Object.prototype.toString")
	Tag string

	// Impl is the Go language function that is the actual
	// implementation of a native function.  It takes a pointer to the
	// enclosing interpreter, a 'this' value, and a slice arguments.
	//
	// It returns a JS value (ret) and boolean flag (throw).  If throw
	// is true it indicates that ret is a thrown exception rather than
	// a normal return value.
	//
	// Note that this function is (mostly) responsible for checking
	// that the arguments are correct in number and type.
	Impl func(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool)

	// Length specifies the value to be used for the associated (JS)
	// function object's .length property; this is neither a minimum
	// nor maximum number of parameters, but a somewhat arbitrary
	// 'usual' number of parameters as specified by the ES5.1 spec.
	//
	// If length > 0, the []args parameter to impl will be padded out
	// to this length (by adding JS undefined values as required)
	// before impl is called.
	Length int
}

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

// *nativeFunc must satisfy Object.
var _ data.Object = (*nativeFunc)(nil)

func (nativeFunc) Typeof() string {
	return "function"
}

// Class always returns "Function" for function objects.
func (nativeFunc) Class() string {
	return "Function"
}

// ToString is repeated here to catch the changed definition of Class.
//
// BUG(cpcallen): as with object.ToString, nativeFunc.ToString should
// call a user-code toString() method if present.
func (nf nativeFunc) ToString() data.String {
	return data.String("[object " + nf.Class() + "]")
}

func (nf nativeFunc) call(intrp *Interpreter, this data.Value, args []data.Value) (ret data.Value, throw bool) {
	ni := nativeImpls[nf.idx]
	// Extend args list to length:
	for len(args) < ni.Length {
		args = append(args, data.Undefined{})
	}
	return ni.Impl(intrp, this, args)
}

// newNativeFunc returns a new native function object with the
// specified owner, prototype, tag and length.
//
// The owner and proto params are as for data.NewObject().
//
// The tag param specifies which nativeImpl (from nativeImpls) should
// be used; this will also be used when serialising; a deserialised
// NativeFunc will be reconnected to a nativeImpl with the same name.
func newNativeFunc(owner *data.Owner, proto data.Object, tag string) *nativeFunc {
	idx, ok := nativeImplsByTag[tag]
	if !ok {
		panic(fmt.Errorf("No NativeImpl tagged '%s' registered", tag))
	}
	o := data.NewObject(owner, proto)
	// FIXME: make not writeable? (check spec for this an other attributes)
	err := o.Set("length", data.Number(nativeImpls[idx].Length))
	if err != nil {
		panic(err)
	}
	return &nativeFunc{
		Object: o,
		idx:    idx,
	}
}

// nativeImpls is a table mapping nativeFunc.idx values to NativeImpl
// values.
var nativeImpls []NativeImpl

// nativeImplsByTag is a map indexing nativeImpls by tag value.
var nativeImplsByTag = make(map[string]natImplIdx)

// registerNativeImpl adds its argument to nativeImpls (and indexes it
// by tag in nativeImplsByTag).
func registerNativeImpl(ni NativeImpl) {
	if _, exists := nativeImplsByTag[ni.Tag]; exists {
		panic(fmt.Errorf("A NativeImpl tagged '%s' already registered", ni.Tag))
	}
	nativeImplsByTag[ni.Tag] = natImplIdx(len(nativeImpls))
	nativeImpls = append(nativeImpls, ni)
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
	return json.Marshal(nativeImpls[idx].Tag)
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
