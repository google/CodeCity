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

package flatpack

import (
	"reflect"
	"testing"

	"CodeCity/server/testutil"
)

// Some user-declared types for testing:
type myBool bool
type myInt int
type myUint64 uint64
type myFloat64 float64
type myComplex64 complex64
type myString string
type loop *loop

// All these should not be changed by flatten() or unflatten(), and in
// the former case nothing should be added to the flatpack.
var simpleCases = []interface{}{
	false,
	int(1),
	int8(2),
	int16(3),
	int32(4),
	int64(5),
	uint(6),
	uint8(7),
	uint16(8),
	uint32(9),
	uint64(10),
	uintptr(11),
	float32(12.0),
	float64(13.0),
	complex64(14 + 15i),
	complex128(16 + 17i),
	string("Eighteen"),

	myBool(false),
	myInt(19),
	myUint64(20),
	myFloat64(21.0),
	myComplex64(22 + 23i),
	myString("twenty-four"),

	[3]int{24, 25, 26},
	[]int{27, 28, 29},
	map[myString]myInt{
		"cpcallen": 2365779,
		"fraser":   7499832,
	},
}

func TestSimple(t *testing.T) {
	var f = New()
	for _, c := range simpleCases {
		typ := reflect.TypeOf(c)
		v := reflect.ValueOf(c)
		if r := f.flatten(v); !testutil.RecEqual(r.Interface(), c, true) {
			t.Errorf("f.flatten(reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", c, r, c)
		}
		if r := f.unflatten(typ, v); !testutil.RecEqual(r.Interface(), c, true) {
			t.Errorf("f.unflatten(%s, reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", typ, c, r, c)
		}
	}
	if len(f.Values) != 0 {
		t.Errorf("f.Values == %#v (expected empty slice)", f.Values)
	}
}

type complexCase struct {
	name       string      // Testcase name
	pre        interface{} // Value to flatten before test (as setup)
	orig, flat interface{} // Original and flattened value
	newVals    int         // How many items will be added to .Values()?
	skip       bool        // Should this test be skipped?
}

// Data used (by pointer) in some complex cases:

var ints = [...]int{42, 69, 105}
var spam = "spam"
var loop1, loop2 loop
var hhg = map[string]int{"answer": 42}

// complexCases are the cases checked by TestComplex.
//
// N.B. TestComplex runs extra checks for certain named testcases.  Be
// careful if renaming testcases to make sure new name matches!
var complexCases = []complexCase{
	{
		name:    "ArrayPtr",
		orig:    [...]*string{nil, &spam, &spam, &spam, &spam},
		flat:    [...]ref{-1, 0, 0, 0, 0},
		newVals: 1,
	}, {
		name:    "PtrLoop",
		orig:    (loop)(&loop1),
		flat:    ref(0),
		newVals: 2,
	}, {
		// FIXME: broken because flatten gets confused about loop vs *loop
		name:    "PtrLoopBroken",
		orig:    &loop1,
		flat:    ref(0),
		newVals: 2,
		skip:    true,
	}, {
		name: "StringMap",
		pre:  [...]*int{&ints[0], &ints[1]}, // Force ref order
		orig: map[myString]*int{
			"answer":  &ints[0],
			"naughty": &ints[1],
			"random":  &ints[2],
		},
		flat: map[myString]ref{
			"answer":  ref(0),
			"naughty": ref(1),
			"random":  ref(2),
		},
		newVals: 3,
	}, {
		name: "NonStringMap",
		orig: map[[2]int]string{
			[2]int{1914, 1918}: "WW I",
			[2]int{1939, 1945}: "WW II",
			[2]int{2026, 2053}: "WW III", // Citation: http://memory-alpha.wikia.com/wiki/World_War_III
		},
	}, {
		name: "NonStringMapShareSubstructure",
		pre:  [...]*int{&ints[0], &ints[1]}, // Force ref order
		orig: map[interface{}]*int{
			nil:    &ints[0],
			"one":  &ints[1],
			2:      &ints[2],
			3 + 0i: &ints[2], // Check shared substructure
		},
		newVals: 3,
	}, {
		name: "FlattenStruct",
		orig: (struct {
			i  int
			sl []interface{}
		}{42, []interface{}{nil, 69, "Hello", true}}),
	}, {
		// FIXME: broken because flatten fails to check for
		// map-pointer equality.
		name: "SharedMapSubstructure",
		orig: struct{ m1, m2 map[string]int }{hhg, hhg},
		skip: true,
	}, {
		// FIXME: code (probably) works but test broken because of
		// limitations of RecEqual: it only compares map keys with ==
		name: "MapKeysShareSubstructure",
		orig: struct {
			s *string
			m map[*string]int
		}{
			s: &spam,
			m: map[*string]int{&spam: 42},
		},
		skip: true,
	},
}

// TestComplex does round-trip testing of more complex cases.
//
// N.B.: there are some extra checks for certain named testcases in
// the bottom section of the function.
func TestComplex(t *testing.T) {
	for _, c := range complexCases {
		t.Run(c.name, func(t *testing.T) {
			if c.skip {
				t.Skipf("Skipping %s", c.name)
			}
			var f = New()
			if c.pre != nil {
				_ = f.flatten(reflect.ValueOf(c.pre))
			}
			typ := reflect.TypeOf(c.orig)
			v := reflect.ValueOf(c.orig)
			flat := f.flatten(v)
			unflat := f.unflatten(typ, flat)

			if ftyp := flat.Type(); ftyp != flatType(typ) {
				t.Errorf("f.Flatten(reflect.ValueOf(%#v)).Type() == %s (expected %s)", c.orig, ftyp, flatType(typ))
			}
			if c.flat != nil && !testutil.RecEqual(flat.Interface(), c.flat, true) {
				t.Errorf("f.flatten(reflect.ValueOf(%#v)).Interface() == %#v (expected %#v)", c.orig, flat, c.flat)
			}
			if !testutil.RecEqual(unflat.Interface(), c.orig, true) {
				t.Errorf("f.unflatten(%s, f.flatten(reflect.ValueOf(%#v))).Interface() == %#v (expected %#[2]v)", typ, c.orig, unflat)
			}
			if len(f.Values) != c.newVals {
				t.Errorf("len(f.Values) == %d (expected %d)", len(f.Values), c.newVals)
				t.Logf("f.Values == %#v", f.Values)
			}

			// Extra checks:
			switch c.name {
			case "StringMap":
				if ft := flat.Type().Kind(); ft != reflect.Map {
					t.Errorf("f.flatten(reflect.ValueOf(%#v)).Type() == %s (expected a map type)", c.orig, ft)
				}
			case "NonStringMap", "NonStringMapShareSubstructure":
				if ft := flat.Type().Kind(); ft == reflect.Map {
					t.Errorf("f.flatten(reflect.ValueOf(%#v)).Type() == %s (expected a non-map type)", c.orig, ft)

				}
			}
		})
	}
}

// init registers types for testing, plus sets up loops:
func init() {
	var examples = []interface{}{
		myBool(false),
		myInt(0),
		myUint64(0),
		myFloat64(0),
		myComplex64(0 + 0i),
		myString(""),
		loop(nil),
	}
	for _, val := range examples {
		RegisterTypeOf(val)
	}

	loop1 = &loop2
	loop2 = &loop1
}
