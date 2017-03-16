package interpreter

import (
	"fmt"

	"CodeCity/server/interpreter/ast"
	"CodeCity/server/interpreter/object"
)

type Interpreter struct {
	state state
}

func NewInterpreter(astJSON string) *Interpreter {
	var this = new(Interpreter)

	tree, err := ast.NewFromJSON(astJSON)
	if err != nil {
		panic(err)
	}
	_ = tree
	return this
}

// Returns true if a step was executed; false if no more instructions.
func (this *Interpreter) Step() bool {
	if this.state == nil {
		return false
	}
	this.state = this.state.step()
	return true
}

func (this *Interpreter) Run() {
	for this.Step() {
	}
}

func (this *Interpreter) Value() object.Value {
	return object.Value(object.Number(42))
}

/********************************************************************/

type state interface {
	step() state
	acceptValue(object.Value)
}

func NewState(parent state, node ast.Node) state {
	switch n := node.(type) {
	case ast.Program:
		s := stateBlockStatement{}
		s.initFromProgram(n)
		return &s
	case ast.BlockStatement:
		s := stateBlockStatement{}
		s.init(n)
		return &s
	case ast.ExpressionStatement:
		s := stateExpressionStatement{}
		s.init(n)
		return &s
	case ast.BinaryExpression:
		s := stateBinaryExpression{}
		s.init(n)
		return &s
	case ast.Literal:
		s := stateLiteral{}
		s.init(n)
		return &s
	default:
		panic(fmt.Errorf("State for AST node type %T not implemented\n", n))
	}
}

/********************************************************************/

type stateCommon struct {
	parent state
	value  object.Value
}

func (this *stateCommon) acceptValue(v object.Value) {
	this.value = v
}

/********************************************************************/

type stateBlockStatement struct {
	stateCommon
}

func (this *stateBlockStatement) initFromProgram(node ast.Program) {
}

func (this *stateBlockStatement) init(node ast.BlockStatement) {
}

func (this *stateBlockStatement) step() state {
	return nil
}

/********************************************************************/

type stateExpressionStatement struct {
	stateCommon
}

func (this *stateExpressionStatement) init(node ast.ExpressionStatement) {
}

func (this *stateExpressionStatement) step() state {
	return nil
}

/********************************************************************/

type stateBinaryExpression struct {
	stateCommon
	//	haveLeft, haveRight bool
	//	left, right object.Value
}

func (this *stateBinaryExpression) init(node ast.BinaryExpression) {
}

func (this *stateBinaryExpression) step() state {
	return nil
}

/********************************************************************/

type stateLiteral struct {
	stateCommon
}

func (this *stateLiteral) init(node ast.Literal) {
}

func (this *stateLiteral) step() state {
	this.parent.acceptValue(object.Number(1))
	return this.parent
}
