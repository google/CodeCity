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

package interpreter

import (
	"reflect"

	"CodeCity/server/flatpack"
)

func init() {
	var ifaces = reflect.TypeOf(
		struct {
			i1 state
			i2 labelled
			i3 lvalue
			i4 value
		}{})
	for i := 0; i < ifaces.NumField(); i++ {
		flatpack.RegisterType(ifaces.Field(i).Type)
	}

	var examples = []interface{}{
		// From closure.go:
		closure{},

		// From cval.go:
		cvalType(0),
		cval{},

		// From interpreter.go:
		Interpreter{},

		// From reference.go:
		reference{},

		// From scope.go:
		scope{},

		// From state.go:
		stateCommon{},
		labelsCommon{},
		lvalueCommon{},
		stateArrayExpression{},
		stateAssignmentExpression{},
		stateBinaryExpression{},
		stateBlockStatement{},
		stateBreakStatement{},
		stateCallExpression{},
		stateCatchClause{},
		stateConditionalExpression{},
		stateContinueStatement{},
		stateEmptyStatement{},
		stateExpressionStatement{},
		stateForState(0),
		stateForStatement{},
		stateForInState(0),
		stateForInStatement{},
		stateFunctionDeclaration{},
		stateFunctionExpression{},
		stateIdentifier{},
		stateIfStatement{},
		stateLabeledStatement{},
		stateLiteral{},
		stateLogicalExpression{},
		stateMemberExpression{},
		stateObjectExpression{},
		stateReturnStatement{},
		stateSequenceExpression{},
		stateSwitchStatement{},
		stateThisExpression{},
		stateThrowStatement{},
		stateTryStatement{},
		stateUnaryDeleteExpression{},
		stateUnaryTypeofExpression{},
		stateUnaryExpression{},
		stateUpdateExpression{},
		stateVariableDeclaration{},
		stateWhileStatement{},
	}
	for _, val := range examples {
		flatpack.RegisterTypeOf(val)
	}
}
