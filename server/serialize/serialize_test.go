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

package serialize

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
	}
	var f = NewFlatpack()
	for _, c := range cases {
		var r = f.flatten(reflect.ValueOf(c))
		if reflect.TypeOf(c).Comparable() {
			if r.Interface() != c {
				t.Errorf("f.flatten(reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", c, r, c)
			}
		} else if !reflect.DeepEqual(r.Interface(), c) {
			t.Errorf("f.flatten(reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", c, r, c)
		}
	}
	if len(f.Values) != 0 {
		t.Errorf("len(f.Values) == %d (expected 0)", len(f.Values))
	}
}

func TestFlattenArrayPtr(t *testing.T) {
	// An array of four pointers to the same string should store one
	// copy in the flatpack an return an array of four refs:
	var s = "spam"
	var a = [...]*string{&s, &s, &s, &s}

	var f = NewFlatpack()
	r := f.flatten(reflect.ValueOf(a))
	if r.Len() != len(a) {
		t.Errorf("r.Len() == %d (expected %d)", r.Len(), len(a))
	}

	r0Type := r.Index(0).Type()
	refType := reflect.TypeOf(ref(0))
	if r0Type != refType {
		t.Errorf("r.Index(0).Type() == %s (expected %s)", r0Type, refType)
	}

	for i := 1; i < len(a); i++ {
		if r.Index(i).Interface() != r.Index(0).Interface() {
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
	// A struct containing an int and a slice of inteface type should
	// come back as a struct containign an int and a slice of structs
	// containing a tID in addition to the original interface value.
	var s = struct {
		i  int
		sl []interface{}
	}{42, []interface{}{69, "Hello", true}}

	var f = NewFlatpack()
	r := f.flatten(reflect.ValueOf(s))

	if r.Type() != flatType(reflect.TypeOf(s)) {
		t.Errorf("r.Type() == %#v (expected %#v)", r.Type(), flatType(reflect.TypeOf(s)))
	}
	if ri := r.Field(0).Interface(); ri.(int) != s.i {
		t.Errorf("r.Field(0).Interface() == %#v (expected %#v)", ri, s.i)
	}
	var rSlice []tagged = r.Field(1).Interface().([]tagged)
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
