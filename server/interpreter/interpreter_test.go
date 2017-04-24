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
	"CodeCity/server/interpreter/data"
	"fmt"
	"testing"
)

func TestInterpreterSimple(t *testing.T) {
	var tests = []struct {
		desc     string
		src      string
		expected data.Value
	}{
		{"1+1", onePlusOne, data.Number(2)},
		{"2+2", twoPlusTwo, data.Number(4)},
		{"four functions", simpleFourFunction, data.Number(42)},
		{"variable declaration", variableDecl, data.Number(43)},
		{"?: true", condTrue, data.String("then")},
		{"?: false", condFalse, data.String("else")},
		{"if true", ifTrue, data.String("then")},
		{"if false", ifFalse, data.String("else")},
		{"var x=0; x=44; x", simpleAssignment, data.Number(44)},
		{"var o={}; o.foo=45; o.foo", propertyAssignment, data.Number(45)},
		{"var x=45; x++; x++", postincrement, data.Number(46)},
		{"var x=45; ++x; ++x", preincrement, data.Number(47)},
		{"var x=40,y=8; x+=y; x", plusequalsLeft, data.Number(48)},
		{"var x=40,y=8; x+=y; y", plusequalsRight, data.Number(8)},
		{"\"foo\"+\"bar\"", concat, data.String("foobar")},
		{"var v; var f = function() {v = 49}; f(); v",
			simpleFunctionExpression, data.Number(49)},
		{"var v; var f = function(x) {v = x}; f(50); v",
			fExpWithParameter, data.Number(50)},
		{"(function(x){return x;})(51)", functionWithReturn, data.Number(51)},
		{"(function(){try {return true;} finally {return false;}})()",
			multipleReturn, data.Boolean(false)},
		{"var f=function(){throw 26;};try{f()}catch(e){e*2;}",
			throwCatch, data.Number(52)},
		{"51,52,53", seqExpr, data.Number(53)},
		{"foo: 54", labeledStatement, data.Number(54)},
		{"var a = 0;while(a<55){a++}a;", whileLoop, data.Number(55)},
		{"var a=56;while(false){a++};a", whileFalse, data.Number(56)},
		{"var a=56;do{a++}while(false);a", doWhileFalse, data.Number(57)},
		{"var a=57;do{a++;break;a++}while(false);a",
			breakDoWhile, data.Number(58)},
		{"foo:break foo", selfBreak, data.Undefined{}},
		{"var a=6;foo:{try{a*=10;break foo}finally{a--}};a",
			breakWithFinally, data.Number(59)},
		{"var a=59;do {try{continue}finally{a++}}while(false);a",
			continueWithFinally, data.Number(60)},
		{"var a=0;while(a++<60){try{break}finally{continue}};a",
			breakWithFinallyContinue, data.Number(61)},
		{"(function(){var i=0;while(i++<61){try{return 42}" +
			"finally{continue}}return i})()",
			returnWithFinallyContinue, data.Number(62)},
		{"63||\"foo\"", orTrue, data.Number(63)},
		{"false||64", orFalse, data.Number(64)},
		{"({})&&65", andTrue, data.Number(65)},
		{"0&&65", andFalse, data.Number(0)},
		{"var t=0;for(var i=0;i<12;i++){t+=i};t",
			forTriangular, data.Number(66)},
		{"var x=0, a={a:60,b:3,c:4}for(var i in a){" +
			"x+=a[i]};x", forIn, data.Number(67)},
		{"var x=1,o={foo:\"bar\"},a={a:2,b:2,c:17};for(o.foo in a)" +
			"{x*=a[o.foo]};x", forInMemberExp, data.Number(68)},
		{"var x=0,o={},f=function(){x+=20;return o}, a={a:2,b:3,c:4}" +
			"for(f().foo in a){x+=a[o.foo]};x", forInMembFunc,
			data.Number(69)},
		{"var o={f:function(){return this.foo},foo:70};o.f()",
			methodCall, data.Number(70)},
		{"var o={f:function(){return this}};var g=o.f;g()",
			demethodedCall, data.Undefined{}},
		{"this", bareThis, data.Undefined{}},
		{"[].length", emptyArrayLength, data.Number(0)},
		{"[1,,3,,].length", arrayElidedLength, data.Number(4)},
		{"{}", compValEmptyBlock, data.Undefined{}},
		{"undefined", undefined, data.Undefined{}},
		{"var x=70; undefined === void x++ && x", unaryVoid, data.Number(71)},
		{"+\"72\"", unaryPlus, data.Number(72)},
		{"-73", unaryMinus, data.Number(-73)},
		{"~0xffffffb5", unaryComplement, data.Number(74)},
		{"!false&&(!true===false)", unaryNot, data.Boolean(true)},
		{"(many typeof tests)", unaryTypeof, data.String("pass")},
		{"var o={foo:\"bar\"};\"foo\" in o && !(\"bar\" in o)",
			binaryIn, data.Boolean(true)},
	}

	for _, c := range tests {
		i, _ := NewFromJSON(c.src)
		// if c.src == unaryTypeof {
		// 	i.Verbose = true
		// }
		i.Run()
		if v := i.Value(); v != c.expected {
			t.Errorf("%s == %v (%T)\n(expected %v (%T))",
				c.desc, v, v, c.expected, c.expected)
		}
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

// foo: break foo
// => undefined (but legal!)
const selfBreak = `{"type":"Program","start":0,"end":14,"body":[{"type":"LabeledStatement","start":0,"end":14,"body":{"type":"BreakStatement","start":5,"end":14,"label":{"type":"Identifier","start":11,"end":14,"name":"foo"}},"label":{"type":"Identifier","start":0,"end":3,"name":"foo"}}]}`

// var a = 6
// foo: {
//     try {
//         a *= 10
//         break foo
//     }
//     finally {
//         a--
//     }
// }
// a
// => 59
const breakWithFinally = `{"type":"Program","start":0,"end":102,"body":[{"type":"VariableDeclaration","start":0,"end":9,"declarations":[{"type":"VariableDeclarator","start":4,"end":9,"id":{"type":"Identifier","start":4,"end":5,"name":"a"},"init":{"type":"Literal","start":8,"end":9,"value":6,"raw":"6"}}],"kind":"var"},{"type":"LabeledStatement","start":10,"end":100,"body":{"type":"BlockStatement","start":15,"end":100,"body":[{"type":"TryStatement","start":21,"end":98,"block":{"type":"BlockStatement","start":25,"end":66,"body":[{"type":"ExpressionStatement","start":35,"end":42,"expression":{"type":"AssignmentExpression","start":35,"end":42,"operator":"*=","left":{"type":"Identifier","start":35,"end":36,"name":"a"},"right":{"type":"Literal","start":40,"end":42,"value":10,"raw":"10"}}},{"type":"BreakStatement","start":51,"end":60,"label":{"type":"Identifier","start":57,"end":60,"name":"foo"}}]},"handler":null,"guardedHandlers":[],"finalizer":{"type":"BlockStatement","start":79,"end":98,"body":[{"type":"ExpressionStatement","start":89,"end":92,"expression":{"type":"UpdateExpression","start":89,"end":92,"operator":"--","prefix":false,"argument":{"type":"Identifier","start":89,"end":90,"name":"a"}}}]}}]},"label":{"type":"Identifier","start":10,"end":13,"name":"foo"}},{"type":"ExpressionStatement","start":101,"end":102,"expression":{"type":"Identifier","start":101,"end":102,"name":"a"}}]}`

// var a = 59;
// do {
//   try {
//     continue;
//   } finally {
//     a++;
//   }
// } while(false)
// a
// => 60
const continueWithFinally = `{"type":"Program","start":0,"end":82,"body":[{"type":"VariableDeclaration","start":0,"end":11,"declarations":[{"type":"VariableDeclarator","start":4,"end":10,"id":{"type":"Identifier","start":4,"end":5,"name":"a"},"init":{"type":"Literal","start":8,"end":10,"value":59,"raw":"59"}}],"kind":"var"},{"type":"DoWhileStatement","start":12,"end":80,"body":{"type":"BlockStatement","start":15,"end":67,"body":[{"type":"TryStatement","start":19,"end":65,"block":{"type":"BlockStatement","start":23,"end":42,"body":[{"type":"ContinueStatement","start":29,"end":38,"label":null}]},"handler":null,"guardedHandlers":[],"finalizer":{"type":"BlockStatement","start":51,"end":65,"body":[{"type":"ExpressionStatement","start":57,"end":61,"expression":{"type":"UpdateExpression","start":57,"end":60,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":57,"end":58,"name":"a"}}}]}}]},"test":{"type":"Literal","start":74,"end":79,"value":false,"raw":"false"}},{"type":"ExpressionStatement","start":81,"end":82,"expression":{"type":"Identifier","start":81,"end":82,"name":"a"}}]}`

// var a = 0
// while(a++ < 60) {
//   try {
//     break;
//   } finally {
//     continue;
//   }
// }
// a
// => 61
const breakWithFinallyContinue = `{"type":"Program","start":0,"end":82,"body":[{"type":"VariableDeclaration","start":0,"end":9,"declarations":[{"type":"VariableDeclarator","start":4,"end":9,"id":{"type":"Identifier","start":4,"end":5,"name":"a"},"init":{"type":"Literal","start":8,"end":9,"value":0,"raw":"0"}}],"kind":"var"},{"type":"WhileStatement","start":10,"end":80,"test":{"type":"BinaryExpression","start":16,"end":24,"left":{"type":"UpdateExpression","start":16,"end":19,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":16,"end":17,"name":"a"}},"operator":"<","right":{"type":"Literal","start":22,"end":24,"value":60,"raw":"60"}},"body":{"type":"BlockStatement","start":26,"end":80,"body":[{"type":"TryStatement","start":30,"end":78,"block":{"type":"BlockStatement","start":34,"end":50,"body":[{"type":"BreakStatement","start":40,"end":46,"label":null}]},"handler":null,"guardedHandlers":[],"finalizer":{"type":"BlockStatement","start":59,"end":78,"body":[{"type":"ContinueStatement","start":65,"end":74,"label":null}]}}]}},{"type":"ExpressionStatement","start":81,"end":82,"expression":{"type":"Identifier","start":81,"end":82,"name":"a"}}]}`

// (function(){
//   var i = 0
//   while(i++ < 61) {
//     try {
//       return 42;
//     } finally {
//       continue;
//     }
//   }
//   return i;
// })();
// => 62
const returnWithFinallyContinue = `{"type":"Program","start":0,"end":131,"body":[{"type":"ExpressionStatement","start":0,"end":131,"expression":{"type":"CallExpression","start":0,"end":130,"callee":{"type":"FunctionExpression","start":0,"end":128,"id":null,"params":[],"body":{"type":"BlockStatement","start":11,"end":127,"body":[{"type":"VariableDeclaration","start":15,"end":24,"declarations":[{"type":"VariableDeclarator","start":19,"end":24,"id":{"type":"Identifier","start":19,"end":20,"name":"i"},"init":{"type":"Literal","start":23,"end":24,"value":0,"raw":"0"}}],"kind":"var"},{"type":"WhileStatement","start":27,"end":113,"test":{"type":"BinaryExpression","start":33,"end":41,"left":{"type":"UpdateExpression","start":33,"end":36,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":33,"end":34,"name":"i"}},"operator":"<","right":{"type":"Literal","start":39,"end":41,"value":61,"raw":"61"}},"body":{"type":"BlockStatement","start":43,"end":113,"body":[{"type":"TryStatement","start":49,"end":109,"block":{"type":"BlockStatement","start":53,"end":77,"body":[{"type":"ReturnStatement","start":61,"end":71,"argument":{"type":"Literal","start":68,"end":70,"value":42,"raw":"42"}}]},"handler":null,"guardedHandlers":[],"finalizer":{"type":"BlockStatement","start":86,"end":109,"body":[{"type":"ContinueStatement","start":94,"end":103,"label":null}]}}]}},{"type":"ReturnStatement","start":116,"end":125,"argument":{"type":"Identifier","start":123,"end":124,"name":"i"}}]}},"arguments":[]}}]}`

// 63 || "foo"
// => 63
const orTrue = `{"type":"Program","start":0,"end":11,"body":[{"type":"ExpressionStatement","start":0,"end":11,"expression":{"type":"LogicalExpression","start":0,"end":11,"left":{"type":"Literal","start":0,"end":2,"value":63,"raw":"63"},"operator":"||","right":{"type":"Literal","start":6,"end":11,"value":"foo","raw":"\"foo\""}}}]}`

// false || 64
// => 64
const orFalse = `{"type":"Program","start":0,"end":11,"body":[{"type":"ExpressionStatement","start":0,"end":11,"expression":{"type":"LogicalExpression","start":0,"end":11,"left":{"type":"Literal","start":0,"end":5,"value":false,"raw":"false"},"operator":"||","right":{"type":"Literal","start":9,"end":11,"value":64,"raw":"64"}}}]}`

// ({}) && 65
// => 65
const andTrue = `{"type":"Program","start":0,"end":10,"body":[{"type":"ExpressionStatement","start":0,"end":10,"expression":{"type":"LogicalExpression","start":0,"end":10,"left":{"type":"ObjectExpression","start":0,"end":4,"properties":[]},"operator":"&&","right":{"type":"Literal","start":8,"end":10,"value":65,"raw":"65"}}}]}`

// 0 && 65
// => 0
const andFalse = `{"type":"Program","start":0,"end":7,"body":[{"type":"ExpressionStatement","start":0,"end":7,"expression":{"type":"LogicalExpression","start":0,"end":7,"left":{"type":"Literal","start":0,"end":1,"value":0,"raw":"0"},"operator":"&&","right":{"type":"Literal","start":5,"end":7,"value":65,"raw":"65"}}}]}`

// var t = 0;
// for(var i=0; i < 12; i++) {
//   t += i
// }
// t
// => 66
const forTriangular = `{"type":"Program","start":0,"end":51,"body":[{"type":"VariableDeclaration","start":0,"end":10,"declarations":[{"type":"VariableDeclarator","start":4,"end":9,"id":{"type":"Identifier","start":4,"end":5,"name":"t"},"init":{"type":"Literal","start":8,"end":9,"value":0,"raw":"0"}}],"kind":"var"},{"type":"ForStatement","start":11,"end":49,"init":{"type":"VariableDeclaration","start":15,"end":22,"declarations":[{"type":"VariableDeclarator","start":19,"end":22,"id":{"type":"Identifier","start":19,"end":20,"name":"i"},"init":{"type":"Literal","start":21,"end":22,"value":0,"raw":"0"}}],"kind":"var"},"test":{"type":"BinaryExpression","start":24,"end":30,"left":{"type":"Identifier","start":24,"end":25,"name":"i"},"operator":"<","right":{"type":"Literal","start":28,"end":30,"value":12,"raw":"12"}},"update":{"type":"UpdateExpression","start":32,"end":35,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":32,"end":33,"name":"i"}},"body":{"type":"BlockStatement","start":37,"end":49,"body":[{"type":"ExpressionStatement","start":41,"end":47,"expression":{"type":"AssignmentExpression","start":41,"end":47,"operator":"+=","left":{"type":"Identifier","start":41,"end":42,"name":"t"},"right":{"type":"Identifier","start":46,"end":47,"name":"i"}}}]}},{"type":"ExpressionStatement","start":50,"end":51,"expression":{"type":"Identifier","start":50,"end":51,"name":"t"}}]}`

// var x = 0, a = {a: 60, b:3, c:4}
// for(var i in a) { x += a[i] }
// x
// => 67
const forIn = `{"type":"Program","start":0,"end":64,"body":[{"type":"VariableDeclaration","start":0,"end":32,"declarations":[{"type":"VariableDeclarator","start":4,"end":9,"id":{"type":"Identifier","start":4,"end":5,"name":"x"},"init":{"type":"Literal","start":8,"end":9,"value":0,"raw":"0"}},{"type":"VariableDeclarator","start":11,"end":32,"id":{"type":"Identifier","start":11,"end":12,"name":"a"},"init":{"type":"ObjectExpression","start":15,"end":32,"properties":[{"key":{"type":"Identifier","start":16,"end":17,"name":"a"},"value":{"type":"Literal","start":19,"end":21,"value":60,"raw":"60"},"kind":"init"},{"key":{"type":"Identifier","start":23,"end":24,"name":"b"},"value":{"type":"Literal","start":25,"end":26,"value":3,"raw":"3"},"kind":"init"},{"key":{"type":"Identifier","start":28,"end":29,"name":"c"},"value":{"type":"Literal","start":30,"end":31,"value":4,"raw":"4"},"kind":"init"}]}}],"kind":"var"},{"type":"ForInStatement","start":33,"end":62,"left":{"type":"VariableDeclaration","start":37,"end":42,"declarations":[{"type":"VariableDeclarator","start":41,"end":42,"id":{"type":"Identifier","start":41,"end":42,"name":"i"},"init":null}],"kind":"var"},"right":{"type":"Identifier","start":46,"end":47,"name":"a"},"body":{"type":"BlockStatement","start":49,"end":62,"body":[{"type":"ExpressionStatement","start":51,"end":60,"expression":{"type":"AssignmentExpression","start":51,"end":60,"operator":"+=","left":{"type":"Identifier","start":51,"end":52,"name":"x"},"right":{"type":"MemberExpression","start":56,"end":60,"object":{"type":"Identifier","start":56,"end":57,"name":"a"},"property":{"type":"Identifier","start":58,"end":59,"name":"i"},"computed":true}}}]}},{"type":"ExpressionStatement","start":63,"end":64,"expression":{"type":"Identifier","start":63,"end":64,"name":"x"}}]}`

// var x = 1, o = {foo: "bar"}, a = {a:2, b:2, c:17}
// for(o.foo in a) { x *= a[o.foo] }
// x
// => 68
const forInMemberExp = `{"type":"Program","start":0,"end":85,"body":[{"type":"VariableDeclaration","start":0,"end":49,"declarations":[{"type":"VariableDeclarator","start":4,"end":9,"id":{"type":"Identifier","start":4,"end":5,"name":"x"},"init":{"type":"Literal","start":8,"end":9,"value":1,"raw":"1"}},{"type":"VariableDeclarator","start":11,"end":27,"id":{"type":"Identifier","start":11,"end":12,"name":"o"},"init":{"type":"ObjectExpression","start":15,"end":27,"properties":[{"key":{"type":"Identifier","start":16,"end":19,"name":"foo"},"value":{"type":"Literal","start":21,"end":26,"value":"bar","raw":"\"bar\""},"kind":"init"}]}},{"type":"VariableDeclarator","start":29,"end":49,"id":{"type":"Identifier","start":29,"end":30,"name":"a"},"init":{"type":"ObjectExpression","start":33,"end":49,"properties":[{"key":{"type":"Identifier","start":34,"end":35,"name":"a"},"value":{"type":"Literal","start":36,"end":37,"value":2,"raw":"2"},"kind":"init"},{"key":{"type":"Identifier","start":39,"end":40,"name":"b"},"value":{"type":"Literal","start":41,"end":42,"value":2,"raw":"2"},"kind":"init"},{"key":{"type":"Identifier","start":44,"end":45,"name":"c"},"value":{"type":"Literal","start":46,"end":48,"value":17,"raw":"17"},"kind":"init"}]}}],"kind":"var"},{"type":"ForInStatement","start":50,"end":83,"left":{"type":"MemberExpression","start":54,"end":59,"object":{"type":"Identifier","start":54,"end":55,"name":"o"},"property":{"type":"Identifier","start":56,"end":59,"name":"foo"},"computed":false},"right":{"type":"Identifier","start":63,"end":64,"name":"a"},"body":{"type":"BlockStatement","start":66,"end":83,"body":[{"type":"ExpressionStatement","start":68,"end":81,"expression":{"type":"AssignmentExpression","start":68,"end":81,"operator":"*=","left":{"type":"Identifier","start":68,"end":69,"name":"x"},"right":{"type":"MemberExpression","start":73,"end":81,"object":{"type":"Identifier","start":73,"end":74,"name":"a"},"property":{"type":"MemberExpression","start":75,"end":80,"object":{"type":"Identifier","start":75,"end":76,"name":"o"},"property":{"type":"Identifier","start":77,"end":80,"name":"foo"},"computed":false},"computed":true}}}]}},{"type":"ExpressionStatement","start":84,"end":85,"expression":{"type":"Identifier","start":84,"end":85,"name":"x"}}]}`

// var x = 0, o = {}
// var f = function() { x += 20; return o }
// var a = {a:2, b:3, c:4}
// for(f().foo in a) { x += a[o.foo] }
// x
// => 69
const forInMembFunc = `{"type":"Program","start":0,"end":120,"body":[{"type":"VariableDeclaration","start":0,"end":17,"declarations":[{"type":"VariableDeclarator","start":4,"end":9,"id":{"type":"Identifier","start":4,"end":5,"name":"x"},"init":{"type":"Literal","start":8,"end":9,"value":0,"raw":"0"}},{"type":"VariableDeclarator","start":11,"end":17,"id":{"type":"Identifier","start":11,"end":12,"name":"o"},"init":{"type":"ObjectExpression","start":15,"end":17,"properties":[]}}],"kind":"var"},{"type":"VariableDeclaration","start":18,"end":58,"declarations":[{"type":"VariableDeclarator","start":22,"end":58,"id":{"type":"Identifier","start":22,"end":23,"name":"f"},"init":{"type":"FunctionExpression","start":26,"end":58,"id":null,"params":[],"body":{"type":"BlockStatement","start":37,"end":58,"body":[{"type":"ExpressionStatement","start":39,"end":47,"expression":{"type":"AssignmentExpression","start":39,"end":46,"operator":"+=","left":{"type":"Identifier","start":39,"end":40,"name":"x"},"right":{"type":"Literal","start":44,"end":46,"value":20,"raw":"20"}}},{"type":"ReturnStatement","start":48,"end":56,"argument":{"type":"Identifier","start":55,"end":56,"name":"o"}}]}}}],"kind":"var"},{"type":"VariableDeclaration","start":59,"end":82,"declarations":[{"type":"VariableDeclarator","start":63,"end":82,"id":{"type":"Identifier","start":63,"end":64,"name":"a"},"init":{"type":"ObjectExpression","start":67,"end":82,"properties":[{"key":{"type":"Identifier","start":68,"end":69,"name":"a"},"value":{"type":"Literal","start":70,"end":71,"value":2,"raw":"2"},"kind":"init"},{"key":{"type":"Identifier","start":73,"end":74,"name":"b"},"value":{"type":"Literal","start":75,"end":76,"value":3,"raw":"3"},"kind":"init"},{"key":{"type":"Identifier","start":78,"end":79,"name":"c"},"value":{"type":"Literal","start":80,"end":81,"value":4,"raw":"4"},"kind":"init"}]}}],"kind":"var"},{"type":"ForInStatement","start":83,"end":118,"left":{"type":"MemberExpression","start":87,"end":94,"object":{"type":"CallExpression","start":87,"end":90,"callee":{"type":"Identifier","start":87,"end":88,"name":"f"},"arguments":[]},"property":{"type":"Identifier","start":91,"end":94,"name":"foo"},"computed":false},"right":{"type":"Identifier","start":98,"end":99,"name":"a"},"body":{"type":"BlockStatement","start":101,"end":118,"body":[{"type":"ExpressionStatement","start":103,"end":116,"expression":{"type":"AssignmentExpression","start":103,"end":116,"operator":"+=","left":{"type":"Identifier","start":103,"end":104,"name":"x"},"right":{"type":"MemberExpression","start":108,"end":116,"object":{"type":"Identifier","start":108,"end":109,"name":"a"},"property":{"type":"MemberExpression","start":110,"end":115,"object":{"type":"Identifier","start":110,"end":111,"name":"o"},"property":{"type":"Identifier","start":112,"end":115,"name":"foo"},"computed":false},"computed":true}}}]}},{"type":"ExpressionStatement","start":119,"end":120,"expression":{"type":"Identifier","start":119,"end":120,"name":"x"}}]}`

// var o = {f: function() {return this.foo}, foo: 70}
// o.f()
// => 70
const methodCall = `{"type":"Program","start":0,"end":56,"body":[{"type":"VariableDeclaration","start":0,"end":50,"declarations":[{"type":"VariableDeclarator","start":4,"end":50,"id":{"type":"Identifier","start":4,"end":5,"name":"o"},"init":{"type":"ObjectExpression","start":8,"end":50,"properties":[{"key":{"type":"Identifier","start":9,"end":10,"name":"f"},"value":{"type":"FunctionExpression","start":12,"end":40,"id":null,"params":[],"body":{"type":"BlockStatement","start":23,"end":40,"body":[{"type":"ReturnStatement","start":24,"end":39,"argument":{"type":"MemberExpression","start":31,"end":39,"object":{"type":"ThisExpression","start":31,"end":35},"property":{"type":"Identifier","start":36,"end":39,"name":"foo"},"computed":false}}]}},"kind":"init"},{"key":{"type":"Identifier","start":42,"end":45,"name":"foo"},"value":{"type":"Literal","start":47,"end":49,"value":70,"raw":"70"},"kind":"init"}]}}],"kind":"var"},{"type":"ExpressionStatement","start":51,"end":56,"expression":{"type":"CallExpression","start":51,"end":56,"callee":{"type":"MemberExpression","start":51,"end":54,"object":{"type":"Identifier","start":51,"end":52,"name":"o"},"property":{"type":"Identifier","start":53,"end":54,"name":"f"},"computed":false},"arguments":[]}}]}`

// var o = { f: function() { return this }}
// var g = o.f
// g()
// => undefined
const demethodedCall = `{"type":"Program","start":0,"end":56,"body":[{"type":"VariableDeclaration","start":0,"end":40,"declarations":[{"type":"VariableDeclarator","start":4,"end":40,"id":{"type":"Identifier","start":4,"end":5,"name":"o"},"init":{"type":"ObjectExpression","start":8,"end":40,"properties":[{"key":{"type":"Identifier","start":10,"end":11,"name":"f"},"value":{"type":"FunctionExpression","start":13,"end":39,"id":null,"params":[],"body":{"type":"BlockStatement","start":24,"end":39,"body":[{"type":"ReturnStatement","start":26,"end":37,"argument":{"type":"ThisExpression","start":33,"end":37}}]}},"kind":"init"}]}}],"kind":"var"},{"type":"VariableDeclaration","start":41,"end":52,"declarations":[{"type":"VariableDeclarator","start":45,"end":52,"id":{"type":"Identifier","start":45,"end":46,"name":"g"},"init":{"type":"MemberExpression","start":49,"end":52,"object":{"type":"Identifier","start":49,"end":50,"name":"o"},"property":{"type":"Identifier","start":51,"end":52,"name":"f"},"computed":false}}],"kind":"var"},{"type":"ExpressionStatement","start":53,"end":56,"expression":{"type":"CallExpression","start":53,"end":56,"callee":{"type":"Identifier","start":53,"end":54,"name":"g"},"arguments":[]}}]}`

// this
// => undefined
const bareThis = `{"type":"Program","start":0,"end":4,"body":[{"type":"ExpressionStatement","start":0,"end":4,"expression":{"type":"ThisExpression","start":0,"end":4}}]}`

// [].length
// => 0
const emptyArrayLength = `{"type":"Program","start":0,"end":9,"body":[{"type":"ExpressionStatement","start":0,"end":9,"expression":{"type":"MemberExpression","start":0,"end":9,"object":{"type":"ArrayExpression","start":0,"end":2,"elements":[]},"property":{"type":"Identifier","start":3,"end":9,"name":"length"},"computed":false}}]}`

// [1,,3,,].length
// => 4
const arrayElidedLength = `{"type":"Program","start":0,"end":15,"body":[{"type":"ExpressionStatement","start":0,"end":15,"expression":{"type":"MemberExpression","start":0,"end":15,"object":{"type":"ArrayExpression","start":0,"end":8,"elements":[{"type":"Literal","start":1,"end":2,"value":1,"raw":"1"},null,{"type":"Literal","start":4,"end":5,"value":3,"raw":"3"},null]},"property":{"type":"Identifier","start":9,"end":15,"name":"length"},"computed":false}}]}`

// {}
// => undefined
const compValEmptyBlock = `{"type":"Program","start":0,"end":2,"body":[{"type":"BlockStatement","start":0,"end":2,"body":[]}]}`

// undefined
// => undefined
const undefined = `{"type":"Program","start":0,"end":9,"body":[{"type":"ExpressionStatement","start":0,"end":9,"expression":{"type":"Identifier","start":0,"end":9,"name":"undefined"}}]}`

// var x = 70
// undefined === void x++ && x
// => 71
const unaryVoid = `{"type":"Program","start":0,"end":38,"body":[{"type":"VariableDeclaration","start":0,"end":10,"declarations":[{"type":"VariableDeclarator","start":4,"end":10,"id":{"type":"Identifier","start":4,"end":5,"name":"x"},"init":{"type":"Literal","start":8,"end":10,"value":70,"raw":"70"}}],"kind":"var"},{"type":"ExpressionStatement","start":11,"end":38,"expression":{"type":"LogicalExpression","start":11,"end":38,"left":{"type":"BinaryExpression","start":11,"end":33,"left":{"type":"Identifier","start":11,"end":20,"name":"undefined"},"operator":"===","right":{"type":"UnaryExpression","start":25,"end":33,"operator":"void","prefix":true,"argument":{"type":"UpdateExpression","start":30,"end":33,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":30,"end":31,"name":"x"}}}},"operator":"&&","right":{"type":"Identifier","start":37,"end":38,"name":"x"}}}]}`

// +"72"
// => 72
const unaryPlus = `{"type":"Program","start":0,"end":5,"body":[{"type":"ExpressionStatement","start":0,"end":5,"expression":{"type":"UnaryExpression","start":0,"end":5,"operator":"+","prefix":true,"argument":{"type":"Literal","start":1,"end":5,"value":"72","raw":"\"72\""}}}]}`

// -73
// => -73
const unaryMinus = `{"type":"Program","start":0,"end":3,"body":[{"type":"ExpressionStatement","start":0,"end":3,"expression":{"type":"UnaryExpression","start":0,"end":3,"operator":"-","prefix":true,"argument":{"type":"Literal","start":1,"end":3,"value":73,"raw":"73"}}}]}`

// ~0xffffffb5
// => 74
const unaryComplement = `{"type":"Program","start":0,"end":11,"body":[{"type":"ExpressionStatement","start":0,"end":11,"expression":{"type":"UnaryExpression","start":0,"end":11,"operator":"~","prefix":true,"argument":{"type":"Literal","start":1,"end":11,"value":4294967221,"raw":"0xffffffb5"}}}]}`

// !false && (!true === false)
// => true
const unaryNot = `{"type":"Program","start":0,"end":27,"body":[{"type":"ExpressionStatement","start":0,"end":27,"expression":{"type":"LogicalExpression","start":0,"end":27,"left":{"type":"UnaryExpression","start":0,"end":6,"operator":"!","prefix":true,"argument":{"type":"Literal","start":1,"end":6,"value":false,"raw":"false"}},"operator":"&&","right":{"type":"BinaryExpression","start":10,"end":27,"left":{"type":"UnaryExpression","start":11,"end":16,"operator":"!","prefix":true,"argument":{"type":"Literal","start":12,"end":16,"value":true,"raw":"true"}},"operator":"===","right":{"type":"Literal","start":21,"end":26,"value":false,"raw":"false"}}}}]}`

// var tests = [
//   [undefined, "undefined"],
//   [null, "object"],
//   [false, "boolean"],
//   [0, "number"],
//   ["", "string"],
//   [{}, "object"],
//   [[], "object"],
//   [function () {}, "function"],
// ];
//
// var ok = 0;
// for(var i = 0; i < tests.length; i++) {
//   if(typeof(tests[i][1]) != tests[i][2]) {
//     ok++;
//   }
// }
// ok == tests.length ? "pass" : "fail"
// => "pass"
const unaryTypeof = `{"type":"Program","start":0,"end":337,"body":[{"type":"VariableDeclaration","start":0,"end":188,"declarations":[{"type":"VariableDeclarator","start":4,"end":187,"id":{"type":"Identifier","start":4,"end":9,"name":"tests"},"init":{"type":"ArrayExpression","start":12,"end":187,"elements":[{"type":"ArrayExpression","start":16,"end":40,"elements":[{"type":"Identifier","start":17,"end":26,"name":"undefined"},{"type":"Literal","start":28,"end":39,"value":"undefined","raw":"\"undefined\""}]},{"type":"ArrayExpression","start":44,"end":60,"elements":[{"type":"Literal","start":45,"end":49,"value":null,"raw":"null"},{"type":"Literal","start":51,"end":59,"value":"object","raw":"\"object\""}]},{"type":"ArrayExpression","start":64,"end":82,"elements":[{"type":"Literal","start":65,"end":70,"value":false,"raw":"false"},{"type":"Literal","start":72,"end":81,"value":"boolean","raw":"\"boolean\""}]},{"type":"ArrayExpression","start":86,"end":99,"elements":[{"type":"Literal","start":87,"end":88,"value":0,"raw":"0"},{"type":"Literal","start":90,"end":98,"value":"number","raw":"\"number\""}]},{"type":"ArrayExpression","start":103,"end":117,"elements":[{"type":"Literal","start":104,"end":106,"value":"","raw":"\"\""},{"type":"Literal","start":108,"end":116,"value":"string","raw":"\"string\""}]},{"type":"ArrayExpression","start":121,"end":135,"elements":[{"type":"ObjectExpression","start":122,"end":124,"properties":[]},{"type":"Literal","start":126,"end":134,"value":"object","raw":"\"object\""}]},{"type":"ArrayExpression","start":139,"end":153,"elements":[{"type":"ArrayExpression","start":140,"end":142,"elements":[]},{"type":"Literal","start":144,"end":152,"value":"object","raw":"\"object\""}]},{"type":"ArrayExpression","start":157,"end":185,"elements":[{"type":"FunctionExpression","start":158,"end":172,"id":null,"params":[],"body":{"type":"BlockStatement","start":170,"end":172,"body":[]}},{"type":"Literal","start":174,"end":184,"value":"function","raw":"\"function\""}]}]}}],"kind":"var"},{"type":"VariableDeclaration","start":190,"end":201,"declarations":[{"type":"VariableDeclarator","start":194,"end":200,"id":{"type":"Identifier","start":194,"end":196,"name":"ok"},"init":{"type":"Literal","start":199,"end":200,"value":0,"raw":"0"}}],"kind":"var"},{"type":"ForStatement","start":202,"end":300,"init":{"type":"VariableDeclaration","start":206,"end":215,"declarations":[{"type":"VariableDeclarator","start":210,"end":215,"id":{"type":"Identifier","start":210,"end":211,"name":"i"},"init":{"type":"Literal","start":214,"end":215,"value":0,"raw":"0"}}],"kind":"var"},"test":{"type":"BinaryExpression","start":217,"end":233,"left":{"type":"Identifier","start":217,"end":218,"name":"i"},"operator":"<","right":{"type":"MemberExpression","start":221,"end":233,"object":{"type":"Identifier","start":221,"end":226,"name":"tests"},"property":{"type":"Identifier","start":227,"end":233,"name":"length"},"computed":false}},"update":{"type":"UpdateExpression","start":235,"end":238,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":235,"end":236,"name":"i"}},"body":{"type":"BlockStatement","start":240,"end":300,"body":[{"type":"IfStatement","start":244,"end":298,"test":{"type":"BinaryExpression","start":247,"end":281,"left":{"type":"UnaryExpression","start":247,"end":266,"operator":"typeof","prefix":true,"argument":{"type":"MemberExpression","start":253,"end":266,"object":{"type":"MemberExpression","start":254,"end":262,"object":{"type":"Identifier","start":254,"end":259,"name":"tests"},"property":{"type":"Identifier","start":260,"end":261,"name":"i"},"computed":true},"property":{"type":"Literal","start":263,"end":264,"value":0,"raw":"0"},"computed":true}},"operator":"==","right":{"type":"MemberExpression","start":270,"end":281,"object":{"type":"MemberExpression","start":270,"end":278,"object":{"type":"Identifier","start":270,"end":275,"name":"tests"},"property":{"type":"Identifier","start":276,"end":277,"name":"i"},"computed":true},"property":{"type":"Literal","start":279,"end":280,"value":1,"raw":"1"},"computed":true}},"consequent":{"type":"BlockStatement","start":283,"end":298,"body":[{"type":"ExpressionStatement","start":289,"end":294,"expression":{"type":"UpdateExpression","start":289,"end":293,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":289,"end":291,"name":"ok"}}}]},"alternate":null}]}},{"type":"ExpressionStatement","start":301,"end":337,"expression":{"type":"ConditionalExpression","start":301,"end":337,"test":{"type":"BinaryExpression","start":301,"end":319,"left":{"type":"Identifier","start":301,"end":303,"name":"ok"},"operator":"==","right":{"type":"MemberExpression","start":307,"end":319,"object":{"type":"Identifier","start":307,"end":312,"name":"tests"},"property":{"type":"Identifier","start":313,"end":319,"name":"length"},"computed":false}},"consequent":{"type":"Literal","start":322,"end":328,"value":"pass","raw":"\"pass\""},"alternate":{"type":"Literal","start":331,"end":337,"value":"fail","raw":"\"fail\""}}}]}`

// var o = {foo: "bar"};
// "foo" in o && !("bar" in o)
// => true
const binaryIn = `{"type":"Program","start":0,"end":49,"body":[{"type":"VariableDeclaration","start":0,"end":21,"declarations":[{"type":"VariableDeclarator","start":4,"end":20,"id":{"type":"Identifier","start":4,"end":5,"name":"o"},"init":{"type":"ObjectExpression","start":8,"end":20,"properties":[{"key":{"type":"Identifier","start":9,"end":12,"name":"foo"},"value":{"type":"Literal","start":14,"end":19,"value":"bar","raw":"\"bar\""},"kind":"init"}]}}],"kind":"var"},{"type":"ExpressionStatement","start":22,"end":49,"expression":{"type":"LogicalExpression","start":22,"end":49,"left":{"type":"BinaryExpression","start":22,"end":32,"left":{"type":"Literal","start":22,"end":27,"value":"foo","raw":"\"foo\""},"operator":"in","right":{"type":"Identifier","start":31,"end":32,"name":"o"}},"operator":"&&","right":{"type":"UnaryExpression","start":36,"end":49,"operator":"!","prefix":true,"argument":{"type":"BinaryExpression","start":37,"end":49,"left":{"type":"Literal","start":38,"end":43,"value":"bar","raw":"\"bar\""},"operator":"in","right":{"type":"Identifier","start":47,"end":48,"name":"o"}}}}}]}`

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
