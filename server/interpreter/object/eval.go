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

package object

import (
	"fmt"
	"math"
)

func BinaryOp(left Value, op string, right Value) Value {
	// FIXME: implement other operators
	switch op {
	case "==":
		panic("not implemented")
	case "!=":
		panic("not implemented")
	case "===":
		panic("not implemented")
	case "!==":
		panic("not implemented")
	case "<":
		panic("not implemented")
	case "<=":
		panic("not implemented")
	case ">":
		panic("not implemented")
	case ">=":
		panic("not implemented")
	case "<<":
		return Number(float64(
			int32(float64(left.ToNumber())) <<
				(uint32(float64(right.ToNumber())) & 0x1f)))
	case ">>":
		return Number(float64(
			int32(float64(left.ToNumber())) >>
				(uint32(float64(right.ToNumber())) & 0x1f)))
	case ">>>":
		return Number(float64(
			uint32(float64(left.ToNumber())) >>
				(uint32(float64(right.ToNumber())) & 0x1f)))
	case "+":
		// FIXME: should do a ToPrimitive() on arguments (calling user
		// code) before ToString or ToNumber.
		if left.Type() == "string" || right.Type() == "string" {
			// Concatenate
			return String(left.ToString() + right.ToString())
		} else {
			// Sum
			return Number(left.ToNumber() + right.ToNumber())
		}
	case "-":
		return Number(left.ToNumber() - right.ToNumber())
	case "*":
		return Number(left.ToNumber() * right.ToNumber())
	case "/":
		return Number(left.ToNumber() / right.ToNumber())
	case "%":
		return Number(
			math.Mod(float64(left.ToNumber()), float64(right.ToNumber())))
	case "|":
		panic("not implemented")
	case "^":
		panic("not implemented")
	case "&":
		panic("not implemented")
	case "in":
		panic("not implemented")
	case "instanceof":
		panic("not implemented")
	default:
		panic(fmt.Errorf("illegal binary operator %s", op))
	}
}
