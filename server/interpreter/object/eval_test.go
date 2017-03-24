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
	var tests = []struct {
		left     Value
		op       string
		right    Value
		expected Value
	}{
		{Number(1), "+", Number(1), Number(2)},
		{String("1"), "+", Number(1), String("11")},
		{Number(1), "+", String("1"), String("11")},
		{String("1"), "-", Number(1), Number(0)},
		{String("5"), "*", String("5"), Number(25)},
		{Number(1), "*", Number(NaN), Number(NaN)},
		{Number(-5), "*", Number(0), Number(math.Copysign(0, -1))},
		{Number(-5), "*", Number(math.Copysign(0, -1)), Number(0)},
		{Number(math.Inf(+1)), "*", Number(NaN), Number(NaN)},
		{Number(math.Inf(+1)), "*", Number(math.Inf(+1)), Number(math.Inf(+1))},
		{Number(math.Inf(+1)), "*", Number(math.Inf(-1)), Number(math.Inf(-1))},
		{Number(math.Inf(-1)), "*", Number(math.Inf(-1)), Number(math.Inf(+1))},
		{Number(math.Inf(-1)), "*", Number(math.Inf(+1)), Number(math.Inf(-1))},
		{Number(35), "/", String("7"), Number(5)},
	}
	for _, c := range tests {
		v := BinaryOp(c.left, c.op, c.right)
		if !tu.Identical(v, c.expected) {
			t.Errorf("%#v %s %#v == %#v (expected %#v)",
				c.left, c.op, c.right, v, c.expected)
		}
	}
}
