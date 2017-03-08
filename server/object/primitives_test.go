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
