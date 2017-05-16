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
	"fmt"
	"reflect"
)

// tID is a string uniquely identifying a type.  An untyped nil value
// (i.e., the zero value of a variable of interface type) is
// represented by the empty string.
type tID string

// tIDOf returnes the tID (type ID) of its argument.
func tIDOf(typ reflect.Type) tID {
	if typ == nil {
		return ""
	}
	// FIXME: this isn't guaranteed to be unique.  At very least we
	// should check for dupes and panic if two different types give
	// same tID.
	return tID(typ.String())
}

type typeInfo struct {
	tID  tID
	typ  reflect.Type
	ftyp reflect.Type
}

var types = make([]typeInfo, 0)
var byTID = make(map[tID]int)
var byType = make(map[reflect.Type]int)
var byFlatType = make(map[reflect.Type]int)

func RegisterTypeOf(val interface{}) {
	RegisterType(reflect.TypeOf(val))
}

func RegisterType(typ reflect.Type) {
	if _, exists := byType[typ]; exists {
		return
	}
	ti := typeInfo{tIDOf(typ), typ, flatType(typ)}
	idx := len(types)
	types = append(types, ti)
	byTID[ti.tID] = idx
	byType[ti.typ] = idx
	byFlatType[ti.ftyp] = idx
}

// flatType takes a reflect.Type and returns a substitute reflect.Type
// that can store the same data but is more suited for serialisation
// using encoding/json (and similar):
//
// - Pointer types are replaced with ref (numeric object ID indexing
// into a list of flattened objects, e.g. as in a Flatpack), so
// circular data and shared substructure can be represented.
//
// - Interfaces are replaced with a struct containing an explicit type
// ID in addition to the interface value.  This allows selection of
// the right datastructure when unmarshalling JSON.
//
// - Structs have all fields exported.
//
// - Maps with non-string key types replaced by slice of 2-member
// {key, value} struct.  This ensures maps will be correctly handled
// as JSON.
func flatType(typ reflect.Type) reflect.Type {
	if typ == nil {
		panic("nil is not a type")
	}
	switch typ.Kind() {
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr,
		reflect.Float32, reflect.Float64, reflect.Complex64, reflect.Complex128, reflect.String:
		return typ
	case reflect.Array:
		return reflect.ArrayOf(typ.Len(), flatType(typ.Elem()))
	case reflect.Interface:
		return reflect.TypeOf(tagged{})
	case reflect.Map:
		// If key type is a string, just flatten value type:
		if typ.Key().Kind() == reflect.String {
			return reflect.MapOf(typ.Key(), flatType(typ.Elem()))
		}
		// Otherwise, it becomes a slice of struct{key, value} pairs:
		var fields = []reflect.StructField{
			{Name: "K", Type: flatType(typ.Key()), Tag: `json:"k"`},
			{Name: "V", Type: flatType(typ.Elem()), Tag: `json:"v"`},
		}
		return reflect.SliceOf(reflect.StructOf(fields))
	case reflect.Ptr:
		return reflect.TypeOf((*ref)(nil)).Elem() // *whatever => ref
	case reflect.Slice:
		return reflect.SliceOf(flatType(typ.Elem()))
	case reflect.Struct:
		var fields []reflect.StructField
		for i := 0; i < typ.NumField(); i++ {
			f := typ.Field(i)
			fields = append(fields,
				reflect.StructField{
					Name: "F_" + f.Name,
					Type: flatType(f.Type),
					Tag:  reflect.StructTag(fmt.Sprintf(`json:"%s"`, f.Name)),
				})
		}
		return reflect.StructOf(fields)
	case reflect.Chan, reflect.Func, reflect.UnsafePointer:
		panic(fmt.Errorf("flat type for %v not implemented", typ.Kind()))
	default:
		panic(fmt.Errorf("Invalid Kind %s", typ.Kind()))
	}
}

// init registers all the built-in Go types that
func init() {
	var ifaces = reflect.TypeOf(
		struct {
			// i1 typename
		}{})
	for i := 0; i < ifaces.NumField(); i++ {
		RegisterType(ifaces.Field(i).Type)
	}

	var examples = []interface{}{
		uint8(0),
		uint16(0),
		uint32(0),
		uint64(0),

		int8(0),
		int16(0),
		int32(0),
		int64(0),

		float32(0),
		float64(0),

		complex64(0),
		complex128(0),

		byte(0),
		rune(0),

		uint(0),
		int(0),
		uintptr(0),

		"",
	}
	for _, val := range examples {
		RegisterTypeOf(val)
	}
}
