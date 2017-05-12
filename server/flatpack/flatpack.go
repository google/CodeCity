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

// flatpack implements a mechanism to convert arbitrary Go data,
// possibly including shared and/or cyclic substructure, into a purely
// tree-structured datastructure that can be serialised using
// encoding.json or the like.
//
// BUG(cpcallen): does not handle interior pointers (pointers to array
// or struct element) correctly.
//
// BUG(cpcallen): does not handle shared backing arrays for slices (or
// strings) correctly.
package flatpack

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

func New() *Flatpack {
	var f Flatpack
	f.index = make(map[interface{}]ref)
	return &f
}

// flatten takes an ordinary reflect.Value and returns it in flattened
// form.  In partciular, the type of the result will be the flatType
// of the type of the argument:
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
		r := reflect.ValueOf(new(tagged)).Elem()
		r.Field(0).Set(reflect.ValueOf(tIDOf(v.Elem().Type())))
		r.Field(1).Set(f.flatten(v.Elem()))
		return r
	case reflect.Map:
		var r reflect.Value
		if ftyp.Kind() == reflect.Map {
			r = reflect.MakeMap(ftyp)
			for _, k := range v.MapKeys() {
				r.SetMapIndex(k, f.flatten(v.MapIndex(k)))
			}
		} else {
			r = reflect.MakeSlice(ftyp, v.Len(), v.Len())
			for i, k := range v.MapKeys() {
				pair := reflect.New(ftyp.Elem()).Elem()
				pair.Field(0).Set(f.flatten(k))
				pair.Field(1).Set(f.flatten(v.MapIndex(k)))
				r.Index(i).Set(pair)
			}
		}
		return r
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
