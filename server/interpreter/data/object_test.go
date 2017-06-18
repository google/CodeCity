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

var protos *Protos

func init() {
	protos = NewProtos()
}

func TestObject(t *testing.T) {
	var obj = NewObject(nil, protos.ObjectProto)
	if c := obj.Class(); c != "Object" {
		t.Errorf(`%#v.Class() = %#v (expected "Object"`, obj, c)
	}
	if obj.Proto() != Value(protos.ObjectProto) {
		t.Errorf("%v.Proto() != ObjectProto", obj)
	}
	testObject(t, obj)
}

/********************************************************************/
// Utilitiy functions for testing property behaviour on Objects

// testObject performs a battery of standard tests on an object:
//
//     1) Check object is not primitive
//     2) Add a property and make sure it exists.
//     3) Delete it and make sure it no longer exists.
//     4) If has proto, repeat steps 2) and 3) for an inherited
//        property.
//
// FIXME: try setting via DefineOwnProperty
//
// FIXME: check !writeable / !configurable properties, !extensible
// object.
func testObject(t *testing.T, obj Object) {
	t.Run("IsPrimitive", func(t *testing.T) {
		if obj.IsPrimitive() {
			t.Errorf("%v.isPrimitive() = true", obj)
		}
	})

	t.Run("OwnProperty", func(t *testing.T) {
		checkNoProp(t, obj, "foo")
		ne := obj.Set("foo", String("bar"))
		if ne != nil {
			t.Errorf(`%v.Set("foo", String("bar")) == %v (expected <nil>)`, obj, ne)
		}
		checkOwnProp(t, obj, "foo", Property{Value: String("bar"), flags: writable | enumerable | configurable})
		ne = obj.Delete("foo")
		if ne != nil {
			t.Errorf(`%v.Delete("foo") == %v (expected <nil>)`, obj, ne)
		}
		checkNoProp(t, obj, "foo")
	})

	t.Run("InheritedProperty", func(t *testing.T) {
		proto := obj.Proto()
		if proto == nil {
			return
		}
		checkNoProp(t, proto, "foo")
		ne := proto.Set("foo", String("bar"))
		if ne != nil {
			t.Errorf(`%v.Set("foo", String("bar")) == %v (expected <nil>)`, proto, ne)
		}
		checkInheritedProp(t, obj, "foo", Property{Value: String("bar"), flags: writable | enumerable | configurable})
		ne = proto.Delete("foo")
		if ne != nil {
			t.Errorf(`%v.Delete("foo") == %v (expected <nil>)`, proto, ne)
		}
		checkNoProp(t, obj, "foo")
	})
}

// checkOwnProp checks that the property exists and has the expected
// value (via several different methods)
func checkOwnProp(t *testing.T, obj Object, key string, pd Property) {
	p, ok := obj.GetOwnProperty(key)
	if p != pd || !ok {
		t.Errorf(`%v.GetOwnPropertyDescriptor(%#v) == %v, %t (expected %v, true)`, obj, key, p, ok, pd)
	}
	v, ne := obj.Get(key)
	if v != pd.Value || ne != nil {
		t.Errorf(`%v.Get(%#v) == %#v, %v (expected %#v, <nil>)`, obj, key, v, ne, pd.Value)
	}
	keys := obj.OwnPropertyKeys()
	var i int
	for i = 0; i < len(keys); i++ {
		if keys[i] == key {
			break
		}
	}
	if i == len(keys) {
		t.Errorf(`%v.OwnPropertyKeys() == %#v (expected to contain %#v)`, obj, keys, key)
	}
	if !obj.HasOwnProperty(key) {
		t.Errorf(`%v.HasOwnProperty(%#v) == false`, obj, key)
	}
	if !obj.HasProperty(key) {
		t.Errorf(`%v.HasOwnProperty(%#v) == false`, obj, key)
	}
}

// checkInheritedProp checks that the property exists as an inherited
// property and has the expected value (via several different methods)
func checkInheritedProp(t *testing.T, obj Object, key string, pd Property) {
	p, ok := obj.GetOwnProperty(key)
	if ok {
		t.Errorf(`%v.GetOwnPropertyDescriptor(%#v) == %v, %t (expected [...], false)`, obj, key, p, ok)
	}
	v, ne := obj.Get(key)
	if v != pd.Value || ne != nil {
		t.Errorf(`%v.Get(%#v) == %#v, %v (expected %#v, <nil>)`, obj, key, v, ne, pd.Value)
	}
	keys := obj.OwnPropertyKeys()
	for i := 0; i < len(keys); i++ {
		if keys[i] == key {
			t.Errorf(`%v.OwnPropertyKeys() == %#v (expected not to contain %#v)`, obj, keys, key)
			break
		}
	}
	if obj.HasOwnProperty(key) {
		t.Errorf(`%v.HasOwnProperty(%#v) == true`, obj, key)
	}
	if !obj.HasProperty(key) {
		t.Errorf(`%v.HasOwnProperty(%#v) == false`, obj, key)
	}
}

// checkNoProp checks that specified property does not exist (via
// several different methods)
func checkNoProp(t *testing.T, obj Object, key string) {
	p, ok := obj.GetOwnProperty(key)
	if ok {
		t.Errorf(`%v.GetOwnPropertyDescriptor(%#v) == %v, %t (expected [...], false)`, obj, key, p, ok)
	}
	v, ne := obj.Get(key)
	if ne != nil {
		t.Errorf(`%v.Get(%#v) == %#v, %v (expected nil, non-nil)`, obj, key, v, ne)
	}
	keys := obj.OwnPropertyKeys()
	for i := 0; i < len(keys); i++ {
		if keys[i] == key {
			t.Errorf(`%v.OwnPropertyKeys() == %#v (expected not to contain %#v)`, obj, keys, key)
			break
		}
	}
	if obj.HasOwnProperty(key) {
		t.Errorf(`%v.HasOwnProperty(%#v) == true`, obj, key)
	}
	if obj.HasProperty(key) {
		t.Errorf(`%v.HasOwnProperty(%#v) == true`, obj, key)
	}
}
