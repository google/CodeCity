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
			t.Errorf("flatType(%s) == %s (expected %[1]s)", typ.String(), r.String())
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
		tin := reflect.TypeOf(c.in)
		texp := reflect.TypeOf(c.exp)
		if r := flatType(tin); r != texp {
			t.Errorf("flatType(%s) == %s (expected %s)", tin, r, texp)
		}
	}
}

func TestFlatTypeMap(t *testing.T) {
	var msi map[string]*int
	typ := reflect.TypeOf(msi)
	if r := flatType(typ); r != reflect.TypeOf(make(map[string]ref)) {
		t.Errorf("flatType(map[string]*int) == %s (expected map[string]serialize.ref)", r.String())
	}

	var mis map[int]string
	typ = reflect.TypeOf(mis)
	flat := flatType(typ)
	if flat.Kind() != reflect.Slice ||
		flat.Elem().Kind() != reflect.Struct ||
		flat.Elem().Field(0).Type != reflect.TypeOf(0) ||
		flat.Elem().Field(1).Type != reflect.TypeOf("") {
		t.Errorf("flatType(map[int]string) == %s (expected some []struct{int, string})", flat.String())
	}
}

func TestFlatTypeStruct(t *testing.T) {
	var s struct {
		s string
		i *int
	}
	typ := reflect.TypeOf(s)
	flat := flatType(typ)
	if flat.Kind() != reflect.Struct ||
		flat.Field(0).Type != reflect.TypeOf("") ||
		flat.Field(1).Type != reflect.TypeOf(ref(0)) {
		t.Errorf("flatType(struct{string, int}) == %s (expected some struct{string, ref})", flat.String())
	}
	if !('A' < flat.Field(0).Name[0] && flat.Field(0).Name[0] < 'Z') ||
		!('A' < flat.Field(1).Name[0] && flat.Field(1).Name[0] < 'Z') {
		t.Errorf("flatType(struct{string, int}) == %s (expected exported fields)", flat.String())
	}
}

func TestFlatTypeInterface(t *testing.T) {
	// reflect.TypeOf() called on an interface looks at the type of
	// the thing *in* the interface, not the interface itself, so we
	// use a little cheat to get an actual interface type to pass to
	// flatType():
	var si struct {
		im interface {
			method()
		}
		i interface{}
	}
	typ := reflect.TypeOf(si).Field(0).Type
	flat := flatType(typ)
	if flat.Kind() != reflect.Struct ||
		flat.Field(0).Type != reflect.TypeOf(tID("")) ||
		flat.Field(1).Type != reflect.TypeOf(si).Field(1).Type {
		t.Errorf("flatType(interface{...} == %s (expected some struct{tID, interface{})", flat.String())
	}
	if !('A' < flat.Field(0).Name[0] && flat.Field(0).Name[0] < 'Z') ||
		!('A' < flat.Field(1).Name[0] && flat.Field(1).Name[0] < 'Z') {
		t.Errorf("flatType(interface{...} == %s (expected exported fields)", flat.String())
	}
}
