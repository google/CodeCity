package object

// An Owner is an object that can own other objects and properties.
type Owner struct {
	Object
	// FIXME: other fields go here.
}

// *Owner must satisfy Value.
var _ Value = (*Owner)(nil)

// OwnerProto is the default prototype for owners:

var OwnerProto = &Object{
	parent:     ObjectProto,
	properties: make(map[string]property),
}
