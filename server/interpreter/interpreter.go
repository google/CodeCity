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
	"CodeCity/server/interpreter/object"
)

// Interpreter implements a JavaScript interpreter.
type Interpreter struct {
	state   state
	value   object.Value
	Verbose bool
}

// New takes a JavaScript program, in the form of an JSON-encoded
// ESTree, and creates a new Interpreter that will execute that
// program.
func New(astJSON string) *Interpreter {
	var this = new(Interpreter)

	tree, err := ast.NewFromJSON(astJSON)
	if err != nil {
		panic(err)
	}
	s := newScope(nil, this)
	// FIXME: insert global names into s
	s.populate(tree)
	this.state = newState(nil, s, tree)
	return this
}

// Step performs the next step in the evaluation of program.  Returns
// true if a step was executed; false if the program has terminated.
func (this *Interpreter) Step() bool {
	if this.state == nil {
		return false
	}
	if this.Verbose {
		fmt.Printf("Next step is a %T\n", this.state)
	}
	this.state = this.state.step()
	return true
}

// Run runs the program to completion.
func (this *Interpreter) Run() {
	for this.Step() {
	}
}

// Value returns the final value computed by the last statement
// expression of the program.
func (this *Interpreter) Value() object.Value {
	return this.value
}

// acceptValue receives values computed by StatementExpressions; the
// last such value accepted is the completion value of the program.
func (this *Interpreter) acceptValue(v object.Value) {
	if this.Verbose {
		fmt.Printf("Interpreter just got %v.\n", v)
	}
	this.value = v
}
