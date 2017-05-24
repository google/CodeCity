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

package testutil

import (
	"fmt"
	"math"
	"reflect"
	"unsafe"
)

// This file provides some utility functions used in testing the rest
// of the package.

// RecEqual reports whether x and y are "recursively equal", as
// defined below.  This is similar to reflect.DeepEqual, but also
// considers whether they have the same structure (shared substructure
// and cycles).  Additionally, recEqual is slightly more picky about
// some types, and and more lenient about others, than DeepEqual is.
//
// Values of distinct types are never recursively equal.  Values of
// identical type are recursively equal if one of the following is
// true:
//
// Boolean, integer and string values are recursively equal if they
// are equal according to the == operator.
//
// Arrays are recursively equal if all their corresponding elements
// are recursively equal.
//
// Complex numbers are recursively equal if their corresponding real
// and imaginary parts are recursively equal.
//
// Floats are recursively equal if they are both NaN, both 0 or both
// -0; or if they are non-zero and equal according to the == operator.
//
// Interface values are recursively equal if their contents are
// recurisvely equal.
//
// Map values are recursively equal if their values as references are
// recursively equal according to the rules for pointers (below), and
// they additionally have the same length, and their corresponding
// keys (according to ==) map to recursively equal values.  (Note that
// recursive equality for maps with NaN keys is not well-defined.)
//
// Pointer values are recursively equal if they point at recursively
// equal values AND ADDITIONALLY if every occurence of pointer p1 in v1
// corresponds to the same pointer p2 in v2 (and vice versa).
//
// Slice values are recursively equal if they are both nil or both
// non-nil, and have the same length, and their corresponding elements
// are deeply equal.
//
// Struct values are recursively equal if their corresponding fields
// (exported and unexported) are recursively equal.
//
// Func values are recursively equal if they are both nil or if they
// point to the same location.
//
// Comparison of Channel and unsafe.Pointer values is not implemented;
// attempting to compare such values will cause a panic.
//
// In addition to the above rules, if disjoint == true then RecEqual
// will return false any map, pointer, or slice backing pointer value
// found in v1 also appears in v2.
//
// BUG(cpcallen): Checking of slices for shared substructure is very
// primitive and likely to miss many cases.
func RecEqual(x, y interface{}, disjoint bool) bool {
	return recValueEqual(reflect.ValueOf(x), reflect.ValueOf(y), disjoint)
}

func recValueEqual(v1, v2 reflect.Value, disjoint bool) bool {
	return recEq(v1, v2, disjoint, make(map[unsafe.Pointer]unsafe.Pointer), make(map[unsafe.Pointer]unsafe.Pointer))
}

