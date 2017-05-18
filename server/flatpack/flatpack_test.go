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

// Some user-declared types for testing:
type myBool bool
type myInt int
type myUint64 uint64
type myFloat64 float64
type myComplex64 complex64

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

		myBool(false),
		myInt(19),
		myUint64(20),
		myFloat64(21.0),
		myComplex64(22 + 23i),

		[3]int{24, 25, 26},
		[]int{27, 28, 29},
		map[string]int{
			"cpcallen": 2365779,
			"fraser":   7499832,
		},

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
	var a = [5]*string{nil, &s, &s, &s, &s}

	var f = New()
	r := f.flatten(reflect.ValueOf(a))
	if r.Len() != len(a) {
		t.Errorf("r.Len() == %d (expected %d)", r.Len(), len(a))
	}

	if r0 := r.Index(0).Interface().(ref); r0 != -1 {
		t.Errorf("r[0] == %d (expected -1)", r0)
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
		[3]int{24, 25, 26},
		[]int{27, 28, 29},
		// map[string]int{
		// 	"cpcallen": 2365779,
		// 	"fraser":   7499832,
		// },
	}
	var f = New()
	for _, c := range cases {
		tid := tIDOf(reflect.TypeOf(c))
		r := f.unflatten(reflect.TypeOf(c), reflect.ValueOf(c))
		if reflect.TypeOf(c).Comparable() {
			if r.Interface() != c {
				t.Errorf("f.unflatten(%#v, reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", tid, c, r, c)
			}
		} else if !reflect.DeepEqual(r.Interface(), c) {
			t.Errorf("f.unflatten(%#v, reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", tid, c, r, c)
		}
	}
}

func TestUnflattenArrayPtr(t *testing.T) {
	var f = Flatpack{
		Values: []tagged{{"string", "spam"}},
	}
	arr5PtrStrType := reflect.TypeOf([5]*string{})
	a := [5]ref{-1, 0, 0, 0, 0}
	r := f.unflatten(arr5PtrStrType, reflect.ValueOf(a))
	if rtyp := r.Type(); rtyp != arr5PtrStrType {
		t.Errorf("Type of r is %s (expected []*int)", rtyp)
	}
	if r.Len() != len(a) {
		t.Errorf("r.Len() == %d (expected %d)", r.Len(), len(a))
	}

	if r0 := r.Index(0).Interface().(*string); r0 != nil {
		t.Errorf("r[0] == %#v (expected nil)", r0)
	}
	for i := 2; i < len(a); i++ {
		if r.Index(i).Interface() != r.Index(1).Interface() {
			t.Errorf("Unflatting same ref should yield same pointer value")
		}
	}
}

func TestUnflattenStruct(t *testing.T) {
	type testStruct struct {
		n int
		p *testStruct
	}
	typ := reflect.TypeOf(testStruct{})
	RegisterType(typ)
	tid := tIDOf(typ)
	// A flatpack of two crosslinked testStructs.  Unfortunately the
	// flattened struct type can't be given a name, because unflatten
	// expects it to be anonymous.
	var f = Flatpack{
		Values: []tagged{
			{
				T: tid,
				V: struct {
					F_n int `json:"n"`
					F_p ref `json:"p"`
				}{42, 1},
			},
			{
				T: tid,
				V: struct {
					F_n int `json:"n"`
					F_p ref `json:"p"`
				}{69, 0},
			},
		},
	}
	r := f.unflatten(reflect.PtrTo(typ), reflect.ValueOf(ref(0)))
	v := r.Interface().(*testStruct)
	if v == nil {
		t.Error("v.n == nil (expected non-nil)")
	}
	if v.n != 42 {
		t.Errorf("v.n == %d (expected 42)", v.n)
	}
	if v.p == nil {
		t.Error("v.p == nil (expected non-nil)")
	}
	if v.p.n != 69 {
		t.Errorf("v.p.n == %d (expected 69)", v.p.n)
	}
	if v.p.p != v {
		t.Errorf("v.p.p == %p (expected %p == v)", v.p.p, v)
	}
}

func TestUnflattenSliceInterface(t *testing.T) {
	// A struct containing an int and a slice of interface type should
	// come back as a struct containign an int and a slice of structs
	// containing a tID in addition to the original interface value.
	var f Flatpack
	sl := []tagged{{"", nil}, {"int", 69}, {"string", "Hello"}, {"bool", true}}
	exp := []interface{}{nil, 69, "Hello", true}
	typ := reflect.TypeOf(exp)
	r := f.unflatten(typ, reflect.ValueOf(sl))
	if r.Type() != typ {
		t.Errorf("r.Type() == %s (expected %s)", r.Type(), typ)
	}
	if v := r.Interface().([]interface{}); !reflect.DeepEqual(v, exp) {
		t.Errorf("r == %#v (expected %#v)", v, exp)
	}
}

// init registers types for testing.
func init() {
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
