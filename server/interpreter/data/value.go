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

// MaxTypeConst is the largest Type value defined in this package.  It
// is part of the public interface so that other packages can define
// additional types that satisfy Value and have a Type() method
// returning distinct Type values LastType + 1, + 2, etc.
const MaxTypeConst Type = OBJECT

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
