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
// substructure, into and back from a purely tree-structured
// datastructure without unexported fields that can be serialised
// using encoding.json or the like.
//
// There are two parts to this mechanism: the Flatpack type, the
// serialization-friendly container which stores the converted data
// (and whose Pack and Unpack methods do the necessary conversion),
// and an package-internal type registry used to locate the correct
// type when deserializing and unpacking Flatpacks.  This type
// registry must be pre-populated with all the (named) types that
// might be encountered; it will be convenient to do so by calling
// RegisterType and/or RegisterTypeOf from an init() func in each
// package whose types will be serialized.
//
// BUG(cpcallen): Flatpack.Pack() does not handle multiple references
// to the same map correctly.  Multiple copies of map contents will
// be saved in the flatpack, and Unpack() will unpack them to
// independent map structures.
//
// BUG(cpcallen): Flatpack.Pack() will incorrectly preserve shared (or
// cyclic) substructure if it encounters two pointers of different
// types that point to the same object.  (This could happen with a
// named type and its underlying type.)
//
// BUG(cpcallen): Flatpack does not handle interior pointers (pointers
// to array or struct element) correctly.
//
// BUG(cpcallen): Flatpack does not handle shared backing arrays for
// slices (or strings) correctly.
//
// BUG(cpcallen): Flatpack does not preserve spare capacity (or the
// values of elements in the underlying array between len and cap).
package flatpack

import (
	"fmt"
	"reflect"
	"runtime"
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

	// ptr2ref is a map of (pointer) values to their corresponding ref
	// (index of flattened value).  Used during packing.
	ptr2ref map[interface{}]ref

	// ref2ptr is a slice mapping refs to (the reflect.Value
	// representation of) their corresponding pointer values.  Used
	// during unpacking.
	ref2ptr []reflect.Value
}

// New creates and initializes a new flatpack.
func New() *Flatpack {
	return &Flatpack{
		Labels:  make(map[string]ref),
		ptr2ref: make(map[interface{}]ref),
	}
}

