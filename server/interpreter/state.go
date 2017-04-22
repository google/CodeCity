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

// state is the interface implemented by each of the types
// representing different possible next states for the interpreter
// (roughly: one state per ast.Node implementation); each value of
// this type represents a possible state of the computation.
type state interface {
	// step performs the next step in the evaluation of the program.
	// It accepts a *cval representing the result of the previous step,
	// and returns the new state execution state and *cval.
	step(*cval) (state, *cval)

	// getParent returns the state's parent; this is just a
	// convenience method obtaining the parent of a state of unknown
	// (concrete) type, which is not otherwise possible without
	// casting.  This method name violates the usual recommendation
	// (getter names should not contain "get") because almost all the
	// code refers directly to the .parent property rather than
	// calling this method.
	getParent() state

	// setParent sets the state's parent; this is just a convenience
	// method for reparenting a state of unknown (concrete) type,
	// which is not otherwise possible without casting.
	setParent(state)
}

// newState creates a state object corresponding to the given AST
// node.  The parent parameter represents the state the interpreter
// should return to after evaluating the tree rooted at node.
func newState(parent state, scope *scope, node ast.Node) state {
	var sc = stateCommon{parent, scope}
	switch n := node.(type) {
	case *ast.ArrayExpression:
		st := stateArrayExpression{stateCommon: sc}
		st.init(n)
		return &st
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
	case *ast.BreakStatement:
		st := stateBreakStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.SwitchCase:
		st := stateBlockStatement{stateCommon: sc}
		st.initFromSwitchCase(n)
		return &st
	case *ast.CallExpression:
		st := stateCallExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.CatchClause:
		st := stateCatchClause{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.ConditionalExpression:
		st := stateConditionalExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.ContinueStatement:
		st := stateContinueStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.DoWhileStatement:
		st := stateWhileStatement{stateCommon: sc}
		st.initFromDoWhile(n)
		return &st
	case *ast.EmptyStatement:
		st := stateEmptyStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.ExpressionStatement:
		st := stateExpressionStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.ForStatement:
		st := stateForStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.ForInStatement:
		st := stateForInStatement{stateCommon: sc}
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
	case *ast.LabeledStatement:
		st := stateLabeledStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.Literal:
		st := stateLiteral{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.LogicalExpression:
		st := stateLogicalExpression{stateCommon: sc}
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
	case *ast.SequenceExpression:
		st := stateSequenceExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.SwitchStatement:
		st := stateSwitchStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.ThisExpression:
		st := stateThisExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.ThrowStatement:
		st := stateThrowStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.TryStatement:
		st := stateTryStatement{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.UnaryExpression:
		st := stateUnaryExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.UpdateExpression:
		st := stateUpdateExpression{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.VariableDeclaration:
		st := stateVariableDeclaration{stateCommon: sc}
		st.init(n)
		return &st
	case *ast.WhileStatement:
		st := stateWhileStatement{stateCommon: sc}
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
	// state<Whatever> data.)
	parent state

	// scope is the symobl table for the innermost scope.
	scope *scope
}

// getParent returns the state's parent; this is just a convenience
// method obtaining the parent of a state of unknown (concrete) type,
// which is not otherwise possible without casting.  This method name
// violates the usual recommendation (getter names should not contain
// "get") because almost all the code refers directly to the .parent
// property rather than calling this method.
func (st stateCommon) getParent() state {
	return st.parent
}

// setParent sets the state's parent; this is just a convenience
// method for reparenting a state of unknown (concrete) type, which is
// not otherwise possible without casting.
//
// FIXME: states should be readonly to allow implementation of
// call/cc.
func (st *stateCommon) setParent(parent state) {
	st.parent = parent
}

/********************************************************************/

// labelled is an interface satisfied by all state<Type>Statement
// states, which are statements and can therefore be labeled.
type labelled interface {
	// addLabel adds the specified string to the label set for the
	// statement.
	addLabel(string)

	// hasLabel returns true if the specified string has previously
	// been added to the label set for the statement.
	hasLabel(string) bool
}

// labelsCommon is a struct, intended to be embedded in most or all
// state<Type>Statement types, which satisfies labelled.
type labelsCommon struct {
	labels []string
}

var _ labelled = (*labelsCommon)(nil)

func (lc *labelsCommon) addLabel(label string) {
	if !lc.hasLabel(label) {
		lc.labels = append(lc.labels, label)
	}
}

func (lc *labelsCommon) hasLabel(label string) bool {
	for _, l := range lc.labels {
		if l == label {
			return true
		}
	}
	return false
}

/********************************************************************/

type stateArrayExpression struct {
	stateCommon
	elems ast.Expressions
	arr   *data.Array
	n     int
}

func (st *stateArrayExpression) init(node *ast.ArrayExpression) {
	st.elems = node.Elements
}

func (st *stateArrayExpression) step(cv *cval) (state, *cval) {
	if cv == nil {
		if st.arr != nil {
			panic("array already created??")
		}
		// FIXME: set owner
		st.arr = data.NewArray(nil, data.ArrayProto)
	} else if cv.abrupt() {
		return st.parent, cv
	} else {
		// FIXME: this is somewhat inefficient.
		if cv.pval() != nil {
			err := st.arr.Set(string(data.Number(st.n).ToString()),
				cv.pval())
			if err != nil {
				panic(err)
			}
		}
		st.n++
	}
	// Find next non-elided element and evaluate it:
	for st.n < len(st.elems) {
		if st.elems[st.n] != nil {
			return newState(st, st.scope, st.elems[st.n]), nil
		}
		st.n++
	}
	// Update .length, in case there were trailing elided elements:
	err := st.arr.Set("length", data.Number(st.n).ToString())
	if err != nil {
		panic(err)
	}

	return st.parent, pval(st.arr)
}

/********************************************************************/

type stateAssignmentExpression struct {
	stateCommon
	op    string
	left  lvalue
	rNode ast.Expression
}

func (st *stateAssignmentExpression) init(node *ast.AssignmentExpression) {
	st.op = node.Operator
	st.rNode = node.Right
	st.left.init(st, st.scope, node.Left)
}

// FIXME: ToString() and ToNumber() calls in data.BinaryOp should be
// able to result in calls to user toString() and valueOf() methods
func (st *stateAssignmentExpression) step(cv *cval) (state, *cval) {
	if !st.left.ready {
		return &st.left, nil
	}
	if cv == nil {
		return newState(st, st.scope, ast.Node(st.rNode.E)), nil
	} else if cv.abrupt() {
		return st.parent, cv
	}

	var r data.Value = cv.pval()

	// Do (operator)assignment:
	if st.op != "=" {
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
		var e *data.ErrorMsg
		r, e = data.BinaryOp(st.left.get(), op, r)
		// FIXME: actually throw error here
		if e != nil {
			panic(fmt.Errorf("need to throw %#v", e))
		}
	}
	st.left.put(r)
	return st.parent, pval(r)
}

/********************************************************************/

type stateBinaryExpression struct {
	stateCommon
	op           string
	lNode, rNode ast.Expression
	left         data.Value
}

func (st *stateBinaryExpression) init(node *ast.BinaryExpression) {
	st.op = node.Operator
	st.lNode = node.Left
	st.rNode = node.Right
}

func (st *stateBinaryExpression) step(cv *cval) (state, *cval) {
	if cv == nil {
		return newState(st, st.scope, ast.Node(st.lNode.E)), nil
	} else if cv.abrupt() {
		return st.parent, cv
	} else if st.left == nil {
		st.left = cv.pval()
		return newState(st, st.scope, ast.Node(st.rNode.E)), nil
	}
	r, e := data.BinaryOp(st.left, st.op, cv.pval())
	// FIXME: actually throw error here
	if e != nil {
		panic(fmt.Errorf("need to throw %#v", e))
	}
	return st.parent, pval(r)
}

/********************************************************************/

type stateBlockStatement struct {
	stateCommon
	labelsCommon
	body ast.Statements
	n    int
	val  data.Value
}

func (st *stateBlockStatement) init(node *ast.BlockStatement) {
	st.body = node.Body
}

func (st *stateBlockStatement) initFromProgram(node *ast.Program) {
	st.body = node.Body
	st.val = data.Undefined{}
}

func (st *stateBlockStatement) initFromSwitchCase(node *ast.SwitchCase) {
	st.body = node.Consequent
}

func (st *stateBlockStatement) step(cv *cval) (state, *cval) {
	if cv != nil {
		if cv.val != nil {
			st.val = cv.val
		}
		if cv.abrupt() || st.n >= len(st.body) {
			return st.parent, &cval{cv.typ, st.val, cv.targ}
		}
	}
	if len(st.body) == 0 {
		return st.parent, pval(nil)
	}
	s := newState(st, st.scope, (st.body)[st.n])
	st.n++
	return s, nil
}

/********************************************************************/

type stateBreakStatement struct {
	stateCommon
	labelsCommon
	label string
}

func (st *stateBreakStatement) init(node *ast.BreakStatement) {
	if node.Label != nil {
		st.label = node.Label.Name
	}
}

func (st *stateBreakStatement) step(cv *cval) (state, *cval) {
	return st.parent, &cval{BREAK, nil, st.label}
}

/********************************************************************/

type stateCallExpression struct {
	stateCommon
	callee ast.Expression
	args   ast.Expressions
	cl     *closure   // Actual function to call
	this   data.Value // Value of 'this' in method call
	ns     *scope     // New scope being constructed
	n      int        // Which arg are we evaluating?
	called bool       // Has call itself begun?
}

func (st *stateCallExpression) init(node *ast.CallExpression) {
	st.callee = node.Callee
	st.args = node.Arguments
}

// step gets called once to set up evaluation of the function to be
// executed, once to set up each parameter, once to initiate execution
// of the function body, and one final time to process the return
// value.
//
// BUG(cpcallen): does not set up arguments variable.
//
// BUG(cpcallen): probably does not handle argument/parameter count
// mismatch properly.
func (st *stateCallExpression) step(cv *cval) (state, *cval) {
	if cv == nil {
		// First visit: evaluate function to get closure
		if st.ns != nil {
			panic("have scope already??")
		}
		if st.cl != nil {
			panic("have closure already??")
		}
		return newState(st, st.scope, st.callee.E), nil
	} else if cv.abrupt() && cv.typ != RETURN { // RETURN handled below
		return st.parent, cv
	}

	if st.cl == nil {
		// Save closure:
		st.cl = cv.pval().(*closure)
		// Set up scope.  st.this will have been set as a side effect
		// of evaluating callee, if callee was a MemberExpression.
		// FIXME: this is an ugly hack.
		st.ns = newScope(st.scope, st.this)
		st.ns.populate(st.cl.body)
	} else if !st.called {
		// Save arguments:
		st.ns.newVar(st.cl.params[st.n], cv.pval())
		st.n++
	}

	// Subsequent visits: evaluate arguments
	if st.n < len(st.args) {
		// FIXME: do error checking for param/arg count mismatch
		return newState(st, st.scope, st.args[st.n]), nil
	}

	if !st.called {
		// Second last visit: evaluate function call
		st.called = true
		return newState(st, st.ns, st.cl.body), nil
	}

	// We're done: process return value:
	switch cv.typ {
	case RETURN:
		cv.typ = NORMAL
	case THROW:
		// fine; leave as-is
	case NORMAL:
		cv = &cval{NORMAL, data.Undefined{}, ""}
	default:
		panic(fmt.Errorf("unexpected cval %#v", cv))
	}
	return st.parent, cv
}

/********************************************************************/

type stateCatchClause struct {
	stateCommon
	param string
	body  *ast.BlockStatement
}

func (st *stateCatchClause) init(node *ast.CatchClause) {
	st.param = node.Param.Name
	st.body = node.Body
}

func (st *stateCatchClause) step(cv *cval) (state, *cval) {
	sc := newScope(st.scope, st.scope.this)
	sc.newVar(st.param, cv.pval())
	return newState(st.parent, sc, st.body), nil
}

/********************************************************************/

type stateConditionalExpression struct {
	stateCommon
	test       ast.Expression
	consequent ast.Expression
	alternate  ast.Expression
}

func (st *stateConditionalExpression) init(node *ast.ConditionalExpression) {
	st.test = node.Test
	st.consequent = node.Consequent
	st.alternate = node.Alternate
}

func (st *stateConditionalExpression) step(cv *cval) (state, *cval) {
	if cv == nil {
		return newState(st, st.scope, ast.Node(st.test.E)), nil
	} else if cv.abrupt() {
		return st.parent, cv
	} else if cv.pval().ToBoolean() {
		return newState(st.parent, st.scope, st.consequent.E), nil
	} else {
		return newState(st.parent, st.scope, st.alternate.E), nil
	}
}

/********************************************************************/

type stateContinueStatement struct {
	stateCommon
	labelsCommon
	label string
}

func (st *stateContinueStatement) init(node *ast.ContinueStatement) {
	if node.Label != nil {
		st.label = node.Label.Name
	}
}

func (st *stateContinueStatement) step(cv *cval) (state, *cval) {
	return st.parent, &cval{CONTINUE, nil, st.label}
}

/********************************************************************/

type stateEmptyStatement struct {
	stateCommon
	labelsCommon
}

func (st *stateEmptyStatement) init(node *ast.EmptyStatement) {
}

func (st *stateEmptyStatement) step(cv *cval) (state, *cval) {
	return st.parent, &cval{NORMAL, nil, ""}
}

/********************************************************************/

type stateExpressionStatement struct {
	stateCommon
	labelsCommon
	expr ast.Expression
}

func (st *stateExpressionStatement) init(node *ast.ExpressionStatement) {
	st.expr = node.Expression
}

func (st *stateExpressionStatement) step(cv *cval) (state, *cval) {
	if cv == nil {
		return newState(st, st.scope, ast.Node(st.expr.E)), nil
	}
	return st.parent, cv
}

/********************************************************************/

type stateForState int

const (
	forUnstarted stateForState = iota
	forInit
	forTest
	forUpdate
	forBody
)

type stateForStatement struct {
	stateCommon
	labelsCommon
	ini      ast.ForStatementInit
	tst, upd ast.Expression
	body     ast.Statement
	state    stateForState
	val      data.Value // For completion value
}

func (st *stateForStatement) init(node *ast.ForStatement) {
	st.ini = node.Init
	st.tst = node.Test
	st.upd = node.Update
	st.body = node.Body
	st.state = forUnstarted
}

func (st *stateForStatement) step(cv *cval) (state, *cval) {
	// Handle return value from previous evaluation:
	switch st.state {
	case forUnstarted:
		if cv != nil {
			panic("internal error: for loop not started")
		}
	case forInit, forUpdate:
		if cv.abrupt() {
			return st.parent, cv
		}
	case forTest:
		if cv.abrupt() {
			return st.parent, cv
		} else if cv.pval().ToBoolean() == false {
			return st.parent, &cval{NORMAL, st.val, ""}
		}
	case forBody:
		st.val = cv.val
		if cv.typ == BREAK && (cv.targ == "" || st.hasLabel(cv.targ)) {
			return st.parent, &cval{NORMAL, st.val, ""}
		} else if (cv.typ != CONTINUE || !(cv.targ == "" ||
			st.hasLabel(cv.targ))) && cv.abrupt() {
			return st.parent, cv
		}
	default:
		panic("invalid for statement state")
	}

	// Figure out what to evaluate next:
	for {
		switch st.state {
		case forUnstarted:
			if vd, isVarDecl := st.ini.N.(*ast.VariableDeclaration); isVarDecl {
				st.state = forInit
				return newState(st, st.scope, vd), nil
			}
			fallthrough
		case forInit, forUpdate:
			if st.tst.E != nil {
				st.state = forTest
				return newState(st, st.scope, st.tst.E), nil
			}
			fallthrough
		case forTest:
			// Must have a body.  (FIXME: error check invalid ast?)
			st.state = forBody
			return newState(st, st.scope, st.body.S), nil
		case forBody:
			if st.upd.E != nil {
				st.state = forUpdate
				return newState(st, st.scope, st.upd.E), nil
			}
			st.state = forInit // enclosing for loop takes us there
		default:
			panic("invalid for statement state")
		}
	}
}

/********************************************************************/

type stateForInState int

const (
	forInUnstarted stateForInState = iota
	forInRight
	forInPrepLeft
	forInLeft
	forInBody
)

type stateForInStatement struct {
	stateCommon
	labelsCommon
	left  lvalue
	right ast.Expression
	body  ast.Statement
	state stateForInState
	val   data.Value
	iter  *data.PropIter
	pname string
}

func (st *stateForInStatement) init(node *ast.ForInStatement) {
	st.left.init(st, st.scope, node.Left)
	st.right = node.Right
	st.body = node.Body
	st.state = forInUnstarted
}

func (st *stateForInStatement) step(cv *cval) (state, *cval) {
	for {
		// Handle return value from previous evaluation:
		switch st.state {
		case forInUnstarted:
			if cv != nil {
				panic("internal error: for-in loop not started")
			}
			st.state = forInRight
			return newState(st, st.scope, st.right.E), nil

		case forInRight:
			if cv.abrupt() {
				return st.parent, cv
			}
			obj := cv.pval()
			// FIXME: should call ToObject() which in turn could call user
			// code to get valueOf().
			if (obj == data.Null{} || obj == data.Undefined{}) {
				return st.parent, &cval{NORMAL, nil, ""}
			}
			st.iter = data.NewPropIter(obj)
			fallthrough
		case forInPrepLeft:
			n, ok := st.iter.Next()
			if !ok {
				return st.parent, &cval{NORMAL, st.val, ""}
			}
			st.pname = n
			st.left.reset()
			if !st.left.ready {
				st.state = forInLeft
				return &st.left, nil
			}
			cv = nil
			fallthrough
		case forInLeft:
			if cv != nil && cv.abrupt() {
				return st.parent, cv
			}
			st.left.put(data.String(st.pname))
			st.state = forInBody
			return newState(st, st.scope, st.body.S), nil

		case forInBody:
			if cv.val != nil {
				st.val = cv.val
			}
			if cv.typ == BREAK && (cv.targ == "" || st.hasLabel(cv.targ)) {
				return st.parent, &cval{NORMAL, st.val, ""}
			} else if (cv.typ != CONTINUE || !(cv.targ == "" ||
				st.hasLabel(cv.targ))) && cv.abrupt() {
				return st.parent, cv
			}
			cv = nil
			st.state = forInPrepLeft // outer for loop takes us there

		default:
			panic("invalid for-in statement state")
		}
	}
}

/********************************************************************/

// Evaluating a function declaration has no effect; the declaration
// has already been hoisted into the enclosing scope.
//
// FIXME: except it actually hasn't yet
type stateFunctionDeclaration struct {
	stateCommon
	labelsCommon
}

func (st *stateFunctionDeclaration) init(node *ast.FunctionDeclaration) {
}

func (st *stateFunctionDeclaration) step(cv *cval) (state, *cval) {
	// §13 and §13.2 of ES5.1 together seem to imply that we are
	// supposed to return the created function here, but that doesn't
	// really make sense (it's not a completion value, and this is
	// effectively a statement).
	return st.parent, &cval{NORMAL, nil, ""}
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

func (st *stateFunctionExpression) step(cv *cval) (state, *cval) {
	return st.parent, pval(newClosure(nil, st.scope, st.params, st.body))
}

/********************************************************************/

type stateIdentifier struct {
	stateCommon
	name string
}

func (st *stateIdentifier) init(node *ast.Identifier) {
	st.name = node.Name
}

func (st *stateIdentifier) step(cv *cval) (state, *cval) {
	// Note: if we getters/setters and a global scope object (like
	// window), we would have to do a check to see if we need to run a
	// getter.  But we have neither, so this is a straight variable
	// lookup.
	return st.parent, pval(st.scope.getVar(st.name))
}

/********************************************************************/

// This is very similar to stateConditionalExpression except for
// the types of consequent and alternate (and the name and node type,
// of course) and the fact that here alternate is optional.
type stateIfStatement struct {
	stateCommon
	labelsCommon
	test       ast.Expression
	consequent ast.Statement
	alternate  ast.Statement
}

func (st *stateIfStatement) init(node *ast.IfStatement) {
	st.test = node.Test
	st.consequent = node.Consequent
	st.alternate = node.Alternate
}

func (st *stateIfStatement) step(cv *cval) (state, *cval) {
	if cv == nil {
		return newState(st, st.scope, ast.Node(st.test.E)), nil
	} else if cv.abrupt() {
		return st.parent, cv
	} else if cv.pval().ToBoolean() {
		return newState(st.parent, st.scope, st.consequent.S), nil
	} else if st.alternate.S == nil {
		return st.parent, &cval{NORMAL, nil, ""}
	} else {
		return newState(st.parent, st.scope, st.alternate.S), nil
	}
}

/********************************************************************/

type stateLabeledStatement struct {
	stateCommon
	labelsCommon
	label string
	body  ast.Statement
}

func (st *stateLabeledStatement) init(node *ast.LabeledStatement) {
	st.label = node.Label.Name
	st.body = node.Body
}

func (st *stateLabeledStatement) step(cv *cval) (state, *cval) {
	if cv == nil {
		inner := newState(st, st.scope, st.body.S)
		li := inner.(labelled)
		// Add any enclosing labels to enclosed statement:
		for _, l := range st.labels {
			li.addLabel(l)
		}
		// Add this label to enclosed statement:
		li.addLabel(st.label)
		return inner, nil
	} else if cv.typ == BREAK && cv.targ == st.label {
		cv = &cval{NORMAL, cv.val, ""}
	}
	return st.parent, cv
}

/********************************************************************/

type stateLiteral struct {
	stateCommon
	val data.Value
}

func (st *stateLiteral) init(node *ast.Literal) {
	st.val = data.NewFromRaw(node.Raw)
}

func (st *stateLiteral) step(cv *cval) (state, *cval) {
	return st.parent, pval(st.val)
}

/********************************************************************/

type stateLogicalExpression struct {
	stateCommon
	op          string
	left, right ast.Expression
}

func (st *stateLogicalExpression) init(node *ast.LogicalExpression) {
	st.op = node.Operator
	st.left = node.Left
	st.right = node.Right
}

func (st *stateLogicalExpression) step(cv *cval) (state, *cval) {
	if cv == nil {
		return newState(st, st.scope, st.left.E), nil
	} else if cv.abrupt() {
		return st.parent, cv
	}
	switch st.op {
	case "&&":
		if cv.pval().ToBoolean() {
			return newState(st.parent, st.scope, st.right.E), nil // tail call
		}
		return st.parent, cv
	case "||":
		if cv.pval().ToBoolean() {
			return st.parent, cv
		}
		return newState(st.parent, st.scope, st.right.E), nil // tail call
	default:
		panic(fmt.Errorf("illegal logical operator '%s'", st.op))
	}
}

/********************************************************************/

type stateMemberExpression struct {
	stateCommon
	baseExpr ast.Expression // To be resolve to obtain base
	membExpr ast.Expression // To be resolve to obtain name
	computed bool           // Is this x[y] (rather than x.y)?
	base     data.Object
}

func (st *stateMemberExpression) init(node *ast.MemberExpression) {
	st.baseExpr = node.Object
	st.membExpr = node.Property
	st.computed = node.Computed
}

func (st *stateMemberExpression) step(cv *cval) (state, *cval) {
	if cv == nil {
		return newState(st, st.scope, ast.Node(st.baseExpr.E)), nil
	} else if cv.abrupt() {
		return st.parent, cv
	} else if st.base == nil {
		st.base = cv.pval()
		if st.computed {
			return newState(st, st.scope, ast.Node(st.membExpr.E)), nil
		}
	}

	var name string
	if st.computed {
		name = string(cv.pval().ToString())
	} else {
		// It's expr.identifier; get name of identifier:
		i, isID := st.membExpr.E.(*ast.Identifier)
		if !isID {
			panic(fmt.Errorf("invalid computed member expression type %T",
				st.membExpr.E))
		}
		name = i.Name
	}
	v, err := st.base.Get(name)
	if err != nil {
		// FIXME: throw JS error
		panic(err)
	}
	// FIXME: this is an ugly hack.
	if ce, isCE := st.parent.(*stateCallExpression); isCE {
		ce.this = st.base
	}
	return st.parent, pval(v)
}

/********************************************************************/

type stateObjectExpression struct {
	stateCommon
	props []*ast.Property
	obj   data.Object
	n     int
}

func (st *stateObjectExpression) init(node *ast.ObjectExpression) {
	st.props = node.Properties
}

// FIXME: (maybe) getters and setters not supported.
func (st *stateObjectExpression) step(cv *cval) (state, *cval) {
	if st.obj == nil {
		if st.n != 0 || cv != nil {
			panic("internal error when constructing object")
		}
		// FIXME: set owner of new object
		st.obj = data.NewObject(nil, data.ObjectProto)
	}
	if cv != nil {
		if cv.abrupt() {
			return st.parent, cv
		}
		var key string
		switch k := st.props[st.n].Key.N.(type) {
		case *ast.Literal:
			key = string(data.NewFromRaw(k.Raw).ToString())
		case *ast.Identifier:
			key = k.Name
		}
		st.obj.Set(key, cv.pval())
		st.n++
	}
	if st.n < len(st.props) {
		return newState(st, st.scope, st.props[st.n].Value.E), nil
	}
	return st.parent, pval(st.obj)
}

/********************************************************************/

type stateReturnStatement struct {
	stateCommon
	labelsCommon
	arg ast.Expression
}

func (st *stateReturnStatement) init(node *ast.ReturnStatement) {
	st.arg = node.Argument
}

// step should get called twice: once to set up evaluation of the
// argument, and a second time to do the actual return.
//
// BUG(cpcallen): should throw if called outside a function
// invocation.
func (st *stateReturnStatement) step(cv *cval) (state, *cval) {
	if cv == nil {
		// Evaluate argument:
		return newState(st, st.scope, st.arg.E), nil
	} else if cv.abrupt() {
		return st.parent, cv
	}
	return st.parent, &cval{RETURN, cv.pval(), ""}
}

/********************************************************************/

type stateSequenceExpression struct {
	stateCommon
	expressions ast.Expressions
	n           int
}

func (st *stateSequenceExpression) init(node *ast.SequenceExpression) {
	st.expressions = node.Expressions
}

func (st *stateSequenceExpression) step(cv *cval) (state, *cval) {
	if cv != nil && cv.abrupt() {
		return st.parent, cv
	}

	var next state = st
	if st.n == len(st.expressions)-1 {
		next = st.parent // tail call final subexpression
	}
	s := newState(next, st.scope, (st.expressions)[st.n])
	st.n++
	return s, nil
}

/********************************************************************/

type stateSwitchStatement struct {
	stateCommon
	labelsCommon
	discExp   ast.Expression
	cases     []*ast.SwitchCase
	disc, val data.Value
	found     bool
	n         int
	def       int
}

func (st *stateSwitchStatement) init(node *ast.SwitchStatement) {
	st.discExp = node.Discriminant
	st.cases = node.Cases
}

func (st *stateSwitchStatement) step(cv *cval) (state, *cval) {
	if cv == nil {
		// Evaluate discriminant
		return newState(st, st.scope, st.discExp.E), nil
	} else if cv.abrupt() {
		if !st.found {
			// FIXME: assert check that cv.typ == THROW
			return st.parent, cv
		}
		if cv.val != nil {
			st.val = cv.val
		}
		if cv.typ == BREAK && cv.targ == "" || st.hasLabel(cv.targ) {
			return st.parent, &cval{NORMAL, st.val, ""}
		}
		return st.parent, &cval{cv.typ, st.val, cv.targ}
	}
	if st.disc == nil {
		// Save discriminant value:
		st.disc = cv.pval()
		if st.disc == nil {
			panic("no discriminant value??")
		}
	} else if !st.found {
		// Check to see if result === discriminant:
		if st.disc == cv.pval() {
			st.found = true
		} else {
			st.n++
			if st.n < len(st.cases) && st.cases[st.n].Test.E == nil {
				st.n++ // Skip 'defaut:' case
			}
		}
	} else {
		if cv.pval() != nil {
			st.val = cv.pval()
		}
		st.n++
	}

	if !st.found {
		if st.n < len(st.cases) {
			return newState(st, st.scope, st.cases[st.n].Test.E), nil
		}
		// Find default clause, if any
		for n := 0; n < len(st.cases); n++ {
			if st.cases[n].Test.E == nil {
				st.found = true
				st.n = n
				break
			}
		}
	}
	if st.n < len(st.cases) {
		return newState(st, st.scope, st.cases[st.n]), nil
	}
	return st.parent, &cval{NORMAL, st.val, ""}
}

/********************************************************************/

type stateThisExpression struct {
	stateCommon
}

func (st *stateThisExpression) init(node *ast.ThisExpression) {
}

func (st *stateThisExpression) step(cv *cval) (state, *cval) {
	this := st.scope.this
	if this == nil {
		this = data.Undefined{}
	}
	return st.parent, &cval{NORMAL, this, ""}
}

/********************************************************************/

type stateThrowStatement struct {
	stateCommon
	labelsCommon
	arg    ast.Expression
	excptn data.Value
}

func (st *stateThrowStatement) init(node *ast.ThrowStatement) {
	st.arg = node.Argument
}

// step should get called twice: once to set up evaluation of the
// argument, and a second time to do the actual throw.
func (st *stateThrowStatement) step(cv *cval) (state, *cval) {
	if cv == nil {
		return newState(st, st.scope, st.arg.E), nil
	} else if cv.abrupt() {
		return st.parent, cv
	} else if cv.pval() == nil {
		panic("no exception??")
	}
	return st.parent, &cval{THROW, cv.pval(), ""}
}

/********************************************************************/

type stateTryStatement struct {
	stateCommon
	labelsCommon
	block              *ast.BlockStatement
	handler            *ast.CatchClause
	finalizer          *ast.BlockStatement
	cv                 *cval
	handled, finalized bool
}

func (st *stateTryStatement) init(node *ast.TryStatement) {
	st.block = node.Block
	st.handler = node.Handler
	st.finalizer = node.Finalizer
}

func (st *stateTryStatement) step(cv *cval) (state, *cval) {
	if cv == nil {
		if st.handled || st.finalized {
			panic("done block or catch before begun??")
		}
		return newState(st, st.scope, st.block), nil
	}
	if !st.handled {
		// At this point cv is result from block.
		st.handled = true
		if cv.typ == THROW && st.handler != nil {
			return newState(st, st.scope, st.handler).(*stateCatchClause),
				pval(cv.val)
		}
	}
	if !st.finalized {
		// At this point, cv is non-throw result of block, or
		// possibly-still-throw result of handling throw result from
		// block.
		if st.finalizer != nil {
			st.finalized = true
			st.cv = cv // save to re-throw
			return newState(st, st.scope, st.finalizer), nil
		}
		// There's no finalizer; just return
		return st.parent, cv
	}
	// At this point cv is result from finalizser, and st.cv is saved
	// result from block or handler.
	if cv.abrupt() {
		return st.parent, cv
	}
	return st.parent, st.cv
}

/********************************************************************/

type stateUnaryExpression struct {
	stateCommon
	op  string
	arg ast.Expression
}

func (st *stateUnaryExpression) init(node *ast.UnaryExpression) {
	st.op = node.Operator
	st.arg = node.Argument
	if !node.Prefix {
		panic("postfix unary expression??")
	}
}

// FIXME: ToNumber() should call user code if applicable
func (st *stateUnaryExpression) step(cv *cval) (state, *cval) {
	if cv == nil {
		return newState(st, st.scope, st.arg.E), nil
	} else if cv.abrupt() {
		return st.parent, cv
	}
	var r data.Value
	switch st.op {
	case "typeof":
		r = data.String(cv.pval().Typeof())
	case "void":
		r = data.Undefined{}
	case "+":
		r = cv.pval().ToNumber()
	case "-":
		r = -(cv.pval().ToNumber())
	case "~":
		r = data.Number(float64(^uint32(float64(cv.pval().ToNumber()))))
	case "!":
		r = data.Boolean(!(cv.pval().ToBoolean()))
	default:
		panic(fmt.Errorf("Unary operator \"%s\" not implemented", st.op))
	}
	return st.parent, &cval{NORMAL, r, ""}
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

// FIXME: ToNumber should be able to result in call to user valueOf
// method.
func (st *stateUpdateExpression) step(cv *cval) (state, *cval) {
	if !st.arg.ready {
		return &st.arg, nil
	}

	// Do update:
	n := st.arg.get().ToNumber()
	r := n
	switch st.op {
	case "++":
		n++
	case "--":
		n--
	default:
		panic(fmt.Errorf("illegal update operator '%s'", st.op))
	}
	if st.prefix {
		r = n
	}
	st.arg.put(n)
	return st.parent, pval(r)
}

/********************************************************************/

type stateVariableDeclaration struct {
	stateCommon
	labelsCommon
	decls []*ast.VariableDeclarator
	n     int
}

func (st *stateVariableDeclaration) init(node *ast.VariableDeclaration) {
	st.decls = node.Declarations
	if node.Kind != "var" {
		panic(fmt.Errorf("Unknown VariableDeclaration kind '%v'", node.Kind))
	}
}

func (st *stateVariableDeclaration) step(cv *cval) (state, *cval) {
	if cv != nil {
		if cv.abrupt() {
			return st.parent, cv
		}
		st.scope.setVar(st.decls[st.n].Id.Name, cv.pval())
		st.n++
	}
	// Skip any decls without initializers:
	for st.n < len(st.decls) && st.decls[st.n].Init.E == nil {
		st.n++
	}
	if st.n < len(st.decls) {
		return newState(st, st.scope, st.decls[st.n].Init.E), nil
	}
	return st.parent, &cval{NORMAL, nil, ""}
}

/********************************************************************/

type stateWhileStatement struct {
	stateCommon
	labelsCommon
	test   ast.Expression
	body   ast.Statement
	tested bool
	val    data.Value // For completion value
}

func (st *stateWhileStatement) init(node *ast.WhileStatement) {
	st.test = node.Test
	st.body = node.Body
}

func (st *stateWhileStatement) initFromDoWhile(node *ast.DoWhileStatement) {
	st.test = node.Test
	st.body = node.Body
	st.tested = true
}

func (st *stateWhileStatement) step(cv *cval) (state, *cval) {
	if cv == nil {
		if st.tested { // First iteration of a do while loop
			return newState(st, st.scope, st.body.S), nil
		}
		return newState(st, st.scope, st.test.E), nil
	}
	if !st.tested {
		if cv.abrupt() {
			return st.parent, cv
		} else if !bool(cv.pval().ToBoolean()) {
			return st.parent, &cval{NORMAL, st.val, ""}
		}
		st.tested = true
		return newState(st, st.scope, st.body.S), nil
	}
	// At this point cv is cval from body.
	st.val = cv.val
	if cv.typ != CONTINUE || !(cv.targ == "" || st.hasLabel(cv.targ)) {
		if cv.typ == BREAK && (cv.targ == "" || st.hasLabel(cv.targ)) {
			return st.parent, &cval{NORMAL, st.val, ""}
		} else if cv.abrupt() {
			return st.parent, cv
		}
	}
	st.tested = false
	return newState(st, st.scope, st.test.E), nil
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
//  func (st *stateFoo) step(cv *cval) (state, *cval) {
//      if(!st.lv.ready) {
//          return &st.lv
//      }
//      ...
//      lv.set(lv.get() + 1) // or whatever
//      ...
//  }
//
// FIXME: update this example to deal with *cvals.
// FIXME: throw if !=1 VariableDeclarator in a VariableDeclaration
// FIXME: throw if VariableDeclarator has initializer
// FIXME: throw if VariableDeclarator used in AssignmentExpression or
//        UpdateExpression (it is only valid in ForInStatement.Left)
type lvalue struct {
	stateCommon
	baseExpr        ast.Expression // To be resolve to obtain base
	membExpr        ast.Expression // To be resolve to obtain name
	computed        bool           // Is this x[y] (rather than x.y)?
	base            data.Object    // ECMA "base"
	name            string         // ECMA "referenced name"
	haveBase, ready bool
}

func (lv *lvalue) init(parent state, scope *scope, expr ast.LValue) {
	lv.parent = parent
	lv.scope = scope
	switch e := expr.N.(type) {
	case *ast.VariableDeclaration:
		lv.base = nil
		lv.name = e.Declarations[0].Id.Name
		lv.ready = true
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
		panic(fmt.Errorf("%T is not an lvalue", expr.N))
	}
}

func (lv *lvalue) reset() {
	if lv.baseExpr.E != nil || lv.membExpr.E != nil {
		lv.haveBase = false
		lv.ready = false
	}
}

// get returns the current value of the variable or property denoted
// by the lvalue expression.
func (lv *lvalue) get() data.Value {
	if !lv.ready {
		panic("lvalue not ready")
	}
	if lv.base == nil {
		return lv.scope.getVar(lv.name)
	}
	v, err := lv.base.Get(lv.name)
	if err != nil {
		// FIXME: throw JS error
		panic(err)
	}
	return v
}

// set updates the variable or property denoted
// by the lvalue expression to the given value.
func (lv *lvalue) put(value data.Value) {
	if !lv.ready {
		panic("lvalue not ready")
	}
	if lv.base == nil {
		lv.scope.setVar(lv.name, value)
	} else {
		lv.base.Set(lv.name, value)
	}
}

func (lv *lvalue) step(cv *cval) (state, *cval) {
	if lv.ready {
		panic("lvalue already ready??")
	}
	if cv == nil {
		if lv.haveBase {
			panic("lvalue already has base??")
		}
		return newState(lv, lv.scope, ast.Node(lv.baseExpr.E)), nil
	} else if cv.abrupt() {
		return lv.parent, cv
	} else if !lv.haveBase {
		lv.base = cv.pval()
		lv.haveBase = true
		if lv.computed {
			return newState(lv, lv.scope, ast.Node(lv.membExpr.E)), nil
		}
		// It's expr.identifier; get name of identifier:
		i, isID := lv.membExpr.E.(*ast.Identifier)
		if !isID {
			panic(fmt.Errorf("invalid non-computed member expression type %T",
				lv.membExpr.E))
		}
		lv.name = i.Name
		lv.ready = true
		return lv.parent, nil
	} else if !lv.ready {
		lv.name = string(cv.pval().ToString())
		lv.ready = true
		return lv.parent, nil
	} else {
		panic(fmt.Errorf("too may values"))
	}
}
