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

//go:generate sh -c "./gentests.js > testcases_test.go && go fmt"

import (
	"CodeCity/server/interpreter/data"
	"fmt"
	"testing"
)

func TestInterpreterSimple(t *testing.T) {
	for _, c := range tests {
		t.Run(c.name, func(t *testing.T) {
			i, err := NewFromJSON(c.ast)
			if err != nil {
				t.Error(err)
			}
			// if c.src == deleteProp {
			// 	i.Verbose = true
			// }
			i.Run()
			expected := data.NewFromRaw(c.expected)
			if v := i.Value(); v != expected {
				t.Errorf("%s == %v (%T)\n(expected %v (%T))",
					c.src, v, v, expected, expected)
			}
		})
	}
}

func TestInterpreterObjectExpression(t *testing.T) {
	i, _ := NewFromJSON(objectExpression)
	i.Run()
	v, ok := i.Value().(data.Object)
	if !ok {
		t.Errorf("{foo: \"bar\", answer: 42} returned type %T "+
			"(expected data.Object)", i.Value())
	}
	if c := len(v.OwnPropertyKeys()); c != 2 {
		t.Errorf("{foo: \"bar\", answer: 42} had %d properties "+
			"(expected 2)", c)
	}
	if foo, _ := v.Get("foo"); foo != data.String("bar") {
		t.Errorf("{foo: \"bar\", answer: 42}'s foo == %v (%T) "+
			"(expected \"bar\")", foo, foo)
	}
	if answer, _ := v.Get("answer"); answer != data.Number(42) {
		t.Errorf("{foo: \"bar\", answer: 42}'s answer == %v (%T) "+
			"(expected 42)", answer, answer)
	}
}

func TestInterpreterSwitchStatement(t *testing.T) {
	var code = []string{switchStatement, switchStatementWithBreaks}
	var expected = [][]int{{28, 31, 30, 12, 8}, {30, 20, 20, 30, 40}}
	for i := range code {
		for j := 0; j < 5; j++ {
			code := fmt.Sprintf(code[i], j, j)
			intrp, _ := NewFromJSON(code)
			intrp.Run()
			exp := data.Number(expected[i][j])
			if v := intrp.Value(); v != exp {
				t.Errorf("case test %d,%d == %v (%T) (expected %v)",
					i, j, v, v, exp)
			}
		}
	}
}

// TestPrototypeIndependence verifies that modifying the prototype of
// a builtin object in one interpreter does not result in modifying
// the value of the prototype object in a different interpreter
// instance.
func TestPrototypeIndependence(t *testing.T) {
	i1, _ := NewFromJSON(emptyProg)
	op1v, _ := i1.state.(*stateBlockStatement).scope.
		getVar("Object").(data.Object).Get("prototype")
	op1 := op1v.(data.Object)
	ap1v, _ := i1.state.(*stateBlockStatement).scope.
		getVar("Array").(data.Object).Get("prototype")
	ap1 := ap1v.(data.Object)

	i2, _ := NewFromJSON(emptyProg)
	op2v, _ := i2.state.(*stateBlockStatement).scope.
		getVar("Object").(data.Object).Get("prototype")
	op2 := op2v.(data.Object)

	if op1.HasOwnProperty("foo") {
		t.Errorf("Object.prototype.foo already defined")
	}
	if op2.HasProperty("foo") {
		t.Errorf("(other) Object.prototype.foo already defined")
	}
	op1.Set("foo", data.String("bar"))
	if !op1.HasOwnProperty("foo") {
		t.Errorf("setting Object.prototype.foo failed")
	}
	v, e := ap1.Get("foo")
	if e != nil || v != data.String("bar") {
		t.Errorf("Array.prototype.foo == %#v (%s) "+
			"(expected String(\"bar\"), nil)", v, e)
	}
	if op2.HasProperty("foo") {
		t.Errorf("(other) Object.prototype.foo now defined as %#v", v)
	}
}