// Pack adds an arbitrary Go value to the flatpack, giving it the
// specified label.  It is an error to reuse a label within the same
// Flatpack, or to call Pack after Seal.
//
// FIXME: warn (or even panic) if unregistered types are encountered?
func (f *Flatpack) Pack(label string, value interface{}) {
	if f.ptr2ref == nil {
		panic("Flatpack is already sealed")
	}
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
func (f *Flatpack) Unpack(label string) (value interface{}, err error) {
	idx, ok := f.Labels[label]
	if !ok {
		return nil, fmt.Errorf("Label %s not found", label)
	}
	defer func() {
		if r := recover(); r != nil {
			if _, ok := r.(runtime.Error); ok {
				panic(r)
			}
			err = r.(error)
		}
	}()
	ityp := reflect.TypeOf((*interface{})(nil)).Elem()
	return f.unflatten(ityp, reflect.ValueOf(f.Values[idx])).Interface(), nil
}

// Seal removes the indices used when flattening and unflattening
// pointer values.  This ensures the Flatpack will not cause
// inadvertent retention of the original (non-flat) objects if they
// would otherwise be eligible for garbage collection.
//
// After a Flatpack is sealed it cannot have additional values added to it.
//
// Normally unpacking the same pointer value twice will return the
// same pointer (i.e., one pointing at the same object), but if Seal()
// is called between calls to Unpack the second call to Unpack will
// return a completely seperate copy.
func (f *Flatpack) Seal() {
	f.ptr2ref = nil
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
		for i, n := 0, v.Len(); i < n; i++ {
			r.Index(i).Set(f.flatten(v.Index(i)))
		}
		return r
	case reflect.Interface:
		if v.IsNil() {
			return reflect.ValueOf(tagged{T: nilTID, V: nil})
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
		if r, ok := f.ptr2ref[v.Interface()]; ok {
			return reflect.ValueOf(r)
		}
		// Allocate a space in the flatpack for the (flattened
		// version) of the thing v points at, and record in f.index:
		idx := len(f.Values)
		f.Values = append(f.Values, tagged{T: tIDOf(v.Elem().Type())})
		f.ptr2ref[v.Interface()] = ref(idx)
		// Flatten and save result in earlier-allocated spot in f.Values:
		f.Values[idx].V = f.flatten(v.Elem()).Interface()
		//	Return newly-allocated index idx as ref:
		return reflect.ValueOf(ref(idx))
	case reflect.Slice:
		// Won't need to append to r before seralizing, and any spare
		// capacity will not be preserved when deserializing, so trim
		// our flattened version now (i.e., cap == len).
		r := reflect.MakeSlice(ftyp, v.Len(), v.Len())
		for i, n := 0, v.Len(); i < n; i++ {
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
		for i, n := 0, ftyp.NumField(); i < n; i++ {
			r.Field(i).Set(f.flatten(defeat(v.Field(i))))
		}
		return r
	case reflect.Chan, reflect.Func, reflect.UnsafePointer:
		panic(fmt.Errorf("Flattening of %s not implemented", typ.Kind()))
	default:
		panic(fmt.Errorf("Invalid Kind %s", typ.Kind()))
	}
}

// abortf aborts the Unpacking with an error generated by a call to
// fmt.Errorf with the given arguments.
func abortf(format string, a ...interface{}) {
	panic(fmt.Errorf(format, a...))
}

// unflatten takes a (non-flat) reflect.Type and a value of that
// type's corresponding flattened type and converts it back to its
// original pre-flattened form.  In particular, the type of the v
// argument should be the flattened form of the type specified by typ:
//
//     flatType(typ) == v.Type()
//
// and if unflattening is successfu then then the the type of the
// result will be the same as the typ argument:
//
//     f.unflatten(typ, v).Type() == typ
//
// FIXME: Provide context information for errors, like
// encoding/json/decode.go does (see decodeState.addErrorContext)
func (f *Flatpack) unflatten(typ reflect.Type, v reflect.Value) (ret reflect.Value) {
	// FIXME: should return error instead of throwing.
	if ftyp := flatType(typ); v.Type() != ftyp {
		abortf("Type mismatch unflattening a %s: got %s but expected %s", typ, v.Type(), ftyp)
	}
	// FIXME: move postcondition check to tests once we have some
	// confidence with it working reliably in normal use.
	defer func() {
		if p := recover(); p != nil {
			panic(p)
		} else if ret.Type() != typ {
			abortf("Incorrect return type %s (expected %s)", ret.Type(), typ)
		}
	}()

	switch typ.Kind() {
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr,
		reflect.Float32, reflect.Float64, reflect.Complex64, reflect.Complex128, reflect.String:
		return v
	case reflect.Array:
		r := reflect.New(typ).Elem()
		for i, n := 0, v.Len(); i < n; i++ {
			r.Index(i).Set(f.unflatten(typ.Elem(), v.Index(i)))
		}
		return r
	case reflect.Interface:
		tid := v.Field(0).Interface().(tID)
		if tid == tIDOf(nil) { // Special case: {"", nil} -> nil
			if !v.Field(1).IsNil() {
				abortf("Non-nil vlaue with no type??")
			}
			return reflect.Zero(typ)
		}
		vtyp, _ := typesForTID(tid)
		return f.unflatten(vtyp, v.Field(1).Elem()).Convert(typ)
	case reflect.Map:
		var r reflect.Value
		if flatType(typ).Kind() == reflect.Map {
			r = reflect.MakeMap(typ)
			for _, k := range v.MapKeys() {
				r.SetMapIndex(k, f.unflatten(typ.Elem(), v.MapIndex(k)))
			}
		} else {
			// FIXME: Use MakeMapWithSize(typ, v.Len()) once Go1.9 is available.
			r = reflect.MakeMap(typ)
			for i, n := 0, v.Len(); i < n; i++ {
				kv := v.Index(i)
				uk := f.unflatten(typ.Key(), kv.Field(0))
				uv := f.unflatten(typ.Elem(), kv.Field(1))
				r.SetMapIndex(uk, uv)
			}
		}
		return r

	case reflect.Ptr:
		idx := int(v.Interface().(ref))
		if idx == -1 {
			return reflect.Zero(typ)
		} else if idx < -1 || idx > len(f.Values) {
			abortf("ref %d out of range [0:%d]", idx, len(f.Values))
		}
		if f.ref2ptr == nil { // First time unflattening any pointer?
			f.ref2ptr = make([]reflect.Value, len(f.Values))
		}
		if f.ref2ptr[idx] == (reflect.Value{}) { // First time for this pointer?
			if tIDOf(typ.Elem()) != f.Values[idx].T {
				abortf("type mismatch: Values[%d] contains a %s (expected %s)", idx, f.Values[idx].T, tIDOf(typ.Elem()))
			}
			f.ref2ptr[idx] = reflect.New(typ.Elem())
			ttyp, _ := typesForTID(f.Values[idx].T)
			tval := reflect.ValueOf(f.Values[idx].V)
			f.ref2ptr[idx].Elem().Set(f.unflatten(ttyp, tval))
		}
		return f.ref2ptr[idx].Convert(typ)
	case reflect.Slice:
		// No info re: spare capacity survives (de)serialisation, so
		// assume cap == len.
		r := reflect.MakeSlice(typ, v.Len(), v.Len())
		for i, n := 0, v.Len(); i < n; i++ {
			r.Index(i).Set(f.unflatten(typ.Elem(), v.Index(i)))
		}
		return r
	case reflect.Struct:
		r := reflect.New(typ).Elem()
		for i, n := 0, typ.NumField(); i < n; i++ {
			src := v.Field(i)
			dst := defeat(r.Field(i))
			dst.Set(f.unflatten(dst.Type(), src))
		}
		return r
	case reflect.Chan, reflect.Func, reflect.UnsafePointer:
		abortf("Unflattening of %s not implemented", typ.Kind())
	default:
		abortf("Invalid Kind %s", typ.Kind())
	}
	panic("unreachable")
}
