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

// The object package defines various types used to represent
// JavaScript values (objects and primitive values).
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

	// Parent() returns the parent (prototype) object for this object.
	Parent() Value

	// GetProperty returns the current value of the given property or
	// an ErrorMsg if that was not possible.
	GetProperty(name string) (Value, *ErrorMsg)

	// SetProperty sets the given property to the specified value or
	// returns an ErrorMsg if that was not possible.
	SetProperty(name string, value Value) *ErrorMsg

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
	ToString() string
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

func (Object) Type() string {
	return "object"
}

func (Object) IsPrimitive() bool {
	return false
}

func (this Object) Parent() Value {
	return this.parent
}

func (this Object) GetProperty(name string) (Value, *ErrorMsg) {
	pd, ok := this.properties[name]
	// FIXME: permissions check for property readability goes here
	if !ok {
		return Undefined{}, nil
	}
	return pd.v, nil
}

func (this *Object) SetProperty(name string, value Value) *ErrorMsg {
	pd, ok := this.properties[name]
	if ok { // Updating existing property
		// FIXME: permissions check for property writeability goes here
		pd.v = value
		this.properties[name] = pd
		return nil
	} else { // Creating new property
		// FIXME: permissions check for object writability goes here
		this.properties[name] = property{
			owner: this.owner, // FIXME: should be caller
			v:     value,
			r:     true,
			e:     true,
			i:     false,
		}
		return nil
	}
}

func (Object) ToString() string {
	return "[object Object]"
}

func New(owner *Owner, parent Value) *Object {
	return &Object{
		owner:      owner,
		parent:     parent,
		properties: make(map[string]property),
		f:          true,
	}
}

// ObjectProto is the default prototype for (plain) JavaScript objects
// (i.e., ones created from object literals and not via
// Object.create(nil)).
var ObjectProto = &Object{
	parent:     Null{},
	properties: make(map[string]property),
}
