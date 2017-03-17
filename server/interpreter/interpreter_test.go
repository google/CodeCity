package interpreter

import (
	// "fmt"
	"CodeCity/server/interpreter/object"
	"testing"
)

func TestInterpreterBinaryOperators(t *testing.T) {
	var tests = []struct {
		src      string
		expected object.Value
	}{
		{onePlusOne, object.Number(2)},
		{twoPlusTwo, object.Number(4)},
		{simpleFourFunction, object.Number(42)},
	}

	for _, c := range tests {
		i := NewInterpreter(c.src)
		i.Run()
		if v := i.Value(); v != c.expected {
			t.Errorf("newFromRaw(%v) == %v (%T)\n(expected %v (%T))",
				c.src, v, v, c.expected, c.expected)
		}
	}
}

const onePlusOne = `{"type":"Program","start":0,"end":5,"body":[{"type":"ExpressionStatement","start":0,"end":5,"expression":{"type":"BinaryExpression","start":0,"end":5,"left":{"type":"Literal","start":0,"end":1,"value":1,"raw":"1"},"operator":"+","right":{"type":"Literal","start":4,"end":5,"value":1,"raw":"1"}}}]}`

const twoPlusTwo = `{"type":"Program","start":0,"end":5,"body":[{"type":"ExpressionStatement","start":0,"end":5,"expression":{"type":"BinaryExpression","start":0,"end":5,"left":{"type":"Literal","start":0,"end":1,"value":2,"raw":"2"},"operator":"+","right":{"type":"Literal","start":4,"end":5,"value":2,"raw":"2"}}}]}`

const sixTimesSeven = `{"type":"Program","start":0,"end":5,"body":[{"type":"ExpressionStatement","start":0,"end":5,"expression":{"type":"BinaryExpression","start":0,"end":5,"left":{"type":"Literal","start":0,"end":1,"value":6,"raw":"6"},"operator":"*","right":{"type":"Literal","start":4,"end":5,"value":7,"raw":"7"}}}]}`

const simpleFourFunction = `{"type":"Program","start":0,"end":21,"body":[{"type":"ExpressionStatement","start":0,"end":21,"expression":{"type":"BinaryExpression","start":0,"end":21,"left":{"type":"BinaryExpression","start":0,"end":12,"left":{"type":"Literal","start":1,"end":2,"value":3,"raw":"3"},"operator":"+","right":{"type":"BinaryExpression","start":5,"end":11,"left":{"type":"Literal","start":6,"end":8,"value":12,"raw":"12"},"operator":"/","right":{"type":"Literal","start":9,"end":10,"value":4,"raw":"4"}}},"operator":"*","right":{"type":"BinaryExpression","start":15,"end":21,"left":{"type":"Literal","start":16,"end":18,"value":10,"raw":"10"},"operator":"-","right":{"type":"Literal","start":19,"end":20,"value":3,"raw":"3"}}}}]}`
