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

package testutil

import (
	"fmt"
	"math"

	"CodeCity/server/interpreter/object"
)

// Identical returns true iff the two JS values are identical:
//
// - Objects must be the same object (i.e., pointer equality)
//
// - Numbers are numerically identical (as if NaN == NaN, but +0 != -0.)
//
// - Strings and booleans equal using ==.
func Identical(x, y object.Value) bool {
	switch xx := x.(type) {
	case object.Boolean:
		// Are the two booleans equal?
		yy, ok := y.(object.Boolean)
		return ok && xx == yy
	case object.Number:
		// Are the two numbers identical (not just numerically equal)?
		yy, ok := y.(object.Number)
		if !ok {
			return false
		}
		xf := float64(xx)
		yf := float64(yy)
		if math.IsNaN(xf) && math.IsNaN(yf) {
			return true
		}
		if xf != yf {
			return false
		}
		if xf == 0 && yf == 0 {
			return math.Signbit(xf) == math.Signbit(yf)
		}
		if xf == yf {
			return true
		}
		panic(fmt.Errorf("Can't decide if %#v == %#v", xf, yf))
	case object.String:
		// Are the two strings equal?
		yy, ok := y.(object.String)
		return ok && xx == yy
	case *object.Object:
		// Is it a pointer to the same object?
		yy, ok := y.(*object.Object)
		return ok && xx == yy
	case nil:
		return y == nil
	default:
		panic(fmt.Errorf("Don't know how to compare %#v and %#v", x, y))
	}
}
