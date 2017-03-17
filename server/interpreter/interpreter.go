package interpreter

import (
	"fmt"

	"CodeCity/server/interpreter/ast"
	"CodeCity/server/interpreter/object"
)

type Interpreter struct {
	state state
	value object.Value
}

func NewInterpreter(astJSON string) *Interpreter {
	var this = new(Interpreter)

	tree, err := ast.NewFromJSON(astJSON)
	if err != nil {
		panic(err)
	}
	this.state = NewState(nil, *tree)
	this.state.(*stateBlockStatement).interpreter = this
	return this
}

// Returns true if a step was executed; false if no more instructions.
func (this *Interpreter) Step() bool {
	if this.state == nil {
		return false
	}
	fmt.Printf("Next step is a %T\n", this.state)
	this.state = this.state.step()
	return true
}

func (this *Interpreter) Run() {
	for this.Step() {
	}
}

func (this *Interpreter) Value() object.Value {
	return this.value
}

func (this *Interpreter) acceptValue(v object.Value) {
	this.value = v
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
		s.parent = parent
		s.initFromProgram(n)
		return &s
	case ast.BlockStatement:
		s := stateBlockStatement{}
		s.parent = parent
		s.init(n)
		return &s
	case *ast.ExpressionStatement:
		s := stateExpressionStatement{}
		s.parent = parent
		s.init(*n)
		return &s
	case *ast.BinaryExpression:
		s := stateBinaryExpression{}
		s.parent = parent
		s.init(*n)
		return &s
	case *ast.Literal:
		s := stateLiteral{}
		s.parent = parent
		s.init(*n)
		return &s
	default:
		panic(fmt.Errorf("State for AST node type %T not implemented\n", n))
	}
}

/********************************************************************/

type stateCommon struct {
	parent state
}

/********************************************************************/

type stateBlockStatement struct {
	stateCommon
	body        *ast.Statements
	value       object.Value
	n           int
	interpreter *Interpreter // Used by Program nodes only
}

func (this *stateBlockStatement) initFromProgram(node ast.Program) {
	this.body = node.Body
}

func (this *stateBlockStatement) init(node ast.BlockStatement) {
	this.body = node.Body
}

func (this *stateBlockStatement) step() state {
	if this.n < len(*this.body) {
		s := NewState(this, (*this.body)[this.n])
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

type stateExpressionStatement struct {
	stateCommon
	node  ast.ExpressionStatement
	value object.Value
	done  bool
}

func (this *stateExpressionStatement) init(node ast.ExpressionStatement) {
	this.node = node
}

func (this *stateExpressionStatement) step() state {
	if !this.done {
		return NewState(this, ast.Node(this.node.Expression.E))
	}
	this.parent.acceptValue(this.value)
	return this.parent

}

func (this *stateExpressionStatement) acceptValue(v object.Value) {
	this.value = v
	this.done = true
}

/********************************************************************/

type stateBinaryExpression struct {
	stateCommon
	lNode, rNode        *ast.Expression
	haveLeft, haveRight bool
	left, right         object.Value
}

func (this *stateBinaryExpression) init(node ast.BinaryExpression) {
	this.lNode = node.Left
	this.rNode = node.Right
	this.haveLeft = false
	this.haveRight = false
}

func (this *stateBinaryExpression) step() state {
	if !this.haveLeft {
		return NewState(this, ast.Node(this.lNode.E))
	} else if !this.haveRight {
		return NewState(this, ast.Node(this.rNode.E))
	} else {
		this.parent.acceptValue(object.Number(this.left.(object.Number) + this.right.(object.Number)))
		return this.parent
	}
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

type stateLiteral struct {
	stateCommon
}

func (this *stateLiteral) init(node ast.Literal) {
}

func (this *stateLiteral) step() state {
	this.parent.acceptValue(object.Number(1))
	return this.parent
}

func (this *stateLiteral) acceptValue(v object.Value) {
	panic(fmt.Errorf("literal can't have subexpression"))
}
