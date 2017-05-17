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
	"reflect"
	"testing"
)

func TestFlattenSimple(t *testing.T) {
	// All these should not be changed by flatten(), and nothing
	// should be added to the flatpack:
	var cases = []interface{}{
		false,
		int(1),
		int8(2),
		int16(3),
		int32(4),
		int64(5),
		uint(6),
		uint8(7),
		uint16(8),
		uint32(9),
		uint64(10),
		uintptr(11),
		float32(12.0),
		float64(13.0),
		complex64(14 + 15i),
		complex128(16 + 17i),
		string("Eighteen"),
		[3]int{19, 20, 21},
		[]int{22, 23, 24},
		map[string]int{
			"cpcallen": 2365779,
			"fraser":   7499832,
		},
	}
	var f = New()
	for _, c := range cases {
		r := f.flatten(reflect.ValueOf(c))
		if reflect.TypeOf(c).Comparable() {
			if r.Interface() != c {
				t.Errorf("f.flatten(reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", c, r, c)
			}
		} else if !reflect.DeepEqual(r.Interface(), c) {
			t.Errorf("f.flatten(reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", c, r, c)
		}
	}
	if len(f.Values) != 0 {
		t.Errorf("f.Values == %#v (expected empty slice)", f.Values)
	}
}

func TestFlattenStringMap(t *testing.T) {
	var a = [...]int{42, 69, 105}
	var m = map[string]*int{
		"answer":  &a[0],
		"naughty": &a[1],
		"random":  &a[2],
	}
	var f = New()
	r := f.flatten(reflect.ValueOf(m))

	if r.Type() != flatType(reflect.TypeOf(m)) {
		t.Errorf("r.Type() == %s (expected %s)", r.Type(), flatType(reflect.TypeOf(m)))
	}
	if r.Len() != len(m) {
		t.Errorf("r.Len() == %d (expected %d)", r.Len(), len(m))
	}
	for k, v := range r.Interface().(map[string]ref) {
		if *(m[k]) != f.Values[v].V {
			t.Errorf("*(m[%#v]) == %#v in input but %#v in output", k, *(m[k]), f.Values[v].V)
		}
		delete(m, k)
	}
	if len(m) > 0 {
		t.Errorf("%#v present in input but not in output", m)
	}
}

func TestFlattenNonStringMap(t *testing.T) {
	var m = map[[2]int]string{
		{1914, 1918}: "WW I",
		{1939, 1945}: "WW II",
		{2026, 2053}: "WW III", // Citation: http://memory-alpha.wikia.com/wiki/World_War_III
	}
	var f = New()
	r := f.flatten(reflect.ValueOf(m))

	if r.Type() != flatType(reflect.TypeOf(m)) {
		t.Errorf("r.Type() == %s (expected %s)", r.Type(), flatType(reflect.TypeOf(m)))
	}
	if r.Len() != len(m) {
		t.Errorf("r.Len() == %d (expected %d)", r.Len(), len(m))
	}
	for i := 0; i < r.Len(); i++ {
		k := r.Index(i).Field(0).Interface().([2]int)
		v := r.Index(i).Field(1).Interface().(string)
		if m[k] != v {
			t.Errorf("m[%#v] == %#v in input but %#v in output", k, m[k], v)
		}
		delete(m, k)
	}
	if len(m) > 0 {
		t.Errorf("%#v present in input but not in output", m)
	}
}

func TestFlattenArrayPtr(t *testing.T) {
	// An array of four pointers to the same string should store one
	// copy in the flatpack an return an array of four refs:
	var s = "spam"
	var a = [...]*string{nil, &s, &s, &s}

	var f = New()
	r := f.flatten(reflect.ValueOf(a))
	if r.Len() != len(a) {
		t.Errorf("r.Len() == %d (expected %d)", r.Len(), len(a))
	}

	r0Type := r.Index(0).Type()
	refType := reflect.TypeOf(ref(0))
	if r0Type != refType {
		t.Errorf("r.Index(0).Type() == %s (expected %s)", r0Type, refType)
	}

	for i := 2; i < len(a); i++ {
		if r.Index(i).Interface() != r.Index(1).Interface() {
			t.Errorf("Flattening same pointer value should yield same ref")
		}
	}
	if len(f.Values) != 1 {
		t.Errorf("Flattening same pointer value multiple times should only store one copy of referant")
	}

	exp := tagged{tIDOf(reflect.TypeOf("")), s}
	if f.Values[0] != exp {
		t.Errorf("f.Values[0] == %#v (expected %#v)", f.Values[0], exp)
	}
}

