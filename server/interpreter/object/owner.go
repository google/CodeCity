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

// An Owner is an object that can own other objects and properties.
type Owner struct {
	Object
	// FIXME: other fields go here.
}

// *Owner must satisfy Value.
var _ Value = (*Owner)(nil)

// ToString always returns "[object Owner]" for Owners.
//
// BUG(cpcallen): this should probably call a user-supplied
// .toString() method if present.
func (Owner) ToString() String {
	return "[object Owner]"
}

// NewOwner returns a new Owner object, owned by itself and having
// parent ObjectProto.
func NewOwner() *Owner {
	var o = new(Owner)
	o.init(o, OwnerProto)
	return o
}

// OwnerProto is the the (plain) JavaScript object that is the
// prototype for all Owner objects.  (It has no direct equivalent in
// JavaScript, but if it did it would be Owner.prototype.)
var OwnerProto = New(nil, ObjectProto)