func BenchmarkFibonacci(b *testing.B) {
	for i := 0; i < b.N; i++ {
		i, _ := New(fibonacci10k)
		i.Run()
	}
}

/********************************************************************/

// ({Foo: "bar", answer: 42})
// => {foo: "bar", answer: 42}
const objectExpression = `{"type":"Program","start":0,"end":26,"body":[{"type":"ExpressionStatement","start":0,"end":26,"expression":{"type":"ObjectExpression","start":0,"end":26,"properties":[{"key":{"type":"Identifier","start":2,"end":5,"name":"foo"},"value":{"type":"Literal","start":7,"end":12,"value":"bar","raw":"\"bar\""},"kind":"init"},{"key":{"type":"Identifier","start":14,"end":20,"name":"answer"},"value":{"type":"Literal","start":22,"end":24,"value":42,"raw":"42"},"kind":"init"}]}}]}`

// var x = 0
// switch(<VALUE>) {
//   case 1: x+=1
//   case 2: x+=2
//   default: x+=16
//   case 3: x+=4
//   case 4: x+=8
// }
// x
const switchStatement = `{"type":"Program","start":0,"end":102,"body":[{"type":"VariableDeclaration","start":0,"end":9,"declarations":[{"type":"VariableDeclarator","start":4,"end":9,"id":{"type":"Identifier","start":4,"end":5,"name":"x"},"init":{"type":"Literal","start":8,"end":9,"value":0,"raw":"0"}}],"kind":"var"},{"type":"SwitchStatement","start":10,"end":100,"discriminant":{"type":"Literal","start":17,"end":18,"value":%d,"raw":"%d"},"cases":[{"type":"SwitchCase","start":24,"end":36,"consequent":[{"type":"ExpressionStatement","start":32,"end":36,"expression":{"type":"AssignmentExpression","start":32,"end":36,"operator":"+=","left":{"type":"Identifier","start":32,"end":33,"name":"x"},"right":{"type":"Literal","start":35,"end":36,"value":1,"raw":"1"}}}],"test":{"type":"Literal","start":29,"end":30,"value":1,"raw":"1"}},{"type":"SwitchCase","start":39,"end":51,"consequent":[{"type":"ExpressionStatement","start":47,"end":51,"expression":{"type":"AssignmentExpression","start":47,"end":51,"operator":"+=","left":{"type":"Identifier","start":47,"end":48,"name":"x"},"right":{"type":"Literal","start":50,"end":51,"value":2,"raw":"2"}}}],"test":{"type":"Literal","start":44,"end":45,"value":2,"raw":"2"}},{"type":"SwitchCase","start":54,"end":68,"consequent":[{"type":"ExpressionStatement","start":63,"end":68,"expression":{"type":"AssignmentExpression","start":63,"end":68,"operator":"+=","left":{"type":"Identifier","start":63,"end":64,"name":"x"},"right":{"type":"Literal","start":66,"end":68,"value":16,"raw":"16"}}}],"test":null},{"type":"SwitchCase","start":71,"end":83,"consequent":[{"type":"ExpressionStatement","start":79,"end":83,"expression":{"type":"AssignmentExpression","start":79,"end":83,"operator":"+=","left":{"type":"Identifier","start":79,"end":80,"name":"x"},"right":{"type":"Literal","start":82,"end":83,"value":4,"raw":"4"}}}],"test":{"type":"Literal","start":76,"end":77,"value":3,"raw":"3"}},{"type":"SwitchCase","start":86,"end":98,"consequent":[{"type":"ExpressionStatement","start":94,"end":98,"expression":{"type":"AssignmentExpression","start":94,"end":98,"operator":"+=","left":{"type":"Identifier","start":94,"end":95,"name":"x"},"right":{"type":"Literal","start":97,"end":98,"value":8,"raw":"8"}}}],"test":{"type":"Literal","start":91,"end":92,"value":4,"raw":"4"}}]},{"type":"ExpressionStatement","start":101,"end":102,"expression":{"type":"Identifier","start":101,"end":102,"name":"x"}}]}`

