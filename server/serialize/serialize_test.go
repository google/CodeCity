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

func TestFlattenPtr(t *testing.T) {
	var s string = "Hello, world!"
	var f = NewFlatpack()
	r1 := f.flatten(reflect.ValueOf(&s))
	r2 := f.flatten(reflect.ValueOf(&s))
	refType := reflect.TypeOf(ref(0))
	if r1Type := r1.Type(); r1Type != refType {
		t.Errorf("r1.Type() == %s (expected %s)", r1Type, refType)
	}
	if r1.Interface() != r2.Interface() {
		t.Errorf("Flattening same pointer value twice should yield same ref")
	}
}
