package object

// Value represents any JavaScript value (primitive, object, etc.).
type Value interface {
	// Type() returns name of type (as given by the JavaScript typeof
	// operator).
	Type() string

	// IsPrimitive() returns true for primitive data (nubmer, string,
	// boolean, etc.).
	IsPrimitive() bool

	// Parent() returns the parent (prototype) object for this object.
	Parent() Value
}

// Object represents typical JavaScript objects with (optiona)
// prototype, properties, etc.
type Object struct {
	owner      *Owner
	parent     Value
	properties map[string]property
}

// property is a property descriptor, with the following fields:
// r:     Is the property world-readable?
// i:     Is the property ownership inherited on children?
// owner: Who owns the property (has permission to write it)?
// v:     The actual value of the property.
type property struct {
	r     bool
	i     bool
	owner *Owner
	v     Value
}

// *Object must satisfy Value.
var _ Value = (*Object)(nil)

func (Object) Type() string {
	return "object"
}

func (Object) IsPrimitive() bool {
	return false
}

func (this Object) Parent() Value {
	return this.parent
}

// An Owner is an object that can own other objects and properties.
type Owner struct {
	Object
	// FIXME: other fields go here.
}

// *Owner must satisfy Value.
var _ Value = (*Owner)(nil)
