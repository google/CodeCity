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

package object_test

import (
	"math"
	"testing"

	. "CodeCity/server/interpreter/object"
	tu "CodeCity/server/interpreter/object/testutil"
)

func TestBinaryOp(t *testing.T) {
	var NaN = math.NaN()
	var neg0 = math.Copysign(0, -1)
	var inf = math.Inf(+1)
	var negInf = math.Inf(-1)
	var tests = []struct {
		left     Value
		op       string
		right    Value
		expected Value
	}{
		// Addition / concatenation:
		{Number(1), "+", Number(1), Number(2)},
		{String("1"), "+", Number(1), String("11")},
		{Number(1), "+", String("1"), String("11")},

		// Subtraction:
		{String("1"), "-", Number(1), Number(0)},

		// Multiplication:
		{String("5"), "*", String("5"), Number(25)},

		{Number(-5), "*", Number(0), Number(neg0)},
		{Number(-5), "*", Number(neg0), Number(0)},

		{Number(1), "*", Number(NaN), Number(NaN)},
		{Number(inf), "*", Number(NaN), Number(NaN)},
		{Number(negInf), "*", Number(NaN), Number(NaN)},

		{Number(inf), "*", Number(inf), Number(inf)},
		{Number(inf), "*", Number(negInf), Number(negInf)},
		{Number(negInf), "*", Number(negInf), Number(inf)},
		{Number(negInf), "*", Number(inf), Number(negInf)},
		// FIXME: add overflow/underflow cases

		// Division:
		{Number(35), "/", String("7"), Number(5)},

		{Number(1), "/", Number(1), Number(1)},
		{Number(1), "/", Number(-1), Number(-1)},
		{Number(-1), "/", Number(-1), Number(1)},
		{Number(-1), "/", Number(1), Number(-1)},

		{Number(1), "/", Number(NaN), Number(NaN)},
		{Number(NaN), "/", Number(NaN), Number(NaN)},
		{Number(NaN), "/", Number(1), Number(NaN)},

		{Number(inf), "/", Number(inf), Number(NaN)},
		{Number(inf), "/", Number(negInf), Number(NaN)},
		{Number(negInf), "/", Number(negInf), Number(NaN)},
		{Number(negInf), "/", Number(inf), Number(NaN)},

		{Number(inf), "/", Number(0), Number(inf)},
		{Number(inf), "/", Number(neg0), Number(negInf)},
		{Number(negInf), "/", Number(neg0), Number(inf)},
		{Number(negInf), "/", Number(0), Number(negInf)},

		{Number(inf), "/", Number(1), Number(inf)},
		{Number(inf), "/", Number(-1), Number(negInf)},
		{Number(negInf), "/", Number(-1), Number(inf)},
		{Number(negInf), "/", Number(1), Number(negInf)},

		{Number(1), "/", Number(inf), Number(0)},
		{Number(1), "/", Number(negInf), Number(neg0)},
		{Number(-1), "/", Number(negInf), Number(0)},
		{Number(-1), "/", Number(inf), Number(neg0)},

		{Number(0), "/", Number(0), Number(NaN)},
		{Number(0), "/", Number(neg0), Number(NaN)},
		{Number(neg0), "/", Number(neg0), Number(NaN)},
		{Number(neg0), "/", Number(0), Number(NaN)},

		{Number(1), "/", Number(0), Number(inf)},
		{Number(1), "/", Number(neg0), Number(negInf)},
		{Number(-1), "/", Number(neg0), Number(inf)},
		{Number(-1), "/", Number(0), Number(negInf)},
		// FIXME: add overflow/underflow cases

		// Remainder:
		{Number(20), "%", Number(5.5), Number(3.5)},
		{Number(20), "%", Number(-5.5), Number(3.5)},
		{Number(-20), "%", Number(-5.5), Number(-3.5)},
		{Number(-20), "%", Number(5.5), Number(-3.5)},

		{Number(1), "%", Number(NaN), Number(NaN)},
		{Number(NaN), "%", Number(NaN), Number(NaN)},
		{Number(NaN), "%", Number(1), Number(NaN)},

		{Number(inf), "%", Number(1), Number(NaN)},
		{Number(negInf), "%", Number(1), Number(NaN)},
		{Number(1), "%", Number(0), Number(NaN)},
		{Number(1), "%", Number(neg0), Number(NaN)},
		{Number(inf), "%", Number(0), Number(NaN)},
		{Number(inf), "%", Number(neg0), Number(NaN)},
		{Number(negInf), "%", Number(neg0), Number(NaN)},
		{Number(negInf), "%", Number(0), Number(NaN)},

		{Number(0), "%", Number(1), Number(0)},
		{Number(neg0), "%", Number(1), Number(neg0)},
		// FIXME: add overflow/underflow cases
	}
	for _, c := range tests {
		v := BinaryOp(c.left, c.op, c.right)
		if !tu.Identical(v, c.expected) {
			t.Errorf("%#v %s %#v == %#v (expected %#v)",
				c.left, c.op, c.right, v, c.expected)
		}
	}
}
