package object

import "testing"

func TestPrimitivesPrimitiveness(t *testing.T) {
	var prims [3]Value
	prims[0] = Boolean(false)
	prims[1] = Number(42)
	prims[2] = String("Hello, world!")

	for i := 0; i < len(prims); i++ {
		if !prims[i].IsPrimitive() {
			t.Errorf("%v.isPrimitive() = false", prims[i])
		}
	}
}

func TestBoolean(t *testing.T) {
	b := Boolean(false)
	if b.Parent() != Value(BooleanProto) {
		t.Errorf("%v.Parent() != BooleanProto", b)
	}
	if b.Parent().Parent() != Value(ObjectProto) {
		t.Errorf("%v.Parent().Parent() != ObjectProto", b)
	}
}

func TestNumber(t *testing.T) {
	b := Number(0)
	if b.Parent() != Value(NumberProto) {
		t.Errorf("%v.Parent() != NumberProto", b)
	}
	if b.Parent().Parent() != Value(ObjectProto) {
		t.Errorf("%v.Parent().Parent() != ObjectProto", b)
	}
}

func TestString(t *testing.T) {
	b := String("")
	if b.Parent() != Value(StringProto) {
		t.Errorf("%v.Parent() != StringProto", b)
	}
	if b.Parent().Parent() != Value(ObjectProto) {
		t.Errorf("%v.Parent().Parent() != ObjectProto", b)
	}
}
