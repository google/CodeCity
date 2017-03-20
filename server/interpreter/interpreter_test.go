package interpreter

import (
	"CodeCity/server/interpreter/object"
	// "fmt"
	"testing"
)

func TestInterpreter(t *testing.T) {
	var tests = []struct {
		desc     string
		src      string
		expected object.Value
	}{
		{"1+1", onePlusOne, object.Number(2)},
		{"2+2", twoPlusTwo, object.Number(4)},
		{"four functions", simpleFourFunction, object.Number(42)},
		{"variable declaration", variableDecl, object.Number(43)},
		{"?: true", condTrue, object.String("then")},
		{"?: false", condFalse, object.String("else")},
		{"if true", ifTrue, object.String("then")},
		{"if false", ifFalse, object.String("else")},
	}

	for _, c := range tests {
		i := NewInterpreter(c.src)
		i.Run()
		if v := i.Value(); v != c.expected {
			t.Errorf("%s == %v (%T)\n(expected %v (%T))",
				c.desc, v, v, c.expected, c.expected)
		}
	}
}

const onePlusOne = `{"type":"Program","start":0,"end":5,"body":[{"type":"ExpressionStatement","start":0,"end":5,"expression":{"type":"BinaryExpression","start":0,"end":5,"left":{"type":"Literal","start":0,"end":1,"value":1,"raw":"1"},"operator":"+","right":{"type":"Literal","start":4,"end":5,"value":1,"raw":"1"}}}]}`

const twoPlusTwo = `{"type":"Program","start":0,"end":5,"body":[{"type":"ExpressionStatement","start":0,"end":5,"expression":{"type":"BinaryExpression","start":0,"end":5,"left":{"type":"Literal","start":0,"end":1,"value":2,"raw":"2"},"operator":"+","right":{"type":"Literal","start":4,"end":5,"value":2,"raw":"2"}}}]}`

const sixTimesSeven = `{"type":"Program","start":0,"end":5,"body":[{"type":"ExpressionStatement","start":0,"end":5,"expression":{"type":"BinaryExpression","start":0,"end":5,"left":{"type":"Literal","start":0,"end":1,"value":6,"raw":"6"},"operator":"*","right":{"type":"Literal","start":4,"end":5,"value":7,"raw":"7"}}}]}`

// (3 + 12 / 4) * (10 - 3)
// => 42
const simpleFourFunction = `{"type":"Program","start":0,"end":21,"body":[{"type":"ExpressionStatement","start":0,"end":21,"expression":{"type":"BinaryExpression","start":0,"end":21,"left":{"type":"BinaryExpression","start":0,"end":12,"left":{"type":"Literal","start":1,"end":2,"value":3,"raw":"3"},"operator":"+","right":{"type":"BinaryExpression","start":5,"end":11,"left":{"type":"Literal","start":6,"end":8,"value":12,"raw":"12"},"operator":"/","right":{"type":"Literal","start":9,"end":10,"value":4,"raw":"4"}}},"operator":"*","right":{"type":"BinaryExpression","start":15,"end":21,"left":{"type":"Literal","start":16,"end":18,"value":10,"raw":"10"},"operator":"-","right":{"type":"Literal","start":19,"end":20,"value":3,"raw":"3"}}}}]}`

// var x = 43;
// x
// => 43
const variableDecl = `{"type":"Program","start":0,"end":13,"body":[{"type":"VariableDeclaration","start":0,"end":11,"declarations":[{"type":"VariableDeclarator","start":4,"end":10,"id":{"type":"Identifier","start":4,"end":5,"name":"x"},"init":{"type":"Literal","start":8,"end":10,"value":43,"raw":"43"}}],"kind":"var"},{"type":"ExpressionStatement","start":12,"end":13,"expression":{"type":"Identifier","start":12,"end":13,"name":"x"}}]}`

// true?"then":"else"
// => "then"
const condTrue = `{"type":"Program","start":0,"end":18,"body":[{"type":"ExpressionStatement","start":0,"end":18,"expression":{"type":"ConditionalExpression","start":0,"end":18,"test":{"type":"Literal","start":0,"end":4,"value":true,"raw":"true"},"consequent":{"type":"Literal","start":5,"end":11,"value":"then","raw":"\"then\""},"alternate":{"type":"Literal","start":12,"end":18,"value":"else","raw":"\"else\""}}}]}`

// false?"then":"else"
const condFalse = `{"type":"Program","start":0,"end":19,"body":[{"type":"ExpressionStatement","start":0,"end":19,"expression":{"type":"ConditionalExpression","start":0,"end":19,"test":{"type":"Literal","start":0,"end":5,"value":false,"raw":"false"},"consequent":{"type":"Literal","start":6,"end":12,"value":"then","raw":"\"then\""},"alternate":{"type":"Literal","start":13,"end":19,"value":"else","raw":"\"else\""}}}]}`

// if(true) {
//     "then";
// }
// else {
//     "else";
// }
// => "then"
const ifTrue = `{"type":"Program","start":0,"end":45,"body":[{"type":"IfStatement","start":0,"end":45,"test":{"type":"Literal","start":3,"end":7,"value":true,"raw":"true"},"consequent":{"type":"BlockStatement","start":9,"end":24,"body":[{"type":"ExpressionStatement","start":15,"end":22,"expression":{"type":"Literal","start":15,"end":21,"value":"then","raw":"\"then\""}}]},"alternate":{"type":"BlockStatement","start":30,"end":45,"body":[{"type":"ExpressionStatement","start":36,"end":43,"expression":{"type":"Literal","start":36,"end":42,"value":"else","raw":"\"else\""}}]}}]}`

// if(false) {
//     "then";
// }
// else {
//     "else";
// }
// => "else"
const ifFalse = `{"type":"Program","start":0,"end":46,"body":[{"type":"IfStatement","start":0,"end":46,"test":{"type":"Literal","start":3,"end":8,"value":false,"raw":"false"},"consequent":{"type":"BlockStatement","start":10,"end":25,"body":[{"type":"ExpressionStatement","start":16,"end":23,"expression":{"type":"Literal","start":16,"end":22,"value":"then","raw":"\"then\""}}]},"alternate":{"type":"BlockStatement","start":31,"end":46,"body":[{"type":"ExpressionStatement","start":37,"end":44,"expression":{"type":"Literal","start":37,"end":43,"value":"else","raw":"\"else\""}}]}}]}`
