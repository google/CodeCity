package ast

//go:generate sh -c "./md2go es5.md > astnodes.go && go fmt"

import (
	"encoding/json"
	"fmt"
	"reflect"
)

type node interface {
	_is_node()
}

func (nodeStuff) _is_node() {}

type statement interface {
	_is_statement()
}

func (statementStuff) _is_statement() {}

type Statement struct{ statement }
type Statements []statement

// func (this *Statement) UnmarshalJSON(b []byte) error {
// 	var tmp thingWithType
// 	if err := json.Unmarshal(b, &tmp); err != nil {
// 		return err
// 	}
// 	var s statement = reflect.New(reflect.TypeOf(statementTypes[tmp.Type]).
// 		Elem()).Interface().(statement)
// 	if err := json.Unmarshal(b, &s); err != nil {
// 		return err
// 	}
// 	this.statement = s
// 	return nil
// }

func (this *Statements) UnmarshalJSON(b []byte) error {
	var tmp []struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	s := make([]statement, len(tmp))
	for i, t := range tmp {
		fmt.Printf("Type = %s\n", t.Type)
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

type Expression struct{ expression }
type Expressions []expression
type expression interface {
	_is_expression()
}

func (expressionStuff) _is_expression() {}

func (this *Expression) UnmarshalJSON(b []byte) error {
	return nil
}

func (this *Expressions) UnmarshalJSON(b []byte) error {
	return nil
}

type DeclOrId declOrId
type declOrId interface {
	_is_declOrId()
}

func (VariableDeclaration) _is_declOrID() {}
func (Identifier) _is_declOrID()          {}

type LitOrId litOrId
type litOrId interface {
	_is_litOrId()
}

func (Literal) _is_litOrId()    {}
func (Identifier) _is_litOrId() {}
