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

// An Array is an object with a magic .length property and some other
// minor special features.
type Array struct {
	Object
	length uint32
}

// *Array must satisfy Value.
var _ Value = (*Array)(nil)

// GetProperty on Array implements a magic .length property itself,
// and passes any other property lookups to its embedded Object:
func (arr Array) GetProperty(name string) (Value, *ErrorMsg) {
	if name != "length" {
		return arr.Object.GetProperty(name)
	}
	return Number(float64(arr.length)), nil
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