// foo: {
//   switch(<VALUE>) {
//   case 1: 10;
//   case 2: 20; break;
//   default: 50;
//   case 3: 30; break foo;
//   case 4: 40;
//   }
// }
const switchStatementWithBreaks = `{"type":"Program","start":0,"end":115,"body":[{"type":"LabeledStatement","start":0,"end":115,"body":{"type":"BlockStatement","start":5,"end":115,"body":[{"type":"SwitchStatement","start":9,"end":113,"discriminant":{"type":"Literal","start":16,"end":17,"value":%d,"raw":"%d"},"cases":[{"type":"SwitchCase","start":23,"end":34,"consequent":[{"type":"ExpressionStatement","start":31,"end":34,"expression":{"type":"Literal","start":31,"end":33,"value":10,"raw":"10"}}],"test":{"type":"Literal","start":28,"end":29,"value":1,"raw":"1"}},{"type":"SwitchCase","start":37,"end":55,"consequent":[{"type":"ExpressionStatement","start":45,"end":48,"expression":{"type":"Literal","start":45,"end":47,"value":20,"raw":"20"}},{"type":"BreakStatement","start":49,"end":55,"label":null}],"test":{"type":"Literal","start":42,"end":43,"value":2,"raw":"2"}},{"type":"SwitchCase","start":58,"end":70,"consequent":[{"type":"ExpressionStatement","start":67,"end":70,"expression":{"type":"Literal","start":67,"end":69,"value":50,"raw":"50"}}],"test":null},{"type":"SwitchCase","start":73,"end":95,"consequent":[{"type":"ExpressionStatement","start":81,"end":84,"expression":{"type":"Literal","start":81,"end":83,"value":30,"raw":"30"}},{"type":"BreakStatement","start":85,"end":95,"label":{"type":"Identifier","start":91,"end":94,"name":"foo"}}],"test":{"type":"Literal","start":78,"end":79,"value":3,"raw":"3"}},{"type":"SwitchCase","start":98,"end":109,"consequent":[{"type":"ExpressionStatement","start":106,"end":109,"expression":{"type":"Literal","start":106,"end":108,"value":40,"raw":"40"}}],"test":{"type":"Literal","start":103,"end":104,"value":4,"raw":"4"}}]}]},"label":{"type":"Identifier","start":0,"end":3,"name":"foo"}}]}`

