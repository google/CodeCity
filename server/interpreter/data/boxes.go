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

import (
	"fmt"
)

/********************************************************************/

// BoxedBoolean is a boxed Boolean.
type BoxedBoolean struct {
	object
	value Boolean
}

// *BoxedBoolean must satisfy Object.
var _ Object = (*BoxedBoolean)(nil)

// ToBoolean has no special behaviour on BoxedBooleans: it returns
// true, as for any other object.

// ToNumber on a BoxedBoolean just returns the same value as on the
// boxed Boolean.
func (bbool *BoxedBoolean) ToNumber() Number {
	return bbool.value.ToNumber()
}

// ToString returns a string representation of the boxed Boolean.
//
// BUG(cpcallen): ToString should call a user-code toString() method
// if present.
func (bbool *BoxedBoolean) ToString() String {
	return bbool.value.ToString()
}

// ToPrimitive returns the contained Boolean on BoxedBoolean objects.
func (bbool *BoxedBoolean) ToPrimitive() Value {
	return bbool.value
}

// NewBoxedBoolean creates a new object with the specified owner and
// prototype, initialises it as appropriate, and returns a pointer to
// the newly-created object.
func NewBoxedBoolean(owner *Owner, proto Object, value Boolean) *BoxedBoolean {
	var bbool = new(BoxedBoolean)
	bbool.init(owner, proto)
	bbool.f = true
	bbool.value = value
	return bbool
}

/********************************************************************/

// BoxedNumber is a boxed Number.
type BoxedNumber struct {
	object
	value Number
}

// *BoxedNumber must satisfy Object.
var _ Object = (*BoxedNumber)(nil)

// ToBoolean has no special behaviour on BoxedNumbers: it returns
// true, as for any other object.

// ToNumber on a BoxedNumber just returns the boxed Number itself.
func (bnum *BoxedNumber) ToNumber() Number {
	return bnum.value
}

// ToString on a BoxedNumber just returns the same value as on the
// boxed Number.
func (bnum *BoxedNumber) ToString() String {
	return bnum.value.ToString()
}

// ToPrimitive returns the contained Number on BoxedNumber objects.
func (bnum *BoxedNumber) ToPrimitive() Value {
	return bnum.value
}

// NewBoxedNumber creates a new object with the specified owner and
// prototype, initialises it as appropriate, and returns a pointer to
// the newly-created object.
func NewBoxedNumber(owner *Owner, proto Object, value Number) *BoxedNumber {
	var bnum = new(BoxedNumber)
	bnum.init(owner, proto)
	bnum.f = true
	bnum.value = value
	return bnum
}

/********************************************************************/

// BoxedString is a boxed String.
type BoxedString struct {
	object
	value String
}

// *BoxedString must satisfy Object.
var _ Object = (*BoxedString)(nil)

// Get on BoxedString implements magic .length and numeric character
// index properties on itself, and delegates any other property
// lookups to its embedded object.
//
// BUG(cpcallen): character indicides not implemented.
func (bstr *BoxedString) Get(key string) (Value, *ErrorMsg) {
	if key == "length" {
		return Number(bstr.value.utf16len()), nil
	}
	return bstr.object.Get(key)
}

// Set on BoxedString will reject attempts to set .length or numeric
// character indicies, and otherwise delegates to the embedded object.
//
// BUG(cpcallen): character indicides not implemented.
func (bstr *BoxedString) Set(key string, value Value) *ErrorMsg {
	if key == "length" {
		return &ErrorMsg{"TypeError",
			fmt.Sprintf("Cannot assign to read only property '%s' of %s",
				key, bstr.ToString())}
	}
	return bstr.object.Set(key, value)
}

// Delete on BoxedString will refuse to delete "length" and numeric
// character indicies, and otherwise defers to the embedded object.
//
// BUG(cpcallen): character indicides not implemented.
func (bstr *BoxedString) Delete(key string) *ErrorMsg {
	if key == "length" {
		return &ErrorMsg{"TypeError",
			fmt.Sprintf("Cannot delete property '%s' of %s",
				key, bstr.ToString())}
	}
	return bstr.object.Delete(key)
}

// OwnPropertyKeys on BoxedString returns the length and numeric
// character indicies plus any properties defined on the embedded
// object.
//
// BUG(cpcallen): character indicides not implemented.
func (bstr *BoxedString) OwnPropertyKeys() []string {
	return append([]string{"length"}, bstr.object.OwnPropertyKeys()...)
}

// HasOwnProperty on BoxedString returns true for "length" and false for all
// other inputs for BoxedStrings.
//
// BUG(cpcallen): character indicides not implemented.
func (bstr *BoxedString) HasOwnProperty(key string) bool {
	if key == "length" {
		return true
	}
	return bstr.object.HasOwnProperty(key)
}

// HasProperty on BoxedString returns true if the specified property
// name exists on the object or its prototype chain.
//
// This must be ~redundantly defined on BoxedString, because the
// inherited definition from the embedded object would call
// bstr.object.HasOwnProperty() instead of bstr.HasOwnProperty() and
// thus not see length etc.
func (bstr *BoxedString) HasProperty(key string) bool {
	return bstr.HasOwnProperty(key) || bstr.Proto().HasProperty(key)
}

// ToBoolean has no special behaviour on BoxedStrings: it returns
// true, as for any other object.

// ToNumber on BoxedString just returns the same value as on the boxed
// String.
func (bstr *BoxedString) ToNumber() Number {
	return bstr.value.ToNumber()
}

// ToString on BoxedString just returns the boxed String itself.
//
// BUG(cpcallen): ToString should call a user-code toString() method
// if present.
func (bstr *BoxedString) ToString() String {
	return bstr.value
}

// ToPrimitive returns the contained String on BoxedString objects.
func (bstr *BoxedString) ToPrimitive() Value {
	return bstr.value
}

// NewBoxedString creates a new object with the specified owner and
// prototype, initialises it as appropriate, and returns a pointer to
// the newly-created object.
func NewBoxedString(owner *Owner, proto Object, value String) *BoxedString {
	var bstr = new(BoxedString)
	bstr.init(owner, proto)
	bstr.f = true
	bstr.value = value
	return bstr
}

/********************************************************************/

// Coerce coerces its first argument into an object.
func Coerce(value Value, owner *Owner, protos *Protos) Object {
	switch v := value.(type) {
	case Object:
		return v
	case Boolean:
		return NewBoxedBoolean(owner, protos.BooleanProto, v)
	case Number:
		return NewBoxedNumber(owner, protos.NumberProto, v)
	case String:
		return NewBoxedString(owner, protos.StringProto, v)
	default:
		panic(fmt.Errorf("Can't coerce a %T to Object", v))
	}
}
