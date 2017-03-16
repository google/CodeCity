package ast

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestNewFromJSON(t *testing.T) {
	p, e := NewFromJSON([]byte(astJSON))
	if e != nil {
		t.Error(e)
	}
	// FIXME: test to see if returned tree was actually correct - not
	// just that it can be reencoded without error.
	s, e := json.MarshalIndent(p, "", "  ")
	if e != nil {
		t.Error(e)
	}
	fmt.Printf("%s\n", s)
}

const astJSON = `
{
  "type": "Program",
  "start": 0,
  "end": 221,
  "body": [
    {
      "type": "VariableDeclaration",
      "start": 0,
      "end": 16,
      "declarations": [
        {
          "type": "VariableDeclarator",
          "start": 4,
          "end": 15,
          "id": {
            "type": "Identifier",
            "start": 4,
            "end": 10,
            "name": "result"
          },
          "init": {
            "type": "ArrayExpression",
            "start": 13,
            "end": 15,
            "elements": []
          }
        }
      ],
      "kind": "var"
    }, {
      "type": "FunctionDeclaration",
      "start": 17,
      "end": 172,
      "id": {
        "type": "Identifier",
        "start": 26,
        "end": 35,
        "name": "fibonacci"
      },
      "params": [{
          "type": "Identifier",
          "start": 36,
          "end": 37,
          "name": "n"
        }, {
          "type": "Identifier",
          "start": 39,
          "end": 45,
          "name": "output"
        }
      ],
      "body": {
        "type": "BlockStatement",
        "start": 47,
        "end": 172,
        "body": [{
            "type": "VariableDeclaration",
            "start": 51,
            "end": 73,
            "declarations": [{
                "type": "VariableDeclarator",
                "start": 55,
                "end": 60,
                "id": {
                  "type": "Identifier",
                  "start": 55,
                  "end": 56,
                  "name": "a"
                },
                "init": {
                  "type": "Literal",
                  "start": 59,
                  "end": 60,
                  "value": 1,
                  "raw": "1"
                }
              }, {
                "type": "VariableDeclarator",
                "start": 62,
                "end": 67,
                "id": {
                  "type": "Identifier",
                  "start": 62,
                  "end": 63,
                  "name": "b"
                },
                "init": {
                  "type": "Literal",
                  "start": 66,
                  "end": 67,
                  "value": 1,
                  "raw": "1"
                }
              }, {
                "type": "VariableDeclarator",
                "start": 69,
                "end": 72,
                "id": {
                  "type": "Identifier",
                  "start": 69,
                  "end": 72,
                  "name": "sum"
                },
                "init": null
              }
            ],
            "kind": "var"
          }, {
            "type": "ForStatement",
            "start": 76,
            "end": 170,
            "init": {
              "type": "VariableDeclaration",
              "start": 81,
              "end": 90,
              "declarations": [{
                  "type": "VariableDeclarator",
                  "start": 85,
                  "end": 90,
                  "id": {
                    "type": "Identifier",
                    "start": 85,
                    "end": 86,
                    "name": "i"
                  },
                  "init": {
                    "type": "Literal",
                    "start": 89,
                    "end": 90,
                    "value": 0,
                    "raw": "0"
                  }
                }
              ],
              "kind": "var"
            },
            "test": {
              "type": "BinaryExpression",
              "start": 92,
              "end": 97,
              "left": {
                "type": "Identifier",
                "start": 92,
                "end": 93,
                "name": "i"
              },
              "operator": "<",
              "right": {
                "type": "Identifier",
                "start": 96,
                "end": 97,
                "name": "n"
              }
            },
            "update": {
              "type": "UpdateExpression",
              "start": 99,
              "end": 102,
              "operator": "++",
              "prefix": false,
              "argument": {
                "type": "Identifier",
                "start": 99,
                "end": 100,
                "name": "i"
              }
            },
            "body": {
              "type": "BlockStatement",
              "start": 104,
              "end": 170,
              "body": [{
                  "type": "ExpressionStatement",
                  "start": 110,
                  "end": 125,
                  "expression": {
                    "type": "CallExpression",
                    "start": 110,
                    "end": 124,
                    "callee": {
                      "type": "MemberExpression",
                      "start": 110,
                      "end": 121,
                      "object": {
                        "type": "Identifier",
                        "start": 110,
                        "end": 116,
                        "name": "output"
                      },
                      "property": {
                        "type": "Identifier",
                        "start": 117,
                        "end": 121,
                        "name": "push"
                      },
                      "computed": false
                    },
                    "arguments": [{
                        "type": "Identifier",
                        "start": 122,
                        "end": 123,
                        "name": "a"
                      }
                    ]
                  }
                }, {
                  "type": "ExpressionStatement",
                  "start": 130,
                  "end": 142,
                  "expression": {
                    "type": "AssignmentExpression",
                    "start": 130,
                    "end": 141,
                    "operator": "=",
                    "left": {
                      "type": "Identifier",
                      "start": 130,
                      "end": 133,
                      "name": "sum"
                    },
                    "right": {
                      "type": "BinaryExpression",
                      "start": 136,
                      "end": 141,
                      "left": {
                        "type": "Identifier",
                        "start": 136,
                        "end": 137,
                        "name": "a"
                      },
                      "operator": "+",
                      "right": {
                        "type": "Identifier",
                        "start": 140,
                        "end": 141,
                        "name": "b"
                      }
                    }
                  }
                }, {
                  "type": "ExpressionStatement",
                  "start": 147,
                  "end": 153,
                  "expression": {
                    "type": "AssignmentExpression",
                    "start": 147,
                    "end": 152,
                    "operator": "=",
                    "left": {
                      "type": "Identifier",
                      "start": 147,
                      "end": 148,
                      "name": "a"
                    },
                    "right": {
                      "type": "Identifier",
                      "start": 151,
                      "end": 152,
                      "name": "b"
                    }
                  }
                }, {
                  "type": "ExpressionStatement",
                  "start": 158,
                  "end": 166,
                  "expression": {
                    "type": "AssignmentExpression",
                    "start": 158,
                    "end": 165,
                    "operator": "=",
                    "left": {
                      "type": "Identifier",
                      "start": 158,
                      "end": 159,
                      "name": "b"
                    },
                    "right": {
                      "type": "Identifier",
                      "start": 162,
                      "end": 165,
                      "name": "sum"
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    }, {
      "type": "ExpressionStatement",
      "start": 173,
      "end": 195,
      "expression": {
        "type": "CallExpression",
        "start": 173,
        "end": 194,
        "callee": {
          "type": "Identifier",
          "start": 173,
          "end": 182,
          "name": "fibonacci"
        },
        "arguments": [{
            "type": "Literal",
            "start": 183,
            "end": 185,
            "value": 16,
            "raw": "16"
          }, {
            "type": "Identifier",
            "start": 187,
            "end": 193,
            "name": "result"
          }
        ]
      }
    }, {
      "type": "ExpressionStatement",
      "start": 196,
      "end": 221,
      "expression": {
        "type": "CallExpression",
        "start": 196,
        "end": 220,
        "callee": {
          "type": "Identifier",
          "start": 196,
          "end": 201,
          "name": "alert"
        },
        "arguments": [{
            "type": "CallExpression",
            "start": 202,
            "end": 219,
            "callee": {
              "type": "MemberExpression",
              "start": 202,
              "end": 213,
              "object": {
                "type": "Identifier",
                "start": 202,
                "end": 208,
                "name": "result"
              },
              "property": {
                "type": "Identifier",
                "start": 209,
                "end": 213,
                "name": "join"
              },
              "computed": false
            },
            "arguments": [{
                "type": "Literal",
                "start": 214,
                "end": 218,
                "value": ", ",
                "raw": "', '"
              }
            ]
          }
        ]
      }
    }
  ]
}
`
