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

// Package data defines various types used to represent JavaScript
// values (objects and primitive values).  The principle ones (that
// represent user-visible JS values, as opposed to internal data like
// property descriptors) all conform to the Value interface.
package data

// Type is an enum identifying the formal type of a value, per §8 of
// the ES5.1 spec.  Note that OBJECT identifies *any* object type
// (including Arrays, Functions, closures, Owners, Regexps, etc.)
type Type int

// These constants define the valid values of a Type variable.
const (
	UNDEFINED Type = iota
	NULL
	BOOLEAN
	STRING
	NUMBER
	OBJECT
)

// Value represents any JavaScript value (primitive, object, etc.).
type Value interface {
	// Type() returns the internal type of the object.
	Type() Type

	// Typeof() returns name of the type of the value (as given by the
	// JavaScript typeof operator).
	Typeof() string

	// IsPrimitive() returns true for primitive data (number, string,
	// boolean, etc.).
	IsPrimitive() bool

	// Proto returns the prototype (parent) object for this object.
	// N.B. this is object.__proto__, not Constructor.prototype!
	Proto() Value

	// Get returns the current value of the given property or an
	// ErrorMsg if that was not possible.
	Get(name string) (Value, *ErrorMsg)

	// Set sets the given property to the specified value or returns
	// an ErrorMsg if that was not possible.
	Set(name string, value Value) *ErrorMsg

	// Delete attempts to remove the named property.  If the property
	// exists but can't be removed for some reason an ErrorMsg is
	// returned.  (Removing a non-existing property "succeeds"
	// silently.)
	Delete(name string) *ErrorMsg

	// OwnPropertyKeys returns the list of (own) property names as a
	// slice of strings.
	OwnPropertyKeys() []string

	// HasOwnProperty returns true if the specified property name
	// exists on the object itself.
	HasOwnProperty(string) bool

	// HasProperty returns true if the specified property name
	// exists on the object or its prototype chain.
	HasProperty(string) bool

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
