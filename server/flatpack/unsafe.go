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
	"unsafe"
)

// defeat takes a reflect.Value that is addressable but not settable
// or can't be used to set another (because it is for/from an
// unexported field) and returns a new reflect.Value that can be set
// or used to set.
func defeat(v reflect.Value) reflect.Value {
	if !v.CanAddr() {
		panic("Can't defeat protection of unadressable value")
	}
	return reflect.NewAt(v.Type(), unsafe.Pointer(v.UnsafeAddr())).Elem()
}
