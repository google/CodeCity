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
	protos   *data.Protos
	builtins map[string]data.Value
	global   *scope
	threads  []thread
	Verbose  bool
}

// Thread is a single thread of execution.
type thread struct {
	state state
	value *cval
}

func newInterpreter(bare bool) *Interpreter {
	var intrp = new(Interpreter)
	intrp.protos = data.NewProtos()
	intrp.global = newScope(nil, nil)
	if bare {
		intrp.builtins = make(map[string]data.Value)
	}
	intrp.initBuiltins()
	return intrp
}

// New creates a new, empty interpreter with only the usual built-in
// global names defined.
func New() *Interpreter {
	return newInterpreter(false)
}

// NewBare creates a new, entirely empty interpreter, with nothing at
// all in the global namespace.
func NewBare() *Interpreter {
	return newInterpreter(true)
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
		error, ne := intrp.toObject(thread.value.value(), nil)
		if ne != nil {
			panic(fmt.Errorf("unhandled exception: %v", thread.value.value()))
		}
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
func (intrp *Interpreter) toObject(value data.Value, owner *data.Owner) (data.Object, *data.NativeError) {
	switch v := value.(type) {
	case data.Boolean:
		return data.NewBoxedBoolean(owner, intrp.protos.BooleanProto, v), nil
	case data.Number:
		return data.NewBoxedNumber(owner, intrp.protos.NumberProto, v), nil
	case data.String:
		return data.NewBoxedString(owner, intrp.protos.StringProto, v), nil
	case data.Object:
		return v, nil
	default:
		return nil,
			&data.NativeError{Type: data.SyntaxError,
				Message: fmt.Sprintf("Can't coerce a %T to Object", v)}
	}
}

// newError takes an error prototype object and a message string, and
// returns a new child object having the specified prototype and
// message.
func (intrp *Interpreter) newError(proto data.Object, msg string) data.Object {
	// FIXME: set owner
	e := data.NewObject(nil, proto)
	// FIXME: should this be locked down?
	e.Set("message", data.String(msg))
	return e
}

// Convenience methods for creating error objects of certain types
// using newError:

// nativeError takes a data.NativeError error specification and an
// owner and creates a corresponding native error object.
func (intrp *Interpreter) nativeError(ne *data.NativeError) data.Object {
	var p data.Object
	switch ne.Type {
	case data.EvalError:
		p = intrp.protos.EvalErrorProto
	case data.RangeError:
		p = intrp.protos.RangeErrorProto
	case data.ReferenceError:
		p = intrp.protos.ReferenceErrorProto
	case data.SyntaxError:
		p = intrp.protos.SyntaxErrorProto
	case data.TypeError:
		p = intrp.protos.TypeErrorProto
	case data.URIError:
		p = intrp.protos.URIErrorProto
	default:
		panic(fmt.Errorf("Unknown NativeErrorType %d", ne.Type))
	}
	return intrp.newError(p, ne.Message)
}

func (intrp *Interpreter) typeError(msg string) data.Object {
	return intrp.newError(intrp.protos.TypeErrorProto, msg)
}

func (intrp *Interpreter) syntaxError(msg string) data.Object {
	return intrp.newError(intrp.protos.SyntaxErrorProto, msg)
}

func (intrp *Interpreter) referenceError(msg string) data.Object {
	return intrp.newError(intrp.protos.ReferenceErrorProto, msg)
}

func (intrp *Interpreter) throw(ne *data.NativeError) *cval {
	// FIXME: set owner.
	return &cval{THROW, intrp.nativeError(ne), ""}
}
