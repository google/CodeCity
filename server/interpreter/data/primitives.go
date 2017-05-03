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

// NewFromRaw takes a raw JavaScript literal (as a string as it
// appears in the source code, and as found in an ast.Literal.Raw
// property) and returns a primitive Value object representing the
// value of that literal.
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
	} else if unicode.IsDigit(rune(raw[0])) || raw[0] == '-' {
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

// Type always returns BOOLEAN for Booleans.
func (Boolean) Type() Type {
	return BOOLEAN
}

// Typeof always returns "boolean" for Booleans.
func (Boolean) Typeof() string {
	return "boolean"
}

// IsPrimitive alwasy returns true for Booleans.
func (Boolean) IsPrimitive() bool {
	return true
}

// ToBoolean on a Boolean just returns itself.
func (b Boolean) ToBoolean() Boolean {
	return b
}

// ToNumber converts a boolean to 1 (if true) or 0 (if false).
func (b Boolean) ToNumber() Number {
	if b {
		return 1
	} else {
		return 0
	}
}

// ToString converts a boolean to "true" or "false" as appropriate.
func (b Boolean) ToString() String {
	if b {
		return "true"
	} else {
		return "false"
	}
}

// ToPrimitive on a primitive just returns itself.
func (b Boolean) ToPrimitive() Value {
	return b
}

/********************************************************************/

// Number represents a JS numeric value.
type Number float64

// Number must satisfy Value.
var _ Value = Number(0)

// Type always returns NUMBER for numbers.
func (Number) Type() Type {
	return NUMBER
}

// Typeof always returns "number" for numbers.
func (Number) Typeof() string {
	return "number"
}

// IsPrimitive alwasy returns true for Numbers.
func (Number) IsPrimitive() bool {
	return true
}

// ToBoolean on a number returns true if the number is not 0 or NaN.
func (n Number) ToBoolean() Boolean {
	return Boolean(!(float64(n) == 0 || math.IsNaN(float64(n))))
}

// ToNumber on a Number just returns itself.
func (n Number) ToNumber() Number {
	return n
}

// ToString on a number returns "Infinity" for +Inf, "-Infinity" for
// -Inf, "NaN" for NaN, and a decimal or exponential representation
// for regular numeric values.
//
// BUG(cpcallen): This implementation may not be strictly compatible
// with the ES5.1 spec, although transtion from decimal to exponential
// representation should be correct.
//
// FIXME: Should we return "-0" for negative zero?  Do we?
func (n Number) ToString() String {
	switch float64(n) {
	case math.Inf(+1):
		return "Infinity"
	case math.Inf(-1):
		return "-Infinity"
	case 0:
		if math.Signbit(float64(n)) {
			return "-0"
		}
		return "0"
	default:
		exp := math.Log10(math.Abs(float64(n)))
		if exp >= 21 || exp < -6 {
			return String(strconv.FormatFloat(float64(n), 'e', -1, 64))
		}
		return String(strconv.FormatFloat(float64(n), 'f', -1, 64))
	}
}

// ToPrimitive on a primitive just returns itself.
func (n Number) ToPrimitive() Value {
	return n
}

/********************************************************************/

// String represents a JS string value.
type String string

// String must satisfy Value.
var _ Value = String("")

// Type always returns "string" for strings.
func (String) Type() Type {
	return STRING
}

// Typeof always returns "string" for strings.
func (String) Typeof() string {
	return "string"
}

// IsPrimitive alwasy returns true for Strings.
func (String) IsPrimitive() bool {
	return true
}

// ToBoolean on String returns true iff the string is non-empty.
func (s String) ToBoolean() Boolean {
	return len(string(s)) != 0
}

// ToNumber returns the numeric value of the string, or NaN if it does
// not look like a number.
//
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

// ToString on a string just returns itself.
func (s String) ToString() String {
	return s
}

// ToPrimitive on a primitive just returns itself.
func (s String) ToPrimitive() Value {
	return s
}

// utf16len returns the length of the string in utf16 code units - the
// standard way of measuring string length in JavaScript.
func (s String) utf16len() int {
	return len(utf16.Encode([]rune(string(s))))
}

/********************************************************************/

// Null represents a JS null value.
type Null struct{}

// Null must satisfy Value.
var _ Value = Null{}

// Type returns NULL for null values.
func (Null) Type() Type {
	return NULL
}

// Typeof (surprisingly) returns "object" for null values.
func (Null) Typeof() string {
	return "object"
}

// IsPrimitive alwasy returns true for Null.
func (Null) IsPrimitive() bool {
	return true
}

// ToBoolean on Null always return false.
func (Null) ToBoolean() Boolean {
	return false
}

// ToNumber on Null always returns 0.
func (Null) ToNumber() Number {
	return 0
}

// ToString on Null always returns "null".
func (Null) ToString() String {
	return "null"
}

// ToPrimitive on a primitive just returns itself.
func (Null) ToPrimitive() Value {
	return Null{}
}

/********************************************************************/

// Undefined represents a JS undefined value.
type Undefined struct{}

// Undefined must satisfy Value.
var _ Value = Undefined{}

// Type always returns UNDEFINED for undefined.
func (Undefined) Type() Type {
	return UNDEFINED
}

// Typeof always returns "undefined" for undefined.
func (Undefined) Typeof() string {
	return "undefined"
}

// IsPrimitive always returns true for Undefined.
func (Undefined) IsPrimitive() bool {
	return true
}

// ToBoolean on Undefined always returns false.
func (Undefined) ToBoolean() Boolean {
	return false
}

// ToNumber on Undefined always returns NaN.
func (Undefined) ToNumber() Number {
	return Number(math.NaN())
}

// ToString on Undefined always returns "undefined".
func (Undefined) ToString() String {
	return "undefined"
}

// ToPrimitive on a primitive just returns itself.
func (Undefined) ToPrimitive() Value {
	return Undefined{}
}
