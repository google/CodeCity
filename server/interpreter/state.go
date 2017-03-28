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
		st := stateAssignmentExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.BinaryExpression:
		st := stateBinaryExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.BlockStatement:
		st := stateBlockStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.CallExpression:
		st := stateCallExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.ConditionalExpression:
		st := stateConditionalExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.EmptyStatement:
		st := stateEmptyStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.ExpressionStatement:
		st := stateExpressionStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.FunctionDeclaration:
		st := stateFunctionDeclaration{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.FunctionExpression:
		st := stateFunctionExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.Identifier:
		st := stateIdentifier{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.IfStatement:
		st := stateIfStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.Literal:
		st := stateLiteral{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.MemberExpression:
		st := stateMemberExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.ObjectExpression:
		st := stateObjectExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.Program:
		st := stateBlockStatement{stateCommon: sc}
		st.initFromProgram(n)
		return &st
	case *ast.ReturnStatement:
		st := stateReturnStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.VariableDeclaration:
		st := stateVariableDeclaration{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.VariableDeclarator:
		st := stateVariableDeclarator{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.UpdateExpression:
		st := stateUpdateExpression{stateCommon: sc}
		st.init(n)
		return &st
	default:
		panic(fmt.Errorf("state for AST node type %T not implemented", n))
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

func (st *stateAssignmentExpression) init(node *ast.AssignmentExpression) {
	st.op = node.Operator
	st.rNode = node.Right
	st.left.init(st, st.scope, node.Left)
}

func (st *stateAssignmentExpression) step() state {
	if !st.left.ready {
		return &st.left
	} else if st.right == nil {
		return newState(st, st.scope, ast.Node(st.rNode.E))
	}

	// Do (operator)assignment:
	var r object.Value
	if st.op == "=" {
		r = st.right
	} else {
		var op string
		switch st.op {
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
			panic(fmt.Errorf("illegal assignemnt operator %s", st.op))
		}
		r = object.BinaryOp(st.left.get(), op, st.right)
	}
	st.left.set(r)
	st.parent.(valueAcceptor).acceptValue(r)

	return st.parent
}

func (st *stateAssignmentExpression) acceptValue(v object.Value) {
	st.right = v
}

/********************************************************************/

type stateBinaryExpression struct {
	stateCommon
	op                  string
	lNode, rNode        ast.Expression
	haveLeft, haveRight bool
	left, right         object.Value
}

func (st *stateBinaryExpression) init(node *ast.BinaryExpression) {
	st.op = node.Operator
	st.lNode = node.Left
	st.rNode = node.Right
	st.haveLeft = false
	st.haveRight = false
}

func (st *stateBinaryExpression) step() state {
	if !st.haveLeft {
		return newState(st, st.scope, ast.Node(st.lNode.E))
	} else if !st.haveRight {
		return newState(st, st.scope, ast.Node(st.rNode.E))
	}

	var r object.Value = object.BinaryOp(st.left, st.op, st.right)
	st.parent.(valueAcceptor).acceptValue(r)
	return st.parent

}

func (st *stateBinaryExpression) acceptValue(v object.Value) {
	if st.scope.interpreter.Verbose {
		fmt.Printf("stateBinaryExpression just got %v.\n", v)
	}
	if !st.haveLeft {
		st.left = v
		st.haveLeft = true
	} else if !st.haveRight {
		st.right = v
		st.haveRight = true
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

func (st *stateBlockStatement) initFromProgram(node *ast.Program) {
	st.body = node.Body
}

func (st *stateBlockStatement) init(node *ast.BlockStatement) {
	st.body = node.Body
}

func (st *stateBlockStatement) step() state {
	if st.n < len(st.body) {
		s := newState(st, st.scope, (st.body)[st.n])
		st.n++
		return s
	}
	return st.parent
}

/********************************************************************/

type stateCallExpression struct {
	stateCommon
	callee ast.Expression
	args   ast.Expressions
	cl     *closure
	ns     *scope       // New scope being constructed
	n      int          // Which arg are we evaluating?
	called bool         // Has call itself begun?
	retVal object.Value // Value to yield to enclosing expression
}

func (st *stateCallExpression) init(node *ast.CallExpression) {
	st.callee = node.Callee
	st.args = node.Arguments
	st.retVal = object.Undefined{}
}

// step gets called once to set up evaluation of the function to be
// executed, once to set up each parameter, once to execute the
// function body, and one final time to yield the return value.
//
// BUG(cpcallen): does not set up arguments variable.
//
// BUG(cpcallen): probably does not handle argument/parameter count
// mismatch properly.
func (st *stateCallExpression) step() state {
	if st.cl == nil {
		if st.scope.interpreter.Verbose {
			fmt.Printf("sCE: first visit: eval function\n")
		}
		// First visit: evaluate function to get closure
		if st.ns != nil {
			panic("ns but not cl???")
		}
		return newState(st, st.scope, st.callee.E)
	}
	if st.n == 0 {
		if st.scope.interpreter.Verbose {
			fmt.Printf("sCE: build scope\n")
		}
		// Set up scope:
		st.ns = newScope(st.scope, st, st.scope.interpreter)
		st.ns.populate(st.cl.body)
	}
	// Subsequent visits: evaluate arguments
	if st.n < len(st.args) {
		if st.scope.interpreter.Verbose {
			fmt.Printf("sCE: eval arg %d\n", st.n)
		}
		// FIXME: do error checking for param/arg count mismatch
		return newState(st, st.scope, st.args[st.n])
	}
	if !st.called {
		if st.scope.interpreter.Verbose {
			fmt.Printf("sCE: eval body\n")
		}
		// Second last visit: evaluate function call
		st.called = true
		return newState(st, st.ns, st.cl.body)
	}
	// We're done; yield (most recent) return value:
	if st.scope.interpreter.Verbose {
		fmt.Printf("sCE: return %#v\n", st.retVal)
	}
	st.parent.(valueAcceptor).acceptValue(st.retVal)
	return st.parent
}

// acceptValue gets called once for the left hand side of the
// expression (which should supply a closure), once for each argument,
// and one or more times for the return value.  "Wait, one *or more*
// times?", I hear you ask.  Yes: it turns out that a you can "return"
// more than once from a function (even without continuations!), as
// in:
//
//     function f() {
//         try {
//             return true;
//         }
//         finally {
//             return false;
//         }
//     }
//
// so we don't propagate the return value to the caller as soon as we
// accept it; instead we just store it.
func (st *stateCallExpression) acceptValue(v object.Value) {
	if st.scope.interpreter.Verbose {
		fmt.Printf("stateCallExpression just got %v.\n", v)
	}
	if st.cl == nil {
		// accept function value
		// First value: should be closure
		cl, ok := v.(*closure)
		if !ok {
			// FIXME: throw instead of panic
			panic("can't call non-closure")
		}
		st.cl = cl
	} else if st.n < len(st.args) {
		// accept an argument value
		if st.called {
			panic("call begun before all parameters evaluated??")
		}
		st.ns.newVar(st.cl.params[st.n], v)
		st.n++
	} else {
		// accept return value
		st.retVal = v
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

func (st *stateConditionalExpression) init(node *ast.ConditionalExpression) {
	st.test = node.Test
	st.consequent = node.Consequent
	st.alternate = node.Alternate
}

func (st *stateConditionalExpression) step() state {
	if !st.haveResult {
		return newState(st, st.scope, ast.Node(st.test.E))
	}
	if st.result {
		return newState(st.parent, st.scope, st.consequent.E)
	} else {
		return newState(st.parent, st.scope, st.alternate.E)
	}
}

func (st *stateConditionalExpression) acceptValue(v object.Value) {
	if st.scope.interpreter.Verbose {
		fmt.Printf("stateConditionalExpression just got %v.\n", v)
	}
	st.result = bool(v.ToBoolean())
	st.haveResult = true
}

/********************************************************************/

type stateEmptyStatement struct {
	stateCommon
}

func (st *stateEmptyStatement) init(node *ast.EmptyStatement) {
}

func (st *stateEmptyStatement) step() state {
	return st.parent
}

/********************************************************************/

type stateExpressionStatement struct {
	stateCommon
	expr ast.Expression
	done bool
}

func (st *stateExpressionStatement) init(node *ast.ExpressionStatement) {
	st.expr = node.Expression
	st.done = false
}

func (st *stateExpressionStatement) step() state {
	if !st.done {
		st.done = true
		return newState(st, st.scope, ast.Node(st.expr.E))
	}
	return st.parent
}

// FIXME: this is only needed so a completion value is available in
// the interpreter for test purposes (and possibly for eval); if it
// was not required we could greatly simplify this state and only
// visit it once.
func (st *stateExpressionStatement) acceptValue(v object.Value) {
	if st.scope.interpreter.Verbose {
		fmt.Printf("stateExpressionStatement just got %v.\n", v)
	}
	st.scope.interpreter.acceptValue(v)
}

/********************************************************************/

// Evaluating a function declaration has no effect; the declaration
// has already been hoisted into the enclosing scope.
type stateFunctionDeclaration struct {
	stateCommon
}

func (st *stateFunctionDeclaration) init(node *ast.FunctionDeclaration) {
}

func (st *stateFunctionDeclaration) step() state {
	return st.parent
}

/********************************************************************/

type stateFunctionExpression struct {
	stateCommon
	params []*ast.Identifier
	body   *ast.BlockStatement
}

func (st *stateFunctionExpression) init(node *ast.FunctionExpression) {
	st.params = node.Params
	st.body = node.Body
}

func (st *stateFunctionExpression) step() state {
	st.parent.(valueAcceptor).acceptValue(
		newClosure(nil, st.scope, st.params, st.body))
	return st.parent
}

/********************************************************************/

type stateIdentifier struct {
	stateCommon
	name string
}

func (st *stateIdentifier) init(node *ast.Identifier) {
	st.name = node.Name
}

func (st *stateIdentifier) step() state {
	// Note: if we getters/setters and a global scope object (like
	// window), we would have to do a check to see if we need to run a
	// getter.  But we have neither, so this is a straight variable
	// lookup.
	st.parent.(valueAcceptor).acceptValue(st.scope.getVar(st.name))
	return st.parent
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

func (st *stateIfStatement) init(node *ast.IfStatement) {
	st.test = node.Test
	st.consequent = node.Consequent
	st.alternate = node.Alternate
}

func (st *stateIfStatement) step() state {
	if !st.haveResult {
		return newState(st, st.scope, ast.Node(st.test.E))
	}
	if st.result {
		return newState(st.parent, st.scope, st.consequent.S)
	} else {
		return newState(st.parent, st.scope, st.alternate.S)
	}
}

func (st *stateIfStatement) acceptValue(v object.Value) {
	if st.scope.interpreter.Verbose {
		fmt.Printf("stateIfStatement just got %v.\n", v)
	}
	st.result = bool(v.ToBoolean())
	st.haveResult = true
}

/********************************************************************/

type stateLiteral struct {
	stateCommon
	value object.Value
}

func (st *stateLiteral) init(node *ast.Literal) {
	st.value = object.NewFromRaw(node.Raw)
}

func (st *stateLiteral) step() state {
	st.parent.(valueAcceptor).acceptValue(st.value)
	return st.parent
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

func (st *stateMemberExpression) init(node *ast.MemberExpression) {
	st.baseExpr = node.Object
	st.membExpr = node.Property
	st.computed = node.Computed
	st.haveBase = false
	st.haveName = false
}

func (st *stateMemberExpression) step() state {
	if !st.haveBase {
		return newState(st, st.scope, ast.Node(st.baseExpr.E))
	} else if !st.haveName {
		if st.computed {
			return newState(st, st.scope, ast.Node(st.membExpr.E))
		}

		// It's expr.identifier; get name of identifier:
		i, ok := st.membExpr.E.(*ast.Identifier)
		if !ok {
			panic(fmt.Errorf("invalid computed member expression type %T",
				st.membExpr.E))
		}
		st.name = i.Name
		st.haveName = true
	}
	v, err := st.base.GetProperty(st.name)
	if err != nil {
		// FIXME: throw JS error
		panic(err)
	}
	st.parent.(valueAcceptor).acceptValue(v)
	return st.parent
}

func (st *stateMemberExpression) acceptValue(v object.Value) {
	if st.scope.interpreter.Verbose {
		fmt.Printf("stepMemberExpression just got %v.\n", v)
	}
	if !st.haveBase {
		st.base = v
		st.haveBase = true
	} else if !st.haveName {
		st.name = string(v.ToString())
		st.haveName = true
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

func (st *stateObjectExpression) init(node *ast.ObjectExpression) {
	st.props = node.Properties
	st.obj = nil
	st.n = 0
}

// FIXME: (maybe) getters and setters not supported.
func (st *stateObjectExpression) step() state {
	if st.obj == nil {
		if st.n != 0 {
			//			panic("lost object under construction!")
		}
		// FIXME: set owner of new object
		st.obj = object.New(nil, object.ObjectProto)
	}
	if st.n < len(st.props) {
		return newState(st, st.scope, st.props[st.n].Value.E)
	}
	st.parent.(valueAcceptor).acceptValue(st.obj)
	return st.parent
}

func (st *stateObjectExpression) acceptValue(v object.Value) {
	if st.scope.interpreter.Verbose {
		fmt.Printf("stateObjectExpression just got %v.\n", v)
	}
	var key string
	switch k := st.props[st.n].Key.N.(type) {
	case *ast.Literal:
		v := object.NewFromRaw(k.Raw)
		key = string(v.ToString())
	case *ast.Identifier:
		key = k.Name
	}
	st.obj.SetProperty(key, v)
	st.n++
}

/********************************************************************/

type stateReturnStatement struct {
	stateCommon
	arg     ast.Expression
	doneArg bool
}

func (st *stateReturnStatement) init(node *ast.ReturnStatement) {
	st.arg = node.Argument
}

// step should get called twice: once to set up evaluation of the
// argument, and a second time to do the actual return.
//
// BUG(cpcallen): finally blocks are ignored when returning.
//
// BUG(cpcallen): should throw if called outside a function
// invocation.
func (st *stateReturnStatement) step() state {
	if !st.doneArg {
		st.doneArg = true
		return newState(st, st.scope, st.arg.E)
	}
	// Short-cut directly to corresponding stateCallExpression.
	//
	// FIXME: should execute any finally blocks (TryStatement.Finalisers)
	if st.scope.caller == nil {
		// FIXME: should throw
		panic("return called outside function")
	}
	return st.scope.caller
}

func (st *stateReturnStatement) acceptValue(v object.Value) {
	st.scope.caller.acceptValue(v)
}

/********************************************************************/

type stateVariableDeclaration struct {
	stateCommon
	decls []*ast.VariableDeclarator
}

func (st *stateVariableDeclaration) init(node *ast.VariableDeclaration) {
	st.decls = node.Declarations
	if node.Kind != "var" {
		panic(fmt.Errorf("Unknown VariableDeclaration kind '%v'", node.Kind))
	}
}

func (st *stateVariableDeclaration) step() state {
	// Create a stateVariableDeclarator for every VariableDeclarator
	// that has an Init value, chaining them together so they will
	// execute in left-to-right order.
	var p = st.parent
	for i := len(st.decls) - 1; i >= 0; i-- {
		if st.decls[i].Init.E != nil {
			p = newState(p, st.scope, st.decls[i])
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

func (st *stateVariableDeclarator) init(node *ast.VariableDeclarator) {
	st.name = node.Id.Name
	st.expr = node.Init
	st.value = nil
}

func (st *stateVariableDeclarator) step() state {
	if st.expr.E == nil {
		panic("Why are we bothering to execute an variable declaration" +
			"(that has already been hoisted) that has no initialiser?")
	}
	if st.value == nil {
		return newState(st, st.scope, ast.Node(st.expr.E))
	}
	st.scope.setVar(st.name, st.value)
	return st.parent
}

func (st *stateVariableDeclarator) acceptValue(v object.Value) {
	st.value = v
}

/********************************************************************/

type stateUpdateExpression struct {
	stateCommon
	op     string
	prefix bool
	arg    lvalue
}

func (st *stateUpdateExpression) init(node *ast.UpdateExpression) {
	st.op = node.Operator
	st.prefix = node.Prefix
	st.arg.init(st, st.scope, node.Argument)
}

func (st *stateUpdateExpression) step() state {
	if !st.arg.ready {
		return &st.arg
	}

	// Do update:
	v := st.arg.get()
	n, ok := v.(object.Number)
	if !ok {
		// FIXME: coerce v to number
		panic("not a number")
	}
	if !st.prefix {
		st.parent.(valueAcceptor).acceptValue(n)
	}
	switch st.op {
	case "++":
		n++
	case "--":
		n--
	}
	if st.prefix {
		st.parent.(valueAcceptor).acceptValue(n)
	}
	st.arg.set(n)
	return st.parent
}

func (st *stateUpdateExpression) acceptValue(v object.Value) {
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
//  func (st *stateFoo) init(node *ast.Foo) {
//      st.lv.init(st, st.scope, node.left)
//      ...
//  }
//
//  func (st *stateFoo) step() state {
//      if(!st.lv.ready) {
//          return &st.lv
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

func (lv *lvalue) init(parent state, scope *scope, expr ast.Expression) {
	lv.parent = parent
	lv.scope = scope
	switch e := expr.E.(type) {
	case *ast.Identifier:
		lv.base = nil
		lv.name = e.Name
		lv.ready = true
	case *ast.MemberExpression:
		lv.baseExpr = e.Object
		lv.membExpr = e.Property
		lv.computed = e.Computed
		lv.ready = false
	default:
		panic(fmt.Errorf("%T is not an lvalue", expr.E))
	}
}

// get returns the current value of the variable or property denoted
// by the lvalue expression.
func (lv *lvalue) get() object.Value {
	if !lv.ready {
		panic("lvalue not ready")
	}
	if lv.base == nil {
		return lv.scope.getVar(lv.name)
	}
	v, err := lv.base.GetProperty(lv.name)
	if err != nil {
		// FIXME: throw JS error
		panic(err)
	}
	return v
}

// set updates the variable or property denoted
// by the lvalue expression to the given value.
func (lv *lvalue) set(value object.Value) {
	if !lv.ready {
		panic("lvalue not ready")
	}
	if lv.base == nil {
		lv.scope.setVar(lv.name, value)
	} else {
		lv.base.SetProperty(lv.name, value)
	}
}

func (lv *lvalue) step() state {
	if !lv.haveBase {
		return newState(lv, lv.scope, ast.Node(lv.baseExpr.E))
	} else if !lv.ready {
		if lv.computed {
			return newState(lv, lv.scope, ast.Node(lv.membExpr.E))
		}

		// It's expr.identifier; get name of identifier:
		i, ok := lv.membExpr.E.(*ast.Identifier)
		if !ok {
			panic(fmt.Errorf("invalid computed member expression type %T",
				lv.membExpr.E))
		}
		lv.name = i.Name
		lv.ready = true
		return lv.parent
	} else {
		return lv.parent
	}
}

func (lv *lvalue) acceptValue(v object.Value) {
	if lv.scope.interpreter.Verbose {
		fmt.Printf("lvalue just got %v.\n", v)
	}
	if !lv.haveBase {
		lv.base = v
		lv.haveBase = true
	} else if !lv.ready {
		lv.name = string(v.ToString())
		lv.ready = true
	} else {
		panic(fmt.Errorf("too may values"))
	}
}
