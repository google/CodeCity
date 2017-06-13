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

var protos *Protos

func init() {
	protos = NewProtos()
}

func TestObject(t *testing.T) {
	var obj = NewObject(nil, protos.ObjectProto)
	if c := obj.Class(); c != "Object" {
		t.Errorf(`%#v.Class() = %#v (expected "Object"`, obj, c)
	}
}

func TestObjectNonPrimitiveness(t *testing.T) {
	var objs = []Value{
		NewObject(nil, protos.ObjectProto),
		NewOwner(protos.OwnerProto),
	}

	for _, o := range objs {
		if o.IsPrimitive() {
			t.Errorf("%v.isPrimitive() = true", o)
		}
	}
}

func TestObjectHasOwnProperty(t *testing.T) {
	var parent = NewObject(nil, nil)
	var obj = NewObject(nil, parent)

	if obj.HasOwnProperty("foo") {
		t.Errorf(`%#v.HasOwnProperty("foo") == true`, obj)
	}
	parent.Set("foo", Undefined{})
	if obj.HasOwnProperty("foo") {
		t.Errorf(`%#v.HasOwnProperty("foo") == true `+
			"(after setting parent.foo)", obj)
	}
	obj.Set("foo", Undefined{})
	if !obj.HasOwnProperty("foo") {
		t.Errorf(`%#v.HasOwnProperty("foo") == false`, obj)
	}
}

func TestObjectHasProperty(t *testing.T) {
	var parent = NewObject(nil, nil)
	var obj = NewObject(nil, parent)

	if obj.HasProperty("foo") {
		t.Errorf(`%#v.HasProperty("foo") == true`, obj)
	}
	parent.Set("foo", Undefined{})
	if !obj.HasProperty("foo") {
		t.Errorf(`%#v.HasProperty("foo") == false `+
			"(after setting parent.foo)", obj)
	}
	obj.Set("bar", Undefined{})
	if !obj.HasProperty("bar") {
		t.Errorf(`%#v.HasProperty("bar") == false`, obj)
	}
}
