package object

import "unicode/utf16"

// Booleans, numbers and strings are represented as immediate data -
// i.e., the Value interface data contains the value itself rather
// than a pointer to it, as it would in the case of a plain object.
// (null and undefined are similarly represented with empty structs.)
//
//
// tl;dr: do NOT take the address of a primitive.

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

func (Boolean) GetProperty(name string) (Value, bool) {
	return nil, false
}

// SetProperty on Boolean always succeeds but has no effect.
func (Boolean) SetProperty(name string, value Value) (ok bool) {
	return true
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

func (Number) GetProperty(name string) (Value, bool) {
	return nil, false
}

// SetProperty on Number always succeeds but has no effect.
func (Number) SetProperty(name string, value Value) (ok bool) {
	return true
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

func (this String) GetProperty(name string) (Value, bool) {
	if name != "length" {
		return nil, false
	}
	return Number(len(utf16.Encode([]rune(string(this))))), true
}

// SetProperty on String always succeeds but has no effect (even on
// length).
func (String) SetProperty(name string, value Value) (ok bool) {
	return true
}

/********************************************************************/
// Null represents a JS null value.
type Null struct{}

// Null must satisfy Value.
var _ Value = Null{}

func (Null) Type() string {
	return "object"
}

func (Null) IsPrimitive() bool {
	return true
}

func (Null) Parent() Value {
	panic("Cannot get parent (prototype) of null")
}

func (Null) GetProperty(name string) (Value, bool) {
	return nil, false
}

// SetProperty on Null always fails.
func (Null) SetProperty(name string, value Value) (ok bool) {
	return false
}

/********************************************************************/
// Undefined represents a JS undefined value.
type Undefined struct{}

// Undefined must satisfy Value.
var _ Value = Undefined{}

func (Undefined) Type() string {
	return "undefined"
}

func (Undefined) IsPrimitive() bool {
	return true
}

func (Undefined) Parent() Value {
	panic("Cannot get parent (prototype) of undefined")
}

func (Undefined) GetProperty(name string) (Value, bool) {
	return nil, false
}

// SetProperty on Undefined always fails.
func (Undefined) SetProperty(name string, value Value) (ok bool) {
	return false
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
