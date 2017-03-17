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
	verbose bool
}

// NewInterpreter takes a JavaScript program, in the form of an
// JSON-encoded ESTree, and creates a new Interpreter that will
// execute that program.
func NewInterpreter(astJSON string) *Interpreter {
	var this = new(Interpreter)

	tree, err := ast.NewFromJSON(astJSON)
	if err != nil {
		panic(err)
	}
	this.state = newState(nil, tree)
	this.state.(*stateBlockStatement).interpreter = this
	return this
}

// Step performs the next step in the evaluation of program.  Returns
// true if a step was executed; false if the program has terminated.
func (this *Interpreter) Step() bool {
	if this.state == nil {
		return false
	}
	if this.verbose {
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

// acceptValue receives the final value computed by the program.  It
// is normally called from the step method of final state to be
// evaluated before the program terminates.
func (this *Interpreter) acceptValue(v object.Value) {
	this.value = v
}

/********************************************************************/

// state is the interface implemented by each of the types
// representing different possible next states for the interpreter
// (roughly: one state per ast.Node implementation); each value of
// this type represents a possible state of the computation.
type state interface {
	// step performs the next step in the evaluation of the program, and
	// returns the new state execution state.
	step() state

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
func newState(parent state, node ast.Node) state {
	switch n := node.(type) {
	case *ast.BinaryExpression:
		s := stateBinaryExpression{stateCommon: stateCommon{parent}}
		s.init(n)
		return &s
	case *ast.BlockStatement:
		s := stateBlockStatement{stateCommon: stateCommon{parent}}
		s.init(n)
		return &s
	case *ast.ConditionalExpression:
		s := stateConditionalExpression{stateCommon: stateCommon{parent}}
		s.init(n)
		return &s
	case *ast.EmptyStatement:
		s := stateEmptyStatement{stateCommon: stateCommon{parent}}
		s.init(n)
		return &s
	case *ast.ExpressionStatement:
		s := stateExpressionStatement{stateCommon: stateCommon{parent}}
		s.init(n)
		return &s
	case *ast.FunctionDeclaration:
		s := stateFunctionDeclaration{stateCommon: stateCommon{parent}}
		s.init(n)
		return &s
	case *ast.Literal:
		s := stateLiteral{stateCommon: stateCommon{parent}}
		s.init(n)
		return &s
	case *ast.Program:
		s := stateBlockStatement{stateCommon: stateCommon{parent}}
		s.initFromProgram(n)
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
	// state is the state to return to once evaluation of this state is
	// finished.
	parent state
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
		return newState(this, ast.Node(this.lNode.E))
	} else if !this.haveRight {
		return newState(this, ast.Node(this.rNode.E))
	}

	// FIXME: implement other operators, types

	var v object.Value
	switch this.op {
	case "+":
		v = object.Number(this.left.(object.Number) +
			this.right.(object.Number))
	case "-":
		v = object.Number(this.left.(object.Number) -
			this.right.(object.Number))
	case "*":
		v = object.Number(this.left.(object.Number) *
			this.right.(object.Number))
	case "/":
		v = object.Number(this.left.(object.Number) /
			this.right.(object.Number))
	default:
		panic("not implemented")
	}

	this.parent.acceptValue(v)
	return this.parent

}

func (this *stateBinaryExpression) acceptValue(v object.Value) {
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
	body        ast.Statements
	value       object.Value
	n           int
	interpreter *Interpreter // Used by Program nodes only
}

func (this *stateBlockStatement) initFromProgram(node *ast.Program) {
	this.body = node.Body
}

func (this *stateBlockStatement) init(node *ast.BlockStatement) {
	this.body = node.Body
}

func (this *stateBlockStatement) step() state {
	if this.n < len(this.body) {
		s := newState(this, (this.body)[this.n])
		this.n++
		return s
	}
	if this.interpreter != nil {
		this.interpreter.acceptValue(this.value)
	}
	return this.parent
}

func (this *stateBlockStatement) acceptValue(v object.Value) {
	this.value = v
}

/********************************************************************/

type stateConditionalExpression struct {
	stateCommon
	test       ast.Expression
	consequent ast.Expression
	alternate  ast.Expression
}

func (this *stateConditionalExpression) init(node *ast.ConditionalExpression) {
	this.test = node.Test
	this.consequent = node.Consequent
	this.alternate = node.Alternate
}

func (this *stateConditionalExpression) step() state {
	panic("not implemented")
	// return this.parent
}

func (this *stateConditionalExpression) acceptValue(v object.Value) {
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

func (this *stateEmptyStatement) acceptValue(v object.Value) {
	panic(fmt.Errorf("EmptyStatement can't have subexpression"))
}

/********************************************************************/

type stateExpressionStatement struct {
	stateCommon
	expr ast.Expression
}

func (this *stateExpressionStatement) init(node *ast.ExpressionStatement) {
	this.expr = node.Expression
}

func (this *stateExpressionStatement) step() state {
	return newState(this.parent, ast.Node(this.expr.E))
}

func (this *stateExpressionStatement) acceptValue(v object.Value) {
	panic("should not be reached")
}

/********************************************************************/

type stateFunctionDeclaration struct {
	stateCommon
}

func (this *stateFunctionDeclaration) init(node *ast.FunctionDeclaration) {
}

func (this *stateFunctionDeclaration) step() state {
	return this.parent
}

func (this *stateFunctionDeclaration) acceptValue(v object.Value) {
	panic(fmt.Errorf("FunctionDeclaration can't have subexpression"))
}

/********************************************************************/

type stateLiteral struct {
	stateCommon
	value object.Value
}

func (this *stateLiteral) init(node *ast.Literal) {
	this.value = object.PrimitiveFromRaw(node.Raw)
}

func (this *stateLiteral) step() state {
	this.parent.acceptValue(this.value)
	return this.parent
}

func (this *stateLiteral) acceptValue(v object.Value) {
	panic(fmt.Errorf("Literal can't have subexpression"))
}
