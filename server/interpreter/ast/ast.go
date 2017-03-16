// The ast package defines types to store an abstract syntax tree, in
// ESTree EcmaScript 5 format, as defined at
// https://github.com/estree/estree/blob/master/es5.md, as tree of Go
// structs, interfaces, and slices.
//
// Most of the ES5 nodes are represented by a Go struct of the same
// name, with the same field names (but with capitalised initials so
// they are visible outside the ast package).
//
// There are some execptions - notably for statements and expressions -
// where multiple different ES5 node types can appear in the same
// position in the parse tree.
//
// Most of the type declarations are in astnodes.go which is
// auto-generated from the ES5 ESTree spec document by the md2go
// script; run `go generate` to update it.  The rest of the code, and
// in particular interface types and associated methods, is in ast.go.
package ast

//go:generate sh -c "./md2go es5.md > astnodes.go && go fmt"

import (
	"encoding/json"
	"fmt"
	"reflect"
)

// typeOnly is used in the two-pass UnmarshalJSON routines: they
// initially unmarshal the unknown JSON object into this type, so as
// to be able to determine the node types to allocate for the second
// pass.  JSON unmarhsalling routines.
type typeOnly struct {
	Type string `json:"type"`
}

// node is an interface fulfilled by all ESTree nodes.
type node interface {
	_is_node()
}

// nodeStuff._is_node() is a dummy method for interface satisfaction.
func (nodeStuff) _is_node() {}

// statement is an interface fulfilled by all ESTree <Foo>Statement
// nodes.
type statement interface {
	_is_statement()
}

// statementStuff._is_statement() is a dummy method for interface
// satisfaction.
func (statementStuff) _is_statement() {}

// Statement is a wrapper of (a single instance of) the statement
// interface to allow a UnmarshallJSON method to be defined.
type Statement struct{ S statement }

func (this *Statement) UnmarshalJSON(b []byte) error {
	var tmp typeOnly
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	stype, ok := statementTypes[tmp.Type]
	if !ok {
		return fmt.Errorf("ast: json.Unmarshal: unknown type %s", tmp.Type)
	}
	var s statement = reflect.New(reflect.TypeOf(stype).Elem()).
		Interface().(statement)
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	this.S = s
	return nil
}

// Statements is a wrapper of slice of statement interfaces to allow a
// UnmarshallJSON method to be defined.
type Statements []statement

func (this *Statements) UnmarshalJSON(b []byte) error {
	var tmp []typeOnly
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	s := make([]statement, len(tmp))
	for i, t := range tmp {
		stype, ok := statementTypes[t.Type]
		if !ok {
			return fmt.Errorf("ast: json.Unmarshal: unknown type %s", t.Type)
		}
		s[i] = reflect.New(reflect.TypeOf(stype).Elem()).Interface().(statement)
	}
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	*this = s
	return nil
}

/********************************************************************/

// expression is an interface satisfied by all ESTree <Foo>Expression
// nodes.
type expression interface {
	_is_expression()
}

// expressionStuff._is_expression() is a dummy method for interface
// satisfaction.
func (expressionStuff) _is_expression() {}

// Expression is a wrapper of (a single instance of) the expression
// interface to allow a UnmarshallJSON method to be defined.
type Expression struct{ E expression }

// Expressions is a wrapper of slice of expression interfaces to allow
// a UnmarshallJSON method to be defined.
func (this *Expression) UnmarshalJSON(b []byte) error {
	var tmp typeOnly
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	etype, ok := expressionTypes[tmp.Type]
	if !ok {
		return fmt.Errorf("ast: json.Unmarshal: unknown type %s", tmp.Type)
	}
	var e expression = reflect.New(reflect.TypeOf(etype).Elem()).
		Interface().(expression)
	if err := json.Unmarshal(b, &e); err != nil {
		return err
	}
	this.E = e
	return nil
}

// Expressions is a wrapper of slice of expression interfaces to allow
// a UnmarshallJSON method to be defined.
type Expressions []expression

func (this *Expressions) UnmarshalJSON(b []byte) error {
	var tmp []typeOnly
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	e := make([]expression, len(tmp))
	for i, t := range tmp {
		etype, ok := expressionTypes[t.Type]
		if !ok {
			return fmt.Errorf("ast: json.Unmarshal: unknown type %s", t.Type)
		}
		e[i] = reflect.New(reflect.TypeOf(etype).Elem()).
			Interface().(expression)
	}
	if err := json.Unmarshal(b, &e); err != nil {
		return err
	}
	*this = e
	return nil
}

/********************************************************************/

// ForStatementInit is (wrapper for an) interface representing the
// things that can appear in the first position of a for statement -
// specifically, either a VariableDeclaration (for(var v = 0; ...)) or
// an Expression (for(v = 0; ...)).
type ForStatementInit struct{ N forStatementInit }
type forStatementInit interface {
	_is_forStatementInit()
}

func (VariableDeclaration) _is_forStatementInit() {}
func (Identifier) _is_forStatementInit()          {}

func (this *ForStatementInit) UnmarshalJSON(b []byte) error {
	var tmp typeOnly
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	var n forStatementInit
	switch tmp.Type {
	case "VariableDeclaration":
		n = new(VariableDeclaration)
	case "Identifier":
		n = new(Identifier)
	default:
		return fmt.Errorf("Unrecognized type %s", tmp.Type)
	}
	if err := json.Unmarshal(b, &n); err != nil {
		return err
	}
	this.N = n
	return nil
}

/********************************************************************/

// ForInStatementLeft is a (wrapper for an) interface representing the
// things that can appear in the first position of a for-in statement
// - specifically, either a VariableDeclaration (for(var v in ...)) or
// an Identifier (for(v in ...).
type ForInStatementLeft struct{ N forInStatementLeft }
type forInStatementLeft interface {
	_is_forInStatementLeft()
}

func (VariableDeclaration) _is_forInStatementLeft() {}
func (Identifier) _is_forInStatementLeft()          {}

func (this *ForInStatementLeft) UnmarshalJSON(b []byte) error {
	var tmp typeOnly
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	var n forInStatementLeft
	switch tmp.Type {
	case "VariableDeclaration":
		n = new(VariableDeclaration)
	case "Identifier":
		n = new(Identifier)
	default:
		return fmt.Errorf("Unrecognized type %s", tmp.Type)
	}
	if err := json.Unmarshal(b, &n); err != nil {
		return err
	}
	this.N = n
	return nil
}

/********************************************************************/

// PropertyKey is an interface representing the things that can appear to
// the left othe colon in a property in an object literal -
// specifically, either a Literal ({"foo": ... }) or an Identifier
// ({foo: ...}).
type PropertyKey struct{ N propertyKey }
type propertyKey interface {
	_is_propertyKey()
}

func (Literal) _is_propertyKey()    {}
func (Identifier) _is_propertyKey() {}

func (this *PropertyKey) UnmarshalJSON(b []byte) error {
	var tmp typeOnly
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	var n propertyKey
	switch tmp.Type {
	case "Literal":
		n = new(Literal)
	case "Identifier":
		n = new(Identifier)
	default:
		return fmt.Errorf("Unrecognized type %s", tmp.Type)
	}
	if err := json.Unmarshal(b, &n); err != nil {
		return err
	}
	this.N = n
	return nil
}
