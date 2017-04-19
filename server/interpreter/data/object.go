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

// Object represents typical JavaScript objects with (optional)
// prototype, properties, etc.
type Object struct {
	owner      *Owner
	proto      Value
	properties map[string]property
	f          bool
}

// property is a property descriptor, with the following fields:
// owner: Who owns the property (has permission to write it)?
// v:     The actual value of the property.
// r:     Is the property world-readable?
// e:     Is the property enumerable
// i:     Is the property ownership inherited on children?
type property struct {
	owner *Owner
	v     Value
	r     bool
	e     bool
	i     bool
}

// *Object must satisfy Value.
var _ Value = (*Object)(nil)

// Type always returns "object" for regular Objects.
func (Object) Type() string {
	return "object"
}

// IsPrimitive always returns false for regular Objects.
func (Object) IsPrimitive() bool {
	return false
}

// Proto returns the prototype (parent) object for this object.
func (obj Object) Proto() Value {
	return obj.proto
}

// Get returns the current value of the given property or an ErrorMsg
// if that was not possible.
func (obj Object) Get(key string) (Value, *ErrorMsg) {
	pd, ok := obj.properties[key]
	// FIXME: permissions check for property readability goes here
	if ok {
		return pd.v, nil
	}
	// Try the prototype?
	proto := obj.Proto()
	if proto != nil {
		return proto.Get(key)
	}
	return Undefined{}, nil

}

// Set sets the given property to the specified value or returns an
// ErrorMsg if that was not possible.
func (obj *Object) Set(key string, value Value) *ErrorMsg {
	pd, ok := obj.properties[key]
	if !ok { // Creating new property
		// FIXME: permissions check for object writability goes here
		obj.properties[key] = property{
			owner: obj.owner, // FIXME: should be caller
			v:     value,
			r:     true,
			e:     true,
			i:     false,
		}
		return nil
	}
	// Updating existing property
	// FIXME: permissions check for property writeability goes here
	// FIXME: recurse if necessary
	pd.v = value
	obj.properties[key] = pd
	return nil
}

// OwnPropertyKeys returns the list of (own) property keys as a slice
// of strings.
func (obj *Object) OwnPropertyKeys() []string {
	keys := make([]string, len(obj.properties))
	i := 0
	for k := range obj.properties {
		keys[i] = k
		i++
	}
	return keys
}

// Delete removes the named property if possible.
//
// FIXME: perm / immutability checks!
func (obj *Object) Delete(key string) *ErrorMsg {
	delete(obj.properties, key)
	return nil
}

// HasOwnProperty returns true if the specified property key exists
// on the object itself.
func (obj *Object) HasOwnProperty(key string) bool {
	_, exists := obj.properties[key]
	return exists
}

// ToBoolean always returns true for regular Objects.
func (Object) ToBoolean() Boolean {
	return true
}

// ToNumber returns the numeric equivalent of the object.
//
// BUG(cpcallen): Object.ToNumber is not strictly compliant with
// ES5.1 spec; it just returns .ToString().ToNumber().
func (obj Object) ToNumber() Number {
	return obj.ToString().ToNumber()
}

// ToString returns a string representation of the object.  By default
// this is "[object Object]" for plain objects.
//
// BUG(cpcallen): Object.ToString should call a user-code toString()
// method if present.
func (Object) ToString() String {
	return "[object Object]"
}

// ToPrimitive defaults to ToNumber on objects.
//
// BUG(cpcallen): Object.ToPrimitive should prefer to return the result
// of ToString() on date objects.
func (obj *Object) ToPrimitive() Value {
	return obj.ToNumber()
}

// NewObject creates a new object with the specified owner and prototype,
// initialises it as appropriate, and returns a pointer to the
// newly-created object.
func NewObject(owner *Owner, proto Value) *Object {
	var obj = new(Object)
	obj.init(owner, proto)
	obj.f = true
	return obj
}

// init is an internal initialisation routine, called from New and
// also called when constructing other types of objects such as
// Arrays, Owners, etc.
func (obj *Object) init(owner *Owner, proto Value) {
	obj.owner = owner
	obj.proto = proto
	obj.properties = make(map[string]property)
}

// ObjectProto is the default prototype for (plain) JavaScript objects
// (i.e., ones created from object literals and not via
// Object.create(nil)).
var ObjectProto = NewObject(nil, Null{})