func TestFlattenStructSliceInterface(t *testing.T) {
	// A struct containing an int and a slice of interface type should
	// come back as a struct containign an int and a slice of structs
	// containing a tID in addition to the original interface value.
	var s = struct {
		i  int
		sl []interface{}
	}{42, []interface{}{nil, 69, "Hello", true}}

	var f = New()
	r := f.flatten(reflect.ValueOf(s))

	if r.Type() != flatType(reflect.TypeOf(s)) {
		t.Errorf("r.Type() == %s (expected %s)", r.Type(), flatType(reflect.TypeOf(s)))
	}
	if ri := r.Field(0).Interface(); ri.(int) != s.i {
		t.Errorf("r.Field(0).Interface() == %#v (expected %#v)", ri, s.i)
	}
	rSlice := r.Field(1).Interface().([]tagged)
	for i := 0; i < len(s.sl); i++ {
		expType := tIDOf(reflect.TypeOf(s.sl[i]))
		if rSlice[i].T != expType {
			t.Errorf("rSlice[%d].T == %#v (expected %#v)", i, rSlice[i].T, expType)
		}
		if rSlice[i].V != s.sl[i] {
			t.Errorf("rSlice[%d].V == %#v (expected %#v)", i, rSlice[i].T, s.sl[i])
		}
	}
}

func TestUnflattenSimple(t *testing.T) {
	// All these should not be changed by unflatten():
	var cases = []interface{}{
		false,
		int(1),
		int8(2),
		int16(3),
		int32(4),
		int64(5),
		uint(6),
		uint8(7),
		uint16(8),
		uint32(9),
		uint64(10),
		uintptr(11),
		float32(12.0),
		float64(13.0),
		complex64(14 + 15i),
		complex128(16 + 17i),
		string("Eighteen"),

		myBool(false),
		myInt(19),
		myUint64(20),
		myFloat64(21.0),
		myComplex64(22 + 23i),
		// FIXME: implement:
		//
		// [3]int{19, 20, 21},
		// []int{22, 23, 24},
		// map[string]int{
		// 	"cpcallen": 2365779,
		// 	"fraser":   7499832,
		// },
	}
	var f = New()
	for _, c := range cases {
		tid := tIDOf(reflect.TypeOf(c))
		r := f.unflatten(tIDOf(reflect.TypeOf(c)), reflect.ValueOf(c))
		if reflect.TypeOf(c).Comparable() {
			if r.Interface() != c {
				t.Errorf("f.unflatten(%#v, reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", tid, c, r, c)
			}
		} else if !reflect.DeepEqual(r.Interface(), c) {
			t.Errorf("f.unflatten(%#v, reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", tid, c, r, c)
		}
	}
}

// Some user-declared types for testing:
type myBool bool
type myInt int
type myUint64 uint64
type myFloat64 float64
type myComplex64 complex64

/*
func TestUnflattenNamedSimple(t *testing.T) {
	// All these should not be changed by unflatten():
	var cases = []struct {
		t tID
		v interface{}
	}{
		{"flatpack.myBool", false},
		{"myInt", int(18)},
		{"myUint64", uint64(19)},
		{"myFloat64", float64(20.0)},
		{"myComplex64", complex64(21 + 22i)},
		// FIXME: implement:
		//
		// {"string", string("Eighteen")},
		// {"[3]int", [3]int{19, 20, 21}},
		// {"[]int", []int{22, 23, 24}},
		// {"map[string]int",
		// 	map[string]int{
		// 		"cpcallen": 2365779,
		// 		"fraser":   7499832,
		// 	},
		// },
	}
	var f = New()
	for _, c := range cases {
		var r = f.unflatten(c.t, reflect.ValueOf(c.v))
		if reflect.TypeOf(c.v).Comparable() {
			if r.Interface() != c.v {
				t.Errorf("f.unflatten(%#v reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", c.t, c.v, r, c.v)
			}
		} else if !reflect.DeepEqual(r.Interface(), c) {
			t.Errorf("f.unflatten(%#v, reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", c.t, c.v, r, c.v)
		}
	}
}
*/

// init registers types for testing.
func init() {
	var ifaces = reflect.TypeOf(
		struct {
			// i1 typename
		}{})
	for i := 0; i < ifaces.NumField(); i++ {
		RegisterType(ifaces.Field(i).Type)
	}

	var examples = []interface{}{
		myBool(false),
		myInt(0),
		myUint64(0),
		myFloat64(0),
		myComplex64(0 + 0i),
	}
	for _, val := range examples {
		RegisterTypeOf(val)
	}
}