// recEq recursively tests for structural equality of v1 and
// v2.
//
// If disjoint is true, then v1 and v2 must not share any substructure.
//
// v1s and v2s keep track of previously-visited values; in v1s the
// keys are pointers found in v2 and their corresponding pointers from
// v2; in v2s it is vice versa.  We keep maps for both directions
// because otherwise certain cases of structural dissimilarity (or
// shared substructure between v1 and v2) might otherwise not be caught.
//
// FXIME: Slices should have better check for shared backing
func recEq(v1, v2 reflect.Value, disjoint bool, v1s, v2s map[unsafe.Pointer]unsafe.Pointer) bool {
	if !v1.IsValid() {
		return !v2.IsValid()
	} else if !v2.IsValid() {
		return false // Already know v1 valid.
	}
	if v1.Type() != v2.Type() {
		return false
	}

	switch v1.Kind() {
	case reflect.Map, reflect.Ptr, reflect.Slice:
		v1p := unsafe.Pointer(v1.Pointer())
		v2p := unsafe.Pointer(v2.Pointer())

		// Check for disjointness if requested:
		if disjoint {
			// (But ignore zero-capacity slices.)
			if v1.Kind() != reflect.Slice || v1.Cap() > 0 && v2.Cap() > 0 {
				_, v2in1 := v1s[v2p]
				_, v1in2 := v2s[v1p]
				if (!v1.IsNil() && v1p == v2p) || v2in1 || v1in2 {
					return false
				}
			}
		}

		// Check if we have previously visited this v1 (and if so whether
		// we have the correct corresponding v2):
		v1o, seen1 := v1s[v1p]
		v2o, seen2 := v2s[v2p]
		if seen1 {
			return seen2 && v1o == v2p && v2o == v1p
		} else if seen2 {
			return false
		}
		v1s[v1p] = v2p
		v2s[v2p] = v1p

	}

	switch v1.Kind() {
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr,
		reflect.String:
		return v1.Interface() == v2.Interface()
	case reflect.Array:
		for i, l := 0, v1.Len(); i < l; i++ {
			if !recEq(v1.Index(i), v2.Index(i), disjoint, v1s, v2s) {
				return false
			}
		}
	case reflect.Complex64, reflect.Complex128:
		c1, c2 := v1.Complex(), v2.Complex()
		return same(real(c1), real(c2)) && same(imag(c1), imag(c2))
	case reflect.Float32, reflect.Float64:
		return same(v1.Float(), v2.Float())
	case reflect.Interface, reflect.Ptr:
		return recEq(v1.Elem(), v2.Elem(), disjoint, v1s, v2s)
	case reflect.Map:
		if v1.IsNil() != v2.IsNil() || v1.Len() != v2.Len() {
			return false
		}
		for _, k := range v1.MapKeys() {
			v1v := v1.MapIndex(k)
			v2v := v2.MapIndex(k)
			if !v1v.IsValid() || !v2v.IsValid() || !recEq(v1v, v2v, disjoint, v1s, v2s) {
				return false
			}
		}
	case reflect.Slice:
		if v1.IsNil() != v2.IsNil() || v1.Len() != v2.Len() {
			return false
		}
		for i, n := 0, v1.Len(); i < n; i++ {
			if !recEq(v1.Index(i), v2.Index(i), disjoint, v1s, v2s) {
				return false
			}
		}
	case reflect.Struct:
		if !v1.CanAddr() {
			vv := reflect.New(v1.Type()).Elem()
			vv.Set(v1)
			v1 = vv
		}
		if !v2.CanAddr() {
			vv := reflect.New(v2.Type()).Elem()
			vv.Set(v2)
			v2 = vv
		}
		for i, n := 0, v1.NumField(); i < n; i++ {
			v1v := v1.Field(i)
			v2v := v2.Field(i)
			// Defeat restrictions on access to unexported fields:
			if !v1v.CanSet() {
				v1v = reflect.NewAt(v1v.Type(), unsafe.Pointer(v1v.UnsafeAddr())).Elem()
				v2v = reflect.NewAt(v2v.Type(), unsafe.Pointer(v2v.UnsafeAddr())).Elem()
			}
			if !recEq(v1v, v2v, disjoint, v1s, v2s) {
				return false
			}
		}
	case reflect.Func:
		return unsafe.Pointer(v1.Pointer()) == unsafe.Pointer(v2.Pointer())
	case reflect.Chan, reflect.UnsafePointer:
		panic(fmt.Errorf("Comparison of %s not implemented", v1.Kind()))
	default:
		panic(fmt.Errorf("Invalid Kind %s", v1.Kind()))
	}
	return true
}

// same returns true iff its float64 args represent the same logical
// (rather than mathematical) value.  So:
//     same(NaN, NaN) == true
//     same(0, -0) == false
// and otherwise:
//      same(x, y) == (x == y)
func same(f1, f2 float64) bool {
	if f1 == f2 {
		if f1 == 0 && f2 == 0 {
			return math.Signbit(f1) == math.Signbit(f2)
		}
		return true
	}
	if math.IsNaN(f1) && math.IsNaN(f2) {
		return true
	}
	return false
}
