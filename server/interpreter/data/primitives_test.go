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

package data

import (
	"math"
	"testing"
)

func TestPrimitiveFromRaw(t *testing.T) {
	var tests = []struct {
		raw      string
		expected Value
	}{
		{`true`, Boolean(true)},
		{`false`, Boolean(false)},
		{`undefined`, Undefined{}},
		{`null`, Null{}},
		{`42`, Number(42)},
		{`"Hello, World!"`, String("Hello, World!")},
		// {`'Hello, World!'`, String("Hello, World!")}, // FIXME
		{`"foo'bar\"baz"`, String(`foo'bar"baz`)},
		// {`'foo\'bar"baz'`, String(`foo'bar"baz`)}, // FIXME
	}

	for _, c := range tests {
		v, nErr := NewFromRaw(c.raw)
		if nErr != nil {
			t.Errorf("newFromRaw(%#v) returned error: %#v", c.raw, nErr)
		} else if v != c.expected {
			t.Errorf("newFromRaw(%#v) == %#v (%T)\n(expected %#v (%T))",
				c.raw, v, v, c.expected, c.expected)
		}
	}
}

func TestPrimitivesPrimitiveness(t *testing.T) {
	var prims [5]Value
	prims[0] = Boolean(false)
	prims[1] = Number(42)
	prims[2] = String("Hello, world!")
	prims[3] = Null{}
	prims[4] = Undefined{}

	for i := 0; i < len(prims); i++ {
		if !prims[i].IsPrimitive() {
			t.Errorf("%v.isPrimitive() = false", prims[i])
		}
	}
}

func TestBoolean(t *testing.T) {
	b := Boolean(false)
	if b.Type() != BOOLEAN {
		t.Errorf("%v.Type() == %#v (expected %#v)", b, b.Type(), BOOLEAN)
	}
	if b.Typeof() != "boolean" {
		t.Errorf(`%v.Typeof() == %#v (expected "boolean")`, b, b.Typeof())
	}
}

func TestNumber(t *testing.T) {
	n := Number(0)
	if n.Type() != NUMBER {
		t.Errorf("%v.Type() == %#v (expected %#v)", n, n.Type(), NUMBER)
	}
	if n.Typeof() != "number" {
		t.Errorf(`%v.Typeof() == %#v (expected "number")`, n, n.Typeof())
	}
}

func TestString(t *testing.T) {
	var s Value = String("")
	if s.Type() != STRING {
		t.Errorf("%v.Type() == %#v (expected %#v)", s, s.Type(), STRING)
	}
	if s.Typeof() != "string" {
		t.Errorf(`%v.Typeof() == %#v (expected "string")`, s, s.Typeof())
	}
}

func TestString_utf16len(t *testing.T) {
	var tests = []struct {
		in       string
		expected int
	}{
		{"", 0},
		{"Hello, World!", 13},
		{"కోడ్ సిటీ", 9},
		{"𝌆", 2},
	}
	for _, c := range tests {
		if l := String(c.in).utf16len(); l != c.expected {
			t.Errorf("String(%#v).utf16len() == %d (expected %d)",
				c.in, l, c.expected)
		}
	}
}

func TestNull(t *testing.T) {
	n := Null{}
	if v := n.Type(); v != NULL {
		t.Errorf("Null{}.Type() == %#v (expected %#v)", v, NULL)
	}
	if v := n.Typeof(); v != "object" {
		t.Errorf(`Null{}.Type() == %#v (expected "object")`, v)
	}
}

func TestUndefined(t *testing.T) {
	u := Undefined{}
	if v := u.Type(); v != UNDEFINED {
		t.Errorf("Undefined{}.Type() == %#v (expected %#v)", v, UNDEFINED)
	}
	if v := u.Typeof(); v != "undefined" {
		t.Errorf(`Undefined{}.Typeof() == %#v (expected "undefined")`, v)
	}
}

