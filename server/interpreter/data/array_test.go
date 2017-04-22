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
	"fmt"
	"math"
	"testing"
)

func TestAsIndex(t *testing.T) {
	var tests = []struct {
		in  string
		out uint32
		ok  bool
	}{
		{"0", 0, true},
		{"1", 1, true},
		{fmt.Sprintf("%d", math.MaxUint32-1), math.MaxUint32 - 1, true},
		{fmt.Sprintf("%d", math.MaxUint32), 0, false},
		{fmt.Sprintf("%d", math.MaxUint32+1), 0, false},
		{"4.5", 0, false},
		{"-1", 0, false},
	}
	for _, c := range tests {
		out, ok := asIndex(c.in)
		if out != c.out || ok != c.ok {
			t.Errorf("asIndex(%#v) == (%d, %t) (expected (%d %t))",
				c.in, out, ok, c.out, c.ok)
		}
	}
}

func TestAsLength(t *testing.T) {
	var tests = []struct {
		in  Value
		out uint32
		ok  bool
	}{
		{Boolean(false), 0, true},
		{Boolean(true), 1, true},

		{Number(0), 0, true},
		{Number(1), 1, true},
		{Number(math.MaxUint32 - 1), math.MaxUint32 - 1, true},
		{Number(math.MaxUint32), math.MaxUint32, true},
		{Number(math.MaxUint32 + 1), 0, false},
		{Number(4.5), 0, false},

		{String("-1"), 0, false},
		{String("0"), 0, true},
		{String("1"), 1, true},
		{String(fmt.Sprintf("%d", math.MaxUint32-1)), math.MaxUint32 - 1, true},
		{String(fmt.Sprintf("%d", math.MaxUint32)), math.MaxUint32, true},
		{String(fmt.Sprintf("%d", math.MaxUint32+1)), 0, false},
		{String("4.5"), 0, false},
		{String("-1"), 0, false},

		{Null{}, 0, true},
		{Undefined{}, 0, false},
		{NewObject(nil, protos.ObjectProto), 0, false},
	}
	for _, c := range tests {
		out, ok := asLength(c.in)
		if out != c.out || ok != c.ok {
			t.Errorf("asLength(%#v) == (%d, %t) (expected (%d %t))",
				c.in, out, ok, c.out, c.ok)
		}
	}
}

func TestArray(t *testing.T) {
	a := NewArray(nil, protos.ArrayProto)
	if !a.HasOwnProperty("length") {
		t.Errorf("%v.HasOwnProperty(\"length\") == false", a)
	}
	if !a.HasProperty("length") {
		t.Errorf("%v.HasProperty(\"length\") == false", a)
	}
	if props := a.OwnPropertyKeys(); len(props) != 1 || props[0] != "length" {
		t.Errorf("%v.OwnPropertyKeys == %#v (expected [\"length\"])", a, props)
	}
	if a.Delete("length") == nil {
		t.Error("delete([].length) failed to report error")
	}
	if a.Proto() != Value(protos.ArrayProto) {
		t.Errorf("%v.Proto() != ArrayProto", a)
	}
	if a.Proto().Proto() != Value(protos.ObjectProto) {
		t.Errorf("%v.Proto().Proto() != ObjectProto", a)
	}
}

func TestArrayLength(t *testing.T) {
	a := NewArray(nil, protos.ArrayProto)

	set := func(n int64, v Value) {
		err := a.Set(fmt.Sprintf("%d", n), v)
		if err != nil {
			t.Error(err)
		}
	}
	checkLen := func(expected int64) {
		l, err := a.Get("length")
		if err != nil {
			t.Error(err)
		} else if l != Number(float64(expected)) {
			t.Errorf("%v.length == %#v (expected %d)", a, l, expected)
		}
	}

	// Empty array has length == 0
	checkLen(0)

	// Adding non-numeric properties does not increase length:
	err := a.Set("zero", Number(0))
	if err != nil {
		t.Error(err)
	}
	checkLen(0)

	// Adding numeric properties >= length does increase length:
	var i int64
	for i = 0; i < 5; i++ {
		set(i, String("dummy"))
		checkLen(i + 1)
	}

	// .length works propery even for large, sparse arrays, and even
	// if values are undefined:
	for i = 3; i <= 31; i++ {
		set((1<<uint(i))-1, Undefined{})
		checkLen(1 << uint(i))
	}

	// Adding numeric properties < length does not increase length:
	set((1<<31)-2, String("not largest"))
	checkLen(1 << 31)

	// Verify behaviour around largest possible index:
	set(math.MaxUint32-2, Null{})
	checkLen(math.MaxUint32 - 1)
	set(math.MaxUint32-1, Null{})
	checkLen(math.MaxUint32)
	set(math.MaxUint32, Null{})
	checkLen(math.MaxUint32)
	set(math.MaxUint32+1, Null{})
	checkLen(math.MaxUint32)

	setLen := func(l int) {
		err := a.Set("length", Number(float64(l)))
		if err != nil {
			t.Error(err)
		}
	}
	check := func(n int64, exists bool) {
		e := a.HasOwnProperty(fmt.Sprintf("%d", n))
		if e != exists {
			t.Errorf("%v.HasOwnProperty(%d) == %t (expected %t)",
				a, n, e, exists)
		}
	}

	// Setting length to existing value should have no effect:
	setLen(math.MaxUint32)
	check(math.MaxUint32-2, true)
	check(math.MaxUint32-1, true)
	check(math.MaxUint32, true)
	check(math.MaxUint32+1, true)

	// Setting length one less than maximum should remove largest
	// index, but leave properties with keys too large to be indexes:
	setLen(math.MaxUint32 - 1)
	check(math.MaxUint32-2, true)
	check(math.MaxUint32-1, false)
	check(math.MaxUint32, true)
	check(math.MaxUint32+1, true)

	// Setting length to zero should remove all index properties:
	setLen(0)
	for _, p := range a.OwnPropertyKeys() {
		if _, isIndex := asIndex(p); isIndex {
			t.Errorf("Setting .lengh == 0 failed to remove property %#v", p)
		}
	}
	// Make sure we didn't wipe everything!
	if len(a.OwnPropertyKeys()) <= 1 {
		t.Errorf("Setting .lengh == 0 seems to have removed some" +
			"non-index properties")
	}
}
