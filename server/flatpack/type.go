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

// tID is a string uniquely identifying a type
type tID string

// ref replaces pointers in flattened types
type ref int

// tagged replaces interface types in flattened types
type tagged struct {
	T tID
	V interface{}
}

// tIDOf returnes the tID (type ID) of its argument
func tIDOf(typ reflect.Type) tID {
	// FIXME: this isn't guaranteed to be unique.  At very least we
	// should check for dupes and panic if two different types give
	// same tID.
	return tID(typ.String())
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
// ID in addition to the interface value.
//
// - Structs have all fields exported.
//
// - Maps with non-string key types replaced by slice of 2-member struct.
func flatType(typ reflect.Type) reflect.Type {
	if typ == nil {
		panic("nil is not a type")
	}
	switch typ.Kind() {
	case reflect.Invalid:
		panic("Invalid Kind")
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr,
		reflect.Float32, reflect.Float64, reflect.Complex64, reflect.Complex128, reflect.String:
		return typ
	case reflect.Array:
		return reflect.ArrayOf(typ.Len(), flatType(typ.Elem()))
	case reflect.Interface:
		return reflect.TypeOf(tagged{"", nil})
	case reflect.Map:
		// If the map key type is a string then we mostly leave it
		// alone; other maps become a slice of {key, value} pairs.
		if typ.Key().Kind() == reflect.String {
			return reflect.MapOf(typ.Key(), flatType(typ.Elem()))
		} else {
			var fields = make([]reflect.StructField, 2)
			fields[0].Name = "K"
			fields[0].Type = flatType(typ.Key())
			fields[0].Tag = `json:"k"`
			fields[1].Name = "V"
			fields[1].Type = flatType(typ.Elem())
			fields[1].Tag = `json:"v"`
			return reflect.SliceOf(reflect.StructOf(fields))
		}
	case reflect.Ptr:
		return reflect.TypeOf((*ref)(nil)).Elem() // *whatever => ref
	case reflect.Slice:
		return reflect.SliceOf(flatType(typ.Elem()))
	case reflect.Struct:
		var fields []reflect.StructField
		for i := 0; i < typ.NumField(); i++ {
			f := typ.Field(i)
			f.Tag = reflect.StructTag(fmt.Sprintf(`json:"%s"`, f.Name))
			f.Name = "F_" + f.Name
			f.PkgPath = ""
			f.Type = flatType(f.Type)
			fields = append(fields, f)
		}
		return reflect.StructOf(fields)
	case reflect.Chan, reflect.Func, reflect.UnsafePointer:
		panic("Not implemented")
	default:
		panic("Invalid Kind")
	}
}
