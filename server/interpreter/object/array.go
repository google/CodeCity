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

package object

import (
	"math"
)

// An Array is an object with a magic .length property and some other
// minor special features.
type Array struct {
	Object
	length uint32
}

// *Array must satisfy Value.
var _ Value = (*Array)(nil)

// Get on Array implements a magic .length property itself, and passes
// any other property lookups to its embedded Object.
func (arr *Array) Get(name string) (Value, *ErrorMsg) {
	if name != "length" {
		return arr.Object.Get(name)
	}
	return Number(float64(arr.length)), nil
}

// Set on Array will, if name == "length":
//
// - Update .length be the specified length.
// - Delete any properties whose names are indexes and >= .length
//
// Otherwise, it will:
//
// - Delegates setting the specified property to its embedded Object.
// - If this succeeds, and the property name looks like an array
// index, then it will udpate .length appropriately.
func (arr *Array) Set(name string, value Value) *ErrorMsg {
	if name == "length" {
		l, ok := asLength(value)
		if !ok {
			return &ErrorMsg{"Range Error", "Invalid array length"}
		}
		arr.length = l
		for k, _ := range arr.properties {
			if i, isIndex := asIndex(k); isIndex && i >= l {
				delete(arr.properties, k)
			}
		}
		return nil
	}
	err := arr.Object.Set(name, value)
	if err == nil {
		if i, isIndex := asIndex(name); isIndex && arr.length < i+1 {
			arr.length = i + 1
		}
	}
	return err
}

// propNames returns the list of property names (starting with
// "length"); for efficiency this is done directly rather than by
// calling the propNames method on the embedded Object.
func (arr *Array) propNames() []string {
	names := make([]string, len(arr.Object.properties)+1)
	names[0] = "length"
	i := 1
	for k := range arr.Object.properties {
		names[i] = k
		i++
	}
	return names
}

// Delete will reject attempts to remove "length" and otherwise defers
// to the embedded Object.
func (arr *Array) Delete(name string) *ErrorMsg {
	if name == "length" {
		return &ErrorMsg{"TypeError",
			"Cannot delete property 'length' of array."}
	}
	return arr.Object.Delete(name)
}

// HasOwnProperty returns true if the property name is "length" or if
// the embedded Object has it.
func (arr Array) HasOwnProperty(s string) bool {
	if s == "length" {
		return true
	}
	return arr.Object.HasOwnProperty(s)
}

// ToString returns a string containing a comma-separated
// concatenation of the result of calling ToString() on the elements
// of the array in numerical order.
//
// BUG(cpcallen): this should probably call a user-supplied
// .toString() method if present.
func (arr Array) ToString() String {
	// FIXME: not implemented yet.
	return "[object Array]"
}

// NewArray creates a new Array with the specified owner and
// prototype, initialises it as appropriate, and returns a pointer to
// the newly-created object.
func NewArray(owner *Owner, proto Value) *Array {
	var arr = new(Array)
	arr.init(owner, proto)
	arr.f = true
	arr.length = 0
	return arr
}

// ArrayProto is the default prototype for JavaScript arrays (i.e.,
// ones created from array literals or via Array() and not had their
// prototype subsequently changed).  It is itself an array with
// prototype ObjectProto.
var ArrayProto = NewArray(nil, ObjectProto)

/********************************************************************/

// asIndex takes a property name (as a string) and checks to see if it
// qualifies as an array index (according to the definition given in
// §15.4 of the ES5.1 spec).  If it does, it returns the index and
// true; if not it return 0 and false.
func asIndex(p string) (uint32, bool) {
	n := uint32(float64(String(p).ToNumber()))
	if n < math.MaxUint32 && string(Number(n).ToString()) == p {
		return n, true
	}
	return 0, false
}

// asLength takes a value and checks to see if it is a valid array
// length.  If it is, it returns the length and true; if not it return
// 0 and false.
func asLength(v Value) (uint32, bool) {
	n := float64(v.ToNumber())
	if n < 0 || n > math.MaxUint32 || n != math.Floor(n) {
		return 0, false
	}
	return uint32(n), true
}