func TestToBoolean(t *testing.T) {
	var tests = []struct {
		input    Value
		expected bool
	}{
		{Boolean(true), true},
		{Boolean(false), false},
		{Null{}, false},
		{Undefined{}, false},
		{String(""), false},
		{String("foo"), true},
		{String("0"), true},
		{String("false"), true},
		{String("null"), true},
		{String("undefined"), true},
		{Number(0), false},
		{Number(-0), false},
		{Number(0.0), false},
		{Number(-0.0), false},
		{Number(1), true},
		{Number(math.Inf(+1)), true},
		{Number(math.Inf(-1)), true},
		{Number(math.NaN()), false},
		{Number(math.MaxFloat64), true},
		{Number(math.SmallestNonzeroFloat64), true},
		{NewObject(nil, nil), true},
	}
	for _, c := range tests {
		if v := c.input.ToBoolean(); v != Boolean(c.expected) {
			t.Errorf("%#v.ToBoolean() (%T) == %#v", c.input, c.input, v)
		}
	}
}

// FIXME: list of whitespace characters to test (also check ES5.1 spec)
// \u0009 \u000A \u000B \u000C \u000D \u0020 \u0085 \u00A \u1680
// \u2000 \u2001 \u2002 \u2003 \u2004 \u2005 \u2006 \u2007 \u2008 \u2009 \u200A
// \u2028 \u2029 \u202F \u205F \u3000

func TestToNumber(t *testing.T) {
	var NaN = math.NaN()
	var tests = []struct {
		input    Value
		expected float64
	}{
		{Boolean(true), 1},
		{Boolean(false), 0},
		{Null{}, 0},
		{Undefined{}, NaN},
		{String(""), 0},
		{String("0"), 0},
		{String("0.0"), 0},
		{String("7"), 7},
		{String("3.14"), 3.14},
		{String("12"), 12},
		{String(" \t\v\r\n12\n\r\v\t "), 12},
		{String("010"), 10},
		{String("0x10"), 16},
		{String("0x3.14"), NaN},
		{String("-10"), -10},
		{String("6.02214086e23"), 6.02214086e23},       // Avogadro
		{String("9007199254740991"), 9007199254740991}, // MAX_SAFE_INTEGER
		{String("foo"), NaN},
		{String("false"), NaN},
		{String("null"), NaN},
		{String("undefined"), NaN},
		{Number(0), 0},
		{Number(-0), math.Copysign(0, -1)},
		{Number(0.0), 0},
		{Number(-0.0), math.Copysign(0, -1)},
		{Number(1), 1},
		{Number(math.Inf(+1)), math.Inf(+1)},
		{Number(math.Inf(-1)), math.Inf(-1)},
		{Number(math.NaN()), NaN},
		{Number(math.MaxFloat64), math.MaxFloat64},
		{Number(math.SmallestNonzeroFloat64), math.SmallestNonzeroFloat64},
		{NewObject(nil, nil), NaN},
	}
	for _, c := range tests {
		if v := c.input.ToNumber(); v != Number(c.expected) {
			// Wait, did we just fail because NaN != NaN?
			if !math.IsNaN(float64(v)) || !math.IsNaN(c.expected) {
				t.Errorf("%#v.ToNumber() (%T) == %#v (expected %#v)",
					c.input, c.input, v, c.expected)
			}
		}
	}
}

func TestToString(t *testing.T) {
	var tests = []struct {
		input    Value
		expected string
	}{
		{Boolean(true), "true"},
		{Boolean(false), "false"},
		{Null{}, "null"},
		{Undefined{}, "undefined"},
		{String(""), ""},
		{String("foo"), "foo"},
		{String("\"foo\""), "\"foo\""},
		{Number(0), "0"},
		{Number(math.Copysign(0, -1)), "-0"},
		{Number(math.Inf(+1)), "Infinity"},
		{Number(math.Inf(-1)), "-Infinity"},
		{Number(math.NaN()), "NaN"},
		// FIXME: add test cases for decimal -> scientific notation
		// transition threshold.
	}
	for _, c := range tests {
		if v := c.input.ToString(); v != String(c.expected) {
			t.Errorf("%#v.ToString() (input type %T) == %#v "+
				"(expected %#v)", c.input, c.input, v, c.expected)
		}
	}
}
