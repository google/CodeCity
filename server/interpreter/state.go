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
	"CodeCity/server/interpreter/object"
)

// state is the interface implemented by each of the types
// representing different possible next states for the interpreter
// (roughly: one state per ast.Node implementation); each value of
// this type represents a possible state of the computation.
type state interface {
	// step performs the next step in the evaluation of the program, and
	// returns the new state execution state.
	step() state
}

// valueAcceptor is the interface implemented by any object (mostly
// states with subexpressions) that can accept a value.
type valueAcceptor interface {
	// acceptValue receives the value resulting from the evaluation of
	//a child expression.
	/// It is normally called by the
	// subexpression's step method, typically as follows:
	//
	//        // ... compute value to be returned ...
	//        this.parent.acceptValue(value)
	//        return this.parent
	//    }
	acceptValue(object.Value)
}

// newState creates a state object corresponding to the given AST
// node.  The parent parameter represents the state the interpreter
// should return to after evaluating the tree rooted at node.
func newState(parent state, scope *scope, node ast.Node) state {
	var sc = stateCommon{parent, scope}
	switch n := node.(type) {
	case *ast.AssignmentExpression:
		s := stateAssignmentExpression{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.BinaryExpression:
		s := stateBinaryExpression{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.BlockStatement:
		s := stateBlockStatement{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.CallExpression:
		s := stateCallExpression{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.ConditionalExpression:
		s := stateConditionalExpression{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.EmptyStatement:
		s := stateEmptyStatement{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.ExpressionStatement:
		s := stateExpressionStatement{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.FunctionDeclaration:
		s := stateFunctionDeclaration{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.FunctionExpression:
		s := stateFunctionExpression{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.Identifier:
		s := stateIdentifier{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.IfStatement:
		s := stateIfStatement{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.Literal:
		s := stateLiteral{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.MemberExpression:
		s := stateMemberExpression{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.ObjectExpression:
		s := stateObjectExpression{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.Program:
		s := stateBlockStatement{stateCommon: sc}
		s.initFromProgram(n)
		return &s
	case *ast.VariableDeclaration:
		s := stateVariableDeclaration{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.VariableDeclarator:
		s := stateVariableDeclarator{stateCommon: sc}
		s.init(n)
		return &s
	case *ast.UpdateExpression:
		s := stateUpdateExpression{stateCommon: sc}
		s.init(n)
		return &s
	default:
		panic(fmt.Errorf("State for AST node type %T not implemented\n", n))
	}
}

/********************************************************************/

// stateCommon is a struct, intended to be embedded in most or all
// state<NodeType> types, which provides fields common to most/all
// states.
type stateCommon struct {
	// state is the state to return to once evaluation of this state
	// is finished.  (This is "state" rather than "*state" because the
	// interface value already containins a pointer to the actual
	// state<Whatever> object.)
	parent state

	// scope is the symobl table for the innermost scope.
	scope *scope
}

/********************************************************************/

type stateAssignmentExpression struct {
	stateCommon
	op    string
	left  lvalue
	rNode ast.Expression
	right object.Value
}

func (this *stateAssignmentExpression) init(node *ast.AssignmentExpression) {
	this.op = node.Operator
	this.rNode = node.Right
	this.left.init(this, this.scope, node.Left)
}

func (this *stateAssignmentExpression) step() state {
	if !this.left.ready {
		return &this.left
	} else if this.right == nil {
		return newState(this, this.scope, ast.Node(this.rNode.E))
	}

	// Do (operator)assignment:
	var r object.Value
	if this.op == "=" {
		r = this.right
	} else {
		var op string
		switch this.op {
		case "+=":
			op = "+"
		case "-=":
			op = "-"
		case "*=":
			op = "*"
		case "/=":
			op = "/"
		case "%=":
			op = "/"
		case "<<=":
			op = "<<"
		case ">>=":
			op = ">>"
		case ">>>=":
			op = ">>>"
		case "|=":
			op = "|"
		case "^=":
			op = "^"
		case "&=":
			op = "&"
		default:
			panic(fmt.Errorf("illegal assignemnt operator %s", this.op))
		}
		r = object.BinaryOp(this.left.get(), op, this.right)
	}
	this.left.set(r)
	this.parent.(valueAcceptor).acceptValue(r)

	return this.parent
}

func (this *stateAssignmentExpression) acceptValue(v object.Value) {
	this.right = v
}

/********************************************************************/

type stateBinaryExpression struct {
	stateCommon
	op                  string
	lNode, rNode        ast.Expression
	haveLeft, haveRight bool
	left, right         object.Value
}

func (this *stateBinaryExpression) init(node *ast.BinaryExpression) {
	this.op = node.Operator
	this.lNode = node.Left
	this.rNode = node.Right
	this.haveLeft = false
	this.haveRight = false
}

func (this *stateBinaryExpression) step() state {
	if !this.haveLeft {
		return newState(this, this.scope, ast.Node(this.lNode.E))
	} else if !this.haveRight {
		return newState(this, this.scope, ast.Node(this.rNode.E))
	}

	var r object.Value = object.BinaryOp(this.left, this.op, this.right)
	this.parent.(valueAcceptor).acceptValue(r)
	return this.parent

}

func (this *stateBinaryExpression) acceptValue(v object.Value) {
	if this.scope.interpreter.Verbose {
		fmt.Printf("stateBinaryExpression just got %v.\n", v)
	}
	if !this.haveLeft {
		this.left = v
		this.haveLeft = true
	} else if !this.haveRight {
		this.right = v
		this.haveRight = true
	} else {
		panic(fmt.Errorf("too may values"))
	}
}

/********************************************************************/

type stateBlockStatement struct {
	stateCommon
	body  ast.Statements
	value object.Value
	n     int
}

func (this *stateBlockStatement) initFromProgram(node *ast.Program) {
	this.body = node.Body
}

func (this *stateBlockStatement) init(node *ast.BlockStatement) {
	this.body = node.Body
}

func (this *stateBlockStatement) step() state {
	if this.n < len(this.body) {
		s := newState(this, this.scope, (this.body)[this.n])
		this.n++
		return s
	}
	return this.parent
}

/********************************************************************/

type stateCallExpression struct {
	stateCommon
	callee ast.Expression
	args   ast.Expressions
	cl     *closure
	ns     *scope // New scope being constructed
	n      int    // Which arg are we evaluating?
}

func (this *stateCallExpression) init(node *ast.CallExpression) {
	this.callee = node.Callee
	this.args = node.Arguments
}

func (this *stateCallExpression) step() state {
	if this.cl == nil {
		// First visit: evaluate function to get closure
		if this.ns != nil {
			panic("ns but not cl???")
		}
		return newState(this, this.scope, this.callee.E)
	}
	if this.n == 0 {
		// Set up scope:
		this.ns = newScope(this.scope, this.scope.interpreter)
		this.ns.populate(this.cl.body)
	}
	// Subsequent visits: evaluate arguments
	if this.n < len(this.args) {
		// FIXME: do error checking for param/arg count mismatch
		return newState(this, this.scope, this.args[this.n])
	}
	// Last visit: evaluate function call
	return newState(this.parent, this.ns, this.cl.body)
}

func (this *stateCallExpression) acceptValue(v object.Value) {
	if this.cl == nil {
		// First value: should be closure
		cl, ok := v.(*closure)
		if !ok {
			panic("can't call non-closure")
		}
		this.cl = cl
	} else if this.n < len(this.args) {
		this.ns.newVar(this.cl.params[this.n], v)
		this.n++
	} else {

		panic("should not re-visit already-evaluated stateCallExpression")
	}
}

/********************************************************************/

type stateConditionalExpression struct {
	stateCommon
	test       ast.Expression
	consequent ast.Expression
	alternate  ast.Expression
	result     bool
	haveResult bool
}

func (this *stateConditionalExpression) init(node *ast.ConditionalExpression) {
	this.test = node.Test
	this.consequent = node.Consequent
	this.alternate = node.Alternate
}

func (this *stateConditionalExpression) step() state {
	if !this.haveResult {
		return newState(this, this.scope, ast.Node(this.test.E))
	}
	if this.result {
		return newState(this.parent, this.scope, this.consequent.E)
	} else {
		return newState(this.parent, this.scope, this.alternate.E)
	}
}

func (this *stateConditionalExpression) acceptValue(v object.Value) {
	if this.scope.interpreter.Verbose {
		fmt.Printf("stateConditionalExpression just got %v.\n", v)
	}
	this.result = bool(v.ToBoolean())
	this.haveResult = true
}

/********************************************************************/

type stateEmptyStatement struct {
	stateCommon
}

func (this *stateEmptyStatement) init(node *ast.EmptyStatement) {
}

func (this *stateEmptyStatement) step() state {
	return this.parent
}

/********************************************************************/

type stateExpressionStatement struct {
	stateCommon
	expr ast.Expression
	done bool
}

func (this *stateExpressionStatement) init(node *ast.ExpressionStatement) {
	this.expr = node.Expression
	this.done = false
}

func (this *stateExpressionStatement) step() state {
	if !this.done {
		this.done = true
		return newState(this, this.scope, ast.Node(this.expr.E))
	} else {
		return this.parent
	}
}

// FIXME: this is only needed so a completion value is available in
// the interpreter for test purposes (and possibly for eval); if it
// was not required we could greatly simplify this state and only
// visit it once.
func (this *stateExpressionStatement) acceptValue(v object.Value) {
	if this.scope.interpreter.Verbose {
		fmt.Printf("stateExpressionStatement just got %v.\n", v)
	}
	this.scope.interpreter.acceptValue(v)
}

/********************************************************************/

// Evaluating a function declaration has no effect; the declaration
// has already been hoisted into the enclosing scope.
type stateFunctionDeclaration struct {
	stateCommon
}

func (this *stateFunctionDeclaration) init(node *ast.FunctionDeclaration) {
}

func (this *stateFunctionDeclaration) step() state {
	return this.parent
}

/********************************************************************/

type stateFunctionExpression struct {
	stateCommon
	params []*ast.Identifier
	body   *ast.BlockStatement
}

func (this *stateFunctionExpression) init(node *ast.FunctionExpression) {
	this.params = node.Params
	this.body = node.Body
}

func (this *stateFunctionExpression) step() state {
	this.parent.(valueAcceptor).acceptValue(
		newClosure(nil, this.scope, this.params, this.body))
	return this.parent
}

/********************************************************************/

type stateIdentifier struct {
	stateCommon
	name string
}

func (this *stateIdentifier) init(node *ast.Identifier) {
	this.name = node.Name
}

func (this *stateIdentifier) step() state {
	// Note: if we getters/setters and a global scope object (like
	// window), we would have to do a check to see if we need to run a
	// getter.  But we have neither, so this is a straight variable
	// lookup.
	this.parent.(valueAcceptor).acceptValue(this.scope.getVar(this.name))
	return this.parent
}

/********************************************************************/

// This is exactly the same as stateConditionalExpression except for
// the types of consequent and alternate (and the name and node type,
// of course).
type stateIfStatement struct {
	stateCommon
	test       ast.Expression
	consequent ast.Statement
	alternate  ast.Statement
	result     bool
	haveResult bool
}

func (this *stateIfStatement) init(node *ast.IfStatement) {
	this.test = node.Test
	this.consequent = node.Consequent
	this.alternate = node.Alternate
}

func (this *stateIfStatement) step() state {
	if !this.haveResult {
		return newState(this, this.scope, ast.Node(this.test.E))
	}
	if this.result {
		return newState(this.parent, this.scope, this.consequent.S)
	} else {
		return newState(this.parent, this.scope, this.alternate.S)
	}
}

func (this *stateIfStatement) acceptValue(v object.Value) {
	if this.scope.interpreter.Verbose {
		fmt.Printf("stateIfStatement just got %v.\n", v)
	}
	this.result = bool(v.ToBoolean())
	this.haveResult = true
}

/********************************************************************/

type stateLiteral struct {
	stateCommon
	value object.Value
}

func (this *stateLiteral) init(node *ast.Literal) {
	this.value = object.NewFromRaw(node.Raw)
}

func (this *stateLiteral) step() state {
	this.parent.(valueAcceptor).acceptValue(this.value)
	return this.parent
}

/********************************************************************/

type stateMemberExpression struct {
	stateCommon
	baseExpr           ast.Expression // To be resolve to obtain base
	membExpr           ast.Expression // To be resolve to obtain name
	computed           bool           // Is this x[y] (rather than x.y)?
	base               object.Value
	name               string
	haveBase, haveName bool
}

func (this *stateMemberExpression) init(node *ast.MemberExpression) {
	this.baseExpr = node.Object
	this.membExpr = node.Property
	this.computed = node.Computed
	this.haveBase = false
	this.haveName = false
}

func (this *stateMemberExpression) step() state {
	if !this.haveBase {
		return newState(this, this.scope, ast.Node(this.baseExpr.E))
	} else if !this.haveName {
		if this.computed {
			return newState(this, this.scope, ast.Node(this.membExpr.E))
		}

		// It's expr.identifier; get name of identifier:
		i, ok := this.membExpr.E.(*ast.Identifier)
		if !ok {
			panic(fmt.Errorf("invalid computed member expression type %T",
				this.membExpr.E))
		}
		this.name = i.Name
		this.haveName = true
	}
	v, err := this.base.GetProperty(this.name)
	if err != nil {
		// FIXME: throw JS error
		panic(err)
	}
	this.parent.(valueAcceptor).acceptValue(v)
	return this.parent
}

func (this *stateMemberExpression) acceptValue(v object.Value) {
	if this.scope.interpreter.Verbose {
		fmt.Printf("stepMemberExpression just got %v.\n", v)
	}
	if !this.haveBase {
		this.base = v
		this.haveBase = true
	} else if !this.haveName {
		this.name = string(v.ToString())
		this.haveName = true
	} else {
		panic(fmt.Errorf("too may values"))
	}
}

/********************************************************************/

type stateObjectExpression struct {
	stateCommon
	props            []*ast.Property
	obj              *object.Object
	n                int
	key              string
	value            object.Value
	gotKey, gotValue bool
}

func (this *stateObjectExpression) init(node *ast.ObjectExpression) {
	this.props = node.Properties
	this.obj = nil
	this.n = 0
}

// FIXME: (maybe) getters and setters not supported.
func (this *stateObjectExpression) step() state {
	if this.obj == nil {
		if this.n != 0 {
			//			panic("lost object under construction!")
		}
		// FIXME: set owner of new object
		this.obj = object.New(nil, object.ObjectProto)
	}
	if this.n < len(this.props) {
		return newState(this, this.scope, this.props[this.n].Value.E)
	} else {
		this.parent.(valueAcceptor).acceptValue(this.obj)
		return this.parent
	}
}

func (this *stateObjectExpression) acceptValue(v object.Value) {
	if this.scope.interpreter.Verbose {
		fmt.Printf("stateObjectExpression just got %v.\n", v)
	}
	var key string
	switch k := this.props[this.n].Key.N.(type) {
	case *ast.Literal:
		v := object.NewFromRaw(k.Raw)
		key = string(v.ToString())
	case *ast.Identifier:
		key = k.Name
	}
	this.obj.SetProperty(key, v)
	this.n++
}

/********************************************************************/

type stateVariableDeclaration struct {
	stateCommon
	decls []*ast.VariableDeclarator
}

func (this *stateVariableDeclaration) init(node *ast.VariableDeclaration) {
	this.decls = node.Declarations
	if node.Kind != "var" {
		panic(fmt.Errorf("Unknown VariableDeclaration kind '%v'", node.Kind))
	}
}

func (this *stateVariableDeclaration) step() state {
	// Create a stateVariableDeclarator for every VariableDeclarator
	// that has an Init value, chaining them together so they will
	// execute in left-to-right order.
	var p = this.parent
	for i := len(this.decls) - 1; i >= 0; i-- {
		if this.decls[i].Init.E != nil {
			p = newState(p, this.scope, this.decls[i])
		}
	}
	return p
}

/********************************************************************/

type stateVariableDeclarator struct {
	stateCommon
	name  string
	expr  ast.Expression
	value object.Value
}

func (this *stateVariableDeclarator) init(node *ast.VariableDeclarator) {
	this.name = node.Id.Name
	this.expr = node.Init
	this.value = nil
}

func (this *stateVariableDeclarator) step() state {
	if this.expr.E == nil {
		panic("Why are we bothering to execute an variable declaration" +
			"(that has already been hoisted) that has no initialiser?")
	}
	if this.value == nil {
		return newState(this, this.scope, ast.Node(this.expr.E))
	} else {
		this.scope.setVar(this.name, this.value)
		return this.parent
	}
}

func (this *stateVariableDeclarator) acceptValue(v object.Value) {
	this.value = v
}

/********************************************************************/

type stateUpdateExpression struct {
	stateCommon
	op     string
	prefix bool
	arg    lvalue
}

func (this *stateUpdateExpression) init(node *ast.UpdateExpression) {
	this.op = node.Operator
	this.prefix = node.Prefix
	this.arg.init(this, this.scope, node.Argument)
}

func (this *stateUpdateExpression) step() state {
	if !this.arg.ready {
		return &this.arg
	}

	// Do update:
	v := this.arg.get()
	n, ok := v.(object.Number)
	if !ok {
		// FIXME: coerce v to number
		panic("not a number")
	}
	if !this.prefix {
		this.parent.(valueAcceptor).acceptValue(n)
	}
	switch this.op {
	case "++":
		n++
	case "--":
		n--
	}
	if this.prefix {
		this.parent.(valueAcceptor).acceptValue(n)
	}
	this.arg.set(n)
	return this.parent
}

func (this *stateUpdateExpression) acceptValue(v object.Value) {
}

/********************************************************************/

// lvalue is an object which encapsulates reading and modification of
// lvalues in assignment and update expressions.  It is (very
// approximately) an implementation of the "reference type" in the
// ECMAScript 5.1 spec, without the strict flag (as we are always
// strict).
//
// It also serves as an interpreter state for the evaluation of its own
// subexpressions.
//
// Usage:
//
//  struct stateFoo {
//      stateCommon
//      lv lvalue
//      ...
//  }
//
//  func (this *stateFoo) init(node *ast.Foo) {
//      this.lv.init(this, this.scope, node.left)
//      ...
//  }
//
//  func (this *stateFoo) step() state {
//      if(!this.lv.ready) {
//          return &this.lv
//      }
//      ...
//      lv.set(lv.get() + 1) // or whatever
//      ...
//  }
//
type lvalue struct {
	stateCommon
	baseExpr        ast.Expression // To be resolve to obtain base
	membExpr        ast.Expression // To be resolve to obtain name
	computed        bool           // Is this x[y] (rather than x.y)?
	base            object.Value   // ECMA "base"
	name            string         // ECMA "referenced name"
	haveBase, ready bool
}

func (this *lvalue) init(parent state, scope *scope, expr ast.Expression) {
	this.parent = parent
	this.scope = scope
	switch e := expr.E.(type) {
	case *ast.Identifier:
		this.base = nil
		this.name = e.Name
		this.ready = true
	case *ast.MemberExpression:
		this.baseExpr = e.Object
		this.membExpr = e.Property
		this.computed = e.Computed
		this.ready = false
	default:
		panic(fmt.Errorf("%T is not an lvalue", expr.E))
	}
}

// get returns the current value of the variable or property denoted
// by the lvalue expression.
func (this *lvalue) get() object.Value {
	if !this.ready {
		panic("lvalue not ready")
	}
	if this.base == nil {
		return this.scope.getVar(this.name)
	} else {
		v, err := this.base.GetProperty(this.name)
		if err != nil {
			// FIXME: throw JS error
			panic(err)
		}
		return v
	}
}

// set updates the variable or property denoted
// by the lvalue expression to the given value.
func (this *lvalue) set(value object.Value) {
	if !this.ready {
		panic("lvalue not ready")
	}
	if this.base == nil {
		this.scope.setVar(this.name, value)
	} else {
		this.base.SetProperty(this.name, value)
	}
}

func (this *lvalue) step() state {
	if !this.haveBase {
		return newState(this, this.scope, ast.Node(this.baseExpr.E))
	} else if !this.ready {
		if this.computed {
			return newState(this, this.scope, ast.Node(this.membExpr.E))
		}

		// It's expr.identifier; get name of identifier:
		i, ok := this.membExpr.E.(*ast.Identifier)
		if !ok {
			panic(fmt.Errorf("invalid computed member expression type %T",
				this.membExpr.E))
		}
		this.name = i.Name
		this.ready = true
		return this.parent
	} else {
		return this.parent
	}
}

func (this *lvalue) acceptValue(v object.Value) {
	if this.scope.interpreter.Verbose {
		fmt.Printf("lvalue just got %v.\n", v)
	}
	if !this.haveBase {
		this.base = v
		this.haveBase = true
	} else if !this.ready {
		this.name = string(v.ToString())
		this.ready = true
	} else {
		panic(fmt.Errorf("too may values"))
	}
}
