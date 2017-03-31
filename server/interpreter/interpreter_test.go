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
	"CodeCity/server/interpreter/object"
	// "fmt"
	"testing"
)

func TestInterpreterSimple(t *testing.T) {
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
		{"var x=0; x=44; x", simpleAssignment, object.Number(44)},
		{"var o={}; o.foo=45; o.foo", propertyAssignment, object.Number(45)},
		{"var x=45; x++; x++", postincrement, object.Number(46)},
		{"var x=45; ++x; ++x", preincrement, object.Number(47)},
		{"var x=40,y=8; x+=y; x", plusequalsLeft, object.Number(48)},
		{"var x=40,y=8; x+=y; y", plusequalsRight, object.Number(8)},
		{"\"foo\"+\"bar\"", concat, object.String("foobar")},
		{"var v; var f = function() {v = 49}; f(); v",
			simpleFunctionExpression, object.Number(49)},
		{"var v; var f = function(x) {v = x}; f(50); v",
			fExpWithParameter, object.Number(50)},
		{"(function(x){return x;})(51)", functionWithReturn, object.Number(51)},
		{"(function(){try {return true;} finally {return false;}})()",
			multipleReturn, object.Boolean(false)},
		{"var f=function(){throw 26;};try{f()}catch(e){e*2;}",
			throwCatch, object.Number(52)},
		{"51,52,53", seqExpr, object.Number(53)},
		{"foo: 54", labeledStatement, object.Number(54)},
		{"var a = 0;while(a<55){a++}a;", whileLoop, object.Number(55)},
		{"var a=56;while(false){a++};a", whileFalse, object.Number(56)},
		{"var a=56;do{a++}while(false);a", doWhileFalse, object.Number(57)},
		{"var a=57;do{a++;break;a++}while(false);a",
			breakDoWhile, object.Number(58)},
	}

	for _, c := range tests {
		i := New(c.src)
		//if c.src == labeledStatement {
		//	i.Verbose = true
		//}
		i.Run()
		if v := i.Value(); v != c.expected {
			t.Errorf("%s == %v (%T)\n(expected %v (%T))",
				c.desc, v, v, c.expected, c.expected)
		}
	}
}

