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

// Package flatpack implements a mechanism to convert arbitrary Go
// data, possibly including unexported fields and shared and/or cyclic
// substructure, into a purely tree-structured datastructure without
// unexported fields that can be serialised using encoding.json or the
// like.
//
// BUG(cpcallen): does not handle interior pointers (pointers to array
// or struct element) correctly.
//
// BUG(cpcallen): does not handle shared backing arrays for slices (or
// strings) correctly.
package flatpack

import (
	"fmt"
	"reflect"
)

// A Flatpack is an easily-serializable representation of a collection
// of arbitrary Go values.  It will preserve relationships, including
// cycles and shared substructure, between stored values while being
// guaranteed not to actually contain either.  Nor will it contain any
// private struct fields[1], nil pointers[2] or maps with non-string
// keys.  It also ensures all interface types have an accompanying tag
// to allow the correct concrete type to be found when unmarshalling.
//
// [1] Except for private fields used internally for packing and
// unpacking the flatpack, which do not need to be (de)serialised.
//
// [2] In fact, it has no pointers except the not-user-accessible ones
// the compiler uses to implement interface values too large to fit in
// a machine word.
type Flatpack struct {
	// FIXME: types?

	// Labels is the table of contents, maping the label of a value to
	// the index within Values it is stored at.  It should not be
	// accessed directly; instead, use the Pack and Unpack methods.
	Labels map[string]ref

	// Values is a slice of tagged, flattened values.  It is exported
	// only to allow serialisation.  The contents should not be
	// accessed directly; instead, use the Pack and Unpack methods.
	Values []tagged

	// index is a map of (pointer) values to ref (index of flattened value)
	index map[interface{}]ref
}

// New creates and initializes a new flatpack.
func New() *Flatpack {
	return &Flatpack{
		Labels: make(map[string]ref),
		index:  make(map[interface{}]ref),
	}
}

// Pack adds an arbitrary Go value to the flatpack, giving it the
// specified label.  It is an error to reuse a label within the same
// Flatpack.
func (f *Flatpack) Pack(label string, value interface{}) {
	if _, exists := f.Labels[label]; exists {
		panic(fmt.Errorf("Duplicate label %s", label))
	}
	idx := len(f.Values)
	f.Values = append(f.Values, tagged{})
	v := reflect.ValueOf(value)
	fv := f.flatten(v)
	f.Values[idx] = tagged{tIDOf(v.Type()), fv.Interface()}
	f.Labels[label] = ref(idx)
}

// Unpack retrieves the value associated with the given label from the
// Flatpack and returns it.
func (f *Flatpack) Unpack(label string) interface{} {
	panic("Not implemented")
}

// ref replaces all pointer types in flattened values.  It is just the
// numerical index of the packed, flattened representation of the
// target object within the flatpack's .Values slice, or -1 if the
// pointer is a nil pointer.
type ref int

// tagged replaces all interface types in flattened values.
type tagged struct {
	T tID
	V interface{}
}

// flatten takes an ordinary reflect.Value and returns it in flattened
// form.  In particular, the type of the result will be the flatType
// of the type of the argument:
//
//     f.flatten(v).Type() == flatType(v.Type())
//
// Iff given a pointer to a value then then the flattened value will
// be appended to f.Values (if the pointed-to value has not not
// already been added), and the return value will be a ref containing
// the index of the packed, flattened object.  The caller is otherwise
// responsible for storing the flattened value in the flatpack.
func (f *Flatpack) flatten(v reflect.Value) reflect.Value {
	typ := v.Type()
	// FIXME: use type registry?
	ftyp := flatType(typ)

	switch typ.Kind() {
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
		if v.IsNil() {
			return reflect.ValueOf(tagged{T: tIDOf(nil), V: nil})
		}
		return reflect.ValueOf(tagged{
			T: tIDOf(v.Elem().Type()),
			V: f.flatten(v.Elem()).Interface(),
		})
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
		// Check for nil pointer.
		if v.IsNil() {
			return reflect.ValueOf(ref(-1))
		}
		// Check to see if we have already flattened thing pointed to.
		if r, ok := f.index[v.Interface()]; ok {
			return reflect.ValueOf(r)
		}
		// Allocate a space in the flatpack for the (flattened
		// version) of the thing v points at, and record in f.index:
		idx := len(f.Values)
		f.Values = append(f.Values, tagged{T: tIDOf(v.Elem().Type())})
		f.index[v.Interface()] = ref(idx)
		// Flatten and save result in earlier-allocated spot in f.Values:
		f.Values[idx].V = f.flatten(v.Elem()).Interface()
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
		panic(fmt.Errorf("Flattening of %s not implemented", typ.Kind()))
	default:
		panic(fmt.Errorf("Invalid Kind %s", typ.Kind()))
	}
}
