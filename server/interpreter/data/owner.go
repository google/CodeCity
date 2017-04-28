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

// An Owner is an object that can own other objects and properties.
//
// One of CodeCity's extensions to JavaScript is that the interpreter
// keeps track of who owns each (non-primitive) object and each
// individual property thereon.  When an object or property is created
// it is usually owned by the programmer whose code created it, as
// represented by their Owner object.  (Other Owner objects could also
// represent role accounts, multi-user groups etc.)
//
// To avoid shenanigans, the interpreter enforces the invariant that
// an object's (or property's) owner must be an instance of Owner.
type Owner struct {
	object
	// FIXME: other fields (quota limits etc.) go here.
}

// *Owner must satisfy Object.
var _ Object = (*Owner)(nil)

// ToString always returns "[object Owner]" for Owners.
//
// BUG(cpcallen): this should probably call a user-supplied
// .toString() method if present.
func (Owner) ToString() String {
	return "[object Owner]"
}

// NewOwner returns a new Owner object, owned by itself and having
// parent ObjectProto.
func NewOwner(proto Object) *Owner {
	var o = new(Owner)
	o.init(o, proto)
	o.f = false
	return o
}
