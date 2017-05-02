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

// eval.go contains helper functions to evaluate operations on
// primitives (and in some cases non-primitives).

package data

import (
	"fmt"
	"math"
	"unicode/utf16"
)

// BinaryOp implements evaluation of (non-assignment) binary
// expressions of the form (foo @ bar), for @ being any ESTree
// BinaryOperator ("==", "!=", "===", "!==", "<", "<=", ">", ">=",
// "<<", ">>", ">>>", "+", "-", "*", "/", "%", "|", "^", "&", "in" or
// "instanceof"
func BinaryOp(left Value, op string, right Value) (Value, *NativeError) {
	switch op {
	case "==":
		return Boolean(aeca(left, right)), nil
	case "!=":
		return Boolean(!aeca(left, right)), nil
	case "===":
		return Boolean(aseca(left, right)), nil
	case "!==":
		return Boolean(!aseca(left, right)), nil
	case "<":
		lt, undef := arca(left, right)
		return Boolean(lt && !undef), nil
	case "<=":
		lt, undef := arca(right, left)
		return Boolean(!lt && !undef), nil
	case ">":
		lt, undef := arca(right, left)
		return Boolean(lt && !undef), nil
	case ">=":
		lt, undef := arca(left, right)
		return Boolean(!lt && !undef), nil
	case "<<":
		return Number(float64(
			int32(float64(left.ToNumber())) <<
				(uint32(float64(right.ToNumber())) & 0x1f))), nil
	case ">>":
		return Number(float64(
			int32(float64(left.ToNumber())) >>
				(uint32(float64(right.ToNumber())) & 0x1f))), nil
	case ">>>":
		return Number(float64(
			uint32(float64(left.ToNumber())) >>
				(uint32(float64(right.ToNumber())) & 0x1f))), nil
	case "+":
		// FIXME: should do a ToPrimitive() on arguments (calling user
		// code) before ToString or ToNumber.
		if left.Type() == STRING || right.Type() == STRING {
			// Concatenate
			return String(left.ToString() + right.ToString()), nil
		}
		// Otherwise sum
		return Number(left.ToNumber() + right.ToNumber()), nil
	case "-":
		return Number(left.ToNumber() - right.ToNumber()), nil
	case "*":
		return Number(left.ToNumber() * right.ToNumber()), nil
	case "/":
		return Number(left.ToNumber() / right.ToNumber()), nil
	case "%":
		return Number(
			math.Mod(float64(left.ToNumber()), float64(right.ToNumber()))), nil
	case "|":
		return Number(float64(int32(float64(left.ToNumber())) |
			int32(float64(right.ToNumber())))), nil
	case "^":
		return Number(float64(int32(float64(left.ToNumber())) ^
			int32(float64(right.ToNumber())))), nil
	case "&":
		return Number(float64(int32(float64(left.ToNumber())) &
			int32(float64(right.ToNumber())))), nil
	case "in":
		obj, isObject := right.(Object)
		if !isObject {
			return nil, &NativeError{TypeError, fmt.Sprintf("Cannot use 'in' operator to search for '%s' in %#v", left.ToString(), right)}
		}
		return Boolean(obj.HasProperty(string(left.ToString()))), nil
	case "instanceof":
		return nil, &NativeError{SyntaxError, "instanceof not implemented"}
	default:
		panic(fmt.Errorf("illegal binary operator %s", op))
	}
}

// arca implements the Abstract Relational Comparison Algorithm (see
// ES5.1 spec, §11.8.5.
//
// x and y are the arguments to be compared.  The spec's
// LeftFirst parameter is not present becaues this implementation does
// not run ToPrimitive (and thus does not run user code in a way that
// could reveal order of evaluation).
//
// If lt returns true then x is less than y according to the ARCA; if
// undef is true then the two are not comparable.
//
// BUG(cpcallen): arca does not do ToPrimitive() as required by spec.
func arca(x, y Value) (lt, undef bool) {
	if x.Type() != STRING || y.Type() != STRING {
		// Not both strings?  Numerical comparison:
		nx := float64(x.ToNumber())
		ny := float64(y.ToNumber())
		if math.IsNaN(nx) || math.IsNaN(ny) {
			return false, true
		}
		return nx < ny, false
	}

	// Both strings?  Lexicographic comparision of UTF-16 code
	// units (not code points)
	sx := utf16.Encode([]rune(string(x.ToString())))
	sy := utf16.Encode([]rune(string(y.ToString())))
	for i := 0; ; i++ {
		if i == len(sx) {
			if i < len(sy) {
				// x is prefix of y
				return true, false
			}
			// x === y
			return false, false
		} else if i == len(sy) {
			// y is prefix of x
			return false, false
		}
		if sx[i] < sy[i] {
			return true, false
		}
		if sx[i] > sy[i] {
			return false, false
		}
	}
	//return false, true
}

// aeca implements the Abstract Equality Comparison Algorithm (see
// ES5.1 spec, §11.9.3.
//
// x and y are the arguments to be compared.
//
// If it returns true then x == y according to the AECA.
//
// BUG(cpcallen): aeca'a ToPrimitive() calls do not result in user
// code being called.
func aeca(x, y Value) bool {
	// Shortcut common case:
	if x == y {
		return true
	}
	switch x := x.(type) {
	case Boolean:
		switch y := y.(type) {
		case Boolean:
			return x == y
		case Number:
			return x.ToNumber() == y
		case String:
			return x.ToNumber() == y.ToNumber()
		case Null:
			return false
		case Undefined:
			return false
		default: // Object, Array, Function, Owner etc.:
			return x.ToNumber() == y.ToPrimitive()
		}
	case Number:
		switch y := y.(type) {
		case Boolean:
			return x == y.ToNumber()
		case Number:
			return x == y
		case String:
			return x == y.ToNumber()
		case Null:
			return false
		case Undefined:
			return false
		default: // Object, Array, Function, Owner etc.:
			return Value(x) == y.ToPrimitive()
		}
	case String:
		switch y := y.(type) {
		case Boolean:
			return x.ToNumber() == y.ToNumber()
		case Number:
			return x.ToNumber() == y
		case String:
			return x == y
		case Null:
			return false
		case Undefined:
			return false
		default: // Object, Array, Function, Owner etc.:
			return Value(x) == y.ToPrimitive()
		}
	case Null:
		switch y.(type) {
		case Null:
			return true
		case Undefined:
			return true
		default:
			return false
		}
	case Undefined:
		switch y.(type) {
		case Null:
			return true
		case Undefined:
			return true
		default:
			return false
		}
	default: // Object, Array, Function, Owner etc.:
		switch y := y.(type) {
		case Boolean:
			return x.ToPrimitive() == y.ToNumber()
		case Number:
			return x.ToPrimitive() == y
		case String:
			return x.ToPrimitive() == y
		case Null:
			return false
		case Undefined:
			return false
		default: // Object, Array, Function, Owner etc.:
			return x == y
		}
	}
}

// aseca implements the Abstract Strict Equality Comparison Algorithm (see
// ES5.1 spec, §11.9.6.
//
// x and y are the arguments to be compared.
//
// If it returns true then x == y according to the AECA.
func aseca(x, y Value) bool {
	return x == y
}
