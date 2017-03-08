package object

// Boolean represents a JS boolean value.
type Boolean bool

// *Boolean must satisfy Value.
var _ Value = (*Boolean)(nil)

func (Boolean) Type() string {
	return "boolean"
}

func (Boolean) IsPrimitive() bool {
	return true
}

func (Boolean) Parent() Value {
	return BooleanProto
}

// Number represents a JS numeric value.
type Number float64

// *Number must satisfy Value.
var _ Value = (*Number)(nil)

func (Number) Type() string {
	return "number"
}

func (Number) IsPrimitive() bool {
	return true
}

func (Number) Parent() Value {
	return NumberProto
}

// String represents a JS string value.
type String string

// *String must satisfy Value.
var _ Value = (*String)(nil)

func (String) Type() string {
	return "string"
}

func (String) IsPrimitive() bool {
	return true
}

func (String) Parent() Value {
	return StringProto
}

// BooleanProto, NumberProto, and StringProto are the (plain)
// JavaScript objects that would usually be referred to as
// Boolean.prototype, Number.prototype, and String.prototype
// respectively.
// FIXME: these need to be actual object, not nil!
var BooleanProto Value = nil
var NumberProto Value = nil
var StringProto Value = nil
