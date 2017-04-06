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

package object

import (
	"testing"
)

func TestArray(t *testing.T) {
	a := NewArray(nil, ArrayProto)
	if a.Proto() != Value(ArrayProto) {
		t.Errorf("%v.Proto() != ArrayProto", a)
	}
	if a.Proto().Proto() != Value(ObjectProto) {
		t.Errorf("%v.Proto().Proto() != ObjectProto", a)
	}
}

func TestArrayLength(t *testing.T) {
	a := NewArray(nil, ArrayProto)
	l, err := a.GetProperty("length")
	if err != nil {
		t.Errorf("[].length returned error %#v", err)

	}
	if l != Number(0) {
		t.Errorf("[].length == %#v (expected 0)", l)
	}
}
