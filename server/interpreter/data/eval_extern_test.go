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

package data_test

import (
	"math"
	"testing"

	. "CodeCity/server/interpreter/data"
	tu "CodeCity/server/interpreter/data/testutil"
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

		// Left shift:
		{Number(10), "<<", Number(2), Number(40)},
		{Number(10), "<<", Number(28), Number(-1610612736)},
		{Number(10), "<<", Number(33), Number(20)},
		{Number(10), "<<", Number(34), Number(40)},

		// Signed right shift:
		{Number(10), ">>", Number(4), Number(0)},
		{Number(10), ">>", Number(33), Number(5)},
		{Number(10), ">>", Number(34), Number(2)},
		{Number(-11), ">>", Number(1), Number(-6)},
		{Number(-11), ">>", Number(2), Number(-3)},

		// Signed right shift:
		{Number(10), ">>>", Number(4), Number(0)},
		{Number(10), ">>>", Number(33), Number(5)},
		{Number(10), ">>>", Number(34), Number(2)},
		{Number(-11), ">>>", Number(0), Number(0xfffffff5)},
		{Number(-11), ">>>", Number(1), Number(0x7ffffffa)},
		{Number(-11), ">>>", Number(2), Number(0x3ffffffd)},
		{Number(4294967338), ">>>", Number(0), Number(42)},

		// Bitwise:
		{Number(0x3), "|", Number(0x5), Number(0x7)},
		{Number(0x3), "^", Number(0x5), Number(0x6)},
		{Number(0x3), "&", Number(0x5), Number(0x1)},

		// Comparisons:
		//
		// (This is mainly about making sure that BinaryOp() is hooked
		// up to arca() correctly; arca() is already tested to make
		// sure details of comparisons are crrect.)
		{Number(1), "<", Number(2), Boolean(true)},
		{Number(2), "<", Number(2), Boolean(false)},
		{Number(3), "<", Number(2), Boolean(false)},

		{Number(1), "<=", Number(2), Boolean(true)},
		{Number(2), "<=", Number(2), Boolean(true)},
		{Number(3), "<=", Number(2), Boolean(false)},

		{Number(1), ">", Number(2), Boolean(false)},
		{Number(2), ">", Number(2), Boolean(false)},
		{Number(3), ">", Number(2), Boolean(true)},

		{Number(1), ">=", Number(2), Boolean(false)},
		{Number(2), ">=", Number(2), Boolean(true)},
		{Number(3), ">=", Number(2), Boolean(true)},

		// (Ditto, aeca().)
		{Number(1), "==", Number(1), Boolean(true)},
		{Number(2), "==", Number(1), Boolean(false)},
		{Number(2), "==", Number(2), Boolean(true)},
		{Number(1), "==", Number(2), Boolean(false)},

		{Number(1), "==", String("1"), Boolean(true)},

		{Number(1), "!=", Number(1), Boolean(false)},
		{Number(2), "!=", Number(1), Boolean(true)},
		{Number(2), "!=", Number(2), Boolean(false)},
		{Number(1), "!=", Number(2), Boolean(true)},

		{Number(1), "!=", String("1"), Boolean(false)},

		// (Ditto, aseca().)
		{Number(1), "===", Number(1), Boolean(true)},
		{Number(2), "===", Number(1), Boolean(false)},
		{Number(2), "===", Number(2), Boolean(true)},
		{Number(1), "===", Number(2), Boolean(false)},

		{Number(1), "===", String("1"), Boolean(false)},

		{Number(1), "!==", Number(1), Boolean(false)},
		{Number(2), "!==", Number(1), Boolean(true)},
		{Number(2), "!==", Number(2), Boolean(false)},
		{Number(1), "!==", Number(2), Boolean(true)},

		{Number(1), "!==", String("1"), Boolean(true)},
	}
	for _, c := range tests {
		v, e := BinaryOp(c.left, c.op, c.right)
		if !tu.Identical(v, c.expected) {
			t.Errorf("%#v %s %#v == %#v (expected %#v)",
				c.left, c.op, c.right, v, c.expected)
		}
		if e != nil {
			t.Errorf("%#v %s %#v returned error: %s", c.left, c.op, c.right, e)
		}
	}
}

func TestBinaryOpIn(t *testing.T) {
	var parent = NewObject(nil, nil)
	var obj = NewObject(nil, parent)

	v, e := BinaryOp(String("foo"), "in", obj)
	if v != Boolean(false) || e != nil {
		t.Errorf("\"foo\" in, %#v == (%#v, %#v) (expected (false, nil))",
			obj, v, e)
	}
	parent.Set("foo", Undefined{})
	v, e = BinaryOp(String("foo"), "in", obj)
	if v != Boolean(true) || e != nil {
		t.Errorf("\"foo\" in, %#v == (%#v, %#v) (expected (true, nil))",
			obj, v, e)
	}
	v, e = BinaryOp(String("length"), "in", NewArray(nil, ArrayProto))
	if v != Boolean(true) || e != nil {
		t.Errorf("\"foo\" in [] == (%#v, %#v) (expected true, nil)", v, e)
	}
	v, e = BinaryOp(String("length"), "in", String("foo"))
	if e == nil || e.Name != "TypeError" {
		t.Errorf("\"length\" in \"foo\" == (%#v, %#v) "+
			"(expected nil, TypeError)", v, e)
	}
}
