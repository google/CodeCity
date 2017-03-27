/* Copyright 2017 Google Inc.
 * https://github.com/NeilFraser/CodeCity
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package ast defines types to store an abstract syntax tree, in
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
//
// Rules concerning use of pointers in AST node fields:
//
// - If the field is a (Go) int, string, or bool it is stored directly
// in node.
//
// - If the field is of a concrete type (like Identifier) it is stored
// as a pointer to the node.
//
// - If the filed is of an interface (wrapper) type (like Expression
// or Statements) the wrapper is stored directly in the node, but the
// wrapper will contain interface values which in turn store pointers
// to the child nodes.
//
// (These rules are applied automatically by md2go to code it
// generates.)
//
// It is intended that AST nodes will normally be created by the
// NewFromJSON() factory function.
package ast

//go:generate sh -c "./md2go es5.md > astnodes.go && go fmt"

import (
	"encoding/json"
	"fmt"
	"reflect"
)

// NewFromJSON is a factory function that creates an abstract syntax
// tree by unmarshalling a JSON-encoded ESTree.
//
// The present implementation assumes that the top-most node of the
// tree is a Program node.
func NewFromJSON(astJSON string) (ast *Program, err error) {
	var p *Program
	e := json.Unmarshal([]byte(astJSON), &p)
	if e != nil {
		return nil, e
	}
	return p, nil
}

/********************************************************************/

// node is an interface fulfilled by all ESTree nodes.
type node interface {
	_isNode()
}

// Node is any arbitrary ESTree node.
type Node node

// nodeStuff._isNode() is a dummy method for interface satisfaction.
func (nodeStuff) _isNode() {}

/********************************************************************/

// statement is an interface fulfilled by all ESTree <Foo>Statement
// nodes.
type statement interface {
	_isNode()
	_isStatement()
}

// statementStuff._isStatement() is a dummy method for interface
// satisfaction.
func (statementStuff) _isStatement() {}

// Statement is a wrapper of (a single instance of) the statement
// interface to allow a UnmarshallJSON method to be defined.
type Statement struct{ S statement }

// UnmarshalJSON should only be called from the encoding/json package.
func (stmnt *Statement) UnmarshalJSON(b []byte) error {
	// Special case: "null" -> nil
	if string(b) == "null" {
		stmnt.S = nil
		return nil
	}
	var tmp typeOnly
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	stype, ok := statementTypes[tmp.Type]
	if !ok {
		return fmt.Errorf("ast: json.Unmarshal: unknown type %s", tmp.Type)
	}
	var s = reflect.New(reflect.TypeOf(stype).Elem()).
		Interface().(statement)
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	stmnt.S = s
	return nil
}

// Statements is a wrapper of slice of statement interfaces to allow a
// UnmarshallJSON method to be defined.
type Statements []statement

// UnmarshalJSON should only be called from the encoding/json package.
func (stmnts *Statements) UnmarshalJSON(b []byte) error {
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
	*stmnts = s
	return nil
}

/********************************************************************/

// expression is an interface satisfied by all ESTree <Foo>Expression
// nodes.
type expression interface {
	_isNode()
	_isExpression()
}

// expressionStuff._isExpression() is a dummy method for interface
// satisfaction.
func (expressionStuff) _isExpression() {}

// Expression is a wrapper of (a single instance of) the expression
// interface to allow a UnmarshallJSON method to be defined.
type Expression struct{ E expression }

// UnmarshalJSON should only be called from the encoding/json package.
func (exp *Expression) UnmarshalJSON(b []byte) error {
	// Special case: "null" -> nil
	if string(b) == "null" {
		exp.E = nil
		return nil
	}
	var tmp typeOnly
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	etype, ok := expressionTypes[tmp.Type]
	if !ok {
		return fmt.Errorf("ast: json.Unmarshal: unknown type %s", tmp.Type)
	}
	var e = reflect.New(reflect.TypeOf(etype).Elem()).
		Interface().(expression)
	if err := json.Unmarshal(b, &e); err != nil {
		return err
	}
	exp.E = e
	return nil
}

// Expressions is a wrapper of slice of expression interfaces to allow
// a UnmarshallJSON method to be defined.
type Expressions []expression

// UnmarshalJSON should only be called from the encoding/json package.
func (exps *Expressions) UnmarshalJSON(b []byte) error {
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
	*exps = e
	return nil
}

/********************************************************************/

// ForStatementInit is (wrapper for an) interface representing the
// things that can appear in the first position of a for statement -
// specifically, either a VariableDeclaration (for(var v = 0; ...)) or
// an Expression (for(v = 0; ...)).
type ForStatementInit struct{ N forStatementInit }
type forStatementInit interface {
	_isNode()
	_isForStatementInit()
}

func (VariableDeclaration) _isForStatementInit() {}
func (Identifier) _isForStatementInit()          {}

// UnmarshalJSON should only be called from the encoding/json package.
func (fsi *ForStatementInit) UnmarshalJSON(b []byte) error {
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
	fsi.N = n
	return nil
}

/********************************************************************/

// ForInStatementLeft is a (wrapper for an) interface representing the
// things that can appear in the first position of a for-in statement
// - specifically, either a VariableDeclaration (for(var v in ...)) or
// an Identifier (for(v in ...).
type ForInStatementLeft struct{ N forInStatementLeft }
type forInStatementLeft interface {
	_isNode()
	_isForInStatementLeft()
}

func (VariableDeclaration) _isForInStatementLeft() {}
func (Identifier) _isForInStatementLeft()          {}

// UnmarshalJSON should only be called from the encoding/json package.
func (fisl *ForInStatementLeft) UnmarshalJSON(b []byte) error {
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
	fisl.N = n
	return nil
}

/********************************************************************/

// PropertyKey is an interface representing the things that can appear to
// the left othe colon in a property in an object literal -
// specifically, either a Literal ({"foo": ... }) or an Identifier
// ({foo: ...}).
type PropertyKey struct{ N propertyKey }
type propertyKey interface {
	_isNode()
	_isPropertyKey()
}

func (Literal) _isPropertyKey()    {}
func (Identifier) _isPropertyKey() {}

// UnmarshalJSON should only be called from the encoding/json package.
func (pk *PropertyKey) UnmarshalJSON(b []byte) error {
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
	pk.N = n
	return nil
}

/********************************************************************/

// typeOnly is used in the two-pass UnmarshalJSON routines: they
// initially unmarshal the unknown JSON object into this type, so as
// to be able to determine the node types to allocate for the second
// pass.  JSON unmarhsalling routines.
type typeOnly struct {
	Type string `json:"type"`
}
