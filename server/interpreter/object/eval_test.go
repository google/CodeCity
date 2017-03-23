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
	"math"
	"testing"
)

func TestBinaryOp(t *testing.T) {
	var tests = []struct {
		left     Value
		op       string
		right    Value
		expected Value
	}{
		{Number(1), "+", Number(1), Number(2)},
		{String("1"), "+", Number(1), String("11")},
		{Number(1), "+", String("1"), String("11")},
		{String("5"), "*", String("5"), Number(25)},
	}
	for _, c := range tests {
		if v := BinaryOp(c.left, c.op, c.right); v != c.expected {
			// Wait, did we just fail because NaN != NaN?
			vn, vok := v.(Number)
			exn, exok := c.expected.(Number)
			if !vok || !math.IsNaN(float64(vn)) ||
				!exok || !math.IsNaN(float64(exn)) {
				t.Errorf("%#v %s %#v == %#v (expected %#v)",
					c.left, c.op, c.right, v, c.expected)
			}
		}
	}
}
