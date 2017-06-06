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

// Object represents any JavaScript value (primitive, object, etc.).
type Object interface {
	/// Any Object is a valid Value.
	Value

	// Proto returns the prototype (parent) object for this object.
	// N.B. this is the value returned by Object.getPrototypeOf(foo)
	// (and by foo.__proto__, if not overridden); it is unrelated to
	// the .prototype property on Functions.
	Proto() Object

	// DefineOwnProperty creates a new property (or updates an
	// existing one, if possible) with the specified property
	// descriptor.
	DefineOwnProperty(key string, pd Property) *NativeError

	// GetOwnProperty returns the property descriptor for the
	// specified key and ok == true (if a property with the specified
	// key exists), or ok == false (if it doesn't).
	GetOwnProperty(key string) (pd Property, ok bool)

	// Get returns the current value of the given property or an
	// NativeError if that was not possible.
	Get(key string) (Value, *NativeError)

	// Set sets the given property to the specified value or returns
	// an NativeError if that was not possible.
	Set(key string, value Value) *NativeError

	// Delete attempts to remove the specified property.  If the
	// property exists but can't be removed for some reason an
	// NativeError is returned.  (Removing a non-existing property
	// "succeeds" silently.)
	Delete(key string) *NativeError

	// OwnPropertyKeys returns the list of (own) property keys as a
	// slice of strings.
	OwnPropertyKeys() []string

	// HasOwnProperty returns true if the specified property key
	// exists on the object itself.
	HasOwnProperty(string) bool

	// HasProperty returns true if the specified property key
	// exists on the object or its prototype chain.
	HasProperty(string) bool
}

/********************************************************************/

// object represents typical plain old JavaScript objects with
// prototype, properties, etc.; this struct is also embedded in other,
// less-plain object types like Array.
type object struct {
	owner      *Owner
	proto      Object
	properties map[string]Property
	f          bool
}

// *object must satisfy Object.
var _ Object = (*object)(nil)

// Type always returns OBJECT for regular objects.
func (object) Type() Type {
	return OBJECT
}

// Typeof always returns "object" for regular objects.
func (object) Typeof() string {
	return "object"
}

// IsPrimitive always returns false for regular objects.
func (object) IsPrimitive() bool {
	return false
}

// Proto returns the prototype (parent) object for this object.
func (obj object) Proto() Object {
	return obj.proto
}

// DefineOwnProperty creates a new property (or updates an existing
// one, if possible) with the specified property descriptor.
func (obj *object) DefineOwnProperty(key string, pd Property) *NativeError {
	// FIXME: perm / configurability checks!
	if pd.Value == nil {
		pd.Value = Undefined{}
	}
	obj.properties[key] = pd
	return nil
}

// GetOwnProperty returns the property descriptor for the specified
// key and ok == true (if a property with the specified key exists),
// or ok == false (if it doesn't).
//
// FIXME: this needs to be redefined more carefully on Array,
// BoxedString, etc.
func (obj *object) GetOwnProperty(key string) (pd Property, ok bool) {
	// FIXME: perm check?
	pd, ok = obj.properties[key]
	return pd, ok
}

// Get returns the current value of the given property or an
// NativeError if that was not possible.
//
// FIXME: this needs to be redefined more carefully on Array,
// BoxedString, etc.
func (obj object) Get(key string) (Value, *NativeError) {
	pd, ok := obj.properties[key]
	// FIXME: permissions check for property readability goes here
	if ok {
		return pd.Value, nil
	}
	// Try the prototype?
	proto := obj.Proto()
	if proto != nil {
		return proto.Get(key)
	}
	return Undefined{}, nil
}

// Set sets the given property to the specified value or returns an
// NativeError if that was not possible.
func (obj *object) Set(key string, value Value) *NativeError {
	pd, ok := obj.properties[key]
	if !ok { // Creating new property
		pd := Property{
			Value: value,
			Owner: obj.owner, // FIXME: should this be caller?
			W:     true,
			E:     true,
			C:     true,
			R:     true,
			I:     false,
		}
		return obj.DefineOwnProperty(key, pd)
	}
	// Updating existing property
	// FIXME: permissions check for property writeability goes here
	// FIXME: recurse if necessary
	pd.Value = value
	obj.properties[key] = pd
	return nil
}

// Delete removes the specified property if possible.
//
// FIXME: perm / immutability checks!
func (obj *object) Delete(key string) *NativeError {
	delete(obj.properties, key)
	return nil
}

