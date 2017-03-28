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

// scope is a symbol table used to implement JavaScript scope; it's
// basically just a mapping of declared variable names to values, with
// some addiontal properties:
//
// - parent is a pointer to the parent scope (if nil then this is the
// global scope)
//
// - caller is a pointer to the stepCallExpression that created the
// scope (if any; i.e., is nil in global scope).
//
// - interpreter is a pointer to the interpreter that this scope
// belongs to.  It is provided so that stateExpressionStatement can
// send a completion value to the interpreter, which is useful for
// testing purposes now and possibly for eval() later.  This may go
// away if we find a better way to test and decide not to implement
// eval().  It's on scope instead of stateCommon just to reduce the
// number of redundant copies.
//
// FIXME: readonly flag?  Or readonly if parent == nil?
type scope struct {
	vars        map[string]object.Value
	parent      *scope
	caller      *stateCallExpression
	interpreter *Interpreter
}

// newScope is a factory for scope objects.  The parent param is a
// pointer to the parent (enclosing scope); it is nil if the scope
// being created is the global scope.  The interpreter param is a
// pointer to the interpreter this scope belongs to.
func newScope(parent *scope, caller *stateCallExpression,
	interpreter *Interpreter) *scope {
	return &scope{make(map[string]object.Value), parent, caller, interpreter}
}

// newVar creates a new variabe in the scope, setting it to the given
// value (or, if the named variable already exists, updates its
// value).
func (sc *scope) newVar(name string, value object.Value) {
	sc.vars[name] = value
}

// setVar sets the named variable to the specified value, after
// first checking that it exists.
//
// FIXME: this should probably not recurse when called from
// stateVariableDeclarator, which should never be setting variables
// other than in the immediately-enclosing scope.
func (sc *scope) setVar(name string, value object.Value) {
	_, ok := sc.vars[name]
	if ok {
		sc.vars[name] = value
		return
	}
	if sc.parent != nil {
		sc.parent.setVar(name, value)
		return
	}
	panic(fmt.Errorf("can't set undeclared variable %v", name))
}

// getVar gets the current value of the specified variable, after
// first checking that it exists.
func (sc *scope) getVar(name string) object.Value {
	v, ok := sc.vars[name]
	if ok {
		return v
	}
	if sc.parent != nil {
		return sc.parent.getVar(name)
	}
	// FIXME: should probably throw
	panic(fmt.Errorf("can't get undeclared variable %v", name))
}

// populate takes a syntax (sub)tree; the tree is searched for
// declarations in it's outermost scope (i.e., ignoring function
// declarations) and updates the scope object with any variables
// found.  This is how function and variable hoisting is performed.
func (sc *scope) populate(node ast.Node) {
	switch n := node.(type) {

	// The interesting cases:
	case *ast.VariableDeclarator:
		sc.newVar(n.Id.Name, object.Undefined{})
	case *ast.FunctionDeclaration:
		// Add name of function to scope; ignore contents.
		sc.newVar(n.Id.Name, object.Undefined{})

	// The recursive cases:
	case *ast.BlockStatement:
		for _, s := range n.Body {
			sc.populate(s)
		}
	case *ast.CatchClause:
		sc.populate(n.Body)
	case *ast.DoWhileStatement:
		sc.populate(n.Body.S)
	case *ast.ForInStatement:
		sc.populate(n.Left.N)
		sc.populate(n.Body.S)
	case *ast.ForStatement:
		sc.populate(n.Init.N)
		sc.populate(n.Body.S)
	case *ast.IfStatement:
		sc.populate(n.Consequent.S)
		sc.populate(n.Alternate.S)
	case *ast.LabeledStatement:
		sc.populate(n.Body.S)
	case *ast.Program:
		for _, s := range n.Body {
			sc.populate(s)
		}
	case *ast.SwitchCase:
		for _, s := range n.Consequent {
			sc.populate(s)
		}
	case *ast.SwitchStatement:
		for _, c := range n.Cases {
			sc.populate(c)
		}
	case *ast.TryStatement:
		sc.populate(n.Block)
		sc.populate(n.Handler)
		sc.populate(n.Finalizer)
	case *ast.VariableDeclaration:
		for _, d := range n.Declarations {
			sc.populate(d)
		}
	case *ast.WhileStatement:
		sc.populate(n.Body.S)
	case *ast.WithStatement:
		panic("not implemented")

	// The cases we can ignore because they cannot contain
	// declarations:
	case *ast.ArrayExpression:
	case *ast.AssignmentExpression:
	case *ast.BinaryExpression:
	case *ast.BreakStatement:
	case *ast.CallExpression:
	case *ast.ConditionalExpression:
	case *ast.ContinueStatement:
	case *ast.DebuggerStatement:
	case *ast.EmptyStatement:
	case *ast.ExpressionStatement:
	case *ast.FunctionExpression:
	case *ast.Identifier:
	case *ast.Literal:
	case *ast.LogicalExpression:
	case *ast.MemberExpression:
	case *ast.NewExpression:
	case *ast.ObjectExpression:
	case *ast.Property:
	case *ast.ReturnStatement:
	case *ast.SequenceExpression:
	case *ast.ThisExpression:
	case *ast.ThrowStatement:
	case *ast.UnaryExpression:
	case *ast.UpdateExpression:

	// Just in case:
	default:
		panic(fmt.Errorf("Unrecognized ast.Node type %T", node))
	}
}
