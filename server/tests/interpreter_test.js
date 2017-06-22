'use strict';

var Interpreter = require('../');
var autoexec = require('../autoexec');
var testcases = require('./testcases');

for (var i = 0; i < testcases.length; i++) {
  var tc = testcases[i];

  if (!('expected' in tc)) {
    console.log('SKIP\t%s', tc.name);
    continue;
  }
  
  var interpreter = new Interpreter()
  interpreter.appendCode(autoexec);
  interpreter.run();

  var err = undefined;
  try {
    interpreter.appendCode(tc.src);
    interpreter.run();
  } catch (e) {
    err = e
  }
  var r = interpreter.pseudoToNative(interpreter.value);

  if (err) {
    console.error('FAILED\t%s\n\n%s\n', tc.name, tc.src.trim());
    console.error(err);
  } else if (r !== tc.expected) {
    console.error('FAILED\t%s\n\n%s\n\ngot: %j  want: %j',
    tc.name, tc.src.trim(), r, tc.expected);
  } else {
    console.log('OK\t%s', tc.name);
  }
}
		  
