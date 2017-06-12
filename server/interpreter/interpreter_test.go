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
	"testing"
)

func TestInterpreterSimple(t *testing.T) {
	for _, c := range tests {
		t.Run(c.name, func(t *testing.T) {
			i := New()
			err := i.EvalASTJSON(c.ast)
			if err != nil {
				t.Error(err)
			}
			// if c.name == "namedFunctionExpression" {
			// 	i.Verbose = true
			// }
			i.Run()
			expected, _ := data.NewFromRaw(c.expected)
			if v := i.Value(); v != expected {
				t.Errorf("%s == %v (%T)\n(expected %v (%T))",
					c.src, v, v, expected, expected)
			}
		})
	}
}

func TestInterpreterObjectExpression(t *testing.T) {
	i := New()
	i.EvalASTJSON(objectExpression)
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
			intrp := New()
			err := intrp.EvalASTJSON(code[i])
			if err != nil {
				t.Error(err)
			}
			intrp.global.setVar("n", data.Number(float64(j)))
			intrp.Run()
			exp := data.Number(expected[i][j])
			if v := intrp.Value(); v != exp {
				t.Errorf("case test %d,%d == %v (%[3]T) (expected %v)",
					i, j, v, exp)
			}
		}
	}
}

func TestNewHack(t *testing.T) {
	i := NewBare()
	i.EvalASTJSON(newHack)
	i.Run()
	if v := i.Value(); v != data.String("function") {
		t.Errorf(`typeof new "Array.prototype.push" == %#v (expected "function")`, v)
	}
	i.EvalASTJSON(newHackUnknown)
	i.Run()
	if v := i.Value(); v != data.String("ReferenceError") {
		t.Errorf(`new "nonexisten-builtin-name" did not throw a ReferenceError`)
	}
}

// TestPrototypeIndependence verifies that modifying the prototype of
// a builtin object in one interpreter does not result in modifying
// the value of the prototype object in a different interpreter
// instance.
func TestPrototypeIndependence(t *testing.T) {
	i1 := New()
	op1v, _ := i1.global.getVar("Object").(data.Object).Get("prototype")
	op1 := op1v.(data.Object)
	ap1v, _ := i1.global.getVar("Array").(data.Object).Get("prototype")
	ap1 := ap1v.(data.Object)

	i2 := New()
	op2v, _ := i2.global.getVar("Object").(data.Object).Get("prototype")
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
		t.Errorf("Array.prototype.foo == %#v, %#v (expected String(\"bar\"), nil)", v, e)
	}
	if op2.HasProperty("foo") {
		t.Errorf("(other) Object.prototype.foo now defined as %#v", v)
	}
}

// TestNewBare verifies that NewBare() returns an interpreter with
// nothing in the global scope.
func TestNewBare(t *testing.T) {
	i := NewBare()
	if len(i.global.vars) > 0 {
		t.Errorf("NewBare().global.vars == %#v (expected nil)", i.global.vars)
	}
}

func BenchmarkFibonacci(b *testing.B) {
	for i := 0; i < b.N; i++ {
		i := New()
		i.EvalASTJSON(fibonacci10k)
		i.Run()
	}
}
