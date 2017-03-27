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
	"CodeCity/server/interpreter/ast"
)

// A Function is an object that can be called / applied.
type Function struct {
	Object
	Body *ast.BlockStatement
}

// *Function must satisfy Value.
var _ Value = (*Function)(nil)

func (Function) ToString() String {
	return "[object Function]"
}

// NewFunction returns a new Function object with the specified owner
// and body, having parent FunctionProto.
func NewFunction(owner *Owner, body *ast.BlockStatement) *Function {
	var f = new(Function)
	f.init(owner, OwnerProto)
	f.Body = body
	return f
}

// FunctionProto is the the (plain) JavaScript object that is the
// prototype for all Function objects.  (It would usually be
// accessed in JavaScript as Function.prototype.)
var FunctionProto = New(nil, ObjectProto)
