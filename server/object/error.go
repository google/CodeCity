package object

// ErrorMsg is a (name, description)-tuple used to report error
// conditions inside the JavaScript interpreter.  It's not actually a
// JS Error object, but might get turned into one if appropriate.
type ErrorMsg struct {
	Name    string
	Message string
}

// *ErrorMsg must satisfy error.
var _ error = (*ErrorMsg)(nil)

func (this ErrorMsg) Error() string {
	return this.Name + ": " + this.Message
}