// OwnPropertyKeys returns the list of (own) property keys as a slice
// of strings.
func (obj *object) OwnPropertyKeys() []string {
	keys := make([]string, len(obj.properties))
	i := 0
	for k := range obj.properties {
		keys[i] = k
		i++
	}
	return keys
}

// HasOwnProperty returns true if the specified property key exists on
// the object itself.
func (obj *object) HasOwnProperty(key string) bool {
	_, exists := obj.properties[key]
	return exists
}

// HasProperty returns true if the specified property key exists on
// the object or its prototype chain.
func (obj *object) HasProperty(key string) bool {
	return obj.HasOwnProperty(key) ||
		obj.proto != nil && obj.proto.HasProperty(key)
}

// ToBoolean always returns true for regular objects.
func (object) ToBoolean() Boolean {
	return true
}

// ToNumber returns the numeric equivalent of the object.
//
// BUG(cpcallen): object.ToNumber is not strictly compliant with ES5.1
// spec; it just returns .ToString().ToNumber().
func (obj object) ToNumber() Number {
	return obj.ToString().ToNumber()
}

// ToString returns a string representation of the object.  By default
// this is "[object Object]" for plain objects.
//
// BUG(cpcallen): object.ToString should call a user-code toString()
// method if present.
func (object) ToString() String {
	return "[object Object]"
}

// ToPrimitive defaults to ToNumber on objects.
//
// BUG(cpcallen): object.ToPrimitive should prefer to return the
// result of ToString() on date objects.
func (obj *object) ToPrimitive() Value {
	return obj.ToNumber()
}

// NewObject creates a new object with the specified owner and
// prototype, initialises it as appropriate, and returns a pointer to
// the newly-created object.
func NewObject(owner *Owner, proto Object) *object {
	var obj = new(object)
	obj.init(owner, proto)
	obj.f = true
	return obj
}

// init is an internal initialisation routine, called from New and
// also called when constructing other types of objects such as
// Arrays, Owners, etc.
func (obj *object) init(owner *Owner, proto Object) {
	obj.owner = owner
	obj.proto = proto
	obj.properties = make(map[string]Property)
}

/********************************************************************/

// Property is a property descriptor, per §8.10 of ES5.1
//     Value: The actual value of the property.
//     Owner: Who owns the property (has permission to write it)?
//     W:     Is the property writeable?
//     E:     Is the property enumerable?
//     C:     Is the property configurable?
//     R:     Is the property world-readable?
//     I:     Is the property ownership inherited on children?
type Property struct {
	Value   Value
	Owner   *Owner
	W, E, C bool
	R, I    bool
}

// FromPropertyDescriptor implements the altorithm of the same name
// from §8.10.4 of the ES5.1 spec, but simplified because we do not
// (yet) support getters / setters, and with extra parameters for
// objet owner and prototype.
func FromPropertyDescriptor(pd Property, owner *Owner, proto Object) (desc Object, ne *NativeError) {
	desc = NewObject(owner, proto)
	ne = desc.Set("value", pd.Value)
	if ne != nil {
		return
	}
	attrs := []struct {
		flag *bool
		key  string
	}{
		{&pd.W, "writeable"},
		{&pd.E, "enumerable"},
		{&pd.C, "configurable"},
		// FIXME: either enable, or remove, once we decide
		// what flags properties will actually have:
		// {&pd.R, "readable"},
		// {&pd.I, "inheritable"},
	}
	for _, attr := range attrs {
		ne = desc.Set(attr.key, Boolean(*attr.flag))
		if ne != nil {
			return
		}
	}
	return
}

// ToPropertyDescriptor implements the altorithm of the same name from
// §8.10.5 of the ES5.1 spec, but simplified because we do not (yet)
// support getters / setters.
func ToPropertyDescriptor(obj Object) (pd Property, ne *NativeError) {
	pd.Value, ne = obj.Get("value")
	if ne != nil {
		return
	}
	// FIXME: set owner
	pd.Owner = nil
	attrs := []struct {
		flag *bool
		key  string
	}{
		{&pd.W, "writeable"},
		{&pd.E, "enumerable"},
		{&pd.C, "configurable"},
		// FIXME: either enable, or remove, once we decide what flags
		// properties will actually have:
		// {&pd.R, "readable"},
		// {&pd.I, "inheritable"},
	}
	for _, attr := range attrs {
		var v Value
		v, ne = obj.Get(attr.key)
		if ne != nil {
			return
		}
		*(attr.flag) = bool(v.ToBoolean())
	}
	return
}
