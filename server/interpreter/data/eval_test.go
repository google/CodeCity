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
	"math"
	"testing"
)

func TestToInt(t *testing.T) {
	var tests = []struct {
		in  Number
		i32 int32
		u32 uint32
		u16 uint16
	}{
		// Numeric comparisons:
		{Number(0), 0, 0, 0},
		{Number(math.Copysign(0, -1)), 0, 0, 0},
		{Number(1), 1, 1, 1},
		{Number(0.25), 0, 0, 0},
		{Number(0.75), 0, 0, 0},
		{Number(-0.25), 0, 0, 0},
		{Number(-0.75), 0, 0, 0},
		{Number(-1), -1, 0xffffffff, 0xffff},

		{Number(0x7fff), 0x7fff, 0x7fff, 0x7fff},
		{Number(0x8000), 0x8000, 0x8000, 0x8000},
		{Number(0xffff), 0xffff, 0xffff, 0xffff},
		{Number(0x10000), 0x10000, 0x10000, 0},

		{Number(-0x8000), -0x8000, 0xffff8000, 0x8000},
		{Number(-0x8001), -0x8001, 0xffff7fff, 0x7fff},
		{Number(-0xffff), -0xffff, 0xffff0001, 1},
		{Number(-0x10000), -0x10000, 0xffff0000, 0},
		{Number(-0x10001), -0x10001, 0xfffeffff, 0xffff},

		{Number(0x7fffffff), 0x7fffffff, 0x7fffffff, 0xffff},
		{Number(0x80000000), -0x80000000, 0x80000000, 0x0000},
		{Number(0xffffffff), -1, 0xffffffff, 0xffff},
		{Number(0x100000000), 0, 0, 0},

		{Number(-0x80000000), -0x80000000, 0x80000000, 0x0000},
		{Number(-0x80000001), 0x7fffffff, 0x7fffffff, 0xffff},
		{Number(-0xffffffff), 1, 1, 1},
		{Number(-0x100000000), 0, 0, 0},
		{Number(-0x100000001), -1, 0xffffffff, 0xffff},

		{Number(math.NaN()), 0, 0, 0},
		{Number(math.Inf(1)), 0, 0, 0},
		{Number(math.Inf(-1)), 0, 0, 0},
	}
	for _, c := range tests {
		if r := ToInt32(c.in); r != c.i32 {
			t.Errorf("ToInt32(%#v) == %d (expected %d)", c.in, r, c.i32)
		}
		if r := ToUint32(c.in); r != c.u32 {
			t.Errorf("ToUint32(%#v) == %d (expected %d)", c.in, r, c.u32)
		}
		if r := ToUint16(c.in); r != c.u16 {
			t.Errorf("ToUint16(%#v) == %d (expected %d)", c.in, r, c.u16)
		}
	}
}

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

// TestEquality tests both the Abstract (loose) Equality Comparison
// Algorithm (AECA) and the Abstract Strict Equality Comparison
// Algorithm (ASECA); this is done a as a single (table-driven) test
// to help make sure that each case is applied to both.
//
// FIXME: this should include tests for array values, once arrays are
// implemented.
func TestEquality(t *testing.T) {
	var NaN = math.NaN()
	var neg0 = math.Copysign(0, -1)
	var inf = math.Inf(+1)
	var negInf = math.Inf(-1)
	var o1 = NewObject(nil, protos.ObjectProto)
	var o2 = NewObject(nil, protos.ObjectProto)
	var ow = NewOwner(protos.OwnerProto)

	var tests = []struct {
		left     Value
		right    Value
		expAECA  bool
		expASECA bool
	}{
		// Boolean
		{Boolean(false), Boolean(false), true, true},  // Numeric
		{Boolean(false), Boolean(true), false, false}, // Numeric
		{Boolean(true), Boolean(true), true, true},    // Numeric
		{Boolean(true), Boolean(false), false, false}, // Numeric

		// Numeric comparisons:
		{Number(0), Number(NaN), false, false},
		{Number(NaN), Number(NaN), false, false},
		{Number(NaN), Number(0), false, false},

		{Number(1), Number(1), true, true},
		{Number(0), Number(neg0), true, true},
		{Number(neg0), Number(0), true, true},

		{Number(inf), Number(math.MaxFloat64), false, false},
		{Number(math.MaxFloat64), Number(inf), false, false},
		{Number(negInf), Number(-math.MaxFloat64), false, false},
		{Number(-math.MaxFloat64), Number(negInf), false, false},

		{Number(1), Number(2), false, false},
		{Number(2), Number(1), false, false},

		// String comparisons:
		{String(""), String(""), true, true},
		{String(""), String(" "), false, false},
		{String(" "), String(""), false, false},
		{String(" "), String(" "), true, true},
		{String("foo"), String("foobar"), false, false},
		{String("foo"), String("bar"), false, false},
		{String("foobar"), String("foo"), false, false},
		{String("10"), String("9"), false, false},

		// Null / undefined:
		{Undefined{}, Undefined{}, true, true},
		{Undefined{}, Null{}, true, false},
		{Null{}, Null{}, true, true},
		{Null{}, Undefined{}, true, false},

		// Objects:
		{o1, o1, true, true},
		{o1, o2, false, false},
		{o2, o2, true, true},
		{o1, ow, false, false},
		{ow, ow, true, true},

		// Mixed:
		{String("10"), Number(10), true, false},   // Numeric
		{Number(10), String("10"), true, false},   // Numeric
		{String("10"), Number(9), false, false},   // Numeric
		{String("10"), String("9"), false, false}, // String
		{String("10"), String("10"), true, true},  // String

		{Boolean(false), Number(0), true, false},  // Numeric
		{Boolean(false), Number(1), false, false}, // Numeric
		{Boolean(true), Number(1), true, false},   // Numeric
		{Boolean(true), Number(0), false, false},  // Numeric
		{Number(0), Boolean(false), true, false},  // Numeric
		{Number(1), Boolean(false), false, false}, // Numeric
		{Number(1), Boolean(true), true, false},   // Numeric
		{Number(0), Boolean(true), false, false},  // Numeric

		{Null{}, Boolean(false), false, false},
		{Null{}, Number(0), false, false},
		{Null{}, String(""), false, false},
		{Boolean(false), Null{}, false, false},
		{Number(0), Null{}, false, false},
		{String(""), Null{}, false, false},

		{o1, Boolean(false), false, false},
		{o1, Number(0), false, false},
		{o1, String(""), false, false},
		{o1, Null{}, false, false},
		{o1, Undefined{}, false, false},
	}
	for _, c := range tests {
		leq := aeca(c.left, c.right)
		if leq != c.expAECA {
			t.Errorf("aeca(%#v, %#v) == %t", c.left, c.right, leq)
		}
		seq := aseca(c.left, c.right)
		if seq != c.expASECA {
			t.Errorf("aseca(%#v, %#v) == %t", c.left, c.right, seq)
		}
	}
}
