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

func TestARCA(t *testing.T) {
	var NaN = math.NaN()
	var neg0 = math.Copysign(0, -1)
	var inf = math.Inf(+1)
	var negInf = math.Inf(-1)
	var tests = []struct {
		left     Value
		right    Value
		expLT    bool
		expUndef bool
	}{
		// Numeric comparisons:
		{Number(0), Number(NaN), false, true},
		{Number(NaN), Number(NaN), false, true},
		{Number(NaN), Number(0), false, true},

		{Number(1), Number(1), false, false},
		{Number(0), Number(neg0), false, false},
		{Number(neg0), Number(0), false, false},

		{Number(inf), Number(math.MaxFloat64), false, false},
		{Number(math.MaxFloat64), Number(inf), true, false},
		{Number(negInf), Number(-math.MaxFloat64), true, false},
		{Number(-math.MaxFloat64), Number(negInf), false, false},

		{Number(1), Number(2), true, false},
		{Number(2), Number(1), false, false},

		// String comparisons:
		{String(""), String(""), false, false},
		{String(""), String(" "), true, false},
		{String(" "), String(""), false, false},
		{String(" "), String(" "), false, false},
		{String("foo"), String("foobar"), true, false},
		{String("foo"), String("bar"), false, false},
		{String("foobar"), String("foo"), false, false},
		{String("10"), String("9"), true, false},
		{String("10"), Number(9), false, false},

		// \ufb00 vs. \U0001f019: this test fails if we do simple
		// lexicographic comparison of UTF-8 or UTF-32.  The latter
		// character is a larger code point and sorts later in UTF8,
		// but in UTF16 it gets replaced by two surrogates, both of
		// which are smaller than \uf000.
		{String("ﬀ"), String("🀙"), false, false},

		// Mixed:
		{Number(11), String("2"), false, false},  // Numeric
		{Number(2), String("11"), true, false},   // Numeric
		{String("11"), String("2"), true, false}, // String
	}
	for _, c := range tests {
		lt, undef := arca(c.left, c.right)
		if lt != c.expLT || undef != c.expUndef {
			t.Errorf("arca(%#v, %#v) == %t %t (expected %t %t)",
				c.left, c.right, lt, undef, c.expLT, c.expUndef)
		}
	}
}
