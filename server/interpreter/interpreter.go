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

// Package interpreter implements a JavaScript interpreter.
package interpreter

import (
	"fmt"

	"CodeCity/server/interpreter/ast"
	"CodeCity/server/interpreter/data"
)

// Interpreter implements a JavaScript interpreter.
type Interpreter struct {
	protos  *data.Protos
	global  *scope
	threads []thread
	Verbose bool
}

// Thread is a single thread of execution.
type thread struct {
	state state
	value *cval
}

// New creates a new, empty interpreter.
func New() *Interpreter {
	var intrp = new(Interpreter)
	intrp.protos = data.NewProtos()
	intrp.global = newScope(nil, nil)
	intrp.initBuiltins()
	return intrp
}

// Eval takes a JavaScript program as text source code and adds a
// thread to the interpreter that will execute that program.
//
// FIXME: error handling
func (intrp *Interpreter) Eval(js string) error {
	tree, err := parse(js)
	if err != nil {
		return err
	}
	intrp.EvalAST(tree)
	return nil
}

// EvalASTJSON takes a JavaScript program, in the form of an
// JSON-encoded ESTree, and adds a thread to the interpreter that will
// execute that program.
func (intrp *Interpreter) EvalASTJSON(astJSON string) error {
	tree, err := ast.NewFromJSON(astJSON)
	if err != nil {
		return err
	}
	intrp.EvalAST(tree)
	return nil
}

// EvalAST takes a JavaScript program, in the form of an
// ESTree-structured *ast.Program and adds a thread to the interpreter
// that will execute that program.
func (intrp *Interpreter) EvalAST(tree *ast.Program) {
	intrp.global.populate(tree, intrp)
	state := newState(nil, intrp.global, tree)
	intrp.threads = append(intrp.threads, thread{state: state})
}

// Step performs the next step in the evaluation of the current
// thread.  Returns true if a step was executed; false if the program
// has terminated.
//
// FIXME: should not panic!
func (intrp *Interpreter) Step() bool {
	if len(intrp.threads) == 0 {
		return false
	}
	for intrp.threads[0].state == nil && len(intrp.threads) > 1 {
		intrp.threads = intrp.threads[1:]
	}
	thread := &intrp.threads[0]
	if thread.state == nil {
		return false
	}
	if intrp.Verbose {
		fmt.Printf("Next step is %T.step(%#v)\n", thread.state, thread.value)
	}
	thread.state, thread.value = thread.state.step(intrp, thread.value)
	if thread.state != nil {
		return true
	}
	switch thread.value.typ {
	case BREAK:
		panic(fmt.Errorf("illegal break to %s", thread.value.targ))
	case CONTINUE:
		panic(fmt.Errorf("illegal continue of %s", thread.value.targ))
	case RETURN:
		panic(fmt.Errorf("illegal return of %s", thread.value.value().ToString()))
	case THROW:
		error := intrp.toObject(thread.value.value(), nil)
		name, _ := error.Get("name")
		message, _ := error.Get("message")
		panic(fmt.Errorf("unhandled exception: %s: %s", name, message))
	}
	return false
}

// Run calls Step() repeatedly until it returns false.
func (intrp *Interpreter) Run() {
	for intrp.Step() {
	}
}

// Value returns the final value computed by the last statement
// expression of the program.
func (intrp *Interpreter) Value() data.Value {
	if len(intrp.threads) == 0 || intrp.threads[0].value == nil {
		return nil
	}
	return intrp.threads[0].value.value()
}

// toObject coerces its first argument into an object.  This
// implements the ToObject algorithm in ES5.1 §9.9.
//
// FIXME: should throw error for null, undefined.
func (intrp *Interpreter) toObject(value data.Value, owner *data.Owner) data.Object {
	switch v := value.(type) {
	case data.Boolean:
		return data.NewBoxedBoolean(owner, intrp.protos.BooleanProto, v)
	case data.Number:
		return data.NewBoxedNumber(owner, intrp.protos.NumberProto, v)
	case data.String:
		return data.NewBoxedString(owner, intrp.protos.StringProto, v)
	case data.Object:
		return v
	default:
		panic(fmt.Errorf("Can't coerce a %T to Object", v))
	}
}

// nativeError takes a data.NativeError error specification and an
// owner and creates a corresponding native error object.
func (intrp *Interpreter) nativeError(ne *data.NativeError, o *data.Owner) data.Object {
	var e data.Object
	switch ne.Type {
	case data.EvalError:
		e = data.NewObject(o, intrp.protos.EvalErrorProto)
	case data.RangeError:
		e = data.NewObject(o, intrp.protos.RangeErrorProto)
	case data.ReferenceError:
		e = data.NewObject(o, intrp.protos.ReferenceErrorProto)
	case data.SyntaxError:
		e = data.NewObject(o, intrp.protos.SyntaxErrorProto)
	case data.TypeError:
		e = data.NewObject(o, intrp.protos.TypeErrorProto)
	case data.URIError:
		e = data.NewObject(o, intrp.protos.URIErrorProto)
	default:
		panic(fmt.Errorf("Unknown NativeErrorType %d", ne.Type))
	}
	e.Set("message", data.String(ne.Message))
	return e
}

func (intrp *Interpreter) throw(ne *data.NativeError) *cval {
	// FIXME: set owner.
	return &cval{THROW, intrp.nativeError(ne, nil), ""}
}
