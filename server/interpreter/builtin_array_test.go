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

	"codecity.world/cc/server/interpreter/data"
)

func TestInitArrayProto(t *testing.T) {
	i := New()
	ap, _ := i.global.getVar("Array").(data.Object).Get("prototype")
	push, _ := ap.(data.Object).Get("push")
	cl, isClosure := push.(*closure)
	if !isClosure {
		t.Errorf("Array.prototype.push is a %T (expected *closure)", cl)
	}
}
