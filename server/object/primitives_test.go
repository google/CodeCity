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
	n := Number(0)
	if n.Parent() != Value(NumberProto) {
		t.Errorf("%v.Parent() != NumberProto", n)
	}
	if n.Parent().Parent() != Value(ObjectProto) {
		t.Errorf("%v.Parent().Parent() != ObjectProto", n)
	}
}

func TestString(t *testing.T) {
	var s Value = String("")
	if s.Parent() != Value(StringProto) {
		t.Errorf("%v.Parent() != StringProto", s)
	}
	if s.Parent().Parent() != Value(ObjectProto) {
		t.Errorf("%v.Parent().Parent() != ObjectProto", s)
	}
}
