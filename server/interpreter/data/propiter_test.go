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

import "testing"

func TestPropIterSimpleObj(t *testing.T) {
	names := []string{"foo", "bar", "baz"}
	obj := NewObject(nil, nil)
	for _, n := range names {
		err := obj.Set(n, String(n))
		if err != nil {
			t.Error(err)
		}
	}

	got := make(map[string]bool)
	iter := NewPropIter(obj)
	for n, ok := iter.Next(); ok; n, ok = iter.Next() {
		got[n] = true
	}
	for _, n := range names {
		if !got[n] {
			t.Errorf("!got[%#v]", n)
		}
		delete(got, n)
	}
	if len(got) != 0 {
		t.Errorf("Extra properties: %#v", got)
	}
}

func TestPropIterInheritance(t *testing.T) {
	names1 := []string{"foo", "bar", "baz"}
	names2 := []string{"foo", "quux", "quuux"}
	expected := []string{"foo", "bar", "baz", "quux", "quuux"}

	obj1 := NewObject(nil, nil)
	obj2 := NewObject(nil, obj1)
	for _, n := range names1 {
		err := obj1.Set(n, String(n))
		if err != nil {
			t.Error(err)
		}
	}
	for _, n := range names2 {
		err := obj2.Set(n, String(n))
		if err != nil {
			t.Error(err)
		}
	}

	got := make(map[string]bool)
	iter := NewPropIter(obj2)
	for n, ok := iter.Next(); ok; n, ok = iter.Next() {
		got[n] = true
	}
	for _, n := range expected {
		if !got[n] {
			t.Errorf("!got[%#v]", n)
		}
		delete(got, n)
	}
	if len(got) != 0 {
		t.Errorf("Extra properties: %#v", got)
	}
}

func TestPropIterDelete(t *testing.T) {
	names := []string{"foo", "bar", "baz"}
	obj := NewObject(nil, nil)
	for _, n := range names {
		err := obj.Set(n, String(n))
		if err != nil {
			t.Error(err)
		}
	}

	cnt := 0
	iter := NewPropIter(obj)
	n, ok := iter.Next()
	if !ok {
		t.Errorf("iter.Next() == %#v, false", n)
	}
	cnt++
	if n == "bar" {
		obj.Delete("baz")
	} else {
		obj.Delete("bar")
	}
	for _, ok = iter.Next(); ok; _, ok = iter.Next() {
		cnt++
	}
	if cnt != len(names)-1 {
		t.Errorf("Property deletion during iteration: "+
			"expected %d properties; found %d", len(names)-1, cnt)
	}
}
