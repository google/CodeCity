package interpreter

import (
	// "fmt"
	"CodeCity/server/interpreter/object"
	"testing"
)

const onePlusOne = `{"type":"Program","start":0,"end":5,"body":[{"type":"ExpressionStatement","start":0,"end":5,"expression":{"type":"BinaryExpression","start":0,"end":5,"left":{"type":"Literal","start":0,"end":1,"value":1,"raw":"1"},"operator":"+","right":{"type":"Literal","start":4,"end":5,"value":1,"raw":"1"}}}]}`

func TestInterpreterOnePlusOne(t *testing.T) {
	i := NewInterpreter(onePlusOne)
	i.Run()
	v := i.Value()
	if v != object.Number(2) {
		t.Errorf("1 + 1 == %v (expected 2)", v)
	}
}
