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

package flatpack_test

import (
	"encoding/json"
	"fmt"
	"testing"

	"CodeCity/server/flatpack"
	"CodeCity/server/interpreter"
	"CodeCity/server/interpreter/data"
	"CodeCity/server/testutil"
)

// FIXME: add a more general (and more comprehensive) example.

func Example() {
	intrp, _ := interpreter.NewFromJSON(fibonacci)
	for i := 0; i < 500 && intrp.Step(); i++ {
	}
	var f = flatpack.New()
	f.Pack("Interpreter", intrp)

	b, e := json.MarshalIndent(f, "", "  ")
	if e != nil {
		panic(e)
	}
	fmt.Printf("%s\n", string(b))
	// // Output:
}

func TestRoundTripInterpreter(t *testing.T) {
	// t.SkipNow()
	intrp, _ := interpreter.NewFromJSON(fibonacci)
	for i := 0; i < 500 && intrp.Step(); i++ {
	}
	var f = flatpack.New()
	f.Pack("Interpreter", intrp)
	f.Seal()

	b, e := json.MarshalIndent(f, "", "  ")
	if e != nil {
		t.Error(e)
	}
	var f2 *flatpack.Flatpack
	e = json.Unmarshal(b, &f2)
	if e != nil {
		t.Error(e)
	}

	// Check flatpack has survived serialisation unscathed:
	if !testutil.RecEqual(f, f2, true) {
		t.Errorf("testutil.RecEqual(f2, f, true) == false")
		t.Log("\n" + testutil.Diff(f, f2))
	}

	v, err := f.Unpack("Interpreter")
	if err != nil {
		t.Error(err)
	}
	intrp2 := v.(*interpreter.Interpreter)

	// Check interpreter has survived flatpacking unscathed:
	if !testutil.RecEqual(intrp, intrp2, true) {
		t.Errorf("RecEqual(intrp, intrp2, true) == false")
		t.Log("\n" + testutil.Diff(intrp, intrp2))
	}
	intrp2.Run()
	if v := intrp2.Value(); v != data.Number(987) {
		t.Errorf("intrp2.Value() == %#v (expected %#v)", v, data.Number(987))
	}
}

// var fibonacci = function(n, output) {
//   var a = 1, b = 1, sum;
//   for (var i = 0; i < n; i++) {
//     output.push(a);
//     sum = a + b;
//     a = b;
//     b = sum;
//   }
// }
// fibonacci(16, result);
// result[15];
const fibonacci = `{"type":"Program","start":0,"end":206,"body":[{"type":"VariableDeclaration","start":0,"end":16,"declarations":[{"type":"VariableDeclarator","start":4,"end":15,"id":{"type":"Identifier","start":4,"end":10,"name":"result"},"init":{"type":"ArrayExpression","start":13,"end":15,"elements":[]}}],"kind":"var"},{"type":"FunctionDeclaration","start":17,"end":172,"id":{"type":"Identifier","start":26,"end":35,"name":"fibonacci"},"params":[{"type":"Identifier","start":36,"end":37,"name":"n"},{"type":"Identifier","start":39,"end":45,"name":"output"}],"body":{"type":"BlockStatement","start":47,"end":172,"body":[{"type":"VariableDeclaration","start":51,"end":73,"declarations":[{"type":"VariableDeclarator","start":55,"end":60,"id":{"type":"Identifier","start":55,"end":56,"name":"a"},"init":{"type":"Literal","start":59,"end":60,"value":1,"raw":"1"}},{"type":"VariableDeclarator","start":62,"end":67,"id":{"type":"Identifier","start":62,"end":63,"name":"b"},"init":{"type":"Literal","start":66,"end":67,"value":1,"raw":"1"}},{"type":"VariableDeclarator","start":69,"end":72,"id":{"type":"Identifier","start":69,"end":72,"name":"sum"},"init":null}],"kind":"var"},{"type":"ForStatement","start":76,"end":170,"init":{"type":"VariableDeclaration","start":81,"end":90,"declarations":[{"type":"VariableDeclarator","start":85,"end":90,"id":{"type":"Identifier","start":85,"end":86,"name":"i"},"init":{"type":"Literal","start":89,"end":90,"value":0,"raw":"0"}}],"kind":"var"},"test":{"type":"BinaryExpression","start":92,"end":97,"left":{"type":"Identifier","start":92,"end":93,"name":"i"},"operator":"<","right":{"type":"Identifier","start":96,"end":97,"name":"n"}},"update":{"type":"UpdateExpression","start":99,"end":102,"operator":"++","prefix":false,"argument":{"type":"Identifier","start":99,"end":100,"name":"i"}},"body":{"type":"BlockStatement","start":104,"end":170,"body":[{"type":"ExpressionStatement","start":110,"end":125,"expression":{"type":"CallExpression","start":110,"end":124,"callee":{"type":"MemberExpression","start":110,"end":121,"object":{"type":"Identifier","start":110,"end":116,"name":"output"},"property":{"type":"Identifier","start":117,"end":121,"name":"push"},"computed":false},"arguments":[{"type":"Identifier","start":122,"end":123,"name":"a"}]}},{"type":"ExpressionStatement","start":130,"end":142,"expression":{"type":"AssignmentExpression","start":130,"end":141,"operator":"=","left":{"type":"Identifier","start":130,"end":133,"name":"sum"},"right":{"type":"BinaryExpression","start":136,"end":141,"left":{"type":"Identifier","start":136,"end":137,"name":"a"},"operator":"+","right":{"type":"Identifier","start":140,"end":141,"name":"b"}}}},{"type":"ExpressionStatement","start":147,"end":153,"expression":{"type":"AssignmentExpression","start":147,"end":152,"operator":"=","left":{"type":"Identifier","start":147,"end":148,"name":"a"},"right":{"type":"Identifier","start":151,"end":152,"name":"b"}}},{"type":"ExpressionStatement","start":158,"end":166,"expression":{"type":"AssignmentExpression","start":158,"end":165,"operator":"=","left":{"type":"Identifier","start":158,"end":159,"name":"b"},"right":{"type":"Identifier","start":162,"end":165,"name":"sum"}}}]}}]}},{"type":"ExpressionStatement","start":173,"end":195,"expression":{"type":"CallExpression","start":173,"end":194,"callee":{"type":"Identifier","start":173,"end":182,"name":"fibonacci"},"arguments":[{"type":"Literal","start":183,"end":185,"value":16,"raw":"16"},{"type":"Identifier","start":187,"end":193,"name":"result"}]}},{"type":"ExpressionStatement","start":196,"end":206,"expression":{"type":"MemberExpression","start":196,"end":206,"object":{"type":"Identifier","start":196,"end":202,"name":"result"},"property":{"type":"Literal","start":203,"end":205,"value":15,"raw":"15"},"computed":true}}]}`
