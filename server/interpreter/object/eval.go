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

func Add(left, right Value) Value {
	if left.Type() == "string" || right.Type() == "string" {
		// Concatenate
		return String(left.ToString() + right.ToString())
	} else {
		// Sum
		return Number(left.ToNumber() + right.ToNumber())
	}
}

func Subtract(left, right Value) Value {
	return Number(left.ToNumber() - right.ToNumber())

}

func Multiply(left, right Value) Value {
	return Number(left.ToNumber() * right.ToNumber())
}

func Divide(left, right Value) Value {
	// FIXME: check edge cases - NaN, Infinity, etc.
	return Number(left.ToNumber() / right.ToNumber())
}
