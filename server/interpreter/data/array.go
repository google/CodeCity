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
	"math"
)

// An Array is an object with a magic .length property and some other
// minor special features.
type Array struct {
	object
	length uint32
}

// *Array must satisfy Object.
var _ Object = (*Array)(nil)

// Class always returns "Array" for array objects.
func (Array) Class() string {
	return "Array"
}

// Get on Array implements a magic .length property itself, and passes
// any other property lookups to its embedded object.
func (arr *Array) Get(key string) (Value, *NativeError) {
	if key != "length" {
		return arr.object.Get(key)
	}
	return Number(float64(arr.length)), nil
}

// Set on Array will, if key == "length":
//
// - Update .length be the specified length.
// - Delete any properties whose keys are indexes and >= .length
//
// Otherwise, it will:
//
// - Delegates setting the specified property to its embedded object.
// - If this succeeds, and the property key looks like an array
// index, then it will udpate .length appropriately.
func (arr *Array) Set(key string, value Value) *NativeError {
	if key == "length" {
		l, ok := asLength(value)
		if !ok {
			return &NativeError{RangeError, "Invalid array length"}
		}
		arr.length = l
		for k := range arr.properties {
			if i, isIndex := asIndex(k); isIndex && i >= l {
				delete(arr.properties, k)
			}
		}
		return nil
	}
	if nErr := arr.object.Set(key, value); nErr != nil {
		return nErr
	}
	if i, isIndex := asIndex(key); isIndex && arr.length < i+1 {
		arr.length = i + 1
	}
	return nil
}

// OwnPropertyKeys returns the list of property keys (starting with
// "length"); for efficiency this is done directly rather than by
// calling the OwnPropertyKeys method on the embedded object.
func (arr *Array) OwnPropertyKeys() []string {
	keys := make([]string, len(arr.object.properties)+1)
	keys[0] = "length"
	i := 1
	for k := range arr.object.properties {
		keys[i] = k
		i++
	}
	return keys
}

// Delete will reject attempts to remove "length" and otherwise defers
// to the embedded object.
func (arr *Array) Delete(key string) *NativeError {
	if key == "length" {
		return &NativeError{TypeError, "Cannot delete property 'length' of array."}
	}
	return arr.object.Delete(key)
}

// HasOwnProperty returns true if the property key is "length" or if
// the embedded object has it.
func (arr Array) HasOwnProperty(s string) bool {
	if s == "length" {
		return true
	}
	return arr.object.HasOwnProperty(s)
}

// HasProperty returns true if the property key is "length" or if the
// embedded object (or its prototype(s)) has it.
func (arr Array) HasProperty(s string) bool {
	if s == "length" {
		return true
	}
	return arr.object.HasProperty(s)
}

// ToString returns a string containing a comma-separated
// concatenation of the result of calling ToString() on the elements
// of the array in numerical order.
//
// BUG(cpcallen): this should probably call a user-supplied
// .toString() method if present.
func (arr Array) ToString() String {
	// FIXME: not implemented yet.
	return String("[object " + arr.Class() + "]")
}

// NewArray creates a new Array with the specified owner and
// prototype, initialises it as appropriate, and returns a pointer to
// the newly-created object.
func NewArray(owner *Owner, proto Object) *Array {
	var arr = new(Array)
	arr.init(owner, proto)
	arr.f = true
	arr.length = 0
	return arr
}

/********************************************************************/

// asIndex takes a property key (as a string) and checks to see if it
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
