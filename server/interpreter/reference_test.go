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

package interpreter

import (
	"testing"

	"CodeCity/server/interpreter/data"
)

func TestEnvRef(t *testing.T) {
	sc := newScope(nil, nil)
	sc.newVar("foo", data.Number(42))
	ref := newReference(sc, "foo")

	if b := ref.getBase(); b != sc {
		t.Errorf("ref.getBase() == %#v (expected %#v)", b, sc)
	} else if n := ref.getName(); n != "foo" {
		t.Errorf("ref.getName() == %#v (expected %#v)", b, "foo")
	} else if pr := ref.isPropRef(); pr {
		t.Errorf("ref.isPropRef() == %#v", pr)
	} else if ur := ref.isUnresolvable(); ur {
		t.Errorf("ref.isUnresovable() == %#v", ur)
	} else if n := ref.getName(); n != "foo" {
		t.Errorf("ref.getName() == %#v (expected %#v)", b, "foo")
	}

	if v, nErr := ref.getValue(nil); v != data.Number(42) || nErr != nil {
		t.Errorf("ref.getValue() == %#v, %#v (expected %#v, nil)", v, nErr, data.Number(42))
	}
	if nErr := ref.putValue(data.String("bar"), nil); nErr != nil {
		t.Errorf(`ref.putValue("bar") == %#v (exected nil)`, nErr)
	}
	if v, nErr := ref.getValue(nil); v != data.String("bar") || nErr != nil {
		t.Errorf("ref.getValue() == %#v, %#v (expected %#v, nil)", v, nErr, data.String("bar"))
	}
	if nErr := ref.delete(nil); nErr == nil || nErr.Type != data.SyntaxError {
		t.Errorf("ref.delete() == %#v (exected %#v)", nErr, data.SyntaxError)
	}
}

func TestPropRef(t *testing.T) {
	obj := data.NewObject(nil, nil)
	obj.Set("foo", data.Number(42))
	ref := newReference(obj, "foo")

	if b := ref.getBase(); b != obj {
		t.Errorf("ref.getBase() == %#v (expected %#v)", b, obj)
	} else if n := ref.getName(); n != "foo" {
		t.Errorf("ref.getName() == %#v (expected %#v)", b, "foo")
	} else if pr := ref.isPropRef(); !pr {
		t.Errorf("ref.isPropRef() == %#v", pr)
	} else if ur := ref.isUnresolvable(); ur {
		t.Errorf("ref.isUnresovable() == %#v", ur)
	}

	if v, nErr := ref.getValue(nil); v != data.Number(42) || nErr != nil {
		t.Errorf("ref.getValue() == %#v, %#v (expected %#v, nil)", v, nErr, data.Number(42))
	}
	if nErr := ref.putValue(data.String("bar"), nil); nErr != nil {
		t.Errorf(`ref.putValue("bar") == %#v (exected nil)`, nErr)
	}
	if v, nErr := ref.getValue(nil); v != data.String("bar") || nErr != nil {
		t.Errorf("ref.getValue() == %#v, %#v (expected %#v, nil)", v, nErr, data.String("bar"))
	}
	if nErr := ref.delete(nil); nErr != nil {
		t.Errorf("ref.delete() == %#v (exected nil)", nErr)
	}
}

func TestPrimRef(t *testing.T) {
	prim := data.String("foo")
	intrp := New()
	ref := newReference(prim, "length")

	if b := ref.getBase(); b != prim {
		t.Errorf("ref.getBase() == %#v (expected %#v)", b, prim)
	} else if n := ref.getName(); n != "length" {
		t.Errorf("ref.getName() == %#v (expected %#v)", b, "length")
	} else if pr := ref.isPropRef(); !pr {
		t.Errorf("ref.isPropRef() == %#v", pr)
	} else if ur := ref.isUnresolvable(); ur {
		t.Errorf("ref.isUnresovable() == %#v", ur)
	}

	if v, nErr := ref.getValue(intrp); v != data.Number(3) || nErr != nil {
		t.Errorf("ref.getValue() == %#v, %#v (expected %#v, nil)", v, nErr, data.Number(3))
	}
	if nErr := ref.putValue(data.Number(0), intrp); nErr == nil {
		t.Errorf("ref.putValue(42) == nil (exected an error)")
	}
	if v, nErr := ref.getValue(intrp); v != data.Number(3) || nErr != nil {
		t.Errorf("ref.getValue() == %#v, %#v (expected %#v, nil)", v, nErr, data.Number(3))
	}
	if nErr := ref.delete(intrp); nErr == nil || nErr.Type != data.TypeError {
		t.Errorf("ref.delete() == %#v (exected TypeError)", nErr)
	}
}
