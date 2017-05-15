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

func TestFlatTypeSimple(t *testing.T) {
	// All these should not be changed by flatType():
	var cases = []interface{}{
		false,
		int(0),
		int8(0),
		int16(0),
		int32(0),
		int64(0),
		uint(0),
		uint8(0),
		uint16(0),
		uint32(0),
		uint64(0),
		uintptr(0),
		float32(0),
		float64(0),
		complex64(0 + 0i),
		complex128(0 + 0i),
		string(""),
		[3]int{0, 0, 0},
		[]int{0, 0, 0},
	}
	for _, c := range cases {
		var typ = reflect.TypeOf(c)
		if r := flatType(typ); r != typ {
			t.Errorf("flatType(%s) == %s (expected %[1]s)", typ, r)
		}
	}
}

func TestFlatTypePtr(t *testing.T) {
	var cases = []struct {
		in  interface{}
		exp interface{}
	}{
		{(*int)(nil), ref(0)},
		{[...]*int{nil, nil, nil}, [...]ref{0, 0, 0}},
		{[]*int{nil, nil, nil}, []ref{}},
		{new([3]int), ref(0)},
		{new([]int), ref(0)},
	}
	for _, c := range cases {
		typ := reflect.TypeOf(c.in)
		exp := reflect.TypeOf(c.exp)
		if r := flatType(typ); r != exp {
			t.Errorf("flatType(%s) == %s (expected %s)", typ, r, exp)
		}
	}
}

func TestFlatTypeMap(t *testing.T) {
	var msi map[string]*int
	typ := reflect.TypeOf(msi)
	exp := reflect.TypeOf(map[string]ref(nil))
	if r := flatType(typ); r != exp {
		t.Errorf("flatType(%s) == %s (expected %s)", typ, r, exp)
	}

	var mis map[int]string
	typ = reflect.TypeOf(mis)
	r := flatType(typ)
	if r.Kind() != reflect.Slice ||
		r.Elem().Kind() != reflect.Struct ||
		r.Elem().Field(0).Type.String() != "int" ||
		r.Elem().Field(1).Type.String() != "string" {
		t.Errorf("flatType(%s) == %s (expected some []struct{int, string})", typ, r)
	}
}

func TestFlatTypeStruct(t *testing.T) {
	var s struct {
		s string
		i *int
	}
	typ := reflect.TypeOf(s)
	r := flatType(typ)
	if r.Kind() != reflect.Struct ||
		r.Field(0).Type.String() != "string" ||
		r.Field(1).Type.String() != "flatpack.ref" {
		t.Errorf("flatType(%s) == %s (expected some struct{string, ref})", typ, r)
	}
	if !('A' < r.Field(0).Name[0] && r.Field(0).Name[0] < 'Z') ||
		!('A' < r.Field(1).Name[0] && r.Field(1).Name[0] < 'Z') {
		t.Errorf("flatType(%s) == %s (expected exported fields)", typ, r)
	}
}

func TestFlatTypeInterface(t *testing.T) {
	// reflect.TypeOf() called on an interface looks at the type of
	// the thing *in* the interface, not the interface itself, so we
	// use a little cheat to get an actual interface type to pass to
	// flatType():
	typ := reflect.TypeOf(struct {
		im interface {
			method()
		}
	}{}).Field(0).Type
	exp := reflect.TypeOf(tagged{})
	if r := flatType(typ); r != exp {
		t.Errorf("flatType(%s) = %s (expected %s)", typ, r, exp)
	}
}