// var fibonacci = function(n, output) {
//   var a = 1, b = 1, sum;
//   for (var i = 0; i < n; i++) {
//     output.push(a);
//     sum = a + b;
//     a = b;
//     b = sum;
//   }
// }
// for(var i = 0; i < 10000; i++) {
//   var result = [];
//   fibonacci(78, result);
// }
// result
// => ???
const fibonacci10k = `{"type":"Program","start":0,"end":247,"body":[{"type":"VariableDeclaration","start":0,"end":161,"declarations":[{"type":"VariableDeclarator","start":4,"end":161,"id":{"type":"Identifier","start":4,"end":13,"name":"fibonacci"},"init":{"type":"FunctionExpression","start":16,"end":161,"id":null,"params":[{"type":"Identifier","start":25,"end":26,"name":"n"},{"type":"Identifier","start":28,"end":34,"name":"output"}],"body":{"type":"BlockStatement","start":36,"end":161,"body":[{"type":"VariableDeclaration","start":40,"end":62,"declarations":[{"type":"VariableDeclarator","start":44,"end":49,"id":{"type":"Identifier","start":44,"end":45,"name":"a"},"init":{"type":"Literal","start":48,"end":49,"value":1,"raw":"1"}},{"type":"VariableDeclarator","start":51,"end":56,"id":{"type":"Identifier","start":51,"end":52,"name":"b"},"init":{"type":"Literal","start":55,"end":56,"value":1,"raw":"1"}},{"type":"VariableDeclarator","start":58,"end":61,"id":{"type":"Identifier","start":58,"end":61,"name":"sum"},"init":null}],"kind":"var"},{"type":"ForStatement","start":65,"end":159,"init":{"type":"VariableDeclaration","start":70,"end":79,"declarations":[{"type":"VariableDeclarator","start":74,"end":79,"id":{"type":"Identifier","start":74,"end":75,"name":"i"},"init":{"type":"Literal","start":78,"end":79,"value":0,"raw":"0"}}],"kind":"var"},"test":{"type":"BinaryExpression","start":81,"end":86,"left":{"type":"Identifier","start":81,"end":82,"name":"i"},"operator":"<","right":{"type":"Identifier","start":85,"end":86,"name":"n"}},"update":{"type":"UpdateExpression","start":88,"end":91,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":88,"end":89,"name":"i"}},"body":{"type":"BlockStatement","start":93,"end":159,"body":[{"type":"ExpressionStatement","start":99,"end":114,"expression":{"type":"CallExpression","start":99,"end":113,"callee":{"type":"MemberExpression","start":99,"end":110,"object":{"type":"Identifier","start":99,"end":105,"name":"output"},"property":{"type":"Identifier","start":106,"end":110,"name":"push"},"computed":false},"arguments":[{"type":"Identifier","start":111,"end":112,"name":"a"}]}},{"type":"ExpressionStatement","start":119,"end":131,"expression":{"type":"AssignmentExpression","start":119,"end":130,"operator":"=","left":{"type":"Identifier","start":119,"end":122,"name":"sum"},"right":{"type":"BinaryExpression","start":125,"end":130,"left":{"type":"Identifier","start":125,"end":126,"name":"a"},"operator":"+","right":{"type":"Identifier","start":129,"end":130,"name":"b"}}}},{"type":"ExpressionStatement","start":136,"end":142,"expression":{"type":"AssignmentExpression","start":136,"end":141,"operator":"=","left":{"type":"Identifier","start":136,"end":137,"name":"a"},"right":{"type":"Identifier","start":140,"end":141,"name":"b"}}},{"type":"ExpressionStatement","start":147,"end":155,"expression":{"type":"AssignmentExpression","start":147,"end":154,"operator":"=","left":{"type":"Identifier","start":147,"end":148,"name":"b"},"right":{"type":"Identifier","start":151,"end":154,"name":"sum"}}}]}}]}}}],"kind":"var"},{"type":"ForStatement","start":162,"end":240,"init":{"type":"VariableDeclaration","start":166,"end":175,"declarations":[{"type":"VariableDeclarator","start":170,"end":175,"id":{"type":"Identifier","start":170,"end":171,"name":"i"},"init":{"type":"Literal","start":174,"end":175,"value":0,"raw":"0"}}],"kind":"var"},"test":{"type":"BinaryExpression","start":177,"end":186,"left":{"type":"Identifier","start":177,"end":178,"name":"i"},"operator":"<","right":{"type":"Literal","start":181,"end":186,"value":10000,"raw":"10000"}},"update":{"type":"UpdateExpression","start":188,"end":191,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":188,"end":189,"name":"i"}},"body":{"type":"BlockStatement","start":193,"end":240,"body":[{"type":"VariableDeclaration","start":197,"end":213,"declarations":[{"type":"VariableDeclarator","start":201,"end":212,"id":{"type":"Identifier","start":201,"end":207,"name":"result"},"init":{"type":"ArrayExpression","start":210,"end":212,"elements":[]}}],"kind":"var"},{"type":"ExpressionStatement","start":216,"end":238,"expression":{"type":"CallExpression","start":216,"end":237,"callee":{"type":"Identifier","start":216,"end":225,"name":"fibonacci"},"arguments":[{"type":"Literal","start":226,"end":228,"value":78,"raw":"78"},{"type":"Identifier","start":230,"end":236,"name":"result"}]}}]}},{"type":"ExpressionStatement","start":241,"end":247,"expression":{"type":"Identifier","start":241,"end":247,"name":"result"}}]}`

// An empty program.  Used to initialise interpreter for tests that
// don't involve running code.
const emptyProg = `{"type":"Program","start":0,"end":0,"body":[]}`
