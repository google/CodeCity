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
	"math"
	"strconv"
	"strings"
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
func NewFromRaw(raw string) Value {
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
		// BUG(cpcallen): numeric literals probably not handled
		// completely in accordance with ES5.1 spec; it is implemented
		// using String.ToNumber which may be unduly tolerant and
		// handle certain edge cases differently.
		return String(raw).ToNumber()
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

func (b Boolean) ToBoolean() Boolean {
	return b
}

func (b Boolean) ToNumber() Number {
	if b {
		return 1
	} else {
		return 0
	}
}

func (b Boolean) ToString() String {
	if b {
		return "true"
	} else {
		return "false"
	}
}

func (b Boolean) ToPrimitive() Value {
	return b
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

func (n Number) ToBoolean() Boolean {
	return Boolean(!(float64(n) == 0 || math.IsNaN(float64(n))))
}

func (n Number) ToNumber() Number {
	return n
}

func (n Number) ToString() String {
	switch float64(n) {
	case math.Inf(+1):
		return "Infinity"
	case math.Inf(-1):
		return "-Infinity"
	default:
		return String(fmt.Sprintf("%g", n))
	}
}

func (n Number) ToPrimitive() Value {
	return n
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

func (s String) GetProperty(name string) (Value, *ErrorMsg) {
	if name != "length" {
		return Undefined{}, nil
	}
	return Number(len(utf16.Encode([]rune(string(s))))), nil
}

// SetProperty on String always succeeds but has no effect (even on
// length).
func (String) SetProperty(name string, value Value) *ErrorMsg {
	return nil
}

func (s String) ToBoolean() Boolean {
	return len(string(s)) != 0
}

// BUG(cpcallen): String.ToNumber() is probably not strictly compliant
// with the ES5.1 spec.
func (s String) ToNumber() Number {
	str := strings.TrimSpace(string(s))
	if len(str) == 0 { // Empty string == 0
		return 0
	}
	if len(str) > 2 { // Hex?  (Octal not supported in use strict!)
		pfx := str[0:2]
		if pfx == "0x" || pfx == "0X" {
			n, err := strconv.ParseInt(str[2:], 16, 64)
			if err != nil {
				if err.(*strconv.NumError).Err == strconv.ErrSyntax {
					return Number(math.NaN())
				} else if err.(*strconv.NumError).Err == strconv.ErrRange {
					if n > 0 {
						return Number(math.Inf(+1))
					} else {
						return Number(math.Inf(-1))
					}
				} else {
					panic(err)
				}
			}
			return Number(float64(n))
		}
	}
	n, err := strconv.ParseFloat(str, 64)
	if err != nil {
		// Malformed number?
		if err.(*strconv.NumError).Err == strconv.ErrSyntax {
			return Number(math.NaN())
		} else if err.(*strconv.NumError).Err != strconv.ErrRange {
			panic(err)
		}
	}
	return Number(n)
}

func (s String) ToString() String {
	return s
}

func (s String) ToPrimitive() Value {
	return s
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

func (Null) ToBoolean() Boolean {
	return false
}

func (Null) ToNumber() Number {
	return 0
}

func (Null) ToString() String {
	return "null"
}

func (Null) ToPrimitive() Value {
	return Null{}
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

func (Undefined) ToBoolean() Boolean {
	return false
}

func (Undefined) ToNumber() Number {
	return Number(math.NaN())
}

func (Undefined) ToString() String {
	return "undefined"
}

func (Undefined) ToPrimitive() Value {
	return Undefined{}
}

/********************************************************************/

// BooleanProto is the the (plain) JavaScript object that is the
// prototype for all Boolean primitives.  (It would usually be
// accessed in JavaScript as Boolean.prototype.)
var BooleanProto = New(nil, ObjectProto)

// NumberProto is the the (plain) JavaScript object that is the
// prototype for all Number primitives.  (It would usually be
// accessed in JavaScript as Number.prototype.)
var NumberProto = New(nil, ObjectProto)

// StringProto is the the (plain) JavaScript object that is the
// prototype for all String primitives.  (It would usually be
// accessed in JavaScript as String.prototype.)
var StringProto = New(nil, ObjectProto)
