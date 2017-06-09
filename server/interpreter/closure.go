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
	"fmt"

	"CodeCity/server/interpreter/ast"
	"CodeCity/server/interpreter/data"
)

// function is a type representing some kind of JS Function object.
// It is, in essence, a value.Object that can be called.
type function interface {
	data.Object

	// call takes pointers to the call expression and interpreter, a
	// 'this' value and a slice of arguments, and returns a next state
	// and cval.
	//
	// The return values may represent either the first state of the
	// execution of the function (in the case of a JS closure), or the
	// final result of the function call (in the case of a native
	// function).
	call(st *stateCallExpression, intrp *Interpreter, this data.Value, args []data.Value) (state, *cval)
}

// A closure is a function that, when called, will execute some
// (user-supplied) JS code.
type closure struct {
	data.Object
	scope  *scope
	params []string
	body   *ast.BlockStatement
}

// *closure must satisfy function.
var _ function = (*closure)(nil)

func (closure) Typeof() string {
	return "function"
}

// Class always returns "Function" for function objects.
func (closure) Class() string {
	return "Function"
}

// ToString is repeated here to catch the changed definition of Class.
//
// BUG(cpcallen): as with object.ToString, nativeFunc.ToString should
// call a user-code toString() method if present.
func (cl closure) ToString() data.String {
	return data.String("[object " + cl.Class() + "]")
}

// call sets up a new (inner) scope and adds the parameters to it,
// initializing them with the corresponding argument values, before
// creating (and returning) a new state for the root node of the body
// AST.
func (cl *closure) call(st *stateCallExpression, intrp *Interpreter, this data.Value, args []data.Value) (state, *cval) {
	scope := newScope(cl.scope, this)
	// Set up scope:
	scope.populate(cl.body, intrp)
	for i, arg := range args {
		scope.newVar(cl.params[i], arg)
	}
	// FIXME: create arguments object.
	// Create coda state to handle RETURN->NORMAL cval conversion:
	stCE := &stateCallEpilogue{parent: st.parent}

	// Evaluate function call
	return newState(stCE, scope, cl.body), nil
}

// newClosure returns a new closure object with the specified owner,
// prototype, scope and body.
func newClosure(owner *data.Owner, proto data.Object, scope *scope,
	params []*ast.Identifier, body *ast.BlockStatement) *closure {
	var cl = new(closure)
	cl.Object = data.NewObject(owner, proto)
	cl.scope = scope
	// FIXME: should length be non-writeable?
	cl.Set("length", data.Number(len(params)))
	cl.params = make([]string, len(params))
	for i, p := range params {
		cl.params[i] = p.Name
	}
	cl.body = body
	return cl
}

// stateCallEpilogue is used to implement steps 4-6 of the [[Call]]
// algorithm given in §13.2.1 of the ES5.1 spec, converting a RETURN
// into NORMAL result, throwing a SyntaxError if the result of the
// function call evaluation was a(n illegal) continue or break, or
// returning undefined otherwise.
type stateCallEpilogue stateCommon

func (st *stateCallEpilogue) step(intrp *Interpreter, cv *cval) (state, *cval) {
	switch cv.typ {
	case RETURN:
		cv.typ = NORMAL
	case THROW:
		// fine; leave as-is
	case NORMAL:
		cv = &cval{NORMAL, data.Undefined{}, ""}
	case BREAK:
		cv = &cval{THROW, intrp.syntaxError("illegal break"), ""}
	case CONTINUE:
		cv = &cval{THROW, intrp.syntaxError("illegal continue"), ""}
	default:
		panic(fmt.Errorf("unknown cval %#v", cv))
	}
	return st.parent, cv
}
