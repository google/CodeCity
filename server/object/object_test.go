package object

import "testing"

func TestObjectNonPrimitiveness(t *testing.T) {
	var objs [2]Value
	objs[0] = new(Object)
	objs[1] = new(Owner)

	for i := 0; i < len(objs); i++ {
		if objs[i].IsPrimitive() {
			t.Errorf("%v.isPrimitive() = true", objs[i])
		}
	}
}
