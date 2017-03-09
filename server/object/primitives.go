package object

// Booleans, numbers and strings are represented as immediate data -
// i.e., the Value interface data contains the value itself rather
// than a pointer to it, as it would in the case of a plain object.
//
// tl;dr: do NOT take the address of a Boolean, Number or String

/********************************************************************/
// Boolean represents a JS boolean value.
type Boolean bool

// Boolean must satisfy Value.
var _ Value = Boolean(false)

func (Boolean) Type() string {
	return "boolean"
}

func (Boolean) IsPrimitive() bool {
	return true
}

func (Boolean) Parent() Value {
	return BooleanProto
}

/********************************************************************/
// Number represents a JS numeric value.
type Number float64

// Number must satisfy Value.
var _ Value = Number(0)

func (Number) Type() string {
	return "number"
}

func (Number) IsPrimitive() bool {
	return true
}

func (Number) Parent() Value {
	return NumberProto
}

/********************************************************************/
// String represents a JS string value.
type String string

// String must satisfy Value.
var _ Value = String("")

func (String) Type() string {
	return "string"
}

func (String) IsPrimitive() bool {
	return true
}

func (String) Parent() Value {
	return StringProto
}

/********************************************************************/
// BooleanProto, NumberProto, and StringProto are the (plain)
// JavaScript objects that are the prototypes for all primitive
// objects of their respective type (they would usually be accessed in
// JavaScript as Boolean.prototype, Number.prototype, and
// String.prototype respectively.
var BooleanProto = &Object{
	parent:     ObjectProto,
	properties: make(map[string]property),
}

var NumberProto = &Object{
	parent:     ObjectProto,
	properties: make(map[string]property),
}

var StringProto = &Object{
	parent:     ObjectProto,
	properties: make(map[string]property),
}
