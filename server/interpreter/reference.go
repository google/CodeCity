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

// reference is an implementation of the "Reference Specification
// Type" defined in ES5.1 §8.7; in summary, it is a reference to
// something which can be assigned to - either a variable in a scope,
// or a property slot on an object.
type reference struct {
	base value  // ECMA "base"; is a data.Value or *scope
	name string // ECMA "referenced name"
	// no strict reference flag; we're always strict
}

func (ref reference) getBase() value {
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
	return ref.base == nil
}

// getValue is GetValue in the ES5.1 spec; the *Interpreter parameter
// allows access to Interpreter.toObject() and may be nil if base is
// known not to be a primitive.
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

// putValue is PutValue in the ES5.1 spec; the extra *Interpreter
// parameter allows access to Interpreter.toObject() and may be nil if
// base is known not to be a primitive.
func (ref reference) putValue(v data.Value, intrp *Interpreter) *data.NativeError {
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

func (ref reference) delete(intrp *Interpreter) *data.NativeError {
	if ref.isUnresolvable() {
		return &data.NativeError{data.ReferenceError, "unresolvable reference"}
	}
	switch b := ref.base.(type) {
	case data.Object:
		return b.Delete(ref.name)
	case data.Value:
		// FIXME: set owner.
		return intrp.toObject(b, nil).Delete(ref.name)
	case *scope:
		return &data.NativeError{data.SyntaxError, "Delete of an unqualified identifier in strict mode."}
	default:
		panic("unexpected base type when getting reference??")
	}
}

func (reference) Type() data.Type {
	return REFERENCE
}

// reference must satisfy value
var _ value = reference{nil, ""}

/********************************************************************/

// newReference is a factory for reference objects.
//
// This boring function exists mostly in case we decide to replace the
// reference strcut with a reference interface that has
// base-type-specific getValue and putValue methods - but we also do a
// check to make sure that the caller is not trying to stuff something
// other than a scope or data.Value into the reference.
func newReference(base value, name string) reference {
	switch base.(type) {
	case data.Value: // OK
	case *scope: // OK
	case nil: // Undefined reference, but OK
	default:
		panic("invalid reference base type")
	}
	return reference{base, name}
}
