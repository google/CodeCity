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

// serialise implements a mechanism to convert arbitrary Go data,
// possibly including shared substructures, into a slice of objects
// that can be serialised using encoding.json or the like.
//
// BUG(cpcallen): does not handle internal pointers (pointers to array
// or struct element) correctly.
//
// BUG(cpcallen): does not handle shared backing arrays for slices (or
// strings) correctly.
package serialize

import (
	"reflect"
)

// Flatpack is an easily-serializable representation of an arbitrary
// Go value.  It is guaranteed not to have any cycles or shared
// substructure, private struct fields[*], nil pointers (in fact, it
// has no pointers whatsoever), or maps with non-string keys[*].  It
// also ensures all interface types have an accompanying tag to make
// it easy to find the correct concrete type when unmarshalling.
//
// [*] Except for private fields used internally to this package, and
// which do not need to be (de)serialised.
type Flatpack struct {
	// FIXME: types?

	// Values is a slice of tagged, flattened values.
	Values []tagged

	// index is a map of (pointer) values to ref (index of flattened value)
	index map[interface{}]ref
}

func NewFlatpack() *Flatpack {
	var f Flatpack
	f.index = make(map[interface{}]ref)
	return &f
}

// Flatten takes an arbitrary Go value and returns a Flatpack of it.
func Flatten(v interface{}) *Flatpack {
	var f = NewFlatpack()
	f.Flatten(v)
	return f
}

// RefOf returns the reference (index) of the flattened version of its
// argument, which should be a pointer, or !ok if the argument was not
// a pointer or has not yet been flattened.
func (f *Flatpack) RefOf(v interface{}) (idx ref, ok bool) {
	if reflect.TypeOf(v).Kind() != reflect.Ptr {
		return -1, false
	}
	idx, ok = f.index[v]
	return
}

// flatten takes an ordinary value and returns it in flattened form.
// In partciular, the type of the result will be the flatType of the
// type of the argument:
//
//     f.flatten(v).Type() == flatType(v.Type())
//
// Iff given a pointer to a value then then the flattened value will
// be added to the flatpack (if it was not already there), and the
// return value will be a ref containing the index of the packed,
// flattened object.
func (f *Flatpack) flatten(v reflect.Value) reflect.Value {
	typ := v.Type()
	// FIXME: use type registry?
	ftyp := flatType(typ)

	switch typ.Kind() {
	case reflect.Invalid:
		panic("Invalid Kind") // Should never happen
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr,
		reflect.Float32, reflect.Float64, reflect.Complex64, reflect.Complex128, reflect.String:
		return v
	case reflect.Array:
		r := reflect.New(ftyp).Elem()
		for i := 0; i < v.Len(); i++ {
			r.Index(i).Set(f.flatten(v.Index(i)))
		}
		return r
	case reflect.Interface:
		// FIXME: what if v is a nil interface value?
		var r = reflect.ValueOf(new(tagged)).Elem()
		r.Field(0).Set(reflect.ValueOf(tIDOf(v.Elem().Type())))
		r.Field(1).Set(f.flatten(v.Elem()))
		return r
	case reflect.Map:
		// FIXME: implement (two versions)!
		panic("Not implemented")
	case reflect.Ptr:
		// FIXME: what is v is a nil pointer?

		// Check to see if we have already flattened thing pointed to.
		if r, ok := f.index[v.Interface()]; ok {
			return reflect.ValueOf(r)
		}
		// Allocate a space in the flatpack for the (flattened
		// version) of the thing v points at, and record in f.index:
		idx := len(f.Values)
		f.Values = append(f.Values, tagged{})
		f.index[v.Interface()] = ref(idx)

		// Stick thing v points at in an interface (so we can record
		// its type info) and flatten that:
		var tmp interface{} = v.Elem().Interface()
		vi := reflect.ValueOf(&tmp).Elem()
		fv := f.flatten(vi)
		// Save result in earlier-allocated spot in f.Values:
		f.Values[idx] = fv.Interface().(tagged)
		//	Return newly-allocated index idx as ref:
		return reflect.ValueOf(ref(idx))
	case reflect.Slice:
		// Won't need to append to r before seralizing, and any spare
		// capacity will not be preserved when deserializing, so trim
		// our flattened version now (i.e., cap == len).
		r := reflect.MakeSlice(ftyp, v.Len(), v.Len())
		for i := 0; i < v.Len(); i++ {
			r.Index(i).Set(f.flatten(v.Index(i)))
		}
		return r
	case reflect.Struct:
		// To (usefully) read unexported fields (using unsafe) we need
		// to be able to get pointers to them, so make an addressable
		// copy of v, if it is not already addressable:
		if !v.CanAddr() {
			vv := reflect.New(typ).Elem()
			vv.Set(v)
			v = vv
		}
		r := reflect.New(ftyp).Elem()
		for i := 0; i < ftyp.NumField(); i++ {
			r.Field(i).Set(f.flatten(defeat(v.Field(i))))
		}
		return r
	case reflect.Chan, reflect.Func, reflect.UnsafePointer:
		panic("Not implemented")
	default:
		panic("Invalid Kind")
	}
}
