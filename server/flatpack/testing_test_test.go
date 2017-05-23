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

package flatpack

import (
	"math"
	"testing"
)

// Types used by recEqual tests:

type Basic struct {
	x int
	y float32
}

type NotBasic Basic

type Loop *Loop
type Loopy interface{}

type cons struct{ car, cdr interface{} }

// self is a special type that signals that the other agument should
// be compared against itself.
type self struct{}

// Simple functions for DeepEqual tests.
var (
	fn1 func()             // nil.
	fn2 func()             // nil.
	fn3 = func() { fn1() } // Not nil.
)

var loop1, loop2, loop3, loop4, loop5, loop6 Loop
var loopy1, loopy2, loopy3, loopy4, loopy5, loopy6 Loopy
var cons1, cons2, cons3 cons

func init() {
	loop1 = &loop2
	loop2 = &loop1

	loop3 = &loop4
	loop4 = &loop3

	loop5 = &loop5
	loop6 = &loop5

	loopy1 = &loopy2
	loopy2 = &loopy1

	loopy3 = &loopy4
	loopy4 = &loopy3

	loopy5 = &loopy5
	loopy6 = &loopy5

	cons1 = cons{"foo", "bar"}
	cons2 = cons{"foo", "bar"}
	cons3 = cons{"foo", "bar"}
}

type recEqualTest struct {
	a, b   interface{}
	eq     bool
	disjEq bool
}

var recEqualTests = []recEqualTest{
	// Equalities:
	{nil, nil, true, true},
	{1, 1, true, true},
	{int32(1), int32(1), true, true},
	{0.5, 0.5, true, true},
	{float32(0.5), float32(0.5), true, true},
	{"hello", "hello", true, true},
	{make([]int, 10), make([]int, 10), true, true},
	{&[3]int{1, 2, 3}, &[3]int{1, 2, 3}, true, true},
	{Basic{1, 0.5}, Basic{1, 0.5}, true, true},
	{error(nil), error(nil), true, true},
	{map[int]string{1: "one", 2: "two"}, map[int]string{2: "two", 1: "one"}, true, true},
	{fn1, fn2, true, true},
	{[][]int{{1}}, [][]int{{1}}, true, true},
	{&[1]float64{math.NaN()}, &[1]float64{math.NaN()}, true, true},
	{[]float64{math.NaN()}, []float64{math.NaN()}, true, true},
	{math.NaN(), math.NaN(), true, true},

	// Equal, but not disjoint:
	{make([]int, 10), self{}, true, false},
	{&[1]float64{math.NaN()}, self{}, true, false},
	{[]float64{math.NaN()}, self{}, true, false},
	{map[float64]float64{1: math.NaN()}, self{}, true, false},

	// Inequalities:
	{1, 2, false, false},
	{int32(1), int32(2), false, false},
	{0.5, 0.6, false, false},
	{float32(0.5), float32(0.6), false, false},
	{"hello", "hey", false, false},
	{make([]int, 10), make([]int, 11), false, false},
	{&[3]int{1, 2, 3}, &[3]int{1, 2, 4}, false, false},
	{Basic{1, 0.5}, Basic{1, 0.6}, false, false},
	{Basic{1, 0}, Basic{2, 0}, false, false},
	{map[int]string{1: "one", 3: "two"}, map[int]string{2: "two", 1: "one"}, false, false},
	{map[int]string{1: "one", 2: "txo"}, map[int]string{2: "two", 1: "one"}, false, false},
	{map[int]string{1: "one"}, map[int]string{2: "two", 1: "one"}, false, false},
	{map[int]string{2: "two", 1: "one"}, map[int]string{1: "one"}, false, false},
	{nil, 1, false, false},
	{1, nil, false, false},
	{fn1, fn3, false, false},
	{fn3, fn3, true, true},
	{[][]int{{1}}, [][]int{{2}}, false, false},
	{map[float64]float64{math.NaN(): 1}, map[float64]float64{1: 2}, false, false},

	// Nil vs empty: not the same:
	{[]int{}, []int(nil), false, false},
	{[]int{}, []int{}, true, true},
	{[]int(nil), []int(nil), true, true},
	{map[int]int{}, map[int]int(nil), false, false},
	{map[int]int{}, map[int]int{}, true, true},
	{map[int]int(nil), map[int]int(nil), true, true},

	// Mismatched types:
	{1, 1.0, false, false},
	{int32(1), int64(1), false, false},
	{0.5, "hello", false, false},
	{[]int{1, 2, 3}, [3]int{1, 2, 3}, false, false},
	{&[3]interface{}{1, 2, 4}, &[3]interface{}{1, 2, "s"}, false, false},
	{Basic{1, 0.5}, NotBasic{1, 0.5}, false, false},
	{map[uint]string{1: "one", 2: "two"}, map[int]string{2: "two", 1: "one"}, false, false},

	// Loops:
	{&loop1, self{}, true, false},
	{&loop1, &loop2, true, false},
	{&loop1, &loop3, true, true},
	{&loop1, &loop5, false, false},

	{&loopy1, self{}, true, false},
	{&loopy1, &loopy2, true, false},
	{&loopy1, &loopy3, true, true},
	{&loopy1, &loopy5, false, false},

	// M(ism)atched structure:
	{cons{&cons1, &cons2}, self{}, true, false},
	{cons{&cons1, &cons2}, cons{&cons3, &cons3}, false, false},
	{&loop1, &loop6, false, false},
	{&loop5, &loop6, false, false},
	{&loopy1, &loopy6, false, false},
	{&loopy5, &loopy6, false, false},
}

func TestRecEqual(t *testing.T) {
	for _, test := range recEqualTests {
		if test.b == (self{}) {
			test.b = test.a
		}
		if r := recEqual(test.a, test.b, false); r != test.eq {
			t.Errorf("recEqual(%#v, %#v, false) = %v, want %v", test.a, test.b, r, test.eq)
		}
		if r := recEqual(test.a, test.b, true); r != test.disjEq {
			t.Errorf("recEqual(%#v, %#v, true) = %v, want %v", test.a, test.b, r, test.disjEq)
		}
	}
}
