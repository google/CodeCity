package object

import "testing"

func TestPrimitivesPrimitiveness(t *testing.T) {
	var prims [5]Value
	prims[0] = Boolean(false)
	prims[1] = Number(42)
	prims[2] = String("Hello, world!")
	prims[3] = Null{}
	prims[4] = Undefined{}

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

func TestStringLength(t *testing.T) {
	v, ok := String("").GetProperty("length")
	if v != Number(0) || !ok {
		t.Errorf("String(\"\").GetProperty(\"length\") == %v, %v"+
			"(expected 0, true", v, ok)
	}

	v, ok = String("Hello, World!").GetProperty("length")
	if v != Number(13) || !ok {
		t.Errorf("String(\"కోడ్ సిటీ\").GetProperty(\"length\") == %v, %v"+
			"(expected 13, true)", v, ok)
	}

	// "Code City" in Telugu (according to translate.google.com):
	v, ok = String("కోడ్ సిటీ").GetProperty("length")
	if v != Number(9) || !ok {
		t.Errorf("String(\"కోడ్ సిటీ\").GetProperty(\"length\") == %v, %v"+
			"(expected 9, true)", v, ok)
	}

}

func TestNullParentPanic(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Errorf("Null{}.Parent() did not panic")
		}
	}()
	_ = Null{}.Parent()
}

func TestUndefinedParentPanic(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Errorf("Undefined{}.Parent() did not panic")
		}
	}()
	_ = Undefined{}.Parent()
}
