package ast

//go:generate sh -c "./md2go es5.md > astnodes.go && go fmt"

import (
	"encoding/json"
	"fmt"
	"reflect"
)

// typeOnly is used to determine node types in first pass of two-pass
// JSON unmarhsalling routines.
type typeOnly struct {
	Type string `json:"type"`
}

type node interface {
	_is_node()
}

func (nodeStuff) _is_node() {}

type statement interface {
	_is_statement()
}

func (statementStuff) _is_statement() {}

type Statement struct{ S statement }
type Statements []statement

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

type Expression struct{ E expression }
type Expressions []expression
type expression interface {
	_is_expression()
}

func (expressionStuff) _is_expression() {}

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

type DeclOrID struct{ N declOrID }
type declOrID interface {
	_is_declOrID()
}

func (VariableDeclaration) _is_declOrID() {}
func (Identifier) _is_declOrID()          {}

func (this *DeclOrID) UnmarshalJSON(b []byte) error {
	var tmp typeOnly
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	var n declOrID
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

type LitOrID struct{ N litOrID }
type litOrID interface {
	_is_litOrID()
}

func (Literal) _is_litOrID()    {}
func (Identifier) _is_litOrID() {}

func (this *LitOrID) UnmarshalJSON(b []byte) error {
	var tmp typeOnly
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	var n litOrID
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
