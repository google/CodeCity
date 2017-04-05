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

// Package object defines various types used to represent JavaScript
// values (objects and primitive values).
package object

import (
//	"fmt"
)

// Value represents any JavaScript value (primitive, object, etc.).
type Value interface {
	// Type() returns name of type (as given by the JavaScript typeof
	// operator).
	Type() string

	// IsPrimitive() returns true for primitive data (number, string,
	// boolean, etc.).
	IsPrimitive() bool

	// Parent returns the parent (prototype) object for this object.
	Parent() Value

	// GetProperty returns the current value of the given property or
	// an ErrorMsg if that was not possible.
	GetProperty(name string) (Value, *ErrorMsg)

	// SetProperty sets the given property to the specified value or
	// returns an ErrorMsg if that was not possible.
	SetProperty(name string, value Value) *ErrorMsg

	// propNames returns the list of (own) property names as a slice
	// of strings.
	propNames() []string

	// HasOwnProperty returns true if the specified property name
	// exists on the object itself.
	HasOwnProperty(string) bool

	// PropertyIter returns an iterator which will iterate over the
	// properties of the object.
	//	PropertyIter() *PropertyIter

	// ToBoolean returns true iff the object is truthy.
	ToBoolean() Boolean

	// ToNumber returns the numeric equivalent of the object.
	ToNumber() Number

	// ToString returns a string representation of the object.  This
	// needn't be very informative (most objects will return "[object
	// Object]").  N.B.:
	//
	// - The value returned by this method is used as a property
	// key, in the case of a passing a non-string to a
	// MemberExpression (i.e., in foo[bar], where bar is not a
	// string).  It is therefore important that it do the same thing
	// as other JS interpreters.
	//
	// - The JS .toString() method just wraps this one; note however
	// that for primitives, overriding .toString on a primitive's
	// prototype won't change how numbers are implicitly stringified;
	// they'll still use the value returned by this method.  E.g.:
	//
	//     Number.proto.toString = function() { "42" };
	//     (10).toString();    // => "42"
	//     '' + 10;            // => "10"
	//
	// FIXME: move most of this comment somewhere better
	ToString() String

	// ToPrimitive returns a primitive representing the object (for
	// primitives, this is the object itself; for regular objects this
	// is will be either the result of ToString or of ToNumber.
	ToPrimitive() Value
}

// Object represents typical JavaScript objects with (optional)
// prototype, properties, etc.
type Object struct {
	owner      *Owner
	parent     Value
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

// Parent returns the parent (prototype) object for this object.
func (obj Object) Parent() Value {
	return obj.parent
}

// GetProperty returns the current value of the given property or an
// ErrorMsg if that was not possible.
func (obj Object) GetProperty(name string) (Value, *ErrorMsg) {
	pd, ok := obj.properties[name]
	// FIXME: permissions check for property readability goes here
	if !ok {
		return Undefined{}, nil
	}
	return pd.v, nil
}

// SetProperty sets the given property to the specified value or
// returns an ErrorMsg if that was not possible.
func (obj *Object) SetProperty(name string, value Value) *ErrorMsg {
	pd, ok := obj.properties[name]
	if !ok { // Creating new property
		// FIXME: permissions check for object writability goes here
		obj.properties[name] = property{
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
	pd.v = value
	obj.properties[name] = pd
	return nil
}

func (obj *Object) propNames() []string {
	names := make([]string, len(obj.properties))
	i := 0
	for k := range obj.properties {
		names[i] = k
		i++
	}
	return names
}

// HasOwnProperty returns true if the specified property name exists
// on the object itself.
func (obj *Object) HasOwnProperty(s string) bool {
	_, exists := obj.properties[s]
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

// New creates a new object with the specified owner and parent,
// initialises it as appropriate, and returns a pointer to the
// newly-created object.
func New(owner *Owner, parent Value) *Object {
	var obj = new(Object)
	obj.init(owner, parent)
	obj.f = true
	return obj
}

// init is an internal initialisation routine, called from New and
// also called when constructing other types of objects such as
// Arrays, Owners, etc.
func (obj *Object) init(owner *Owner, parent Value) {
	obj.owner = owner
	obj.parent = parent
	obj.properties = make(map[string]property)
}

// ObjectProto is the default prototype for (plain) JavaScript objects
// (i.e., ones created from object literals and not via
// Object.create(nil)).
var ObjectProto = New(nil, Null{})
