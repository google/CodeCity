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
	"testing"
)

func TestBoxed(t *testing.T) {
	var cases = []struct {
		obj   Object
		class string
		typ   Type
	}{
		{NewBoxedBoolean(nil, protos.BooleanProto, false), "Boolean", BOOLEAN},
		{NewBoxedNumber(nil, protos.NumberProto, 0), "Number", NUMBER},
		{NewBoxedString(nil, protos.StringProto, ""), "String", STRING},
	}
	for _, c := range cases {
		if cls := c.obj.Class(); cls != c.class {
			t.Errorf(`%#v.Class() = %#v (expected %#v)`, c.obj, cls, c.class)
		}
		if pt := c.obj.ToPrimitive().Type(); pt != c.typ {
			t.Errorf(`%#v.ToPrimitive().Type() == %#v (expected %#v)`, c.obj, pt, c.typ)
		}
	}
}

func TestBoxedStringHasOwnProperty(t *testing.T) {
	var s = NewBoxedString(nil, protos.StringProto, String("foo"))

	if s.HasOwnProperty("foo") {
		t.Errorf(`%#v.HasOwnProperty("foo") == true`, s)
	}
	s.Set("foo", Undefined{})
	if !s.HasOwnProperty("foo") {
		t.Errorf(`%#v.HasOwnProperty("foo") == false (after set)`, s)
	}
	if !s.HasOwnProperty("length") {
		t.Errorf(`%#v.HasOwnProperty("length") == false`, s)
	}
}

func TestBoxedStringHasProperty(t *testing.T) {
	var s = NewBoxedString(nil, protos.StringProto, String("foo"))

	if s.HasProperty("foo") {
		t.Errorf(`%#v.HasProperty("foo") == true`, s)
	}
	s.Proto().Set("foo", Undefined{})
	if !s.HasProperty("foo") {
		t.Errorf(`%#v.HasProperty("foo") == false (after setting parent)`, s)
	}
	s.Proto().Delete("foo")
	if !s.HasProperty("length") {
		t.Errorf(`%#v.HasProperty("length") == false`, s)
	}
}

func TestBoxedStringLength(t *testing.T) {
	var tests = []struct {
		in       string
		expected int
	}{
		{"", 0},
		{"Hello, World!", 13},
		{"కోడ్ సిటీ", 9},
		{"𝌆", 2},
	}
	for _, c := range tests {
		bstr := NewBoxedString(nil, protos.StringProto, String(c.in))
		if l, _ := bstr.Get("length"); l != Number(c.expected) {
			t.Errorf("new String(%#v).length == %d (expected %d)", c.in, l, c.expected)
		}
	}
}
