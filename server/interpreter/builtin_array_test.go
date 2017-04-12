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
	//"CodeCity/server/interpreter/object"
	"testing"
)

func TestInitArrayProto(t *testing.T) {
	i, _ := NewFromJSON(emptyProg)
	ap, _ := i.state.(*stateBlockStatement).scope.getVar("Array").
		GetProperty("prototype")
	push, _ := ap.GetProperty("push")
	cl, isClosure := push.(*closure)
	if !isClosure {
		t.Errorf("Array.prototype.push is a %T (expected *closure)", cl)
	}
}

const emptyProg = `{"type":"Program","start":0,"end":0,"body":[]}`
