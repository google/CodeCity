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

// Class always returns "Owner" for Owners.
func (Owner) Class() string {
	return "Owner"
}

// ToString is repeated here to catch the changed definition of Class.
//
// BUG(cpcallen): as with object.ToString, owner.ToString should call
// a user-code toString() method if present.
func (owner Owner) ToString() String {
	return String("[object " + owner.Class() + "]")
}

// NewOwner returns a new Owner object, owned by itself and having
// the specified prototype.
func NewOwner(proto Object) *Owner {
	var owner = new(Owner)
	owner.init(owner, proto)
	owner.f = false
	return owner
}
