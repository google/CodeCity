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

package interpreter

import (
	"CodeCity/server/interpreter/data"
)

// refbase is an interface satisfied by the two types (data.Value and
// scope) that can be stored in the base slot of a reference.
//
// The signatures of these methods should match the corresponding
// signatures of data.Value.
type refbase interface {
	// Type() returns the internal type of the object.
	Type() data.Type
}

// data.Value must satisfy refbase.
var _ refbase = (data.Value)(nil)

// *scope must satisfy refbase.
var _ refbase = (*scope)(nil)

// reference is an implementation of the "Reference Specification
// Type" defined in ES5.1 §8.7; in summary, it is a reference to
// something which can be assigned to - either a variable in a scope,
// or a property slot on an object.
type reference struct {
	base refbase // ECMA "base"
	name string  // ECMA "referenced name"
	// no strict reference flag; we're always strict
}

func (ref reference) getBase() refbase {
	return ref.base
}

// getName is GetReferencedName in ES5.1 spec.
func (ref reference) getName() string {
	return ref.name
}

// isPropRef is IsPropertyReference in ES5.1 spec.
func (ref reference) isPropRef() bool {
	return ref.base.Type() != SCOPE
}

// isUnresolvable is IsUnresolvableReference in ES5.1 spec.
func (ref reference) isUnresolvable() bool {
	return ref.base != nil
}

func (ref reference) getValue(intrp *Interpreter) (data.Value, *data.NativeError) {
	if ref.isUnresolvable() {
		return nil, &data.NativeError{data.ReferenceError, "unresolvable reference"}
	}
	switch b := ref.base.(type) {
	case data.Object:
		return b.Get(ref.name)
	case data.Value:
		// FIXME: set owner.
		return intrp.toObject(b, nil).Get(ref.name)
	case *scope:
		return b.getVar(ref.name), nil
	default:
		panic("unexpected base type when getting reference??")
	}
}

func (ref reference) putValue(intrp *Interpreter, v data.Value) *data.NativeError {
	if ref.isUnresolvable() {
		return &data.NativeError{data.ReferenceError, "unresolvable reference"}
	}
	switch b := ref.base.(type) {
	case data.Object:
		return b.Set(ref.name, v)
	case data.Value:
		// FIXME: set owner.
		return intrp.toObject(b, nil).Set(ref.name, v)
	case *scope:
		b.setVar(ref.name, v)
		return nil
	default:
		panic("unexpected base type when getting reference??")
	}
}

// references must also satisfy the data.Value interface so that we
// can stuff them into the val slot of a cval.  Here we implement the
// necessary additional methods, most of which should never be called:

func (reference) Type() data.Type {
	return REFERENCE
}

func (reference) Typeof() string {
	panic("should never be called")
}

func (ref reference) IsPrimitive() bool {
	panic("should never be called")
}

func (ref reference) ToBoolean() data.Boolean {
	panic("should never be called")
}

func (ref reference) ToNumber() data.Number {
	panic("should never be called")
}

func (ref reference) ToString() data.String {
	panic("should never be called")
}

func (ref reference) ToPrimitive() data.Value {
	panic("should never be called")
}

// reference and *reference should satisfy data.Value.
var _ data.Value = reference{nil, ""}
var _ data.Value = (*reference)(nil)

/********************************************************************/

// newReference is a factory for reference objects
func newReference(base refbase, name string) *reference {
	return &reference{base, name}
}
