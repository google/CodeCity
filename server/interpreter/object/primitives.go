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

import (
	"fmt"
	"strconv"
	"unicode"
	"unicode/utf16"
)

// Booleans, numbers and strings are represented as immediate data -
// i.e., the Value interface data contains the value itself rather
// than a pointer to it, as it would in the case of a plain object.
// (null and undefined are similarly represented with empty structs.)
//
//
// tl;dr: do NOT take the address of a primitive.

// PrimitiveFromRaw takes a raw JavaScript literal (as a string as it appears in
// the source code, and as found in an ast.Literal.Raw property) and
// returns a primitive Value object representing the value of that
// literal.
func PrimitiveFromRaw(raw string) Value {
	if raw == "true" {
		return Boolean(true)
	} else if raw == "false" {
		return Boolean(false)
	} else if raw == "undefined" {
		return Undefined{}
	} else if raw == "null" {
		return Null{}
	} else if raw[0] == '"' {
		s, err := strconv.Unquote(raw)
		if err != nil {
			panic(err)
		}
		return String(s)
	} else if raw[0] == '\'' {
		// BUG(cpcallen): single-quoted string literals not implemented.
		panic(fmt.Errorf("Single-quoted string literals not implemented"))
	} else if unicode.IsDigit(rune(raw[0])) {
		f, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			panic(err)
		}
		return Number(f)
	} else if raw[0] == '/' {
		// BUG(cpcallen): regular expresion literals not implemented.
		panic(fmt.Errorf("Regular Expression literals not implemented"))
	} else {
		panic(fmt.Errorf("Unrecognized raw literal %v", raw))
	}
}

/********************************************************************/

// Boolean represents a JS boolean value.
type Boolean bool

// Boolean must satisfy Value.
var _ Value = Boolean(false)

func (Boolean) Type() string {
	return "boolean"
}

func (Boolean) IsPrimitive() bool {
	return true
}

func (Boolean) Parent() Value {
	return BooleanProto
}

func (Boolean) GetProperty(name string) (Value, *ErrorMsg) {
	return Undefined{}, nil
}

// SetProperty on Boolean always succeeds but has no effect.
func (Boolean) SetProperty(name string, value Value) *ErrorMsg {
	return nil
}

/********************************************************************/

// Number represents a JS numeric value.
type Number float64

// Number must satisfy Value.
var _ Value = Number(0)

func (Number) Type() string {
	return "number"
}

func (Number) IsPrimitive() bool {
	return true
}

func (Number) Parent() Value {
	return NumberProto
}

func (Number) GetProperty(name string) (Value, *ErrorMsg) {
	return Undefined{}, nil
}

// SetProperty on Number always succeeds but has no effect.
func (Number) SetProperty(name string, value Value) *ErrorMsg {
	return nil
}

/********************************************************************/

// String represents a JS string value.
type String string

// String must satisfy Value.
var _ Value = String("")

func (String) Type() string {
	return "string"
}

func (String) IsPrimitive() bool {
	return true
}

func (String) Parent() Value {
	return StringProto
}

func (this String) GetProperty(name string) (Value, *ErrorMsg) {
	if name != "length" {
		return Undefined{}, nil
	}
	return Number(len(utf16.Encode([]rune(string(this))))), nil
}

// SetProperty on String always succeeds but has no effect (even on
// length).
func (String) SetProperty(name string, value Value) *ErrorMsg {
	return nil
}

/********************************************************************/

// Null represents a JS null value.
type Null struct{}

// Null must satisfy Value.
var _ Value = Null{}

func (Null) Type() string {
	return "object"
}

func (Null) IsPrimitive() bool {
	return true
}

func (Null) Parent() Value {
	panic("Cannot get parent (prototype) of null")
}

func (Null) GetProperty(name string) (Value, *ErrorMsg) {
	return nil, &ErrorMsg{
		Name:    "TypeError",
		Message: fmt.Sprintf("Cannot read property '%s' of null", name),
	}
}

// SetProperty on Null always fails.
func (Null) SetProperty(name string, value Value) *ErrorMsg {
	return &ErrorMsg{
		Name:    "TypeError",
		Message: fmt.Sprintf("Cannot set property '%s' of null", name),
	}
}

/********************************************************************/

// Undefined represents a JS undefined value.
type Undefined struct{}

// Undefined must satisfy Value.
var _ Value = Undefined{}

func (Undefined) Type() string {
	return "undefined"
}

func (Undefined) IsPrimitive() bool {
	return true
}

func (Undefined) Parent() Value {
	panic("Cannot get parent (prototype) of undefined")
}

func (Undefined) GetProperty(name string) (Value, *ErrorMsg) {
	return nil, &ErrorMsg{
		Name:    "TypeError",
		Message: fmt.Sprintf("Cannot read property '%s' of undefined", name),
	}
}

// SetProperty on Undefined always fails.
func (Undefined) SetProperty(name string, value Value) *ErrorMsg {
	return &ErrorMsg{
		Name:    "TypeError",
		Message: fmt.Sprintf("Cannot set property '%s' of undefined", name),
	}
}

/********************************************************************/

// BooleanProto, NumberProto, and StringProto are the (plain)
// JavaScript objects that are the prototypes for all primitive
// objects of their respective type (they would usually be accessed in
// JavaScript as Boolean.prototype, Number.prototype, and
// String.prototype respectively.
var BooleanProto = &Object{
	parent:     ObjectProto,
	properties: make(map[string]property),
}

var NumberProto = &Object{
	parent:     ObjectProto,
	properties: make(map[string]property),
}

var StringProto = &Object{
	parent:     ObjectProto,
	properties: make(map[string]property),
}
