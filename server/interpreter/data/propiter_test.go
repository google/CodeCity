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
	keys := []string{"foo", "bar", "baz"}
	obj := NewObject(nil, nil)
	for _, k := range keys {
		ne := obj.Set(k, String(k))
		if ne != nil {
			t.Errorf("obj.Set(%#v, %#v) returned %v", k, String(k), ne)
		}
	}

	got := make(map[string]bool)
	iter := NewPropIter(obj)
	for k, ok := iter.Next(); ok; k, ok = iter.Next() {
		got[k] = true
	}
	for _, k := range keys {
		if !got[k] {
			t.Errorf("!got[%#v]", k)
		}
		delete(got, k)
	}
	if len(got) != 0 {
		t.Errorf("Extra properties: %#v", got)
	}
}

func TestPropIterInheritance(t *testing.T) {
	keys1 := []string{"foo", "bar", "baz"}
	keys2 := []string{"foo", "quux", "quuux"}
	expected := []string{"foo", "bar", "baz", "quux", "quuux"}

	obj1 := NewObject(nil, nil)
	obj2 := NewObject(nil, obj1)
	for _, k := range keys1 {
		ne := obj1.Set(k, String(k))
		if ne != nil {
			t.Error(ne)
		}
	}
	for _, k := range keys2 {
		ne := obj2.Set(k, String(k))
		if ne != nil {
			t.Errorf("obj.Set(%#v, %#v) returned %v", k, String(k), ne)
		}
	}

	got := make(map[string]bool)
	iter := NewPropIter(obj2)
	for k, ok := iter.Next(); ok; k, ok = iter.Next() {
		got[k] = true
	}
	for _, k := range expected {
		if !got[k] {
			t.Errorf("!got[%#v]", k)
		}
		delete(got, k)
	}
	if len(got) != 0 {
		t.Errorf("Extra properties: %#v", got)
	}
}

func TestPropIterDelete(t *testing.T) {
	keys := []string{"foo", "bar", "baz"}
	obj := NewObject(nil, nil)
	for _, k := range keys {
		ne := obj.Set(k, String(k))
		if ne != nil {
			t.Errorf("obj.Set(%#v, %#v) returned %v", k, String(k), ne)
		}
	}

	cnt := 0
	iter := NewPropIter(obj)
	k, ok := iter.Next()
	if !ok {
		t.Errorf("iter.Next() == %#v, false", k)
	}
	cnt++
	if k == "bar" {
		obj.Delete("baz")
	} else {
		obj.Delete("bar")
	}
	for _, ok = iter.Next(); ok; _, ok = iter.Next() {
		cnt++
	}
	if cnt != len(keys)-1 {
		t.Errorf("Property deletion during iteration: "+
			"expected %d properties; found %d", len(keys)-1, cnt)
	}
}