func TestInterpreterObjectExpression(t *testing.T) {
	i := New(objectExpression)
	i.Run()
	v, ok := i.Value().(*object.Object)
	if !ok {
		t.Errorf("{foo: \"bar\", answer: 42} returned type %T "+
			"(expected object.Object)", i.Value())
	}
	if c := object.PropCount(v); c != 2 {
		t.Errorf("{foo: \"bar\", answer: 42} had %d properties "+
			"(expected 2)", c)
	}
	if foo, _ := v.GetProperty("foo"); foo != object.String("bar") {
		t.Errorf("{foo: \"bar\", answer: 42}'s foo == %v (%T) "+
			"(expected \"bar\")", foo, foo)
	}
	if answer, _ := v.GetProperty("answer"); answer != object.Number(42) {
		t.Errorf("{foo: \"bar\", answer: 42}'s answer == %v (%T) "+
			"(expected 42)", answer, answer)
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

// var x = 0;
// x = 44;
// x
// => 44
const simpleAssignment = `{"type":"Program","start":0,"end":20,"body":[{"type":"VariableDeclaration","start":0,"end":10,"declarations":[{"type":"VariableDeclarator","start":4,"end":9,"id":{"type":"Identifier","start":4,"end":5,"name":"x"},"init":{"type":"Literal","start":8,"end":9,"value":0,"raw":"0"}}],"kind":"var"},{"type":"ExpressionStatement","start":11,"end":18,"expression":{"type":"AssignmentExpression","start":11,"end":17,"operator":"=","left":{"type":"Identifier","start":11,"end":12,"name":"x"},"right":{"type":"Literal","start":15,"end":17,"value":44,"raw":"44"}}},{"type":"ExpressionStatement","start":19,"end":20,"expression":{"type":"Identifier","start":19,"end":20,"name":"x"}}]}`

// var o = {};
// o.foo = 45;
// o.foo
// => 45
const propertyAssignment = `{"type":"Program","start":0,"end":29,"body":[{"type":"VariableDeclaration","start":0,"end":11,"declarations":[{"type":"VariableDeclarator","start":4,"end":10,"id":{"type":"Identifier","start":4,"end":5,"name":"o"},"init":{"type":"ObjectExpression","start":8,"end":10,"properties":[]}}],"kind":"var"},{"type":"ExpressionStatement","start":12,"end":23,"expression":{"type":"AssignmentExpression","start":12,"end":22,"operator":"=","left":{"type":"MemberExpression","start":12,"end":17,"object":{"type":"Identifier","start":12,"end":13,"name":"o"},"property":{"type":"Identifier","start":14,"end":17,"name":"foo"},"computed":false},"right":{"type":"Literal","start":20,"end":22,"value":45,"raw":"45"}}},{"type":"ExpressionStatement","start":24,"end":29,"expression":{"type":"MemberExpression","start":24,"end":29,"object":{"type":"Identifier","start":24,"end":25,"name":"o"},"property":{"type":"Identifier","start":26,"end":29,"name":"foo"},"computed":false}}]}`

// var x = 45;
// x++;
// x++;
// => 46
const postincrement = `{"type":"Program","start":0,"end":21,"body":[{"type":"VariableDeclaration","start":0,"end":11,"declarations":[{"type":"VariableDeclarator","start":4,"end":10,"id":{"type":"Identifier","start":4,"end":5,"name":"x"},"init":{"type":"Literal","start":8,"end":10,"value":45,"raw":"45"}}],"kind":"var"},{"type":"ExpressionStatement","start":12,"end":16,"expression":{"type":"UpdateExpression","start":12,"end":15,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":12,"end":13,"name":"x"}}},{"type":"ExpressionStatement","start":17,"end":21,"expression":{"type":"UpdateExpression","start":17,"end":20,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":17,"end":18,"name":"x"}}}]}`

// var x = 45;
// ++x;
// ++x;
// => 47
const preincrement = `{"type":"Program","start":0,"end":21,"body":[{"type":"VariableDeclaration","start":0,"end":11,"declarations":[{"type":"VariableDeclarator","start":4,"end":10,"id":{"type":"Identifier","start":4,"end":5,"name":"x"},"init":{"type":"Literal","start":8,"end":10,"value":45,"raw":"45"}}],"kind":"var"},{"type":"ExpressionStatement","start":12,"end":16,"expression":{"type":"UpdateExpression","start":12,"end":15,"operator":"++","prefix":true,"argument":{"type":"Identifier","start":14,"end":15,"name":"x"}}},{"type":"ExpressionStatement","start":17,"end":21,"expression":{"type":"UpdateExpression","start":17,"end":20,"operator":"++","prefix":true,"argument":{"type":"Identifier","start":19,"end":20,"name":"x"}}}]}`

// "foo"+"bar"
// => "foobar"
const concat = `{"type":"Program","start":0,"end":11,"body":[{"type":"ExpressionStatement","start":0,"end":11,"expression":{"type":"BinaryExpression","start":0,"end":11,"left":{"type":"Literal","start":0,"end":5,"value":"foo","raw":"\"foo\""},"operator":"+","right":{"type":"Literal","start":6,"end":11,"value":"bar","raw":"\"bar\""}}}]}`

// var x=40, y=8
// x+=y
// x
// => 48
const plusequalsLeft = `{"type":"Program","start":0,"end":20,"body":[{"type":"VariableDeclaration","start":0,"end":13,"declarations":[{"type":"VariableDeclarator","start":4,"end":8,"id":{"type":"Identifier","start":4,"end":5,"name":"x"},"init":{"type":"Literal","start":6,"end":8,"value":40,"raw":"40"}},{"type":"VariableDeclarator","start":10,"end":13,"id":{"type":"Identifier","start":10,"end":11,"name":"y"},"init":{"type":"Literal","start":12,"end":13,"value":8,"raw":"8"}}],"kind":"var"},{"type":"ExpressionStatement","start":14,"end":18,"expression":{"type":"AssignmentExpression","start":14,"end":18,"operator":"+=","left":{"type":"Identifier","start":14,"end":15,"name":"x"},"right":{"type":"Identifier","start":17,"end":18,"name":"y"}}},{"type":"ExpressionStatement","start":19,"end":20,"expression":{"type":"Identifier","start":19,"end":20,"name":"x"}}]}`

// var x=40, y=8
// x+=y
// y
// => 8
const plusequalsRight = `{"type":"Program","start":0,"end":20,"body":[{"type":"VariableDeclaration","start":0,"end":13,"declarations":[{"type":"VariableDeclarator","start":4,"end":8,"id":{"type":"Identifier","start":4,"end":5,"name":"x"},"init":{"type":"Literal","start":6,"end":8,"value":40,"raw":"40"}},{"type":"VariableDeclarator","start":10,"end":13,"id":{"type":"Identifier","start":10,"end":11,"name":"y"},"init":{"type":"Literal","start":12,"end":13,"value":8,"raw":"8"}}],"kind":"var"},{"type":"ExpressionStatement","start":14,"end":18,"expression":{"type":"AssignmentExpression","start":14,"end":18,"operator":"+=","left":{"type":"Identifier","start":14,"end":15,"name":"x"},"right":{"type":"Identifier","start":17,"end":18,"name":"y"}}},{"type":"ExpressionStatement","start":19,"end":20,"expression":{"type":"Identifier","start":19,"end":20,"name":"y"}}]}`

// var v;
// var f = function() {v = 49}
// f();
// v;
// => 49
const simpleFunctionExpression = `{"type":"Program","start":0,"end":42,"body":[{"type":"VariableDeclaration","start":0,"end":6,"declarations":[{"type":"VariableDeclarator","start":4,"end":5,"id":{"type":"Identifier","start":4,"end":5,"name":"v"},"init":null}],"kind":"var"},{"type":"VariableDeclaration","start":7,"end":34,"declarations":[{"type":"VariableDeclarator","start":11,"end":34,"id":{"type":"Identifier","start":11,"end":12,"name":"f"},"init":{"type":"FunctionExpression","start":15,"end":34,"id":null,"params":[],"body":{"type":"BlockStatement","start":26,"end":34,"body":[{"type":"ExpressionStatement","start":27,"end":33,"expression":{"type":"AssignmentExpression","start":27,"end":33,"operator":"=","left":{"type":"Identifier","start":27,"end":28,"name":"v"},"right":{"type":"Literal","start":31,"end":33,"value":49,"raw":"49"}}}]}}}],"kind":"var"},{"type":"ExpressionStatement","start":35,"end":39,"expression":{"type":"CallExpression","start":35,"end":38,"callee":{"type":"Identifier","start":35,"end":36,"name":"f"},"arguments":[]}},{"type":"ExpressionStatement","start":40,"end":42,"expression":{"type":"Identifier","start":40,"end":41,"name":"v"}}]}`

// var v;
// var f = function(x) {v = x}
// f(50);
// v;
// => 50
const fExpWithParameter = `{"type":"Program","start":0,"end":44,"body":[{"type":"VariableDeclaration","start":0,"end":6,"declarations":[{"type":"VariableDeclarator","start":4,"end":5,"id":{"type":"Identifier","start":4,"end":5,"name":"v"},"init":null}],"kind":"var"},{"type":"VariableDeclaration","start":7,"end":34,"declarations":[{"type":"VariableDeclarator","start":11,"end":34,"id":{"type":"Identifier","start":11,"end":12,"name":"f"},"init":{"type":"FunctionExpression","start":15,"end":34,"id":null,"params":[{"type":"Identifier","start":24,"end":25,"name":"x"}],"body":{"type":"BlockStatement","start":27,"end":34,"body":[{"type":"ExpressionStatement","start":28,"end":33,"expression":{"type":"AssignmentExpression","start":28,"end":33,"operator":"=","left":{"type":"Identifier","start":28,"end":29,"name":"v"},"right":{"type":"Identifier","start":32,"end":33,"name":"x"}}}]}}}],"kind":"var"},{"type":"ExpressionStatement","start":35,"end":41,"expression":{"type":"CallExpression","start":35,"end":40,"callee":{"type":"Identifier","start":35,"end":36,"name":"f"},"arguments":[{"type":"Literal","start":37,"end":39,"value":50,"raw":"50"}]}},{"type":"ExpressionStatement","start":42,"end":44,"expression":{"type":"Identifier","start":42,"end":43,"name":"v"}}]}`

// (function(x) {return x})(51)
// => 51
const functionWithReturn = `{"type":"Program","start":0,"end":31,"body":[{"type":"ExpressionStatement","start":0,"end":31,"expression":{"type":"CallExpression","start":0,"end":31,"callee":{"type":"FunctionExpression","start":0,"end":27,"id":null,"params":[{"type":"Identifier","start":10,"end":11,"name":"x"}],"body":{"type":"BlockStatement","start":13,"end":26,"body":[{"type":"ReturnStatement","start":15,"end":24,"argument":{"type":"Identifier","start":22,"end":23,"name":"x"}}]}},"arguments":[{"type":"Literal","start":28,"end":30,"value":51,"raw":"51"}]}}]}`

// (function() {})()
// => undefined
const functionWithoutReturn = `{"type":"Program","start":0,"end":17,"body":[{"type":"ExpressionStatement","start":0,"end":17,"expression":{"type":"CallExpression","start":0,"end":17,"callee":{"type":"FunctionExpression","start":0,"end":15,"id":null,"params":[],"body":{"type":"BlockStatement","start":12,"end":14,"body":[]}},"arguments":[]}}]}`

// function f() {
//     try {
//         return true;
//     }
//     finally {
//         return false;
//     }
// }
// f()
// => false
const multipleReturn = `{"type":"Program","start":0,"end":58,"body":[{"type":"ExpressionStatement","start":0,"end":58,"expression":{"type":"CallExpression","start":0,"end":58,"callee":{"type":"FunctionExpression","start":0,"end":56,"id":null,"params":[],"body":{"type":"BlockStatement","start":11,"end":55,"body":[{"type":"TryStatement","start":12,"end":54,"block":{"type":"BlockStatement","start":16,"end":30,"body":[{"type":"ReturnStatement","start":17,"end":29,"argument":{"type":"Literal","start":24,"end":28,"value":true,"raw":"true"}}]},"handler":null,"guardedHandlers":[],"finalizer":{"type":"BlockStatement","start":39,"end":54,"body":[{"type":"ReturnStatement","start":40,"end":53,"argument":{"type":"Literal","start":47,"end":52,"value":false,"raw":"false"}}]}}]}},"arguments":[]}}]}`

// var f = function () {
//     throw 26;
// }
// try {
//     f()
// }
// catch (e) {
//     e * 2;
// }
// => 52
const throwCatch = `{"type":"Program","start":0,"end":78,"body":[{"type":"VariableDeclaration","start":0,"end":37,"declarations":[{"type":"VariableDeclarator","start":4,"end":37,"id":{"type":"Identifier","start":4,"end":5,"name":"f"},"init":{"type":"FunctionExpression","start":8,"end":37,"id":null,"params":[],"body":{"type":"BlockStatement","start":20,"end":37,"body":[{"type":"ThrowStatement","start":26,"end":35,"argument":{"type":"Literal","start":32,"end":34,"value":26,"raw":"26"}}]}}}],"kind":"var"},{"type":"TryStatement","start":38,"end":78,"block":{"type":"BlockStatement","start":42,"end":53,"body":[{"type":"ExpressionStatement","start":48,"end":51,"expression":{"type":"CallExpression","start":48,"end":51,"callee":{"type":"Identifier","start":48,"end":49,"name":"f"},"arguments":[]}}]},"handler":{"type":"CatchClause","start":54,"end":78,"param":{"type":"Identifier","start":61,"end":62,"name":"e"},"guard":null,"body":{"type":"BlockStatement","start":64,"end":78,"body":[{"type":"ExpressionStatement","start":70,"end":76,"expression":{"type":"BinaryExpression","start":70,"end":75,"left":{"type":"Identifier","start":70,"end":71,"name":"e"},"operator":"*","right":{"type":"Literal","start":74,"end":75,"value":2,"raw":"2"}}}]}},"guardedHandlers":[],"finalizer":null}]}`

// 51, 52, 53
// => 53
const seqExpr = `{"type":"Program","start":0,"end":10,"body":[{"type":"ExpressionStatement","start":0,"end":10,"expression":{"type":"SequenceExpression","start":0,"end":10,"expressions":[{"type":"Literal","start":0,"end":2,"value":51,"raw":"51"},{"type":"Literal","start":4,"end":6,"value":52,"raw":"52"},{"type":"Literal","start":8,"end":10,"value":53,"raw":"53"}]}}]}`

// foo: 54
// => 54
const labeledStatement = `{"type":"Program","start":0,"end":7,"body":[{"type":"LabeledStatement","start":0,"end":7,"body":{"type":"ExpressionStatement","start":5,"end":7,"expression":{"type":"Literal","start":5,"end":7,"value":54,"raw":"54"}},"label":{"type":"Identifier","start":0,"end":3,"name":"foo"}}]}`

// var a = 0;
// while(a<55) {
//     a++
// }
// a;
// => 55
const whileLoop = `{"type":"Program","start":0,"end":37,"body":[{"type":"VariableDeclaration","start":0,"end":10,"declarations":[{"type":"VariableDeclarator","start":4,"end":9,"id":{"type":"Identifier","start":4,"end":5,"name":"a"},"init":{"type":"Literal","start":8,"end":9,"value":0,"raw":"0"}}],"kind":"var"},{"type":"WhileStatement","start":11,"end":34,"test":{"type":"BinaryExpression","start":17,"end":21,"left":{"type":"Identifier","start":17,"end":18,"name":"a"},"operator":"<","right":{"type":"Literal","start":19,"end":21,"value":55,"raw":"55"}},"body":{"type":"BlockStatement","start":23,"end":34,"body":[{"type":"ExpressionStatement","start":29,"end":32,"expression":{"type":"UpdateExpression","start":29,"end":32,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":29,"end":30,"name":"a"}}}]}},{"type":"ExpressionStatement","start":35,"end":37,"expression":{"type":"Identifier","start":35,"end":36,"name":"a"}}]}`

// var a = 56;
// while(false) {
//     a++
// }
// a;
// => 56
const whileFalse = `{"type":"Program","start":0,"end":39,"body":[{"type":"VariableDeclaration","start":0,"end":11,"declarations":[{"type":"VariableDeclarator","start":4,"end":10,"id":{"type":"Identifier","start":4,"end":5,"name":"a"},"init":{"type":"Literal","start":8,"end":10,"value":56,"raw":"56"}}],"kind":"var"},{"type":"WhileStatement","start":12,"end":36,"test":{"type":"Literal","start":18,"end":23,"value":false,"raw":"false"},"body":{"type":"BlockStatement","start":25,"end":36,"body":[{"type":"ExpressionStatement","start":31,"end":34,"expression":{"type":"UpdateExpression","start":31,"end":34,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":31,"end":32,"name":"a"}}}]}},{"type":"ExpressionStatement","start":37,"end":39,"expression":{"type":"Identifier","start":37,"end":38,"name":"a"}}]}`

// var a = 56
// do {
//     a++
// } while(false)
// a
// => 57
const doWhileFalse = `{"type":"Program","start":0,"end":40,"body":[{"type":"VariableDeclaration","start":0,"end":10,"declarations":[{"type":"VariableDeclarator","start":4,"end":10,"id":{"type":"Identifier","start":4,"end":5,"name":"a"},"init":{"type":"Literal","start":8,"end":10,"value":56,"raw":"56"}}],"kind":"var"},{"type":"DoWhileStatement","start":11,"end":38,"body":{"type":"BlockStatement","start":14,"end":25,"body":[{"type":"ExpressionStatement","start":20,"end":23,"expression":{"type":"UpdateExpression","start":20,"end":23,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":20,"end":21,"name":"a"}}}]},"test":{"type":"Literal","start":32,"end":37,"value":false,"raw":"false"}},{"type":"ExpressionStatement","start":39,"end":40,"expression":{"type":"Identifier","start":39,"end":40,"name":"a"}}]}`

// var a = 57
// do {
//     a++
//     break
//     a++
// } while(false)
// a
// => 58
const breakDoWhile = `{"type":"Program","start":0,"end":58,"body":[{"type":"VariableDeclaration","start":0,"end":10,"declarations":[{"type":"VariableDeclarator","start":4,"end":10,"id":{"type":"Identifier","start":4,"end":5,"name":"a"},"init":{"type":"Literal","start":8,"end":10,"value":57,"raw":"57"}}],"kind":"var"},{"type":"DoWhileStatement","start":11,"end":56,"body":{"type":"BlockStatement","start":14,"end":43,"body":[{"type":"ExpressionStatement","start":20,"end":23,"expression":{"type":"UpdateExpression","start":20,"end":23,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":20,"end":21,"name":"a"}}},{"type":"BreakStatement","start":28,"end":33,"label":null},{"type":"ExpressionStatement","start":38,"end":41,"expression":{"type":"UpdateExpression","start":38,"end":41,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":38,"end":39,"name":"a"}}}]},"test":{"type":"Literal","start":50,"end":55,"value":false,"raw":"false"}},{"type":"ExpressionStatement","start":57,"end":58,"expression":{"type":"Identifier","start":57,"end":58,"name":"a"}}]}`

// ({foo: "bar", answer: 42})
// => {foo: "bar", answer: 42}
const objectExpression = `{"type":"Program","start":0,"end":26,"body":[{"type":"ExpressionStatement","start":0,"end":26,"expression":{"type":"ObjectExpression","start":0,"end":26,"properties":[{"key":{"type":"Identifier","start":2,"end":5,"name":"foo"},"value":{"type":"Literal","start":7,"end":12,"value":"bar","raw":"\"bar\""},"kind":"init"},{"key":{"type":"Identifier","start":14,"end":20,"name":"answer"},"value":{"type":"Literal","start":22,"end":24,"value":42,"raw":"42"},"kind":"init"}]}}]}`
