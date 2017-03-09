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

	// GetProperty returns the current value of the given property or
	// an ErrorMsg if that was not possible.
	GetProperty(name string) (Value, *ErrorMsg)

	// SetProperty sets the given property to the specified value or
	// returns an ErrorMsg if that was not possible.
	SetProperty(name string, value Value) *ErrorMsg
}

// Object represents typical JavaScript objects with (optional)
// prototype, properties, etc.
type Object struct {
	owner      *Owner
	parent     Value
	properties map[string]property
	f          bool
}

// property is a property descriptor, with the following fields:
// owner: Who owns the property (has permission to write it)?
// v:     The actual value of the property.
// r:     Is the property world-readable?
// e:     Is the property enumerable
// i:     Is the property ownership inherited on children?
type property struct {
	owner *Owner
	v     Value
	r     bool
	e     bool
	i     bool
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

func (this Object) GetProperty(name string) (Value, *ErrorMsg) {
	pd, ok := this.properties[name]
	// FIXME: permissions check for property readability goes here
	if !ok {
		return Undefined{}, nil
	}
	return pd.v, nil
}

func (this *Object) SetProperty(name string, value Value) *ErrorMsg {
	pd, ok := this.properties[name]
	if ok { // Updating existing property
		// FIXME: permissions check for property writeability goes here
		pd.v = value
		this.properties[name] = pd
		return nil
	} else { // Creating new property
		// FIXME: permissions check for object writability goes here
		this.properties[name] = property{
			owner: this.owner, // FIXME: should be caller
			v:     value,
			r:     true,
			e:     true,
			i:     false,
		}
		return nil
	}
}

// ObjectProto is the default prototype for (plain) JavaScript objects
// (i.e., ones created from object literals and not via
// Object.create(nil)).
var ObjectProto = &Object{
	parent:     Null{},
	properties: make(map[string]property),
}
